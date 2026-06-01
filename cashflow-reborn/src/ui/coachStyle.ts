import { useEffect, useState } from 'react';

export type CoachStyle = 'coin' | 'owl';
const KEY = 'cashflow-reborn:coachStyle';

let style: CoachStyle = (typeof localStorage !== 'undefined' && (localStorage.getItem(KEY) as CoachStyle)) || 'coin';
const subs = new Set<(s: CoachStyle) => void>();

export function getCoachStyle(): CoachStyle {
  return style;
}
export function setCoachStyle(s: CoachStyle): void {
  style = s;
  if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, s);
  subs.forEach((f) => f(s));
}
export function useCoachStyle(): [CoachStyle, () => void] {
  const [s, set] = useState(style);
  useEffect(() => {
    const fn = (v: CoachStyle) => set(v);
    subs.add(fn);
    return () => { subs.delete(fn); };
  }, []);
  return [s, () => setCoachStyle(getCoachStyle() === 'coin' ? 'owl' : 'coin')];
}
