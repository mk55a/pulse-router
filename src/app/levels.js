// The level list (data/levels.json) and which level the player is on.
// Levels are numbered 1..N in play order; each has a stable id used for saved stars.
import { readJSON, writeJSON } from './saves.js';

export function createLevels(data) {
  if (!data || !Array.isArray(data.levels) || !Array.isArray(data.order) || !data.order.length) throw new Error('Invalid level data');
  const byId = new Map(data.levels.map(l => [l.id, Object.freeze({ ...l })]));
  if (byId.size !== data.levels.length) throw new Error('Duplicate level id');
  for (const id of data.order) if (!byId.has(id)) throw new Error(`Level order names unknown id "${id}"`);
  const order = Object.freeze([...data.order]);
  return Object.freeze({
    order,
    count: order.length,
    get(n) { const level = byId.get(order[n - 1]); if (!level) throw new Error(`No level ${n}`); return level; },
    next(n) { return n < order.length ? n + 1 : null }
  });
}

// Current level, saved as { version: 1, level }. Older saves also had pending/completed fields;
// only `level` is read.
export function createCurrentLevel(levels, gameId) {
  const key = `${gameId}_level_save`;
  const saved = readJSON(key, null);
  let level = Number.isSafeInteger(saved?.level) && saved.level >= 1 && saved.level <= levels.count ? saved.level : 1;
  const save = () => writeJSON(key, { version: 1, level });
  return {
    get: () => level,
    set(n) { if (!Number.isSafeInteger(n) || n < 1 || n > levels.count) throw new Error('Invalid level'); level = n; save(); },
    reset() { level = 1; save(); }
  };
}
