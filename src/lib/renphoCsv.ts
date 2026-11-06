import type { WeightEntry } from './types.ts';

/**
 * Import du CSV exporté par l'appli Renpho (Profil → Exporter les données).
 * Le format varie selon la version et la langue de l'appli : on détecte les colonnes
 * par leur nom et on accepte plusieurs formats de date et décimales à virgule.
 */

function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === sep && !quoted) {
      out.push(cur.trim());
      cur = '';
    } else cur += c;
  }
  out.push(cur.trim());
  return out;
}

function detectSeparator(header: string): string {
  const counts = [',', ';', '\t'].map((s) => [s, splitCsvLine(header, s).length] as const);
  return counts.sort((a, b) => b[1] - a[1])[0][0];
}

function parseNumber(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const m = s.replace(/\s/g, '').replace(',', '.').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : undefined;
}

type DateParts = { a: number; b: number; c: number; yearFirst: boolean };

function dateParts(s: string): DateParts | null {
  const m = s.match(/(\d{1,4})[./-](\d{1,2})[./-](\d{1,4})/);
  if (!m) return null;
  const [a, b, c] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return { a, b, c, yearFirst: m[1].length === 4 };
}

const pad = (n: number) => String(n).padStart(2, '0');

const COLS = {
  date: /date|time|heure|zeit|fecha/i,
  weight: /^(weight|poids|gewicht|peso)/i,
  fat: /(body ?fat|graisse corporelle|masse grasse|körperfett|grasa)/i,
  muscle: /(muscle mass|masse musculaire|muskelmasse)/i,
};

export type RenphoImport = { entries: WeightEntry[]; skipped: number; unit: 'kg' | 'lb' };

export function parseRenphoCsv(text: string): RenphoImport {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error('Fichier vide ou non reconnu.');
  const sep = detectSeparator(lines[0]);
  const header = splitCsvLine(lines[0], sep);
  const find = (re: RegExp) => header.findIndex((h) => re.test(h));
  const iDate = find(COLS.date);
  const iWeight = find(COLS.weight);
  if (iDate < 0 || iWeight < 0) throw new Error('Colonnes date / poids introuvables dans le CSV.');
  const iFat = find(COLS.fat);
  const iMuscle = find(COLS.muscle);
  const isLb = /lb/i.test(header[iWeight]);
  const toKg = (v: number) => (isLb ? v * 0.45359237 : v);

  const rows = lines.slice(1).map((l) => splitCsvLine(l, sep));
  const parts = rows.map((r) => dateParts(r[iDate] ?? ''));
  // Formats non ISO : JJ/MM/AAAA ou MM/JJ/AAAA ? Si un premier nombre > 12 existe → jour en premier ;
  // si un second nombre > 12 existe → mois en premier ; à défaut, format européen.
  const dayFirst = parts.some((p) => p && !p.yearFirst && p.a > 12)
    || !parts.some((p) => p && !p.yearFirst && p.b > 12);

  const entries: WeightEntry[] = [];
  let skipped = 0;
  rows.forEach((r, i) => {
    const p = parts[i];
    const w = parseNumber(r[iWeight]);
    if (!p || w === undefined || w <= 0) {
      skipped++;
      return;
    }
    let y: number, m: number, d: number;
    if (p.yearFirst) [y, m, d] = [p.a, p.b, p.c];
    else if (dayFirst) [d, m, y] = [p.a, p.b, p.c];
    else [m, d, y] = [p.a, p.b, p.c];
    if (y < 100) y += 2000;
    if (m < 1 || m > 12 || d < 1 || d > 31) {
      skipped++;
      return;
    }
    const fat = iFat >= 0 ? parseNumber(r[iFat]) : undefined;
    const muscle = iMuscle >= 0 ? parseNumber(r[iMuscle]) : undefined;
    entries.push({
      date: `${y}-${pad(m)}-${pad(d)}`,
      weightKg: Math.round(toKg(w) * 100) / 100,
      bodyFatPct: fat && fat > 0 ? fat : undefined,
      muscleMassKg: muscle && muscle > 0 ? Math.round(toKg(muscle) * 100) / 100 : undefined,
      source: 'renpho',
    });
  });
  return { entries, skipped, unit: isLb ? 'lb' : 'kg' };
}
