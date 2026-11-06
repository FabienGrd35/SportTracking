import { addDays } from '../src/lib/dates.ts';
import type { FoodEntry, Profile, WeightEntry, Workout } from '../src/lib/types.ts';

export const END = '2026-10-31';

export const profile: Profile = {
  sex: 'male', birthYear: 1990, heightCm: 180, activity: 'moderate', goal: 'cut', targetRatePctPerWeek: 0.5,
};

/** Pesées quotidiennes avec une pente donnée (kg/jour) et un bruit déterministe ±0,4 kg. */
export function weights(days: number, start: number, perDay: number): WeightEntry[] {
  return Array.from({ length: days }, (_, i) => ({
    date: addDays(END, i - days + 1),
    weightKg: start + perDay * i + (i % 3 === 0 ? 0.4 : i % 3 === 1 ? -0.4 : 0),
    source: 'renpho' as const,
  }));
}

export function foods(days: number, kcal: number, proteinG = 160, weekendKcal = kcal): FoodEntry[] {
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(END, i - days + 1);
    const dow = new Date(date + 'T12:00:00').getDay();
    const k = [0, 5, 6].includes(dow) ? weekendKcal : kcal;
    const fatG = Math.round((k * 0.28) / 9);
    return { id: String(i), date, label: 'jour', kcal: k, proteinG, fatG, carbsG: Math.round((k - proteinG * 4 - fatG * 9) / 4) };
  });
}

export function workout(date: string, e1rm: number, sets = 18): Workout {
  return {
    id: date, date, title: 'Push', durationMin: 60, volumeKg: sets * 500, workingSets: sets,
    exercises: [
      { name: 'Développé couché', templateId: 'bench', workingSets: sets / 2, volumeKg: 2000, bestE1rmKg: e1rm },
      { name: 'Squat', templateId: 'squat', workingSets: sets / 2, volumeKg: 3000, bestE1rmKg: e1rm * 1.3 },
    ],
  };
}
