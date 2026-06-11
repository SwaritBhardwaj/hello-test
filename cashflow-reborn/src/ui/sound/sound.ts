/**
 * Tiny dependency-free sound engine. Synthesizes short UI sounds with the
 * WebAudio API — no audio files to bundle, works offline. Honours a persisted
 * mute flag.
 */

const MUTE_KEY = 'cashflow-reborn:muted';

export type SoundName = 'dice' | 'coin' | 'card' | 'win' | 'lose' | 'click' | 'unlock' | 'pop';

let ctx: AudioContext | null = null;
let muted = typeof localStorage !== 'undefined' ? localStorage.getItem(MUTE_KEY) === '1' : false;

const listeners = new Set<(m: boolean) => void>();

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  if (typeof localStorage !== 'undefined') localStorage.setItem(MUTE_KEY, value ? '1' : '0');
  listeners.forEach((l) => l(value));
}

export function subscribeMute(fn: (m: boolean) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(
  ac: AudioContext,
  opts: { freq: number; type?: OscillatorType; start: number; dur: number; gain?: number; slideTo?: number },
) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(opts.freq, ac.currentTime + opts.start);
  if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, ac.currentTime + opts.start + opts.dur);
  const peak = opts.gain ?? 0.18;
  g.gain.setValueAtTime(0.0001, ac.currentTime + opts.start);
  g.gain.exponentialRampToValueAtTime(peak, ac.currentTime + opts.start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + opts.start + opts.dur);
  osc.connect(g).connect(ac.destination);
  osc.start(ac.currentTime + opts.start);
  osc.stop(ac.currentTime + opts.start + opts.dur + 0.02);
}

function noiseBurst(ac: AudioContext, start: number, dur: number, gain = 0.12) {
  const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, ac.currentTime + start);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + dur);
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1200;
  src.connect(hp).connect(g).connect(ac.destination);
  src.start(ac.currentTime + start);
}

export function play(name: SoundName): void {
  if (muted) return;
  const ac = audio();
  if (!ac) return;
  switch (name) {
    case 'dice':
      noiseBurst(ac, 0, 0.08, 0.14);
      noiseBurst(ac, 0.1, 0.06, 0.1);
      tone(ac, { freq: 180, type: 'square', start: 0.16, dur: 0.06, gain: 0.06 });
      break;
    case 'coin':
      tone(ac, { freq: 880, type: 'triangle', start: 0, dur: 0.12, gain: 0.14 });
      tone(ac, { freq: 1320, type: 'triangle', start: 0.06, dur: 0.14, gain: 0.1 });
      break;
    case 'card':
      noiseBurst(ac, 0, 0.18, 0.08);
      break;
    case 'win':
      [523, 659, 784, 1047].forEach((f, i) => tone(ac, { freq: f, type: 'triangle', start: i * 0.1, dur: 0.22, gain: 0.16 }));
      break;
    case 'lose':
      tone(ac, { freq: 320, type: 'sawtooth', start: 0, dur: 0.5, gain: 0.14, slideTo: 90 });
      break;
    case 'unlock':
      tone(ac, { freq: 660, type: 'triangle', start: 0, dur: 0.12, gain: 0.14 });
      tone(ac, { freq: 990, type: 'triangle', start: 0.09, dur: 0.18, gain: 0.12 });
      break;
    case 'click':
      tone(ac, { freq: 420, type: 'square', start: 0, dur: 0.04, gain: 0.07 });
      break;
    case 'pop':
      // soft bubble pop — quick upward sine blip
      tone(ac, { freq: 520, type: 'sine', start: 0, dur: 0.09, gain: 0.09, slideTo: 760 });
      break;
  }
}
