import { parseNutritionSheet, toCsvUrl, type SheetImport } from '../lib/nutritionSheet.ts';

/** Télécharge la feuille Google Sheets (export CSV) et en extrait les totaux journaliers. */
export async function fetchNutritionSheet(url: string): Promise<SheetImport> {
  const res = await fetch(toCsvUrl(url), { headers: { accept: 'text/csv' } });
  if (res.status === 401 || res.status === 403 || res.status === 404) {
    throw new Error('Feuille inaccessible : partage-la en « Tous les utilisateurs disposant du lien » (lecteur).');
  }
  if (!res.ok) throw new Error(`Google Sheets a répondu ${res.status}.`);
  return parseNutritionSheet(await res.text());
}
