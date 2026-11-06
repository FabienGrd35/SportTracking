import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Markdown } from '../src/components/Markdown.tsx';
import { useTheme } from '../src/components/theme.ts';
import { Button, Card, Muted } from '../src/components/ui.tsx';
import { buildDataContext } from '../src/lib/claudeContext.ts';
import { today } from '../src/lib/dates.ts';
import { askCoach, getClaudeKey } from '../src/state/claude.ts';
import { useStore } from '../src/state/store.tsx';
import { useAnalysis } from '../src/state/useAnalysis.ts';

const FULL_ANALYSIS =
  "Fais-moi l'analyse complète de mes tendances : nutrition, poids, entraînement, et ce qui les relie. " +
  "Qu'est-ce qui marche, qu'est-ce qui coince, et que dois-je changer en priorité ?";

const SUGGESTIONS = [
  'Pourquoi mon poids ne bouge pas ?',
  'Mes protéines sont-elles suffisantes ?',
  'Est-ce que je perds du muscle ?',
  'Que donne ma dernière phase de prise de masse ?',
];

export default function Coach() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useStore();
  const analysis = useAnalysis();
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scroll = useRef<ScrollView>(null);

  // Revérifie la clé à chaque retour sur l'onglet (elle a pu être ajoutée dans Réglages).
  useFocusEffect(
    useCallback(() => {
      getClaudeKey().then((k) => setHasKey(!!k));
    }, []),
  );

  const context = useMemo(
    () => buildDataContext(state.profile, state.weights, state.foods, state.workouts, analysis, today()),
    [state.profile, state.weights, state.foods, state.workouts, analysis],
  );

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setInput('');
    dispatch({ type: 'coachTurn', role: 'user', text: q });
    setBusy(true);
    try {
      const history = [...state.coachChat, { role: 'user' as const, text: q }].map(({ role, text: tx }) => ({ role, text: tx }));
      const r = await askCoach(context, history);
      dispatch({ type: 'coachTurn', role: 'assistant', text: r.text, costUsd: r.costUsd });
    } catch (e) {
      dispatch({ type: 'coachTurn', role: 'assistant', text: `⚠️ ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setBusy(false);
    }
  };

  const empty = !state.foods.length && !state.weights.length && !state.workouts.length;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        ref={scroll}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, gap: 12 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 28, fontWeight: '700', color: t.text }}>Coach</Text>
          {state.coachChat.length > 0 && (
            <Pressable onPress={() => Alert.alert('Nouvelle conversation ?', '', [
              { text: 'Annuler', style: 'cancel' },
              { text: 'Effacer', onPress: () => dispatch({ type: 'coachClear' }) },
            ])}>
              <Text style={{ color: t.accent, fontWeight: '600' }}>Nouvelle</Text>
            </Pressable>
          )}
        </View>

        {hasKey === false && (
          <Card title="Brancher Claude">
            <View style={{ gap: 8 }}>
              <Muted>
                Il faut une clé API Claude (console.anthropic.com → API Keys). Elle est facturée à l'usage, séparément
                de ton abonnement claude.ai : compte environ 0,10 à 0,30 $ par analyse complète.
              </Muted>
              <Button label="Ajouter ma clé dans Réglages" onPress={() => router.push('/reglages')} />
            </View>
          </Card>
        )}

        {empty && (
          <Card>
            <Muted>Aucune donnée pour l'instant : importe ton historique (Réglages → Nutrition) et tes pesées (Poids).</Muted>
          </Card>
        )}

        {state.coachChat.length === 0 && hasKey !== false && (
          <View style={{ gap: 8 }}>
            <Button label="Analyser mes tendances" disabled={busy || empty} onPress={() => send(FULL_ANALYSIS)} />
            {SUGGESTIONS.map((s) => (
              <Button key={s} kind="secondary" label={s} disabled={busy || empty} onPress={() => send(s)} />
            ))}
          </View>
        )}

        {state.coachChat.map((m, i) => (
          <View
            key={i}
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'stretch',
              maxWidth: m.role === 'user' ? '85%' : '100%',
              backgroundColor: m.role === 'user' ? t.accent : t.card,
              borderRadius: 14,
              padding: 12,
            }}
          >
            {m.role === 'user' ? (
              <Text style={{ color: '#fff', fontSize: 15, lineHeight: 21 }}>{m.text}</Text>
            ) : (
              <Markdown text={m.text} />
            )}
          </View>
        ))}

        {busy && (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <ActivityIndicator color={t.accent} />
            <Muted>Claude analyse tes données…</Muted>
          </View>
        )}

        {state.claudeSpentUsd > 0 && (
          <Muted>Dépensé en API Claude depuis l'installation : {state.claudeSpentUsd.toFixed(2).replace('.', ',')} $</Muted>
        )}
      </ScrollView>

      {hasKey !== false && (
        <View style={{ flexDirection: 'row', gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: t.border, backgroundColor: t.card }}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Pose une question sur tes données…"
            placeholderTextColor={t.muted}
            multiline
            style={{ flex: 1, color: t.text, fontSize: 15, maxHeight: 120, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: t.bg, borderRadius: 10 }}
          />
          <Button label="Envoyer" disabled={busy || !input.trim()} onPress={() => send(input)} />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
