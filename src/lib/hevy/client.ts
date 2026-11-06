import type { HevyEventsPage, HevyWorkout, HevyWorkoutsPage } from './types.ts';

const BASE = 'https://api.hevyapp.com';
const PAGE_SIZE = 10; // maximum autorisé par l'API

export class HevyError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

type Fetch = typeof fetch;

export class HevyClient {
  private apiKey: string;
  private fetchImpl: Fetch;

  constructor(apiKey: string, fetchImpl: Fetch = fetch) {
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
  }

  private async get<T>(path: string, params: Record<string, string | number>): Promise<T> {
    const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
    const res = await this.fetchImpl(`${BASE}${path}?${qs}`, {
      headers: { 'api-key': this.apiKey, accept: 'application/json' },
    });
    if (res.status === 401 || res.status === 403) {
      throw new HevyError('Clé API Hevy refusée (abonnement Hevy Pro requis).', res.status);
    }
    if (res.status === 404) return { page: 1, page_count: 0, workouts: [], events: [] } as T;
    if (!res.ok) throw new HevyError(`Erreur Hevy ${res.status}`, res.status);
    return (await res.json()) as T;
  }

  /** Toutes les séances, en limitant le nombre de pages (≈ 10 séances / page). */
  async allWorkouts(maxPages = 50): Promise<HevyWorkout[]> {
    const out: HevyWorkout[] = [];
    for (let page = 1; page <= maxPages; page++) {
      const r = await this.get<HevyWorkoutsPage>('/v1/workouts', { page, pageSize: PAGE_SIZE });
      out.push(...r.workouts);
      if (page >= r.page_count) break;
    }
    return out;
  }

  /** Synchro incrémentale : séances créées/modifiées/supprimées depuis `since` (ISO 8601). */
  async changesSince(since: string, maxPages = 50): Promise<{ updated: HevyWorkout[]; deletedIds: string[] }> {
    const updated: HevyWorkout[] = [];
    const deletedIds: string[] = [];
    for (let page = 1; page <= maxPages; page++) {
      const r = await this.get<HevyEventsPage>('/v1/workouts/events', { page, pageSize: PAGE_SIZE, since });
      for (const e of r.events) {
        if (e.type === 'updated') updated.push(e.workout);
        else deletedIds.push(e.id);
      }
      if (page >= r.page_count) break;
    }
    return { updated, deletedIds };
  }
}
