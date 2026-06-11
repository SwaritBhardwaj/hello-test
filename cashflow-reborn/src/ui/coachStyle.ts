import { useEffect, useState } from 'react';
import { COACH_FLAGS } from '@/data/coachFlags';

export type CoachStyle = 'coin' | 'owl' | 'buddy';
const KEY = 'cashflow-reborn:coachStyle';

/** Styles currently selectable — 'buddy' rides behind the art-v2 flag. */
export function availableStyles(): CoachStyle[] {
  return COACH_FLAGS.characterArtV2 ? ['buddy', 'coin', 'owl'] : ['coin', 'owl'];
}

function sanitize(s: CoachStyle | null): CoachStyle {
  if (s && availableStyles().includes(s)) return s;
  return COACH_FLAGS.characterArtV2 ? 'buddy' : 'coin';
}

let style: CoachStyle = sanitize(
  typeof localStorage !== 'undefined' ? (localStorage.getItem(KEY) as CoachStyle | null) : null,
);
const subs = new Set<(s: CoachStyle) => void>();

export function getCoachStyle(): CoachStyle {
  return style;
}
export function setCoachStyle(s: CoachStyle): void {
  style = sanitize(s);
  if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, style);
  subs.forEach((f) => f(style));
}
export function useCoachStyle(): [CoachStyle, () => void] {
  const [s, set] = useState(style);
  useEffect(() => {
    const fn = (v: CoachStyle) => set(v);
    subs.add(fn);
    return () => { subs.delete(fn); };
  }, []);
  return [s, () => {
    const all = availableStyles();
    setCoachStyle(all[(all.indexOf(getCoachStyle()) + 1) % all.length]);
  }];
}
