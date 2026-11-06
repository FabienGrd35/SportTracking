import { Platform } from 'react-native';
import {
  getSdkStatus,
  initialize,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import { mapHealthWeights, type HCBodyFatRecord, type HCWeightRecord } from '../lib/healthConnect.ts';
import type { WeightEntry } from '../lib/types.ts';

/**
 * Poids et % de gras depuis Health Connect (Android).
 * Renpho y écrit ses mesures si la synchro est activée dans l'appli Renpho
 * (Moi → Paramètres → Applis tierces / Health Connect).
 */

const PERMISSIONS = [
  { accessType: 'read', recordType: 'Weight' },
  { accessType: 'read', recordType: 'BodyFat' },
] as const;

export const healthConnectSupported = Platform.OS === 'android';

async function ensureReady(): Promise<void> {
  if (!healthConnectSupported) throw new Error('Health Connect est disponible uniquement sur Android.');
  const status = await getSdkStatus();
  if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
    throw new Error("Health Connect n'est pas installé ou doit être mis à jour (Play Store).");
  }
  if (!(await initialize())) throw new Error("Impossible d'initialiser Health Connect.");
}

/** Demande l'autorisation de lecture ; renvoie true si le poids est autorisé. */
export async function connectHealth(): Promise<boolean> {
  await ensureReady();
  const granted = await requestPermission([...PERMISSIONS]);
  return granted.some((p: { recordType: string }) => p.recordType === 'Weight');
}

async function readAll<T>(recordType: 'Weight' | 'BodyFat', startTime: string, endTime: string): Promise<T[]> {
  const out: T[] = [];
  let pageToken: string | undefined;
  do {
    const res = await readRecords(recordType, {
      timeRangeFilter: { operator: 'between', startTime, endTime },
      pageSize: 1000,
      pageToken,
    });
    out.push(...(res.records as unknown as T[]));
    pageToken = res.pageToken || undefined;
  } while (pageToken);
  return out;
}

/**
 * Lit les mesures depuis la dernière synchro (avec 3 jours de marge pour les mesures
 * arrivées en retard), ou les 2 dernières années la première fois.
 */
export async function syncHealth(lastSync: string | null): Promise<{ entries: WeightEntry[]; at: string }> {
  await ensureReady();
  const now = new Date();
  const start = lastSync
    ? new Date(new Date(lastSync).getTime() - 3 * 86_400_000)
    : new Date(now.getTime() - 730 * 86_400_000);
  const [weights, fats] = await Promise.all([
    readAll<HCWeightRecord>('Weight', start.toISOString(), now.toISOString()),
    readAll<HCBodyFatRecord>('BodyFat', start.toISOString(), now.toISOString()).catch(() => []),
  ]);
  return { entries: mapHealthWeights(weights, fats), at: now.toISOString() };
}
