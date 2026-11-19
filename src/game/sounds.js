// Pulse Router — sound synthesis (original, no third-party audio). Every effect is generated from
// code at 22.05 kHz mono. The game ships these as WAV files made by tools/gen_sounds.mjs; the
// playable ad calls buildSounds() at load instead, so it carries no audio files at all.
// Deterministic: noise uses a seeded generator, so the same sounds come out every time.
export const RATE = 22050;
const TAU = Math.PI * 2;
const note = semis => 523.25 * Math.pow(2, semis / 12); // relative to C5
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26]; // C major pentatonic

function mulberry32(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function fade(s) {
  // 4 ms fade in/out to avoid clicks.
  const n = s.length, f = Math.round(0.004 * RATE);
  for (let i = 0; i < f; i++) { s[i] *= i / f; s[n - 1 - i] *= i / f; }
  return s;
}
function render(seconds, fn) {
  const n = Math.round(seconds * RATE), s = new Float32Array(n);
  for (let i = 0; i < n; i++) s[i] = fn(i / RATE, i / n);
  return fade(s);
}
function normalise(s, peak) {
  let max = 0; for (const v of s) max = Math.max(max, Math.abs(v));
  if (max > 0) for (let i = 0; i < s.length; i++) s[i] *= peak / max;
  return s;
}

// Node chime sets, one per circuit skin (see src/game/skins.js). Eight notes up the pentatonic
// scale, so lighting nodes in a row still climbs. Classic keeps the original names.
const CHIMES = {
  // Bell partials.
  classic: f => render(0.55, t => (Math.sin(TAU * f * t) * 0.45 + Math.sin(TAU * f * 2.76 * t) * 0.15 + Math.sin(TAU * f * 5.4 * t) * 0.06) * Math.exp(-t * 6) * 0.65),
  // Plucked string (Karplus-Strong) an octave lower, with a little crackle at the attack.
  ember: (f, i) => {
    const rng = mulberry32(1000 + i), n = Math.round(0.6 * RATE), out = new Float32Array(n);
    const period = Math.max(2, Math.round(RATE / (f / 2))), line = Float32Array.from({ length: period }, () => rng() * 2 - 1);
    for (let k = 0; k < n; k++) {
      const j = k % period, next = (j + 1) % period;
      out[k] = line[j];
      line[j] = (line[j] + line[next]) * 0.5 * 0.996;
      const t = k / RATE;
      if (t < 0.12 && rng() < 0.012) out[k] += (rng() * 2 - 1) * 0.8 * (1 - t / 0.12);
    }
    return normalise(fade(out), 0.45);
  },
  // Soft glass: slow attack, detuned pair and a shimmer partial, long tail.
  aurora: f => normalise(render(0.9, t => {
    const env = (1 - Math.exp(-t * 40)) * Math.exp(-t * 3.4);
    return (Math.sin(TAU * f * t) + Math.sin(TAU * f * 1.0045 * t) * 0.8 + Math.sin(TAU * f * 2 * t) * 0.25 + Math.sin(TAU * f * 3.01 * t) * 0.08 * Math.sin(TAU * 5 * t)) * env;
  }), 0.4),
  // FM zap: bright modulation that collapses into a pure tone, with a small pitch drop.
  plasma: f => normalise(render(0.5, t => {
    const index = 4.5 * Math.exp(-t * 14), bend = 1 + 0.06 * Math.exp(-t * 30);
    return Math.sin(TAU * f * bend * t + index * Math.sin(TAU * f * 2 * t)) * Math.exp(-t * 8);
  }), 0.43),
  // Brassy: stacked harmonics gliding up into the note.
  solar: f => normalise(render(0.6, t => {
    const g = f * (0.94 + 0.06 * Math.min(1, t / 0.04));
    let s = 0; for (let h = 1; h <= 6; h++) s += Math.sin(TAU * g * h * t) / h;
    return s * Math.min(1, t / 0.008) * Math.exp(-t * 5);
  }), 0.38),
  // Deep swell: sub-octave sine with an inharmonic metallic edge.
  void: f => normalise(render(0.9, t => {
    const env = (1 - Math.exp(-t * 18)) * Math.exp(-t * 3);
    return (Math.sin(TAU * f / 2 * t) + Math.sin(TAU * f * t) * 0.5 + Math.sin(TAU * f * 2.41 * t) * 0.18 * Math.exp(-t * 6) + Math.sin(TAU * f / 4 * t) * 0.3) * env;
  }), 0.46)
};
export const CHIME_SETS = Object.keys(CHIMES);
export const chimeName = (set, i) => set === 'classic' ? `pr_chime_${i}` : `pr_chime_${set}_${i}`;

// Pulse ticks per circuit skin: the short note on every tile the pulse passes, twelve steps up
// the pentatonic scale. Same timbre family as the skin's chime, much shorter, so a fast run
// reads as one rising phrase. Classic keeps the original tick.
const TICK_SETS = {
  classic: f => render(0.11, t => (Math.sin(TAU * f * t) * 0.5 + Math.sin(TAU * f * 2 * t) * 0.12) * Math.exp(-t * 32) * 0.7),
  // Tiny pluck with a spark of noise on the attack.
  ember: (f, i) => {
    const rng = mulberry32(2000 + i), n = Math.round(0.1 * RATE), out = new Float32Array(n);
    const period = Math.max(2, Math.round(RATE / f)), line = Float32Array.from({ length: period }, () => rng() * 2 - 1);
    for (let k = 0; k < n; k++) {
      const j = k % period;
      out[k] = line[j] + (k < 0.006 * RATE ? (rng() * 2 - 1) * 0.6 : 0);
      line[j] = (line[j] + line[(j + 1) % period]) * 0.5 * 0.985;
    }
    return normalise(fade(out), 0.34);
  },
  // Glassy tap with a slight detune.
  aurora: f => normalise(render(0.14, t => (Math.sin(TAU * f * t) + Math.sin(TAU * f * 1.006 * t) * 0.7 + Math.sin(TAU * f * 2 * t) * 0.2) * Math.min(1, t / 0.005) * Math.exp(-t * 26)), 0.33),
  // FM blip.
  plasma: f => normalise(render(0.08, t => Math.sin(TAU * f * t + 3 * Math.exp(-t * 60) * Math.sin(TAU * f * 3 * t)) * Math.exp(-t * 45)), 0.34),
  // Bright harmonic blip that snaps up into the note.
  solar: f => normalise(render(0.1, t => {
    const g = f * (0.9 + 0.1 * Math.min(1, t / 0.015));
    let s = 0; for (let h = 1; h <= 5; h++) s += Math.sin(TAU * g * h * t) / h;
    return s * Math.exp(-t * 38);
  }), 0.34),
  // Low thump: an octave down with a quick pitch drop.
  void: f => normalise(render(0.12, t => {
    const g = f / 2 * (1 + 0.35 * Math.exp(-t * 50));
    return (Math.sin(TAU * g * t) + Math.sin(TAU * g * 2.41 * t) * 0.12) * Math.exp(-t * 30);
  }), 0.36)
};
export const tickName = (set, i) => set === 'classic' ? `pr_tick_${i}` : `pr_tick_${set}_${i}`;

export function buildSounds() {
  const sounds = {};
  // Ticks climbing the pentatonic scale: Classic is also the path-drawing tick.
  for (const [set, make] of Object.entries(TICK_SETS)) PENTA.forEach((semi, i) => { sounds[tickName(set, i)] = make(note(semi), i); });
  for (const [set, make] of Object.entries(CHIMES)) PENTA.slice(0, 8).forEach((semi, i) => { sounds[chimeName(set, i)] = make(note(semi + 12), i); });
  // Low, dull refusal tick.
  sounds.pr_refuse = render(0.09, t => (Math.sin(TAU * 140 * t) * 0.6 + Math.sin(TAU * 95 * t) * 0.3) * Math.exp(-t * 45) * 0.8);
  // Soft click when touching the Source.
  sounds.pr_touch = render(0.06, t => Math.sin(TAU * 880 * t) * Math.exp(-t * 70) * 0.45);
  // Pulse fire: short rising hum.
  sounds.pr_fire = render(0.35, (t, p) => { const f = 220 + 440 * p * p; return (Math.sin(TAU * f * t) * 0.35 + Math.sin(TAU * f * 1.5 * t) * 0.12) * Math.sin(Math.PI * p) * 0.8; });
  // Failure: falling tone with the glow fading, not a buzzer.
  sounds.pr_fail = render(0.7, (t, p) => { const f = 520 * Math.pow(0.35, p); return (Math.sin(TAU * f * t) * 0.45 + Math.sin(TAU * f * 0.5 * t) * 0.15) * (1 - p) * 0.75; });
  // Win: resolving chord (C, E, G, C) arpeggiated into a sustain.
  sounds.pr_win = render(1.3, t => {
    let s = 0;
    [0, 4, 7, 12].forEach((semi, i) => { const start = i * 0.07; if (t >= start) s += Math.sin(TAU * note(semi) * (t - start)) * Math.exp(-(t - start) * 2.2) * 0.22; });
    return s;
  });
  // Interface sounds: menu click, toggle, dialog popup, win flourish, result-card reveal.
  sounds.pr_ui_click = render(0.05, t => (Math.sin(TAU * 1180 * t) * 0.6 + Math.sin(TAU * 2360 * t) * 0.15) * Math.exp(-t * 90) * 0.5);
  sounds.pr_ui_toggle = render(0.13, t => { const f = t < 0.05 ? 880 : 1320; return Math.sin(TAU * f * t) * Math.exp(-((t < 0.05 ? t : t - 0.05)) * 45) * 0.42; });
  sounds.pr_ui_popup = render(0.2, (t, p) => Math.sin(TAU * (520 + 420 * p) * t) * Math.sin(Math.PI * p) * 0.38);
  sounds.pr_ui_flourish = render(0.7, t => {
    let s = 0;
    [12, 16, 19, 24].forEach((semi, i) => { const start = i * 0.06; if (t >= start) { const u = t - start, f = note(semi); s += (Math.sin(TAU * f * u) + Math.sin(TAU * f * 2.76 * u) * 0.2) * Math.exp(-u * 7) * 0.16; } });
    return s;
  });
  sounds.pr_ui_reveal = render(0.9, t => {
    const env = (1 - Math.exp(-t * 14)) * Math.exp(-t * 3.2);
    return (Math.sin(TAU * note(0) * t) + Math.sin(TAU * note(7) * t) * 0.7 + Math.sin(TAU * note(16) * t) * 0.45) * env * 0.2;
  });
  // Exit rejection flash.
  sounds.pr_locked = render(0.3, t => (Math.sin(TAU * 330 * t) * 0.4 + Math.sin(TAU * 311 * t) * 0.4) * Math.exp(-t * 9) * 0.7);
  return sounds;
}

// 16-bit PCM mono WAV.
export function encodeWav(samples) {
  const bytes = new Uint8Array(44 + samples.length * 2), v = new DataView(bytes.buffer);
  const text = (o, s) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  text(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); text(8, 'WAVE');
  text(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, RATE, true); v.setUint32(28, RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  text(36, 'data'); v.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 32767 | 0, true));
  return bytes;
}
