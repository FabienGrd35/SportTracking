import { toISODate } from '../dates.ts';
import type { ExerciseSummary, Workout } from '../types.ts';
import type { HevyWorkout } from './types.ts';

/** 1RM estimé (Epley). Au-delà de 12 reps l'estimation devient peu fiable : on l'ignore. */
export function epley(weightKg: number, reps: number): number {
  if (reps <= 0 || weightKg <= 0 || reps > 12) return 0;
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30);
}

export function normalizeWorkout(w: HevyWorkout): Workout {
  const exercises: ExerciseSummary[] = w.exercises.map((ex) => {
    const working = ex.sets.filter((s) => s.type !== 'warmup');
    let volumeKg = 0;
    let bestE1rmKg = 0;
    for (const s of working) {
      const kg = s.weight_kg ?? 0;
      const reps = s.reps ?? 0;
      volumeKg += kg * reps;
      bestE1rmKg = Math.max(bestE1rmKg, epley(kg, reps));
    }
    return {
      name: ex.title,
      templateId: ex.exercise_template_id,
      workingSets: working.length,
      volumeKg,
      bestE1rmKg,
    };
  });
  const start = new Date(w.start_time);
  const end = new Date(w.end_time);
  return {
    id: w.id,
    date: toISODate(start),
    title: w.title,
    durationMin: Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000)),
    volumeKg: exercises.reduce((s, e) => s + e.volumeKg, 0),
    workingSets: exercises.reduce((s, e) => s + e.workingSets, 0),
    exercises,
  };
}
