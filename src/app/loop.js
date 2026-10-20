// The single animation loop. `frame` runs once per display frame; `fixed` runs in whole 1/60 s
// steps (catching up after a slow frame, but never more than a quarter second at once), so the
// pulse moves the same on every device.
const STEP = 1 / 60, MAX_CATCH_UP = 0.25;

export function createLoop({ frame = () => {}, fixed = () => {}, onError = console.error }) {
  let raf = 0, last = 0, carry = 0, running = false;
  function tick(now) {
    raf = requestAnimationFrame(tick);
    const dt = last ? Math.min(MAX_CATCH_UP, (now - last) / 1000) : 0;
    last = now;
    try {
      carry += dt;
      while (carry >= STEP) { fixed(STEP); carry -= STEP; }
      frame(dt);
    } catch (error) { stop(); onError(error); }
  }
  function start() { if (running) return; running = true; last = 0; carry = 0; raf = requestAnimationFrame(tick); }
  function stop() { running = false; cancelAnimationFrame(raf); }
  return { start, stop, get running() { return running; }, resetClock() { last = 0; carry = 0; } };
}
