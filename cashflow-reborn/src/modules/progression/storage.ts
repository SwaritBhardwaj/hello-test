import type { Grade } from './score';

const ACH_KEY = 'cashflow-reborn:achievements';
const RUNS_KEY = 'cashflow-reborn:runs';
const GHOST_KEY = 'cashflow-reborn:ghost';

export interface RunRecord {
  seed: number;
  profession: string;
  won: boolean;
  months: number;
  netWorth: number;
  grade: Grade;
}

/** netWorth indexed by tick — the curve of the fastest winning run, for the ghost overlay. */
export interface GhostCurve {
  months: number;
  points: { tick: number; netWorth: number }[];
}

function read<T>(key: string, fallback: T): T {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode — ignore */
  }
}

export function loadUnlocked(): string[] {
  return read<string[]>(ACH_KEY, []);
}

export function saveUnlocked(ids: string[]): void {
  write(ACH_KEY, ids);
}

export function loadRuns(): RunRecord[] {
  return read<RunRecord[]>(RUNS_KEY, []);
}

export function recordRun(run: RunRecord): RunRecord[] {
  const runs = [...loadRuns(), run].slice(-50);
  write(RUNS_KEY, runs);
  return runs;
}

/** Fastest winning run so far (fewest months). */
export function bestEscape(): RunRecord | null {
  const won = loadRuns().filter((r) => r.won);
  if (!won.length) return null;
  return won.reduce((best, r) => (r.months < best.months ? r : best));
}

export function loadGhost(): GhostCurve | null {
  return read<GhostCurve | null>(GHOST_KEY, null);
}

/** Keep the ghost curve of the fastest winning run. */
export function maybeSaveGhost(curve: GhostCurve): void {
  const existing = loadGhost();
  if (!existing || curve.months < existing.months) write(GHOST_KEY, curve);
}
