// Playable ad variants: the same game and template, different hook, mechanic, skin and copy, so they
// can be A/B tested against each other. Pick one with globalThis.PR_VARIANT (set per build by
// tools/build_playable.ps1) or ?variant= on the dev page.
//
// topCta: a "Play now" button in the top bar for the whole ad; without it, the install button is
// only on the end card (one more thing the variants test against each other).
// Level fields are the game's own (grid, energy, par, exact, solution, prompt), plus:
//   ghost: the tutorial finger draws the solution as soon as the level appears;
//   demo:  the ad draws and fires `route` itself first, shows `banner`, then hands over to the
//          player: on the same level if the demo failed, on the next one if it won.
// Every level was checked with an exhaustive route search; the counts below are from it.
export const VARIANTS = Object.freeze({
  // A: teach, then a near miss. Classic skin.
  tutorial: Object.freeze({
    skin: 'classic', topCta: true,
    end: { title: 'Route the light', line: '36 levels · 3 worlds · 6 circuits to unlock' },
    levels: [
      // 3×3 teach: the finger draws the 4-move route (a 6-move route also wins).
      { id: 'ad-1', world: 1, index: 1, grid: ['S.N', '#..', '..E'], energy: 6, par: 4,
        solution: [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]], prompt: 'Drag from the glowing ring', ghost: true },
      // Near miss: two 10-move routes win; the two 12-move routes add a small detour and end
      // exactly "1 short".
      { id: 'ad-2', world: 1, index: 2, grid: ['S..#', '..N.', '.#..', 'N..E'], energy: 11, par: 10,
        solution: [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [2, 2], [1, 2], [1, 3], [2, 3], [3, 3]],
        prompt: 'Light both nodes. Watch your energy' }
    ]
  }),
  // B: fail first. The ad tries the obvious route, misses node 3 and locks, then asks the player to
  // fix it. Numbered nodes (the Sequence world); Ember skin. Node 3 sits beside the Source but must
  // be lit last: 8 routes light 1 and 2 and miss 3, only 2 routes (11 moves) win.
  fixit: Object.freeze({
    skin: 'ember',
    end: { title: 'Every circuit has a trick', line: '36 levels · numbered nodes · exact energy' },
    levels: [
      { id: 'ad-fix', world: 2, index: 1, grid: ['S.3.', '.#..', '1..E', '..2.'], energy: 12, par: 11,
        solution: [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [2, 2], [1, 2], [0, 2], [0, 3], [1, 3], [2, 3]],
        prompt: 'Light 1, 2, 3 in order',
        demo: { route: [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [3, 3], [2, 3]], banner: 'Can you fix it?' } }
    ]
  }),
  // C: show the payoff first. The ad snakes a 24-move route through a 5×5 board and fires it (the
  // chain-reaction pulse at full length), then the player gets a smaller board with exact energy:
  // 4 routes spend exactly 12; 14 shorter routes light every node but end "Overcharged".
  // Plasma skin (a ring bursts from every tile).
  chain: Object.freeze({
    skin: 'plasma',
    end: { title: 'Make it chain', line: '36 levels · 6 circuits · every one sounds different' },
    levels: [
      { id: 'ad-show', world: 3, index: 1, grid: ['S...N', '.....', 'N...N', '.....', 'N...E'], energy: 24, par: 24, exact: true,
        solution: [], prompt: '',
        demo: { route: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 4], [1, 3], [1, 2], [1, 1], [1, 0], [2, 0], [2, 1], [2, 2],
          [2, 3], [2, 4], [3, 4], [3, 3], [3, 2], [3, 1], [3, 0], [4, 0], [4, 1], [4, 2], [4, 3], [4, 4]], banner: 'Your turn', fast: true } },
      { id: 'ad-exact', world: 3, index: 2, grid: ['SN..', '..#.', '.N..', '...E'], energy: 12, par: 12, exact: true,
        solution: [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [2, 1], [1, 1], [0, 1], [0, 2], [0, 3], [1, 3], [2, 3], [3, 3]],
        prompt: 'Spend all 12 energy' }
    ]
  })
});

export const DEFAULT_VARIANT = 'tutorial';

// Where "Play now" goes. tools/build_playable.ps1 replaces this per build (-StoreUrl).
export const STORE_URL = 'https://mk55a.itch.io/pulse-router';
