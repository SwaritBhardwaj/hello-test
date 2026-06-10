import { useMemo, useState } from 'react';
import { useT } from '../lang';
import { formatINR } from '@/utils/money';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Pawn } from '../art/Pieces';
import { loadGhost } from '@/modules/progression/storage';

// ============================================================
// History panel — net-worth chart + game log
// ============================================================
export function HistoryPanel({ data, notes }: { data: { tick: number; netWorth: number; cash: number }[]; notes: string[] }) {
  const { t: ui } = useT();
  const [tab, setTab] = useState<'chart' | 'log'>('chart');
  return (
    <section className="paper rounded-game shadow-card ring-1 ring-card-edge overflow-hidden">
      <div className="flex border-b border-card-edge">
        {(['chart', 'log'] as const).map((tabKey) => (
          <button key={tabKey} onClick={() => setTab(tabKey)} className={`px-4 py-2 font-display text-sm transition ${tab === tabKey ? 'text-income-ink border-b-2 border-income bg-income-soft/40' : 'text-ink-soft font-semibold hover:bg-card-edge/40'}`}>
            {tabKey === 'chart' ? ui('history.netWorth') : ui('history.gameLog')}
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
export function ChartBody({ data }: { data: { tick: number; netWorth: number; cash: number }[] }) {
  const { t } = useT();
  const ghost = useMemo(() => loadGhost(), []);
  const merged = useMemo(() => {
    if (!ghost) return data;
    const byTick = new Map(ghost.points.map((p) => [p.tick, p.netWorth]));
    return data.map((d) => ({ ...d, ghost: byTick.get(d.tick) }));
  }, [data, ghost]);
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
      <div style={{ width: '100%', height: 200 }}>
        <ResponsiveContainer>
          <LineChart data={merged}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.02 86)" />
            <XAxis dataKey="tick" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => formatINR(v, { compact: true })} tick={{ fontSize: 11 }} width={48} />
            <Tooltip formatter={(v: number) => formatINR(v)} />
            {ghost && <Line type="monotone" dataKey="ghost" stroke="oklch(0.62 0.015 62)" strokeDasharray="4 4" dot={false} strokeWidth={1.5} />}
            <Line type="monotone" dataKey="netWorth" stroke="oklch(0.55 0.12 158)" dot={false} strokeWidth={2.5} />
            <Line type="monotone" dataKey="cash" stroke="oklch(0.74 0.13 80)" dot={false} strokeWidth={1.5} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

export function LogBody({ notes }: { notes: string[] }) {
  const { t } = useT();
  return (
    <ul className="text-sm text-ink-soft space-y-1 max-h-52 overflow-auto pr-1">
      {notes.length === 0 && <li className="text-ink-faint italic">{t('history.logEmpty')}</li>}
      {[...notes].reverse().map((n, i) => <li key={i} className="leading-snug">{n}</li>)}
    </ul>
  );
}
