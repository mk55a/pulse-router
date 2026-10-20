// Pulse Router — start-up and screen flow: splash → Home → level → win screen, plus the settings
// dialog, Level select and Circuits. Gameplay runs inside a session (src/app/session.js); this
// file decides which screen is showing and what happens between levels.
import { config } from './app/config.js';
import { createAudio } from './app/audio.js';
import { createSaves, readJSON, writeJSON } from './app/saves.js';
import { createLevels, createCurrentLevel } from './app/levels.js';
import { createSession } from './app/session.js';
import { loadThree } from './app/vendor.js';
import { createGameplay } from './game/gameplay.js';
import { WORLD_INFO } from './game/worlds.js';
import { SKINS, totalStars, circuitsUnlockedForTesting } from './game/skins.js';
import { readProgress } from './game/progressStore.js';
import { createHomeScreen } from './ui/homeScreen.js';
import { createLevelSelect } from './ui/levelSelect.js';
import { createCircuitsScreen } from './ui/circuitsScreen.js';
import { createResultScreen } from './ui/resultScreen.js';

const $ = id => document.getElementById(id);
const app = $('app');
const base = new URL('../', import.meta.url);
const PREFS_KEY = `${config.gameId}_preferences`;
const SPEEDS = ['chain', 'surge', 'quick', 'steady'];
const SPLASH_SECONDS = 1.4;

// Every sound file the game can play (assets/Audio/pulse/<name>.wav).
const range = (n, f) => Array.from({ length: n }, (_, i) => f(i));
const SOUNDS = [...new Set([
  ...SKINS.flatMap(s => [...range(8, i => s.chimes + i), ...range(12, i => s.ticks + i)]),
  'pr_refuse', 'pr_touch', 'pr_fire', 'pr_fail', 'pr_win', 'pr_locked',
  'pr_ui_click', 'pr_ui_toggle', 'pr_ui_popup', 'pr_ui_flourish', 'pr_ui_reveal'
])];
const UI_SOUND = { click: 'pr_ui_click', toggle: 'pr_ui_toggle', popup: 'pr_ui_popup', flourish: 'pr_ui_flourish', reveal: 'pr_ui_reveal' };

function fatal(error) {
  console.error(error);
  $('fatal').hidden = false;
}

