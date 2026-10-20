#!/usr/bin/env node
// Pulse Router Ã¢â‚¬â€ offline level generator.
// Carves a seeded self-avoiding walk, places Nodes and Holes, proves the board with the
// shared solver, and keeps the candidate whose number of valid routes best matches the slot.
// Fewer valid routes = a harder puzzle, so that is the main difficulty dial.
//
//   node tools/gen_levels.mjs            # writes data/levels.json
//   node tools/gen_levels.mjs --dry-run  # prints the table only
//   Without Node: open tools/gen_levels.html through tools/serve.ps1 (same output).
import { parseBoard } from '../src/game/board.js';
import { solve, solveExact } from '../src/game/solver.js';
import { difficulty } from '../src/game/rating.js';

export const SEED = 20261020;
const CANDIDATES_PER_SLOT = 1500;

// Slot fields: board size, nodes, hole range, sol = target valid routes, max = reject above,
// slack = budget - par (ignored on exact levels), ordered = nodes are numbered,
// exact = the pulse must end on 0 energy.
// Pacing per world: 1Ã¢â‚¬â€œ2 teach, 3Ã¢â‚¬â€œ5 build, 6 breather, 7Ã¢â‚¬â€œ10 combine, 11 hardest, 12 finale.
const s = (rows, cols, nodes, holes, sol, max, extra = {}) => ({ rows, cols, nodes, holes, sol, max, slack: 2, ...extra });

export const WORLDS = [
  { world: 1, slots: [
    s(4, 4, 1, [1, 2], 10, 24, { slack: 3, prompt: 'Drag from the glowing tile' }),
    s(4, 4, 2, [2, 3], 6, 16, { slack: 3, prompt: 'Light every node, then press Pulse' }),
    s(5, 4, 2, [2, 3], 5, 10),
    s(5, 5, 2, [3, 4], 4, 8),
    s(5, 5, 3, [3, 5], 3, 6),
    s(5, 4, 2, [2, 3], 6, 12),
    s(5, 5, 3, [4, 5], 3, 5),
    s(6, 5, 3, [5, 7], 2, 4),
    s(6, 5, 4, [5, 7], 2, 4),
    s(6, 6, 4, [7, 10], 2, 3),
    s(6, 6, 4, [7, 10], 1, 2),
    s(6, 6, 5, [7, 10], 1, 2)
  ] },
  { world: 2, slots: [
    s(5, 4, 2, [1, 2], 6, 16, { ordered: true, slack: 3, prompt: 'Light the nodes in number order' }),
    s(5, 5, 3, [2, 3], 5, 12, { ordered: true, slack: 3, prompt: 'A numbered node stays shut until the one before it is lit' }),
    s(5, 5, 3, [3, 4], 4, 8, { ordered: true }),
    s(5, 5, 4, [3, 4], 3, 6, { ordered: true }),
    s(6, 5, 4, [5, 7], 2, 5, { ordered: true }),
    s(5, 5, 3, [3, 4], 5, 10, { ordered: true }),
    s(6, 5, 4, [5, 7], 2, 4, { ordered: true }),
    s(6, 6, 4, [7, 10], 2, 4, { ordered: true }),
    s(6, 6, 5, [7, 10], 2, 3, { ordered: true }),
    s(6, 6, 5, [7, 10], 1, 3, { ordered: true }),
    s(6, 6, 6, [7, 10], 1, 2, { ordered: true }),
    s(7, 6, 6, [8, 11], 1, 2, { ordered: true })
  ] },
  { world: 3, slots: [
    s(4, 4, 1, [1, 2], 4, 12, { exact: true, prompt: 'Spend every cell of energy: end on exactly 0' }),
    s(5, 4, 2, [1, 2], 3, 10, { exact: true, prompt: 'Too much energy left? Take the long way round' }),
    s(5, 5, 2, [2, 3], 3, 8, { exact: true }),
    s(5, 5, 3, [2, 4], 2, 6, { exact: true }),
    s(6, 5, 3, [5, 7], 2, 5, { exact: true }),
    s(5, 5, 2, [2, 3], 4, 8, { exact: true }),
    s(5, 5, 3, [2, 4], 2, 4, { exact: true, ordered: true }),
    s(6, 5, 3, [5, 7], 2, 4, { exact: true, ordered: true }),
    s(6, 6, 4, [7, 10], 2, 3, { exact: true, ordered: true }),
    s(6, 6, 4, [7, 10], 1, 3, { exact: true }),
    s(6, 6, 5, [7, 10], 1, 2, { exact: true, ordered: true }),
    s(7, 6, 5, [8, 11], 1, 2, { exact: true, ordered: true })
  ] }
];

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const shuffle = (rng, list) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// Randomised self-avoiding walk of exactly `length` cells (backtracking, bounded).
function carveWalk(rng, rows, cols, length) {
  const start = [Math.floor(rng() * rows), Math.floor(rng() * cols)];
  const seen = new Set([start.join()]);
  const path = [start];
  let budget = 20000;
  function go() {
    if (path.length === length) return true;
    if (--budget < 0) return false;
    const [r, c] = path[path.length - 1];
    for (const [dr, dc] of shuffle(rng, [[1, 0], [-1, 0], [0, 1], [0, -1]])) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols || seen.has(nr + ',' + nc)) continue;
      seen.add(nr + ',' + nc); path.push([nr, nc]);
      if (go()) return true;
      path.pop(); seen.delete(nr + ',' + nc);
    }
    return false;
  }
  return go() ? path : null;
}

