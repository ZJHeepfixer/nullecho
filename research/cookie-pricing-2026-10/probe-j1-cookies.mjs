#!/usr/bin/env node
/**
 * J1.2 (METHOD.md §3.2): which cookie carries the offer?
 *
 * Donors: two brand-new mac-chrome profiles that drew different offers (A = the cheaper, B = the dearer). Their
 * site cookies are captured in memory right after the reading. U = every cookie name either donor holds, minus the
 * bot-manager class, which is never moved between browsers.
 *
 *   FULL(U)        U from A into fresh profiles, then from B, alternating, up to 6 copies, stop at the first miss.
 *                  If U does not carry the offer, stop: the carrier is not in the transferable jar.
 *   BISECT(U)      "chimera" jars: half of the candidates from A and everything else from B, and the mirror jar.
 *                  Both jars always hold a complete set of names, so a profile is never re-drawn at random; the
 *                  offer shown says which half holds the deciding cookie. Two mirror pairs per step must agree.
 *   VERIFY(d)      d from A + everything else from B → A's offer, and the mirror → B's, twice.
 *   ALONE(d)       d by itself into fresh profiles, 6 copies alternating donors, stop at the first miss.
 *   then again without d (a fallback carrier?), up to three deciders, each preceded by FULL(U minus deciders).
 *   DDMIN          if a bisection step is not a clean mirror (an interaction: the offer needs two cookies together,
 *                  or the site re-draws mixed jars), find a minimal sufficient set by delta debugging with fresh
 *                  transfers (8 copies per test, stop at first miss).
 * Walls are recorded and retried in a NEW profile (up to 2 retries); a copy that never loads is unresolved.
 *
 *   node probe-j1-cookies.mjs --site walmart --live --out raw/j1-cookies-2026-10-xx.json
 */
import path from 'node:path';
import { cli, makeCtx, launch, devicePage, closeAll, assertTarget, Recorder, WallRules, powerGate, siteJar, pickJar, setJar, describeCookies, cookieRole, isBotManager, ROLE_ORDER, runMeta, gapMs, sleep, liveLock, HERE, today } from './lib.mjs';
import { itemSite, readItem, itemSummary, storeLabeler } from './adapters.mjs';
import { rng } from './stats.mjs';

const c = cli();
const site = itemSite(c.opt('--site', 'fixture'), c.opt('--origin'));
const ITEM = c.opt('--item', '5689919121');
const DEVICE = 'mac-chrome';
const GAP_MIN = c.num('--gap-min', 45000), GAP_MAX = c.num('--gap-max', 75000);
const DONOR_TRIES = c.num('--donor-tries', 10);
const BUDGET = c.num('--budget', 90); // resolved copy loads
const SEED = c.num('--seed', 20261018);
const OUT = c.opt('--out', path.join(HERE, 'raw', `j1-cookies-${today()}.json`));

const ctx = makeCtx(c, { label: 'j1-cookies' });
assertTarget(site.itemUrl(ITEM), ctx.live);
const release = await liveLock(ctx, 'j1-cookies');
const rand = rng(SEED);
const storeLabel = storeLabeler();
const rec = new Recorder(OUT, { study: 'J1.2 which cookie carries the offer', site: site.id, item: ITEM, device: DEVICE, gapMs: [GAP_MIN, GAP_MAX], budget: BUDGET, seed: SEED });
const rules = new WallRules({ coolOffMs: c.num('--cooloff-ms', 15 * 60000) });
const timing = ctx.live ? {} : { minMs: 200, settleMs: 3000 };
let resolved = 0, first = true, testNo = 0;
class Stop extends Error {}

async function load(env, kind, extra) {
  await powerGate({ onPause: (p) => rec.event({ type: 'power-pause', source: p.source, pct: p.pct }) });
  const page = await devicePage(ctx, env.browser, DEVICE);
  const r = await readItem(page, site.itemUrl(ITEM), timing);
  const jar = await siteJar(env.browser, site.host);
  rec.secretJar(jar);
  await page.close().catch(() => {});
  await rules.note({ wall: r.wall || !r.product, status: r.http });
  const s = itemSummary(r, storeLabel);
  rec.add({ kind, at: new Date().toISOString(), ...extra, ...s, cookiesAfter: describeCookies(jar) });
  if (rules.stopped) throw new Stop(rules.stopped);
  return { r, s, jar };
}

