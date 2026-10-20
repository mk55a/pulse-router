// Best stars and Clean Pulse per level id. Gameplay writes it through context.saves;
// the level select reads the same slot read-only (it lives outside the gameplay runtime).
// Version 2: levels were regenerated (2026-10-20), so version 1 stars no longer match their boards.
export const PROGRESS_SLOT = Object.freeze({
  name: 'progress',
  version: 2,
  defaults: () => ({ levels: {} }),
  // reached: furthest level number opened so far, so replaying an early level never re-locks later ones.
  validate: v => !!v && typeof v.levels === 'object' && v.levels !== null && !Array.isArray(v.levels) &&
    (v.reached === undefined || (Number.isSafeInteger(v.reached) && v.reached >= 1)) &&
    // seen: rule cards already shown (see RULE_CARDS in worlds.js).
    (v.seen === undefined || (Array.isArray(v.seen) && v.seen.every(s => typeof s === 'string'))) &&
    Object.values(v.levels).every(e => Number.isInteger(e?.stars) && e.stars >= 1 && e.stars <= 3 && typeof e.clean === 'boolean'),
  migrate: () => ({ levels: {} })
});

// Same storage key and envelope as src/app/saves.js.
export function readProgress(gameId, storage = globalThis.localStorage) {
  try {
    const envelope = JSON.parse(storage.getItem(`${gameId}_game_${PROGRESS_SLOT.name}`));
    if (envelope?.version === PROGRESS_SLOT.version && PROGRESS_SLOT.validate(envelope.data)) return envelope.data;
  } catch {}
  return PROGRESS_SLOT.defaults();
}
