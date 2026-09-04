/**
 * Lightweight WebAudio sound manager — no audio files needed.
 *
 * - One shared AudioContext, created/resumed only after a user gesture
 *   (respects browser autoplay policies).
 * - Tiny oscillator/noise blips: roll, step, capture, finish, win, invalid.
 * - Mute persisted in localStorage; no per-render allocations.
 */

"use client";

const MUTE_KEY = "dna_sound_muted";

let ctx: AudioContext | null = null;
let muted = typeof window !== "undefined" && window.localStorage.getItem(MUTE_KEY) === "1";
let unlocked = false;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch {
      return null;
    }
  }
  return ctx;
}

/** Call from a user gesture (tap/click) to satisfy autoplay policies. */
export function unlockAudio(): void {
  const c = ac();
  if (!c) return;
  if (c.state === "suspended") void c.resume().catch(() => {});
  unlocked = true;
}

export function isSoundMuted(): boolean {
  return muted;
}

export function setSoundMuted(value: boolean): void {
  muted = value;
  try {
    window.localStorage.setItem(MUTE_KEY, value ? "1" : "0");
  } catch {
    /* storage unavailable */
  }
}

function tone(
  freq: number,
  dur: number,
  opts: { type?: OscillatorType; gain?: number; delay?: number; slideTo?: number } = {}
): void {
  if (muted || !unlocked) return;
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + (opts.delay ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + dur);
  const vol = opts.gain ?? 0.05;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

export const sfx = {
  /** Dice rattle: a few quick pips. */
  roll(): void {
    for (let i = 0; i < 5; i++) tone(700 + Math.random() * 500, 0.05, { type: "triangle", gain: 0.03, delay: i * 0.055 });
  },
  /** Soft tick while a piece steps to the next cell. */
  step(): void {
    tone(1250, 0.035, { type: "sine", gain: 0.022 });
  },
  /** Landing bounce thud. */
  land(): void {
    tone(240, 0.07, { type: "sine", gain: 0.04, slideTo: 130 });
  },
  /** Capture: descending gliss. */
  capture(): void {
    tone(720, 0.16, { type: "sawtooth", gain: 0.03, slideTo: 170 });
  },
  /** A piece reached home: bright two-note. */
  finish(): void {
    tone(660, 0.09, { type: "triangle", gain: 0.045 });
    tone(990, 0.14, { type: "triangle", gain: 0.045, delay: 0.09 });
  },
  /** Win: little arpeggio. */
  win(): void {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, { type: "triangle", gain: 0.05, delay: i * 0.12 }));
  },
  /** Invalid action buzz. */
  invalid(): void {
    tone(160, 0.12, { type: "square", gain: 0.025, slideTo: 110 });
  },
};
