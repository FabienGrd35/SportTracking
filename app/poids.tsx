import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { TrendChart } from '../src/components/charts.tsx';
import { useTheme } from '../src/components/theme.ts';
import { Button, Card, Field, fmt, Muted, num, Row, Screen, Segmented, Stat, Title } from '../src/components/ui.tsx';
import { addDays, formatShort, today } from '../src/lib/dates.ts';
import { parseRenphoCsv } from '../src/lib/renphoCsv.ts';
import { weightTrend } from '../src/lib/trend.ts';
import { useStore } from '../src/state/store.tsx';
import { useAnalysis } from '../src/state/useAnalysis.ts';

type Range = '30' | '90' | '365';

export default function Poids() {
  const t = useTheme();
  const { state, dispatch } = useStore();
  const a = useAnalysis();
  const [range, setRange] = useState<Range>('90');
  const [manual, setManual] = useState('');

  const trend = useMemo(() => weightTrend(state.weights), [state.weights]);
  const from = addDays(today(), -Number(range));
  const shown = trend.filter((p) => p.date >= from).map((p) => ({ ...p, label: formatShort(p.date) }));
  const lastFat = [...state.weights].reverse().find((w) => w.bodyFatPct !== undefined);

  const importCsv = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true,
      });
      if (res.canceled) return;
      const text = await new File(res.assets[0].uri).text();
      const r = parseRenphoCsv(text);
      dispatch({ type: 'importWeights', entries: r.entries });
      Alert.alert('Import Renpho', `${r.entries.length} mesures importées${r.skipped ? `, ${r.skipped} lignes ignorées` : ''}.`);
    } catch (e) {
      Alert.alert('Import impossible', e instanceof Error ? e.message : String(e));
    }
  };

  const addManual = () => {
    const kg = num(manual);
    if (!kg || kg < 20 || kg > 400) return Alert.alert('Poids invalide');
    dispatch({ type: 'importWeights', entries: [{ date: today(), weightKg: kg, source: 'manual' }] });
    setManual('');
  };

  return (
    <Screen>
      <Title>Poids</Title>
      <Card>
        <Row>
          <Stat label="Tendance" value={a.currentTrendKg ? `${fmt(a.currentTrendKg, 1)} kg` : '—'} />
          <Stat label="Par semaine" value={a.weeklyRateKg !== null ? `${a.weeklyRateKg >= 0 ? '+' : ''}${fmt(a.weeklyRateKg, 2)} kg` : '—'} />
          <Stat label="Masse grasse" value={lastFat?.bodyFatPct ? `${fmt(lastFat.bodyFatPct, 1)} %` : '—'} sub="Renpho" />
        </Row>
      </Card>

      <Card title="Évolution">
        <Segmented<Range>
          value={range}
          onChange={setRange}
          options={[{ value: '30', label: '1 mois' }, { value: '90', label: '3 mois' }, { value: '365', label: '1 an' }]}
        />
        <View style={{ marginTop: 10 }}>
          {shown.length >= 2 ? <TrendChart points={shown} /> : <Muted>Pas encore assez de pesées sur la période.</Muted>}
        </View>
        <Muted>
          Points gris : pesées du jour. Ligne bleue : tendance lissée. Le poids d'un jour varie de ±1 kg avec l'eau et
          le contenu digestif ; seule la tendance reflète la variation de gras/muscle.
        </Muted>
      </Card>

      <Card title="Renpho">
        <View style={{ gap: 8 }}>
          <Muted>
            Renpho ne propose pas d'API publique. Dans l'appli Renpho : Moi → Paramètres → Exporter les données (CSV),
            puis importe le fichier ici. Les mesures déjà présentes sont mises à jour, pas dupliquées.
          </Muted>
          <Button label="Importer un CSV Renpho" onPress={importCsv} />
        </View>
      </Card>

      <Card title="Saisie manuelle (aujourd'hui)">
        <Row>
          <Field label="Poids (kg)" keyboardType="decimal-pad" value={manual} onChangeText={setManual} placeholder="82,4" />
          <Button label="Ajouter" onPress={addManual} />
        </Row>
      </Card>

      {state.weights.length > 0 && (
        <Card title="Dernières mesures">
          {[...state.weights].reverse().slice(0, 15).map((w) => (
            <Pressable
              key={`${w.date}${w.source}`}
              onLongPress={() =>
                Alert.alert('Supprimer cette mesure ?', `${w.date} · ${w.weightKg} kg`, [
                  { text: 'Annuler', style: 'cancel' },
                  { text: 'Supprimer', style: 'destructive', onPress: () => dispatch({ type: 'removeWeight', date: w.date, source: w.source }) },
                ])
              }
              style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}
            >
              <Text style={{ color: t.text }}>{formatShort(w.date)} {w.date.slice(0, 4)}</Text>
              <Text style={{ color: t.text, fontWeight: '600' }}>
                {fmt(w.weightKg, 1)} kg{w.bodyFatPct ? ` · ${fmt(w.bodyFatPct, 1)} %` : ''}
                <Text style={{ color: t.muted, fontWeight: '400' }}> {w.source === 'renpho' ? 'Renpho' : 'manuel'}</Text>
              </Text>
            </Pressable>
          ))}
        </Card>
      )}
    </Screen>
  );
}
