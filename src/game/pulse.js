// Runs a drawn path step by step on the fixed update. Pure logic.
// Outcomes: 'win', 'drained' (out of energy), 'locked' (Node missing at the Exit), 'stalled' (dead end),
// 'overcharged' (exact-energy level reached the Exit with energy left).
import { TILE, tileAt, simulateEnergy, missingNodes } from './board.js';

export function resolveOutcome(board, cells, budget, { exact = false } = {}) {
  const sim = simulateEnergy(board, cells, budget);
  if (sim.diesAt > 0) return { result: 'drained', stopIndex: sim.diesAt - 1, short: sim.short, sim };
  const last = cells[cells.length - 1];
  if (cells.length > 1 && tileAt(board, last[0], last[1]) === TILE.EXIT) {
    const missing = missingNodes(board, cells);
    if (missing.length) return { result: 'locked', stopIndex: cells.length - 1, missing, sim };
    const energyLeft = sim.energy[sim.energy.length - 1];
    if (exact && energyLeft > 0) return { result: 'overcharged', stopIndex: cells.length - 1, energyLeft, sim };
    return { result: 'win', stopIndex: cells.length - 1, used: sim.used, energyLeft, sim };
  }
  return { result: 'stalled', stopIndex: cells.length - 1, sim };
}

// Pulse speed profiles. 'constant' moves at a fixed rate; 'ease' starts slow and accelerates
// along a power curve, so long paths finish in about the same time and the run reads as a
// chain reaction. Its duration grows gently with path length and is capped.
export const PULSE_PROFILES = Object.freeze({
  steady: Object.freeze({ kind: 'constant', tilesPerSecond: 6 }),
  quick: Object.freeze({ kind: 'constant', tilesPerSecond: 14 }),
  chain: Object.freeze({ kind: 'ease', power: 2.2, base: 0.55, perTile: 0.035, max: 1.6 }),
  surge: Object.freeze({ kind: 'ease', power: 3.2, base: 0.4, perTile: 0.025, max: 1.15 })
});

export function pulseDuration(profile, tiles) {
  if (profile.kind === 'constant') return tiles / profile.tilesPerSecond;
  return Math.min(profile.max, profile.base + profile.perTile * tiles);
}

export function createPulseRun(board, cells, budget, { tilesPerSecond = 5, exact = false, profile = null } = {}) {
  const outcome = resolveOutcome(board, cells.map(p => [p[0], p[1]]), budget, { exact });
  const path = cells.map(p => [p[0], p[1]]);
  const shape = profile ?? { kind: 'constant', tilesPerSecond };
  const duration = Math.max(0.05, pulseDuration(shape, outcome.stopIndex));
  let position = 0, entered = 0, done = false, elapsed = 0;
  return {
    outcome, path, duration,
    get position() { return position; },
    get done() { return done; },
    // 0..1 through the run; also the head's current speed relative to its peak.
    get progress() { return outcome.stopIndex ? position / outcome.stopIndex : 1; },
    // Advances the pulse head; returns the indices of tiles entered this step.
    advance(seconds) {
      if (done) return { entered: [], finished: false };
      elapsed += seconds;
      if (shape.kind === 'ease') {
        // A little linear motion so the first tile never hangs, then the curve takes over.
        const u = Math.min(1, elapsed / duration), lead = shape.lead ?? 0.15;
        position = Math.min(outcome.stopIndex, outcome.stopIndex * (lead * u + (1 - lead) * Math.pow(u, shape.power)));
      } else {
        // A stalled pulse slows down over its final tile.
        const slow = outcome.result === 'stalled' && position > outcome.stopIndex - 1 ? 0.45 : 1;
        position = Math.min(outcome.stopIndex, position + seconds * shape.tilesPerSecond * slow);
      }
      const list = [];
      while (entered < Math.floor(position + 1e-9)) list.push(++entered);
      const finished = position >= outcome.stopIndex;
      if (finished) done = true;
      return { entered: list, finished };
    }
  };
}
