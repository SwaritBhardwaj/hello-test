import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useGameStore, BANKRUPTCY_GRACE_MONTHS, trailingNegativeCashMonths } from '../store';
import { useT } from '../lang';
import { Die } from '../art/Die';
import { Confetti } from '../fx/Confetti';
import { play } from '../sound/sound';
import { useProgression } from '../progression';
import { HudBar } from './HudBar';
import { BoardPanel } from './BoardPanel';
import { CardModal } from './CardModal';
import { BalanceSheet } from './BalanceSheet';
import { OutcomeModal } from './OutcomeModal';
import { HistoryPanel } from './HistoryPanel';
import { CoachInsight } from './CoachInsight';
import { BankruptcyWarning } from './BankruptcyWarning';
import { AchievementToasts } from './AchievementToasts';

// ============================================================
// Main board
// ============================================================
export function BoardScreen() {
  const { t } = useT();
  const state = useGameStore((s) => s.state)!;
  const rollDice = useGameStore((s) => s.rollDice);
  const notes = useGameStore((s) => s.notifications);
  const dayPosition = useGameStore((s) => s.dayPosition);
  const lastRoll = useGameStore((s) => s.lastRoll);
  const cardCells = useGameStore((s) => s.cardCells);
  const cellTypes = useGameStore((s) => s.cellTypes);
  const currentCard = useGameStore((s) => s.currentCard);
  const gameStatus = useGameStore((s) => s.gameStatus);
  const outcomeDismissed = useGameStore((s) => s.outcomeDismissed);
  const decisionLog = useGameStore((s) => s.decisionLog);
  const syncProgress = useProgression((s) => s.sync);
  const finishRun = useProgression((s) => s.finishRun);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [rolling, setRolling] = useState(false);

  const chartData = state.history.map((h) => ({ tick: h.tick, netWorth: h.netWorth, cash: h.cashOnHand }));
  const month = state.meta.tick;
  const years = Math.floor(month / 12);
  const monthsIntoYear = month % 12;
  const passiveCoverage = state.statement.totalExpenses ? state.statement.passiveIncome / state.statement.totalExpenses : 0;
  const negMonths = trailingNegativeCashMonths(state);
  const monthsToBankruptcy = Math.max(0, BANKRUPTCY_GRACE_MONTHS - negMonths);
  const showOutcomeModal = gameStatus !== 'playing' && !outcomeDismissed;

  // Sound cues
  useEffect(() => { if (currentCard) play('card'); }, [currentCard]);
  useEffect(() => { if (gameStatus === 'won') play('win'); if (gameStatus === 'lost') play('lose'); }, [gameStatus]);

  // Progression: unlock achievements as state evolves; record the run on finish.
  useEffect(() => { syncProgress(state, decisionLog); }, [state, decisionLog, syncProgress]);
  useEffect(() => {
    if (gameStatus !== 'playing') finishRun(state, decisionLog, gameStatus === 'won');
  }, [gameStatus, state, decisionLog, finishRun]);

  function handleRoll() {
    if (currentCard || rolling) return;
    play('dice');
    setRolling(true);
    setTimeout(() => { rollDice(); setRolling(false); }, 580);
  }

  return (
    <div className="min-h-[100dvh] felt-table pb-24 sm:pb-6">
      {gameStatus === 'won' && !outcomeDismissed && <Confetti />}
      <AchievementToasts />
      <div className="mx-auto max-w-5xl px-3 sm:px-5 py-3 sm:py-4 space-y-3">
        {/* HUD bar — identity + money pills + controls, edge-docked & high-contrast */}
        <HudBar onOpenSheet={() => setSheetOpen(true)} />

        {negMonths > 0 && gameStatus === 'playing' && (
          <BankruptcyWarning monthsNegative={negMonths} monthsToBankruptcy={monthsToBankruptcy} cashOnHand={state.cashOnHand} />
        )}

        {/* The board — the hero of the screen */}
        <BoardPanel
          dayPosition={dayPosition} cardCells={cardCells} cellTypes={cellTypes} lastRoll={lastRoll} rolling={rolling}
          canRoll={!currentCard && !rolling} onRoll={handleRoll}
          coverage={passiveCoverage} won={gameStatus === 'won'} phase={state.market.phase}
          year={years} month={monthsIntoYear + 1}
          passive={state.statement.passiveIncome} expenses={state.statement.totalExpenses}
        />

        <CoachInsight />

        <HistoryPanel data={chartData} notes={notes} />
      </div>

      {/* Sticky mobile roll bar */}
      <div className="sm:hidden fixed inset-x-0 bottom-0 z-30 bg-felt-900/95 backdrop-blur border-t-2 border-brass/40 px-4 pt-3" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
        <button
          onClick={handleRoll} disabled={!!currentCard || rolling}
          className="btn-3d w-full bg-brass-500 enabled:hover:bg-brass-600 text-wood-900 text-lg py-3 flex items-center justify-center gap-2"
        >
          <Die value={lastRoll ?? 6} rolling={rolling} size={30} /> {rolling ? t('board.rolling') : t('board.rollDice')}
        </button>
      </div>

      <AnimatePresence>{currentCard && <CardModal key="card" card={currentCard} />}</AnimatePresence>
      <AnimatePresence>{sheetOpen && <BalanceSheet key="sheet" onClose={() => setSheetOpen(false)} />}</AnimatePresence>
      <AnimatePresence>{showOutcomeModal && <OutcomeModal key="outcome" status={gameStatus} />}</AnimatePresence>
    </div>
  );
}
