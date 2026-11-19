#!/usr/bin/env node
// Pulse Router — writes the synthesised sound effects (src/game/sounds.js) as WAV files into
// assets/Audio/pulse/.
//   node tools/gen_sounds.mjs
//   Without Node: open tools/gen_sounds.html through tools/serve.ps1 (same output).
import { buildSounds, encodeWav } from '../src/game/sounds.js';
export { RATE, CHIME_SETS, chimeName, tickName, buildSounds, encodeWav } from '../src/game/sounds.js';
if (typeof process !== 'undefined' && process.argv?.[1]) {
  const { fileURLToPath } = await import('node:url');
  if (fileURLToPath(import.meta.url) === process.argv[1]) {
    const { mkdirSync, writeFileSync } = await import('node:fs');
    const out = new URL('../assets/Audio/pulse/', import.meta.url);
    mkdirSync(out, { recursive: true });
    const sounds = buildSounds();
    for (const [name, samples] of Object.entries(sounds)) writeFileSync(new URL(name + '.wav', out), encodeWav(samples));
    console.log(`Wrote ${Object.keys(sounds).length} sounds to assets/Audio/pulse/`);
  }
}
