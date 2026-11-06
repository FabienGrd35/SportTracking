import { toISODate } from './dates.ts';
import type { WeightEntry } from './types.ts';

/** Formes minimales des enregistrements Health Connect (react-native-health-connect). */
export type HCWeightRecord = { time: string; weight: { inKilograms: number } };
export type HCBodyFatRecord = { time: string; percentage: number | { value: number } };

/**
 * Une entrée par jour : la pesée la plus basse (en général celle du matin à jeun),
 * avec le % de gras mesuré le même jour s'il existe.
 */
export function mapHealthWeights(weights: HCWeightRecord[], fats: HCBodyFatRecord[]): WeightEntry[] {
  const fatByDay = new Map<string, number>();
  for (const f of fats) {
    const v = typeof f.percentage === 'number' ? f.percentage : f.percentage?.value;
    if (v && v > 0) fatByDay.set(toISODate(new Date(f.time)), v);
  }
  const byDay = new Map<string, WeightEntry>();
  for (const w of weights) {
    const kg = w.weight?.inKilograms;
    if (!kg || kg <= 0) continue;
    const date = toISODate(new Date(w.time));
    const cur = byDay.get(date);
    if (!cur || kg < cur.weightKg) {
      byDay.set(date, { date, weightKg: Math.round(kg * 100) / 100, bodyFatPct: fatByDay.get(date), source: 'health' });
    }
  }
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}
