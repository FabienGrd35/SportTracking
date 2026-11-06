import { useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { BarChart } from '../src/components/charts.tsx';
import { useTheme } from '../src/components/theme.ts';
import { Button, Card, fmt, Muted, Row, Screen, Stat, Title } from '../src/components/ui.tsx';
import { addDays, formatShort, today, weekStart } from '../src/lib/dates.ts';
import { liftTrends, periodTotals, weeklyTraining } from '../src/lib/training.ts';
import { useStore } from '../src/state/store.tsx';
import { syncHevy } from '../src/state/hevySync.ts';

export default function Entrainement() {
  const t = useTheme();
  const { state, dispatch } = useStore();
  const [busy, setBusy] = useState(false);

  const end = today();
  const weeks = useMemo(() => weeklyTraining(state.workouts), [state.workouts]);
  const last12 = Array.from({ length: 12 }, (_, i) => weekStart(addDays(end, (i - 11) * 7))).map((wk) => ({
    label: formatShort(wk).slice(0, 2),
    value: weeks.find((w) => w.week === wk)?.workingSets ?? 0,
  }));
  const lifts = useMemo(() => liftTrends(state.workouts, end, 8), [state.workouts, end]);
  const month = periodTotals(state.workouts, end, 28);

  const sync = async (full = false) => {
    setBusy(true);
    try {
      const r = await syncHevy(full ? null : state.hevyLastSync);
      dispatch({ type: 'hevySync', ...r });
      Alert.alert('Hevy', `${r.updated.length} séance(s) mise(s) à jour${r.deletedIds.length ? `, ${r.deletedIds.length} supprimée(s)` : ''}.`);
    } catch (e) {
      Alert.alert('Synchro Hevy impossible', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Title>Musculation</Title>
      <Card>
        <Row>
          <Stat label="Séances (28 j)" value={String(month.sessions)} />
          <Stat label="Séries (28 j)" value={String(month.workingSets)} />
          <Stat label="Tonnage (28 j)" value={`${fmt(month.volumeKg / 1000, 1)} t`} />
        </Row>
      </Card>

      <Card title="Hevy">
        <View style={{ gap: 8 }}>
          <Muted>
            {state.hevyLastSync
              ? `Dernière synchro : ${new Date(state.hevyLastSync).toLocaleString('fr-FR')}`
              : 'Jamais synchronisé. La première synchro récupère tout ton historique.'}
          </Muted>
          <Button label={busy ? 'Synchronisation…' : 'Synchroniser'} disabled={busy} onPress={() => sync()} />
          {state.hevyLastSync ? (
            <Button kind="secondary" label="Tout resynchroniser" disabled={busy} onPress={() => sync(true)} />
          ) : null}
        </View>
      </Card>

      <Card title="Séries effectives par semaine">
        <BarChart bars={last12} />
        <Muted>Hors échauffements. 10–20 séries par groupe musculaire et par semaine est la zone habituelle pour progresser.</Muted>
      </Card>

      <Card title="Force estimée (1RM) — 4 dernières semaines vs 4 précédentes">
        {lifts.length === 0 ? (
          <Muted>Il faut au moins 8 semaines d'historique sur un même exercice.</Muted>
        ) : (
          lifts.map((l) => (
            <View key={l.templateId} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
              <Text style={{ color: t.text, flex: 1 }} numberOfLines={1}>{l.name}</Text>
              <Text style={{ color: t.text }}>{fmt(l.recentE1rm, 1)} kg </Text>
              <Text style={{ color: l.changePct >= 0 ? t.good : t.warn, width: 64, textAlign: 'right', fontWeight: '600' }}>
                {l.changePct >= 0 ? '+' : ''}{fmt(l.changePct, 1)} %
              </Text>
            </View>
          ))
        )}
      </Card>

      {state.workouts.length > 0 && (
        <Card title="Dernières séances">
          {[...state.workouts].reverse().slice(0, 10).map((w) => (
            <View key={w.id} style={{ paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: t.border }}>
              <Text style={{ color: t.text, fontWeight: '600' }}>{w.title} · {formatShort(w.date)}</Text>
              <Muted>{w.durationMin} min · {w.workingSets} séries · {fmt(w.volumeKg)} kg soulevés</Muted>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}
