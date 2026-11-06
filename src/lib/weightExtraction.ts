import type { WeightEntry } from './types.ts';

/** Schéma JSON demandé à Claude quand il lit des captures d'écran Renpho. */
export const WEIGHT_EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    measurements: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'AAAA-MM-JJ' },
          weight_kg: { type: 'number' },
          body_fat_pct: { anyOf: [{ type: 'number' }, { type: 'null' }] },
          muscle_mass_kg: { anyOf: [{ type: 'number' }, { type: 'null' }] },
        },
        required: ['date', 'weight_kg', 'body_fat_pct', 'muscle_mass_kg'],
        additionalProperties: false,
      },
    },
    notes: { type: 'string', description: 'Ce qui était illisible ou ambigu, vide sinon.' },
  },
  required: ['measurements', 'notes'],
  additionalProperties: false,
} as const;

export const WEIGHT_EXTRACTION_PROMPT = (today: string) =>
  `Ces captures d'écran viennent de l'appli de balance Renpho. Extrais chaque mesure lisible : date, poids en kg, ` +
  `% de masse grasse et masse musculaire en kg s'ils sont affichés (sinon null). ` +
  `Nous sommes le ${today} : si l'année n'est pas affichée, déduis-la (une date ne peut pas être dans le futur). ` +
  `Convertis les livres en kg. N'invente aucune valeur : ignore ce qui est illisible et signale-le dans notes. ` +
  `Si une capture montre une courbe sans valeurs chiffrées par jour, n'en tire rien.`;

type Raw = { measurements?: { date?: unknown; weight_kg?: unknown; body_fat_pct?: unknown; muscle_mass_kg?: unknown }[]; notes?: unknown };

/** Valide la réponse de Claude : on écarte toute valeur invraisemblable plutôt que de la stocker. */
export function parseWeightExtraction(json: string, today: string): { entries: WeightEntry[]; rejected: number; notes: string } {
  const raw = JSON.parse(json) as Raw;
  const entries: WeightEntry[] = [];
  let rejected = 0;
  for (const m of raw.measurements ?? []) {
    const date = typeof m.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(m.date) ? m.date : null;
    const kg = typeof m.weight_kg === 'number' ? m.weight_kg : NaN;
    if (!date || date > today || !(kg >= 25 && kg <= 350)) {
      rejected++;
      continue;
    }
    const fat = typeof m.body_fat_pct === 'number' && m.body_fat_pct > 2 && m.body_fat_pct < 70 ? m.body_fat_pct : undefined;
    const muscle = typeof m.muscle_mass_kg === 'number' && m.muscle_mass_kg > 10 && m.muscle_mass_kg < kg ? m.muscle_mass_kg : undefined;
    entries.push({ date, weightKg: Math.round(kg * 100) / 100, bodyFatPct: fat, muscleMassKg: muscle, source: 'renpho' });
  }
  return { entries, rejected, notes: typeof raw.notes === 'string' ? raw.notes : '' };
}
