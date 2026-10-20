// Pulse Router — Home on a plain dark background (a soft glow, no moving backdrop): the logo, a
// Source-node Continue button, a rank plate with world progress, and the three nav buttons as
// pads on one trace (the board's own tile shapes), all in the equipped circuit's colour.
import { WORLD_INFO } from '../game/worlds.js';
import { readProgress } from '../game/progressStore.js';
import { RANKS, rankFor } from '../game/rating.js';
import { resolveSkin, totalStars } from '../game/skins.js';

const CSS = `
.home.active{display:flex;flex-direction:column;align-items:center;padding:calc(16px + env(safe-area-inset-top,0px)) 16px calc(118px + env(safe-area-inset-bottom,0px));background:radial-gradient(ellipse at 50% 38%,#152245 0%,#0a0f22 58%,#060914 100%)}
.home-settings{position:absolute;top:calc(16px + env(safe-area-inset-top,0px));right:16px;z-index:2}
.home-logo{width:min(80%,340px);margin-top:calc(40px + 2vh);filter:drop-shadow(0 0 14px rgb(101 231 255 / 25%))}
.home-mid{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:clamp(14px,3vh,26px);width:100%;max-width:420px}
/* Continue: the Source node. */
.continue{border:none;background:none;padding:0;display:flex;flex-direction:column;align-items:center;gap:10px;color:#e8f6ff}
.continue:active{transform:translateY(1px)}
.continue:focus-visible{outline:none}
.pr-node{position:relative;width:118px;height:118px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle,#123056 0%,#0b1631 62%);box-shadow:0 0 0 3px var(--pr-accent),0 0 28px color-mix(in srgb,var(--pr-accent) 55%,transparent),inset 0 0 22px color-mix(in srgb,var(--pr-accent) 35%,transparent)}
.pr-node::before{content:"";position:absolute;inset:-14px;border-radius:50%;border:1.5px solid color-mix(in srgb,var(--pr-accent) 45%,transparent);animation:pr-node-breathe 2.8s ease-in-out infinite}
.pr-node::after{content:"";position:absolute;inset:-14px;border-radius:50%;border:2px solid var(--pr-accent);opacity:0;animation:pr-node-ping 2.8s ease-out infinite}
.pr-node svg{width:42px;height:42px;margin-left:6px;fill:var(--pr-accent);filter:drop-shadow(0 0 8px var(--pr-accent))}
.continue:hover .pr-node,.continue:focus-visible .pr-node{box-shadow:0 0 0 3px #fff,0 0 36px var(--pr-accent),inset 0 0 26px color-mix(in srgb,var(--pr-accent) 45%,transparent)}
@keyframes pr-node-breathe{0%,100%{transform:scale(1);opacity:.55}50%{transform:scale(1.05);opacity:1}}
@keyframes pr-node-ping{0%{transform:scale(.9);opacity:.7}70%,100%{transform:scale(1.35);opacity:0}}
.continue-kicker{font-size:11px;font-weight:700;letter-spacing:4px;color:var(--pr-accent)}
.continue-level{font-size:22px;font-weight:700;letter-spacing:.5px;color:#f1f7ff;line-height:1}
.continue-world{font-size:13px;color:#8fa3cc;margin-top:-4px}
/* Rank plate: two stacked notched layers; the outer one is the 1.5px edge, the inner one the face. */
.pr-plate{--notch:12px;width:100%;max-width:330px;padding:1.5px;background:linear-gradient(135deg,var(--pr-accent),rgba(185,155,255,.45) 60%,rgba(42,57,102,.9));clip-path:polygon(var(--notch) 0,calc(100% - var(--notch)) 0,100% var(--notch),100% calc(100% - var(--notch)),calc(100% - var(--notch)) 100%,var(--notch) 100%,0 calc(100% - var(--notch)),0 var(--notch))}
.pr-plate-in{--notch:11.4px;padding:12px 16px 14px;background:linear-gradient(180deg,#151f47,#0b1230);clip-path:polygon(var(--notch) 0,calc(100% - var(--notch)) 0,100% var(--notch),100% calc(100% - var(--notch)),calc(100% - var(--notch)) 100%,var(--notch) 100%,0 calc(100% - var(--notch)),0 var(--notch))}
.pr-plate-top{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
.pr-rank-label{font-size:10px;letter-spacing:3px;color:#8fa3cc}
.pr-rank-name{font-size:24px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#f1f7ff}
.pr-stars-total{font-size:15px;font-weight:600;color:#ffd36b;font-variant-numeric:tabular-nums}
.pr-meter{height:6px;margin:8px 0 6px;border-radius:3px;background:#1e2a52;overflow:hidden}
.pr-meter i{display:block;height:100%;border-radius:3px;background:linear-gradient(90deg,var(--pr-accent),#b99bff);box-shadow:0 0 10px var(--pr-accent)}
.pr-rank-next{font-size:12px;color:#8fa3cc}
.pr-worlds{display:flex;gap:8px;margin-top:12px}
.pr-world-chip{flex:1;min-width:0}
.pr-world-chip b{display:block;font-size:11px;font-weight:600;color:#c9d6f2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pr-world-chip span{font-size:11px;color:#8fa3cc;font-variant-numeric:tabular-nums}
.pr-world-chip .bar{height:3px;margin-top:4px;border-radius:2px;background:#1e2a52}
.pr-world-chip .bar i{display:block;height:100%;border-radius:2px;background:var(--pr-accent)}
.pr-world-chip.locked b,.pr-world-chip.locked span{color:#4d5a80}
/* Nav: three pads joined by one trace, with a small pulse running along it. */
.home-nav{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(18px + env(safe-area-inset-bottom,0px));width:min(calc(100% - 32px),360px);display:flex}
.home-nav::before{content:"";position:absolute;left:16%;right:16%;top:27px;height:2px;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--pr-accent) 55%,#1e2a52) 15%,color-mix(in srgb,var(--pr-accent) 55%,#1e2a52) 85%,transparent)}
.home-nav::after{content:"";position:absolute;top:24px;left:16%;width:8px;height:8px;border-radius:50%;background:#fff;box-shadow:0 0 10px var(--pr-accent),0 0 3px #fff;animation:pr-trace-run 4.5s linear infinite;opacity:0}
@keyframes pr-trace-run{0%{left:16%;opacity:0}8%{opacity:1}45%{opacity:1}52%{left:82%;opacity:0}100%{left:82%;opacity:0}}
.nav-btn{position:relative;z-index:1;flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;padding:0;border:none;background:none;color:#8fa3cc}
.nav-btn .pad{width:54px;height:54px;display:grid;place-items:center;background:#0d1530;border:2px solid #2a3966;transition:border-color .2s,box-shadow .2s,background .2s}
.nav-btn .pad.square{border-radius:10px}
.nav-btn .pad.round{border-radius:50%}
.nav-btn .pad.diamond{width:44px;height:44px;margin:5px;transform:rotate(45deg);border-radius:8px}
.nav-btn .pad.diamond svg{transform:rotate(-45deg)}
.nav-btn svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.nav-btn span.label{font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase}
.nav-btn.active{color:#f1f7ff}
.nav-btn.active .pad{border-color:var(--pr-accent);background:color-mix(in srgb,var(--pr-accent) 18%,#0d1530);box-shadow:0 0 18px color-mix(in srgb,var(--pr-accent) 50%,transparent)}
.nav-btn:not(.active):hover .pad,.nav-btn:focus-visible .pad{border-color:color-mix(in srgb,var(--pr-accent) 70%,#2a3966)}
.nav-btn:focus-visible{outline:none}
@media (max-height:640px){.pr-node{width:92px;height:92px}.home-logo{width:min(64%,260px);margin-top:36px}.pr-worlds{display:none}}
@media (prefers-reduced-motion:reduce){.pr-node::before,.pr-node::after,.home-nav::after{animation:none}}
.pr-reduce .pr-node::before,.pr-reduce .pr-node::after,.pr-reduce .home-nav::after{animation:none}
`;
const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z"/></svg>';
const ICONS = {
  levels: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/></svg>',
  home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9"/></svg>',
  circuits: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="2.5"/><circle cx="19" cy="6" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="M7.5 12h4l5-5M11.5 12l5 5"/></svg>'
};

