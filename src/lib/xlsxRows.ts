/**
 * Convertit les lignes d'un classeur Excel (lues par SheetJS en mode brut) en CSV,
 * pour réutiliser le même lecteur que Google Sheets.
 * Dans les colonnes de date, Excel stocke un numéro de série (jours depuis le 30/12/1899) :
 * on le convertit en AAAA-MM-JJ.
 */

const pad = (n: number) => String(n).padStart(2, '0');

export function excelSerialToISO(serial: number): string {
  const ms = Math.round(serial * 86_400_000) + Date.UTC(1899, 11, 30);
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

const quote = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

export function rowsToCsv(rows: unknown[][]): string {
  const headerIdx = rows.findIndex((r) => r.some((c) => typeof c === 'string' && /^(date|jour|day)/i.test(c.trim())));
  const dateCols = new Set<number>();
  if (headerIdx >= 0) {
    rows[headerIdx].forEach((c, i) => {
      if (typeof c === 'string' && /^(date|jour|day)/i.test(c.trim())) dateCols.add(i);
    });
  }
  return rows
    .map((r, ri) =>
      r
        .map((c, ci) => {
          if (c === null || c === undefined) return '';
          if (c instanceof Date) return `${c.getFullYear()}-${pad(c.getMonth() + 1)}-${pad(c.getDate())}`;
          if (typeof c === 'number' && ri > headerIdx && dateCols.has(ci) && c > 20000 && c < 80000) return excelSerialToISO(c);
          return quote(String(c));
        })
        .join(','),
    )
    .join('\n');
}