// ── donors ──────────────────────────────────────────────────────────────────────────────────────────────
const donors = new Map(); // offerId → { env, jar, price }
try {
  for (let i = 1; i <= DONOR_TRIES && donors.size < 2; i++) {
    const env = await launch(ctx);
    if (first) { Object.assign(rec.data.meta, runMeta(ctx), { deviceProfile: ctx.profiles[DEVICE] }); first = false; }
    const { r, s, jar } = await load(env, 'donor-search', { try: i });
    if (r.product && !donors.has(s.offerId)) donors.set(s.offerId, { env, jar, price: s.price, offerId: s.offerId });
    else await env.close();
    await sleep(gapMs(rand, GAP_MIN, GAP_MAX));
  }
} catch (e) { if (!(e instanceof Stop)) throw e; rec.event({ type: 'stopped', why: e.message }); }

const summary = { donors: null, universe: null, excludedBotManager: null, steps: [], deciders: [], conclusion: null };
rec.data.meta.summary = summary;

function finish(conclusion) { summary.conclusion = conclusion; rec.event({ type: 'conclusion', conclusion }); }

if (donors.size < 2) {
  finish(donors.size ? 'ONE-OFFER-ONLY: every donor search drew the same offer; nothing to transfer' : 'NO-DONOR: no donor loaded');
} else {
  const [A, B] = [...donors.values()].sort((x, y) => x.price - y.price);
  const by = { A, B };
  const names = [...new Set([...A.jar, ...B.jar].map((k) => k.name))];
  const U = names.filter((n) => !isBotManager(n)).sort((x, y) => ROLE_ORDER.indexOf(cookieRole(x)) - ROLE_ORDER.indexOf(cookieRole(y)) || x.localeCompare(y));
  summary.donors = { A: { offerId: A.offerId, price: A.price, cookies: describeCookies(A.jar) }, B: { offerId: B.offerId, price: B.price, cookies: describeCookies(B.jar) } };
  summary.universe = U.map((n) => ({ name: n, role: cookieRole(n) }));
  summary.excludedBotManager = names.filter(isBotManager).sort();
  rec.save();

  /** One fresh profile given `assign` (name → 'A' | 'B'); returns 'A', 'B', 'other' or null (never loaded). */
  async function copy(assign, label) {
    if (resolved >= BUDGET) throw new Stop(`budget of ${BUDGET} resolved copies spent`);
    const from = { A: [], B: [] };
    const jar = [];
    for (const [n, src] of Object.entries(assign)) { from[src].push(n); jar.push(...pickJar(by[src].jar, [n])); }
    for (let attempt = 0; attempt < 3; attempt++) {
      const env = await launch(ctx);
      await setJar(env.browser, jar);
      const { r, s } = await load(env, 'copy', { test: testNo, label, attempt, from });
      await env.close();
      await sleep(gapMs(rand, GAP_MIN, GAP_MAX));
      if (r.product) { resolved++; const o = s.offerId === A.offerId ? 'A' : s.offerId === B.offerId ? 'B' : 'other'; rec.data.records.at(-1).outcome = o; rec.save(); return o; }
    }
    return null;
  }
  const only = (set, src) => Object.fromEntries(set.map((n) => [n, src]));
  const chimera = (S, universe, srcS) => Object.fromEntries(universe.map((n) => [n, S.includes(n) ? srcS : srcS === 'A' ? 'B' : 'A']));

  /** Does `set` alone carry each donor's offer? Alternate A, B; stop at the first miss. */
  async function carries(set, copies, label) {
    testNo++;
    const outcomes = [];
    for (let i = 0; i < copies; i++) {
      const src = i % 2 ? 'B' : 'A';
      const o = await copy(only(set, src), `${label}#${i + 1}:${src}`);
      outcomes.push([src, o]);
      if (o === null) return { result: 'unresolved', outcomes };
      if (o !== src) return { result: 'no', outcomes };
    }
    return { result: 'yes', outcomes };
  }
  async function mirrorPair(S, universe, label) {
    testNo++;
    const x = await copy(chimera(S, universe, 'A'), `${label}:S-from-A`);
    const y = await copy(chimera(S, universe, 'B'), `${label}:S-from-B`);
    return x === 'A' && y === 'B' ? 'in-S' : x === 'B' && y === 'A' ? 'not-in-S' : x === null || y === null ? 'unresolved' : `mixed(${x},${y})`;
  }
  async function bisect(universe, round) {
    let C = universe.slice();
    while (C.length > 1) {
      const H1 = C.slice(0, Math.ceil(C.length / 2));
      const p = [await mirrorPair(H1, universe, `r${round}-bisect-${C.length}`), await mirrorPair(H1, universe, `r${round}-bisect-${C.length}`)];
      summary.steps.push({ round, step: 'bisect', candidates: C.length, half: H1, pairs: p });
      rec.save();
      if (p.includes('unresolved')) return { result: 'unresolved', C };
      if (p[0] === 'in-S' && p[1] === 'in-S') C = H1;
      else if (p[0] === 'not-in-S' && p[1] === 'not-in-S') C = C.slice(H1.length);
      else return { result: 'interaction', C, pairs: p };
    }
    const v = [await mirrorPair(C, universe, `r${round}-verify-${C[0]}`), await mirrorPair(C, universe, `r${round}-verify-${C[0]}`)];
    summary.steps.push({ round, step: 'verify', cookie: C[0], pairs: v });
    if (v.includes('unresolved')) return { result: 'unresolved', C };
    return v.every((x) => x === 'in-S') ? { result: 'decider', name: C[0] } : { result: 'interaction', C, pairs: v };
  }
  /** Zeller's ddmin over sufficiency: the smallest set (each member needed) that still carries both offers. */
  async function ddmin(universe) {
    let S = universe.slice(), n = 2;
    while (S.length >= 2) {
      const size = Math.ceil(S.length / n);
      const chunks = []; for (let i = 0; i < S.length; i += size) chunks.push(S.slice(i, i + size));
      let reduced = false;
      for (const ch of chunks) {
        const rest = S.filter((x) => !ch.includes(x));
        if (!rest.length) continue;
        const t = await carries(rest, 8, `ddmin-${rest.length}`);
        summary.steps.push({ step: 'ddmin', tried: rest, result: t.result });
        rec.save();
        if (t.result === 'unresolved') return { result: 'unresolved', set: S };
        if (t.result === 'yes') { S = rest; n = Math.max(n - 1, 2); reduced = true; break; }
      }
      if (!reduced) { if (n >= S.length) break; n = Math.min(S.length, n * 2); }
    }
    const f = await carries(S, 8, 'ddmin-final');
    summary.steps.push({ step: 'ddmin-final', set: S, result: f.result });
    return { result: f.result === 'yes' ? 'minimal-set' : 'unstable', set: S };
  }

  try {
    let universe = U.slice();
    for (let round = 1; round <= 3; round++) {
      const full = await carries(universe, 6, `r${round}-full`);
      summary.steps.push({ round, step: 'full', size: universe.length, result: full.result, outcomes: full.outcomes });
      rec.save();
      if (full.result === 'unresolved') { finish(`UNRESOLVED at round ${round} (walls)`); break; }
      if (full.result === 'no') {
        if (round === 1) finish('JAR-DOES-NOT-CARRY: the transferable (non-bot-manager) cookies do not carry the offer; stop');
        else finish(`NO-FURTHER-CARRIER: without ${summary.deciders.map((d) => d.name).join(' + ')} the remaining cookies do not carry the offer`);
        break;
      }
      const b = await bisect(universe, round);
      if (b.result === 'unresolved') { finish(`UNRESOLVED during bisection, round ${round}`); break; }
      if (b.result === 'interaction') {
        const d = await ddmin(universe);
        summary.steps.push({ round, step: 'interaction', at: b.C, ddmin: d });
        finish(d.result === 'minimal-set' ? `INTERACTION: no single deciding cookie; minimal carrying set {${d.set.join(', ')}}` : `INTERACTION-UNSTABLE: ddmin ended at {${d.set.join(', ')}} but it did not re-verify`);
        break;
      }
      const alone = await carries([b.name], 6, `r${round}-alone-${b.name}`);
      summary.deciders.push({ round, name: b.name, role: cookieRole(b.name), carriesAlone: alone.result, outcomes: alone.outcomes });
      rec.save();
      universe = universe.filter((n) => n !== b.name);
      if (round === 3) finish(`DECIDERS: ${summary.deciders.map((d) => d.name).join(' > ')} (three rounds, the most pre-registered)`);
    }
    if (!summary.conclusion) finish(`DECIDERS: ${summary.deciders.map((d) => d.name).join(' > ')}`);
  } catch (e) {
    if (!(e instanceof Stop)) throw e;
    finish(`STOPPED: ${e.message}${summary.deciders.length ? `; deciders so far ${summary.deciders.map((d) => d.name).join(' > ')}` : ''}`);
  }
  // the donors themselves, at the end: did either drift while it was being copied?
  for (const [k, d] of Object.entries(by)) {
    try { const { s } = await load(d.env, 'donor-recheck', { donor: k }); rec.data.records.at(-1).sameAsAtStart = s.offerId === d.offerId; rec.save(); } catch (e) { if (!(e instanceof Stop)) throw e; }
  }
}
for (const d of donors.values()) await d.env.close();
rec.event({ type: 'end', resolvedCopies: resolved, walls: rules.walls, nonLoopbackRequestsBlocked: ctx.blocked.length });
await closeAll(ctx);
release();
console.error(`${summary.conclusion}\nwrote ${path.relative(process.cwd(), OUT)}`);
