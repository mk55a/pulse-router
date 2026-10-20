// Pulse Router — the win screen. A neon "Circuit closed" flash, then the card: the level as a
// kicker, the themed line as the title, and the stars on a circuit trace. A pulse runs from a
// Source ring to an Exit and lights each star earned as it passes (like lighting nodes in a
// level), in the equipped circuit's colour. Then energy against par, Clean Pulse, and the actions.
const CSS = `
.pr-flash{position:absolute;inset:0;z-index:30;display:grid;place-items:center;pointer-events:none}
.pr-flash[hidden]{display:none}
.pr-flash span{font-size:clamp(30px,9vw,44px);font-weight:700;letter-spacing:6px;text-transform:uppercase;color:#f1f7ff;text-shadow:0 0 24px var(--pr-accent),0 0 4px var(--pr-accent);animation:pr-flash 1.1s ease forwards}
@keyframes pr-flash{0%{opacity:0;transform:scale(.9);filter:blur(6px)}25%{opacity:1;transform:none;filter:none}75%{opacity:1}100%{opacity:0;transform:translateY(-8px)}}
.pr-result-screen{position:absolute;inset:0;z-index:31;display:flex;align-items:center;justify-content:center;padding:24px 16px calc(24px + env(safe-area-inset-bottom,0px));background:radial-gradient(ellipse at 50% 42%,rgba(21,34,69,.94) 0%,rgba(6,9,20,.97) 70%);backdrop-filter:blur(6px);animation:pr-fade-in .3s ease}
.pr-result-screen[hidden]{display:none}
.pr-result-screen::before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(70,96,160,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(70,96,160,.07) 1px,transparent 1px);background-size:28px 28px;pointer-events:none}
@keyframes pr-fade-in{from{opacity:0}to{opacity:1}}
.pr-result-card{position:relative;width:100%;max-width:420px;display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center}
.pr-result-kicker{font-size:12px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:var(--pr-accent)}
.pr-result-title{margin:0 0 4px;font-size:clamp(32px,9vw,46px);font-weight:700;letter-spacing:.5px;color:#f1f7ff;text-shadow:0 0 22px color-mix(in srgb,var(--pr-accent) 60%,transparent);animation:pr-title-in .5s cubic-bezier(.2,1.3,.4,1) both}
@keyframes pr-title-in{from{opacity:0;transform:translateY(10px) scale(.96);filter:blur(4px)}to{opacity:1;transform:none;filter:none}}
.pr-trace{width:min(100%,340px);height:auto;overflow:visible}
.pr-trace .base{stroke:#1e2a52;stroke-width:4;stroke-linecap:round;fill:none}
.pr-trace .lit{stroke:var(--pr-accent);stroke-width:4;stroke-linecap:round;fill:none;filter:drop-shadow(0 0 5px var(--pr-accent))}
.pr-trace .src{fill:none;stroke:var(--pr-accent);stroke-width:4}
.pr-trace .exit{fill:none;stroke:#3a4466;stroke-width:4;transition:stroke .2s}
.pr-trace .exit.on{stroke:#ff8ac9;filter:drop-shadow(0 0 6px #ff8ac9)}
.pr-trace .star path{fill:#151d3f;stroke:#3a4466;stroke-width:1.6;transition:fill .15s,stroke .15s}
.pr-trace .star{transform-box:fill-box;transform-origin:center}
.pr-trace .star.on path{fill:#ffd36b;stroke:#fff1c4}
.pr-trace .star.on{filter:drop-shadow(0 0 8px rgba(255,211,107,.75))}
.pr-trace .star.pop{animation:pr-star-pop .42s cubic-bezier(.3,1.7,.5,1)}
.pr-trace .star.miss path{stroke:#2a3558}
@keyframes pr-star-pop{0%{transform:scale(.55)}100%{transform:scale(1)}}
.pr-trace .head{fill:#fff;filter:drop-shadow(0 0 6px var(--pr-accent))}
.pr-trace .ring{fill:none;stroke:#ff8ac9;stroke-width:2}
.pr-result-rating{font-size:13px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#b99bff}
.pr-result-stats{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.pr-result-stat{background:rgba(13,21,48,.9);border:1px solid #2a3966;border-radius:10px;padding:6px 12px;font-size:13px;color:#c9d6f2;font-variant-numeric:tabular-nums}
.pr-result-stat b{color:#f1f7ff}
.pr-result-stat.capped{border-color:rgba(255,77,94,.55);color:#ffb3ba}
.pr-result-stat.capped::after{content:" · cost a star";color:#ff8a7a}
.pr-result-badge{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:5px 12px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#07122a;background:var(--pr-accent);box-shadow:0 0 16px color-mix(in srgb,var(--pr-accent) 55%,transparent)}
.pr-result-badge svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}
.pr-result-badge.missed{background:transparent;color:#8fa3cc;border:1px dashed #3a4466;box-shadow:none;font-weight:500;letter-spacing:0;text-transform:none}
.pr-result-actions{display:flex;flex-direction:column;align-items:stretch;gap:10px;margin-top:22px;width:min(100%,300px)}
.pr-result-row{display:flex;gap:10px}
.pr-result-row>button{flex:1}
.pr-result-next{min-height:54px;border-radius:14px;border:none;background:linear-gradient(180deg,var(--pr-accent),color-mix(in srgb,var(--pr-accent) 75%,#07122a));color:#07122a;font-size:18px;font-weight:700;box-shadow:0 0 22px color-mix(in srgb,var(--pr-accent) 45%,transparent);animation:pr-next-in .4s cubic-bezier(.2,1.4,.4,1) .35s both}
@keyframes pr-next-in{from{opacity:0;transform:scale(.9)}to{opacity:1;transform:none}}
.pr-result-next::after{content:"  ›"}
.pr-result-alt{min-height:46px;padding:0 14px;border-radius:12px;border:1px solid #2a3966;background:rgba(13,21,48,.92);color:#e8f6ff;font-size:15px;font-weight:600;display:inline-flex;align-items:center;justify-content:center;gap:6px}
.pr-result-alt.gold{border-color:rgba(255,211,107,.6);color:#ffd36b}
.pr-result-alt svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.pr-result-next:focus-visible,.pr-result-alt:focus-visible{outline:3px solid #fff;outline-offset:2px}
@media (prefers-reduced-motion:reduce){.pr-flash span,.pr-result-title,.pr-result-next,.pr-result-screen{animation-duration:1ms}}
`;
const STAR_D = 'M0 -17 L5 -6 L17 -5 L8 3 L10 16 L0 9 L-10 16 L-8 3 L-17 -5 L-5 -6 Z';
const BOLT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>';
const HOME = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9"/></svg>';
const RATING = { 1: 'Win', 2: 'Efficient', 3: 'Perfect' };
const NS = 'http://www.w3.org/2000/svg';
const el = (name, attrs = {}) => { const n = document.createElementNS(NS, name); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };
const html = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
// Trace layout in SVG units: Source, three stars, Exit.
const X0 = 22, STARS = [100, 170, 240], X1 = 312, Y = 44, RUN = 1.25; // seconds for the pulse to cross
const FLASH = 1.1;

