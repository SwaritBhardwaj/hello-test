import { useCoachStyle } from '../coachStyle';

export type CoachMood = 'happy' | 'worried';

/** The coach companion mascot — renders as a brass coin face or a wise owl,
 *  per the user's chosen style. Reacts to mood. */
export function CoachMascot({ mood, size = 28 }: { mood: CoachMood; size?: number }) {
  const [style] = useCoachStyle();
  return style === 'owl' ? <OwlFace mood={mood} size={size} /> : <CoinFace mood={mood} size={size} />;
}

function CoinFace({ mood, size }: { mood: CoachMood; size: number }) {
  return (
    <svg viewBox="0 0 28 28" width={size} height={size} role="img" aria-label={`coach ${mood}`} className="shrink-0">
      <circle cx="14" cy="14" r="12.5" fill="oklch(0.82 0.11 84)" stroke="oklch(0.62 0.12 78)" strokeWidth="1.5" />
      <circle cx="14" cy="14" r="10" fill="none" stroke="oklch(0.62 0.12 78 / 0.5)" strokeWidth="0.8" />
      <circle cx="10" cy="12" r="1.6" fill="oklch(0.30 0.04 60)" />
      <circle cx="18" cy="12" r="1.6" fill="oklch(0.30 0.04 60)" />
      {mood === 'happy'
        ? <path d="M9 17 Q14 21 19 17" fill="none" stroke="oklch(0.30 0.04 60)" strokeWidth="1.6" strokeLinecap="round" />
        : <path d="M9 19 Q14 16 19 19" fill="none" stroke="oklch(0.30 0.04 60)" strokeWidth="1.6" strokeLinecap="round" />}
    </svg>
  );
}

function OwlFace({ mood, size }: { mood: CoachMood; size: number }) {
  const brow = mood === 'worried';
  return (
    <svg viewBox="0 0 28 28" width={size} height={size} role="img" aria-label={`coach owl ${mood}`} className="shrink-0">
      {/* body */}
      <path d="M14 2 C7 2 4 7 4 13 C4 21 9 26 14 26 C19 26 24 21 24 13 C24 7 21 2 14 2 Z" fill="oklch(0.50 0.06 62)" stroke="oklch(0.36 0.05 58)" strokeWidth="1" />
      {/* ear tufts */}
      <path d="M6 4 L8 9 L4 8 Z" fill="oklch(0.42 0.06 62)" />
      <path d="M22 4 L20 9 L24 8 Z" fill="oklch(0.42 0.06 62)" />
      {/* eye discs */}
      <circle cx="10" cy="12" r="4.4" fill="oklch(0.95 0.04 88)" stroke="oklch(0.62 0.12 78)" strokeWidth="1" />
      <circle cx="18" cy="12" r="4.4" fill="oklch(0.95 0.04 88)" stroke="oklch(0.62 0.12 78)" strokeWidth="1" />
      <circle cx="10.4" cy="12.2" r="1.7" fill="oklch(0.27 0.03 60)" />
      <circle cx="17.6" cy="12.2" r="1.7" fill="oklch(0.27 0.03 60)" />
      {/* beak */}
      <path d="M14 14 l2 2.4 -2 1.2 -2 -1.2 Z" fill="oklch(0.78 0.12 84)" />
      {/* brow reacts to mood */}
      {brow
        ? <><path d="M6.5 8.5 L13 10.5" stroke="oklch(0.30 0.04 60)" strokeWidth="1.3" strokeLinecap="round" /><path d="M21.5 8.5 L15 10.5" stroke="oklch(0.30 0.04 60)" strokeWidth="1.3" strokeLinecap="round" /></>
        : <><path d="M6.5 9.5 L13 8.5" stroke="oklch(0.36 0.05 58)" strokeWidth="1.1" strokeLinecap="round" /><path d="M21.5 9.5 L15 8.5" stroke="oklch(0.36 0.05 58)" strokeWidth="1.1" strokeLinecap="round" /></>}
    </svg>
  );
}
