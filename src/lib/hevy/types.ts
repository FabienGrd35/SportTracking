// Sous-ensemble des types de l'API publique Hevy (https://api.hevyapp.com/docs).

export type HevySetType = 'warmup' | 'normal' | 'failure' | 'dropset';

export type HevySet = {
  index: number;
  type: HevySetType;
  weight_kg: number | null;
  reps: number | null;
  distance_meters: number | null;
  duration_seconds: number | null;
  rpe: number | null;
};

export type HevyExercise = {
  index: number;
  title: string;
  notes?: string | null;
  exercise_template_id: string;
  sets: HevySet[];
};

export type HevyWorkout = {
  id: string;
  title: string;
  description?: string | null;
  start_time: string;
  end_time: string;
  updated_at: string;
  created_at: string;
  exercises: HevyExercise[];
};

export type HevyWorkoutsPage = { page: number; page_count: number; workouts: HevyWorkout[] };

export type HevyEvent =
  | { type: 'updated'; workout: HevyWorkout }
  | { type: 'deleted'; id: string; deleted_at: string };

export type HevyEventsPage = { page: number; page_count: number; events: HevyEvent[] };
