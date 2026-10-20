// Pulse Router — gameplay. Wires the pure rules (board, path, pulse, rating)
// to the Three.js board view and the DOM HUD. Failures stay on the board: only a win
// reaches the runtime, through complete().
import { parseBoard, key, tileAt, TILE } from './board.js';
import { createPathModel } from './pathModel.js';
import { createPulseRun, PULSE_PROFILES } from './pulse.js';
import { starsFor, STAR_LABELS } from './rating.js';
import { createBoardView } from './view/boardScene.js';
import { createHud } from './view/hud.js';
import { PROGRESS_SLOT } from './progressStore.js';
import { createRuleCard } from './view/ruleCard.js';
import { rulesFor } from './worlds.js';
import { winLine, failLine } from './flavour.js';
import { SKINS, resolveSkin, totalStars, circuitsUnlockedForTesting } from './skins.js';

const DEFAULT_PULSE = 'chain';  // see PULSE_PROFILES; the player can pick another in Settings
const TICK_GAP = 0.04;          // seconds; fast pulses skip ticks rather than stack them
const FAIL_HOLD = 0.9;          // seconds of failure animation before the board is editable again
const WIN_CHORD_DELAY = 0.45;   // seconds of quiet between the last node chime and the win chord
const WIN_HOLD = 2.0;           // seconds from the pulse landing to the result screen
const FAILS_PER_STAR = 2;       // failed pulses that cost one star of the attempt's maximum
const HINT_AFTER = 3;           // failed pulses before the Hint button lights up
const TICKS = 12, CHIMES = 8;
const FAIL_TEXT = {
  drained: ['Drained', o => `${o.short} short`],
  locked: ['Locked', o => `${o.missing.length} node${o.missing.length === 1 ? '' : 's'} missed`],
  stalled: ['Stalled', () => 'Reach the exit'],
  overcharged: ['Overcharged', o => `${o.energyLeft} energy left · end on 0`]
};
const NOTE_SECONDS = 1.6;
const KEYS = {
  up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'],
  undo: ['Backspace'], pulse: ['Enter', 'Space']
};
const MOVES = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };

