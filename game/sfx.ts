"use client";

// Sound effects, made on the spot with the Web Audio API (no sound files): each effect is a few short tones and bursts
// of noise. They follow the same sound switch and volume as the music. Browsers only let sound start after a click or
// tap, so the audio context is made on first use and resumed if it was suspended.
import { useAudioStore } from "./audio";

export type SfxName =
  | "hit" // an enemy is hurt
  | "hurt" // one of ours is hurt
  | "block" // the shield took the blow
  | "heal"
  | "shield"
  | "attach" // an energy card stuck on a character
  | "draw" // a card drawn
  | "cast" // a skill is used
  | "down" // one of ours falls
  | "enemyDown"
  | "victory"
  | "defeat";

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

interface Tone {
  type?: OscillatorType;
  freq: number;
  /** The pitch glides to this by the end. */
  to?: number;
  at?: number;
  dur: number;
  gain: number;
}

/** One tone with a quick attack and a fading tail. */
function tone(c: AudioContext, out: AudioNode, { type = "sine", freq, to, at = 0, dur, gain }: Tone) {
  const t0 = c.currentTime + at;
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(env).connect(out);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

interface Burst {
  filter: BiquadFilterType;
  freq: number;
  to?: number;
  at?: number;
  dur: number;
  gain: number;
}

/** A burst of filtered noise: a thud, a swish, a click. */
function burst(c: AudioContext, out: AudioNode, { filter, freq, to, at = 0, dur, gain }: Burst) {
  noise ??= (() => {
    const buf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  })();
  const t0 = c.currentTime + at;
  const src = c.createBufferSource();
  src.buffer = noise;
  const f = c.createBiquadFilter();
  f.type = filter;
  f.frequency.setValueAtTime(freq, t0);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + 0.006);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(env).connect(out);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

type Recipe = (c: AudioContext, out: AudioNode) => void;

/** What each effect is made of. Change a number here to retune a sound. */
const RECIPES: Record<SfxName, Recipe> = {
  hit: (c, o) => {
    burst(c, o, { filter: "lowpass", freq: 1800, to: 400, dur: 0.14, gain: 0.5 });
    tone(c, o, { freq: 170, to: 50, dur: 0.16, gain: 0.7 });
  },
  hurt: (c, o) => {
    burst(c, o, { filter: "lowpass", freq: 900, to: 300, dur: 0.12, gain: 0.35 });
    tone(c, o, { type: "sawtooth", freq: 240, to: 90, dur: 0.24, gain: 0.25 });
  },
  block: (c, o) => {
    tone(c, o, { type: "triangle", freq: 1200, dur: 0.09, gain: 0.3 });
    tone(c, o, { type: "triangle", freq: 1800, at: 0.02, dur: 0.14, gain: 0.2 });
    burst(c, o, { filter: "highpass", freq: 3000, dur: 0.04, gain: 0.2 });
  },
  heal: (c, o) => {
    [523.25, 659.25, 783.99].forEach((f, i) => tone(c, o, { freq: f, at: i * 0.09, dur: 0.4, gain: 0.22 }));
  },
  shield: (c, o) => {
    tone(c, o, { type: "triangle", freq: 660, to: 990, dur: 0.2, gain: 0.3 });
    tone(c, o, { freq: 1320, at: 0.05, dur: 0.22, gain: 0.15 });
  },
  attach: (c, o) => {
    burst(c, o, { filter: "highpass", freq: 3000, dur: 0.04, gain: 0.3 });
    tone(c, o, { type: "square", freq: 440, to: 520, dur: 0.07, gain: 0.1 });
  },
  draw: (c, o) => burst(c, o, { filter: "bandpass", freq: 1500, to: 3500, dur: 0.1, gain: 0.25 }),
  cast: (c, o) => {
    burst(c, o, { filter: "bandpass", freq: 400, to: 2400, dur: 0.28, gain: 0.25 });
    tone(c, o, { freq: 880, to: 1760, dur: 0.28, gain: 0.12 });
  },
  down: (c, o) => tone(c, o, { type: "sawtooth", freq: 330, to: 60, dur: 0.5, gain: 0.3 }),
  enemyDown: (c, o) => {
    tone(c, o, { type: "sawtooth", freq: 200, to: 40, dur: 0.7, gain: 0.35 });
    burst(c, o, { filter: "lowpass", freq: 500, to: 120, dur: 0.45, gain: 0.3 });
  },
  victory: (c, o) => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      tone(c, o, { freq: f, at: i * 0.14, dur: 0.45, gain: 0.2 });
      tone(c, o, { type: "triangle", freq: f / 2, at: i * 0.14, dur: 0.45, gain: 0.12 });
    });
  },
  defeat: (c, o) => {
    [440, 349.23, 293.66, 220].forEach((f, i) => tone(c, o, { type: "triangle", freq: f, at: i * 0.22, dur: 0.55, gain: 0.25 }));
  },
};

/** Plays an effect now (nothing when the sound is switched off). */
export function playSfx(name: SfxName) {
  const { muted, volume } = useAudioStore.getState();
  if (muted) return;
  const c = context();
  if (!c) return;
  const master = c.createGain();
  master.gain.value = Math.min(1, volume * 1.6);
  master.connect(c.destination);
  try {
    RECIPES[name](c, master);
  } catch {
    // A sound that fails must never break the game.
  }
}

/** Plays several effects a moment apart, so a turn full of events does not become one smear of sound. */
export function playSfxSequence(names: SfxName[], gapMs = 90) {
  names.forEach((n, i) => (i === 0 ? playSfx(n) : void window.setTimeout(() => playSfx(n), i * gapMs)));
}
