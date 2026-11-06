import { useEffect, useState } from 'react';
import { Alert, Linking, View } from 'react-native';
import { Button, Card, Field, Muted, num, Row, Screen, Segmented, Title } from '../src/components/ui.tsx';
import type { ActivityLevel, Goal, Profile, Sex } from '../src/lib/types.ts';
import { getHevyKey, setHevyKey } from '../src/state/hevySync.ts';
import { getClaudeKey, setClaudeKey } from '../src/state/claude.ts';
import { pickNutritionFile } from '../src/state/nutritionFile.ts';
import { fetchNutritionSheet } from '../src/state/sheetSync.ts';
import { useStore } from '../src/state/store.tsx';

export default function Reglages() {
  const { state, dispatch } = useStore();
  const p = state.profile;
  const [height, setHeight] = useState(String(p.heightCm));
  const [birth, setBirth] = useState(String(p.birthYear));
  const [rate, setRate] = useState(String(p.targetRatePctPerWeek).replace('.', ','));
  const [key, setKey] = useState('');
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    getHevyKey().then((k) => setHasKey(!!k));
  }, []);
  useEffect(() => {
    setHeight(String(p.heightCm));
    setBirth(String(p.birthYear));
    setRate(String(p.targetRatePctPerWeek).replace('.', ','));
  }, [p.heightCm, p.birthYear, p.targetRatePctPerWeek]);

  const [sheet, setSheet] = useState(state.sheetUrl ?? '');
  const [sheetBusy, setSheetBusy] = useState(false);
  const syncSheet = async () => {
    const url = sheet.trim();
    if (!url) {
      dispatch({ type: 'setSheetUrl', url: null });
      return Alert.alert('Google Sheets', 'Lien supprimé.');
    }
    setSheetBusy(true);
    try {
      const r = await fetchNutritionSheet(url);
      dispatch({ type: 'setSheetUrl', url });
      dispatch({ type: 'sheetSync', days: r.days, at: new Date().toISOString() });
      Alert.alert(
        'Google Sheets',
        `${r.days.length} jour(s) importé(s)${r.skipped ? `, ${r.skipped} ligne(s) ignorée(s)` : ''}.\nColonnes reconnues : ${r.columns.join(', ')}`,
      );
    } catch (e) {
      Alert.alert('Google Sheets', e instanceof Error ? e.message : String(e));
    } finally {
      setSheetBusy(false);
    }
  };

  const [claudeKey, setClaudeKeyInput] = useState('');
  const [hasClaude, setHasClaude] = useState(false);
  useEffect(() => {
    getClaudeKey().then((k) => setHasClaude(!!k));
  }, []);
  const saveClaude = async () => {
    await setClaudeKey(claudeKey);
    setHasClaude(!!claudeKey.trim());
    setClaudeKeyInput('');
    Alert.alert('Claude', claudeKey.trim() ? 'Clé enregistrée de façon sécurisée.' : 'Clé supprimée.');
  };

  const importFile = async () => {
    try {
      const r = await pickNutritionFile();
      if (!r) return;
      dispatch({ type: 'sheetSync', days: r.days, at: new Date().toISOString() });
      Alert.alert('Import nutrition', `${r.days.length} jour(s) importé(s).\nColonnes reconnues : ${r.columns.join(', ')}`);
    } catch (e) {
      Alert.alert('Import impossible', e instanceof Error ? e.message : String(e));
    }
  };

  const update = (patch: Partial<Profile>) => dispatch({ type: 'setProfile', profile: { ...p, ...patch } });

  const saveNumbers = () => {
    const h = num(height);
    const b = num(birth);
    const r = num(rate);
    if (!h || h < 120 || h > 230 || !b || b < 1920 || b > new Date().getFullYear() - 12 || r === undefined || r < 0 || r > 1.5) {
      return Alert.alert('Valeurs invalides', 'Taille 120–230 cm, année de naissance réaliste, rythme 0–1,5 %/sem.');
    }
    update({ heightCm: h, birthYear: b, targetRatePctPerWeek: r });
    Alert.alert('Profil enregistré');
  };

  const saveKey = async () => {
    await setHevyKey(key);
    setHasKey(!!key.trim());
    setKey('');
    Alert.alert('Hevy', key.trim() ? 'Clé enregistrée de façon sécurisée.' : 'Clé supprimée.');
  };

  return (
    <Screen>
      <Title>Réglages</Title>

      <Card title="Objectif">
        <View style={{ gap: 10 }}>
          <Segmented<Goal>
            value={p.goal}
            onChange={(goal) => update({ goal })}
            options={[{ value: 'cut', label: 'Sèche' }, { value: 'maintain', label: 'Maintien' }, { value: 'bulk', label: 'Prise de masse' }]}
          />
          <Field label="Rythme visé (% du poids / semaine)" keyboardType="decimal-pad" value={rate} onChangeText={setRate} />
          <Muted>Conseillé : 0,5–1 % en sèche, 0,25–0,5 % en prise de masse.</Muted>
        </View>
      </Card>

      <Card title="Profil">
        <View style={{ gap: 10 }}>
          <Segmented<Sex>
            value={p.sex}
            onChange={(sex) => update({ sex })}
            options={[{ value: 'male', label: 'Homme' }, { value: 'female', label: 'Femme' }]}
          />
          <Row>
            <Field label="Taille (cm)" keyboardType="number-pad" value={height} onChangeText={setHeight} />
            <Field label="Année de naissance" keyboardType="number-pad" value={birth} onChangeText={setBirth} />
          </Row>
          <Muted>Activité hors musculation (sert seulement tant que la dépense réelle n'est pas mesurée) :</Muted>
          <Segmented<ActivityLevel>
            value={p.activity}
            onChange={(activity) => update({ activity })}
            options={[
              { value: 'sedentary', label: 'Bureau' },
              { value: 'light', label: 'Léger' },
              { value: 'moderate', label: 'Modéré' },
              { value: 'active', label: 'Actif' },
            ]}
          />
          <Button label="Enregistrer" onPress={saveNumbers} />
        </View>
      </Card>

      <Card title="Claude">
        <View style={{ gap: 10 }}>
          <Muted>
            {hasClaude ? 'Clé API enregistrée ✓' : 'Aucune clé.'} Crée une clé sur console.anthropic.com → API Keys et
            ajoute quelques dollars de crédit (Billing). Facturation à l'usage, indépendante de ton abonnement claude.ai.
            Conseil : fixe une limite de dépense mensuelle dans la console.
          </Muted>
          <Field label="Clé API Claude" value={claudeKey} onChangeText={setClaudeKeyInput} autoCapitalize="none" autoCorrect={false} secureTextEntry placeholder="sk-ant-…" />
          <Button label={claudeKey.trim() || !hasClaude ? 'Enregistrer la clé' : 'Supprimer la clé'} onPress={saveClaude} />
          <Button kind="secondary" label="Ouvrir console.anthropic.com" onPress={() => Linking.openURL('https://console.anthropic.com/settings/keys')} />
        </View>
      </Card>

      <Card title="Nutrition — fichier Excel / CSV">
        <View style={{ gap: 10 }}>
          <Muted>
            Importe ton historique depuis un fichier sur le téléphone (Excel .xlsx ou CSV), avec les colonnes Date, Cal,
            Prot, Gluc, Lip. Remplace l'historique importé précédemment.
          </Muted>
          <Button label="Importer un fichier" onPress={importFile} />
        </View>
      </Card>

      <Card title="Nutrition — Google Sheets (synchro auto)">
        <View style={{ gap: 10 }}>
          <Muted>
            Colle le lien de ta feuille. Elle doit contenir des colonnes Date, Calories, Protéines, Glucides, Lipides
            (une ligne par jour ou par repas). Partage : « Tous les utilisateurs disposant du lien » en lecture.
            {state.sheetLastSync ? `\nDernière synchro : ${new Date(state.sheetLastSync).toLocaleString('fr-FR')}` : ''}
          </Muted>
          <Field label="Lien Google Sheets" value={sheet} onChangeText={setSheet} autoCapitalize="none" autoCorrect={false} placeholder="https://docs.google.com/spreadsheets/d/…" />
          <Button label={sheetBusy ? 'Import…' : 'Enregistrer et synchroniser'} disabled={sheetBusy} onPress={syncSheet} />
        </View>
      </Card>

      <Card title="Hevy">
        <View style={{ gap: 10 }}>
          <Muted>
            {hasKey ? 'Clé API enregistrée ✓' : 'Aucune clé.'} L'API Hevy nécessite un abonnement Hevy Pro. Récupère la clé
            sur hevy.com → Settings → Developer.
          </Muted>
          <Field label="Clé API" value={key} onChangeText={setKey} autoCapitalize="none" autoCorrect={false} secureTextEntry placeholder="xxxxxxxx-xxxx-…" />
          <Button label={key.trim() ? 'Enregistrer la clé' : hasKey ? 'Supprimer la clé' : 'Enregistrer la clé'} onPress={saveKey} />
          <Button kind="secondary" label="Ouvrir hevy.com/settings" onPress={() => Linking.openURL('https://hevy.com/settings?developer')} />
        </View>
      </Card>

      <Card title="Données">
        <Button
          kind="danger"
          label="Effacer toutes les données"
          onPress={() =>
            Alert.alert('Tout effacer ?', 'Poids, repas et séances stockés sur ce téléphone seront supprimés.', [
              { text: 'Annuler', style: 'cancel' },
              { text: 'Effacer', style: 'destructive', onPress: () => dispatch({ type: 'reset' }) },
            ])
          }
        />
      </Card>
    </Screen>
  );
}
