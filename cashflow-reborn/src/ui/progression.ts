import { create } from 'zustand';
import type { GameState } from '@/types';
import type { CoachDecisionEntry } from '@/modules/coach/actionLog';
import { evaluateAchievements } from '@/modules/progression/achievements';
import { activeChallenges } from '@/modules/progression/challenges';
import { scoreRun, type RunScore } from '@/modules/progression/score';
import {
  loadUnlocked, saveUnlocked, loadCompletedChallenges, saveCompletedChallenges,
  recordRun, bestEscape, maybeSaveGhost, type RunRecord,
} from '@/modules/progression/storage';
import { play } from './sound/sound';

interface Toast { uid: number; achievementId: string }
interface ChallengeToast { uid: number; challengeId: string }

interface ProgressionStore {
  unlocked: string[];
  toasts: Toast[];
  /** Challenge ids ever completed — persisted across runs, like `unlocked`. */
  completedChallenges: string[];
  challengeToasts: ChallengeToast[];
  best: RunRecord | null;
  lastScore: RunScore | null;
  recordedFor: number | null; // tick at which we recorded the finished run (dedupe)
  sync: (state: GameState, log: CoachDecisionEntry[]) => void;
  finishRun: (state: GameState, log: CoachDecisionEntry[], won: boolean) => void;
  dismissToast: (uid: number) => void;
  dismissChallengeToast: (uid: number) => void;
  resetForNewRun: () => void;
}

let toastSeq = 0;

export const useProgression = create<ProgressionStore>((set, get) => ({
  unlocked: loadUnlocked(),
  toasts: [],
  completedChallenges: loadCompletedChallenges(),
  challengeToasts: [],
  best: bestEscape(),
  lastScore: null,
  recordedFor: null,

  sync: (state, log) => {
    // Achievements
    const satisfied = evaluateAchievements({ state, log });
    const known = new Set(get().unlocked);
    const fresh = satisfied.filter((id) => !known.has(id));

    // Run challenges — only the currently active rotation can complete.
    const done = new Set(get().completedChallenges);
    const freshChallenges = activeChallenges(state.meta.seed, state.meta.tick)
      .filter((c) => !done.has(c.id) && c.progress(state, log) >= c.target)
      .map((c) => c.id);

    if (fresh.length === 0 && freshChallenges.length === 0) return;

    const patch: Partial<ProgressionStore> = {};
    if (fresh.length > 0) {
      const unlocked = [...get().unlocked, ...fresh];
      saveUnlocked(unlocked);
      patch.unlocked = unlocked;
      patch.toasts = [...get().toasts, ...fresh.map((achievementId) => ({ uid: ++toastSeq, achievementId }))];
    }
    if (freshChallenges.length > 0) {
      const completedChallenges = [...get().completedChallenges, ...freshChallenges];
      saveCompletedChallenges(completedChallenges);
      patch.completedChallenges = completedChallenges;
      patch.challengeToasts = [...get().challengeToasts, ...freshChallenges.map((challengeId) => ({ uid: ++toastSeq, challengeId }))];
    }
    play('unlock');
    set(patch);
  },

  finishRun: (state, log, won) => {
    if (get().recordedFor === state.meta.tick) return;
    const score = scoreRun(state, log);
    const run: RunRecord = {
      seed: state.meta.seed,
      profession: state.player.profession,
      won,
      months: state.meta.tick,
      netWorth: state.statement.netWorth,
      grade: score.grade,
    };
    recordRun(run);
    if (won) {
      maybeSaveGhost({ months: state.meta.tick, points: state.history.map((h) => ({ tick: h.tick, netWorth: h.netWorth })) });
    }
    set({ lastScore: score, best: bestEscape(), recordedFor: state.meta.tick });
  },

  dismissToast: (uid) => set({ toasts: get().toasts.filter((t) => t.uid !== uid) }),

  dismissChallengeToast: (uid) => set({ challengeToasts: get().challengeToasts.filter((t) => t.uid !== uid) }),

  resetForNewRun: () => set({ lastScore: null, recordedFor: null }),
}));
