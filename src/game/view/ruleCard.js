// Pulse Router — new-rule card: title, one sentence and a looping 2-second animated example
// on a mini board. DOM + SVG only; gameplay decides when a card is due.
import { RULE_CARDS } from '../worlds.js';

const CSS = `
.pr-rule{position:absolute;inset:0;z-index:5;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(6,10,26,.72);backdrop-filter:blur(4px);pointer-events:auto}
.pr-rule.show{display:flex}
.pr-rule-card{width:min(100%,340px);background:linear-gradient(180deg,#18214a,#0f1631);border:1px solid rgba(101,231,255,.35);border-radius:22px;padding:20px 18px 18px;text-align:center;box-shadow:0 18px 50px rgba(0,0,0,.5),0 0 30px rgba(101,231,255,.12);animation:pr-rule-in .3s ease}
@keyframes pr-rule-in{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:none}}
.pr-rule-tag{font-size:12px;font-weight:700;letter-spacing:1px;color:#65e7ff;text-transform:uppercase}
.pr-rule-title{margin:4px 0 12px;font-size:24px;font-weight:700;color:#f1f7ff}
.pr-rule-demo{display:block;margin:0 auto 12px;max-width:100%;height:auto}
.pr-rule-text{margin:0 0 16px;font-size:16px;line-height:1.35;color:#c9d6f2}
.pr-rule-ok{pointer-events:auto;min-width:150px;min-height:52px;border:none;border-radius:16px;background:linear-gradient(180deg,#65e7ff,#2fb7d8);color:#07122a;font:700 18px Fredoka,system-ui,sans-serif;cursor:pointer;box-shadow:0 0 18px rgba(101,231,255,.45)}
.pr-rule-ok:focus-visible{outline:3px solid #fff;outline-offset:3px}
@media (prefers-reduced-motion:reduce){.pr-rule-card{animation:none}}
`;

const C = { tile: '#26304f', tileLit: '#34416b', hole: '#05070f', accent: '#65e7ff', node: '#b99bff', exit: '#ff8ac9', text: '#f1ebff', dim: '#3a4466', hazard: '#ffb347' };
// Mini boards. cells: S source, E exit, N node, 1–9 ordered node, # hole.
const DEMOS = {
  basics: { grid: ['.N.', 'S#E'], path: [[1, 0], [0, 0], [0, 1], [0, 2], [1, 2]] },
  ordered: { grid: ['E2..', 'S..1'], path: [[1, 0], [1, 1], [1, 2], [1, 3], [0, 3], [0, 2], [0, 1], [0, 0]] },
  exact: { grid: ['S.E', '...', '.N.'], path: [[0, 0], [0, 1], [1, 1], [1, 0], [2, 0], [2, 1], [2, 2], [1, 2], [0, 2]], energy: 8 }
};
const LOOP = 2.6, DRAW = 1.8; // seconds: draw the route, hold, repeat
const SIZE = 44, GAP = 6, PAD = 6;
const NS = 'http://www.w3.org/2000/svg';
const el = (name, attrs = {}) => { const n = document.createElementNS(NS, name); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };

