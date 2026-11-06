import { useMemo } from 'react';
import { today } from '../lib/dates.ts';
import { analyze } from '../lib/insights.ts';
import { useStore } from './store.tsx';

export function useAnalysis() {
  const { state } = useStore();
  const end = today();
  return useMemo(
    () => analyze(state.profile, state.weights, state.foods, state.workouts, end),
    [state.profile, state.weights, state.foods, state.workouts, end],
  );
}
