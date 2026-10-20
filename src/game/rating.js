// Stars, Clean Pulse badge and rank. Thresholds are starting values from the design document.

// On a square grid every route between two tiles has the same parity, so the next possible
// length after par is par + 2 (par + 1 can never happen). "Efficient" therefore means par + 2.
export function starsFor(used, par) {
  if (!Number.isFinite(used) || !Number.isFinite(par)) return 1;
  if (used <= par) return 3;
  if (used <= par + 2) return 2;
  return 1;
}

export const STAR_LABELS = Object.freeze({ 1: 'Win', 2: 'Efficient', 3: 'Perfect' });

export const RANKS = Object.freeze([
  { name: 'Spark', share: 0 },
  { name: 'Arc', share: 0.25 },
  { name: 'Surge', share: 0.55 },
  { name: 'Nova', share: 0.85 }
]);

export function rankFor(earned, available) {
  const share = available > 0 ? earned / available : 0;
  let rank = RANKS[0];
  for (const r of RANKS) if (share >= r.share) rank = r;
  return rank.name;
}

// Difficulty score, 0 to 100 (see GDD "How difficulty is measured").
export function difficulty({ cells, nodes, rules, solutions }) {
  const c = Math.min(1, cells / 64), n = Math.min(1, nodes / 8), h = Math.min(1, rules / 6);
  const s = Math.max(1, Math.min(256, solutions));
  const u = 1 - Math.log2(s) / Math.log2(256);
  return Math.round(100 * (0.30 * c + 0.20 * n + 0.20 * h + 0.30 * u));
}
