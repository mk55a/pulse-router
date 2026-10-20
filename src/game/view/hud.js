// Pulse Router — HUD: energy cells, node counter, Undo / Clear / Pulse / Hint,
// failure labels, first-time prompts and the win banner. DOM only; text via textContent.

const CSS = `
.pr-hud{position:absolute;inset:0;pointer-events:none;z-index:2;font-family:Fredoka,system-ui,sans-serif;color:#e8f6ff;display:flex;flex-direction:column;justify-content:space-between}
.pr-top{display:flex;flex-direction:column;align-items:center;gap:6px;padding:68px 12px 0}
.pr-stats{display:flex;align-items:center;gap:12px;background:rgba(9,14,33,.72);border:1px solid rgba(101,231,255,.25);border-radius:999px;padding:6px 14px}
.pr-cells{display:flex;flex-wrap:nowrap;gap:3px;max-width:min(58vw,300px);min-width:0;flex:0 1 auto}
.pr-cell{width:9px;flex:0 1 auto;min-width:2px;height:16px;border-radius:3px;background:#65e7ff;box-shadow:0 0 6px rgba(101,231,255,.7)}
.pr-cell.spent{background:#26304f;box-shadow:none}
.pr-cell.over{background:transparent;border:1.5px dashed #ffb347;box-shadow:none;width:6px}
.pr-cells.dense{gap:2px}
.pr-cells.dense .pr-cell{width:5px}
.pr-cells.dense .pr-cell.over{width:3px}
.pr-energy-num{font-weight:600;font-size:15px;min-width:42px;text-align:right;font-variant-numeric:tabular-nums}
.pr-energy-num.short{color:#ffb347}
.pr-exact{font-size:11px;font-weight:700;letter-spacing:.8px;color:#07122a;background:#ffb347;border-radius:6px;padding:2px 6px}
.pr-exact[hidden]{display:none}
.pr-energy-num.exact-ok{color:#65e7ff}
.pr-nodes{display:flex;align-items:center;gap:5px;font-weight:600;font-size:15px;font-variant-numeric:tabular-nums}
.pr-nodes svg{width:14px;height:18px}
.pr-cap{display:flex;gap:1px;font-size:13px;color:#ffd36b;font-style:normal}
.pr-cap i{font-style:normal;transition:color .3s,opacity .3s}
.pr-cap i.lost{color:#3a4466}
.pr-cap.drop{animation:pr-cap-drop .5s ease}
@keyframes pr-cap-drop{0%,100%{transform:none}20%{transform:translateX(-3px)}40%{transform:translateX(3px)}60%{transform:translateX(-2px)}80%{transform:translateX(2px)}}
.pr-fail small.cap{color:#ff8a7a;font-weight:600}
.pr-msg{min-height:30px;display:flex;flex-direction:column;align-items:center;text-align:center}
.pr-prompt{font-size:15px;font-weight:500;background:rgba(9,14,33,.72);padding:5px 14px;border-radius:999px;opacity:0;transition:opacity .3s}
.pr-prompt.show{opacity:1}
.pr-fail{font-size:30px;font-weight:700;letter-spacing:.5px;color:#ffb347;text-shadow:0 2px 14px rgba(255,179,71,.45);opacity:0;transform:translateY(6px);transition:opacity .2s,transform .2s}
.pr-fail.show{opacity:1;transform:none}
.pr-fail small{display:block;font-size:14px;font-weight:500;color:#ffd9a6;letter-spacing:0}
.pr-fail small.quip{font-size:13px;font-style:italic;color:#b99bff;margin-top:2px}
.pr-win{font-size:28px;font-weight:700;color:#dffaff;text-shadow:0 0 18px rgba(101,231,255,.8);opacity:0;transition:opacity .25s}
.pr-win.show{opacity:1}
.pr-win .stars{font-size:34px;letter-spacing:4px}
.pr-win .stars .off{color:#3a4466;text-shadow:none}
.pr-win small{display:block;font-size:14px;font-weight:500;color:#b99bff}
.pr-bottom{display:flex;justify-content:center;align-items:center;gap:10px;padding:0 12px calc(28px + env(safe-area-inset-bottom,0px))}
.pr-btn{pointer-events:auto;min-width:56px;min-height:52px;border-radius:16px;border:1px solid rgba(101,231,255,.35);background:rgba(18,26,54,.9);color:#e8f6ff;font:600 15px Fredoka,system-ui,sans-serif;padding:0 12px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px}
.pr-btn:disabled{opacity:.4;cursor:default}
.pr-btn:focus-visible{outline:3px solid #65e7ff;outline-offset:2px}
.pr-btn svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.pr-pulse{min-width:112px;min-height:60px;font-size:20px;border-radius:20px;background:linear-gradient(180deg,#65e7ff,#2fb7d8);color:#07122a;border:none;box-shadow:0 0 22px rgba(101,231,255,.55)}
.pr-pulse:disabled{box-shadow:none}
.pr-hint{border-color:#b99bff;color:#e4d9ff;box-shadow:0 0 14px rgba(185,155,255,.45)}
.pr-hint[hidden]{display:none}
@media (prefers-reduced-motion:reduce){.pr-prompt,.pr-fail,.pr-win{transition:none}}
`;

const ICONS = {
  undo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
  clear: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  hint: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg>'
};

