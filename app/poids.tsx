import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { extractWeightsFromImages } from '../src/state/claude.ts';
import { File } from 'expo-file-system';
import { useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { TrendChart } from '../src/components/charts.tsx';
import { useTheme } from '../src/components/theme.ts';
import { Button, Card, Field, fmt, Muted, num, Row, Screen, Segmented, Stat, Title } from '../src/components/ui.tsx';
import { addDays, formatShort, today } from '../src/lib/dates.ts';
import { parseRenphoCsv } from '../src/lib/renphoCsv.ts';
import { weightTrend } from '../src/lib/trend.ts';
import { connectHealth, healthConnectSupported, syncHealth } from '../src/state/healthConnect.ts';
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

  const [busy, setBusy] = useState(false);
  const syncHealthNow = async () => {
    setBusy(true);
    try {
      if (!state.healthEnabled) {
        if (!(await connectHealth())) return Alert.alert('Health Connect', "Autorisation de lecture du poids refusée.");
        dispatch({ type: 'setHealthEnabled', enabled: true });
      }
      const r = await syncHealth(state.healthEnabled ? state.healthLastSync : null);
      dispatch({ type: 'healthSync', ...r });
      Alert.alert('Health Connect', r.entries.length ? `${r.entries.length} jour(s) de pesée mis à jour.` :
        "Aucune pesée trouvée. Vérifie dans l'appli Renpho que la synchro Health Connect est activée.");
    } catch (e) {
      Alert.alert('Health Connect', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const importScreenshots = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 10,
      base64: true,
      quality: 0.7,
    });
    if (res.canceled) return;
    const images = res.assets
      .filter((a) => a.base64)
      .map((a) => ({
        base64: a.base64 as string,
        mediaType: (a.mimeType === 'image/png' ? 'image/png' : a.mimeType === 'image/webp' ? 'image/webp' : 'image/jpeg') as
          'image/png' | 'image/webp' | 'image/jpeg',
      }));
    setBusy(true);
    try {
      const r = await extractWeightsFromImages(images, today());
      if (!r.entries.length) {
        return Alert.alert('Captures Renpho', `Aucune pesée lisible.${r.notes ? `\n${r.notes}` : ''}`);
      }
      const list = r.entries.slice(-8).map((e) => `${formatShort(e.date)} : ${fmt(e.weightKg, 1)} kg`).join('\n');
      Alert.alert(
        'Vérifie avant d\'importer',
        `${r.entries.length} pesée(s) lue(s) par Claude${r.rejected ? `, ${r.rejected} écartée(s)` : ''} :\n${list}${r.entries.length > 8 ? '\n…' : ''}` +
          `${r.notes ? `\n\nRemarque : ${r.notes}` : ''}`,
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Importer', onPress: () => dispatch({ type: 'importWeights', entries: r.entries }) },
        ],
      );
    } catch (e) {
      Alert.alert('Captures Renpho', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
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

      {healthConnectSupported && (
        <Card title="Renpho via Health Connect">
          <View style={{ gap: 8 }}>
            <Muted>
              {state.healthLastSync
                ? `Synchro automatique à l'ouverture. Dernière : ${new Date(state.healthLastSync).toLocaleString('fr-FR')}`
                : "Dans l'appli Renpho, active la synchro vers Health Connect, puis connecte-la ici : tes pesées arriveront automatiquement."}
            </Muted>
            <Button
              label={busy ? 'Synchronisation…' : state.healthEnabled ? 'Synchroniser maintenant' : 'Connecter Health Connect'}
              disabled={busy}
              onPress={syncHealthNow}
            />
          </View>
        </Card>
      )}

      <Card title="Captures d'écran Renpho (via Claude)">
        <View style={{ gap: 8 }}>
          <Muted>
            Dans l'appli Renpho, ouvre l'historique des mesures (liste jour par jour) et fais des captures d'écran.
            Claude lit les dates et les poids ; tu vérifies avant l'import. Les courbes sans chiffres ne sont pas exploitables.
          </Muted>
          <Button label={busy ? 'Lecture…' : 'Importer des captures'} disabled={busy} onPress={importScreenshots} />
        </View>
      </Card>

      <Card title="Import CSV Renpho (secours)">
        <View style={{ gap: 8 }}>
          <Muted>
            Pour récupérer un historique plus ancien que ce qu'a reçu Health Connect : dans l'appli Renpho, exporte
            les données en CSV puis importe le fichier ici. Les mesures déjà présentes sont mises à jour, pas dupliquées.
          </Muted>
          <Button kind="secondary" label="Importer un CSV Renpho" onPress={importCsv} />
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
                <Text style={{ color: t.muted, fontWeight: '400' }}> {w.source === 'renpho' ? 'Renpho CSV' : w.source === 'health' ? 'Health Connect' : 'manuel'}</Text>
              </Text>
            </Pressable>
          ))}
        </Card>
      )}
    </Screen>
  );
}
