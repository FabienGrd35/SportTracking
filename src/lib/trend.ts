import { addDays, daysBetween } from './dates.ts';
import type { ISODate, WeightEntry } from './types.ts';

export type TrendPoint = { date: ISODate; raw?: number; trend: number };

/**
 * Une pesée par jour (la plus basse si plusieurs : en général celle du matin à jeun).
 */
export function dailyWeights(entries: WeightEntry[]): WeightEntry[] {
  const byDay = new Map<ISODate, WeightEntry>();
  for (const e of entries) {
    const cur = byDay.get(e.date);
    if (!cur || e.weightKg < cur.weightKg) byDay.set(e.date, e);
  }
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Moyenne mobile exponentielle jour par jour (lissage façon "Hacker's Diet").
 * Les jours sans pesée gardent la tendance de la veille, ce qui évite qu'un trou
 * dans les données ne crée un faux mouvement.
 */
export function weightTrend(entries: WeightEntry[], alpha = 0.1): TrendPoint[] {
  const days = dailyWeights(entries);
  if (days.length === 0) return [];
  const byDay = new Map(days.map((d) => [d.date, d.weightKg]));
  const first = days[0].date;
  const last = days[days.length - 1].date;
  const out: TrendPoint[] = [];
  let trend = days[0].weightKg;
  for (let i = 0, n = daysBetween(first, last); i <= n; i++) {
    const date = addDays(first, i);
    const raw = byDay.get(date);
    if (raw !== undefined) trend = trend + alpha * (raw - trend);
    out.push({ date, raw, trend });
  }
  return out;
}

/** Pente (unité / jour) par moindres carrés. */
export function slope(points: { x: number; y: number }[]): number {
  const n = points.length;
  if (n < 2) return 0;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.x - mx) * (p.y - my);
    den += (p.x - mx) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

/**
 * Variation hebdomadaire (kg / semaine) sur les `windowDays` derniers jours,
 * par régression linéaire sur les pesées réelles (moins de retard que la pente de l'EMA).
 * Renvoie null s'il n'y a pas assez de pesées dans la fenêtre.
 */
export function weeklyRateKg(trend: TrendPoint[], windowDays = 21, minWeighIns = 6): number | null {
  if (trend.length === 0) return null;
  const end = trend[trend.length - 1].date;
  const pts = trend
    .filter((p) => p.raw !== undefined && daysBetween(p.date, end) < windowDays)
    .map((p) => ({ x: -daysBetween(p.date, end), y: p.raw as number }));
  if (pts.length < minWeighIns) return null;
  return slope(pts) * 7;
}
