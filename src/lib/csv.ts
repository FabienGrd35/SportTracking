/** Outils CSV partagés (exports Renpho, Google Sheets…). */

export function splitCsvLine(line: string, sep: string): string[] {
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

export function detectSeparator(header: string): string {
  const counts = [',', ';', '\t'].map((s) => [s, splitCsvLine(header, s).length] as const);
  return counts.sort((a, b) => b[1] - a[1])[0][0];
}

/** "2 150,5 kcal" → 2150.5 ; vide → undefined. */
export function parseNumber(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const m = s.replace(/\s/g, '').replace(',', '.').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : undefined;
}

export function readCsv(text: string): { rows: string[][] } {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { rows: [] };
  const sep = detectSeparator(lines[0]);
  return { rows: lines.map((l) => splitCsvLine(l, sep)) };
}

type DateParts = { a: number; b: number; c: number; yearFirst: boolean };

function dateParts(s: string): DateParts | null {
  const m = s.match(/(\d{1,4})[./-](\d{1,2})[./-](\d{1,4})/);
  if (!m) return null;
  return { a: Number(m[1]), b: Number(m[2]), c: Number(m[3]), yearFirst: m[1].length === 4 };
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Convertit une colonne de dates en YYYY-MM-DD (null si illisible).
 * JJ/MM ou MM/JJ ? Si un premier nombre > 12 existe → jour en premier ; si un second
 * nombre > 12 existe → mois en premier ; à défaut, format européen.
 */
export function parseDateColumn(cells: string[]): (string | null)[] {
  const parts = cells.map((c) => dateParts(c ?? ''));
  const dayFirst = parts.some((p) => p && !p.yearFirst && p.a > 12)
    || !parts.some((p) => p && !p.yearFirst && p.b > 12);
  return parts.map((p) => {
    if (!p) return null;
    let y: number, m: number, d: number;
    if (p.yearFirst) [y, m, d] = [p.a, p.b, p.c];
    else if (dayFirst) [d, m, y] = [p.a, p.b, p.c];
    else [m, d, y] = [p.a, p.b, p.c];
    if (y < 100) y += 2000;
    if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990) return null;
    return `${y}-${pad(m)}-${pad(d)}`;
  });
}
