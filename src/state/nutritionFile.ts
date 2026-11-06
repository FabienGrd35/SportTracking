import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as XLSX from 'xlsx';
import { parseNutritionSheet, type SheetImport } from '../lib/nutritionSheet.ts';
import { rowsToCsv } from '../lib/xlsxRows.ts';

/** Choisit un fichier Excel (.xlsx) ou CSV sur le téléphone et en extrait l'historique nutrition. */
export async function pickNutritionFile(): Promise<SheetImport | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'text/comma-separated-values',
      'text/plain',
    ],
    copyToCacheDirectory: true,
  });
  if (res.canceled) return null;
  const asset = res.assets[0];
  const file = new File(asset.uri);
  if (/\.csv$/i.test(asset.name) || asset.mimeType?.includes('csv') || asset.mimeType === 'text/plain') {
    return parseNutritionSheet(await file.text());
  }
  const wb = XLSX.read(await file.base64(), { type: 'base64' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, blankrows: false });
  return parseNutritionSheet(rowsToCsv(rows));
}
