import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react';
import type { DayNutrition, FoodEntry, Profile, WeightEntry, Workout } from '../lib/types.ts';

export type State = {
  profile: Profile;
  weights: WeightEntry[];
  foods: FoodEntry[];
  workouts: Workout[];
  hevyLastSync: string | null;
  /** Lien de la feuille Google Sheets contenant l'historique nutrition. */
  sheetUrl: string | null;
  sheetLastSync: string | null;
  /** Health Connect (Android) activé par l'utilisateur. */
  healthEnabled: boolean;
  healthLastSync: string | null;
  /** Conversation avec le coach Claude. */
  coachChat: { role: 'user' | 'assistant'; text: string; at: string }[];
  claudeSpentUsd: number;
};

export const defaultProfile: Profile = {
  sex: 'male',
  birthYear: 1990,
  heightCm: 178,
  activity: 'moderate',
  goal: 'maintain',
  targetRatePctPerWeek: 0.5,
};

const initial: State = {
  profile: defaultProfile,
  weights: [],
  foods: [],
  workouts: [],
  hevyLastSync: null,
  sheetUrl: null,
  sheetLastSync: null,
  healthEnabled: false,
  healthLastSync: null,
  coachChat: [],
  claudeSpentUsd: 0,
};

type Action =
  | { type: 'hydrate'; state: State }
  | { type: 'setProfile'; profile: Profile }
  | { type: 'importWeights'; entries: WeightEntry[] }
  | { type: 'removeWeight'; date: string; source: WeightEntry['source'] }
  | { type: 'addFood'; entry: FoodEntry }
  | { type: 'removeFood'; id: string }
  | { type: 'hevySync'; updated: Workout[]; deletedIds: string[]; at: string; full: boolean }
  | { type: 'sheetSync'; days: DayNutrition[]; at: string }
  | { type: 'setSheetUrl'; url: string | null }
  | { type: 'healthSync'; entries: WeightEntry[]; at: string }
  | { type: 'setHealthEnabled'; enabled: boolean }
  | { type: 'coachTurn'; role: 'user' | 'assistant'; text: string; costUsd?: number }
  | { type: 'coachClear' }
  | { type: 'reset' };

const wKey = (w: WeightEntry) => `${w.date}|${w.source}`;

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'hydrate':
      return a.state;
    case 'setProfile':
      return { ...s, profile: a.profile };
    case 'importWeights': {
      // Une mesure par jour et par source : un nouvel import remplace l'ancienne valeur.
      const map = new Map(s.weights.map((w) => [wKey(w), w]));
      for (const e of a.entries) map.set(wKey(e), e);
      return { ...s, weights: [...map.values()].sort((x, y) => x.date.localeCompare(y.date)) };
    }
    case 'removeWeight':
      return { ...s, weights: s.weights.filter((w) => !(w.date === a.date && w.source === a.source)) };
    case 'addFood':
      return { ...s, foods: [...s.foods, a.entry] };
    case 'removeFood':
      return { ...s, foods: s.foods.filter((f) => f.id !== a.id) };
    case 'hevySync': {
      const base = a.full ? [] : s.workouts;
      const map = new Map(base.map((w) => [w.id, w]));
      for (const id of a.deletedIds) map.delete(id);
      for (const w of a.updated) map.set(w.id, w);
      return {
        ...s,
        workouts: [...map.values()].sort((x, y) => x.date.localeCompare(y.date)),
        hevyLastSync: a.at,
      };
    }
    case 'sheetSync': {
      // La feuille est la référence : on remplace intégralement les jours importés précédemment.
      const sheet: FoodEntry[] = a.days.map((d) => ({
        id: `sheet-${d.date}`,
        date: d.date,
        label: 'Historique importé',
        kcal: Math.round(d.kcal),
        proteinG: Math.round(d.proteinG),
        carbsG: Math.round(d.carbsG),
        fatG: Math.round(d.fatG),
        source: 'sheet',
      }));
      return { ...s, foods: [...s.foods.filter((f) => f.source !== 'sheet'), ...sheet], sheetLastSync: a.at };
    }
    case 'setSheetUrl':
      return { ...s, sheetUrl: a.url, sheetLastSync: a.url ? s.sheetLastSync : null };
    case 'healthSync': {
      const next = reducer(s, { type: 'importWeights', entries: a.entries });
      return { ...next, healthLastSync: a.at };
    }
    case 'setHealthEnabled':
      return { ...s, healthEnabled: a.enabled };
    case 'coachTurn':
      return {
        ...s,
        coachChat: [...s.coachChat, { role: a.role, text: a.text, at: new Date().toISOString() }],
        claudeSpentUsd: s.claudeSpentUsd + (a.costUsd ?? 0),
      };
    case 'coachClear':
      return { ...s, coachChat: [] };
    case 'reset':
      return initial;
  }
}

const STORAGE_KEY = 'sporttracking/v1';

type Ctx = { state: State; dispatch: (a: Action) => void; ready: boolean };
const StoreContext = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) dispatch({ type: 'hydrate', state: { ...initial, ...JSON.parse(raw) } });
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (ready) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state, ready]);

  const value = useMemo(() => ({ state, dispatch, ready }), [state, ready]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Ctx {
  const c = useContext(StoreContext);
  if (!c) throw new Error('useStore hors StoreProvider');
  return c;
}
