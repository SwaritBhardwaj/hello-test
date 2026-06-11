import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, Check, Trophy } from 'lucide-react';
import { useGameStore } from '../store';
import { useProgression } from '../progression';
import { ACHIEVEMENTS } from '@/modules/progression/achievements';
import { activeChallenges, challengeById, type Challenge } from '@/modules/progression/challenges';
import { RANKS, rankFor } from '@/modules/progression/titles';
import { bestEscape, loadGhost } from '@/modules/progression/storage';
import { PROFESSIONS } from '@/modules/player/career';
import type { ProfessionId } from '@/types';
import { formatINR } from '@/utils/money';
import { ModalShell } from './primitives';
import { AchievementIcon } from './AchievementToasts';

// ============================================================
// Trophies & Challenges — rank ladder, achievement cabinet,
// the active challenge rotation and the best-run record.
// ============================================================
export function TrophiesPanel({ onClose }: { onClose: () => void }) {
  const state = useGameStore((s) => s.state)!;
  const log = useGameStore((s) => s.decisionLog);
  const unlocked = useProgression((s) => s.unlocked);
  const completed = useProgression((s) => s.completedChallenges);
  const { rank, next, progress } = rankFor(state);
  const best = useMemo(() => bestEscape(), []);
  const ghost = useMemo(() => loadGhost(), []);
  const active = useMemo(
    () => activeChallenges(state.meta.seed, state.meta.tick),
    [state.meta.seed, state.meta.tick],
  );
  const unlockedSet = useMemo(() => new Set(unlocked), [unlocked]);
  const completedSet = useMemo(() => new Set(completed), [completed]);

  return (
    <ModalShell onClose={onClose} labelledBy="trophies-title">
      <motion.div
        initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="paper w-full sm:max-w-lg max-h-[88dvh] sm:rounded-game rounded-t-game shadow-card ring-1 ring-card-edge overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="bg-wood-900 text-card px-4 sm:px-5 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Trophy size={24} className="text-brass-500 shrink-0" />
            <div className="min-w-0">
              <div id="trophies-title" className="font-display text-lg leading-tight truncate">
                Trophies & Challenges
              </div>
              <div className="text-2xs text-card/70">
                {unlocked.length}/{ACHIEVEMENTS.length} achievements · {completed.length} challenges done
              </div>
            </div>
          </div>
          <button onClick={onClose} className="grid place-items-center hover:bg-felt-700 w-9 h-9 rounded-lg shrink-0" aria-label="Close trophies">
            <X size={22} />
          </button>
        </div>

        <div className="overflow-y-auto px-4 sm:px-5 py-3 space-y-5">
          {/* a. Rank ladder */}
          <section>
            <SectionTitle>Rank ladder</SectionTitle>
            <div className="space-y-1.5">
              {RANKS.map((r) => {
                const reached = r.index < rank.index;
                const current = r.index === rank.index;
                return (
                  <div
                    key={r.index}
                    className={`rounded-xl px-3 py-2 ring-1 flex items-center gap-2.5 ${current ? 'ring-brass/60 bg-brass-100/60' : 'ring-card-edge bg-card'} ${r.index > rank.index ? 'opacity-60' : ''}`}
                  >
                    <span className={`inline-flex shrink-0 items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${reached || current ? 'bg-brass-500 text-wood-900' : 'bg-card-edge text-ink-faint'}`}>
                      {reached ? <Check size={14} /> : r.index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm font-display leading-tight ${current ? 'text-ink font-semibold' : 'text-ink-soft'}`}>
                        {r.label}
                        {current && <span className="ml-2 text-2xs uppercase tracking-wider text-brass-600 font-sans font-bold">You are here</span>}
                      </div>
                      {current && next && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="h-1.5 flex-1 rounded-full bg-card-edge overflow-hidden">
                            <div className="h-full rounded-full bg-brass-500 transition-all duration-500" style={{ width: `${Math.max(2, Math.round(progress * 100))}%` }} />
                          </div>
                          <span className="text-2xs text-ink-soft tnum shrink-0">{Math.round(progress * 100)}% to {next.label}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* b. Achievements */}
          <section>
            <SectionTitle>Achievements — {unlocked.length}/{ACHIEVEMENTS.length}</SectionTitle>
            <div className="grid grid-cols-2 gap-1.5">
              {ACHIEVEMENTS.map((a) => {
                const got = unlockedSet.has(a.id);
                return got ? (
                  <div key={a.id} className="rounded-xl ring-1 ring-brass/40 bg-card px-2.5 py-2 flex items-start gap-2">
                    <div className="shrink-0 mt-0.5"><AchievementIcon icon={a.icon} size={22} /></div>
                    <div className="min-w-0">
                      <div className="text-sm font-display text-ink leading-tight">{a.label}</div>
                      <div className="text-2xs text-ink-soft leading-snug mt-0.5">{a.description}</div>
                    </div>
                  </div>
                ) : (
                  <div key={a.id} className="rounded-xl ring-1 ring-card-edge bg-card-edge/40 px-2.5 py-2 flex items-start gap-2 opacity-70">
                    <Lock size={16} className="text-ink-faint shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="text-sm font-display text-ink-soft leading-tight">{a.label}</div>
                      <div className="text-2xs text-ink-faint leading-snug mt-0.5">{a.description}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* c. Active challenges */}
          <section>
            <SectionTitle>This year's challenges</SectionTitle>
            <div className="space-y-1.5">
              {active.map((c) => (
                <ChallengeRow
                  key={c.id}
                  challenge={c}
                  value={c.progress(state, log)}
                  done={completedSet.has(c.id)}
                />
              ))}
            </div>
            <div className="mt-1.5 text-2xs text-ink-faint">A fresh set rotates in every 12 months.</div>
          </section>

          {/* d. Best run */}
          <section>
            <SectionTitle>Best run</SectionTitle>
            {best ? (
              <div className="rounded-xl ring-1 ring-brass/40 bg-card px-3 py-2.5 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-ink-soft">Escaped the rat race in</span>
                  <span className="font-semibold text-income-ink tnum">{Math.floor(best.months / 12)}y {best.months % 12}m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-soft">As</span>
                  <span className="font-semibold text-ink">{PROFESSIONS[best.profession as ProfessionId]?.label ?? best.profession}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-soft">Net worth · grade</span>
                  <span className="font-semibold text-ink tnum">{formatINR(best.netWorth, { compact: true })} · {best.grade}</span>
                </div>
                {ghost && (
                  <div className="flex justify-between border-t border-card-edge pt-1 mt-1">
                    <span className="text-ink-soft">Ghost on the board</span>
                    <span className="font-semibold text-ink tnum">{ghost.points.length} months tracked</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl ring-1 ring-card-edge bg-card-edge/40 px-3 py-2.5 text-sm text-ink-soft">
                No winning run yet — escape the rat race to set a record.
              </div>
            )}
          </section>
        </div>
      </motion.div>
    </ModalShell>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-2xs uppercase tracking-widest font-display text-brass-600 mb-1.5">{children}</h3>;
}

function ChallengeRow({ challenge, value, done }: { challenge: Challenge; value: number; done: boolean }) {
  const pct = Math.max(0, Math.min(100, Math.round((value / challenge.target) * 100)));
  return (
    <div className={`rounded-xl ring-1 px-3 py-2 ${done ? 'ring-income/50 bg-income-soft/40' : 'ring-card-edge bg-card'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-display text-ink leading-tight flex items-center gap-1.5 min-w-0">
          {done && <Check size={14} className="text-income-ink shrink-0" />}
          <span className="truncate">{challenge.label}</span>
        </div>
        <span className="text-2xs text-ink-soft tnum shrink-0">{done ? 'Done' : `${pct}%`}</span>
      </div>
      <div className="text-2xs text-ink-soft leading-snug mt-0.5">{challenge.description}</div>
      <div className="mt-1.5 h-1.5 rounded-full bg-card-edge overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${done ? 'bg-income' : 'bg-brass-500'}`} style={{ width: `${done ? 100 : Math.max(2, pct)}%` }} />
      </div>
    </div>
  );
}

// ============================================================
// Challenge toasts — self-contained twin of AchievementToasts.
// Must be mounted once near the board (see INTEGRATION_NOTES_E.md);
// it renders nothing while the queue is empty.
// ============================================================
export function ChallengeToasts() {
  const toasts = useProgression((s) => s.challengeToasts);
  const dismiss = useProgression((s) => s.dismissChallengeToast);
  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[65] w-[min(92vw,22rem)] space-y-2 pointer-events-none">
      <AnimatePresence>
        {toasts.slice(0, 2).map((t) => {
          const c = challengeById(t.challengeId);
          if (!c) return null;
          return (
            <motion.div
              key={t.uid}
              initial={{ opacity: 0, y: -24, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              onAnimationComplete={() => setTimeout(() => dismiss(t.uid), 3400)}
              className="pointer-events-auto paper rounded-game shadow-card ring-2 ring-income/60 px-3 py-2 flex items-center gap-3"
            >
              <div className="shrink-0 animate-coin-pop"><Trophy size={26} className="text-brass-600" /></div>
              <div className="min-w-0">
                <div className="text-2xs uppercase tracking-widest text-income-ink font-display">Challenge complete</div>
                <div className="font-display text-ink leading-tight">{c.label}</div>
                <div className="text-2xs text-ink-soft truncate">{c.description}</div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
