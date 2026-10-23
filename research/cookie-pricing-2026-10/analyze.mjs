#!/usr/bin/env node
/**
 * The pre-registered analyses of METHOD.md §3–§5, as code. Each function takes a raw file written by a probe and
 * returns numbers plus a verdict from a fixed vocabulary; the verdict rules are the ones METHOD.md states, and the
 * self-test (selftest.mjs) shows each rule firing on a fixture that has the effect and staying silent on one that
 * does not.
 *
 *   node analyze.mjs assign  raw/j1-assign-….json   [--json]
 *   node analyze.mjs cookies raw/j1-cookies-….json  [--split 0.5]
 *   node analyze.mjs history raw/j1-history-….json
 *   node analyze.mjs repeat  raw/j2-….json
 *   node analyze.mjs power                          # the sensitivity numbers quoted in METHOD.md §6
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { wilson, binomTwoSided, permChiSquare, permMeanDiff, signFlip, permSpearman, theilSen, fisherExact, combinations, median, round, rng } from './stats.mjs';

const ALPHA = 0.05;
const r4 = (v) => round(v, 4);
const ci = (w) => (w.n ? { share: r4(w.p), lo: r4(w.lo), hi: r4(w.hi), x: w.x, n: w.n } : { share: null, n: 0 });

// ── J1.1 / J1.1b / J1.4 ─────────────────────────────────────────────────────────────────────────────────
export function analyzeAssign(raw) {
  const recs = raw.records;
  const main = recs.filter((r) => r.kind === 'main');
  const reads = main.filter((r) => r.offerId && !r.wall);
  const offers = groupOffers(reads);
  const out = { loads: recs.length, profiles: main.length, observed: reads.length, blocked: main.filter((r) => r.wall).length, noData: main.filter((r) => !r.wall && !r.offerId).length, offers };
  out.blockedByDevice = tally(main.filter((r) => r.wall || !r.offerId).map((r) => r.device));
  out.stores = tally(reads.map((r) => r.store || 'none'));
  if (offers.length < 2) {
    out.verdict = reads.length ? 'NO-SPLIT' : 'NO-DATA';
    out.unseenOfferUpperBound = reads.length ? r4(wilson(0, reads.length).hi) : null;
  } else {
    const low = offers[0].offerId; // offers are sorted by price
    const isLow = reads.map((r) => r.offerId === low);
    const x = isLow.filter(Boolean).length;
    const w = wilson(x, reads.length);
    out.lowOffer = { offerId: low, price: offers[0].price };
    out.split = { ...ci(w), binomVsHalf: r4(binomTwoSided(x, reads.length, 0.5)) };
    out.verdict = reads.length < 20 ? 'INSUFFICIENT' : w.lo <= 0.5 && w.hi >= 0.5 ? 'SPLIT-CONSISTENT-WITH-HALF' : 'SPLIT-UNEVEN';
    const devs = [...new Set(reads.map((r) => r.device))].sort();
    out.perDevice = Object.fromEntries(devs.map((d) => { const rs = reads.filter((r) => r.device === d); return [d, ci(wilson(rs.filter((r) => r.offerId === low).length, rs.length))]; }));
    const dt = permChiSquare(reads.map((r) => r.device), isLow.map(String), { seed: 11 });
    out.device = { chi2: r4(dt.stat), p: r4(dt.p), permutations: dt.iters, verdict: devs.length < 2 ? 'ONE-DEVICE' : dt.p < ALPHA ? 'DEVICE-ASSOCIATED' : 'NO-DEVICE-EFFECT-DETECTED' };
    const ot = permMeanDiff(reads.map((r) => r.loadNo), isLow, { seed: 12 });
    out.order = { meanLoadNoLowMinusHigh: r4(ot.stat), p: r4(ot.p), verdict: ot.p < ALPHA ? 'ORDER-ASSOCIATED' : 'NO-ORDER-EFFECT-DETECTED' };
    if (Object.keys(out.stores).length > 1) out.storeByOffer = cross(reads, (r) => r.store, (r) => (r.offerId === low ? 'low' : 'not-low'));
  }
  const rl = recs.filter((r) => r.kind === 'reload' && r.offerId);
  out.stickiness = { reloads: rl.length, same: rl.filter((r) => r.offerId === r.firstOffer).length, verdict: !rl.length ? 'NOT-MEASURED' : rl.every((r) => r.offerId === r.firstOffer) ? 'STICKY' : 'NOT-STICKY' };
  const fol = recs.filter((r) => r.kind === 'follow');
  const items = [...new Set(fol.map((r) => r.item))];
  const mainLow = out.lowOffer?.offerId ?? null;
  out.follow = Object.fromEntries(items.map((it) => {
    const rs = fol.filter((r) => r.item === it && r.offerId && !r.wall);
    const of = groupOffers(rs);
    const res = { observed: rs.length, blocked: fol.filter((r) => r.item === it && (r.wall || !r.offerId)).length, offers: of, sellers: [...new Set(rs.map((r) => r.sellerId))], walmartSold: rs.some((r) => r.walmartSold) };
    if (of.length < 2) { res.verdict = rs.length ? `NO-SPLIT-IN-${rs.length}` : 'NO-DATA'; res.unseenOfferUpperBound = rs.length ? r4(wilson(0, rs.length).hi) : null; return [it, res]; }
    const lowI = of[0].offerId;
    res.split = ci(wilson(rs.filter((r) => r.offerId === lowI).length, rs.length));
    if (mainLow) {
      const a = rs.filter((r) => r.mainOffer === mainLow && r.offerId === lowI).length, b = rs.filter((r) => r.mainOffer === mainLow && r.offerId !== lowI).length;
      const c2 = rs.filter((r) => r.mainOffer !== mainLow && r.offerId === lowI).length, d = rs.filter((r) => r.mainOffer !== mainLow && r.offerId !== lowI).length;
      res.vsMainBucket = { table: [[a, b], [c2, d]], agreement: r4((a + d) / rs.length), fisherP: r4(fisherExact(a, b, c2, d)) };
      res.verdict = res.vsMainBucket.fisherP < ALPHA ? 'SPLIT-FOLLOWS-MAIN-BUCKET' : 'SPLIT-NOT-SHOWN-TO-FOLLOW-MAIN-BUCKET';
    } else res.verdict = 'SPLIT';
    return [it, res];
  }));
  return out;
}
function groupOffers(reads) {
  const m = new Map();
  for (const r of reads) { const o = m.get(r.offerId) || { offerId: r.offerId, n: 0, prices: new Set(), sellerId: r.sellerId }; o.n++; o.prices.add(r.price); m.set(r.offerId, o); }
  return [...m.values()].map((o) => ({ ...o, prices: [...o.prices].sort((a, b) => a - b), price: median([...o.prices]) })).sort((a, b) => a.price - b.price);
}
const tally = (xs) => xs.reduce((m, x) => ((m[x] = (m[x] || 0) + 1), m), {});
const cross = (rs, f, g) => rs.reduce((m, r) => { const k = f(r); m[k] ??= {}; m[k][g(r)] = (m[k][g(r)] || 0) + 1; return m; }, {});

// ── J1.2 ────────────────────────────────────────────────────────────────────────────────────────────────
export function analyzeCookies(raw, { split = 0.5 } = {}) {
  const s = raw.meta.summary || {};
  const copies = raw.records.filter((r) => r.kind === 'copy');
  const p = split, q = 1 - split;
  // chance that a set which does NOT carry the offer passes k alternating copies by luck (each copy re-drawn)
  const luck = (k) => r4(p ** Math.ceil(k / 2) * q ** Math.floor(k / 2));
  return {
    conclusion: s.conclusion ?? null,
    verdict: (s.conclusion || 'NONE').split(':')[0],
    donors: s.donors ? { A: { offerId: s.donors.A.offerId, price: s.donors.A.price }, B: { offerId: s.donors.B.offerId, price: s.donors.B.price } } : null,
    universe: s.universe?.length ?? 0, excludedBotManager: s.excludedBotManager ?? [],
    deciders: (s.deciders || []).map((d) => ({ name: d.name, role: d.role, carriesAlone: d.carriesAlone, aloneCopies: d.outcomes?.length ?? 0, chanceAloneByLuck: d.carriesAlone === 'yes' ? luck(d.outcomes.length) : null })),
    steps: (s.steps || []).length,
    copies: copies.length, resolvedCopies: copies.filter((r) => r.outcome).length, walledCopies: copies.filter((r) => r.wall).length,
    donorRecheck: raw.records.filter((r) => r.kind === 'donor-recheck').map((r) => ({ donor: r.donor, sameAsAtStart: r.sameAsAtStart ?? null })),
    falsePositiveBounds: { full6: luck(6), alone6: luck(6), ddmin8: luck(8), bisectStep2pairs: r4(2 * (p * q) ** 2) },
  };
}

// ── J1.3 ────────────────────────────────────────────────────────────────────────────────────────────────
export function analyzeHistory(raw) {
  const enrolled = raw.events.find((e) => e.type === 'enrolled');
  if (!enrolled) return { verdict: 'NOT-ENROLLED', why: raw.events.find((e) => e.type === 'stopped')?.why ?? null };
  const readings = raw.records.filter((r) => r.kind === 'reading');
  const profiles = enrolled.profiles.map((p) => {
    const rs = readings.filter((r) => r.profile === p.id);
    const ok = rs.filter((r) => r.offerId && !r.wall);
    const changed = ok.map((r) => !!r.changedFromBaseline);
    const persistent = changed.some((x, i) => i > 0 && x && changed[i - 1]);
    const dirs = [...new Set(ok.filter((r) => r.changedFromBaseline).map((r) => (r.offerId !== p.baseline.offerId ? 'offer-switch' : Math.sign(r.price - p.baseline.price) > 0 ? 'up' : 'down')))];
    const swaps = raw.records.filter((r) => r.kind === 'swap' && r.source === p.id && r.offerId);
    return { id: p.id, bucket: p.bucket, role: p.role, readings: rs.length, observed: ok.length, blocked: rs.length - ok.length, changedShare: ok.length ? r4(changed.filter(Boolean).length / ok.length) : null, persistentChange: persistent, directions: dirs, series: ok.map((r) => [r.event, r.price, r.offerId === p.baseline.offerId ? 'same-offer' : 'other-offer']), cookieNamesChanged: [...new Set(ok.flatMap((r) => r.cookieDiff?.changed || []))].sort(), swap: swaps.length ? { copies: swaps.length, carried: swaps.filter((r) => r.matchesSourceLatest).length } : null, withdrawn: raw.events.some((e) => e.type === 'withdrawn' && e.profile === p.id) };
  });
  const shoppers = profiles.filter((p) => p.role === 'shopper'), controls = profiles.filter((p) => p.role === 'control');
  const shopCh = shoppers.filter((p) => p.persistentChange), ctlCh = controls.filter((p) => p.persistentChange);
  // difference in the share of readings that differ from baseline, shoppers − controls, over the randomisation used
  const stat = (shopIds) => { const S = profiles.filter((p) => shopIds.includes(p.id)), C = profiles.filter((p) => !shopIds.includes(p.id)); const m = (xs) => xs.reduce((a, p) => a + (p.changedShare || 0), 0) / (xs.length || 1); return m(S) - m(C); };
  const obs = stat(shoppers.map((p) => p.id));
  // the randomisation actually used: within each bucket (two buckets as registered; one under deviation D8)
  const strata = [...new Set(profiles.map((p) => p.bucket))].map((b) => combinations(profiles.filter((p) => p.bucket === b).map((p) => p.id), shoppers.filter((p) => p.bucket === b).length));
  const assignments = strata.reduce((acc, opts) => acc.flatMap((a) => opts.map((o) => [...a, ...o])), [[]]);
  const pPerm = assignments.filter((a) => Math.abs(stat(a)) >= Math.abs(obs) - 1e-12).length / assignments.length;
  const sameDir = (ps) => { const d = new Set(ps.flatMap((p) => p.directions)); return d.size === 1 ? [...d][0] : d.size ? 'mixed' : null; };
  let verdict;
  if (!profiles.some((p) => p.changedShare > 0)) verdict = 'NO-CHANGE';
  else if (ctlCh.length && shopCh.length && sameDir([...shopCh, ...ctlCh]) !== 'mixed') verdict = 'GLOBAL-CHANGE';
  else if (ctlCh.length && !shopCh.length) verdict = 'CONTROL-ONLY-CHANGE';
  else if (shopCh.length >= 2 && !ctlCh.length && sameDir(shopCh) !== 'mixed') verdict = shopCh.some((p) => p.swap && p.swap.carried === p.swap.copies && p.swap.copies >= 2) ? 'HISTORY-EFFECT' : 'CHANGE-NOT-CARRIED-BY-COOKIES';
  else verdict = 'MIXED';
  const carts = raw.records.filter((r) => r.kind === 'cart-add');
  const empties = raw.records.filter((r) => r.kind === 'cart-empty');
  const sessions = new Set(carts.map((r) => `${r.event}|${r.profile}`));
  return {
    verdict, profiles, shoppersChanged: shopCh.length, controlsChanged: ctlCh.length,
    did: { stat: r4(obs), p: r4(pPerm), assignments: assignments.length, minimumP: r4(1 / assignments.length), note: 'descriptive: with six profiles the smallest attainable p is 1/assignments' },
    cartSafety: { adds: carts.filter((r) => r.added).length, addFailures: carts.filter((r) => !r.added).length, sessions: sessions.size, sessionsSeenEmpty: [...sessions].filter((k) => empties.some((e) => `${e.event}|${e.profile}` === k && e.emptied)).length, withdrawn: raw.events.filter((e) => e.type === 'withdrawn').length, cleanups: raw.records.filter((r) => r.kind === 'cart-cleanup').length },
    skippedEvents: raw.events.filter((e) => e.type === 'event-skipped').map((e) => e.id),
  };
}

// ── J2 ──────────────────────────────────────────────────────────────────────────────────────────────────
export function analyzeRepeat(raw) {
  const loads = raw.records.filter((r) => r.kind === 'load');
  const sites = [...new Set(loads.map((r) => r.site))];
  return Object.fromEntries(sites.map((site) => [site, repeatSite(loads.filter((r) => r.site === site), raw.meta.slots)]));
}
function repeatSite(L, S) {
  const val = (arm, slot) => { const r = L.find((x) => x.arm === arm && x.slot === slot && !x.wall); return r?.primary?.nightly ?? null; };
  const slots = Array.from({ length: S }, (_, i) => i + 1);
  const rep = slots.map((s) => val('repeat', s)), fr = slots.map((s) => val('fresh', s));
  const d = slots.map((_, i) => (rep[i] !== null && fr[i] !== null ? r4(rep[i] - fr[i]) : null));
  const later = d.slice(1).filter((x) => x !== null);
  const out = { loads: L.length, blocked: L.filter((r) => r.wall).length, noPrice: L.filter((r) => !r.wall && !r.primary).length, repeat: rep, fresh: fr, d };
  out.availability = slots.map((s) => { const r = L.find((x) => x.arm === 'fresh' && x.slot === s && !x.wall); return r ? { roomCards: r.availability.roomCards, soldOut: r.availability.soldOut, primaryLeft: r.primary?.left ?? null, cheapest: r.availability.cheapest } : null; });
  // DEMAND: the fresh series over the slots (what everyone would see)
  const xs = slots.filter((_, i) => fr[i] !== null), ys = fr.filter((v) => v !== null);
  const ft = permSpearman(xs, ys, { seed: 21 });
  const rt = permSpearman(slots.filter((_, i) => rep[i] !== null), rep.filter((v) => v !== null), { seed: 22 });
  out.demand = { freshRho: r4(ft.rho), p: r4(ft.p), theilSenPerSlot: r4(theilSen(xs, ys)), first: ys[0] ?? null, last: ys.at(-1) ?? null, min: ys.length ? Math.min(...ys) : null, max: ys.length ? Math.max(...ys) : null, repeatRho: r4(rt.rho), repeatP: r4(rt.p) };
  out.demand.verdict = ys.length < 6 ? 'INCONCLUSIVE' : ft.p < ALPHA ? (ft.rho > 0 ? 'RISING' : 'FALLING') : 'NONE-DETECTED';
  const signs = ys.slice(1).map((v, i) => Math.sign(v - ys[i])).filter((x) => x !== 0);
  out.freshDispersion = { distinct: new Set(ys).size, reversals: signs.filter((x, i) => i > 0 && x !== signs[i - 1]).length };
  out.freshDispersion.flag = out.freshDispersion.distinct >= 2 && out.freshDispersion.reversals >= 2;
  // PERSONAL: repeat − fresh at the same slot, slots 2..S (slot 1 is both browsers' first view)
  const sf = signFlip(later);
  const need = Math.ceil((2 * later.length) / 3);
  const sgn = Math.sign(sf.sum);
  const persist = later.filter((x) => Math.sign(x) === sgn && x !== 0).length;
  const own = rep[0] === null ? null : rep.slice(1).filter((v) => v !== null && Math.sign(v - rep[0]) === sgn && sgn !== 0).length;
  const dose = permSpearman(slots.filter((_, i) => d[i] !== null), d.filter((x) => x !== null), { seed: 23 });
  out.personal = { slotsCompared: later.length, meanGap: r4(sf.mean), sum: r4(sf.sum), signFlipP: r4(sf.p), exact: sf.exact, sameSignSlots: persist, needed: need, gapAtFirstView: d[0], repeatOwnChangeSlots: own, doseRho: r4(dose.rho), doseP: r4(dose.p) };
  // the swap: does the repeat browser's gap travel with its cookies (C) or cookies + localStorage (CS)? Each swap
  // browser is compared with the fresh browser loaded seconds from it, so a price that drifts for everyone between
  // two pairs cannot fake (or hide) a carried gap. "Carried" = the swap's gap over its fresh partner is nearer the
  // gap the slots measured (median repeat − fresh, slots 2..S) than it is to zero.
  const now = L.find((x) => x.arm === 'repeat-now' && !x.wall)?.primary?.nightly ?? null;
  const g = later.length ? median(later) : null;
  const swapOf = (arm) => {
    const res = [];
    for (const k of [1, 2, 3]) {
      const sw = L.find((x) => x.arm === arm && x.slot === `swap-${k}` && !x.wall)?.primary?.nightly ?? null;
      const fe = L.find((x) => x.arm === 'swap-fresh' && x.slot === `swap-${k}` && !x.wall)?.primary?.nightly ?? null;
      if (!L.some((x) => x.arm === arm && x.slot === `swap-${k}`)) continue;
      const gap = sw === null || fe === null ? null : r4(sw - fe);
      const outcome = g === null || gap === null ? 'unresolved' : g === 0 ? 'no-gap' : Math.abs(gap - g) < Math.abs(gap) ? 'carried' : Math.abs(gap - g) > Math.abs(gap) ? 'not-carried' : 'other';
      res.push({ k, swap: sw, fresh: fe, swapGap: gap, measuredGap: g, outcome });
    }
    const o = res.map((r) => r.outcome);
    return { copies: res, verdict: !o.length ? 'NOT-RUN' : o.every((x) => x === 'carried') ? 'CARRIES' : o.includes('not-carried') ? 'NOT-CARRIED' : o.every((x) => x === 'no-gap') ? 'NO-GAP' : 'MIXED' };
  };
  out.swap = { repeatNow: now, C: swapOf('swap-C'), CS: swapOf('swap-CS') };
  const P = out.personal;
  let v;
  if (later.length < 6) v = out.blocked > L.length / 3 ? 'BLOCKED' : 'INCONCLUSIVE';
  else if (sf.p < ALPHA && persist >= need) {
    const firstSmall = d[0] !== null && Math.abs(d[0]) <= 0.5 * Math.abs(median(later));
    const ownMoved = own !== null && own >= need;
    if (d[0] === null || rep[0] === null) v = 'GAP-ORIGIN-UNKNOWN';
    else if (firstSmall && ownMoved) v = out.swap.C.verdict === 'CARRIES' ? 'REPEAT-VIEW-EFFECT (carried by cookies)' : out.swap.CS.verdict === 'CARRIES' ? 'REPEAT-VIEW-EFFECT (carried by cookies + localStorage)' : 'GAP-NOT-CARRIED';
    else v = 'VISITOR-BUCKET';
  } else v = 'NONE-DETECTED';
  P.verdict = v;
  return out;
}

// ── sensitivity, for METHOD.md §6 ───────────────────────────────────────────────────────────────────────
export function power() {
  const rand = rng(99);
  const out = {};
  const n = 40;
  out.j11 = { n, ciHalfWidthAtHalf: r4((wilson(20, 40).hi - wilson(20, 40).lo) / 2), powerVsHalf: {} };
  for (const pt of [0.6, 0.7, 0.75, 0.8, 0.9]) { let hit = 0; for (let i = 0; i < 4000; i++) { let x = 0; for (let j = 0; j < n; j++) if (rand() < pt) x++; if (binomTwoSided(x, n) < ALPHA) hit++; } out.j11.powerVsHalf[pt] = r4(hit / 4000); }
  const devs = ['mac-chrome', 'win-chrome', 'iphone-safari', 'android-chrome'];
  const scen = { 'all 0.5 (false-positive rate)': [0.5, 0.5, 0.5, 0.5], 'one device 0.9, others 0.5': [0.5, 0.5, 0.9, 0.5], 'phones 0.8, desktops 0.2': [0.2, 0.2, 0.8, 0.8], 'phones 0.7, desktops 0.3': [0.3, 0.3, 0.7, 0.7], 'phones 0.65, desktops 0.35': [0.35, 0.35, 0.65, 0.65] };
  out.j11b = { perDevice: 10, datasets: 400, permutations: 999, power: {} };
  for (const [name, ps] of Object.entries(scen)) {
    let hit = 0;
    for (let i = 0; i < 400; i++) {
      const g = [], o = [];
      devs.forEach((dv, k) => { for (let j = 0; j < 10; j++) { g.push(dv); o.push(String(rand() < ps[k])); } });
      if (permChiSquare(g, o, { iters: 999, seed: i + 1 }).p < ALPHA) hit++;
    }
    out.j11b.power[name] = r4(hit / 400);
  }
  out.j2SignFlip = Object.fromEntries([3, 4, 5, 6, 7, 8, 9].map((k) => [`${k} of 9 slots show the same gap, the rest 0`, r4(signFlip([...Array(k).fill(5), ...Array(9 - k).fill(0)]).p)]));
  out.j2SignFlip['9 slots: 7 at +5, 2 at -5'] = r4(signFlip([5, 5, 5, 5, 5, 5, 5, -5, -5]).p);
  out.j2Demand = {};
  for (const s of [2, 4, 6, 8, 9, 10]) { const y = Array.from({ length: 10 }, (_, i) => (i + 1 >= s ? 5 : 0)); const t = permSpearman(Array.from({ length: 10 }, (_, i) => i + 1), y, { seed: 5 }); out.j2Demand[`one step up from slot ${s}`] = { rho: r4(t.rho), p: r4(t.p) }; }
  const lin = permSpearman(Array.from({ length: 10 }, (_, i) => i + 1), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5], { seed: 5 });
  out.j2Demand['steady climb (two slots per step)'] = { rho: r4(lin.rho), p: r4(lin.p) };
  out.j12 = { 'FULL, 6 copies': r4(0.5 ** 6), 'ALONE, 6 copies': r4(0.5 ** 6), 'DDMIN test, 8 copies': r4(0.5 ** 8), 'BISECT step, 2 mirror pairs agreeing': r4(2 * (0.25 * 0.25)), note: 'chance that a set which does not carry the offer passes by luck, if fresh profiles are re-drawn 50/50' };
  out.j13 = { stratifiedAssignments: 9, minimumP: r4(1 / 9) };
  return out;
}

/**
 * Pool runs of the same probe made under the same protocol (J1.1 stopped for the day by its wall rule and resumed the
 * next day): profile ids get a run prefix, load numbers continue, events are kept per run.
 */
