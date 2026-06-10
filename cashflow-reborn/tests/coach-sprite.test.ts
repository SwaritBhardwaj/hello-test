import { describe, it, expect, beforeEach } from 'vitest';

// Minimal localStorage shim for the node test environment. All app modules
// guard `typeof localStorage` at import time, and the journal reads it lazily,
// so installing the shim in module scope (after import hoisting) is safe.
const backing = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => backing.get(k) ?? null,
  setItem: (k: string, v: string) => void backing.set(k, String(v)),
  removeItem: (k: string) => void backing.delete(k),
  clear: () => backing.clear(),
  key: (i: number) => [...backing.keys()][i] ?? null,
  get length() { return backing.size; },
};

import { WISDOM } from '@/modules/coach/wisdom';
import { recordLesson, seenLessons, journalStats, subscribeJournal, journalVersion } from '@/modules/coach/journal';
import { verdictPoseFor } from '@/ui/components/CoachSprite';

describe('coach journal', () => {
  it('records lessons idempotently and persists them', () => {
    const before = seenLessons().length;
    recordLesson('munger-leverage');
    recordLesson('munger-leverage');
    recordLesson('ramsey-borrower');
    const seen = seenLessons();
    expect(seen.length).toBe(before + 2);
    expect(seen).toContain('munger-leverage');
    expect(seen).toContain('ramsey-borrower');
    // persisted to localStorage under the versioned key
    const raw = backing.get('cashflow-reborn:journal:v1');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)).toContain('munger-leverage');
  });

  it('reports stats against the full library', () => {
    const { seen, total } = journalStats();
    expect(total).toBe(WISDOM.length);
    expect(seen).toBeGreaterThanOrEqual(2);
    expect(seen).toBeLessThanOrEqual(total);
    // unknown ids never count toward `seen`
    recordLesson('not-a-real-lesson');
    expect(journalStats().seen).toBe(seen);
  });

  it('notifies subscribers and bumps the version on new lessons only', () => {
    let calls = 0;
    const unsub = subscribeJournal(() => calls++);
    const v0 = journalVersion();
    recordLesson('kiyosaki-cashflow');
    expect(calls).toBe(1);
    expect(journalVersion()).toBe(v0 + 1);
    recordLesson('kiyosaki-cashflow'); // duplicate — no notification
    expect(calls).toBe(1);
    unsub();
  });
});

describe('verdict pose classification', () => {
  beforeEach(() => void 0);

  it('celebrates "Best" warnings and facepalms "WORST" ones', () => {
    expect(verdictPoseFor({ category: 'unseen_expense_cash', borrowed: false }, 'Best option. Zero interest.')).toBe('celebrate');
    expect(verdictPoseFor({ category: 'unseen_expense_cc', borrowed: false }, 'WORST option. 36% p.a.')).toBe('facepalm');
    expect(verdictPoseFor({ category: 'unseen_expense_loan', borrowed: false }, 'Survivable if you must borrow.')).toBe('worried');
  });

  it('forces facepalm when a doodad was bought on borrowed money', () => {
    expect(verdictPoseFor({ category: 'doodad_oneshot', borrowed: true }, 'Best option ever')).toBe('facepalm');
    expect(verdictPoseFor({ category: 'doodad_subscription', borrowed: true }, null)).toBe('facepalm');
  });

  it('praises resists and stays quiet otherwise', () => {
    expect(verdictPoseFor({ category: 'resist', borrowed: false }, null)).toBe('happy');
    expect(verdictPoseFor({ category: 'invest_index', borrowed: false }, null)).toBeNull();
  });
});
