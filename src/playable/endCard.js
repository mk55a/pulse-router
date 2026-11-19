// The playable's end card: logo, the stars just earned, one line on the full game, a pulsing
// "Play now" call to action and a small Replay. Shown after the last level, or by the time limit.
const CSS = `
.pr-end{position:absolute;inset:0;z-index:20;display:none;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px 20px calc(24px + env(safe-area-inset-bottom,0px));text-align:center;background:radial-gradient(ellipse at 50% 40%,rgba(21,34,69,.96) 0%,rgba(6,9,20,.98) 70%);animation:pr-end-in .35s ease}
.pr-end.show{display:flex}
@keyframes pr-end-in{from{opacity:0}to{opacity:1}}
.pr-end img{width:min(78%,300px);filter:drop-shadow(0 0 16px rgba(101,231,255,.35))}
.pr-end-stars{display:flex;gap:10px}
.pr-end-stars[hidden]{display:none}
.pr-end-stars svg{width:46px;height:46px}
.pr-end-stars path{fill:#151d3f;stroke:#3a4466;stroke-width:1.6}
.pr-end-stars .on path{fill:#ffd36b;stroke:#fff1c4}
.pr-end-stars .on{filter:drop-shadow(0 0 8px rgba(255,211,107,.75));animation:pr-end-star .45s cubic-bezier(.3,1.7,.5,1) both}
@keyframes pr-end-star{from{transform:scale(.4)}to{transform:none}}
.pr-end h2{margin:0;font-size:26px;font-weight:700;color:#f1f7ff}
.pr-end p{margin:0;font-size:15px;color:#8fa3cc}
.pr-end-cta{margin-top:8px;min-width:220px;min-height:60px;border:none;border-radius:18px;background:var(--ad-accent,#65e7ff) linear-gradient(180deg,rgba(255,255,255,.2),rgba(0,0,0,.18));color:#07122a;font-size:22px;font-weight:800;letter-spacing:1px;box-shadow:0 0 26px var(--ad-accent,#65e7ff);animation:pr-cta 1.2s ease-in-out infinite}
@keyframes pr-cta{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
.pr-end-replay{border:none;background:none;color:#8fa3cc;font-size:14px;text-decoration:underline;padding:8px}
@media (prefers-reduced-motion:reduce){.pr-end-cta,.pr-end-stars .on{animation:none}}
`;
const STAR = '<svg viewBox="-18 -18 36 36" aria-hidden="true"><path d="M0 -17 L5 -6 L17 -5 L8 3 L10 16 L0 9 L-10 16 L-8 3 L-17 -5 L-5 -6 Z"/></svg>';

export function createEndCard(root, { logo, title, line, onInstall, onReplay }) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.append(style);
  const card = document.createElement('div'); card.className = 'pr-end';
  card.setAttribute('role', 'dialog'); card.setAttribute('aria-label', 'Pulse Router');
  card.innerHTML = `
    <img alt="Pulse Router">
    <div class="pr-end-stars" role="img"></div>
    <h2></h2>
    <p></p>
    <button class="pr-end-cta" type="button">PLAY NOW</button>
    <button class="pr-end-replay" type="button">Replay</button>`;
  card.querySelector('img').src = logo;
  card.querySelector('h2').textContent = title;
  card.querySelector('p').textContent = line;
  card.querySelector('.pr-end-cta').addEventListener('click', onInstall);
  card.querySelector('.pr-end-replay').addEventListener('click', onReplay);
  root.append(card);
  const starsEl = card.querySelector('.pr-end-stars');
  return {
    show(stars) {
      starsEl.innerHTML = STAR.repeat(3);
      starsEl.setAttribute('aria-label', `${stars} of 3 stars`);
      starsEl.hidden = !stars;
      [...starsEl.children].forEach((s, i) => { if (i < stars) { s.classList.add('on'); s.style.animationDelay = `${0.15 + i * 0.2}s`; } });
      card.classList.add('show');
      card.querySelector('.pr-end-cta').focus({ preventScroll: true });
    },
    hide() { card.classList.remove('show'); },
    get open() { return card.classList.contains('show'); }
  };
}