export function createGameplay(context) {
  // Player settings come from the shell (Settings menu); without it, follow the OS motion setting.
  const settings = () => context.settings?.get() ?? {};
  const reducedMotion = settings().reduceMotion ?? !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const view = createBoardView({ reducedMotion });
  let lastTick = -1, clock = 0, unsubscribe = null, skin = SKINS[0];
  // Node chimes come from the equipped circuit skin.
  const chime = i => `${skin.chimes}${Math.max(0, Math.min(CHIMES - 1, i))}`;
  const api = view.api;
  let hud = null, ruleCard = null, progress = null, sceneLoad = null, unbindPointer = null;
  let pendingRules = [];
  const unbindKeys = [];
  const keyWasDown = {};

  // Per-attempt state.
  let board = null, path = null, budget = 0, par = 0, solution = [], levelId = '', prompt = '', exact = false, noteTimer = 0;
  let phase = 'idle';           // idle | card | draw | pulse | failing | won
  let run = null, timer = 0, nodesLit = 0, failures = 0, hintUsed = false, hintOn = false;
  let shown = false, dragging = false, lastRefused = -1, outcome = null, winDelay = 0;
  const starCap = () => 3 - Math.min(2, Math.floor(failures / FAILS_PER_STAR));

  const sound = name => { try { context.audio?.playSound(name); } catch {} };
  const nodeKeys = () => new Set(board.nodes.map(([r, c]) => key(board, r, c)));
  const same = (a, b) => a[0] === b[0] && a[1] === b[1];

  // ---------- Presentation sync ----------
  function refresh() {
    if (!board) return;
    const sim = path.energy();
    const nodes = nodeKeys();
    const onPathNodes = new Set(path.cells.map(([r, c]) => key(board, r, c)).filter(k => nodes.has(k)));
    const left = sim.energy[sim.energy.length - 1];
    hud?.setEnergy({ budget, left: Math.max(0, left), short: sim.short });
    hud?.setNodes(onPathNodes.size, board.nodes.length);
    hud?.setPulseReady(phase === 'draw' && path.length > 1);
    if (shown) {
      api.setPath({ cells: path.cells, diesAt: sim.diesAt, short: sim.short, exitUnlocked: path.exitUnlocked(), onPathNodes });
      api.setHint(hintOn ? nextHintCell() : null);
    }
  }

  function showLevel() {
    if (!api.ready || !board || shown) return;
    api.setLevel(board);
    applySettings(); // the scene exists now, so bloom can actually switch
    shown = true;
    hud?.setVisible(true);
    refresh();
    api.relight(board.source);
    if (phase === 'card') showNextCard();
  }

  // ---------- New-rule cards (once per rule, before the first level that uses it) ----------
  function showNextCard() {
    const rule = pendingRules.shift();
    if (!rule) { phase = 'draw'; refresh(); return; }
    ruleCard?.show(rule, () => { markSeen(rule); showNextCard(); });
    if (!ruleCard) showNextCard();
  }
  function seenRules() { return progress?.read().seen ?? []; }
  function markSeen(rule) {
    if (!progress) return;
    const data = progress.read();
    data.seen = [...new Set([...(data.seen ?? []), rule])];
    progress.write(data);
  }

  // ---------- Hints (stored optimal route, no search at run time) ----------
  function matchingPrefix() {
    let k = 0;
    while (k < path.length && k < solution.length && same(path.cells[k], solution[k])) k++;
    return k;
  }
  function nextHintCell() {
    const k = matchingPrefix();
    return k === path.length && k < solution.length ? solution[k] : null;
  }
  function useHint() {
    if (phase !== 'draw' || failures < HINT_AFTER || !solution.length) return;
    const k = matchingPrefix();
    if (k < path.length) path.truncateTo(Math.max(0, k - 1));
    hintUsed = true; hintOn = true;
    sound('pr_touch');
    afterEdit();
  }

  // ---------- Drawing ----------
  function afterEdit() {
    hud?.hideFailure();
    api.clearMissed();
    if (prompt && path.length > 1) { prompt = ''; hud?.setPrompt(''); }
    refresh();
  }
  function refuse(r, c, reason, expected) {
    const k = r * board.cols + c;
    if (k === lastRefused) return;
    lastRefused = k;
    api.bump(r, c);
    sound('pr_refuse');
    // Explain the one refusal whose rule is not visible on the tile itself.
    if (reason === 'order') { hud?.setPrompt(`Light ${expected} first`); noteTimer = NOTE_SECONDS; }
  }
  function tryStep(r, c) {
    const res = path.step(r, c);
    if (!res.ok) { if (res.reason !== 'same') refuse(r, c, res.reason, res.expected); return false; }
    lastRefused = -1;
    if (res.action === 'extend') {
      api.lightTile(r, c, 0.35);
      const nodesOn = board.nodes.length - path.missing().length;
      sound(tileAt(board, r, c) === TILE.NODE ? chime(nodesOn - 1) : `pr_tick_${(path.length - 2) % TICKS}`);
    }
    afterEdit();
    return true;
  }
  // Walk toward a dragged-to cell one tile at a time along the dominant axis,
  // so fast drags never skip tiles.
  function stepToward(r, c) {
    for (let guard = 0; guard < board.rows + board.cols; guard++) {
      const [hr, hc] = path.head();
      if (hr === r && hc === c) return;
      const prev = path.length >= 2 ? path.cells[path.length - 2] : null;
      if (prev && prev[0] === r && prev[1] === c) { tryStep(r, c); return; }
      const dr = r - hr, dc = c - hc;
      const [nr, nc] = Math.abs(dr) >= Math.abs(dc) ? [hr + Math.sign(dr), hc] : [hr, hc + Math.sign(dc)];
      if (!tryStep(nr, nc)) return;
    }
  }
  const canDraw = () => phase === 'draw' && shown && context.isPlaying();

  function pointerStart(p) {
    if (!canDraw()) return;
    const hit = api.pick(p.x, p.y, p.width, p.height);
    if (!hit?.inside) return;
    const index = path.indexOf(hit.r, hit.c);
    lastRefused = -1;
    if (index >= 0) {
      // Pressing anywhere on the path continues from there; tiles after it are erased.
      if (index < path.length - 1) { path.truncateTo(index); afterEdit(); }
      if (index === 0) { api.lightTile(hit.r, hit.c, 1); sound('pr_touch'); }
      dragging = true;
      return;
    }
    // Pressing next to the head extends straight away.
    const [hr, hc] = path.head();
    if (Math.abs(hr - hit.r) + Math.abs(hc - hit.c) === 1) { dragging = true; tryStep(hit.r, hit.c); return; }
    refuse(hit.r, hit.c);
  }
  function pointerMove(p) {
    if (!dragging || !canDraw()) return;
    const hit = api.pick(p.x, p.y, p.width, p.height);
    if (!hit) return;
    // Clamp to the board so dragging off an edge keeps the nearest tile.
    const r = Math.max(0, Math.min(board.rows - 1, hit.r)), c = Math.max(0, Math.min(board.cols - 1, hit.c));
    stepToward(r, c);
  }
  function pointerEnd() { dragging = false; lastRefused = -1; }

  function bindPointer() {
    if (unbindPointer || !api.canvas || !context.input) return;
    unbindPointer = context.input.pointer(api.canvas, { start: pointerStart, move: pointerMove, end: pointerEnd, cancel: pointerEnd, preventDefault: true });
  }

  // ---------- Controls ----------
  function undo() { if (phase === 'draw' && path.undo()) { lastRefused = -1; afterEdit(); } }
  function clear() { if (phase === 'draw' && path.length > 1) { path.clear(); afterEdit(); api.relight(board.source); } }

  function firePulse() {
    if (phase !== 'draw' || !shown) return;
    if (path.length < 2) { refuse(...board.source); return; }
    dragging = false;
    hud?.hideFailure();
    hud?.setBusy(true);
    const profile = PULSE_PROFILES[settings().pulseSpeed] ?? PULSE_PROFILES[DEFAULT_PULSE];
    run = createPulseRun(board, path.cells, budget, { profile, exact });
    lastTick = -1;
    phase = 'pulse'; nodesLit = 0;
    api.lightTile(...board.source, 1);
    api.setPulse({ visible: true, position: 0, cells: run.path });
    sound('pr_fire');
  }

  function resolvePulse() {
    const o = run.outcome;
    const stop = run.path[o.stopIndex];
    if (o.result === 'win') {
      // Hold a beat after the last node chime so the win chord reads as its own moment.
      phase = 'won'; timer = WIN_HOLD; winDelay = WIN_CHORD_DELAY;
      api.setPulse({ visible: false });
      const earned = starsFor(o.used, par);
      const stars = Math.min(earned, starCap());
      const clean = failures === 0 && !hintUsed;
      record(stars, clean);
      outcome = { stars, clean, used: o.used };
      // The win screen shows the full breakdown after complete().
      context.result?.set({ stars, clean, used: o.used, par, budget, exact, fails: failures, capped: stars < earned, line: winLine(stars), accent: skin.accent, chimes: skin.chimes });
      return;
    }
    const capBefore = starCap();
    failures++;
    phase = 'failing'; timer = FAIL_HOLD;
    if (o.result === 'drained') { api.failDrained(stop[0], stop[1]); sound('pr_fail'); }
    else if (o.result === 'locked') { api.failLocked(o.missing); sound('pr_locked'); }
    else if (o.result === 'overcharged') { api.failLocked([]); sound('pr_locked'); }
    else { api.failStalled(); sound('pr_fail'); }
    const [word, detail] = FAIL_TEXT[o.result];
    // Small penalty: every FAILS_PER_STAR failed pulses lower the best result this attempt can earn.
    const cap = starCap();
    hud?.setCap(cap, cap < capBefore);
    hud?.showFailure(word, detail(o), failLine(o.result), cap < capBefore ? `Now max ${'★'.repeat(cap)} this attempt` : '');
  }
  function celebrate() {
    api.winRipple(board.exit);
    sound('pr_win');
    hud?.showWin({ stars: outcome.stars, label: STAR_LABELS[outcome.stars], clean: outcome.clean });
  }

  // ---------- Saves ----------
  function openProgress() {
    if (!context.saves) return null;
    try {
      const { name, ...schema } = PROGRESS_SLOT;
      return context.saves.open(name, schema);
    } catch (error) { console.warn('Pulse Router progress unavailable:', error); return null; }
  }
  function record(stars, clean) {
    if (!progress || !levelId) return;
    const data = progress.read();
    const old = data.levels[levelId];
    data.levels[levelId] = { stars: Math.max(stars, old?.stars ?? 0), clean: clean || !!old?.clean };
    progress.write(data);
  }

  function applySettings() {
    const s = settings();
    if (s.reduceMotion !== undefined) { api.setReducedMotion(!!s.reduceMotion); ruleCard?.setReducedMotion(!!s.reduceMotion); }
    if (s.bloom !== undefined) api.setBloom(!!s.bloom);
  }

  function recordReached(number) {
    if (!progress || !Number.isSafeInteger(number)) return;
    const data = progress.read();
    if ((data.reached ?? 0) >= number) return;
    data.reached = number;
    progress.write(data);
  }

  function resetAttempt() {
    phase = 'idle'; run = null; timer = 0; dragging = false; lastRefused = -1; outcome = null;
    hud?.hideFailure(); hud?.hideWin(); hud?.setBusy(false); hud?.showHint(false); hud?.setPrompt('');
    ruleCard?.hide(); pendingRules = [];
    if (shown) { api.setPulse({ visible: false }); api.setHint(null); }
  }

  return {
    init() {
      if (context.container) {
        hud = createHud(context.container, { onUndo: undo, onClear: clear, onPulse: firePulse, onHint: useHint });
        hud.setVisible(false);
        ruleCard = createRuleCard(context.container, { reducedMotion });
      }
      progress = openProgress();
      if (context.input) {
        for (const [action, codes] of Object.entries(KEYS)) unbindKeys.push(context.input.bind(action, codes, { preventDefault: true }));
      }
      applySettings();
      unsubscribe = context.settings?.subscribe(event => {
        if (event === 'reset') { progress?.reset(); return; }
        applySettings();
      }) ?? null;
    },

    start({ level, definition }) {
      resetAttempt();
      if (!definition?.grid) throw new Error('Pulse Router level is missing its grid');
      recordReached(level);
      board = parseBoard(definition.grid);
      budget = definition.energy; par = definition.par; levelId = definition.id;
      solution = Array.isArray(definition.solution) ? definition.solution.map(p => [p[0], p[1]]) : [];
      path = createPathModel(board, budget);
      failures = 0; hintUsed = false; hintOn = false; winDelay = 0;
      hud?.setCap(3, false);
      prompt = definition.prompt || '';
      exact = definition.exact === true; noteTimer = 0;
      hud?.setPrompt(prompt);
      hud?.setExact(exact);
      const seen = new Set(seenRules());
      pendingRules = rulesFor(board, definition).filter(rule => !seen.has(rule));
      phase = pendingRules.length ? 'card' : 'draw';
      // The equipped circuit skin (Circuits screen), if the stars still unlock it.
      skin = resolveSkin(settings().skin, totalStars(progress?.read().levels), circuitsUnlockedForTesting(context.config));
      api.setSkin(skin);
      shown = false;
      if (api.ready) { showLevel(); return; }
      refresh();
      if (!sceneLoad) {
        sceneLoad = context.scenes.load(view.factory).then(() => { bindPointer(); showLevel(); }, error => {
          sceneLoad = null;
          if (error?.name !== 'AbortError') context.reportError(error);
        });
      } else {
        sceneLoad.then(() => showLevel());
      }
    },

    update(deltaSeconds) {
      if (!board) return;
      // Keyboard: act on the press, not while held.
      if (context.input) {
        for (const action of Object.keys(KEYS)) {
          const down = context.input.isDown(action);
          if (down && !keyWasDown[action]) {
            if (MOVES[action] && canDraw()) { const [hr, hc] = path.head(); lastRefused = -1; tryStep(hr + MOVES[action][0], hc + MOVES[action][1]); }
            else if (action === 'undo') undo();
            else if (action === 'pulse') firePulse();
          }
          keyWasDown[action] = down;
        }
      }
      if (noteTimer > 0 && (noteTimer -= deltaSeconds) <= 0) hud?.setPrompt(prompt);
      if (phase === 'failing') {
        // Keep the pulse head at its last tile while the view fades it.
        api.setPulse({ visible: true, position: run.outcome.stopIndex, cells: run.path });
        timer -= deltaSeconds;
        if (timer <= 0) {
          phase = 'draw';
          api.setPulse({ visible: false });
          api.relight(run.path[run.outcome.stopIndex]);
          hud?.setBusy(false);
          hud?.showHint(failures >= HINT_AFTER && solution.length > 0);
          run = null;
          refresh();
        }
      } else if (phase === 'won') {
        if (winDelay > 0 && (winDelay -= deltaSeconds) <= 0) celebrate();
        timer -= deltaSeconds;
        if (timer <= 0) { phase = 'idle'; context.complete(); }
      }
    },

    fixedUpdate(deltaSeconds) {
      if (phase !== 'pulse' || !run) return;
      const step = run.advance(deltaSeconds);
      clock += deltaSeconds;
      for (const index of step.entered) {
        const [r, c] = run.path[index];
        api.pulseTile(r, c, run.progress);
        if (tileAt(board, r, c) === TILE.NODE) { api.nodeBurst(r, c); sound(chime(nodesLit++)); }
        else if (clock - lastTick >= TICK_GAP) {
          // The tick climbs the scale across the whole run, so a fast pulse sounds like it builds.
          lastTick = clock;
          sound(`${skin.ticks}${Math.min(TICKS - 1, Math.floor(run.progress * TICKS))}`);
        }
      }
      api.setPulse({ visible: true, position: run.position, cells: run.path });
      api.setPulseBoost(step.finished ? 0 : run.progress);
      if (step.finished) resolvePulse();
    },

    pause() { dragging = false; },
    resume() {},
    finish() { dragging = false; },
    stop() { resetAttempt(); },
    dispose() {
      unbindPointer?.(); unbindPointer = null;
      for (const off of unbindKeys.splice(0)) off();
      hud?.dispose(); hud = null;
      ruleCard?.dispose(); ruleCard = null;
      unsubscribe?.(); unsubscribe = null;
    }
  };
}
