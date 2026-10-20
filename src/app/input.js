// Keyboard actions and pointer drags for gameplay. Nothing is captured until gameplay binds it,
// keys typed into buttons and form fields are ignored, and everything held is released when the
// game pauses or the window loses focus.
export function createInput({ isActive = () => true } = {}) {
  const actions = new Map(); // action -> { codes, preventDefault }
  const down = new Set();
  const drags = new Set();   // release functions for active pointer drags
  const inField = e => e.target?.closest?.('button, input, select, textarea, [contenteditable="true"]');
  const bound = code => [...actions.values()].find(a => a.codes.includes(code));

  const onKeyDown = e => {
    if (!isActive() || inField(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    const action = bound(e.code); if (!action) return;
    if (action.preventDefault) e.preventDefault();
    down.add(e.code);
  };
  const onKeyUp = e => down.delete(e.code);
  const release = () => { down.clear(); for (const r of [...drags]) r(); };
  addEventListener('keydown', onKeyDown);
  addEventListener('keyup', onKeyUp);
  addEventListener('blur', release);

  return {
    bind(name, codes, { preventDefault = false } = {}) {
      actions.set(name, { codes: [...codes], preventDefault });
      return () => { actions.delete(name); release(); };
    },
    isDown(name) { const a = actions.get(name); return !!a && isActive() && a.codes.some(c => down.has(c)); },
    // One pointer at a time on `el`; positions are relative to the element.
    pointer(el, { start = () => {}, move = () => {}, end = () => {}, cancel = () => {}, preventDefault = false } = {}) {
      let id = null;
      const at = e => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, width: r.width, height: r.height, pointerType: e.pointerType }; };
      const stopDrag = () => { if (id === null) return; try { el.releasePointerCapture(id); } catch {} id = null; drags.delete(stopDrag); cancel(); };
      const onDown = e => {
        if (!isActive() || id !== null || e.button !== 0) return;
        id = e.pointerId; drags.add(stopDrag);
        try { el.setPointerCapture(id); } catch {}
        if (preventDefault) e.preventDefault();
        start(at(e));
      };
      const onMove = e => { if (e.pointerId !== id) return; if (preventDefault) e.preventDefault(); if (isActive()) move(at(e)); };
      const onUp = e => {
        if (e.pointerId !== id) return;
        try { el.releasePointerCapture(id); } catch {}
        id = null; drags.delete(stopDrag);
        if (isActive()) end(at(e)); else cancel();
      };
      const onCancel = e => { if (e.pointerId === id) stopDrag(); };
      const listeners = { pointerdown: onDown, pointermove: onMove, pointerup: onUp, pointercancel: onCancel, lostpointercapture: onCancel };
      for (const [type, fn] of Object.entries(listeners)) el.addEventListener(type, fn);
      if (preventDefault) el.style.touchAction = 'none';
      return () => { stopDrag(); for (const [type, fn] of Object.entries(listeners)) el.removeEventListener(type, fn); };
    },
    clear: release,
    dispose() { release(); actions.clear(); removeEventListener('keydown', onKeyDown); removeEventListener('keyup', onKeyUp); removeEventListener('blur', release); }
  };
}