function makeCandidate(rng, slot) {
  const { rows, cols } = slot;
  const total = rows * cols;
  const length = Math.round(total * (0.6 + rng() * 0.3));
  const walk = carveWalk(rng, rows, cols, length);
  if (!walk) return null;
  const grid = Array.from({ length: rows }, () => Array(cols).fill('.'));
  const [sr, sc] = walk[0], [er, ec] = walk[walk.length - 1];
  grid[sr][sc] = 'S'; grid[er][ec] = 'E';
  // Nodes spaced along the walk interior; ordered nodes are numbered in walk order.
  const interior = walk.slice(2, -2);
  if (interior.length < slot.nodes) return null;
  const spacing = interior.length / slot.nodes;
  for (let i = 0; i < slot.nodes; i++) {
    const idx = Math.min(interior.length - 1, Math.floor(i * spacing + rng() * spacing));
    const [r, c] = interior[idx];
    if (grid[r][c] !== '.') return null;
    grid[r][c] = slot.ordered ? String(i + 1) : 'N';
  }
  // Holes off the walk shape the routes and leave decoys.
  const onWalk = new Set(walk.map(p => p.join()));
  const free = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (!onWalk.has(r + ',' + c)) free.push([r, c]);
  const holeCount = Math.min(free.length, slot.holes[0] + Math.floor(rng() * (slot.holes[1] - slot.holes[0] + 1)));
  for (const [r, c] of shuffle(rng, free).slice(0, holeCount)) grid[r][c] = '#';
  return { grid: grid.map(row => row.join('')), walkMoves: walk.length - 1 };
}

// Canonical form under rotation and mirroring. Swapping Source and Exit (and reversing the
// numbering) is the same puzzle played backwards, so it counts as a duplicate too.
function canonical(grid) {
  const rows = grid.length, cols = grid[0].length;
  const numbers = [...grid.join('')].filter(ch => ch >= '1' && ch <= '8').length;
  const swapped = grid.map(line => [...line].map(ch => ch === 'S' ? 'E' : ch === 'E' ? 'S' : ch >= '1' && ch <= '8' ? String(numbers + 1 - Number(ch)) : ch).join(''));
  const variants = [];
  for (const g of [grid, swapped]) {
    const tf = fn => { const out = []; for (let r = 0; r < rows; r++) { let line = ''; for (let c = 0; c < cols; c++) line += fn(r, c); out.push(line); } return out.join('/'); };
    variants.push(tf((r, c) => g[r][c]), tf((r, c) => g[r][cols - 1 - c]), tf((r, c) => g[rows - 1 - r][c]), tf((r, c) => g[rows - 1 - r][cols - 1 - c]));
    if (rows === cols) variants.push(tf((r, c) => g[c][r]), tf((r, c) => g[cols - 1 - c][r]), tf((r, c) => g[c][rows - 1 - r]), tf((r, c) => g[cols - 1 - c][rows - 1 - r]));
  }
  return variants.sort()[0];
}

