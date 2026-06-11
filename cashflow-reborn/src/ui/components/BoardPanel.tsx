import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DAYS_IN_MONTH, useGameStore } from '../store';
import { useT } from '../lang';
import { formatINR } from '@/utils/money';
import type { TileType } from '@/modules/cards/cards';
import { Die } from '../art/Die';
import { Coin, Pawn } from '../art/Pieces';
import { PercentCount } from '../fx/CountUp';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ============================================================
// Board panel — oval racetrack (sm+) + compact path (mobile)
// ============================================================
// Bright Cashflow-style tiles: saturated fill, bold dark outline, dark labels.
export const TILE_STYLE: Record<TileType, { chip: string; text: string }> = {
  deal: { chip: 'bg-[oklch(0.76_0.17_150)]', text: 'text-[oklch(0.22_0.05_150)]' },
  temptation: { chip: 'bg-[oklch(0.66_0.20_28)]', text: 'text-[oklch(0.99_0.02_28)]' },
  market: { chip: 'bg-[oklch(0.68_0.14_245)]', text: 'text-[oklch(0.99_0.01_245)]' },
  chance: { chip: 'bg-[oklch(0.74_0.13_195)]', text: 'text-[oklch(0.22_0.05_195)]' },
  payday: { chip: 'bg-[oklch(0.85_0.16_92)]', text: 'text-[oklch(0.30_0.06_70)]' },
};
export const TILE_OUTLINE = 'ring-2 ring-[oklch(0.30_0.04_50)]';

export interface BoardProps {
  dayPosition: number; cardCells: number[]; cellTypes: Record<number, TileType>;
  lastRoll: number | null; rolling: boolean; canRoll: boolean; onRoll: () => void;
  coverage: number; won: boolean; phase: string; year: number; month: number;
  passive: number; expenses: number;
}

export function BoardPanel(props: BoardProps) {
  const { t } = useT();
  const { dayPosition, cardCells, cellTypes, year, month, phase } = props;
  const cardSet = useMemo(() => new Set(cardCells), [cardCells]);
  const nextCardDay = useMemo(() => cardCells.filter((c) => c > dayPosition).sort((a, b) => a - b)[0], [cardCells, dayPosition]);
  const nextType = nextCardDay != null ? cellTypes[nextCardDay] : undefined;

  return (
    <section className="board-cream rounded-game p-3 sm:p-5 relative">
      <div className="flex items-center justify-between px-1 mb-2 gap-2">
        <div className="font-display text-ink text-base sm:text-lg">{t('board.month', { n: year * 12 + month })}<span className="text-ink-soft text-sm font-sans"> · {t('board.day', { d: dayPosition, total: DAYS_IN_MONTH })}</span></div>
        <div className="flex items-center gap-2">
          <PhaseChip phase={phase} label={t('board.marketSuffix', { phase: t(`phase.${phase}` as 'phase.expansion') })} />
          {/* tiny deck on the mobile header row — the oval center hosts the desktop one */}
          <span className="sm:hidden"><CardDeck small /></span>
        </div>
      </div>

      {/* Oval racetrack — desktop / tablet */}
      <OvalBoard {...props} cardSet={cardSet} nextType={nextType} />

      {/* Compact path — mobile */}
      <PathBoard {...props} cardSet={cardSet} nextType={nextType} />
    </section>
  );
}

