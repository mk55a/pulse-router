// Runs gameplay for one level at a time. Gameplay is a set of hooks (init, start, update,
// fixedUpdate, pause, resume, finish, stop, dispose) and receives a context with the services
// it may use. A level ends only through `complete()`; failed pulses never leave the board.
// Pausing is by reason (settings open, tab hidden ...): play resumes when no reason is left.
import { createLoop } from './loop.js';
import { createInput } from './input.js';
import { createSceneHost } from './scene.js';

export function createSession({ createGameplay, container, services, onComplete, onError }) {
  let state = 'idle'; // idle | playing | done
  const holds = new Set();
  const playing = () => state === 'playing' && holds.size === 0;
  const input = createInput({ isActive: playing });
  const scenes = createSceneHost(container, { onError: fail });
  const loop = createLoop({
    frame(dt) { if (playing()) call('update', dt); scenes.update(dt); },
    fixed(dt) { if (playing()) { call('fixedUpdate', dt); scenes.fixedUpdate(dt); } },
    onError: fail
  });
  const gameplay = createGameplay({
    ...services, container, input, scenes,
    isPlaying: playing,
    complete() {
      if (state !== 'playing') return;
      state = 'done';
      input.clear(); scenes.setPaused(true);
      call('finish', 'complete');
      onComplete();
    },
    reportError: error => queueMicrotask(() => fail(error))
  });
  function call(hook, ...args) { return gameplay[hook]?.(...args); }
  function fail(error) { loop.stop(); input.clear(); scenes.setPaused(true); state = 'idle'; onError(error); }
  function refreshPause(wasPlaying) {
    const now = playing();
    scenes.setPaused(!now);
    if (wasPlaying === now) return;
    input.clear(); loop.resetClock();
    if (state === 'playing') call(now ? 'resume' : 'pause');
  }
  call('init');
  loop.start();

  return {
    start(details) {
      if (state !== 'idle') call('stop');
      state = 'playing';
      scenes.setPaused(holds.size > 0);
      try { call('start', details); } catch (error) { fail(error); return; }
      if (holds.size) call('pause');
    },
    // Leave the level (quit to Home, or before starting another).
    stop() { if (state === 'idle') return; call('stop'); state = 'idle'; input.clear(); scenes.setPaused(true); },
    hold(reason) { const was = playing(); holds.add(reason); refreshPause(was); },
    release(reason) { const was = playing(); holds.delete(reason); refreshPause(was); },
    get state() { return state; },
    dispose() { loop.stop(); call('dispose'); scenes.dispose(); input.dispose(); }
  };
}