function buildDemo(spec) {
  const rows = spec.grid.length, cols = spec.grid[0].length;
  const meterH = spec.energy ? 26 : 0;
  const w = PAD * 2 + cols * SIZE + (cols - 1) * GAP, h = PAD * 2 + rows * SIZE + (rows - 1) * GAP + meterH;
  const svg = el('svg', { viewBox: `0 0 ${w} ${h}`, width: w * 1.25, height: h * 1.25, class: 'pr-rule-demo', role: 'img' });
  const center = (r, c) => [PAD + c * (SIZE + GAP) + SIZE / 2, meterH + PAD + r * (SIZE + GAP) + SIZE / 2];
  const tiles = new Map(), glyphs = new Map();
  spec.grid.forEach((line, r) => [...line].forEach((ch, c) => {
    const [x, y] = center(r, c);
    const tile = el('rect', { x: x - SIZE / 2, y: y - SIZE / 2, width: SIZE, height: SIZE, rx: 8, fill: ch === '#' ? C.hole : C.tile });
    svg.append(tile); tiles.set(`${r},${c}`, tile);
    if (ch === 'S') { svg.append(el('circle', { cx: x, cy: y, r: 11, fill: 'none', stroke: C.accent, 'stroke-width': 4 })); }
    if (ch === 'E') { svg.append(el('rect', { x: x - 10, y: y - 10, width: 20, height: 20, rx: 3, fill: 'none', stroke: C.exit, 'stroke-width': 4 })); }
    if (ch === 'N' || (ch >= '1' && ch <= '9')) {
      const gem = el('path', { d: `M${x} ${y - 13}L${x + 10} ${y}L${x} ${y + 13}L${x - 10} ${y}Z`, fill: C.node, opacity: 0.55 });
      svg.append(gem);
      const g = { gem, number: ch === 'N' ? 0 : Number(ch) };
      if (g.number) {
        const badge = el('circle', { cx: x + 13, cy: y - 13, r: 9, fill: '#0b1230', stroke: C.node, 'stroke-width': 2 });
        const t = el('text', { x: x + 13, y: y - 9, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 700, fill: C.text, 'font-family': 'Fredoka, system-ui, sans-serif' });
        t.textContent = String(g.number);
        g.badge = el('g'); g.badge.append(badge, t); svg.append(g.badge);
      }
      glyphs.set(`${r},${c}`, g);
    }
  }));
  const points = spec.path.map(([r, c]) => center(r, c));
  const line = el('polyline', { points: points.map(p => p.join(',')).join(' '), fill: 'none', stroke: C.accent, 'stroke-width': 6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1 });
  svg.append(line);
  const head = el('circle', { r: 7, fill: '#dffaff' });
  svg.append(head);
  let cells = [], counter = null;
  if (spec.energy) {
    const cw = 8, cg = 4, total = spec.energy * (cw + cg) - cg, x0 = PAD;
    cells = Array.from({ length: spec.energy }, (_, i) => { const r = el('rect', { x: x0 + i * (cw + cg), y: 6, width: cw, height: 14, rx: 2, fill: C.accent }); svg.append(r); return r; });
    counter = el('text', { x: x0 + total + 10, y: 18, 'font-size': 13, 'font-weight': 700, fill: C.text, 'font-family': 'Fredoka, system-ui, sans-serif' });
    svg.append(counter);
  }
  const moves = points.length - 1;

  // t in seconds within the loop; draws the route up to that moment.
  function frame(t) {
    const progress = Math.max(0, Math.min(1, t / DRAW));
    const along = progress * moves;
    line.setAttribute('stroke-dashoffset', String(1 - progress));
    const i = Math.min(moves - 1, Math.floor(along)), f = along - i;
    const [ax, ay] = points[i], [bx, by] = points[Math.min(moves, i + 1)];
    head.setAttribute('cx', ax + (bx - ax) * f); head.setAttribute('cy', ay + (by - ay) * f);
    const reached = Math.floor(along + 1e-6);
    let litNumbers = 0;
    spec.path.forEach(([r, c], k) => {
      tiles.get(`${r},${c}`).setAttribute('fill', k <= reached ? C.tileLit : C.tile);
      const g = glyphs.get(`${r},${c}`);
      if (g) { const on = k <= reached; g.gem.setAttribute('opacity', on ? 1 : 0.55); if (on && g.number) litNumbers++; }
    });
    // Later numbers wait dimmed until their turn, as on the real board.
    for (const g of glyphs.values()) if (g.badge) g.badge.setAttribute('opacity', g.number <= litNumbers + 1 ? 1 : 0.4);
    if (spec.energy) {
      const left = spec.energy - reached;
      cells.forEach((r, k) => r.setAttribute('fill', k < left ? C.accent : C.dim));
      counter.textContent = left === 0 ? '0 ✓' : `${left} left`;
      counter.setAttribute('fill', left === 0 ? C.accent : C.hazard);
    }
  }
  return { svg, frame, label: spec.label };
}

export function createRuleCard(container, { reducedMotion = false } = {}) {
  const style = document.createElement('style'); style.textContent = CSS;
  const root = document.createElement('div'); root.className = 'pr-rule';
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
  root.innerHTML = '<div class="pr-rule-card"><div class="pr-rule-tag">How it works</div><h2 class="pr-rule-title"></h2><div class="pr-rule-slot"></div><p class="pr-rule-text"></p><button class="pr-rule-ok" type="button">Got it</button></div>';
  container.append(style, root);
  const title = root.querySelector('.pr-rule-title'), text = root.querySelector('.pr-rule-text'), slot = root.querySelector('.pr-rule-slot'), ok = root.querySelector('.pr-rule-ok');
  let raf = 0, demo = null, started = 0, done = null;

  function loop(now) {
    if (!demo) return;
    demo.frame((Math.max(0, now - started) / 1000) % LOOP);
    raf = requestAnimationFrame(loop);
  }
  function stop() { cancelAnimationFrame(raf); raf = 0; }
  ok.addEventListener('click', event => {
    if (event.detail > 0) ok.blur();
    const callback = done; hide(); callback?.();
  });

  function show(ruleId, onDone) {
    const rule = RULE_CARDS[ruleId];
    if (!rule) { onDone?.(); return; }
    stop();
    done = onDone;
    root.querySelector('.pr-rule-tag').textContent = ruleId === 'basics' ? 'How it works' : 'New rule';
    title.textContent = rule.title; text.textContent = rule.text;
    root.setAttribute('aria-label', rule.title);
    demo = buildDemo(DEMOS[rule.demo]);
    demo.svg.setAttribute('aria-label', `Example: ${rule.text}`);
    slot.replaceChildren(demo.svg);
    root.classList.add('show');
    // Reduce Motion: show the finished example instead of animating it.
    if (reducedMotion) demo.frame(DRAW); else { started = performance.now(); raf = requestAnimationFrame(loop); }
    ok.focus({ preventScroll: true });
  }
  function hide() { stop(); demo = null; done = null; root.classList.remove('show'); }

  return { show, hide, setReducedMotion(v) { reducedMotion = !!v; }, isOpen: () => root.classList.contains('show'), dispose() { hide(); root.remove(); style.remove(); } };
}
