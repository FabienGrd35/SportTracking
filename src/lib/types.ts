/** Date locale au format YYYY-MM-DD. */
export type ISODate = string;

export type WeightEntry = {
  date: ISODate;
  weightKg: number;
  bodyFatPct?: number;
  muscleMassKg?: number;
  source: 'renpho' | 'manual';
};

export type FoodEntry = {
  id: string;
  date: ISODate;
  label: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type ExerciseSummary = {
  name: string;
  templateId: string;
  workingSets: number;
  volumeKg: number;
  /** Meilleur 1RM estimé (Epley) de la séance, en kg. */
  bestE1rmKg: number;
};

export type Workout = {
  id: string;
  date: ISODate;
  title: string;
  durationMin: number;
  volumeKg: number;
  workingSets: number;
  exercises: ExerciseSummary[];
};

export type Sex = 'male' | 'female';
export type Goal = 'cut' | 'maintain' | 'bulk';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export type Profile = {
  sex: Sex;
  birthYear: number;
  heightCm: number;
  activity: ActivityLevel;
  goal: Goal;
  /** Rythme visé en % du poids de corps par semaine (positif = perte en sèche, prise en bulk). */
  targetRatePctPerWeek: number;
};

export type DayNutrition = {
  date: ISODate;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type InsightLevel = 'good' | 'info' | 'warn';

export type Insight = {
  id: string;
  level: InsightLevel;
  title: string;
  /** Explication en langage clair de ce qui se passe et pourquoi. */
  body: string;
};
