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
import { WisdomJournal } from './WisdomJournal';
import { journalStats } from '@/modules/coach/journal';

// ============================================================
// HUD bar — identity + money pills + controls, edge-docked & high-contrast
// ============================================================
export function HudBar({ onOpenSheet }: { onOpenSheet: () => void }) {
  const { t } = useT();
  const state = useGameStore((s) => s.state)!;
  const ff = useGameStore((s) => s.fastForward);
  const reset = useGameStore((s) => s.reset);
  const coachMode = useGameStore((s) => s.coachMode);
  const toggleCoach = useGameStore((s) => s.toggleCoachMode);
  const [muted, toggleMute] = useMute();
  const [menuOpen, setMenuOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const js = journalStats();

  return (
    <header className="flex items-center justify-between gap-2 flex-wrap">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Pawn size={26} />
        <div className="min-w-0 flex-1">
          <div className="font-display text-base sm:text-lg text-card leading-none truncate">{state.player.name}</div>
          <div className="mt-1"><LevelBadge /></div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 order-3 sm:order-2 w-full sm:w-auto justify-between sm:justify-end mt-1 sm:mt-0">
        <MoneyPill label={t('hud.netWorth')} value={state.statement.netWorth} tone={state.statement.netWorth >= 0 ? 'income' : 'expense'} />
        <MoneyPill label={t('hud.cash')} value={state.cashOnHand} coin tone={state.cashOnHand < 0 ? 'expense' : 'brass'} />
        <MoneyPill label={t('hud.cashflow')} value={state.statement.totalIncome - state.statement.totalExpenses} signed tone={state.statement.totalIncome - state.statement.totalExpenses >= 0 ? 'income' : 'expense'} />
      </div>
      <div className="flex items-center gap-1.5 order-2 sm:order-3">
        <button onClick={() => { play('click'); onOpenSheet(); }} className="btn-3d bg-brass-500 enabled:hover:bg-brass-600 text-wood-900 px-3 py-1.5 text-sm whitespace-nowrap">
          <span className="hidden sm:inline">{t('hud.balanceSheet')}</span><span className="sm:hidden">{t('hud.sheet')}</span>
        </button>
        <div className="relative">
          <button onClick={() => setMenuOpen((o) => !o)} className="rounded-xl bg-felt-700 hover:bg-felt-600 text-card px-3 py-2 text-sm shadow-piece transition active:scale-95" aria-label="More actions" aria-expanded={menuOpen}><MoreHorizontal size={20} /></button>
          <AnimatePresence>
            {menuOpen && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="absolute right-0 mt-2 w-56 paper rounded-xl shadow-card ring-1 ring-card-edge z-30 overflow-hidden">
                {/* Settings rows — moved out of the header to declutter it */}
                <div className="px-4 py-2.5 flex items-center justify-between gap-2 border-b border-card-edge">
                  <span className="text-sm text-ink font-semibold">Language</span>
                  <LanguageToggle />
                </div>
                <MenuToggleRow
                  label={t('coach.label')}
                  on={coachMode}
                  icon={<CoachMascot mood="happy" size={18} />}
                  onClick={() => toggleCoach()}
                />
                <MenuToggleRow
                  label="Sound"
                  on={!muted}
                  icon={muted ? <VolumeX size={16} className="text-ink-soft" /> : <Volume2 size={16} className="text-ink" />}
                  onClick={() => toggleMute()}
                />
                <div className="border-b border-card-edge" />
                <MenuItem onClick={() => { setJournalOpen(true); setMenuOpen(false); }}>{`Wisdom Journal (${js.seen}/${js.total})`}</MenuItem>
                <MenuItem onClick={() => { ff(12); setMenuOpen(false); }}>{t('menu.skip1y')}</MenuItem>
                <MenuItem onClick={() => { ff(60); setMenuOpen(false); }}>{t('menu.skip5y')}</MenuItem>
                <MenuItem danger onClick={() => { reset(); setMenuOpen(false); }}>{t('menu.newGame')}</MenuItem>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <AnimatePresence>{journalOpen && <WisdomJournal key="journal" onClose={() => setJournalOpen(false)} />}</AnimatePresence>
    </header>
  );
}

/** Labeled on/off row used inside the ⋯ menu (coach, sound). */
export function MenuToggleRow({ label, on, icon, onClick }: { label: string; on: boolean; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={() => { play('click'); onClick(); }}
      role="switch" aria-checked={on}
      className="w-full px-4 py-2.5 flex items-center justify-between gap-2 border-b border-card-edge hover:bg-card-edge transition text-left"
    >
      <span className="flex items-center gap-2 text-sm text-ink font-semibold">{icon}{label}</span>
      <span className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition ${on ? 'bg-income' : 'bg-ink-faint/40 ring-1 ring-card-edge'}`} aria-hidden>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-card shadow-piece transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
    </button>
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
    <div className="inline-flex flex-col gap-1 rounded-xl bg-felt-900/60 ring-1 ring-brass/40 pl-1.5 pr-2.5 py-1 max-w-full min-w-0" title={next ? `${Math.round(progress * 100)}% to ${next.label}` : 'Top rank'}>
      <span className="inline-flex items-center gap-1.5 min-w-0">
        <span className="inline-flex shrink-0 items-center justify-center w-4 h-4 rounded-full bg-brass-500 text-wood-900 text-[9px] font-bold">{rank.index + 1}</span>
        <span className="text-card font-display text-xs font-semibold whitespace-nowrap truncate min-w-0">{rank.label}</span>
        {next && <span className="text-card/60 font-display whitespace-nowrap shrink-0" style={{ fontSize: 10 }}>→ {next.label}</span>}
      </span>
      {next && (
        <span className="block h-1 w-full rounded-full bg-felt-900 ring-1 ring-brass/25 overflow-hidden" aria-hidden>
          <span className="block h-full rounded-full bg-brass-500 transition-all duration-500" style={{ width: `${Math.max(2, Math.round(progress * 100))}%` }} />
        </span>
      )}
    </div>
  );
}
