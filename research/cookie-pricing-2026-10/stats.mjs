/**
 * Statistics for workstream J (cookie pricing). Pure functions, no dependencies, seeded where random.
 * METHOD.md §6 names which of these answers which question; nothing here decides a verdict on its own.
 */

/** mulberry32: a small, seedable PRNG, so every permutation test can be re-run to the same p-value. */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** Wilson score interval for x successes in n trials (95% by default). */
export function wilson(x, n, z = 1.959963984540054) {
  if (!n) return { x, n, p: null, lo: null, hi: null };
  const p = x / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return { x, n, p, lo: Math.max(0, center - half), hi: Math.min(1, center + half) };
}

function logChoose(n, k) {
  let s = 0;
  for (let i = 1; i <= k; i++) s += Math.log(n - k + i) - Math.log(i);
  return s;
}
const binomPmf = (k, n, p) => Math.exp(logChoose(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p));

/** Exact two-sided binomial test (sum of the probabilities no larger than the observed one). */
export function binomTwoSided(x, n, p0 = 0.5) {
  if (!n) return null;
  const px = binomPmf(x, n, p0);
  let s = 0;
  for (let k = 0; k <= n; k++) { const pk = binomPmf(k, n, p0); if (pk <= px * (1 + 1e-7)) s += pk; }
  return Math.min(1, s);
}

/** Pearson chi-square statistic of a contingency table given as aligned label arrays. */
export function chiSquareFromLabels(groups, outcomes) {
  const g = [...new Set(groups)];
  const o = [...new Set(outcomes)];
  const n = groups.length;
  const cell = new Map();
  for (let i = 0; i < n; i++) { const k = `${groups[i]}\u0000${outcomes[i]}`; cell.set(k, (cell.get(k) || 0) + 1); }
  const rowT = new Map(g.map((x) => [x, groups.filter((y) => y === x).length]));
  const colT = new Map(o.map((x) => [x, outcomes.filter((y) => y === x).length]));
  let chi = 0;
  for (const r of g) for (const c of o) {
    const e = (rowT.get(r) * colT.get(c)) / n;
    if (e > 0) chi += ((cell.get(`${r}\u0000${c}`) || 0) - e) ** 2 / e;
  }
  return chi;
}

/** Permutation test of association between group labels (devices) and outcome labels (offers). */
export function permChiSquare(groups, outcomes, { iters = 20000, seed = 1 } = {}) {
  const obs = chiSquareFromLabels(groups, outcomes);
  if (new Set(outcomes).size < 2 || new Set(groups).size < 2) return { stat: obs, p: 1, iters: 0, note: 'one group or one outcome: nothing to test' };
  const rand = rng(seed);
  let ge = 0;
  for (let i = 0; i < iters; i++) if (chiSquareFromLabels(groups, shuffle(outcomes, rand)) >= obs - 1e-12) ge++;
  return { stat: obs, p: (ge + 1) / (iters + 1), iters };
}

/** Difference in mean of `values` between the two outcome classes, permutation p (two-sided). Used for an order/time trend. */
export function permMeanDiff(values, isA, { iters = 20000, seed = 1 } = {}) {
  const stat = (lab) => {
    let sa = 0, na = 0, sb = 0, nb = 0;
    for (let i = 0; i < values.length; i++) { if (lab[i]) { sa += values[i]; na++; } else { sb += values[i]; nb++; } }
    return na && nb ? sa / na - sb / nb : 0;
  };
  const obs = stat(isA);
  if (!isA.some(Boolean) || isA.every(Boolean)) return { stat: obs, p: 1, iters: 0 };
  const rand = rng(seed);
  let ge = 0;
  for (let i = 0; i < iters; i++) if (Math.abs(stat(shuffle(isA, rand))) >= Math.abs(obs) - 1e-12) ge++;
  return { stat: obs, p: (ge + 1) / (iters + 1), iters };
}

/**
 * Paired sign-flip permutation test on differences d (repeat − fresh per slot). Under "no personal effect"
 * the repeat and fresh labels are exchangeable within a slot, so each d_i is as likely to be −d_i.
 * Exact (all 2^m sign patterns of the non-zero d_i) for m ≤ 20; zeros contribute nothing either way.
 */
