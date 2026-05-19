import { create } from 'zustand';
import type { GameState, TickInput, DecisionAction } from '@/types';
import { tick, buildInitialState, type SetupOptions } from '@/engine';

interface GameStore {
  state: GameState | null;
  notifications: string[];
  initGame: (opts: SetupOptions) => void;
  step: (actions?: DecisionAction[]) => void;
  fastForward: (months: number) => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  state: null,
  notifications: [],
  initGame: (opts) => {
    set({ state: buildInitialState(opts), notifications: [`Game started for ${opts.playerName}`] });
  },
  step: (actions = []) => {
    const cur = get().state;
    if (!cur) return;
    const input: TickInput = { actions };
    const result = tick(cur, input);
    set({
      state: result.state,
      notifications: [...result.notifications].slice(-20),
    });
  },
  fastForward: (months) => {
    const cur = get().state;
    if (!cur) return;
    let s = cur;
    let lastNotes: string[] = [];
    for (let i = 0; i < months; i++) {
      const r = tick(s, { actions: [] });
      s = r.state;
      lastNotes = r.notifications;
    }
    set({ state: s, notifications: lastNotes });
  },
  reset: () => set({ state: null, notifications: [] }),
}));
