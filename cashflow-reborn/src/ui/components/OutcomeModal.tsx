import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useGameStore, BANKRUPTCY_GRACE_MONTHS } from '../store';
import { useT } from '../lang';
import { formatINR } from '@/utils/money';
import { play } from '../sound/sound';
import { useProgression } from '../progression';
import type { RunScore } from '@/modules/progression/score';
import { bestEscape } from '@/modules/progression/storage';
import { ModalShell, PrimaryButton } from './primitives';
import { ShareResult } from './ShareCard';
import { CoachMascot } from '../art/Coach';
import { COACH_FLAGS } from '@/data/coachFlags';

// ============================================================
// Outcome modal
// ============================================================
export function OutcomeModal({ status }: { status: 'won' | 'lost' }) {
  const { t } = useT();
  const dismiss = useGameStore((s) => s.dismissOutcome);
  const reset = useGameStore((s) => s.reset);
  const resetProgress = useProgression((s) => s.resetForNewRun);
  const score = useProgression((s) => s.lastScore);
  const unlocked = useProgression((s) => s.unlocked);
  const state = useGameStore((s) => s.state)!;
  const years = Math.floor(state.meta.tick / 12);
  const months = state.meta.tick % 12;
  const won = status === 'won';
  const best = useMemo(() => bestEscape(), [score]);
  const isNewBest = won && best != null && best.months >= state.meta.tick;

  function newRun() { play('click'); resetProgress(); reset(); }

  return (
    <ModalShell labelledBy="outcome-title" center>
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 240, damping: 22 }}
        className="paper w-full max-w-md rounded-game shadow-card ring-4 ring-brass/30 overflow-hidden max-h-[92dvh] flex flex-col"
      >
        <div className="text-card px-6 py-5 text-center shrink-0" style={{ background: won ? 'linear-gradient(135deg, oklch(0.74 0.13 80), oklch(0.62 0.12 78))' : 'linear-gradient(135deg, oklch(0.45 0.16 26), oklch(0.32 0.12 24))' }}>
          {COACH_FLAGS.outcomePresence ? (
            /* The coach shares the moment — cheering your escape, mourning the bust */
            <motion.div
              initial={{ scale: 0.6, rotate: -8, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ delay: 0.25, type: 'spring', stiffness: 280, damping: 16 }}
              className="flex justify-center mb-1"
            >
              <CoachMascot mood={won ? 'celebrate' : 'facepalm'} size={56} />
            </motion.div>
          ) : (
            <div className="text-5xl mb-1">{won ? '★' : '✖'}</div>
          )}
          <div id="outcome-title" className="font-display text-2xl">{won ? t('outcome.won') : t('outcome.lost')}</div>
          <div className="text-sm opacity-95 mt-1">
            {won ? t('outcome.wonSub', { name: state.player.name, y: years, m: months }) : t('outcome.lostSub', { name: state.player.name, n: BANKRUPTCY_GRACE_MONTHS })}
          </div>
        </div>
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          {score && <Scorecard score={score} unlockedCount={unlocked.length} />}
          <div className="rounded-lg bg-card-edge/50 p-3 space-y-1 text-sm tnum">
            <ResultRow label={t('hud.netWorth')} value={formatINR(state.statement.netWorth)} tone={state.statement.netWorth >= 0 ? 'income' : 'expense'} />
            {won && <ResultRow label={t('outcome.passiveIncome')} value={`${formatINR(state.statement.passiveIncome)}/mo`} tone="income" />}
            <ResultRow label={t('outcome.survived')} value={`${years}y ${months}m`} />
            {best && <ResultRow label={isNewBest ? t('outcome.newBest') : t('outcome.yourBest')} value={`${Math.floor(best.months / 12)}y ${best.months % 12}m`} tone={isNewBest ? 'income' : undefined} />}
          </div>
          <div className="space-y-2">
            <ShareResult
              data={{
                won,
                playerName: state.player.name,
                profession: state.player.profession,
                netWorth: state.statement.netWorth,
                months: state.meta.tick,
                grade: score?.grade ?? 'C',
              }}
            />
            <PrimaryButton onClick={newRun} className="w-full">{t('outcome.newRun')}</PrimaryButton>
            <button onClick={dismiss} className="btn-3d w-full bg-card text-ink px-4 py-2.5 text-sm">{won ? t('outcome.keepPlaying') : t('outcome.viewWreckage')}</button>
          </div>
        </div>
      </motion.div>
    </ModalShell>
  );
}

export function Scorecard({ score, unlockedCount }: { score: RunScore; unlockedCount: number }) {
  const { t } = useT();
  const gradeColor = score.grade.startsWith('A') ? 'text-income-ink bg-income-soft' : score.grade === 'B' ? 'text-brass-600 bg-brass-100' : score.grade === 'C' ? 'text-caution-ink bg-caution-soft' : 'text-expense-ink bg-expense-soft';
  return (
    <div className="rounded-lg ring-1 ring-card-edge overflow-hidden">
      <div className="flex items-center gap-3 p-3 bg-card-edge/30">
        <div className={`w-14 h-14 rounded-xl grid place-items-center font-display text-2xl ${gradeColor}`}>{score.grade}</div>
        <div className="min-w-0">
          <div className="font-display text-ink">{t('outcome.grade')}</div>
          <div className="text-2xs text-ink-soft tnum">{t('outcome.gradeSub', { good: score.goodMoves, bad: score.badMoves, ach: unlockedCount })}</div>
          <div className="mt-1 h-1.5 rounded-full bg-card-edge overflow-hidden w-40 max-w-full">
            <div className="h-full bg-income" style={{ width: `${score.decisionScore}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ResultRow({ label, value, tone }: { label: string; value: string; tone?: 'income' | 'expense' }) {
  const c = tone === 'income' ? 'text-income-ink' : tone === 'expense' ? 'text-expense-ink' : 'text-ink';
  return <div className="flex justify-between"><span className="text-ink-soft">{label}</span><span className={`font-semibold ${c}`}>{value}</span></div>;
}