function evaluate(cand, slot) {
  const board = parseBoard(cand.grid);
  if (slot.exact) {
    // The budget is the carved walk; the shortest route must fall well short of it,
    // so the player has to find the long way round.
    const shortest = solve(board, { slack: 0 });
    if (!shortest.solvable || shortest.aborted || shortest.par > cand.walkMoves - 2) return null;
    const result = solveExact(board, cand.walkMoves, { cap: slot.max + 1 });
    if (!result.solvable || result.aborted) return null;
    return { ...result, energy: cand.walkMoves, shortest: shortest.par };
  }
  // Counting stops just past the slot's limit: anything above it is rejected anyway.
  const result = solve(board, { slack: slot.slack, cap: slot.max + 1 });
  if (!result.solvable || result.aborted) return null;
  if (result.par < Math.ceil(cand.walkMoves * 0.7)) return null; // a shortcut skips the carved route
  return { ...result, energy: result.par + slot.slack };
}

export function generateWorld(worldDef, seed = SEED, { onSlot = () => {} } = {}) {
  const rng = mulberry32(seed + worldDef.world * 7919);
  const seen = new Set();
  const levels = [];
  worldDef.slots.forEach((slot, i) => {
    let best = null;
    for (let n = 0; n < CANDIDATES_PER_SLOT; n++) {
      const cand = makeCandidate(rng, slot);
      if (!cand) continue;
      const canon = canonical(cand.grid);
      if (seen.has(canon)) continue;
      const result = evaluate(cand, slot);
      if (!result || result.solutions < 1 || result.solutions > slot.max) continue;
      // Closest route count to the target (log scale), then the longer route.
      const score = Math.abs(Math.log2(result.solutions) - Math.log2(slot.sol)) * 4 - result.par * 0.05;
      if (!best || score < best.score) best = { score, cand, canon, result };
    }
    if (!best) throw new Error(`World ${worldDef.world} slot ${i + 1}: no candidate within ${slot.max} routes`);
    seen.add(best.canon);
    const rules = (slot.ordered ? 1 : 0) + (slot.exact ? 1 : 0);
    const r = best.result;
    const level = {
      id: `w${worldDef.world}-${String(i + 1).padStart(2, '0')}`, world: worldDef.world, index: i + 1,
      grid: best.cand.grid,
      energy: r.energy,
      par: r.par,
      difficulty: difficulty({ cells: slot.rows * slot.cols, nodes: slot.nodes, rules, solutions: r.solutions }),
      solutions: r.solutions,
      // A valid route including the Source, so Hints need no search at run time.
      solution: r.route
    };
    if (slot.exact) level.exact = true;
    if (slot.prompt) level.prompt = slot.prompt;
    levels.push(level);
    onSlot(level);
  });
  return levels;
}

export function generateAll(seed = SEED, options) {
  const levels = WORLDS.flatMap(w => generateWorld(w, seed, options));
  return { version: 1, end: 'stop', order: levels.map(l => l.id), levels };
}

export const describe = l => `${l.id}  ${l.grid[0].length}x${l.grid.length}  par ${String(l.par).padStart(2)}  energy ${String(l.energy).padStart(2)}${l.exact ? ' exact' : ''}  D ${l.difficulty}  routes ${l.solutions}\n    ${l.grid.join('\n    ')}`;

if (typeof process !== 'undefined' && process.argv?.[1]) {
  const { fileURLToPath } = await import('node:url');
  if (fileURLToPath(import.meta.url) === process.argv[1]) {
    const { writeFileSync } = await import('node:fs');
    const out = generateAll(SEED, { onSlot: l => console.log(describe(l)) });
    if (!process.argv.includes('--dry-run')) {
      writeFileSync(new URL('../data/levels.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
      console.log(`Wrote ${out.levels.length} levels to data/levels.json`);
    }
  }
}
