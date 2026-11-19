// Ad-network glue for the playable. The game is the same everywhere; only four things differ:
// when it may start, how visibility changes are reported, how "Play now" leaves the ad, and
// whether the network wants to hear that the game has ended.
//   applovin, unity, ironsource → MRAID (mraid.js is injected by the ad SDK)
//   vungle (Liftoff)            → MRAID when present, else postMessage('download'); 'complete' at the end
//   mintegral                   → gameReady() / gameStart() / gameEnd() / install()
//   tiktok (TikTok, Pangle)     → openAppStore() from the network's playable SDK
//   google                      → ExitApi.exit()
//   meta                        → FbPlayableAd.onCTAClick()
//   preview                     → opens the store URL in a new tab (local testing)
// The network is chosen at build time (globalThis.PR_NETWORK, set by tools/build_playable.ps1).
// Outside its network (a plain browser tab) every build falls back to running straight away.
const MRAID_NETWORKS = new Set(['applovin', 'unity', 'ironsource', 'vungle']);

export function createAdapter({ network = globalThis.PR_NETWORK || 'preview', storeUrl }) {
  const g = globalThis;
  const mraid = () => (MRAID_NETWORKS.has(network) ? g.mraid : null);

  // Resolves once the ad container is ready and the ad is on screen.
  async function ready() {
    if (network === 'mintegral' && typeof g.gameReady === 'function') {
      // Mintegral's host calls gameStart() once it shows the ad.
      const started = new Promise(resolve => { g.gameStart = resolve; });
      g.gameClose = () => {};
      g.gameReady();
      return started;
    }
    const m = mraid();
    if (!m) return;
    if (m.getState?.() === 'loading') await new Promise(resolve => m.addEventListener('ready', resolve));
    if (m.isViewable && !m.isViewable()) {
      await new Promise(resolve => {
        const onChange = visible => { if (visible) { m.removeEventListener('viewableChange', onChange); resolve(); } };
        m.addEventListener('viewableChange', onChange);
      });
    }
  }
  // Calls fn(false) when the ad is hidden or backgrounded and fn(true) when it is back.
  function onVisibility(fn) {
    mraid()?.addEventListener('viewableChange', visible => fn(!!visible));
    document.addEventListener('visibilitychange', () => fn(!document.hidden));
  }
  // The end card is showing.
  function finished() {
    if (network === 'mintegral') g.gameEnd?.();
    if (network === 'vungle' && g.parent !== g) g.parent.postMessage('complete', '*');
  }
  function install() {
    if (network === 'google' && g.ExitApi?.exit) return g.ExitApi.exit();
    if (network === 'meta' && g.FbPlayableAd?.onCTAClick) return g.FbPlayableAd.onCTAClick();
    if (network === 'mintegral' && g.install) return g.install();
    if (network === 'tiktok') {
      if (g.playableSDK?.openAppStore) return g.playableSDK.openAppStore();
      if (g.openAppStore) return g.openAppStore();
    }
    const m = mraid();
    if (m?.open) return m.open(storeUrl);
    if (network === 'vungle' && g.parent !== g) return g.parent.postMessage('download', '*');
    g.open(storeUrl, '_blank');
  }
  return { network, ready, onVisibility, finished, install };
}
