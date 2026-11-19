// A big one-line call-out over the board ("Can you fix it?", "Your turn"), for the moment a
// scripted demo hands over to the player. It also blocks touches while a demo plays.
const CSS = `
.pr-banner{position:absolute;inset:0;z-index:8;display:grid;place-items:center;pointer-events:none}
.pr-banner.block{pointer-events:auto}
.pr-banner span{font-size:clamp(30px,9vw,46px);font-weight:800;letter-spacing:.5px;color:#fff;text-align:center;padding:0 20px;
  text-shadow:0 0 18px var(--ad-accent,#65e7ff),0 0 40px var(--ad-accent,#65e7ff);opacity:0;transform:scale(.85);transition:opacity .25s,transform .35s cubic-bezier(.3,1.6,.5,1)}
.pr-banner.show span{opacity:1;transform:none}
@media (prefers-reduced-motion:reduce){.pr-banner span{transition:none}}
`;

export function createBanner(root) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.append(style);
  const el = document.createElement('div'); el.className = 'pr-banner'; el.setAttribute('aria-live', 'assertive');
  const text = document.createElement('span'); el.append(text); root.append(el);
  let hideTimer = 0;
  return {
    // Shows `message` for `seconds`, then fades it.
    show(message, seconds = 1.4) {
      clearTimeout(hideTimer);
      text.textContent = message; el.classList.add('show');
      hideTimer = setTimeout(() => el.classList.remove('show'), seconds * 1000);
    },
    hide() { clearTimeout(hideTimer); el.classList.remove('show'); },
    // While a demo plays, touches on the board do nothing.
    block(on) { el.classList.toggle('block', !!on); }
  };
}
