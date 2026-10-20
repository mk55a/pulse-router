// Pulse Router — board rules. Pure logic: no DOM, no Three.js.
// Grid characters: S source, E exit, N node, # hole, . plain,
// 1–8 ordered node (must be lit in number order; stored as a Node plus its number),
// R resistor (costs 2), B battery (refills 3 up to the budget).

export const TILE = Object.freeze({
  PLAIN: '.', SOURCE: 'S', EXIT: 'E', NODE: 'N', HOLE: '#', RESISTOR: 'R', BATTERY: 'B'
});
const KNOWN = new Set(Object.values(TILE));
export const BATTERY_REFILL = 3;

export function parseBoard(grid) {
  if (!Array.isArray(grid) || grid.length < 2 || grid.length > 8) throw new Error('Board needs 2 to 8 rows');
  const rows = grid.length, cols = grid[0]?.length;
  if (!Number.isInteger(cols) || cols < 2 || cols > 8) throw new Error('Board needs 2 to 8 columns');
  const cells = [], order = [];
  let source = null, exit = null;
  const nodes = [], numbered = [];
  grid.forEach((line, r) => {
    if (typeof line !== 'string' || line.length !== cols) throw new Error('Board rows must be equal-length strings');
    [...line].forEach((ch, c) => {
      const n = ch >= '1' && ch <= '8' ? Number(ch) : 0;
      if (!n && !KNOWN.has(ch)) throw new Error(`Unknown tile "${ch}"`);
      if (ch === TILE.SOURCE) { if (source) throw new Error('Board needs exactly one Source'); source = [r, c]; }
      if (ch === TILE.EXIT) { if (exit) throw new Error('Board needs exactly one Exit'); exit = [r, c]; }
      if (ch === TILE.NODE || n) nodes.push([r, c]);
      if (n) numbered.push(n);
      cells.push(n ? TILE.NODE : ch);
      order.push(n);
    });
  });
  if (!source || !exit) throw new Error('Board needs a Source and an Exit');
  const sorted = [...numbered].sort((a, b) => a - b);
  if (sorted.some((n, i) => n !== i + 1)) throw new Error('Ordered nodes must be numbered 1, 2, 3… with no gaps');
  return Object.freeze({ rows, cols, cells: Object.freeze(cells), order: Object.freeze(order), ordered: numbered.length,
    source, exit, nodes: Object.freeze(nodes), grid: Object.freeze([...grid]) });
}

// Number of an ordered node (1-based), or 0 for any other tile.
export const orderAt = (board, r, c) => inBounds(board, r, c) ? board.order[key(board, r, c)] : 0;
// The next ordered node a path may enter, given the cells already on it.
export function nextOrder(board, cells) {
  let n = 0;
  for (const [r, c] of cells) if (orderAt(board, r, c)) n++;
  return n + 1;
}

export const key = (board, r, c) => r * board.cols + c;
export const inBounds = (board, r, c) => r >= 0 && c >= 0 && r < board.rows && c < board.cols;
export const tileAt = (board, r, c) => inBounds(board, r, c) ? board.cells[key(board, r, c)] : TILE.HOLE;
export const isEnterable = (board, r, c) => inBounds(board, r, c) && tileAt(board, r, c) !== TILE.HOLE;
export const adjacent = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;

// Energy spent entering a tile (batteries refill instead of spending).
export function entryCost(board, r, c) {
  const t = tileAt(board, r, c);
  if (t === TILE.RESISTOR) return 2;
  if (t === TILE.BATTERY) return 0;
  return 1;
}

// Energy simulation for a drawn path. index 0 is the Source.
// energy[i] is the energy left after entering cell i (Infinity-free, may go negative).
// diesAt is the first index where energy went below zero, or -1.
export function simulateEnergy(board, cells, budget) {
  const energy = [budget];
  let e = budget, diesAt = -1, used = 0, lowest = budget;
  for (let i = 1; i < cells.length; i++) {
    const [r, c] = cells[i];
    const cost = entryCost(board, r, c);
    used += cost;
    e -= cost;
    if (tileAt(board, r, c) === TILE.BATTERY) e = Math.min(budget, e + BATTERY_REFILL);
    energy.push(e);
    if (e < lowest) lowest = e;
    if (e < 0 && diesAt < 0) diesAt = i;
  }
  return { energy, diesAt, used, short: lowest < 0 ? -lowest : 0 };
}

export function missingNodes(board, cells) {
  const on = new Set(cells.map(([r, c]) => key(board, r, c)));
  return board.nodes.filter(([r, c]) => !on.has(key(board, r, c)));
}
