// Sound effects through one Web Audio graph. Browsers only allow audio after a user gesture,
// so the context is created on the first tap or key press; sounds are fetched and decoded on
// first use (and warmed in the background after unlocking). Silent when sound is turned off.
export function createAudio({ baseUrl, names, isEnabled = () => true }) {
  let ctx = null, master = null;
  const buffers = new Map(), pending = new Map(), holds = new Set();

  function ensure() {
    if (ctx) return ctx;
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    return ctx;
  }
  function load(name) {
    if (buffers.has(name)) return Promise.resolve(buffers.get(name));
    if (pending.has(name)) return pending.get(name);
    const job = fetch(new URL(`${name}.wav`, baseUrl))
      .then(r => { if (!r.ok) throw new Error(`Sound ${name}: ${r.status}`); return r.arrayBuffer(); })
      .then(data => ctx.decodeAudioData(data))
      .then(buffer => { buffers.set(name, buffer); pending.delete(name); return buffer; })
      .catch(error => { pending.delete(name); console.warn(error.message); return null; });
    pending.set(name, job);
    return job;
  }
  function warm() {
    // Decode everything a few at a time, so the first chimes of a level are never late.
    const queue = [...names];
    const next = () => { const name = queue.shift(); if (name) load(name).then(next); };
    for (let i = 0; i < 4; i++) next();
  }
  function unlock() {
    const c = ensure(); if (!c) return;
    if (c.state === 'suspended' && !holds.size) c.resume().catch(() => {});
    if (!unlock.done) { unlock.done = true; warm(); }
  }
  const onGesture = () => unlock();
  globalThis.addEventListener('pointerdown', onGesture, true);
  globalThis.addEventListener('keydown', onGesture, true);

  return {
    unlock,
    play(name, { volume = 1 } = {}) {
      if (!isEnabled() || !ctx || ctx.state !== 'running') return;
      const start = buffer => {
        if (!buffer || !isEnabled()) return;
        const src = ctx.createBufferSource(), gain = ctx.createGain();
        src.buffer = buffer; gain.gain.value = volume;
        src.connect(gain).connect(master); src.start();
      };
      const ready = buffers.get(name);
      if (ready) start(ready); else load(name).then(start);
    },
    // Independent reasons (hidden tab, ...) can each hold audio silent.
    hold(reason) { holds.add(reason); ctx?.suspend().catch(() => {}); },
    release(reason) { holds.delete(reason); if (!holds.size && ctx?.state === 'suspended') ctx.resume().catch(() => {}); },
    dispose() {
      globalThis.removeEventListener('pointerdown', onGesture, true);
      globalThis.removeEventListener('keydown', onGesture, true);
      ctx?.close().catch(() => {});
    }
  };
}
