// Pulse Router — Circuits: circuit skins unlocked by total stars. Each card previews the
// skin's colour, Source shape and effect; unlocked skins can be equipped. Presentation only:
// the equipped id is a player preference held by the shell; stars are read from the game's save.
import { SKINS, isUnlocked, totalStars } from '../game/skins.js';
import { readProgress } from '../game/progressStore.js';
import { rankFor } from '../game/rating.js';

const CSS = `
.pr-circuits{position:absolute;inset:0;z-index:30;display:none;flex-direction:column;background:#090e21;color:#e8f6ff;font-family:Fredoka,system-ui,sans-serif}
.pr-circuits.show{display:flex}
.pr-circuits-head{display:flex;align-items:center;gap:12px;padding:calc(16px + env(safe-area-inset-top,0px)) 16px 6px}
.pr-circuits-back{width:44px;height:44px;border-radius:14px;border:1px solid rgba(101,231,255,.35);background:rgba(18,26,54,.9);color:#e8f6ff;cursor:pointer;display:flex;align-items:center;justify-content:center}
.pr-circuits-back svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
.pr-circuits h2{margin:0;font-size:24px;font-weight:700;flex:1}
.pr-circuits-total{text-align:right;font-size:13px;color:#b99bff;line-height:1.2}
.pr-circuits-total b{display:block;font-size:17px;color:#ffd36b}
.pr-circuits-intro{margin:0;padding:0 16px 10px;font-size:13px;color:#8fa3cc}
.pr-circuits-body{flex:1;overflow-y:auto;padding:4px 16px calc(24px + env(safe-area-inset-bottom,0px));display:grid;grid-template-columns:repeat(2,1fr);gap:12px;align-content:start}
.pr-skin{border-radius:18px;border:1px solid rgba(143,163,204,.22);background:linear-gradient(180deg,#18214a,#111833);padding:10px 10px 12px;display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center}
.pr-skin.equipped{border-color:var(--skin);box-shadow:0 0 16px color-mix(in srgb,var(--skin) 45%,transparent)}
.pr-skin.locked{opacity:.55}
.pr-skin svg.preview{width:100%;max-width:150px;height:auto}
.pr-skin h3{margin:2px 0 0;font-size:17px;font-weight:700;color:var(--skin)}
.pr-skin p{margin:0;font-size:12px;line-height:1.3;color:#c9d6f2;min-height:31px}
.pr-skin button.sound{margin:2px 0 0;min-height:32px;min-width:0;border:none;background:rgba(9,14,33,.6);border-radius:999px;padding:0 12px;font:500 12px Fredoka,system-ui,sans-serif;color:#c9d6f2;opacity:1}
.pr-skin.locked button.sound{color:#c9d6f2}
.pr-circuits-test{margin:0 16px 10px;padding:6px 10px;border-radius:10px;border:1px dashed #ffb347;color:#ffd9a6;font-size:12px}
.pr-skin button{margin-top:6px;min-height:40px;min-width:110px;border-radius:12px;border:1px solid var(--skin);background:transparent;color:#e8f6ff;font:600 14px Fredoka,system-ui,sans-serif;cursor:pointer}
.pr-skin button:disabled{cursor:default;border-color:rgba(143,163,204,.3);color:#8fa3cc}
.pr-skin.equipped button{background:var(--skin);color:#07122a;border-color:var(--skin)}
.pr-circuits-back:focus-visible,.pr-skin button:focus-visible{outline:3px solid #fff;outline-offset:2px}
`;
const BACK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
const NS = 'http://www.w3.org/2000/svg';
const el = (name, attrs = {}) => { const n = document.createElementNS(NS, name); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };

function polygon(cx, cy, r, sides, rotate = -Math.PI / 2) {
  return Array.from({ length: sides }, (_, i) => { const a = rotate + i * 2 * Math.PI / sides; return `${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`; }).join(' ');
}
function sourceShape(shape, cx, cy, color) {
  const stroke = { fill: 'none', stroke: color, 'stroke-width': 3.5, 'stroke-linejoin': 'round' };
  if (shape === 'hex') return [el('polygon', { points: polygon(cx, cy, 11, 6, 0), ...stroke })];
  if (shape === 'triangle') return [el('polygon', { points: polygon(cx, cy + 1.5, 12.5, 3), ...stroke })];
  if (shape === 'diamond') return [el('polygon', { points: polygon(cx, cy, 12, 4), ...stroke })];
  if (shape === 'double') return [el('circle', { cx, cy, r: 11, ...stroke }), el('circle', { cx, cy, r: 6, ...stroke })];
  if (shape === 'star') {
    const pts = Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 5.5 : 12.5; return `${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`; }).join(' ');
    return [el('polygon', { points: pts, ...stroke })];
  }
  return [el('circle', { cx, cy, r: 10, ...stroke })];
}

