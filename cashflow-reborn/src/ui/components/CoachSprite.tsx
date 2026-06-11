import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useGameStore, trailingNegativeCashMonths } from '../store';
import { useProgression } from '../progression';
import { useT } from '../lang';
import { tr } from '@/i18n/loc';
import { pickLesson, type CoachLesson } from '@/modules/coach/wisdom';
import { recordLesson } from '@/modules/coach/journal';
import type { CoachDecisionEntry } from '@/modules/coach/actionLog';
import type { Card } from '@/modules/cards/cards';
import { CoachMascot, type CoachMood } from '../art/Coach';
import { play } from '../sound/sound';
import { COACH_FLAGS } from '@/data/coachFlags';
import { formatINR } from '@/utils/money';

// ============================================================
// Coach sprite — a persistent companion docked at the screen edge.
// Fully self-contained: reads the game + progression stores itself.
// Replaces the buried <CoachInsight /> strip as the lesson surface.
// ============================================================

const TUTORIAL_KEY = 'cashflow-reborn:tutorial-done';
const VERDICT_MS = 2500;

const TUTORIAL_STEPS: readonly string[] = [
  'Tap the big dice to roll — each day costs and earns money.',
  'Tiles draw cards. Green deals grow money; red temptations drain it.',
  "See the ring? When passive income covers expenses, you're free. Fill it.",
];

/** Pose for a just-resolved card decision. Classifies on the ENGLISH warning
 *  text ("Best…" / "WORST…"), independent of the display language. Returns
 *  null when the decision deserves no reaction. Exported for tests. */
export function verdictPoseFor(entry: Pick<CoachDecisionEntry, 'category' | 'borrowed'>, warningEn: string | null): CoachMood | null {
  if (entry.category.startsWith('doodad') && entry.borrowed) return 'facepalm';
  if (warningEn) {
    if (warningEn.startsWith('Best')) return 'celebrate';
    if (warningEn.startsWith('WORST')) return 'facepalm';
    return 'worried';
  }
  if (entry.category === 'resist') return 'happy';
  return null;
}

type Bubble =
  | { kind: 'verdict'; text: string; pose: CoachMood }
  | { kind: 'lesson'; lesson: CoachLesson; expanded: boolean }
  | { kind: 'tutorial'; step: number; text: string };

