import { parseDateColumn, parseNumber, readCsv } from './csv.ts';
import type { DayNutrition } from './types.ts';

/**
 * Lecture d'un historique nutrition tenu dans Google Sheets (export CSV).
 * Colonnes reconnues par leur nom : date, calories, protéines, glucides, lipides.
 * Une ligne par jour ou une ligne par repas : les lignes d'une même date sont additionnées.
 */

const COLS = {
  date: /^(date|jour|day)/i,
  kcal: /(kcal|calor|énergie|energie)/i,
  protein: /prot/i,
  carbs: /(gluc|carb)/i,
  fat: /(lipid|^lip|fat|gras)/i,
};

/** Lien Google Sheets classique → lien d'export CSV. Les autres URL sont gardées telles quelles. */
export function toCsvUrl(url: string): string {
  const u = url.trim();
  // Lien « Publier sur le web » : …/d/e/<id>/pubhtml ou …/pub?…
  const pub = u.match(/^(https:\/\/docs\.google\.com\/spreadsheets\/d\/e\/[\w-]+\/pub)(?:html)?([?#].*)?$/);
  if (pub) {
    const params = new URLSearchParams((pub[2] ?? '').replace(/^[?#]/, '').split('#')[0]);
    params.set('output', 'csv');
    return `${pub[1]}?${params}`;
  }
  const m = u.match(/^https:\/\/docs\.google\.com\/spreadsheets\/d\/([\w-]+)/);
  if (!m) return u;
  const gid = u.match(/[#&?]gid=(\d+)/)?.[1];
  return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv${gid ? `&gid=${gid}` : ''}`;
}

export type SheetImport = { days: DayNutrition[]; skipped: number; columns: string[] };

export function parseNutritionSheet(text: string): SheetImport {
  const { rows } = readCsv(text);
  if (/^\s*<(!doctype|html)/i.test(text)) {
    throw new Error("Google a renvoyé une page web au lieu du CSV : la feuille n'est pas partagée « tous les utilisateurs disposant du lien ».");
  }
  // L'en-tête n'est pas forcément la première ligne (titre, lignes vides…).
  const headerIdx = rows.slice(0, 10).findIndex((r) => r.some((c) => COLS.date.test(c)) && r.some((c) => COLS.kcal.test(c)));
  if (headerIdx < 0) throw new Error('Colonnes « Date » et « Calories » introuvables dans la feuille.');
  const header = rows[headerIdx];
  const col = (re: RegExp) => header.findIndex((h) => re.test(h));
  const i = { date: col(COLS.date), kcal: col(COLS.kcal), protein: col(COLS.protein), carbs: col(COLS.carbs), fat: col(COLS.fat) };

  const body = rows.slice(headerIdx + 1);
  const dates = parseDateColumn(body.map((r) => r[i.date]));
  const map = new Map<string, DayNutrition>();
  let skipped = 0;
  body.forEach((r, k) => {
    if (r.every((c) => !c)) return; // ligne vide
    const date = dates[k];
    const kcal = parseNumber(r[i.kcal]);
    if (!date || kcal === undefined || kcal <= 0) {
      skipped++;
      return;
    }
    const get = (idx: number) => (idx >= 0 ? parseNumber(r[idx]) ?? 0 : 0);
    const d = map.get(date) ?? { date, kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
    d.kcal += kcal;
    d.proteinG += get(i.protein);
    d.carbsG += get(i.carbs);
    d.fatG += get(i.fat);
    map.set(date, d);
  });
  const found = (Object.keys(i) as (keyof typeof i)[]).filter((k) => i[k] >= 0).map((k) => header[i[k]]);
  return { days: [...map.values()].sort((a, b) => a.date.localeCompare(b.date)), skipped, columns: found };
}
