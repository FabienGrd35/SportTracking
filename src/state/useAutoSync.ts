import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { fetchNutritionSheet } from './sheetSync.ts';
import { healthConnectSupported, syncHealth } from './healthConnect.ts';
import { getHevyKey, syncHevy } from './hevySync.ts';
import { useStore } from './store.tsx';

const MIN_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Synchronise en silence Google Sheets, Health Connect et Hevy à l'ouverture de l'appli
 * et à chaque retour au premier plan (au plus toutes les 15 minutes).
 */
export function useAutoSync() {
  const { state, dispatch, ready } = useStore();
  const last = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!ready) return;
    const run = async () => {
      if (Date.now() - last.current < MIN_INTERVAL_MS) return;
      last.current = Date.now();
      const s = stateRef.current;
      const tasks: Promise<void>[] = [];
      if (s.sheetUrl) {
        tasks.push(fetchNutritionSheet(s.sheetUrl).then((r) => dispatch({ type: 'sheetSync', days: r.days, at: new Date().toISOString() })));
      }
      if (healthConnectSupported && s.healthEnabled) {
        tasks.push(syncHealth(s.healthLastSync).then((r) => dispatch({ type: 'healthSync', ...r })));
      }
      if (await getHevyKey()) {
        tasks.push(syncHevy(s.hevyLastSync).then((r) => dispatch({ type: 'hevySync', ...r })));
      }
      const results = await Promise.allSettled(tasks);
      results.forEach((r) => r.status === 'rejected' && console.warn('[auto-sync]', r.reason));
    };
    run();
    const sub = AppState.addEventListener('change', (st: string) => st === 'active' && run());
    return () => sub.remove();
  }, [ready, dispatch]);
}