export function createHud(container, { onUndo, onClear, onPulse, onHint }) {
  const style = document.createElement('style'); style.textContent = CSS;
  const root = document.createElement('div'); root.className = 'pr-hud';
  root.innerHTML = `
    <div class="pr-top">
      <div class="pr-stats" role="group" aria-label="Energy and nodes">
        <span class="pr-exact" hidden title="End on exactly 0 energy">EXACT</span>
        <div class="pr-cells" aria-hidden="true"></div>
        <span class="pr-energy-num" aria-live="polite"></span>
        <span class="pr-nodes"><svg viewBox="0 0 14 18" aria-hidden="true"><path d="M7 0 14 9 7 18 0 9z" fill="#b99bff"/></svg><span class="pr-nodes-num"></span></span>
        <span class="pr-cap" role="img" aria-label="Up to 3 stars this attempt"><i>★</i><i>★</i><i>★</i></span>
      </div>
      <div class="pr-msg" aria-live="assertive">
        <span class="pr-prompt"></span>
        <span class="pr-fail"></span>
        <span class="pr-win"></span>
      </div>
    </div>
    <div class="pr-bottom">
      <button class="pr-btn pr-undo" type="button" aria-label="Undo (Backspace)">${ICONS.undo}<span>Undo</span></button>
      <button class="pr-btn pr-clear" type="button" aria-label="Clear path">${ICONS.clear}<span>Clear</span></button>
      <button class="pr-btn pr-pulse" type="button" aria-label="Send the pulse (Enter)">Pulse</button>
      <button class="pr-btn pr-hint" type="button" hidden aria-label="Show a hint">${ICONS.hint}<span>Hint</span></button>
    </div>`;
  container.append(style, root);
  const $ = s => root.querySelector(s);
  const cellsEl = $('.pr-cells'), energyNum = $('.pr-energy-num'), nodesNum = $('.pr-nodes-num');
  const prompt = $('.pr-prompt'), fail = $('.pr-fail'), win = $('.pr-win');
  const buttons = { undo: $('.pr-undo'), clear: $('.pr-clear'), pulse: $('.pr-pulse'), hint: $('.pr-hint') };
  // Mouse/touch clicks drop focus so arrow keys keep driving the path.
  const wrap = fn => event => { if (event.detail > 0) event.currentTarget.blur(); fn(); };
  const handlers = [[buttons.undo, wrap(onUndo)], [buttons.clear, wrap(onClear)], [buttons.pulse, wrap(onPulse)], [buttons.hint, wrap(onHint)]];
  for (const [el, fn] of handlers) el.addEventListener('click', fn);
  const exactTag = $('.pr-exact'), capEl = $('.pr-cap');
  let budgetShown = -1, exact = false;

  return {
    setExact(on) { exact = !!on; exactTag.hidden = !exact; },
    setEnergy({ budget, left, short }) {
      if (budgetShown !== budget + short) {
        cellsEl.replaceChildren(...Array.from({ length: budget + short }, () => { const d = document.createElement('i'); d.className = 'pr-cell'; return d; }));
        budgetShown = budget + short;
        cellsEl.classList.toggle('dense', budgetShown > 16);
      }
      const kids = cellsEl.children;
      for (let i = 0; i < kids.length; i++) kids[i].className = 'pr-cell' + (i >= budget ? ' over' : i >= Math.max(0, left) ? ' spent' : '');
      // Exact levels count down to the target of 0; others show what is left of the budget.
      energyNum.textContent = short > 0 ? `${short} short` : exact ? (left === 0 ? '0 ✓' : `${left} left`) : `${left}/${budget}`;
      energyNum.classList.toggle('short', short > 0);
      energyNum.classList.toggle('exact-ok', exact && short === 0 && left === 0);
    },
    setNodes(lit, total) { nodesNum.textContent = `${lit}/${total}`; },
    setPrompt(text) { prompt.textContent = text || ''; prompt.classList.toggle('show', !!text); },
    setCap(n, dropped) {
      capEl.querySelectorAll('i').forEach((star, i) => star.classList.toggle('lost', i >= n));
      capEl.setAttribute('aria-label', `Up to ${n} star${n === 1 ? '' : 's'} this attempt`);
      capEl.classList.remove('drop');
      if (dropped) { void capEl.offsetWidth; capEl.classList.add('drop'); }
    },
    showFailure(word, detail, quip, capNote) {
      fail.replaceChildren(document.createTextNode(word));
      if (detail) { const s = document.createElement('small'); s.textContent = detail; fail.append(s); }
      if (quip) { const q = document.createElement('small'); q.className = 'quip'; q.textContent = quip; fail.append(q); }
      if (capNote) { const n = document.createElement('small'); n.className = 'cap'; n.textContent = capNote; fail.append(n); }
      fail.classList.add('show');
    },
    hideFailure() { fail.classList.remove('show'); },
    showWin({ stars, label, clean }) {
      const s = document.createElement('span'); s.className = 'stars'; s.setAttribute('aria-label', `${stars} of 3 stars`);
      for (let i = 0; i < 3; i++) { const st = document.createElement('span'); st.textContent = '★'; if (i >= stars) st.className = 'off'; s.append(st); }
      const small = document.createElement('small'); small.textContent = label + (clean ? ' · Clean Pulse' : '');
      win.replaceChildren(s, small); win.classList.add('show');
    },
    hideWin() { win.classList.remove('show'); },
    setBusy(busy) { for (const k of ['undo', 'clear', 'pulse', 'hint']) buttons[k].disabled = busy; },
    setPulseReady(ready) { buttons.pulse.disabled = !ready; },
    showHint(visible) { buttons.hint.hidden = !visible; },
    setVisible(v) { root.style.display = v ? '' : 'none'; },
    dispose() { for (const [el, fn] of handlers) el.removeEventListener('click', fn); root.remove(); style.remove(); }
  };
}
