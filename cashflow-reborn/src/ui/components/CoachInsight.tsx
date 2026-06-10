import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useGameStore } from '../store';
import { useT } from '../lang';
import { pickLesson } from '@/modules/coach/wisdom';
import { CoachMascot } from '../art/Coach';

// ============================================================
// Coach insight
// ============================================================
export function CoachInsight() {
  const { t } = useT();
  const coachMode = useGameStore((s) => s.coachMode);
  const state = useGameStore((s) => s.state);
  const log = useGameStore((s) => s.decisionLog);
  const [open, setOpen] = useState(false);

  // Pure function of (state, log): the pick is stable within a render, so this
  // can never loop. (It used to feed a "recently shown" list back into itself,
  // which white-screened the app once >6 lessons applied. See wisdom.ts.)
  const picked = useMemo(() => {
    if (!coachMode || !state) return null;
    return pickLesson(state, log);
  }, [coachMode, state, log]);

  if (!coachMode || !picked) return null;
  const { lesson } = picked;
  const mood = lesson.tag === 'debt' || lesson.tag === 'risk' ? 'worried' : 'happy';

  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="paper rounded-game shadow-card ring-1 ring-card-edge overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-2.5 px-3 py-2 text-left">
        <div className="shrink-0"><CoachMascot mood={mood} size={30} /></div>
        <div className="min-w-0 flex-1">
          <div className="text-2xs uppercase tracking-widest font-display text-brass-600">{t('coach.label')}</div>
          <div className="text-sm text-ink leading-snug line-clamp-2">{lesson.lesson}</div>
        </div>
        <ChevronDown size={16} className={`shrink-0 text-ink-faint transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-3 pb-3 pt-1 border-t border-card-edge">
              <div className="text-sm italic text-ink leading-snug">"{lesson.quote}"</div>
              <div className="mt-1.5 text-xs text-ink-soft font-medium">— {lesson.attribution}{lesson.book ? ` · ${lesson.book}` : ''}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
