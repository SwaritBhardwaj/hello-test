import { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Sparkles } from 'lucide-react';
import { useT } from '../lang';
import { formatINR } from '@/utils/money';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Pawn } from '../art/Pieces';
import { loadGhost } from '@/modules/progression/storage';
import { useGameStore, type AppliedMoneyEvent } from '../store';

// ============================================================
// History panel — net-worth chart + activity feed
// ============================================================
export function HistoryPanel({ data, notes }: { data: { tick: number; netWorth: number; cash: number }[]; notes: string[] }) {
  const { t: ui } = useT();
  const [tab, setTab] = useState<'chart' | 'log'>('chart');
  return (
    <section className="paper rounded-game shadow-card ring-1 ring-card-edge overflow-hidden">
      <div className="flex border-b border-card-edge">
        {(['chart', 'log'] as const).map((tabKey) => (
          <button key={tabKey} onClick={() => setTab(tabKey)} className={`px-4 py-2 font-display text-sm transition ${tab === tabKey ? 'text-income-ink border-b-2 border-income bg-income-soft/40' : 'text-ink-soft font-semibold hover:bg-card-edge/40'}`}>
            {tabKey === 'chart' ? ui('history.netWorth') : 'Activity'}
          </button>
        ))}
      </div>
      <div className="p-3 sm:p-4">
        {tab === 'chart' ? <ChartBody data={data} /> : <LogBody notes={notes} />}
      </div>
    </section>
  );
}

// ============================================================
// Chart + log bodies (inside HistoryPanel tabs)
// ============================================================
const INK_SOFT = 'oklch(0.45 0.02 62)';
const NET_GREEN = 'oklch(0.55 0.13 158)';

/** Glowing marker on the latest data point of the net-worth line. */
function lastPointDot(lastIndex: number) {
  // recharts calls this per point; only the newest one gets the glow.
  return function GlowDot(props: { cx?: number; cy?: number; index?: number }) {
    const { cx, cy, index } = props;
    if (index !== lastIndex || cx == null || cy == null) return <g key={`np-${index}`} />;
    return (
      <g key={`np-${index}`}>
        <circle cx={cx} cy={cy} r={8} fill="oklch(0.70 0.16 155 / 0.22)" />
        <circle cx={cx} cy={cy} r={5} fill="oklch(0.70 0.16 155 / 0.35)" />
        <circle cx={cx} cy={cy} r={3.2} fill={NET_GREEN} stroke="oklch(0.985 0.01 86)" strokeWidth={1.5} />
      </g>
    );
  };
}

