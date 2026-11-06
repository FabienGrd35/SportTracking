import { useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { BarChart } from '../src/components/charts.tsx';
import { MacroBars } from '../src/components/MacroBars.tsx';
import { useTheme } from '../src/components/theme.ts';
import { Button, Card, Field, fmt, Muted, num, Row, Screen, Title } from '../src/components/ui.tsx';
import { addDays, formatShort, today } from '../src/lib/dates.ts';
import { aggregateDays } from '../src/lib/energy.ts';
import { useStore } from '../src/state/store.tsx';
import { useAnalysis } from '../src/state/useAnalysis.ts';

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export default function Nutrition() {
  const t = useTheme();
  const { state, dispatch } = useStore();
  const { targets } = useAnalysis();
  const [date, setDate] = useState(today());
  const [form, setForm] = useState({ label: '', kcal: '', p: '', c: '', f: '' });

  const days = useMemo(() => aggregateDays(state.foods), [state.foods]);
  const day = days.find((d) => d.date === date);
  const entries = state.foods.filter((f) => f.date === date);
  const fromSheet = entries.some((e) => e.source === 'sheet');
  const last14 = Array.from({ length: 14 }, (_, i) => addDays(today(), i - 13)).map((d) => ({
    label: formatShort(d).slice(0, 2),
    value: days.find((x) => x.date === d)?.kcal ?? 0,
  }));

  const p = num(form.p) ?? 0;
  const c = num(form.c) ?? 0;
  const f = num(form.f) ?? 0;
  const computedKcal = Math.round(p * 4 + c * 4 + f * 9);
  const kcal = num(form.kcal) ?? computedKcal;

  const add = () => {
    if (kcal <= 0) return Alert.alert('Saisie incomplète', 'Indique au moins les calories ou les macros.');
    dispatch({
      type: 'addFood',
      entry: { id: uid(), date, label: form.label.trim() || 'Repas', kcal, proteinG: p, carbsG: c, fatG: f, source: 'manual' },
    });
    setForm({ label: '', kcal: '', p: '', c: '', f: '' });
  };

  const copyPreviousDay = () => {
    const prev = state.foods.filter((x) => x.date === addDays(date, -1) && x.source !== 'sheet');
    if (!prev.length) return Alert.alert('Rien à copier', 'La veille est vide.');
    prev.forEach((x) => dispatch({ type: 'addFood', entry: { ...x, id: uid(), date } }));
  };

  return (
    <Screen>
      <Title>Nutrition</Title>
      <Row>
        <Button kind="secondary" label="‹" onPress={() => setDate(addDays(date, -1))} />
        <View style={{ flex: 1, alignItems: 'center', paddingBottom: 10 }}>
          <Text style={{ color: t.text, fontWeight: '600', fontSize: 16 }}>
            {date === today() ? "Aujourd'hui" : formatShort(date)}
          </Text>
        </View>
        <Button kind="secondary" label="›" disabled={date >= today()} onPress={() => setDate(addDays(date, 1))} />
      </Row>

      <Card>
        <MacroBars kcal={day?.kcal ?? 0} proteinG={day?.proteinG ?? 0} carbsG={day?.carbsG ?? 0} fatG={day?.fatG ?? 0} targets={targets} />
        {fromSheet ? (
          <View style={{ marginTop: 10 }}>
            <Muted>Journée importée de Google Sheets : c'est elle qui fait foi, les saisies manuelles de ce jour sont ignorées.</Muted>
          </View>
        ) : null}
        {day && day.kcal > 0 ? (
          <View style={{ marginTop: 10 }}>
            <Muted>
              Répartition : protéines {fmt(((day.proteinG * 4) / day.kcal) * 100)} % · glucides{' '}
              {fmt(((day.carbsG * 4) / day.kcal) * 100)} % · lipides {fmt(((day.fatG * 9) / day.kcal) * 100)} %
            </Muted>
          </View>
        ) : null}
      </Card>

      <Card title={state.sheetUrl ? 'Ajouter (hors Google Sheets)' : 'Ajouter'}>
        <View style={{ gap: 10 }}>
          <Field label="Repas / aliment" value={form.label} onChangeText={(v) => setForm({ ...form, label: v })} placeholder="Déjeuner" />
          <Row gap={8}>
            <Field label="Prot. (g)" keyboardType="decimal-pad" value={form.p} onChangeText={(v) => setForm({ ...form, p: v })} />
            <Field label="Gluc. (g)" keyboardType="decimal-pad" value={form.c} onChangeText={(v) => setForm({ ...form, c: v })} />
            <Field label="Lip. (g)" keyboardType="decimal-pad" value={form.f} onChangeText={(v) => setForm({ ...form, f: v })} />
          </Row>
          <Field
            label="Calories"
            keyboardType="decimal-pad"
            value={form.kcal}
            onChangeText={(v) => setForm({ ...form, kcal: v })}
            placeholder={computedKcal ? `${computedKcal} (calculé)` : 'kcal'}
          />
          <Button label="Ajouter" onPress={add} />
          <Button kind="secondary" label="Copier les repas de la veille" onPress={copyPreviousDay} />
        </View>
      </Card>

      {entries.length > 0 && (
        <Card title="Repas du jour">
          {entries.map((e) => (
            <Pressable
              key={e.id}
              disabled={e.source === 'sheet'}
              onLongPress={() =>
                Alert.alert('Supprimer ?', e.label, [
                  { text: 'Annuler', style: 'cancel' },
                  { text: 'Supprimer', style: 'destructive', onPress: () => dispatch({ type: 'removeFood', id: e.id }) },
                ])
              }
              style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.border }}
            >
              <Text style={{ color: t.text, fontWeight: '600' }}>{e.label} · {fmt(e.kcal)} kcal</Text>
              <Muted>P {fmt(e.proteinG)} g · G {fmt(e.carbsG)} g · L {fmt(e.fatG)} g</Muted>
            </Pressable>
          ))}
          <View style={{ marginTop: 6 }}><Muted>Appui long pour supprimer.</Muted></View>
        </Card>
      )}

      <Card title="Calories — 14 derniers jours">
        <BarChart bars={last14} target={targets?.kcal} />
        <Muted>Pointillés : objectif calorique du jour.</Muted>
      </Card>
    </Screen>
  );
}
