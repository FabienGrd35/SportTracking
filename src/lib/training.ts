import { addDays, daysBetween, weekStart } from './dates.ts';
import type { ISODate, Workout } from './types.ts';

export type WeekTraining = { week: ISODate; sessions: number; volumeKg: number; workingSets: number };

export function weeklyTraining(workouts: Workout[]): WeekTraining[] {
  const map = new Map<ISODate, WeekTraining>();
  for (const w of workouts) {
    const wk = weekStart(w.date);
    const cur = map.get(wk) ?? { week: wk, sessions: 0, volumeKg: 0, workingSets: 0 };
    cur.sessions++;
    cur.volumeKg += w.volumeKg;
    cur.workingSets += w.workingSets;
    map.set(wk, cur);
  }
  return [...map.values()].sort((a, b) => a.week.localeCompare(b.week));
}

export type LiftTrend = {
  name: string;
  templateId: string;
  sessions: number;
  /** Meilleur e1RM des 4 dernières semaines vs des 4 semaines précédentes. */
  recentE1rm: number;
  previousE1rm: number;
  changePct: number;
};

/**
 * Évolution de la force sur les exercices les plus pratiqués.
 * On compare le meilleur 1RM estimé des 28 derniers jours aux 28 jours précédents.
 */
export function liftTrends(workouts: Workout[], end: ISODate, top = 5): LiftTrend[] {
  const recentStart = addDays(end, -27);
  const prevStart = addDays(end, -55);
  const byLift = new Map<string, { name: string; sessions: number; recent: number; prev: number }>();
  for (const w of workouts) {
    if (w.date < prevStart || w.date > end) continue;
    for (const ex of w.exercises) {
      if (ex.bestE1rmKg <= 0) continue;
      const cur = byLift.get(ex.templateId) ?? { name: ex.name, sessions: 0, recent: 0, prev: 0 };
      cur.sessions++;
      if (w.date >= recentStart) cur.recent = Math.max(cur.recent, ex.bestE1rmKg);
      else cur.prev = Math.max(cur.prev, ex.bestE1rmKg);
      byLift.set(ex.templateId, cur);
    }
  }
  return [...byLift.entries()]
    .filter(([, v]) => v.recent > 0 && v.prev > 0)
    .sort((a, b) => b[1].sessions - a[1].sessions)
    .slice(0, top)
    .map(([templateId, v]) => ({
      name: v.name,
      templateId,
      sessions: v.sessions,
      recentE1rm: v.recent,
      previousE1rm: v.prev,
      changePct: ((v.recent - v.prev) / v.prev) * 100,
    }));
}

/** Volume total (kg) et nombre de séances sur [end - days + 1, end]. */
export function periodTotals(workouts: Workout[], end: ISODate, days: number, offsetDays = 0) {
  const e = addDays(end, -offsetDays);
  const ws = workouts.filter((w) => w.date <= e && daysBetween(w.date, e) < days);
  return {
    sessions: ws.length,
    volumeKg: ws.reduce((s, w) => s + w.volumeKg, 0),
    workingSets: ws.reduce((s, w) => s + w.workingSets, 0),
  };
}
