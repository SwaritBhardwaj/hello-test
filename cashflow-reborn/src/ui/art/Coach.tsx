import { useCoachStyle, type CoachStyle } from '../coachStyle';

export type CoachMood = 'idle' | 'happy' | 'worried' | 'celebrate' | 'facepalm';

const INK = 'oklch(0.30 0.04 60)';
const BRASS = 'oklch(0.82 0.11 84)';
const BRASS_EDGE = 'oklch(0.62 0.12 78)';
const BRASS_LIGHT = 'oklch(0.88 0.09 88)';
const OWL_BODY = 'oklch(0.50 0.06 62)';
const OWL_EDGE = 'oklch(0.36 0.05 58)';
const OWL_DARK = 'oklch(0.42 0.06 62)';
const OWL_INK = 'oklch(0.27 0.03 60)';
const CREAM = 'oklch(0.95 0.04 88)';

/** The coach companion mascot — renders as a brass coin face or a wise owl,
 *  per the user's chosen style (or an explicit override). Reacts to mood:
 *  'idle' (neutral with periodic blink), 'happy', 'worried',
 *  'celebrate' (arms up + star burst + open smile), 'facepalm'. */
export function CoachMascot({ mood, size = 28, styleOverride }: { mood: CoachMood; size?: number; styleOverride?: CoachStyle }) {
  const [style] = useCoachStyle();
  const which = styleOverride ?? style;
  return which === 'owl' ? <OwlFace mood={mood} size={size} /> : <CoinFace mood={mood} size={size} />;
}

/** A round eye that periodically blinks (SMIL — no CSS needed). */
function BlinkEye({ cx, cy, r = 1.6, fill = INK }: { cx: number; cy: number; r?: number; fill?: string }) {
  return (
    <ellipse cx={cx} cy={cy} rx={r} ry={r} fill={fill}>
      <animate attributeName="ry" values={`${r};${r};0.15;${r};${r}`} keyTimes="0;0.9;0.94;0.98;1" dur="4.4s" repeatCount="indefinite" />
    </ellipse>
  );
}

/** Four-point star sparkle for the celebrate burst. */
function Sparkle({ cx, cy, r = 2 }: { cx: number; cy: number; r?: number }) {
  const k = r * 0.32;
  return (
    <path
      d={`M${cx} ${cy - r} L${cx + k} ${cy - k} L${cx + r} ${cy} L${cx + k} ${cy + k} L${cx} ${cy + r} L${cx - k} ${cy + k} L${cx - r} ${cy} L${cx - k} ${cy - k} Z`}
      fill={BRASS_LIGHT} stroke={BRASS_EDGE} strokeWidth="0.5"
    >
      <animate attributeName="opacity" values="1;0.4;1" dur="1.2s" repeatCount="indefinite" />
    </path>
  );
}

function CoinFace({ mood, size }: { mood: CoachMood; size: number }) {
  return (
    <svg viewBox="0 0 28 28" width={size} height={size} role="img" aria-label={`coach ${mood}`} className="shrink-0">
      {/* celebrate: arms thrown up along the rim */}
      {mood === 'celebrate' && (
        <>
          <path d="M4.4 10 L1.6 4.9" stroke={BRASS_EDGE} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M23.6 10 L26.4 4.9" stroke={BRASS_EDGE} strokeWidth="2.2" strokeLinecap="round" />
        </>
      )}
      <circle cx="14" cy="14" r="12.5" fill={BRASS} stroke={BRASS_EDGE} strokeWidth="1.5" />
      <circle cx="14" cy="14" r="10" fill="none" stroke="oklch(0.62 0.12 78 / 0.5)" strokeWidth="0.8" />

      {/* eyes */}
      {mood === 'celebrate' ? (
        <>
          <path d="M8.2 12.4 Q10 10.3 11.8 12.4" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
          <path d="M16.2 12.4 Q18 10.3 19.8 12.4" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
        </>
      ) : mood === 'facepalm' ? (
        // left eye squeezed shut; right eye hides behind the hand
        <path d="M8.4 12.2 L11.6 12.2" stroke={INK} strokeWidth="1.5" strokeLinecap="round" />
      ) : mood === 'idle' ? (
        <>
          <BlinkEye cx={10} cy={12} />
          <BlinkEye cx={18} cy={12} />
        </>
      ) : (
        <>
          <circle cx="10" cy="12" r="1.6" fill={INK} />
          <circle cx="18" cy="12" r="1.6" fill={INK} />
        </>
      )}

      {/* mouth */}
      {mood === 'happy' && <path d="M9 17 Q14 21 19 17" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />}
      {mood === 'idle' && <path d="M9.5 17.3 Q14 19.8 18.5 17.3" fill="none" stroke={INK} strokeWidth="1.5" strokeLinecap="round" />}
      {mood === 'worried' && <path d="M9 19 Q14 16 19 19" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />}
      {mood === 'celebrate' && <path d="M9.5 16.2 Q14 22.8 18.5 16.2 Q14 17.6 9.5 16.2 Z" fill={INK} />}
      {mood === 'facepalm' && <path d="M10 20.2 Q14 17.6 18 20.2" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />}

      {/* facepalm: hand over the right side of the face */}
      {mood === 'facepalm' && (
        <g transform="rotate(-16 17.5 11.5)">
          <ellipse cx="17.6" cy="11.2" rx="4.7" ry="3.5" fill={BRASS_LIGHT} stroke={BRASS_EDGE} strokeWidth="1" />
          <path d="M14.4 9.7 L20.8 9.7 M14.1 11.2 L21.1 11.2 M14.5 12.7 L20.7 12.7" stroke="oklch(0.62 0.12 78 / 0.55)" strokeWidth="0.6" strokeLinecap="round" />
        </g>
      )}

      {/* celebrate: star burst */}
      {mood === 'celebrate' && (
        <>
          <Sparkle cx={4.3} cy={3.4} r={2.2} />
          <Sparkle cx={23.8} cy={2.9} r={1.7} />
          <Sparkle cx={26.1} cy={13.4} r={1.3} />
        </>
      )}
    </svg>
  );
}