export function CoachSprite() {
  const { L } = useT();
  const state = useGameStore((s) => s.state);
  const coachMode = useGameStore((s) => s.coachMode);
  const currentCard = useGameStore((s) => s.currentCard);
  const decisionLog = useGameStore((s) => s.decisionLog);
  const lastRoll = useGameStore((s) => s.lastRoll);
  const pendingPayday = useGameStore((s) => s.pendingPayday);
  const toasts = useProgression((s) => s.toasts);

  const [bubble, setBubble] = useState<Bubble | null>(null);
  const [flashPose, setFlashPose] = useState<CoachMood | null>(null);

  // Remember the last open card so we can look up the chosen option's
  // coachWarning after the store has already cleared currentCard.
  const lastCardRef = useRef<Card | null>(null);
  useEffect(() => {
    if (currentCard) lastCardRef.current = currentCard;
  }, [currentCard]);

  const prevLogLen = useRef(decisionLog.length);
  const verdictTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (verdictTimer.current) clearTimeout(verdictTimer.current); }, []);

  // --- Lesson routing — pure function of (state, log), memoized like
  // CoachInsight did (see wisdom.ts for the whitescreen history).
  const picked = useMemo(() => {
    if (!coachMode || !state) return null;
    return pickLesson(state, decisionLog);
  }, [coachMode, state, decisionLog]);

  // Auto-open urgent lessons (priority >= 4) once per session each.
  // Declared BEFORE the verdict/tutorial effects so those win a same-commit race.
  const autoShown = useRef(new Set<string>());
  useEffect(() => {
    if (!picked || picked.lesson.priority < 4) return;
    if (autoShown.current.has(picked.lesson.id)) return;
    if (bubble) return; // something else is talking — retry when it closes
    autoShown.current.add(picked.lesson.id);
    recordLesson(picked.lesson.id);
    setBubble({ kind: 'lesson', lesson: picked.lesson, expanded: false });
  }, [picked, bubble]);

  // --- Verdicts: react when the decision log grows.
  useEffect(() => {
    if (decisionLog.length <= prevLogLen.current) {
      prevLogLen.current = decisionLog.length;
      return;
    }
    prevLogLen.current = decisionLog.length;
    const entry = decisionLog[decisionLog.length - 1];
    const opt = lastCardRef.current?.options.find((o) => o.id === entry.optionId);
    const warningEn = opt?.coachWarning ? tr(opt.coachWarning, 'en') : null;
    const pose = verdictPoseFor(entry, warningEn);
    if (!pose) return;
    const text = opt?.coachWarning
      ? L(opt.coachWarning)
      : entry.category === 'resist' ? 'Nice resist.' : null;
    setFlashPose(pose);
    if (text) setBubble({ kind: 'verdict', text, pose });
    if (verdictTimer.current) clearTimeout(verdictTimer.current);
    verdictTimer.current = setTimeout(() => {
      setFlashPose(null);
      setBubble((b) => (b && b.kind === 'verdict' ? null : b));
    }, VERDICT_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decisionLog]);

  // --- Extra reactions (flagged): payday result + freedom milestones.
  const lastPaydayRef = useRef<typeof pendingPayday>(null);
  useEffect(() => {
    if (!COACH_FLAGS.extraReactions) return;
    if (pendingPayday) {
      lastPaydayRef.current = pendingPayday;
      return;
    }
    const collected = lastPaydayRef.current;
    if (!collected) return;
    lastPaydayRef.current = null;
    const good = collected.netDelta >= 0;
    const pose: CoachMood = good ? 'celebrate' : 'worried';
    const text = good
      ? `Banked ${formatINR(collected.netDelta, { compact: true })} this month. Keep stacking.`
      : `Burned ${formatINR(-collected.netDelta, { compact: true })} more than you made. Watch the bleed.`;
    setFlashPose(pose);
    setBubble({ kind: 'verdict', text, pose });
    if (verdictTimer.current) clearTimeout(verdictTimer.current);
    verdictTimer.current = setTimeout(() => {
      setFlashPose(null);
      setBubble((b) => (b && b.kind === 'verdict' ? null : b));
    }, VERDICT_MS);
  }, [pendingPayday]);

  const milestoneRef = useRef<{ seed: number; top: number } | null>(null);
  useEffect(() => {
    if (!COACH_FLAGS.extraReactions || !state) return;
    const coverage = state.statement.totalExpenses
      ? state.statement.passiveIncome / state.statement.totalExpenses : 0;
    if (!milestoneRef.current || milestoneRef.current.seed !== state.meta.seed) {
      // New run: start from wherever the run already is, so we only cheer fresh crossings.
      milestoneRef.current = { seed: state.meta.seed, top: coverage };
      return;
    }
    const prev = milestoneRef.current.top;
    if (coverage <= prev) return;
    milestoneRef.current.top = coverage;
    const crossed = [0.75, 0.5, 0.25].find((m) => prev < m && coverage >= m);
    if (!crossed) return;
    const pct = Math.round(crossed * 100);
    const text = crossed === 0.75
      ? '75% free. The rat race is losing its grip on you.'
      : crossed === 0.5
        ? 'Halfway out! Passive income now covers half your life.'
        : '25% free — a quarter of your expenses pay for themselves.';
    setFlashPose('celebrate');
    setBubble({ kind: 'verdict', text: `${pct}% · ${text}`, pose: 'celebrate' });
    if (verdictTimer.current) clearTimeout(verdictTimer.current);
    verdictTimer.current = setTimeout(() => {
      setFlashPose(null);
      setBubble((b) => (b && b.kind === 'verdict' ? null : b));
    }, VERDICT_MS + 1200);
  }, [state]);

  // --- Bubble pop sound (flagged): one soft pop whenever a bubble appears.
  const prevBubbleKey = useRef<string | null>(null);
  useEffect(() => {
    const key = bubble
      ? bubble.kind === 'lesson' ? `lesson:${bubble.lesson.id}`
        : bubble.kind === 'tutorial' ? `tut:${bubble.step}`
          : `verdict:${bubble.text}`
      : null;
    if (key && key !== prevBubbleKey.current && COACH_FLAGS.bubbleSound) play('pop');
    prevBubbleKey.current = key;
  }, [bubble]);

  // --- Tutorial: three scripted bubbles for brand-new players.
  const tutorialEnabled = useRef<boolean | null>(null);
  const initialTick = useRef<number | null>(null);
  if (state && initialTick.current === null) {
    initialTick.current = state.meta.tick;
    tutorialEnabled.current =
      typeof localStorage !== 'undefined' && !localStorage.getItem(TUTORIAL_KEY) && state.meta.tick < 2;
  }
  const tutShown = useRef(new Set<number>());
  useEffect(() => {
    if (!tutorialEnabled.current || !state || tutShown.current.size >= 3) return;
    let step: number | null = null;
    if (!tutShown.current.has(2) && initialTick.current !== null && state.meta.tick > initialTick.current) {
      step = 2; // first lap closed a month
    } else if (!tutShown.current.has(1) && decisionLog.length >= 1) {
      step = 1; // first card resolved
    } else if (!tutShown.current.has(0) && lastRoll === null && decisionLog.length === 0) {
      step = 0; // before the first roll
    }
    if (step === null) return;
    tutShown.current.add(step);
    setBubble({ kind: 'tutorial', step, text: TUTORIAL_STEPS[step] });
    if (step === 2 && typeof localStorage !== 'undefined') localStorage.setItem(TUTORIAL_KEY, '1');
  }, [state, decisionLog, lastRoll]);

  // The "tap the dice" bubble retires itself once the player rolls.
  useEffect(() => {
    if (lastRoll !== null) setBubble((b) => (b && b.kind === 'tutorial' && b.step === 0 ? null : b));
  }, [lastRoll]);

  // Auto-dismiss un-expanded bubbles — there is no backdrop, so they must
  // never require interaction to clear (verdicts already self-dismiss).
  useEffect(() => {
    if (!bubble || bubble.kind === 'verdict') return;
    if (bubble.kind === 'lesson' && bubble.expanded) return; // player is reading — stay until X
    const id = setTimeout(() => setBubble(null), 10_000);
    return () => clearTimeout(id);
  }, [bubble]);

  // Hidden while a card is open, coach mode is off, or no game is running.
  if (!state || !coachMode || currentCard) return null;

  const baseline: CoachMood =
    toasts.length > 0 ? 'celebrate' : trailingNegativeCashMonths(state) > 0 ? 'worried' : 'idle';
  const pose = flashPose ?? baseline;
  const showBadge = !!picked && !bubble;

  function onSpriteTap() {
    play('click');
    if (bubble) { setBubble(null); return; }
    if (picked) {
      recordLesson(picked.lesson.id);
      setBubble({ kind: 'lesson', lesson: picked.lesson, expanded: false });
    }
  }

  return (
    <>
      <div className="fixed z-40 left-3 bottom-[calc(env(safe-area-inset-bottom)+84px)] sm:left-auto sm:right-4 sm:bottom-4">
        <div className="relative flex flex-col items-start sm:items-end">
          <AnimatePresence>
            {bubble && (
              <motion.div
                key={bubble.kind === 'tutorial' ? `tut-${bubble.step}` : bubble.kind}
                initial={{ opacity: 0, y: 10, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                className="absolute bottom-full mb-2.5 left-0 sm:left-auto sm:right-0 w-[min(260px,calc(100vw-1.5rem))] paper rounded-2xl ring-1 ring-card-edge shadow-card"
              >
                <SpeechBubbleBody bubble={bubble} onClose={() => setBubble(null)} onExpand={() =>
                  setBubble((b) => (b && b.kind === 'lesson' ? { ...b, expanded: true } : b))
                } />
                {/* tail pointing down at the sprite */}
                <div className="absolute top-full left-6 sm:left-auto sm:right-6 w-3 h-3 -mt-1.5 rotate-45 paper ring-1 ring-card-edge" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }} />
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            onClick={onSpriteTap}
            aria-label="Coach"
            className="relative block drop-shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brass/60 rounded-full"
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <motion.div
              key={pose}
              initial={{ scale: 0.7, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 15 }}
            >
              <CoachMascot mood={pose} size={56} />
            </motion.div>
            {showBadge && (
              <span className="absolute -top-0.5 -right-0.5 w-[18px] h-[18px] rounded-full bg-caution text-wood-900 text-[11px] font-bold grid place-items-center ring-2 ring-card shadow-piece">
                !
              </span>
            )}
          </motion.button>
        </div>
      </div>
    </>
  );
}

function SpeechBubbleBody({ bubble, onClose, onExpand }: { bubble: Bubble; onClose: () => void; onExpand: () => void }) {
  if (bubble.kind === 'verdict') {
    return (
      <div className="px-3 py-2.5">
        <div className="text-2xs uppercase tracking-widest font-display text-brass-600">Coach</div>
        <div className="text-sm text-ink leading-snug mt-0.5">{bubble.text}</div>
      </div>
    );
  }
  if (bubble.kind === 'tutorial') {
    return (
      <div className="px-3 py-2.5 pr-8 relative">
        <CloseX onClose={onClose} />
        <div className="text-2xs uppercase tracking-widest font-display text-brass-600">Coach tip {bubble.step + 1}/3</div>
        <div className="text-sm text-ink leading-snug mt-0.5">{bubble.text}</div>
      </div>
    );
  }
  const { lesson, expanded } = bubble;
  return (
    <div className="px-3 py-2.5 pr-8 relative">
      <CloseX onClose={onClose} />
      <div className="text-2xs uppercase tracking-widest font-display text-brass-600">Coach</div>
      {expanded ? (
        <>
          <div className="text-sm text-ink leading-snug mt-0.5">{lesson.lesson}</div>
          <div className="mt-2 pt-2 border-t border-card-edge">
            <div className="text-sm italic text-ink leading-snug">{lesson.quote}</div>
            <div className="mt-1.5 text-xs text-ink-soft font-medium">
              — {lesson.attribution}{lesson.book ? ` · ${lesson.book}` : ''}
            </div>
          </div>
        </>
      ) : (
        <button onClick={(e) => { e.stopPropagation(); play('click'); onExpand(); }} className="block text-left w-full">
          <div className="text-sm text-ink leading-snug mt-0.5 line-clamp-3">{lesson.lesson}</div>
          <div className="mt-1 text-2xs font-semibold text-brass-600 uppercase tracking-wide">Tap for more</div>
        </button>
      )}
    </div>
  );
}

function CloseX({ onClose }: { onClose: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClose(); }}
      aria-label="Dismiss"
      className="absolute top-1.5 right-1.5 grid place-items-center w-6 h-6 rounded-lg text-ink-faint hover:text-ink hover:bg-card-edge transition"
    >
      <X size={14} />
    </button>
  );
}
