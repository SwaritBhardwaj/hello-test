import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { VolumeX, Volume2, MoreHorizontal } from 'lucide-react';
import { useGameStore } from '../store';
import { useT, useLangStore } from '../lang';
import { LANGS } from '@/i18n/loc';
import { rankFor } from '@/modules/progression/titles';
import { Coin, Pawn } from '../art/Pieces';
import { CoachMascot } from '../art/Coach';
import { useCoachStyle } from '../coachStyle';
import { MoneyCount } from '../fx/CountUp';
import { play } from '../sound/sound';
import { useMute } from '../sound/useSound';

// ============================================================
// HUD bar — identity + money pills + controls, edge-docked & high-contrast
// ============================================================
export function HudBar({ onOpenSheet }: { onOpenSheet: () => void }) {
  const { t } = useT();
  const state = useGameStore((s) => s.state)!;
  const ff = useGameStore((s) => s.fastForward);
  const reset = useGameStore((s) => s.reset);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="flex items-center justify-between gap-2 flex-wrap">
      <div className="flex items-center gap-2 min-w-0">
        <Pawn size={26} />
        <div className="min-w-0">
          <div className="font-display text-base sm:text-lg text-card leading-none truncate">{state.player.name}</div>
          <div className="mt-0.5"><LevelBadge /></div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 order-3 sm:order-2 w-full sm:w-auto justify-between sm:justify-end mt-1 sm:mt-0">
        <MoneyPill label={t('hud.netWorth')} value={state.statement.netWorth} tone={state.statement.netWorth >= 0 ? 'income' : 'expense'} />
        <MoneyPill label={t('hud.cash')} value={state.cashOnHand} coin tone={state.cashOnHand < 0 ? 'expense' : 'brass'} />
        <MoneyPill label={t('hud.cashflow')} value={state.statement.totalIncome - state.statement.totalExpenses} signed tone={state.statement.totalIncome - state.statement.totalExpenses >= 0 ? 'income' : 'expense'} />
      </div>
      <div className="flex items-center gap-1.5 order-2 sm:order-3">
        <LanguageToggle />
        <CoachStyleToggle />
        <MuteToggle />
        <CoachToggle />
        <button onClick={() => { play('click'); onOpenSheet(); }} className="btn-3d bg-brass-500 enabled:hover:bg-brass-600 text-wood-900 px-3 py-1.5 text-sm whitespace-nowrap">
          <span className="hidden sm:inline">{t('hud.balanceSheet')}</span><span className="sm:hidden">{t('hud.sheet')}</span>
        </button>
        <div className="relative">
          <button onClick={() => setMenuOpen((o) => !o)} className="rounded-xl bg-felt-700 hover:bg-felt-600 text-card px-3 py-2 text-sm shadow-piece transition active:scale-95" aria-label="More actions"><MoreHorizontal size={20} /></button>
          <AnimatePresence>
            {menuOpen && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="absolute right-0 mt-2 w-44 paper rounded-xl shadow-card ring-1 ring-card-edge z-30 overflow-hidden">
                <MenuItem onClick={() => { ff(12); setMenuOpen(false); }}>{t('menu.skip1y')}</MenuItem>
                <MenuItem onClick={() => { ff(60); setMenuOpen(false); }}>{t('menu.skip5y')}</MenuItem>
                <MenuItem danger onClick={() => { reset(); setMenuOpen(false); }}>{t('menu.newGame')}</MenuItem>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}

// ============================================================
// HUD money pill
// ============================================================
export function MoneyPill({ label, value, coin, signed, tone }: { label: string; value: number; coin?: boolean; signed?: boolean; tone: 'income' | 'expense' | 'brass' }) {
  const text = tone === 'income' ? 'text-income-ink' : tone === 'expense' ? 'text-expense-ink' : 'text-wood-900';
  return (
    <div className="paper rounded-xl shadow-piece px-2.5 py-1.5 flex items-center gap-1.5 min-w-0">
      {coin && <Coin size={18} />}
      <div className="min-w-0">
        <div className="text-2xs uppercase tracking-wider text-ink-soft leading-none font-semibold">{label}</div>
        <div className={`font-display text-sm sm:text-base leading-tight ${text}`}>
          {signed && value >= 0 ? '+' : ''}<MoneyCount value={value} compact />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Header toggles
// ============================================================
export function CoachToggle() {
  const { t } = useT();
  const coachMode = useGameStore((s) => s.coachMode);
  const toggle = useGameStore((s) => s.toggleCoachMode);
  return (
    <button
      onClick={() => { play('click'); toggle(); }}
      title="Teaching mode — explanations on every card"
      className={`rounded-xl px-2.5 py-2 text-sm shadow-piece transition active:scale-95 flex items-center gap-1.5 font-display font-semibold ${coachMode ? 'bg-income text-card ring-2 ring-income' : 'bg-felt-700 text-card ring-1 ring-card/20'}`}
    >
      <CoachMascot mood="happy" size={18} /><span className="hidden sm:inline font-display">{coachMode ? t('coach.on') : t('coach.off')}</span>
    </button>
  );
}

export function CoachStyleToggle() {
  const [style, toggle] = useCoachStyle();
  return (
    <button onClick={() => { play('click'); toggle(); }} title={`Coach look: ${style} (tap to switch)`} className="rounded-xl bg-felt-700 hover:bg-felt-600 px-2 py-1.5 shadow-piece transition active:scale-95 grid place-items-center" aria-label="Switch coach look">
      <CoachMascot mood="happy" size={22} />
    </button>
  );
}

export function MuteToggle() {
  const [muted, toggle] = useMute();
  return (
    <button onClick={toggle} title={muted ? 'Unmute' : 'Mute'} className="rounded-xl bg-felt-700 hover:bg-felt-600 text-card px-2.5 py-2 text-sm shadow-piece transition active:scale-95" aria-label={muted ? 'Unmute' : 'Mute'}>
      {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
    </button>
  );
}

export function MenuItem({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={() => { play('click'); onClick(); }} className={`w-full text-left px-4 py-2.5 text-sm hover:bg-card-edge transition ${danger ? 'text-expense-ink' : 'text-ink'}`}>{children}</button>
  );
}

/** EN / हिंदी switch — the most prominent way to change language. */
export function LanguageToggle() {
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);
  return (
    <div className="flex items-center rounded-xl bg-felt-700 shadow-piece overflow-hidden ring-1 ring-card/20" role="group" aria-label="Language">
      {LANGS.map((l) => (
        <button
          key={l.id}
          onClick={() => { play('click'); setLang(l.id); }}
          aria-pressed={lang === l.id}
          className={`px-2.5 py-2 text-sm font-display font-semibold transition active:scale-95 ${lang === l.id ? 'bg-brass-500 text-wood-900' : 'text-card hover:bg-felt-600'}`}
        >
          {l.short}
        </button>
      ))}
    </div>
  );
}

// ============================================================
// Progression UI — level badge
// ============================================================
export function LevelBadge() {
  const state = useGameStore((s) => s.state)!;
  const { rank, next, progress } = rankFor(state);
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-felt-900/60 ring-1 ring-brass/40 pl-1 pr-2 py-0.5" title={next ? `${Math.round(progress * 100)}% to ${next.label}` : 'Top rank'}>
      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-brass-500 text-wood-900 text-[9px] font-bold">{rank.index + 1}</span>
      <span className="text-card font-display text-xs font-semibold whitespace-nowrap">{rank.label}</span>
    </span>
  );
}