function OwlFace({ mood, size }: { mood: CoachMood; size: number }) {
  const brow = mood === 'worried' || mood === 'facepalm';
  return (
    <svg viewBox="0 0 28 28" width={size} height={size} role="img" aria-label={`coach owl ${mood}`} className="shrink-0">
      {/* celebrate: wings raised */}
      {mood === 'celebrate' && (
        <>
          <path d="M5 15 Q1.4 11.5 2.6 5.8" fill="none" stroke={OWL_DARK} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M23 15 Q26.6 11.5 25.4 5.8" fill="none" stroke={OWL_DARK} strokeWidth="2.6" strokeLinecap="round" />
        </>
      )}
      {/* body */}
      <path d="M14 2 C7 2 4 7 4 13 C4 21 9 26 14 26 C19 26 24 21 24 13 C24 7 21 2 14 2 Z" fill={OWL_BODY} stroke={OWL_EDGE} strokeWidth="1" />
      {/* ear tufts */}
      <path d="M6 4 L8 9 L4 8 Z" fill={OWL_DARK} />
      <path d="M22 4 L20 9 L24 8 Z" fill={OWL_DARK} />
      {/* eye discs */}
      <circle cx="10" cy="12" r="4.4" fill={CREAM} stroke={BRASS_EDGE} strokeWidth="1" />
      <circle cx="18" cy="12" r="4.4" fill={CREAM} stroke={BRASS_EDGE} strokeWidth="1" />
      {/* pupils per mood */}
      {mood === 'celebrate' ? (
        <>
          <path d="M8.3 12.6 Q10.4 10.4 12.5 12.6" fill="none" stroke={OWL_INK} strokeWidth="1.6" strokeLinecap="round" />
          <path d="M15.5 12.6 Q17.6 10.4 19.7 12.6" fill="none" stroke={OWL_INK} strokeWidth="1.6" strokeLinecap="round" />
        </>
      ) : mood === 'facepalm' ? (
        // left eye squeezed shut; right eye hides behind the wing
        <path d="M8.6 12.2 L12.2 12.2" stroke={OWL_INK} strokeWidth="1.5" strokeLinecap="round" />
      ) : mood === 'idle' ? (
        <>
          <BlinkEye cx={10.4} cy={12.2} r={1.7} fill={OWL_INK} />
          <BlinkEye cx={17.6} cy={12.2} r={1.7} fill={OWL_INK} />
        </>
      ) : (
        <>
          <circle cx="10.4" cy="12.2" r="1.7" fill={OWL_INK} />
          <circle cx="17.6" cy="12.2" r="1.7" fill={OWL_INK} />
        </>
      )}
      {/* beak — open when celebrating */}
      {mood === 'celebrate'
        ? <path d="M14 14.5 l2.6 2.6 -2.6 2.4 -2.6 -2.4 Z" fill="oklch(0.78 0.12 84)" stroke={OWL_EDGE} strokeWidth="0.5" />
        : <path d="M14 14 l2 2.4 -2 1.2 -2 -1.2 Z" fill="oklch(0.78 0.12 84)" />}
      {/* brow reacts to mood */}
      {brow
        ? <><path d="M6.5 8.5 L13 10.5" stroke={INK} strokeWidth="1.3" strokeLinecap="round" /><path d="M21.5 8.5 L15 10.5" stroke={INK} strokeWidth="1.3" strokeLinecap="round" /></>
        : <><path d="M6.5 9.5 L13 8.5" stroke={OWL_EDGE} strokeWidth="1.1" strokeLinecap="round" /><path d="M21.5 9.5 L15 8.5" stroke={OWL_EDGE} strokeWidth="1.1" strokeLinecap="round" /></>}
      {/* facepalm: wing over the face */}
      {mood === 'facepalm' && (
        <g transform="rotate(-14 18 11.5)">
          <ellipse cx="18.2" cy="11.4" rx="5" ry="3.7" fill={OWL_DARK} stroke={OWL_EDGE} strokeWidth="1" />
          <path d="M14.6 10 Q18.2 9 21.8 10 M14.4 11.6 Q18.2 10.7 22 11.6 M14.8 13.2 Q18.2 12.4 21.6 13.2" fill="none" stroke="oklch(0.36 0.05 58 / 0.7)" strokeWidth="0.6" />
        </g>
      )}
      {/* celebrate: star burst */}
      {mood === 'celebrate' && (
        <>
          <Sparkle cx={3.4} cy={2.8} r={2} />
          <Sparkle cx={25} cy={2.6} r={1.6} />
        </>
      )}
    </svg>
  );
}
