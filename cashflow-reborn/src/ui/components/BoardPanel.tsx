import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { DAYS_IN_MONTH } from '../store';
import { useT } from '../lang';
import { formatINR } from '@/utils/money';
import type { TileType } from '@/modules/cards/cards';
import { Die } from '../art/Die';
import { Coin, Pawn } from '../art/Pieces';
import { PercentCount } from '../fx/CountUp';

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
      <div className="flex items-center justify-between px-1 mb-2">
        <div className="font-display text-ink text-base sm:text-lg">{t('board.month', { n: year * 12 + month })}<span className="text-ink-soft text-sm font-sans"> · {t('board.day', { d: dayPosition, total: DAYS_IN_MONTH })}</span></div>
        <div className="text-xs uppercase tracking-widest text-ink font-display font-semibold">{t('board.marketSuffix', { phase: t(`phase.${phase}` as 'phase.expansion') })}</div>
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
    </div>
  );
}

export function PathBoard({ dayPosition, cellTypes, lastRoll, rolling, canRoll, onRoll, coverage, won, passive, expenses, cardSet, nextType }: BoardProps & { cardSet: Set<number>; nextType?: TileType }) {
  return (
    <div className="sm:hidden space-y-3">
      <Medallion coverage={coverage} won={won} passive={passive} expenses={expenses}
        lastRoll={lastRoll} rolling={rolling} canRoll={canRoll} onRoll={onRoll} nextType={nextType} compact />
      <div className="rounded-tile bg-[oklch(0.90_0.03_86)] ring-2 ring-[oklch(0.34_0.04_50)] p-2.5 flex flex-wrap gap-1.5 justify-center">
        {Array.from({ length: DAYS_IN_MONTH + 1 }, (_, day) => {
          const isHere = day === dayPosition;
          const isCard = cardSet.has(day);
          const isEnd = day === DAYS_IN_MONTH;
          const type = cellTypes[day];
          return (
            <div key={day} className="relative h-7 w-7 grid place-items-center">
              {isHere && (
                <motion.div layoutId="pawn-strip" transition={{ type: 'spring', stiffness: 460, damping: 28 }} className="absolute -top-3.5 z-10">
                  <div className="animate-token-bob"><Pawn size={22} /></div>
                </motion.div>
              )}
              {isEnd ? <div className="h-6 w-6 grid place-items-center rounded-md bg-brass-500 ring-2 ring-[oklch(0.30_0.04_50)] text-wood-900 text-2xs font-bold">★</div>
                : isCard && type ? <div className={`h-6 w-6 grid place-items-center rounded-md ${TILE_STYLE[type].chip} ${TILE_STYLE[type].text} ${TILE_OUTLINE}`}><TileGlyph type={type} small /></div>
                : <div className="h-2 w-2 rounded-full bg-[oklch(0.34_0.04_50)]" />}
            </div>
          );
        })}
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

/** The center medallion — a clickable dice wrapped by the freedom-goal ring. */
export function Medallion({ coverage, won, passive, expenses, lastRoll, rolling, canRoll, onRoll, nextType, compact }: {
  coverage: number; won: boolean; passive: number; expenses: number;
  lastRoll: number | null; rolling: boolean; canRoll: boolean; onRoll: () => void; nextType?: TileType; compact?: boolean;
}) {
  const { t } = useT();
  const pct = Math.min(100, coverage * 100);
  return (
    <div className="relative grid place-items-center" style={{ width: compact ? 230 : 260 }}>
      <FreedomRing pct={pct} won={won} size={compact ? 224 : 256}>
        <div className="flex flex-col items-center gap-1">
          <div className="text-xs uppercase tracking-widest font-display font-bold text-brass-300">{won ? t('board.free') : t('board.freedom')}</div>
          <div className={`font-display leading-none font-bold ${won ? 'text-brass-300' : 'text-card'}`} style={{ fontSize: 40 }}><PercentCount value={pct} /></div>
          {/* The dice IS the roll button — big, obvious, clickable */}
          <button onClick={onRoll} disabled={!canRoll} aria-label={t('board.rollDice')}
            className="group mt-0.5 grid place-items-center disabled:opacity-60 enabled:hover:scale-105 enabled:active:scale-95 transition-transform">
            <Die value={lastRoll ?? 1} rolling={rolling} size={compact ? 50 : 58} />
            <span className="mt-1.5 inline-block btn-3d bg-brass-500 text-wood-900 text-sm px-5 py-1.5 group-enabled:group-hover:bg-brass-600">{rolling ? t('board.rolling') : t('board.tapToRoll')}</span>
          </button>
          {nextType && <div className="text-xs text-brass-300 font-semibold mt-1">{t('board.next')} <span className="font-display text-card">{t(`tile.${nextType}` as 'tile.deal')}</span></div>}
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

/** Circular progress ring around the medallion — the win condition, made central. */
export function FreedomRing({ pct, won, size, children }: { pct: number; won: boolean; size: number; children: React.ReactNode }) {
  const r = size / 2 - 9;
  const c = 2 * Math.PI * r;
  const color = won ? 'oklch(0.82 0.13 88)' : pct >= 75 ? 'oklch(0.74 0.17 150)' : pct >= 40 ? 'oklch(0.82 0.16 92)' : 'oklch(0.70 0.16 50)';
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="oklch(0.30 0.04 158)" strokeWidth="10" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c} initial={false} animate={{ strokeDashoffset: c - (Math.min(100, pct) / 100) * c }}
          transition={{ type: 'spring', stiffness: 90, damping: 20 }} />
        {[0, 25, 50, 75].map((m) => {
          const a = (m / 100) * 2 * Math.PI;
          return <circle key={m} cx={size / 2 + r * Math.cos(a)} cy={size / 2 + r * Math.sin(a)} r="2.5" fill="oklch(0.95 0.04 88)" />;
        })}
      </svg>
      <div className="rounded-full grid place-items-center" style={{ width: size - 30, height: size - 30, background: 'radial-gradient(circle at 50% 35%, oklch(0.30 0.055 158), oklch(0.22 0.045 158))', boxShadow: 'inset 0 2px 10px oklch(0 0 0 / 0.5), 0 0 0 3px oklch(0.34 0.04 50)' }}>{children}</div>
    </div>
  );
}
