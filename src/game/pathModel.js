// The drawn path: extend, undo, clear and where power runs out. Pure logic.
import { TILE, adjacent, isEnterable, key, tileAt, simulateEnergy, missingNodes, orderAt, nextOrder } from './board.js';

export function createPathModel(board, budget) {
  let cells = [board.source];
  const used = new Set([key(board, ...board.source)]);

  function head() { return cells[cells.length - 1]; }
  function rebuild() { used.clear(); for (const [r, c] of cells) used.add(key(board, r, c)); }

  // Returns { ok, action: 'extend' | 'undo', reason } so the view can bump refused tiles.
  function step(r, c) {
    const h = head();
    if (cells.length >= 2) {
      const prev = cells[cells.length - 2];
      if (prev[0] === r && prev[1] === c) { cells = cells.slice(0, -1); rebuild(); return { ok: true, action: 'undo' }; }
    }
    if (h[0] === r && h[1] === c) return { ok: false, reason: 'same' };
    if (!adjacent(h, [r, c])) return { ok: false, reason: 'not-adjacent' };
    if (tileAt(board, h[0], h[1]) === TILE.EXIT) return { ok: false, reason: 'at-exit' };
    if (!isEnterable(board, r, c)) return { ok: false, reason: 'hole' };
    if (used.has(key(board, r, c))) return { ok: false, reason: 'used' };
    // Ordered nodes act like holes until every lower number is on the path.
    const n = orderAt(board, r, c);
    if (n && n !== nextOrder(board, cells)) return { ok: false, reason: 'order', expected: nextOrder(board, cells) };
    cells = [...cells, [r, c]];
    used.add(key(board, r, c));
    return { ok: true, action: 'extend' };
  }

  return {
    get cells() { return cells; },
    get length() { return cells.length; },
    head,
    indexOf(r, c) { return cells.findIndex(p => p[0] === r && p[1] === c); },
    contains(r, c) { return used.has(key(board, r, c)); },
    step,
    undo() { if (cells.length <= 1) return false; cells = cells.slice(0, -1); rebuild(); return true; },
    clear() { cells = [board.source]; rebuild(); },
    truncateTo(index) { if (index < 0 || index >= cells.length) return false; cells = cells.slice(0, index + 1); rebuild(); return true; },
    setCells(next) { cells = next.map(p => [p[0], p[1]]); rebuild(); },
    energy() { return simulateEnergy(board, cells, budget); },
    missing() { return missingNodes(board, cells); },
    exitUnlocked() { return missingNodes(board, cells).length === 0; }
  };
}
