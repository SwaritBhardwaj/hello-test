import { motion, AnimatePresence } from 'framer-motion';
import { useT } from '../lang';
import { Die } from '../art/Die';
import { Coin, Pawn } from '../art/Pieces';
import { useProgression } from '../progression';
import { achievementById, type Achievement } from '@/modules/progression/achievements';

// ============================================================
// Progression UI — achievement toasts
// ============================================================
export function AchievementIcon({ icon, size = 22 }: { icon: Achievement['icon']; size?: number }) {
  if (icon === 'coin') return <Coin size={size} />;
  if (icon === 'pawn') return <Pawn size={size} />;
  if (icon === 'die') return <Die value={5} size={size} />;
  // star / shield — simple brass glyphs
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} role="img" aria-hidden className="shrink-0">
      {icon === 'star'
        ? <path d="M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 5.9 20.4l1.4-6.8L2.2 9l6.9-.7z" fill="oklch(0.82 0.11 84)" stroke="oklch(0.62 0.12 78)" strokeWidth="1" strokeLinejoin="round" />
        : <path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5z" fill="oklch(0.82 0.11 84)" stroke="oklch(0.62 0.12 78)" strokeWidth="1" strokeLinejoin="round" />}
    </svg>
  );
}

export function AchievementToasts() {
  const { t: ui } = useT();
  const toasts = useProgression((s) => s.toasts);
  const dismiss = useProgression((s) => s.dismissToast);
  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[70] w-[min(92vw,22rem)] space-y-2 pointer-events-none">
      <AnimatePresence>
        {/* Show at most 2 toasts at once; the rest stay queued in the store and
            surface as visible ones auto-dismiss. */}
        {toasts.slice(0, 2).map((t) => {
          const ach = achievementById(t.achievementId);
          if (!ach) return null;
          return (
            <motion.div
              key={t.uid}
              initial={{ opacity: 0, y: -24, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              onAnimationComplete={() => setTimeout(() => dismiss(t.uid), 3400)}
              className="pointer-events-auto paper rounded-game shadow-card ring-2 ring-brass/60 px-3 py-2 flex items-center gap-3"
            >
              <div className="shrink-0 animate-coin-pop"><AchievementIcon icon={ach.icon} size={28} /></div>
              <div className="min-w-0">
                <div className="text-2xs uppercase tracking-widest text-brass-600 font-display">{ui('ach.unlocked')}</div>
                <div className="font-display text-ink leading-tight">{ach.label}</div>
                <div className="text-2xs text-ink-soft truncate">{ach.description}</div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
