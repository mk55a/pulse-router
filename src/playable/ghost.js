// The tutorial "ghost finger": a glowing fingertip presses the Source, drags the route tile by
// tile leaving a trail, then taps the Pulse button, and loops until the player touches the board.
// Teaches the whole mechanic in about three seconds without any text.
const CSS = `
.pr-ghost{position:absolute;inset:0;z-index:4;pointer-events:none;opacity:0;transition:opacity .25s}
.pr-ghost.show{opacity:1}
.pr-ghost svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.pr-ghost .trail{fill:none;stroke:rgba(255,255,255,.55);stroke-width:7;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 0 6px #65e7ff)}
.pr-ghost .tip{fill:#fff;filter:drop-shadow(0 0 10px #65e7ff)}
.pr-ghost .ring{fill:none;stroke:#fff;stroke-width:3}
`;
const NS = 'http://www.w3.org/2000/svg';
const SEGMENT = 0.26, PRESS = 0.35, TAP = 0.5, REST = 0.7; // seconds

export function createGhost(container, { reducedMotion = () => false } = {}) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.append(style);
  const root = document.createElement('div'); root.className = 'pr-ghost'; root.setAttribute('aria-hidden', 'true');
  const svg = document.createElementNS(NS, 'svg');
  const trail = document.createElementNS(NS, 'polyline'); trail.setAttribute('class', 'trail');
  const ring = document.createElementNS(NS, 'circle'); ring.setAttribute('class', 'ring'); ring.setAttribute('r', '0');
  const tip = document.createElementNS(NS, 'circle'); tip.setAttribute('class', 'tip'); tip.setAttribute('r', '13');
  svg.append(trail, ring, tip); root.append(svg); container.append(root);
  let raf = 0, route = null, screenOf = null, button = null, start = 0;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!start) start = now;
    const pts = route.map(([r, c]) => screenOf(r, c)).filter(Boolean);
    if (pts.length < 2) return;
    const box = container.getBoundingClientRect(), b = button?.getBoundingClientRect();
    const target = b ? { x: b.left + b.width / 2 - box.left, y: b.top + b.height / 2 - box.top } : null;
    const drag = (pts.length - 1) * SEGMENT;
    const total = PRESS + drag + (target ? 0.45 + TAP : 0) + REST;
    let t = ((now - start) / 1000) % total;
    let pos = pts[0], drawn = [pts[0]], press = 0;
    if (t < PRESS) press = t / PRESS;
    else if ((t -= PRESS) < drag) {
      const i = Math.min(pts.length - 2, Math.floor(t / SEGMENT)), f = (t - i * SEGMENT) / SEGMENT;
      drawn = pts.slice(0, i + 1);
      pos = { x: pts[i].x + (pts[i + 1].x - pts[i].x) * f, y: pts[i].y + (pts[i + 1].y - pts[i].y) * f };
      drawn.push(pos); press = 1;
    } else {
      drawn = pts; t -= drag;
      const end = pts[pts.length - 1];
      if (target && t < 0.45) { const f = t / 0.45, e = f * f * (3 - 2 * f); pos = { x: end.x + (target.x - end.x) * e, y: end.y + (target.y - end.y) * e }; }
      else if (target && (t -= 0.45) < TAP) { pos = target; press = Math.sin(Math.PI * t / TAP); }
      else pos = target ?? end;
    }
    trail.setAttribute('points', drawn.map(p => `${p.x},${p.y}`).join(' '));
    tip.setAttribute('cx', pos.x); tip.setAttribute('cy', pos.y);
    tip.setAttribute('r', String(13 - press * 3));
    ring.setAttribute('cx', pos.x); ring.setAttribute('cy', pos.y);
    ring.setAttribute('r', String(14 + press * 12)); ring.setAttribute('opacity', String(press * 0.8));
  }
  return {
    // Show the route as cells [[r, c], ...]; screenOf maps a cell to container pixels.
    show(cells, toScreen, pulseButton) {
      route = cells; screenOf = toScreen; button = pulseButton; start = 0;
      cancelAnimationFrame(raf);
      root.classList.add('show');
      if (reducedMotion()) { const pts = cells.map(([r, c]) => toScreen(r, c)).filter(Boolean); trail.setAttribute('points', pts.map(p => `${p.x},${p.y}`).join(' ')); tip.setAttribute('cx', pts[0]?.x ?? 0); tip.setAttribute('cy', pts[0]?.y ?? 0); return; }
      raf = requestAnimationFrame(frame);
    },
    hide() { cancelAnimationFrame(raf); raf = 0; root.classList.remove('show'); },
    get visible() { return root.classList.contains('show'); }
  };
}