export function signFlip(d, { iters = 200000, seed = 1 } = {}) {
  const xs = d.filter((v) => v !== null && v !== undefined && Number.isFinite(v));
  const nz = xs.filter((v) => v !== 0);
  const sum = xs.reduce((a, b) => a + b, 0);
  const m = nz.length;
  const out = { n: xs.length, nonZero: m, sum, mean: xs.length ? sum / xs.length : null, positive: nz.filter((v) => v > 0).length, negative: nz.filter((v) => v < 0).length };
  if (m === 0) return { ...out, p: 1, exact: true };
  const abs = Math.abs(sum) - 1e-9;
  let ge = 0, total = 0;
  if (m <= 20) {
    for (let mask = 0; mask < 1 << m; mask++) {
      let s = 0;
      for (let i = 0; i < m; i++) s += mask & (1 << i) ? -nz[i] : nz[i];
      if (Math.abs(s) >= abs) ge++;
      total++;
    }
    return { ...out, p: ge / total, exact: true };
  }
  const rand = rng(seed);
  for (let k = 0; k < iters; k++) { let s = 0; for (const v of nz) s += rand() < 0.5 ? -v : v; if (Math.abs(s) >= abs) ge++; }
  return { ...out, p: (ge + 1) / (iters + 1), exact: false };
}

/** Average ranks (ties share the mean rank). */
export function ranks(xs) {
  const idx = xs.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(xs.length);
  for (let i = 0; i < idx.length;) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
    i = j + 1;
  }
  return r;
}

function pearson(x, y) {
  const n = x.length;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
}

/** Spearman's rho (0 when either series is constant: no trend can be measured). */
export function spearman(x, y) { return pearson(ranks(x), ranks(y)); }

/** Spearman trend test: permutation of y against x, two-sided. */
export function permSpearman(x, y, { iters = 20000, seed = 1 } = {}) {
  const pairs = x.map((v, i) => [v, y[i]]).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
  const xs = pairs.map((p) => p[0]);
  const ys = pairs.map((p) => p[1]);
  if (xs.length < 3 || new Set(ys).size < 2) return { rho: 0, p: 1, n: xs.length, iters: 0, note: new Set(ys).size < 2 ? 'constant series' : 'too few points' };
  const obs = spearman(xs, ys);
  const rand = rng(seed);
  let ge = 0;
  for (let i = 0; i < iters; i++) if (Math.abs(spearman(xs, shuffle(ys, rand))) >= Math.abs(obs) - 1e-12) ge++;
  return { rho: obs, p: (ge + 1) / (iters + 1), n: xs.length, iters };
}

/** Theil–Sen slope: the median of all pairwise slopes. Robust to one odd reading. */
export function theilSen(x, y) {
  const s = [];
  for (let i = 0; i < x.length; i++) for (let j = i + 1; j < x.length; j++) {
    if ([x[i], x[j], y[i], y[j]].every(Number.isFinite) && x[j] !== x[i]) s.push((y[j] - y[i]) / (x[j] - x[i]));
  }
  if (!s.length) return null;
  s.sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Fisher's exact test, two-sided, for the 2×2 table [[a, b], [c, d]]. */
export function fisherExact(a, b, c, d) {
  const r1 = a + b, r2 = c + d, c1 = a + c, n = r1 + r2;
  const p = (k) => Math.exp(logChoose(r1, k) + logChoose(r2, c1 - k) - logChoose(n, c1));
  const obs = p(a);
  let s = 0;
  for (let k = Math.max(0, c1 - r2); k <= Math.min(r1, c1); k++) { const pk = p(k); if (pk <= obs * (1 + 1e-7)) s += pk; }
  return Math.min(1, s);
}

/** All ways to choose k of the items (small n only). */
export function combinations(items, k) {
  const out = [];
  const rec = (start, cur) => {
    if (cur.length === k) { out.push(cur.slice()); return; }
    for (let i = start; i < items.length; i++) { cur.push(items[i]); rec(i + 1, cur); cur.pop(); }
  };
  rec(0, []);
  return out;
}

export const median = (xs) => {
  const s = xs.filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (!s.length) return null;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
export const round = (v, k = 4) => (v === null || v === undefined || !Number.isFinite(v) ? v : Math.round(v * 10 ** k) / 10 ** k);
