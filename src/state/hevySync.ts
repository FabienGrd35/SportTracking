import * as SecureStore from 'expo-secure-store';
import { HevyClient } from '../lib/hevy/client.ts';
import { normalizeWorkout } from '../lib/hevy/normalize.ts';
import type { Workout } from '../lib/types.ts';

const KEY = 'hevy-api-key';

export const getHevyKey = () => SecureStore.getItemAsync(KEY);
export const setHevyKey = (v: string) => (v ? SecureStore.setItemAsync(KEY, v.trim()) : SecureStore.deleteItemAsync(KEY));

export type SyncResult = { updated: Workout[]; deletedIds: string[]; at: string; full: boolean };

/**
 * Première synchro : tout l'historique. Ensuite : uniquement les changements
 * depuis la dernière synchro (endpoint /v1/workouts/events).
 */
export async function syncHevy(lastSync: string | null): Promise<SyncResult> {
  const key = await getHevyKey();
  if (!key) throw new Error('Ajoute ta clé API Hevy dans Réglages (hevy.com → Settings → Developer).');
  const client = new HevyClient(key);
  const at = new Date().toISOString();
  if (!lastSync) {
    const all = await client.allWorkouts();
    return { updated: all.map(normalizeWorkout), deletedIds: [], at, full: true };
  }
  const { updated, deletedIds } = await client.changesSince(lastSync);
  return { updated: updated.map(normalizeWorkout), deletedIds, at, full: false };
}
