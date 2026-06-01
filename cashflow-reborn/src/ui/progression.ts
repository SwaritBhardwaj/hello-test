import { create } from 'zustand';
import type { GameState } from '@/types';
import type { CoachDecisionEntry } from '@/modules/coach/actionLog';
import { evaluateAchievements } from '@/modules/progression/achievements';
import { scoreRun, type RunScore } from '@/modules/progression/score';
import { loadUnlocked, saveUnlocked, recordRun, bestEscape, maybeSaveGhost, type RunRecord } from '@/modules/progression/storage';
import { play } from './sound/sound';

interface Toast { uid: number; achievementId: string }

interface ProgressionStore {
  unlocked: string[];
  toasts: Toast[];
  best: RunRecord | null;
  lastScore: RunScore | null;
  recordedFor: number | null; // tick at which we recorded the finished run (dedupe)
  sync: (state: GameState, log: CoachDecisionEntry[]) => void;
  finishRun: (state: GameState, log: CoachDecisionEntry[], won: boolean) => void;
  dismissToast: (uid: number) => void;
  resetForNewRun: () => void;
}

let toastSeq = 0;

export const useProgression = create<ProgressionStore>((set, get) => ({
  unlocked: loadUnlocked(),
  toasts: [],
  best: bestEscape(),
  lastScore: null,
  recordedFor: null,

  sync: (state, log) => {
    const satisfied = evaluateAchievements({ state, log });
    const known = new Set(get().unlocked);
    const fresh = satisfied.filter((id) => !known.has(id));
    if (fresh.length === 0) return;
    const unlocked = [...get().unlocked, ...fresh];
    saveUnlocked(unlocked);
    play('unlock');
    set({
      unlocked,
      toasts: [...get().toasts, ...fresh.map((achievementId) => ({ uid: ++toastSeq, achievementId }))],
    });
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

  resetForNewRun: () => set({ lastScore: null, recordedFor: null }),
}));