export function createResultScreen({ root, onNext, onRetry, onHome, onStar = () => {}, sound = () => {}, reducedMotion = () => false }) {
  const style = html('style'); style.textContent = CSS; document.head.append(style);
  const flash = html('div', 'pr-flash'); flash.hidden = true; flash.setAttribute('aria-hidden', 'true');
  const screen = html('div', 'pr-result-screen'); screen.hidden = true;
  screen.setAttribute('role', 'dialog'); screen.setAttribute('aria-modal', 'true'); screen.setAttribute('aria-labelledby', 'prResultTitle');
  const card = html('div', 'pr-result-card');
  screen.append(card);
  root.append(flash, screen);
  let raf = 0, timer = 0;

  function trace(stars) {
    const svg = el('svg', { viewBox: '0 0 334 88', class: 'pr-trace', role: 'img', 'aria-label': `${stars} of 3 stars` });
    svg.append(el('line', { x1: X0, y1: Y, x2: X1, y2: Y, class: 'base' }));
    const lit = el('line', { x1: X0, y1: Y, x2: X0, y2: Y, class: 'lit' }); svg.append(lit);
    svg.append(el('circle', { cx: X0, cy: Y, r: 11, class: 'src' }));
    const exit = el('rect', { x: X1 - 9, y: Y - 9, width: 18, height: 18, rx: 3, class: 'exit' }); svg.append(exit);
    // Position on an outer group, pop on the inner one (a CSS transform would replace the SVG translate).
    const starEls = STARS.map(x => { const at = el('g', { transform: `translate(${x} ${Y})` }), g = el('g', { class: 'star' }); g.append(el('path', { d: STAR_D })); at.append(g); svg.append(at); return g; });
    const head = el('circle', { cx: X0, cy: Y, r: 5, class: 'head' }); svg.append(head);
    return { svg, lit, exit, starEls, head };
  }
  function run(t, stars) {
    const light = (i, animate) => {
      const s = t.starEls[i];
      if (i < stars) { s.classList.add('on'); if (animate) { s.classList.add('pop'); onStar(i); } } else s.classList.add('miss');
    };
    if (reducedMotion()) { t.lit.setAttribute('x2', X1); t.head.setAttribute('opacity', '0'); t.starEls.forEach((_, i) => light(i, false)); t.exit.classList.add('on'); return; }
    let start = 0, passed = 0;
    const step = now => {
      if (!start) start = now + 180; // a beat after the card appears
      const u = Math.min(1, Math.max(0, (now - start) / 1000) / RUN);
      const x = X0 + (X1 - X0) * (0.25 * u + 0.75 * u * u); // eases in, like the in-game pulse
      t.lit.setAttribute('x2', x); t.head.setAttribute('cx', x);
      while (passed < STARS.length && x >= STARS[passed]) light(passed++, true);
      if (u < 1) { raf = requestAnimationFrame(step); return; }
      t.exit.classList.add('on'); t.head.setAttribute('opacity', '0');
      const ring = el('circle', { cx: X1, cy: Y, r: 10, class: 'ring' }); t.svg.append(ring);
      ring.animate([{ r: 10, opacity: 0.9 }, { r: 30, opacity: 0 }], { duration: 600, easing: 'ease-out', fill: 'forwards' });
    };
    raf = requestAnimationFrame(step);
  }
  function build(summary, { kicker, nextLabel }) {
    const { stars, clean, used, par, budget, exact } = summary;
    const k = html('div', 'pr-result-kicker', kicker);
    const title = html('h2', 'pr-result-title', summary.line); title.id = 'prResultTitle';
    const t = trace(stars);
    const rating = html('div', 'pr-result-rating', RATING[stars] ?? '');
    const stats = html('div', 'pr-result-stats');
    const stat = (label, value) => { const s = html('span', 'pr-result-stat', label + ' '); s.append(html('b', null, value)); return s; };
    if (exact) stats.append(stat('Energy', `${used} of ${budget}`), stat('Ended on', '0'));
    else stats.append(stat('Energy used', String(used)), stat('Par', String(par)));
    // Every two failed pulses lowered this attempt's best possible result.
    if (summary.fails > 0) { const f = stat('Failed pulses', String(summary.fails)); if (summary.capped) f.classList.add('capped'); stats.append(f); }
    const badge = html('span', 'pr-result-badge' + (clean ? '' : ' missed'));
    if (clean) { badge.innerHTML = BOLT; badge.append('Clean Pulse'); } else badge.textContent = 'Clean Pulse: win without a failed pulse or hint';
    const actions = html('div', 'pr-result-actions');
    const next = html('button', 'pr-result-next', nextLabel); next.type = 'button'; next.addEventListener('click', onNext);
    const row = html('div', 'pr-result-row');
    const home = html('button', 'pr-result-alt'); home.type = 'button'; home.innerHTML = HOME; home.append('Home'); home.addEventListener('click', onHome);
    row.append(home);
    if (stars < 3) { const retry = html('button', 'pr-result-alt gold', exact ? 'Retry' : 'Retry for ★★★'); retry.type = 'button'; retry.addEventListener('click', onRetry); row.append(retry); }
    actions.append(next, row);
    card.replaceChildren(k, title, t.svg, rating, stats, badge, actions);
    return { t, next };
  }

  return {
    show(summary, options) {
      this.hide();
      root.style.setProperty('--pr-accent', summary.accent ?? '#65e7ff');
      flash.replaceChildren(html('span', null, 'Circuit closed'));
      flash.hidden = false;
      sound('flourish');
      timer = setTimeout(() => {
        flash.hidden = true;
        const { t, next } = build(summary, options);
        screen.hidden = false;
        sound('reveal');
        run(t, summary.stars);
        next.focus({ preventScroll: true });
      }, reducedMotion() ? 300 : FLASH * 1000);
    },
    hide() { clearTimeout(timer); cancelAnimationFrame(raf); flash.hidden = true; screen.hidden = true; },
    get open() { return !screen.hidden || !flash.hidden; }
  };
}
