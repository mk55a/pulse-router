// Pulse Router — playable ad template. Straight into play, no menus; what plays is a variant
// (src/playable/variants.js): its levels, skin, hook and end-card copy.
//   ghost levels: the tutorial finger draws the route and taps Pulse; the player copies it;
//   demo levels:  the ad draws and fires a route itself, then a banner hands over to the player;
//   every level:  after two failed pulses, or a few idle seconds, the finger shows the way;
//   end card:     the stars just earned and "Play now".
// The end card also appears at the time limit, so every viewer reaches the call to action.
// Reuses the full game's rules, board, HUD and sounds; nothing is saved between views.
import { createSession } from '../app/session.js';
import { createAudio } from '../app/audio.js';
import { createSaves } from '../app/saves.js';
import { loadThree } from '../app/vendor.js';
import { createGameplay } from '../game/gameplay.js';
import { buildSounds } from '../game/sounds.js';
import { SKINS } from '../game/skins.js';
import { VARIANTS, DEFAULT_VARIANT, STORE_URL } from './variants.js';
import { createAdapter } from './adapter.js';
import { createGhost } from './ghost.js';
import { createEndCard } from './endCard.js';
import { createBanner } from './banner.js';

const TIME_LIMIT = 45;        // seconds on screen before the end card appears regardless
const HINT_AFTER_FAILS = 2;   // failed pulses on a level before the finger shows the way
const IDLE_HINT = 6;          // seconds without touching before the finger reappears
const DEMO_STEP = 0.11;       // seconds per tile while a demo draws its route (fast demos: half)
const GAME_ID = 'pulse-router';

const $ = id => document.getElementById(id);
const app = $('app'), playfield = $('playfield');
const reduceMotion = !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const adapter = createAdapter({ storeUrl: globalThis.PR_STORE_URL || STORE_URL });
const variantId = globalThis.PR_VARIANT || new URLSearchParams(location.search).get('variant') || DEFAULT_VARIANT;
const variant = VARIANTS[variantId] ?? VARIANTS[DEFAULT_VARIANT];
const skin = SKINS.find(s => s.id === variant.skin) ?? SKINS[0];
document.documentElement.style.setProperty('--ad-accent', skin.accent);

// Nothing persists in an ad: saves live in memory, with every rule card already "seen".
const memory = new Map([[`${GAME_ID}_game_progress`, JSON.stringify({ version: 2, data: { levels: {}, seen: ['basics', 'ordered', 'exact'] } })]]);
const storage = { getItem: k => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, String(v)), removeItem: k => memory.delete(k) };

// Sounds are synthesised in the page (no audio files): generated just after load, off the first tap.
const SOUND_NAMES = [
  ...Array.from({ length: 12 }, (_, i) => `pr_tick_${i}`), ...Array.from({ length: 8 }, (_, i) => `pr_chime_${i}`),
  ...Array.from({ length: 12 }, (_, i) => `${skin.ticks}${i}`), ...Array.from({ length: 8 }, (_, i) => `${skin.chimes}${i}`),
  'pr_refuse', 'pr_touch', 'pr_fire', 'pr_fail', 'pr_win', 'pr_locked', 'pr_ui_click', 'pr_ui_flourish'
];
let bank = null;
const sounds = () => (bank ??= buildSounds());
setTimeout(sounds, 200);
const audio = createAudio({ names: [...new Set(SOUND_NAMES)], synth: name => sounds()[name] ?? null });

let levelIndex = 0, fails = 0, lastSummary = null, ended = false, shownAt = 0, lastTouch = 0, current = null, timer = 0;
let demoing = false, demoDone = false, demoTimer = 0, adHidden = false;
const ghost = createGhost(playfield, { reducedMotion: () => reduceMotion });
const banner = createBanner(playfield);
const pulseButton = () => playfield.querySelector('.pr-pulse');
const level = () => variant.levels[levelIndex];
const showGhost = () => current?.solution.length && ghost.show(current.solution, current.screenOf, pulseButton());

