// Circuit skins: pulse colour, Source shape, a pulse effect and a node chime set. Unlocked by
// total stars earned (nothing is spent, so rank never drops). Shared by the board scene, gameplay
// and the Circuits screen.
// source: ring | hex | triangle | diamond | star | double
// burst (per tile the pulse enters): none | spark | ring; hueShift: colour drifts along the run.
// chimes / ticks: sound name prefixes, followed by 0–7 / 0–11 (made by tools/gen_sounds.mjs).
// Ticks play as the pulse passes each tile; drawing the path always uses the Classic tick.
export const SKINS = Object.freeze([
  Object.freeze({ id: 'classic', name: 'Classic', stars: 0, accent: '#65e7ff', head: '#dffaff', source: 'ring', burst: 'none', chimes: 'pr_chime_', ticks: 'pr_tick_', sound: 'Glass bell', effect: 'Clean cyan current' }),
  Object.freeze({ id: 'ember', name: 'Ember', stars: 12, accent: '#ff8a3d', head: '#ffe2b8', source: 'hex', burst: 'spark', chimes: 'pr_chime_ember_', ticks: 'pr_tick_ember_', sound: 'Crackling pluck', effect: 'Sparks fly off every tile' }),
  Object.freeze({ id: 'aurora', name: 'Aurora', stars: 30, accent: '#4dffb0', head: '#e6fff3', source: 'triangle', burst: 'none', hueShift: true, chimes: 'pr_chime_aurora_', ticks: 'pr_tick_aurora_', sound: 'Shimmering glass', effect: 'Colour drifts along the run' }),
  Object.freeze({ id: 'plasma', name: 'Plasma', stars: 50, accent: '#ff5ad8', head: '#ffe0f7', source: 'diamond', burst: 'ring', chimes: 'pr_chime_plasma_', ticks: 'pr_tick_plasma_', sound: 'Electric zap', effect: 'A ring bursts from each tile' }),
  Object.freeze({ id: 'solar', name: 'Solar', stars: 75, accent: '#ffd36b', head: '#fff6d9', source: 'star', burst: 'spark', headScale: 1.7, chimes: 'pr_chime_solar_', ticks: 'pr_tick_solar_', sound: 'Bright brass', effect: 'A blazing head and sparks' }),
  Object.freeze({ id: 'void', name: 'Void', stars: 100, accent: '#b38bff', head: '#ffffff', source: 'double', burst: 'ring', hueShift: true, headScale: 1.3, chimes: 'pr_chime_void_', ticks: 'pr_tick_void_', sound: 'Deep swell', effect: 'Rings and shifting light' })
]);

// unlockAll: development testing only (see circuitsUnlockedForTesting).
export const isUnlocked = (skin, totalStars, unlockAll = false) => unlockAll || totalStars >= skin.stars;

// The equipped skin if it is still unlocked, otherwise Classic.
export function resolveSkin(id, totalStars, unlockAll = false) {
  const skin = SKINS.find(s => s.id === id);
  return skin && isUnlocked(skin, totalStars, unlockAll) ? skin : SKINS[0];
}

export const totalStars = levels => Object.values(levels ?? {}).reduce((sum, e) => sum + (e?.stars ?? 0), 0);

// Every circuit is open while testing, but never in a release: packaging switches
// environment to "production", which turns this off even if the flag is left on.
export const circuitsUnlockedForTesting = config => config?.environment === 'development' && config?.testing?.unlockAllCircuits === true;
