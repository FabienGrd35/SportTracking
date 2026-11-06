import { addDays, daysBetween } from './dates.ts';
import { dailyWeights, slope } from './trend.ts';
import type { ActivityLevel, DayNutrition, FoodEntry, Goal, ISODate, Profile, WeightEntry } from './types.ts';

/** Énergie approximative stockée dans 1 kg de tissu corporel perdu/gagné (mélange gras + maigre). */
export const KCAL_PER_KG = 7700;

const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export function ageFrom(birthYear: number, ref = new Date()): number {
  return ref.getFullYear() - birthYear;
}

/** Métabolisme de base, formule de Mifflin-St Jeor. */
export function bmr(profile: Profile, weightKg: number, ref = new Date()): number {
  const base = 10 * weightKg + 6.25 * profile.heightCm - 5 * ageFrom(profile.birthYear, ref);
  return base + (profile.sex === 'male' ? 5 : -161);
}

/** Dépense théorique (formule), utilisée tant qu'on n'a pas assez de données réelles. */
export function formulaTdee(profile: Profile, weightKg: number, ref = new Date()): number {
  return bmr(profile, weightKg, ref) * ACTIVITY_FACTOR[profile.activity];
}

/**
 * Totaux journaliers. Si une journée est fournie par Google Sheets, c'est elle qui fait foi :
 * les saisies manuelles du même jour sont ignorées pour éviter de compter deux fois.
 */
export function aggregateDays(foods: FoodEntry[]): DayNutrition[] {
  const sheetDays = new Set(foods.filter((f) => f.source === 'sheet').map((f) => f.date));
  const map = new Map<ISODate, DayNutrition>();
  for (const f of foods) {
    if (f.source !== 'sheet' && sheetDays.has(f.date)) continue;
    const d = map.get(f.date) ?? { date: f.date, kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
    d.kcal += f.kcal;
    d.proteinG += f.proteinG;
    d.carbsG += f.carbsG;
    d.fatG += f.fatG;
    map.set(f.date, d);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export type AdaptiveTdee = {
  tdee: number;
  avgIntake: number;
  weeklyChangeKg: number;
  loggedDays: number;
  windowDays: number;
};

/**
 * Dépense réelle estimée à partir des données : apport moyen − (variation de poids × 7700 / jours).
 * Si tu manges 2 200 kcal/j et perds 0,5 kg/sem, ta dépense réelle ≈ 2 200 + 0,5×7700/7 ≈ 2 750 kcal.
 * Nécessite des journées alimentaires complètes ; renvoie null sinon.
 */
export function adaptiveTdee(
  days: DayNutrition[],
  weights: WeightEntry[],
  end: ISODate,
  windowDays = 28,
): AdaptiveTdee | null {
  const start = addDays(end, -(windowDays - 1));
  const inWin = (d: ISODate) => d >= start && d <= end;
  const logged = days.filter((d) => inWin(d.date) && d.kcal > 0);
  const w = dailyWeights(weights).filter((x) => inWin(x.date));
  if (logged.length < windowDays * 0.6 || w.length < 8) return null;
  const avgIntake = logged.reduce((s, d) => s + d.kcal, 0) / logged.length;
  const perDay = slope(w.map((x) => ({ x: daysBetween(start, x.date), y: x.weightKg })));
  const tdee = avgIntake - perDay * KCAL_PER_KG;
  return { tdee, avgIntake, weeklyChangeKg: perDay * 7, loggedDays: logged.length, windowDays };
}

export type MacroTargets = { kcal: number; proteinG: number; fatG: number; carbsG: number };

/**
 * Objectifs journaliers.
 * - Calories : dépense ± le rythme visé (kg/sem × 7700 / 7).
 * - Protéines : 2,0 g/kg en sèche (préserver le muscle), 1,8 g/kg sinon.
 * - Lipides : 0,8 g/kg (minimum hormonal raisonnable), au moins 20 % des calories.
 * - Glucides : le reste — c'est le carburant de l'entraînement.
 */
export function macroTargets(profile: Profile, weightKg: number, tdee: number): MacroTargets {
  const rateKg = (profile.targetRatePctPerWeek / 100) * weightKg;
  const sign: Record<Goal, number> = { cut: -1, maintain: 0, bulk: 1 };
  const kcal = Math.round(tdee + (sign[profile.goal] * rateKg * KCAL_PER_KG) / 7);
  const proteinG = Math.round(weightKg * (profile.goal === 'cut' ? 2.0 : 1.8));
  const fatG = Math.round(Math.max(weightKg * 0.8, (kcal * 0.2) / 9));
  const carbsG = Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4));
  return { kcal, proteinG, fatG, carbsG };
}