export function ChartBody({ data }: { data: { tick: number; netWorth: number; cash: number }[] }) {
  const { t } = useT();
  const ghost = useMemo(() => loadGhost(), []);
  const merged = useMemo(() => {
    if (!ghost) return data;
    const byTick = new Map(ghost.points.map((p) => [p.tick, p.netWorth]));
    return data.map((d) => ({ ...d, ghost: byTick.get(d.tick) }));
  }, [data, ghost]);
  const lastTick = data.length ? data[data.length - 1].tick : 0;
  const inYears = lastTick > 24;
  const yearTicks = useMemo(
    () => (inYears ? Array.from({ length: Math.floor(lastTick / 12) }, (_, i) => (i + 1) * 12) : undefined),
    [inYears, lastTick],
  );
  if (data.length <= 1) {
    return (
      <div className="h-[180px] flex flex-col items-center justify-center text-center text-ink-faint">
        <Pawn size={32} />
        <p className="text-xs mt-2">{t('history.chartEmpty')}<br />{t('history.chartEmptySub')}</p>
      </div>
    );
  }
  return (
    <>
      {ghost && <div className="text-2xs text-ink-faint flex items-center gap-1 mb-1"><span className="inline-block w-3 border-t border-dashed border-ink-faint" /> {t('history.bestRun')}</div>}
      <div className="rounded-lg ring-1 ring-card-edge bg-[oklch(0.965_0.018_88)] pt-2 pr-2" style={{ width: '100%', height: 200 }}>
        <ResponsiveContainer>
          <LineChart data={merged} margin={{ top: 6, right: 10, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="tick" axisLine={false} tickLine={false}
              tick={{ fontSize: 10, fill: INK_SOFT }}
              ticks={yearTicks}
              tickFormatter={(v: number) => (inYears ? `Y${Math.round(v / 12)}` : String(v))}
            />
            <YAxis
              tickFormatter={(v) => formatINR(v, { compact: true })} width={48}
              axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: INK_SOFT }}
            />
            <Tooltip
              formatter={(v: number) => formatINR(v)}
              labelFormatter={(v: number) => `Month ${v}`}
              contentStyle={{
                background: 'oklch(0.975 0.012 86)',
                border: '1px solid oklch(0.34 0.04 50 / 0.25)',
                borderRadius: '0.75rem',
                boxShadow: '0 8px 20px -8px oklch(0.30 0.05 60 / 0.35)',
                fontSize: 12,
                padding: '6px 10px',
              }}
              labelStyle={{ color: INK_SOFT, fontWeight: 600, fontSize: 11 }}
            />
            {ghost && <Line type="monotone" dataKey="ghost" name="your best" stroke="oklch(0.62 0.015 62)" strokeDasharray="4 4" dot={false} strokeWidth={1.5} />}
            <Line type="monotone" dataKey="cash" name="Cash" stroke="oklch(0.70 0.12 82)" dot={false} strokeWidth={1.5} />
            <Line type="monotone" dataKey="netWorth" name="Net worth" stroke={NET_GREEN} strokeWidth={3} dot={lastPointDot(merged.length - 1)} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

// ------------------------------------------------------------
// Activity feed — bank-app style money rows + subtle note dividers
// ------------------------------------------------------------
type FeedItem =
  | { kind: 'money'; key: string; pos: number; event: AppliedMoneyEvent }
  | { kind: 'note'; key: string; pos: number; text: string };

export function LogBody({ notes }: { notes: string[] }) {
  const { t } = useT();
  const moneyEvents = useGameStore((s) => s.moneyEvents);

  // Merge both chronological lists by relative recency (neither carries a
  // shared clock, so normalized list position is the cheapest fair ordering).
  const feed = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [];
    moneyEvents.forEach((e, i) =>
      items.push({ kind: 'money', key: `m-${e.monthTick}-${e.id}-${i}`, pos: (i + 1) / (moneyEvents.length + 1), event: e }));
    notes.forEach((n, i) =>
      items.push({ kind: 'note', key: `n-${i}`, pos: (i + 1) / (notes.length + 1), text: n }));
    return items.sort((a, b) => b.pos - a.pos).slice(0, 60);
  }, [moneyEvents, notes]);

  if (feed.length === 0) {
    return <p className="text-ink-faint italic text-sm">{t('history.logEmpty')}</p>;
  }
  return (
    <ul className="max-h-64 overflow-auto pr-1">
      {feed.map((item) =>
        item.kind === 'money' ? <MoneyRow key={item.key} e={item.event} /> : <NoteRow key={item.key} text={item.text} />,
      )}
    </ul>
  );
}

function MoneyRow({ e }: { e: AppliedMoneyEvent }) {
  const credit = e.kind === 'credit';
  return (
    <li className="flex items-center gap-2.5 py-1.5 border-b border-card-edge/60 last:border-0">
      <span className={`shrink-0 grid place-items-center h-8 w-8 rounded-full ${credit ? 'bg-income-soft text-income-ink' : 'bg-expense-soft text-expense-ink'}`}>
        {credit ? <ArrowDownLeft size={16} strokeWidth={2.5} /> : <ArrowUpRight size={16} strokeWidth={2.5} />}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-ink leading-tight truncate">{e.label}</div>
        <div className="text-2xs text-ink-faint">Day {e.day} · Month {e.monthTick + 1}</div>
      </div>
      <div className="text-right shrink-0">
        <div className={`text-sm font-bold tnum leading-tight ${credit ? 'text-income-ink' : 'text-expense-ink'}`}>
          {credit ? '+' : '−'}{formatINR(e.amount, { compact: true })}
        </div>
        <div className="text-2xs text-ink-faint tnum">bal {formatINR(e.balanceAfter, { compact: true })}</div>
      </div>
    </li>
  );
}

function NoteRow({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-2 py-1.5 text-2xs text-ink-faint">
      <span className="h-px flex-1 bg-card-edge" aria-hidden />
      <Sparkles size={11} className="shrink-0 opacity-70" aria-hidden />
      <span className="max-w-[70%] text-center leading-snug">{text}</span>
      <span className="h-px flex-1 bg-card-edge" aria-hidden />
    </li>
  );
}