export function pool(raws) {
  let offset = 0;
  const records = [], events = [];
  raws.forEach((r, k) => {
    const maxLoad = Math.max(0, ...r.records.map((x) => x.loadNo || 0));
    for (const x of r.records) records.push({ ...x, profile: x.profile ? `r${k + 1}-${x.profile}` : x.profile, loadNo: x.loadNo ? x.loadNo + offset : x.loadNo, run: k + 1 });
    for (const e of r.events) events.push({ ...e, run: k + 1 });
    offset += maxLoad;
  });
  return { meta: { ...raws[0].meta, pooledRuns: raws.map((r) => ({ startedAt: r.meta.startedAt, gitHead: r.meta.gitHead, records: r.records.length })) }, records, events };
}

// ── CLI ─────────────────────────────────────────────────────────────────────────────────────────────────
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [kind, ...rest] = process.argv.slice(2);
  const files = rest.filter((a, i) => !a.startsWith('--') && !(i > 0 && rest[i - 1] === '--split'));
  const raw = files.length > 1 ? pool(files.map((f) => JSON.parse(fs.readFileSync(f, 'utf8')))) : files.length ? JSON.parse(fs.readFileSync(files[0], 'utf8')) : null;
  const splitArg = process.argv.indexOf('--split');
  const res = kind === 'assign' ? analyzeAssign(raw) : kind === 'cookies' ? analyzeCookies(raw, { split: splitArg > 0 ? Number(process.argv[splitArg + 1]) : 0.5 }) : kind === 'history' ? analyzeHistory(raw) : kind === 'repeat' ? analyzeRepeat(raw) : kind === 'power' ? power() : null;
  if (!res) { console.error('usage: analyze.mjs assign|cookies|history|repeat <raw.json> | power'); process.exit(2); }
  console.log(JSON.stringify(res, null, 1));
}
