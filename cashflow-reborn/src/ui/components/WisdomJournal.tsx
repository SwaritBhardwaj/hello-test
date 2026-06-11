import { useMemo, useSyncExternalStore } from 'react';
import { motion } from 'framer-motion';
import { X, Lock } from 'lucide-react';
import { WISDOM, type CoachLesson } from '@/modules/coach/wisdom';
import { seenLessons, journalStats, subscribeJournal, journalVersion } from '@/modules/coach/journal';
import { useCoachStyle, setCoachStyle, availableStyles, type CoachStyle } from '../coachStyle';
import { CoachMascot } from '../art/Coach';
import { ModalShell } from './primitives';
import { play } from '../sound/sound';

// ============================================================
// Wisdom Journal — every lesson in the library, grouped by author.
// Lessons the coach has actually shown are unlocked; the rest tease
// the player to keep playing. Also hosts the coach style picker.
// ============================================================

const STYLE_LABELS: Record<CoachStyle, string> = { buddy: 'Buddy', coin: 'Coin', owl: 'Owl' };
const STYLES: { id: CoachStyle; label: string }[] = availableStyles().map((id) => ({ id, label: STYLE_LABELS[id] }));

export function WisdomJournal({ onClose }: { onClose: () => void }) {
  // Re-render when a new lesson is recorded while the modal is open.
  const version = useSyncExternalStore(subscribeJournal, journalVersion, journalVersion);
  const seen = useMemo(() => new Set(seenLessons()), [version]);
  const { seen: collected, total } = journalStats();
  const [style] = useCoachStyle();

  const groups = useMemo(() => {
    const map = new Map<string, CoachLesson[]>();
    for (const l of WISDOM) {
      const list = map.get(l.attribution);
      if (list) list.push(l);
      else map.set(l.attribution, [l]);
    }
    return [...map.entries()];
  }, []);

  return (
    <ModalShell onClose={onClose} labelledBy="journal-title">
      <motion.div
        initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="paper w-full sm:max-w-lg max-h-[88dvh] sm:rounded-game rounded-t-game shadow-card ring-1 ring-card-edge overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="bg-wood-900 text-card px-4 sm:px-5 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <CoachMascot mood="happy" size={30} />
            <div className="min-w-0">
              <div id="journal-title" className="font-display text-lg leading-tight truncate">
                Wisdom Journal — {collected}/{total} collected
              </div>
              <div className="text-2xs text-card/70">Lessons the coach has shared with you</div>
            </div>
          </div>
          <button onClick={onClose} className="grid place-items-center hover:bg-felt-700 w-9 h-9 rounded-lg shrink-0" aria-label="Close journal">
            <X size={22} />
          </button>
        </div>

        {/* coach style picker */}
        <div className="px-4 sm:px-5 py-2.5 border-b border-card-edge flex items-center justify-between gap-3 bg-card">
          <div className="text-sm font-display text-ink-soft">Coach look</div>
          <div className="flex items-center gap-1.5" role="group" aria-label="Coach look">
            {STYLES.map((s) => (
              <button
                key={s.id}
                onClick={() => { play('click'); setCoachStyle(s.id); }}
                aria-pressed={style === s.id}
                className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-sm font-display font-semibold transition active:scale-95 ${style === s.id ? 'bg-brass-500 text-wood-900 shadow-piece' : 'bg-card ring-1 ring-card-edge text-ink-soft hover:bg-card-edge/50'}`}
              >
                <CoachMascot mood="happy" size={22} styleOverride={s.id} />
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* lesson list */}
        <div className="overflow-y-auto px-4 sm:px-5 py-3 space-y-4">
          {groups.map(([attribution, lessons]) => (
            <section key={attribution}>
              <h3 className="text-2xs uppercase tracking-widest font-display text-brass-600 mb-1.5">
                {attribution}
                <span className="ml-2 normal-case tracking-normal text-ink-faint font-sans font-normal">
                  {lessons.filter((l) => seen.has(l.id)).length}/{lessons.length}
                </span>
              </h3>
              <div className="space-y-1.5">
                {lessons.map((l) => (seen.has(l.id) ? <UnlockedRow key={l.id} lesson={l} /> : <LockedRow key={l.id} lesson={l} />))}
              </div>
            </section>
          ))}
        </div>
      </motion.div>
    </ModalShell>
  );
}

function TagChip({ tag }: { tag: CoachLesson['tag'] }) {
  return (
    <span className="inline-block rounded-full bg-card-edge text-ink-soft text-2xs px-2 py-0.5 font-semibold uppercase tracking-wide shrink-0">
      {tag}
    </span>
  );
}

function UnlockedRow({ lesson }: { lesson: CoachLesson }) {
  return (
    <div className="rounded-xl ring-1 ring-card-edge bg-card px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm italic text-ink leading-snug">{lesson.quote}</div>
        <TagChip tag={lesson.tag} />
      </div>
      <div className="mt-1.5 text-sm text-ink-soft leading-snug">{lesson.lesson}</div>
      {lesson.book && <div className="mt-1.5 text-xs text-brass-600 font-medium">📖 {lesson.book}</div>}
    </div>
  );
}

function LockedRow({ lesson }: { lesson: CoachLesson }) {
  return (
    <div className="rounded-xl ring-1 ring-card-edge bg-card-edge/40 px-3 py-2.5 opacity-70">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Lock size={14} className="text-ink-faint shrink-0" />
          <span className="text-sm font-display text-ink-soft truncate">{lesson.attribution}</span>
        </div>
        <TagChip tag={lesson.tag} />
      </div>
      <div className="mt-1 text-xs text-ink-faint blur-[2px] select-none" aria-hidden>
        {lesson.quote.slice(0, 60)}…
      </div>
      <div className="mt-1 text-2xs text-ink-faint font-semibold uppercase tracking-wide">Keep playing to unlock</div>
    </div>
  );
}
