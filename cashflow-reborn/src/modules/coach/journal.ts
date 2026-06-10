/**
 * Wisdom journal — a localStorage-backed set of lesson ids the player has
 * actually been shown by the coach. Drives the "X/N collected" journal modal.
 *
 * Framework-free on purpose: React components subscribe via
 * `subscribeJournal` + `journalVersion` (useSyncExternalStore-compatible).
 */
import { WISDOM } from './wisdom';

const KEY = 'cashflow-reborn:journal:v1';

let cache: Set<string> | null = null;
let version = 0;
const subs = new Set<() => void>();

function load(): Set<string> {
  if (cache) return cache;
  cache = new Set();
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const id of parsed) if (typeof id === 'string') cache.add(id);
        }
      }
    }
  } catch {
    // Corrupt storage — start fresh rather than crash.
  }
  return cache;
}

function persist(seen: Set<string>): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify([...seen]));
  } catch {
    // Storage full/unavailable — the in-memory set still works for the session.
  }
}

/** Record that a lesson was displayed to the player (idempotent). */
export function recordLesson(id: string): void {
  const seen = load();
  if (seen.has(id)) return;
  seen.add(id);
  persist(seen);
  version++;
  subs.forEach((fn) => fn());
}

/** All lesson ids the player has seen so far. */
export function seenLessons(): string[] {
  return [...load()];
}

/** Progress: how many of the library's lessons have been collected. */
export function journalStats(): { seen: number; total: number } {
  const valid = new Set(WISDOM.map((l) => l.id));
  const seen = seenLessons().filter((id) => valid.has(id)).length;
  return { seen, total: WISDOM.length };
}

/** Subscribe to journal changes (for useSyncExternalStore). */
export function subscribeJournal(fn: () => void): () => void {
  subs.add(fn);
  return () => { subs.delete(fn); };
}

/** Monotonic counter bumped on every new lesson — a cheap snapshot for React. */
export function journalVersion(): number {
  return version;
}
