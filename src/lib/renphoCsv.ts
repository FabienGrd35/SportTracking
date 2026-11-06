import { parseDateColumn, parseNumber, readCsv } from './csv.ts';
import type { WeightEntry } from './types.ts';

/**
 * Import du CSV exporté par l'appli Renpho (Profil → Exporter les données).
 * Le format varie selon la version et la langue de l'appli : on détecte les colonnes
 * par leur nom et on accepte plusieurs formats de date et décimales à virgule.
 */

const COLS = {
  date: /date|time|heure|zeit|fecha/i,
  weight: /^(weight|poids|gewicht|peso)/i,
  fat: /(body ?fat|graisse corporelle|masse grasse|körperfett|grasa)/i,
  muscle: /(muscle mass|masse musculaire|muskelmasse)/i,
};

export type RenphoImport = { entries: WeightEntry[]; skipped: number; unit: 'kg' | 'lb' };

export function parseRenphoCsv(text: string): RenphoImport {
  const { rows: all } = readCsv(text);
  if (all.length < 2) throw new Error('Fichier vide ou non reconnu.');
  const header = all[0];
  const find = (re: RegExp) => header.findIndex((h) => re.test(h));
  const iDate = find(COLS.date);
  const iWeight = find(COLS.weight);
  if (iDate < 0 || iWeight < 0) throw new Error('Colonnes date / poids introuvables dans le CSV.');
  const iFat = find(COLS.fat);
  const iMuscle = find(COLS.muscle);
  const isLb = /lb/i.test(header[iWeight]);
  const toKg = (v: number) => (isLb ? v * 0.45359237 : v);

  const rows = all.slice(1);
  const dates = parseDateColumn(rows.map((r) => r[iDate]));
  const entries: WeightEntry[] = [];
  let skipped = 0;
  rows.forEach((r, i) => {
    const date = dates[i];
    const w = parseNumber(r[iWeight]);
    if (!date || w === undefined || w <= 0) {
      skipped++;
      return;
    }
    const fat = iFat >= 0 ? parseNumber(r[iFat]) : undefined;
    const muscle = iMuscle >= 0 ? parseNumber(r[iMuscle]) : undefined;
    entries.push({
      date,
      weightKg: Math.round(toKg(w) * 100) / 100,
      bodyFatPct: fat && fat > 0 ? fat : undefined,
      muscleMassKg: muscle && muscle > 0 ? Math.round(toKg(muscle) * 100) / 100 : undefined,
      source: 'renpho',
    });
  });
  return { entries, skipped, unit: isLb ? 'lb' : 'kg' };
}
