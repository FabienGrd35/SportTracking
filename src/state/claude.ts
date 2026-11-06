import Anthropic from '@anthropic-ai/sdk';
import * as SecureStore from 'expo-secure-store';
import { COACH_SYSTEM_PROMPT } from '../lib/claudeContext.ts';
import { parseWeightExtraction, WEIGHT_EXTRACTION_PROMPT, WEIGHT_EXTRACTION_SCHEMA } from '../lib/weightExtraction.ts';

const KEY = 'anthropic-api-key';
const MODEL = 'claude-opus-5-5';
/** Tarifs Claude Opus 5.5 en $ par million de tokens (entrée, sortie, lecture de cache). */
const PRICE = { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 };

export const getClaudeKey = () => SecureStore.getItemAsync(KEY);
export const setClaudeKey = (v: string) => (v.trim() ? SecureStore.setItemAsync(KEY, v.trim()) : SecureStore.deleteItemAsync(KEY));

async function client(): Promise<Anthropic> {
  const apiKey = await getClaudeKey();
  if (!apiKey) throw new Error('Ajoute ta clé API Claude dans Réglages (console.anthropic.com → API Keys).');
  return new Anthropic({ apiKey, maxRetries: 2, timeout: 5 * 60 * 1000 });
}

export type ChatTurn = { role: 'user' | 'assistant'; text: string };
export type ClaudeReply = { text: string; costUsd: number };

function cost(u: Anthropic.Beta.BetaUsage): number {
  return (
    (u.input_tokens * PRICE.input +
      u.output_tokens * PRICE.output +
      (u.cache_read_input_tokens ?? 0) * PRICE.cacheRead +
      (u.cache_creation_input_tokens ?? 0) * PRICE.cacheWrite) /
    1_000_000
  );
}

function explain(e: unknown): Error {
  if (e instanceof Anthropic.AuthenticationError) return new Error('Clé API Claude invalide.');
  if (e instanceof Anthropic.PermissionDeniedError) return new Error("Clé API sans accès à ce modèle, ou crédit épuisé (console.anthropic.com → Billing).");
  if (e instanceof Anthropic.RateLimitError) return new Error('Trop de requêtes : réessaie dans une minute.');
  if (e instanceof Anthropic.APIConnectionError) return new Error('Pas de connexion à Claude. Vérifie le réseau.');
  if (e instanceof Anthropic.APIError) return new Error(`Erreur Claude ${e.status ?? ''} : ${e.message}`);
  return e instanceof Error ? e : new Error(String(e));
}

function textOf(msg: Anthropic.Beta.BetaMessage): string {
  if (msg.stop_reason === 'refusal') throw new Error('Claude a refusé de répondre à cette demande.');
  return msg.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

/**
 * Conversation avec le coach. Les données sont placées en tête (premier message) avec un point
 * de cache : les questions suivantes relisent ce préfixe à ~5 % du prix.
 */
export async function askCoach(dataContext: string, history: ChatTurn[]): Promise<ClaudeReply> {
  if (history.length === 0 || history[history.length - 1].role !== 'user') {
    throw new Error('La conversation doit se terminer par une question.');
  }
  const c = await client();
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: 'user',
      content: [{ type: 'text', text: `Voici mes données :\n\n${dataContext}`, cache_control: { type: 'ephemeral' } }],
    },
    { role: 'assistant', content: "Données reçues. Que veux-tu savoir ?" },
    ...history.map((t) => ({ role: t.role, content: t.text })),
  ];
  try {
    const msg = await c.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high' },
      system: COACH_SYSTEM_PROMPT,
      messages,
    });
    return { text: textOf(msg), costUsd: cost(msg.usage) };
  } catch (e) {
    throw explain(e);
  }
}

/** Lit des captures d'écran Renpho et renvoie les pesées reconnues (sortie JSON structurée). */
export async function extractWeightsFromImages(
  images: { base64: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' }[],
  today: string,
) {
  const c = await client();
  try {
    const msg = await c.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: WEIGHT_EXTRACTION_SCHEMA } },
      messages: [
        {
          role: 'user',
          content: [
            ...images.map((img) => ({
              type: 'image' as const,
              source: { type: 'base64' as const, media_type: img.mediaType, data: img.base64 },
            })),
            { type: 'text' as const, text: WEIGHT_EXTRACTION_PROMPT(today) },
          ],
        },
      ],
    });
    return { ...parseWeightExtraction(textOf(msg), today), costUsd: cost(msg.usage) };
  } catch (e) {
    throw explain(e);
  }
}
