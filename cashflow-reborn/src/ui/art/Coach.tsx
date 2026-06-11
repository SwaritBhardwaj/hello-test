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
  if (which === 'owl') return <OwlFace mood={mood} size={size} />;
  if (which === 'buddy') return <BuddyFace mood={mood} size={size} />;
  return <CoinFace mood={mood} size={size} />;
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

// Buddy palette — a silver-haired mentor in brass spectacles.
const SKIN = 'oklch(0.80 0.07 62)';
const SKIN_EDGE = 'oklch(0.62 0.08 58)';
const SILVER = 'oklch(0.86 0.012 80)';
const SILVER_EDGE = 'oklch(0.66 0.015 75)';
const FACE_INK = 'oklch(0.30 0.04 50)';
const KURTA = 'oklch(0.93 0.04 88)';
const VEST = 'oklch(0.74 0.13 80)';
const VEST_EDGE = 'oklch(0.58 0.12 76)';
const LENS = 'oklch(0.97 0.02 88 / 0.45)';

/** "Buddy" — the v2 illustrated mentor: a silver-haired financial coach with
 *  round brass spectacles and a mustache. Same 5-mood contract as the others. */
function BuddyFace({ mood, size }: { mood: CoachMood; size: number }) {
  const browWorry = mood === 'worried' || mood === 'facepalm';
  return (
    <svg viewBox="0 0 28 28" width={size} height={size} role="img" aria-label={`coach buddy ${mood}`} className="shrink-0">
      {/* celebrate: both arms thrown up */}
      {mood === 'celebrate' && (
        <>
          <path d="M5.6 21 Q2.4 17 3.4 11.6" fill="none" stroke={SKIN_EDGE} strokeWidth="2.4" strokeLinecap="round" />
          <path d="M22.4 21 Q25.6 17 24.6 11.6" fill="none" stroke={SKIN_EDGE} strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="3.4" cy="11" r="1.7" fill={SKIN} stroke={SKIN_EDGE} strokeWidth="0.8" />
          <circle cx="24.6" cy="11" r="1.7" fill={SKIN} stroke={SKIN_EDGE} strokeWidth="0.8" />
        </>
      )}
      {/* happy: one hand raised in a wave */}
      {mood === 'happy' && (
        <>
          <path d="M22.6 22 Q25.4 19.4 24.8 14.8" fill="none" stroke={SKIN_EDGE} strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="24.8" cy="14.2" r="1.6" fill={SKIN} stroke={SKIN_EDGE} strokeWidth="0.8" />
        </>
      )}
      {/* shoulders — brass vest over a cream kurta */}
      <path d="M4.5 28 C4.5 23 8.5 20.4 14 20.4 C19.5 20.4 23.5 23 23.5 28 Z" fill={VEST} stroke={VEST_EDGE} strokeWidth="1" />
      <path d="M10.8 21 C11.8 23 16.2 23 17.2 21 L16.8 27.4 L11.2 27.4 Z" fill={KURTA} stroke={VEST_EDGE} strokeWidth="0.6" />
      {/* head */}
      <circle cx="14" cy="12" r="7.9" fill={SKIN} stroke={SKIN_EDGE} strokeWidth="1.1" />
      {/* ears */}
      <circle cx="6.3" cy="12.6" r="1.4" fill={SKIN} stroke={SKIN_EDGE} strokeWidth="0.8" />
      <circle cx="21.7" cy="12.6" r="1.4" fill={SKIN} stroke={SKIN_EDGE} strokeWidth="0.8" />
      {/* silver hair — combed back, high forehead; side tufts over the ears */}
      <path d="M6.5 10.2 C6.3 5.6 9.8 3.4 14 3.4 C18.2 3.4 21.7 5.6 21.5 10.2 C20.2 7.2 17.8 6.2 14 6.2 C10.2 6.2 7.8 7.2 6.5 10.2 Z" fill={SILVER} stroke={SILVER_EDGE} strokeWidth="0.6" />
      <path d="M5.9 10.2 Q5.4 12.2 6.3 13.8 Q7.4 12 7.4 9.6 Z" fill={SILVER} />
      <path d="M22.1 10.2 Q22.6 12.2 21.7 13.8 Q20.6 12 20.6 9.6 Z" fill={SILVER} />
      {/* brows — silver, above the spectacles */}
      {browWorry ? (
        <>
          <path d="M8.4 8.9 L11.9 9.9" stroke={SILVER_EDGE} strokeWidth="1.3" strokeLinecap="round" />
          <path d="M19.6 8.9 L16.1 9.9" stroke={SILVER_EDGE} strokeWidth="1.3" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M8.6 9.3 Q10.2 8.5 11.8 9.3" fill="none" stroke={SILVER_EDGE} strokeWidth="1.2" strokeLinecap="round" />
          <path d="M16.2 9.3 Q17.8 8.5 19.4 9.3" fill="none" stroke={SILVER_EDGE} strokeWidth="1.2" strokeLinecap="round" />
        </>
      )}
      {/* round brass spectacles */}
      <circle cx="10.3" cy="12.2" r="2.9" fill={LENS} stroke={BRASS_EDGE} strokeWidth="1" />
      <circle cx="17.7" cy="12.2" r="2.9" fill={LENS} stroke={BRASS_EDGE} strokeWidth="1" />
      <path d="M13.2 12 Q14 11.3 14.8 12" fill="none" stroke={BRASS_EDGE} strokeWidth="1" />
      <path d="M7.4 11.9 L6.4 11.7 M20.6 11.9 L21.6 11.7" stroke={BRASS_EDGE} strokeWidth="0.9" strokeLinecap="round" />
      {/* eyes behind the lenses */}
      {mood === 'celebrate' ? (
        <>
          <path d="M9 12.5 Q10.3 11.2 11.6 12.5" fill="none" stroke={FACE_INK} strokeWidth="1.3" strokeLinecap="round" />
          <path d="M16.4 12.5 Q17.7 11.2 19 12.5" fill="none" stroke={FACE_INK} strokeWidth="1.3" strokeLinecap="round" />
        </>
      ) : mood === 'facepalm' ? (
        <path d="M9.2 12.3 L11.5 12.3" stroke={FACE_INK} strokeWidth="1.2" strokeLinecap="round" />
      ) : mood === 'idle' ? (
        <>
          <BlinkEye cx={10.3} cy={12.3} r={1.1} fill={FACE_INK} />
          <BlinkEye cx={17.7} cy={12.3} r={1.1} fill={FACE_INK} />
        </>
      ) : (
        <>
          <circle cx="10.3" cy="12.3" r="1.1" fill={FACE_INK} />
          <circle cx="17.7" cy="12.3" r="1.1" fill={FACE_INK} />
        </>
      )}
      {/* nose + silver mustache */}
      <path d="M13.5 14.6 Q14 15.2 14.5 14.6" fill="none" stroke={SKIN_EDGE} strokeWidth="0.8" strokeLinecap="round" />
      <path d="M10.7 16.1 Q12.3 14.9 14 15.7 Q15.7 14.9 17.3 16.1 Q15.7 17.1 14 16.7 Q12.3 17.1 10.7 16.1 Z" fill={SILVER} stroke={SILVER_EDGE} strokeWidth="0.5" />
      {/* mouth — peeks out under the mustache */}
      {mood === 'happy' && <path d="M11.4 17.8 Q14 19.7 16.6 17.8" fill="none" stroke={FACE_INK} strokeWidth="1.3" strokeLinecap="round" />}
      {mood === 'idle' && <path d="M11.8 18 Q14 19.1 16.2 18" fill="none" stroke={FACE_INK} strokeWidth="1.2" strokeLinecap="round" />}
      {mood === 'worried' && <path d="M11.6 19.1 Q14 17.7 16.4 19.1" fill="none" stroke={FACE_INK} strokeWidth="1.3" strokeLinecap="round" />}
      {mood === 'celebrate' && <path d="M11.4 17.4 Q14 20.8 16.6 17.4 Q14 18.4 11.4 17.4 Z" fill={FACE_INK} />}
      {mood === 'facepalm' && <path d="M11.8 19.1 Q14 17.9 16.2 19.1" fill="none" stroke={FACE_INK} strokeWidth="1.3" strokeLinecap="round" />}
      {/* facepalm: hand over the right lens */}
      {mood === 'facepalm' && (
        <g transform="rotate(-14 17.8 11.8)">
          <ellipse cx="18" cy="11.6" rx="4.1" ry="3" fill={SKIN} stroke={SKIN_EDGE} strokeWidth="0.9" />
          <path d="M15.3 10.3 L20.7 10.3 M15.1 11.6 L21 11.6 M15.5 12.9 L20.5 12.9" stroke={SKIN_EDGE} strokeWidth="0.55" strokeLinecap="round" opacity="0.7" />
        </g>
      )}
      {/* celebrate: sparkles */}
      {mood === 'celebrate' && (
        <>
          <Sparkle cx={4} cy={4.4} r={2} />
          <Sparkle cx={24.4} cy={3.6} r={1.6} />
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