// A three-tile strip: Source, path with the skin's effect, Exit.
function preview(skin, locked) {
  const svg = el('svg', { viewBox: '0 0 150 64', class: 'preview', 'aria-hidden': 'true' });
  const color = locked ? '#5d6a8f' : skin.accent;
  for (let i = 0; i < 3; i++) svg.append(el('rect', { x: 6 + i * 48, y: 10, width: 42, height: 42, rx: 8, fill: '#26304f' }));
  const line = el('line', { x1: 27, y1: 31, x2: 123, y2: 31, stroke: color, 'stroke-width': 6, 'stroke-linecap': 'round' });
  if (skin.hueShift && !locked) {
    const id = `g-${skin.id}`;
    // User-space units: a gradient sized to a perfectly flat line's box would collapse to nothing.
    const grad = el('linearGradient', { id, gradientUnits: 'userSpaceOnUse', x1: 27, y1: 31, x2: 123, y2: 31 }); grad.append(el('stop', { offset: '0', 'stop-color': skin.accent }), el('stop', { offset: '1', 'stop-color': '#7aa8ff' }));
    const defs = el('defs'); defs.append(grad); svg.append(defs);
    line.setAttribute('stroke', `url(#${id})`);
  }
  svg.append(line);
  if (!locked && skin.burst === 'ring') svg.append(el('circle', { cx: 75, cy: 31, r: 13, fill: 'none', stroke: color, 'stroke-width': 2, opacity: 0.6 }));
  if (!locked && skin.burst === 'spark') for (const [x, y] of [[66, 18], [84, 15], [76, 46], [92, 22]]) svg.append(el('circle', { cx: x, cy: y, r: 2.2, fill: color }));
  svg.append(el('circle', { cx: 100, cy: 31, r: 6 * (skin.headScale ?? 1), fill: locked ? '#8fa3cc' : skin.head }));
  svg.append(...sourceShape(skin.source, 27, 31, color));
  svg.append(el('rect', { x: 113, y: 21, width: 20, height: 20, rx: 3, fill: 'none', stroke: '#ff8ac9', 'stroke-width': 3.5 }));
  return svg;
}

export function createCircuitsScreen({ root, gameId, available, unlockAll = false, getEquipped, onEquip, onPreview = () => {}, onClose = () => {} }) {
  const style = document.createElement('style'); style.textContent = CSS;
  const panel = document.createElement('div');
  panel.className = 'pr-circuits';
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-label', 'Circuits');
  panel.innerHTML = `
    <div class="pr-circuits-head">
      <button class="pr-circuits-back" type="button" aria-label="Back">${BACK}</button>
      <h2>Circuits</h2>
      <div class="pr-circuits-total"></div>
    </div>
    <p class="pr-circuits-intro">Earn stars to unlock new circuits. Each changes the pulse colour, the Source and the pulse effect.</p>
    <p class="pr-circuits-test" hidden>Testing build: every circuit is unlocked. A release starts with Classic only.</p>
    <div class="pr-circuits-body"></div>`;
  panel.querySelector('.pr-circuits-test').hidden = !unlockAll;
  root.append(style, panel);
  const body = panel.querySelector('.pr-circuits-body'), total = panel.querySelector('.pr-circuits-total');
  const back = panel.querySelector('.pr-circuits-back');
  let opener = null;

  function render() {
    const stars = totalStars(readProgress(gameId).levels);
    const equipped = getEquipped();
    total.replaceChildren();
    const b = document.createElement('b'); b.textContent = `${stars} ★`;
    total.append(b, document.createTextNode(rankFor(stars, available)));
    body.replaceChildren(...SKINS.map(skin => {
      const open = isUnlocked(skin, stars, unlockAll), isOn = open && skin.id === equipped;
      const card = document.createElement('article');
      card.className = 'pr-skin' + (isOn ? ' equipped' : '') + (open ? '' : ' locked');
      card.style.setProperty('--skin', open ? skin.accent : '#5d6a8f');
      const h = document.createElement('h3'); h.textContent = skin.name;
      const p = document.createElement('p'); p.textContent = skin.effect;
      // Locked circuits can be heard too, as a reason to earn them.
      const snd = document.createElement('button'); snd.type = 'button'; snd.className = 'sound'; snd.textContent = '♪ ' + skin.sound;
      snd.setAttribute('aria-label', `Hear the ${skin.name} pulse and node chime: ${skin.sound}`);
      snd.addEventListener('click', () => onPreview(skin));
      const btn = document.createElement('button'); btn.type = 'button';
      if (!open) { btn.disabled = true; btn.textContent = `🔒 ${skin.stars} ★`; btn.setAttribute('aria-label', `${skin.name}: unlocks at ${skin.stars} stars, ${skin.stars - stars} to go`); }
      else if (isOn) { btn.textContent = 'Equipped'; btn.setAttribute('aria-pressed', 'true'); }
      else { btn.textContent = 'Equip'; btn.addEventListener('click', () => { onEquip(skin.id); render(); }); }
      card.append(preview(skin, !open), h, p, snd, btn);
      return card;
    }));
  }

  const close = () => { if (!panel.classList.contains('show')) return; panel.classList.remove('show'); opener?.focus?.({ preventScroll: true }); };
  const onKey = event => { if (event.key === 'Escape' && panel.classList.contains('show')) { event.stopPropagation(); close(); onClose(); } };
  back.addEventListener('click', () => { close(); onClose(); });
  document.addEventListener('keydown', onKey, true);
  return {
    open() { opener = document.activeElement; render(); panel.classList.add('show'); back.focus({ preventScroll: true }); },
    close,
    dispose() { document.removeEventListener('keydown', onKey, true); panel.remove(); style.remove(); }
  };
}