async function boot() {
  const data = await fetch(new URL('data/levels.json', base)).then(r => { if (!r.ok) throw new Error(`Levels: ${r.status}`); return r.json(); });
  const levels = createLevels(data);
  const current = createCurrentLevel(levels, config.gameId);
  const unlockAll = circuitsUnlockedForTesting(config);
  const three = loadThree(new URL('vendor/three/', base)); // in the background, during the splash

  // ---------- Preferences ----------
  const osReduce = !!matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const saved = readJSON(PREFS_KEY, {});
  const prefs = {
    sound: saved.sound !== false,
    haptics: saved.haptics !== false,
    reduceMotion: typeof saved.reduceMotion === 'boolean' ? saved.reduceMotion : osReduce,
    bloom: saved.bloom !== false,
    pulseSpeed: SPEEDS.includes(saved.pulseSpeed) ? saved.pulseSpeed : 'chain',
    skin: typeof saved.skin === 'string' ? saved.skin : 'classic'
  };
  const savePrefs = () => writeJSON(PREFS_KEY, prefs);
  const listeners = new Set();
  const notify = event => { for (const fn of [...listeners]) { try { fn(event); } catch (error) { console.error(error); } } };
  const settings = Object.freeze({ get: () => ({ ...prefs }), subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); } });

  const audio = createAudio({ baseUrl: new URL('assets/Audio/pulse/', base), names: SOUNDS, isEnabled: () => prefs.sound });
  const ui = name => audio.play(UI_SOUND[name] ?? name);
  // Browsers refuse vibration until the player has tapped the page at least once.
  const haptic = (pattern = 10) => { if (prefs.haptics && navigator.userActivation?.hasBeenActive !== false) navigator.vibrate?.(pattern); };

  const levelLabel = n => { const d = levels.get(n); return `Level ${d.world}-${d.index}`; };
  const worldName = n => WORLD_INFO[levels.get(n).world]?.name ?? '';

  // ---------- Screens ----------
  function show(id) {
    for (const s of app.querySelectorAll('.screen')) s.classList.toggle('active', s.id === id);
    if (id === 'home') { home.refresh(); home.focus(); }
  }

  // ---------- Gameplay ----------
  let lastSummary = null, playingLevel = 1;
  const session = createSession({
    createGameplay,
    container: $('playfield'),
    services: {
      config,
      audio: { playSound: name => audio.play(name) },
      saves: createSaves(config.gameId),
      settings,
      result: { set(summary) { lastSummary = summary ? { ...summary } : null; } }
    },
    onComplete: levelWon,
    onError: fatal
  });

  async function startLevel(n) {
    await three;
    result.hide(); closeSettings(true);
    playingLevel = n; current.set(n);
    $('levelPill').textContent = levelLabel(n);
    show('game');
    session.start({ mode: 'levels', level: n, definition: levels.get(n) });
  }
  function levelWon() {
    haptic([30, 50, 60]);
    const next = levels.next(playingLevel);
    if (next) current.set(next); // a reload resumes on the next level
    const summary = lastSummary ?? { stars: 1, clean: false, used: 0, par: 0, line: 'Circuit complete.' };
    result.show(summary, { kicker: `${levelLabel(playingLevel)} · ${worldName(playingLevel)}`, nextLabel: next ? levelLabel(next) : 'Home' });
  }
  function goHome() { session.stop(); result.hide(); closeSettings(true); show('home'); }

  const result = createResultScreen({
    root: app,
    onNext() { ui('click'); haptic(); const next = levels.next(playingLevel); if (next) startLevel(next); else goHome(); },
    onRetry() { ui('click'); haptic(); startLevel(playingLevel); },
    onHome() { ui('click'); haptic(); goHome(); },
    // Each star chimes in the equipped circuit's voice, climbing like lit nodes.
    onStar: i => audio.play(`${lastSummary?.chimes ?? 'pr_chime_'}${Math.min(7, i * 2 + 2)}`),
    sound: ui,
    reducedMotion: () => prefs.reduceMotion
  });

  // ---------- Home, Level select, Circuits ----------
  const home = createHomeScreen({
    screen: $('home'), levels, gameId: config.gameId, levelLabel,
    getLevel: () => current.get(), getSkinId: () => prefs.skin, unlockAll,
    reducedMotion: () => prefs.reduceMotion,
    onContinue() { ui('click'); haptic(); startLevel(current.get()); },
    onLevels() { ui('click'); haptic(); levelSelect.open(); },
    onCircuits() { ui('click'); haptic(); circuits.open(); },
    onSettings() { openSettings(); }
  });
  const levelSelect = createLevelSelect({
    root: app, levels, gameId: config.gameId,
    getCurrent: () => current.get(),
    onPick(n) { ui('click'); haptic(); levelSelect.close(); startLevel(n); },
    onClose() { ui('click'); }
  });
  const circuits = createCircuitsScreen({
    root: app, gameId: config.gameId, available: levels.count * 3, unlockAll,
    getEquipped: () => prefs.skin,
    onEquip(id) { ui('toggle'); haptic(); prefs.skin = id; savePrefs(); notify('change'); },
    // A short pulse run: accelerating ticks with two node chimes along the way.
    onPreview(skin) {
      let at = 0;
      for (let i = 0; i < 10; i++) {
        const tick = i; setTimeout(() => audio.play(`${skin.ticks}${tick}`), at);
        if (i === 3 || i === 9) { const c = i === 3 ? 0 : 4; setTimeout(() => audio.play(`${skin.chimes}${c}`), at + 20); }
        at += 105 - i * 7;
      }
    },
    onClose() { ui('click'); home.refresh(); }
  });

  // ---------- Settings ----------
  const dialog = $('settings');
  const opts = { sound: $('optSound'), haptics: $('optHaptics'), reduceMotion: $('optMotion'), bloom: $('optBloom') };
  let opener = null, resetArmed = 0;
  function syncSettings() {
    for (const [k, el] of Object.entries(opts)) el.checked = !!prefs[k];
    $('optSpeed').value = prefs.pulseSpeed;
  }
  function openSettings() {
    const inGame = $('game').classList.contains('active');
    opener = document.activeElement;
    syncSettings();
    $('optQuit').hidden = !inGame;
    $('optReset').hidden = inGame; // progress resets only from Home, never mid-level
    $('quitConfirm').hidden = true;
    disarmReset();
    dialog.hidden = false;
    session.hold('settings');
    ui('popup'); haptic();
    $('settingsClose').focus({ preventScroll: true });
  }
  function closeSettings(silent = false) {
    if (dialog.hidden) return;
    dialog.hidden = true;
    session.release('settings');
    if (!silent) { ui('click'); opener?.focus?.({ preventScroll: true }); }
  }
  for (const [k, el] of Object.entries(opts)) el.addEventListener('change', () => {
    prefs[k] = el.checked; savePrefs(); ui('toggle'); haptic(); notify('change');
    if (k === 'reduceMotion') home.refresh();
  });
  $('optSpeed').addEventListener('change', e => { prefs.pulseSpeed = e.target.value; savePrefs(); notify('change'); });
  $('settingsClose').addEventListener('click', () => closeSettings());
  dialog.addEventListener('click', e => { if (e.target === dialog) closeSettings(); });
  $('gameSettings').addEventListener('click', openSettings);
  $('optQuit').addEventListener('click', () => { ui('popup'); $('quitConfirm').hidden = false; $('quitNo').focus(); });
  $('quitNo').addEventListener('click', () => { ui('click'); $('quitConfirm').hidden = true; $('optQuit').focus(); });
  $('quitYes').addEventListener('click', () => { ui('click'); haptic(); goHome(); });
  // Reset needs a second tap within 4 s.
  function disarmReset() { clearTimeout(resetArmed); resetArmed = 0; $('optReset').textContent = 'Reset progress'; }
  $('optReset').addEventListener('click', () => {
    ui('click'); haptic();
    if (!resetArmed) { $('optReset').textContent = 'Tap again to erase all stars'; resetArmed = setTimeout(disarmReset, 4000); return; }
    disarmReset();
    current.reset();
    notify('reset'); // gameplay clears its progress slot
    home.refresh();
    $('optReset').textContent = 'Progress reset';
    resetArmed = setTimeout(disarmReset, 1500);
  });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !dialog.hidden) { e.preventDefault(); closeSettings(); } });

  // Pause while the tab is hidden.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { session.hold('hidden'); audio.hold('hidden'); } else { session.release('hidden'); audio.release('hidden'); }
  });

  // ---------- Splash, then Home (or straight into the first level on a first visit) ----------
  app.classList.add('ready');
  show('splash');
  await Promise.all([three, new Promise(r => setTimeout(r, (prefs.reduceMotion ? 0.4 : SPLASH_SECONDS) * 1000))]);
  $('splash').classList.add('leaving');
  await new Promise(r => setTimeout(r, prefs.reduceMotion ? 50 : 450));
  $('splash').classList.remove('leaving');
  const firstVisit = current.get() === 1 && totalStars(readProgress(config.gameId).levels) === 0;
  if (firstVisit) startLevel(1); else show('home');
}

boot().catch(fatal);