const session = createSession({
  createGameplay,
  container: playfield,
  services: {
    config: { environment: 'production', testing: {} },
    skin: skin.id,
    audio: { playSound: name => audio.play(name) },
    saves: createSaves(GAME_ID, storage),
    settings: { get: () => ({ sound: true, reduceMotion, bloom: true, pulseSpeed: 'chain', skin: skin.id }), subscribe: () => () => {} },
    result: { set(summary) { lastSummary = summary; } },
    events: {
      levelShown(info) {
        current = info; lastTouch = performance.now();
        if (level().demo && !demoDone) playDemo(level().demo, info.control);
        else if (level().ghost) showGhost();
      },
      pathChanged(length) { if (length > 1 && !demoing) ghost.hide(); },
      pulseResolved(result) {
        if (demoing) { if (result !== 'win') setTimeout(endDemo, 1300); return; }
        if (result === 'win') return;
        fails++;
        if (fails >= HINT_AFTER_FAILS) showGhost();
      }
    }
  },
  onComplete: levelWon,
  onError: error => { console.error(error); showEnd(); }
});

// The ad draws the demo route tile by tile, fires it, and hands over once the pulse resolves.
function playDemo(demo, control) {
  demoing = true; banner.block(true);
  const step = DEMO_STEP * (demo.fast ? 0.5 : 1) * 1000;
  let i = 1;
  clearInterval(demoTimer);
  demoTimer = setInterval(() => {
    if (ended) { clearInterval(demoTimer); return; }
    if (adHidden) return; // paused with the rest of the ad
    if (i < demo.route.length) { control.step(...demo.route[i++]); return; }
    clearInterval(demoTimer);
    setTimeout(() => !ended && control.pulse(), 250);
  }, step);
}
// A failed demo restarts the same level for the player; a winning one moves on (via levelWon).
function endDemo() {
  if (!demoing || ended) return;
  demoing = false; demoDone = true; banner.block(false);
  banner.show(level().demo.banner);
  startLevel(levelIndex, true);
}

function startLevel(i, keepDemo = false) {
  levelIndex = i; fails = 0; ghost.hide();
  if (!keepDemo) demoDone = false;
  session.start({ mode: 'levels', level: i + 1, definition: variant.levels[i] });
}
function levelWon() {
  ghost.hide();
  if (demoing) {
    demoing = false; banner.block(false);
    banner.show(level().demo.banner);
  }
  if (levelIndex + 1 < variant.levels.length) setTimeout(() => !ended && startLevel(levelIndex + 1), 250);
  else showEnd(lastSummary?.stars ?? 0);
}
function showEnd(stars = 0) {
  if (ended) return;
  ended = true; clearInterval(timer); clearInterval(demoTimer);
  demoing = false; banner.block(false); banner.hide();
  ghost.hide(); session.stop();
  audio.play('pr_ui_flourish');
  endCard.show(stars);
  adapter.finished();
}
const endCard = createEndCard(app, {
  logo: globalThis.PR_LOGO || '../assets/images/pulse-router-logo.svg',
  title: variant.end.title, line: variant.end.line,
  onInstall() { audio.play('pr_ui_click'); adapter.install(); },
  onReplay() { audio.play('pr_ui_click'); endCard.hide(); ended = false; shownAt = performance.now(); startTimer(); startLevel(0); }
});

// Any touch hides the finger; if the player stalls, it comes back.
playfield.addEventListener('pointerdown', () => { lastTouch = performance.now(); if (!demoing) ghost.hide(); }, true);
function startTimer() {
  clearInterval(timer);
  timer = setInterval(() => {
    if (ended || document.hidden) return;
    const now = performance.now();
    if ((now - shownAt) / 1000 >= TIME_LIMIT) { showEnd(0); return; }
    if (!demoing && !ghost.visible && current && (now - lastTouch) / 1000 >= IDLE_HINT) { showGhost(); lastTouch = now; }
  }, 500);
}
$('cta').hidden = !variant.topCta;
$('cta').addEventListener('click', () => { audio.play('pr_ui_click'); adapter.install(); });

// Hidden ad (scrolled away, app backgrounded): pause play and sound.
adapter.onVisibility(visible => {
  adHidden = !visible;
  if (visible) { session.release('ad-hidden'); audio.release('ad-hidden'); }
  else { session.hold('ad-hidden'); audio.hold('ad-hidden'); }
});

async function boot() {
  await adapter.ready();
  await loadThree(new URL(globalThis.PR_VENDOR || '../vendor/three/', document.baseURI));
  app.classList.add('ready');
  shownAt = performance.now();
  startTimer();
  startLevel(0);
}
boot().catch(error => { console.error(error); app.classList.add('ready'); showEnd(0); });
