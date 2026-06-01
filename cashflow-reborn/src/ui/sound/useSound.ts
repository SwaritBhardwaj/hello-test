import { useEffect, useState } from 'react';
import { isMuted, setMuted, subscribeMute } from './sound';

/** Reactive mute state bound to the sound engine. */
export function useMute(): [boolean, () => void] {
  const [muted, setLocal] = useState(isMuted());
  useEffect(() => subscribeMute(setLocal), []);
  return [muted, () => setMuted(!isMuted())];
}