export function OvalBoard({ dayPosition, cellTypes, lastRoll, rolling, canRoll, onRoll, coverage, won, passive, expenses, cardSet, nextType }: BoardProps & { cardSet: Set<number>; nextType?: TileType }) {
  const { t } = useT();
  return (
    <div className="hidden sm:block relative w-full" style={{ aspectRatio: '1.5 / 1' }}>
      {/* printed track ellipse — dark line on cream */}
      <svg viewBox="0 0 100 67" className="absolute inset-0 w-full h-full" preserveAspectRatio="none" aria-hidden>
        <ellipse cx="50" cy="33.5" rx="45" ry="29" fill="none" stroke="oklch(0.34 0.04 50)" strokeWidth="3" />
        <ellipse cx="50" cy="33.5" rx="45" ry="29" fill="none" stroke="oklch(0.88 0.06 88)" strokeWidth="1.4" strokeDasharray="0.4 2.2" />
      </svg>
      {Array.from({ length: DAYS_IN_MONTH + 1 }, (_, day) => {
        const angle = -90 + (day / (DAYS_IN_MONTH + 1)) * 360;
        const rad = (angle * Math.PI) / 180;
        const x = 50 + 45 * Math.cos(rad);
        const y = 50 + 45 * Math.sin(rad);
        const isHere = day === dayPosition;
        const isCard = cardSet.has(day);
        const isEnd = day === DAYS_IN_MONTH;
        const isStart = day === 0;
        const type = cellTypes[day];
        return (
          <div key={day} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y}%` }}>
            {isHere && (
              <motion.div layoutId="pawn-oval" transition={{ type: 'spring', stiffness: 460, damping: 28 }} className="absolute left-1/2 -translate-x-1/2 -top-7 z-20">
                <div className="animate-token-bob"><Pawn size={30} /></div>
              </motion.div>
            )}
            {isEnd ? <CornerTile label={t('tile.free')} glyph="★" gold />
              : isStart ? <CornerTile label={t('tile.start')} glyph="▶" />
              : isCard && type ? <BoardTile type={type} />
              : <div className="h-2.5 w-2.5 rounded-full bg-[oklch(0.34_0.04_50)]" />}
          </div>
        );
      })}
      {/* Center medallion — the goal lives here */}
      <div className="absolute inset-0 grid place-items-center">
        <Medallion coverage={coverage} won={won} passive={passive} expenses={expenses}
          lastRoll={lastRoll} rolling={rolling} canRoll={canRoll} onRoll={onRoll} nextType={nextType} />
      </div>
      {/* Decorative face-down draw pile, beside the medallion */}
      <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: '22%', top: '60%' }}>
        <CardDeck />
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Market-phase chip — colored dot + direction glyph
// ------------------------------------------------------------
const PHASE_META: Record<string, { dot: string; up: boolean }> = {
  expansion: { dot: 'oklch(0.60 0.13 158)', up: true },
  recovery: { dot: 'oklch(0.66 0.13 150)', up: true },
  peak: { dot: 'oklch(0.78 0.13 84)', up: true },
  contraction: { dot: 'oklch(0.55 0.07 235)', up: false },
  trough: { dot: 'oklch(0.45 0.06 250)', up: false },
};

export function PhaseChip({ phase, label }: { phase: string; label: string }) {
  const m = PHASE_META[phase] ?? PHASE_META.expansion;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-2 py-1 ring-1 ring-[oklch(0.34_0.04_50)/0.35] shadow-sm">
      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: m.dot, boxShadow: `0 0 5px ${m.dot}` }} aria-hidden />
      <span className="text-2xs uppercase tracking-widest text-ink font-display font-semibold whitespace-nowrap">{label}</span>
      <span className={`leading-none ${m.up ? 'text-income-ink' : 'text-expense-ink'}`} style={{ fontSize: 9 }} aria-hidden>{m.up ? '▲' : '▼'}</span>
    </span>
  );
}

// ------------------------------------------------------------
// Decorative face-down draw pile — top card lifts while a card is open
// ------------------------------------------------------------
export function CardDeck({ small }: { small?: boolean }) {
  const active = useGameStore((s) => !!s.currentCard);
  const w = small ? 20 : 44;
  const h = small ? 27 : 60;
  return (
    <div aria-hidden className="relative pointer-events-none" style={{ width: w + 10, height: h + 10 }}>
      {[0, 1, 2].map((i) => {
        const top = i === 2;
        return (
          <div
            key={i}
            className="card-back absolute rounded-md"
            style={{
              width: w,
              height: h,
              left: i * 2,
              top: 8 - i * 3,
              transform: top && active ? 'translateY(-22%) rotate(-9deg)' : `rotate(${(i - 1) * 2}deg)`,
              transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
        );
      })}
    </div>
  );
}

export function PathBoard({ dayPosition, cellTypes, lastRoll, rolling, canRoll, onRoll, coverage, won, passive, expenses, cardSet, nextType }: BoardProps & { cardSet: Set<number>; nextType?: TileType }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Keep the current tile in view: park it ~30% from the left edge so the
  // upcoming stretch of the month (~7-8 tiles) stays visible ahead of the pawn.
  useEffect(() => {
    const track = trackRef.current;
    const tile = tileRefs.current[dayPosition];
    if (!track || !tile) return;
    const target = tile.offsetLeft + tile.offsetWidth / 2 - track.clientWidth * 0.25;
    track.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }, [dayPosition]);

  return (
    <div className="sm:hidden space-y-3">
      <Medallion coverage={coverage} won={won} passive={passive} expenses={expenses}
        lastRoll={lastRoll} rolling={rolling} canRoll={canRoll} onRoll={onRoll} nextType={nextType} compact />
      {/* Horizontal scrolling track — styled like the printed board strip */}
      <div className="rounded-tile bg-[oklch(0.90_0.03_86)] ring-2 ring-[oklch(0.34_0.04_50)] overflow-hidden">
        <div ref={trackRef} className="scrollbar-hide overflow-x-auto overflow-y-hidden px-3 pt-7 pb-1.5">
          <div className="relative flex items-center w-max">
            {/* dark connecting line behind the tiles */}
            <div className="absolute left-3 right-3 top-1/2 -translate-y-[calc(50%+7px)] h-[3px] rounded-full bg-[oklch(0.34_0.04_50)]" aria-hidden />
            {Array.from({ length: DAYS_IN_MONTH + 1 }, (_, day) => {
              const isHere = day === dayPosition;
              const isCard = cardSet.has(day);
              const isEnd = day === DAYS_IN_MONTH;
              const type = cellTypes[day];
              return (
                <div key={day} ref={(el) => { tileRefs.current[day] = el; }} className="relative shrink-0 w-10 flex flex-col items-center">
                  {isHere && (
                    <motion.div layoutId="pawn-strip" transition={{ type: 'spring', stiffness: 460, damping: 28 }} className="absolute -top-6 z-10">
                      <div className="animate-token-bob"><Pawn size={24} /></div>
                    </motion.div>
                  )}
                  <div className="relative h-9 grid place-items-center">
                    {isEnd ? <div className="h-9 w-9 grid place-items-center rounded-md bg-brass-500 ring-2 ring-[oklch(0.30_0.04_50)] text-wood-900 text-base font-bold shadow-piece">★</div>
                      : isCard && type ? <div className={`h-9 w-9 grid place-items-center rounded-md shadow-piece ${TILE_STYLE[type].chip} ${TILE_STYLE[type].text} ${TILE_OUTLINE}`}><TileGlyph type={type} /></div>
                      : <div className={`rounded-full ring-2 ring-[oklch(0.34_0.04_50)] ${isHere ? 'h-5 w-5 bg-card' : 'h-4 w-4 bg-[oklch(0.96_0.02_88)]'}`} />}
                  </div>
                  <div className={`mt-0.5 leading-none tnum font-semibold ${isHere ? 'text-ink' : 'text-ink-soft'}`} style={{ fontSize: 9 }}>{day}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function BoardTile({ type }: { type: TileType }) {
  const { t } = useT();
  return (
    <div className={`grid place-items-center h-11 w-11 rounded-lg shadow-piece ${TILE_STYLE[type].chip} ${TILE_STYLE[type].text} ${TILE_OUTLINE}`}>
      <TileGlyph type={type} />
      <span className="font-display font-bold leading-none" style={{ fontSize: 9 }}>{t(`tile.${type}.short` as 'tile.deal.short')}</span>
    </div>
  );
}

export function CornerTile({ label, glyph, gold }: { label: string; glyph: string; gold?: boolean }) {
  return (
    <div className={`grid place-items-center h-12 w-12 rounded-lg shadow-piece ${TILE_OUTLINE} ${gold ? 'bg-brass-500 text-wood-900' : 'bg-card text-wood-900'}`}>
      <span className="leading-none text-lg">{glyph}</span>
      <span className="font-display font-bold leading-none" style={{ fontSize: 8 }}>{label}</span>
    </div>
  );
}

export function TileGlyph({ type, small }: { type: TileType; small?: boolean }) {
  const s = small ? 12 : 16;
  if (type === 'deal' || type === 'payday') return <Coin size={s} />;
  const letter = type === 'temptation' ? '♥' : type === 'market' ? '✦' : '?';
  return <span className="font-display font-bold leading-none" style={{ fontSize: small ? 12 : 16 }}>{letter}</span>;
}

/** The center medallion — a clickable dice wrapped by the freedom-goal ring.
 *  In `compact` (mobile) mode it is status-only: the sticky bottom bar is the single roll CTA. */
export function Medallion({ coverage, won, passive, expenses, lastRoll, rolling, canRoll, onRoll, nextType, compact }: {
  coverage: number; won: boolean; passive: number; expenses: number;
  lastRoll: number | null; rolling: boolean; canRoll: boolean; onRoll: () => void; nextType?: TileType; compact?: boolean;
}) {
  const { t } = useT();
  const pct = Math.min(100, coverage * 100);
  return (
    <div className="relative grid place-items-center mx-auto" style={{ width: compact ? 180 : 260 }}>
      <FreedomRing pct={pct} won={won} size={compact ? 176 : 256}>
        <div className="flex flex-col items-center gap-1">
          <div className={`uppercase tracking-widest font-display font-bold text-brass-300 ${compact ? 'text-2xs' : 'text-xs'}`}>{won ? t('board.free') : t('board.freedom')}</div>
          <div className={`font-display leading-none font-bold ${won ? 'text-brass-300' : 'text-card'}`} style={{ fontSize: compact ? 28 : 40 }}><PercentCount value={pct} /></div>
          {compact ? (
            /* Status-only: small die echoes the last roll; rolling happens in the sticky bar */
            <div className="mt-0.5 grid place-items-center" aria-hidden>
              <Die value={lastRoll ?? 6} rolling={rolling} size={34} />
            </div>
          ) : (
            /* The dice IS the roll button — big, obvious, clickable (desktop) */
            <button onClick={onRoll} disabled={!canRoll} aria-label={t('board.rollDice')}
              className="group mt-0.5 grid place-items-center disabled:opacity-60 enabled:hover:scale-105 enabled:active:scale-95 transition-transform">
              <Die value={lastRoll ?? 1} rolling={rolling} size={58} />
              <span className="mt-1.5 inline-block btn-3d bg-brass-500 text-wood-900 text-sm px-5 py-1.5 group-enabled:group-hover:bg-brass-600">{rolling ? t('board.rolling') : t('board.tapToRoll')}</span>
            </button>
          )}
          {nextType && <div className={`text-brass-300 font-semibold ${compact ? 'text-2xs mt-0.5' : 'text-xs mt-1'}`}>{t('board.next')} <span className="font-display text-card">{t(`tile.${nextType}` as 'tile.deal')}</span></div>}
        </div>
      </FreedomRing>
      <div className="mt-1.5 text-xs tnum flex items-center gap-1.5 font-semibold">
        <span className="text-income-ink">{t('board.passive', { x: formatINR(passive, { compact: true }) })}</span>
        <span className="text-ink-soft">/</span>
        <span className="text-expense-ink">{t('board.exp', { x: formatINR(expenses, { compact: true }) })}</span>
      </div>
    </div>
  );
}

/** Circular progress ring around the medallion — the win condition, made central.
 *  Gradient brass→green stroke with a soft glow that pulses on progress, brass
 *  milestone dots at 25/50/75 that light up, and a one-shot burst on crossing. */
export function FreedomRing({ pct, won, size, children }: { pct: number; won: boolean; size: number; children: React.ReactNode }) {
  const gradId = useId();
  const r = size / 2 - 9;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, pct) / 100) * c;
  const prevPctRef = useRef(pct);
  const [pulseKey, setPulseKey] = useState(0);
  const [burst, setBurst] = useState<number | null>(null);

  // Detect progress: pulse the glow on any increase, burst on milestone cross.
  useEffect(() => {
    const prev = prevPctRef.current;
    prevPctRef.current = pct;
    if (pct <= prev + 0.05 || prefersReducedMotion()) return;
    setPulseKey((k) => k + 1);
    const crossed = [25, 50, 75].find((m) => prev < m && pct >= m);
    if (crossed != null) setBurst(crossed);
  }, [pct]);

  const milestonePos = (m: number) => {
    const a = (m / 100) * 2 * Math.PI;
    return { x: size / 2 + r * Math.cos(a), y: size / 2 + r * Math.sin(a) };
  };

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90 overflow-visible" aria-hidden>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="oklch(0.80 0.12 86)" />
            <stop offset="55%" stopColor="oklch(0.78 0.14 120)" />
            <stop offset="100%" stopColor="oklch(0.72 0.17 152)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="oklch(0.30 0.04 158)" strokeWidth="10" />
        {/* Soft outer glow under-stroke — blurred copy of the progress arc.
            Remounts per pulseKey so each gain replays a brighten-then-settle pulse. */}
        <motion.circle
          key={`glow-${pulseKey}`}
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={`url(#${gradId})`} strokeWidth={13} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
          style={{ filter: 'blur(5px)' }}
          initial={{ opacity: won ? 0.65 : 0.3 }}
          animate={pulseKey > 0 && !won ? { opacity: [0.3, 0.85, 0.3] } : { opacity: won ? 0.65 : 0.3 }}
          transition={{ duration: 1.1, ease: 'easeInOut' }}
        />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${gradId})`} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c} initial={false} animate={{ strokeDashoffset: offset }}
          transition={{ type: 'spring', stiffness: 90, damping: 20 }} />
        {/* Brass milestone dots — light up once passed */}
        {[25, 50, 75].map((m) => {
          const { x, y } = milestonePos(m);
          const lit = pct >= m;
          return (
            <circle key={m} cx={x} cy={y} r={lit ? 3.4 : 2.5}
              fill={lit ? 'oklch(0.88 0.13 88)' : 'oklch(0.46 0.04 130)'}
              stroke={lit ? 'oklch(0.97 0.05 88)' : 'oklch(0.30 0.04 158)'} strokeWidth={1}
              style={lit ? { filter: 'drop-shadow(0 0 4px oklch(0.85 0.14 88 / 0.9))' } : undefined}
            />
          );
        })}
        {/* One-shot radial burst at a freshly crossed milestone */}
        <AnimatePresence>
          {burst != null && (
            <motion.circle
              key={`burst-${burst}`}
              cx={milestonePos(burst).x} cy={milestonePos(burst).y} r={5}
              fill="none" stroke="oklch(0.90 0.12 90)" strokeWidth={2.5}
              style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
              initial={{ opacity: 0.95, scale: 0.4 }}
              animate={{ opacity: 0, scale: 4.5 }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
              onAnimationComplete={() => setBurst(null)}
            />
          )}
        </AnimatePresence>
      </svg>
      <div className="rounded-full grid place-items-center" style={{ width: size - 30, height: size - 30, background: 'radial-gradient(circle at 50% 35%, oklch(0.30 0.055 158), oklch(0.22 0.045 158))', boxShadow: 'inset 0 2px 10px oklch(0 0 0 / 0.5), 0 0 0 3px oklch(0.34 0.04 50)' }}>{children}</div>
    </div>
  );
}
