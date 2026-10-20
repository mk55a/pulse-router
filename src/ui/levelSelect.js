// Pulse Router — level select: worlds of 12 levels, best stars per level, locked levels dimmed,
// and the player's rank. Presentation only: unlocks follow saved wins (the next level opens on any
// win) and the current level; stars are read from the game's own progress slot.
import { WORLD_INFO } from '../game/worlds.js';
import { readProgress } from '../game/progressStore.js';
import { rankFor } from '../game/rating.js';

const CSS = `
.pr-select{position:absolute;inset:0;z-index:30;display:none;flex-direction:column;background:#090e21;color:#e8f6ff;font-family:Fredoka,system-ui,sans-serif}
.pr-select.show{display:flex}
.pr-select-head{display:flex;align-items:center;gap:12px;padding:calc(16px + env(safe-area-inset-top,0px)) 16px 10px}
.pr-select-back{width:44px;height:44px;border-radius:14px;border:1px solid rgba(101,231,255,.35);background:rgba(18,26,54,.9);color:#e8f6ff;cursor:pointer;display:flex;align-items:center;justify-content:center}
.pr-select-back svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
.pr-select-back:focus-visible,.pr-level:focus-visible{outline:3px solid #65e7ff;outline-offset:2px}
.pr-select-title{font-size:24px;font-weight:700;margin:0;flex:1}
.pr-select-rank{text-align:right;font-size:13px;color:#b99bff;line-height:1.2}
.pr-select-rank b{display:block;font-size:17px;color:#e8f6ff}
.pr-select-body{flex:1;overflow-y:auto;padding:4px 16px calc(24px + env(safe-area-inset-bottom,0px))}
.pr-world{margin:14px 0 6px}
.pr-world h3{margin:0;font-size:18px;font-weight:700;display:flex;align-items:baseline;gap:8px}
.pr-world h3 span{font-size:13px;font-weight:500;color:#8fa3cc}
.pr-world p{margin:2px 0 10px;font-size:13px;color:#65e7ff}
.pr-world.locked p{color:#5d6a8f}
.pr-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.pr-level{min-height:68px;border-radius:16px;border:1px solid rgba(101,231,255,.3);background:linear-gradient(180deg,#1b2548,#121a36);color:#e8f6ff;font:700 20px Fredoka,system-ui,sans-serif;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:6px 0}
.pr-level.current{border-color:#65e7ff;box-shadow:0 0 14px rgba(101,231,255,.45)}
.pr-level:disabled{cursor:default;opacity:.38;border-color:rgba(143,163,204,.2)}
.pr-level .stars{font-size:12px;letter-spacing:1px;color:#ffd36b}
.pr-level .stars .off{color:#3a4466}
.pr-level svg{width:16px;height:16px;fill:none;stroke:#8fa3cc;stroke-width:2.2;stroke-linecap:round}
`;
const BACK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
const LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>';

export function createLevelSelect({ root, levels, gameId, getCurrent, onPick, onClose = () => {} }) {
  const style = document.createElement('style'); style.textContent = CSS;
  const panel = document.createElement('div');
  panel.className = 'pr-select';
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-label', 'Levels');
  panel.innerHTML = `
    <div class="pr-select-head">
      <button class="pr-select-back" type="button" aria-label="Back">${BACK}</button>
      <h2 class="pr-select-title">Levels</h2>
      <div class="pr-select-rank"></div>
    </div>
    <div class="pr-select-body"></div>`;
  root.append(style, panel);
  const body = panel.querySelector('.pr-select-body'), rankEl = panel.querySelector('.pr-select-rank');
  const back = panel.querySelector('.pr-select-back');
  let opener = null;

  function render() {
    const progress = readProgress(gameId);
    const saved = progress.levels;
    const playing = getCurrent();
    const current = Math.max(playing, progress.reached ?? 1);
    const worlds = new Map();
    levels.order.forEach((id, i) => {
      const def = levels.get(i + 1);
      const w = def.world ?? 1;
      if (!worlds.has(w)) worlds.set(w, []);
      worlds.get(w).push({ number: i + 1, def, best: saved[id] });
    });
    let earned = 0;
    for (const id of levels.order) earned += saved[id]?.stars ?? 0;
    const available = levels.order.length * 3;
    rankEl.replaceChildren(document.createTextNode(`${earned}/${available} ★`));
    const rank = document.createElement('b'); rank.textContent = rankFor(earned, available); rankEl.prepend(rank);

    // The next level opens on any win; the current level is always open.
    const unlocked = n => n === 1 || n <= current || !!saved[levels.order[n - 2]];
    const sections = [];
    for (const [w, list] of worlds) {
      const info = WORLD_INFO[w] ?? { name: `World ${w}`, rule: '' };
      const section = document.createElement('section');
      section.className = 'pr-world' + (unlocked(list[0].number) ? '' : ' locked');
      const h = document.createElement('h3'); h.textContent = info.name;
      const sub = document.createElement('span'); sub.textContent = `World ${w}`; h.append(sub);
      const p = document.createElement('p'); p.textContent = unlocked(list[0].number) ? info.rule : 'Finish the previous world to unlock';
      const grid = document.createElement('div'); grid.className = 'pr-grid';
      for (const { number, def, best } of list) {
        const btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'pr-level' + (number === playing ? ' current' : '');
        const open = unlocked(number);
        btn.disabled = !open;
        const label = document.createElement('span'); label.textContent = String(def.index ?? number);
        btn.append(label);
        if (!open) { btn.insertAdjacentHTML('beforeend', LOCK); btn.setAttribute('aria-label', `Level ${w}-${def.index ?? number}, locked`); }
        else {
          const stars = document.createElement('span'); stars.className = 'stars';
          for (let i = 0; i < 3; i++) { const s = document.createElement('span'); s.textContent = '★'; if (!best || i >= best.stars) s.className = 'off'; stars.append(s); }
          btn.append(stars);
          btn.setAttribute('aria-label', `Level ${w}-${def.index ?? number}, ${best ? best.stars + ' of 3 stars' : 'not won yet'}`);
          btn.addEventListener('click', () => onPick(number));
        }
        grid.append(btn);
      }
      section.append(h, p, grid);
      sections.push(section);
    }
    body.replaceChildren(...sections);
  }

  const onKey = event => { if (event.key === 'Escape' && panel.classList.contains('show')) { event.stopPropagation(); close(); onClose(); } };
  back.addEventListener('click', () => { close(); onClose(); });
  document.addEventListener('keydown', onKey, true);

  function open() {
    opener = document.activeElement;
    render();
    panel.classList.add('show');
    (body.querySelector('.pr-level.current') ?? back).focus({ preventScroll: true });
    body.querySelector('.pr-level.current')?.scrollIntoView({ block: 'center' });
  }
  function close() {
    if (!panel.classList.contains('show')) return;
    panel.classList.remove('show');
    opener?.focus?.({ preventScroll: true });
  }
  return {
    open, close,
    isOpen: () => panel.classList.contains('show'),
    dispose() { document.removeEventListener('keydown', onKey, true); panel.remove(); style.remove(); }
  };
}
