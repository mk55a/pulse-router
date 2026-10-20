// Shared solver for the level generator, tests and (later) a daily challenge.
// Finds par (cheapest valid route), counts valid routes within a budget (capped)
// and returns one optimal route. Pure logic.
import { TILE, BATTERY_REFILL, entryCost, key, tileAt, isEnterable, orderAt } from './board.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function context(board) {
  const n = board.rows * board.cols;
  const nodeKeys = board.nodes.map(([r, c]) => key(board, r, c));
  const exitKey = key(board, ...board.exit);
  const hasBattery = board.cells.includes(TILE.BATTERY);
  return { n, nodeKeys, exitKey, hasBattery };
}

// BFS over free cells from the head; returns distance array (-1 unreachable).
function bfs(board, visited, from) {
  const dist = new Int16Array(board.rows * board.cols).fill(-1);
  const queue = [from];
  dist[key(board, ...from)] = 0;
  for (let qi = 0; qi < queue.length; qi++) {
    const [r, c] = queue[qi];
    const d = dist[key(board, r, c)];
    if (tileAt(board, r, c) === TILE.EXIT && qi > 0) continue; // cannot pass through the Exit
    for (const [dr, dc] of DIRS) {
      const nr = r + dr, nc = c + dc;
      if (!isEnterable(board, nr, nc)) continue;
      const k = key(board, nr, nc);
      if (visited[k] || dist[k] >= 0) continue;
      dist[k] = d + 1;
      queue.push([nr, nc]);
    }
  }
  return dist;
}

// Depth-first search over self-avoiding paths with pruning.
// mode 'min': find cheapest valid route. mode 'count': count routes with used <= budget
// (used === budget when exact). Ordered nodes must be entered in number order.
function search(board, { mode, budget = Infinity, cap = 256, exact = false, maxNodesVisited = 4e6 }) {
  const ctx = context(board);
  const visited = new Uint8Array(ctx.n);
  const path = [board.source];
  visited[key(board, ...board.source)] = 1;
  let best = Infinity, bestPath = null, firstPath = null, count = 0, expanded = 0, aborted = false, nextNum = 1;
  const energyBudget = budget;

  function remainingNodes() { let k = 0; for (const nk of ctx.nodeKeys) if (!visited[nk]) k++; return k; }

  function recurse(r, c, used, energy) {
    if (aborted) return;
    if (++expanded > maxNodesVisited) { aborted = true; return; }
    const here = key(board, r, c);
    if (here === ctx.exitKey) {
      if (remainingNodes() === 0 && (!exact || used === budget)) {
        if (mode === 'min') { if (used < best) { best = used; bestPath = path.map(p => [...p]); } }
        else { count++; if (!firstPath) firstPath = path.map(p => [...p]); if (count >= cap) aborted = true; }
      }
      return;
    }
    // Prune: every remaining Node and the Exit must still be reachable; Exit distance bounds cost.
    const dist = bfs(board, visited, [r, c]);
    if (dist[ctx.exitKey] < 0) return;
    for (const nk of ctx.nodeKeys) if (!visited[nk] && dist[nk] < 0) return;
    const lowerStep = ctx.hasBattery ? 0 : 1;
    const bound = used + dist[ctx.exitKey] * lowerStep;
    if (mode === 'min' && bound >= best) return;
    if (mode === 'count' && bound > budget) return;
    for (const [dr, dc] of DIRS) {
      const nr = r + dr, nc = c + dc;
      if (!isEnterable(board, nr, nc)) continue;
      const k = key(board, nr, nc);
      if (visited[k]) continue;
      const num = orderAt(board, nr, nc);
      if (num && num !== nextNum) continue;
      const cost = entryCost(board, nr, nc);
      let e = energy - cost;
      if (e < 0) continue;
      if (tileAt(board, nr, nc) === TILE.BATTERY) e = Math.min(energyBudget, e + BATTERY_REFILL);
      visited[k] = 1; path.push([nr, nc]); if (num) nextNum++;
      recurse(nr, nc, used + cost, e);
      path.pop(); visited[k] = 0; if (num) nextNum--;
      if (aborted) return;
    }
  }
  recurse(board.source[0], board.source[1], 0, energyBudget);
  return { best, bestPath, firstPath, count, aborted, expanded };
}

// Exact-energy levels: valid routes spend the whole budget, so par is the budget itself.
export function solveExact(board, budget, { cap = 256 } = {}) {
  const counted = search(board, { mode: 'count', budget, cap, exact: true });
  if (!counted.firstPath) return { solvable: false, aborted: counted.aborted };
  return { solvable: true, par: budget, budget, solutions: counted.count, capped: counted.aborted && counted.count >= cap, route: counted.firstPath, aborted: counted.aborted && counted.count < cap };
}

export function solve(board, { budget = null, slack = 0, cap = 256 } = {}) {
  const min = search(board, { mode: 'min' });
  if (!min.bestPath) return { solvable: false, aborted: min.aborted };
  const par = min.best;
  const limit = budget ?? par + slack;
  const counted = search(board, { mode: 'count', budget: limit, cap });
  return { solvable: true, par, budget: limit, solutions: counted.count, capped: counted.aborted, route: min.bestPath, aborted: min.aborted };
}