export function createHomeScreen({ screen, levels, gameId, levelLabel, getLevel, getSkinId, unlockAll = false, reducedMotion = () => false, onContinue, onLevels, onCircuits, onSettings }) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.append(style);
  const app = screen.closest('.app') ?? document.documentElement;
  screen.innerHTML = `
    <button class="icon-btn home-settings" type="button" aria-label="Settings"></button>
    <img class="home-logo" src="assets/images/pulse-router-logo.svg" alt="Pulse Router">
    <div class="home-mid">
      <button class="continue" type="button">
        <span class="pr-node">${PLAY}</span>
        <span class="continue-kicker">CONTINUE</span>
        <span class="continue-level"></span>
        <span class="continue-world"></span>
      </button>
      <section class="pr-plate" aria-label="Your rank and progress"><div class="pr-plate-in">
        <div class="pr-plate-top"><div><div class="pr-rank-label">RANK</div><div class="pr-rank-name"></div></div><div class="pr-stars-total"></div></div>
        <div class="pr-meter" aria-hidden="true"><i></i></div>
        <div class="pr-rank-next"></div>
        <div class="pr-worlds"></div>
      </div></section>
    </div>
    <nav class="home-nav" aria-label="Main">
      <button class="nav-btn" type="button" data-go="levels"><span class="pad square">${ICONS.levels}</span><span class="label">Levels</span></button>
      <button class="nav-btn active" type="button" aria-current="page"><span class="pad round">${ICONS.home}</span><span class="label">Home</span></button>
      <button class="nav-btn" type="button" data-go="circuits"><span class="pad diamond">${ICONS.circuits}</span><span class="label">Circuits</span></button>
    </nav>`;
  const $ = s => screen.querySelector(s);
  const play = $('.continue'), plate = $('.pr-plate');
  play.addEventListener('click', onContinue);
  $('.home-settings').addEventListener('click', onSettings);
  $('[data-go="levels"]').addEventListener('click', onLevels);
  $('[data-go="circuits"]').addEventListener('click', onCircuits);

  function refresh() {
    const progress = readProgress(gameId);
    const stars = totalStars(progress.levels), available = levels.count * 3;
    const skin = resolveSkin(getSkinId(), stars, unlockAll);
    app.style.setProperty('--pr-accent', skin.accent);
    app.classList.toggle('pr-reduce', !!reducedMotion());
    // Continue: the level the button opens.
    const number = getLevel(), def = levels.get(number), world = WORLD_INFO[def.world]?.name ?? '';
    $('.continue-level').textContent = levelLabel(number);
    $('.continue-world').textContent = world;
    play.setAttribute('aria-label', `Continue: ${levelLabel(number)}, ${world}`);
    // Rank plate.
    const rank = rankFor(stars, available);
    const next = RANKS.find(r => r.share > stars / available);
    plate.querySelector('.pr-rank-name').textContent = rank;
    plate.querySelector('.pr-stars-total').textContent = `${stars} / ${available} ★`;
    const from = (RANKS.find(r => r.name === rank)?.share ?? 0) * available, to = next ? next.share * available : available;
    plate.querySelector('.pr-meter i').style.width = `${Math.round(100 * Math.min(1, (stars - from) / Math.max(1, to - from)))}%`;
    plate.querySelector('.pr-rank-next').textContent = next ? `${Math.ceil(to - stars)} more ★ to ${next.name}` : 'Top rank reached';
    // World progress.
    const worlds = new Map();
    levels.order.forEach((id, i) => { const d = levels.get(i + 1); const w = worlds.get(d.world) ?? { got: 0, total: 0, first: i + 1 }; w.got += progress.levels[id]?.stars ?? 0; w.total += 3; worlds.set(d.world, w); });
    const reached = Math.max(number, progress.reached ?? 1);
    plate.querySelector('.pr-worlds').replaceChildren(...[...worlds].map(([n, w]) => {
      const chip = document.createElement('div'); const open = w.first <= reached;
      chip.className = 'pr-world-chip' + (open ? '' : ' locked');
      const b = document.createElement('b'); b.textContent = WORLD_INFO[n]?.name ?? `World ${n}`;
      const s = document.createElement('span'); s.textContent = open ? `${w.got}/${w.total} ★` : 'Locked';
      const bar = document.createElement('div'); bar.className = 'bar'; const fill = document.createElement('i'); fill.style.width = `${Math.round(100 * w.got / w.total)}%`; bar.append(fill);
      chip.append(b, s, bar); return chip;
    }));
  }
  return { refresh, focus() { play.focus({ preventScroll: true }); } };
}
