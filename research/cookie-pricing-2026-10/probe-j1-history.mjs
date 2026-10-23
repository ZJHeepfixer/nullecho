#!/usr/bin/env node
/**
 * J1.3 (METHOD.md §3.3): does three days of shopping move a visitor's offer or price?
 *
 * Six persistent mac-chrome profiles, three per offer bucket; in each bucket two are SHOPPERS and one is a CONTROL
 * (seeded draw). Every day: a morning reading of the item in all six, a shopping session for the four shoppers
 * (the item, two related items, add to cart, open the cart, empty it, SEE it empty), an evening reading. After the
 * last reading, any profile whose offer/price changed and stayed changed has its cookies copied into two fresh
 * profiles (does the change follow the cookies?). Nothing is ever bought; a cart that cannot be seen empty withdraws
 * its profile and clears that profile's site cookies.
 *
 * Resumable: profiles and cookie VALUES live only in the private --state directory (never in the repo); the raw
 * file in the repo gets names, roles and readings.
 *
 *   node probe-j1-history.mjs init   --site walmart --live [--state DIR] --out raw/j1-history-2026-10-xx.json
 *   node probe-j1-history.mjs daemon --live [--state DIR]        # runs every event when it falls due, then exits
 *   node probe-j1-history.mjs tick   [--state DIR] [--through d2-pm]   # run what is due now (fixture: everything up to an id)
 *   node probe-j1-history.mjs status [--state DIR]
 */
import fs from 'node:fs';
import path from 'node:path';
import { cli, makeCtx, launch, devicePage, closeAll, assertTarget, Recorder, WallRules, powerGate, siteJar, setJar, describeCookies, isBotManager, runMeta, gapMs, sleep, liveLock, PRIVATE_DIR, HERE, today } from './lib.mjs';
import { itemSite, readItem, itemSummary, storeLabeler, relatedItems, addToCart, emptyCart } from './adapters.mjs';
import { rng, shuffle } from './stats.mjs';

const c = cli();
const cmd = c.positional[0] || 'status';
const STATE_DIR = path.resolve(c.opt('--state', path.join(PRIVATE_DIR, 'j1-history')));
const STATE = path.join(STATE_DIR, 'state.json');
const DEVICE = 'mac-chrome';
const LATE_SKIP_MS = 4 * 3600e3;

const loadState = () => JSON.parse(fs.readFileSync(STATE, 'utf8'));
const saveState = (s) => { fs.mkdirSync(STATE_DIR, { recursive: true }); fs.writeFileSync(`${STATE}.tmp`, JSON.stringify(s, null, 1)); fs.renameSync(`${STATE}.tmp`, STATE); };

function schedule(t0, { days, readTimes, shopTime, dayMs }) {
  const at = (d, hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    if (dayMs) return t0 + dayMs * (d - 1 + (h * 60 + m) / 1440);
    const b = new Date(t0);
    return new Date(b.getFullYear(), b.getMonth(), b.getDate() + d, h, m).getTime();
  };
  const ev = [];
  for (let d = 1; d <= days; d++) {
    ev.push({ id: `d${d}-am`, type: 'read', day: d, slot: 'am', due: at(d, readTimes[0]) });
    ev.push({ id: `d${d}-shop`, type: 'shop', day: d, due: at(d, shopTime) });
    ev.push({ id: `d${d}-pm`, type: 'read', day: d, slot: 'pm', due: at(d, readTimes[1]) });
  }
  ev.push({ id: 'swap', type: 'swap', due: ev.at(-1).due + (dayMs ? dayMs / 96 : 15 * 60000) });
  return ev;
}

const jarKey = (k) => `${k.name}|${k.domain}|${k.path}`;
function jarDiff(baseline, now) {
  const b = new Map(baseline.map((k) => [jarKey(k), k.value]));
  const n = new Map(now.map((k) => [jarKey(k), k.value]));
  const name = (key) => key.split('|')[0];
  return {
    changed: [...n.keys()].filter((k) => b.has(k) && b.get(k) !== n.get(k)).map(name).sort(),
    added: [...n.keys()].filter((k) => !b.has(k)).map(name).sort(),
    gone: [...b.keys()].filter((k) => !n.has(k)).map(name).sort(),
  };
}

// ── init: enrol six profiles ────────────────────────────────────────────────────────────────────────────
async function init() {
  if (fs.existsSync(STATE)) { console.error(`state exists at --state; refusing to re-initialise`); process.exit(2); }
  const site = itemSite(c.opt('--site', 'fixture'), c.opt('--origin'));
  const item = c.opt('--item', '5689919121');
  const ctx = makeCtx(c, { label: 'j1-history' });
  assertTarget(site.itemUrl(item), ctx.live);
  const release = await liveLock(ctx, 'j1-history-init');
  const seed = c.num('--seed', 20261019);
  const rand = rng(seed);
  const cfg = {
    site: c.opt('--site', 'fixture'), origin: c.opt('--origin'), item, seed, live: ctx.live, headless: ctx.headless,
    days: c.num('--days', 3), readTimes: c.list('--read-times', '09:30,18:30'), shopTime: c.opt('--shop-time', '10:00'), dayMs: c.num('--day-ms', 0),
    gap: [c.num('--gap-min', 45000), c.num('--gap-max', 75000)], stepGap: [c.num('--step-min', 20000), c.num('--step-max', 40000)],
    out: path.resolve(c.opt('--out', path.join(HERE, 'raw', `j1-history-${today()}.json`))), perBucket: c.num('--per-bucket', 3), enrollMax: c.num('--enroll-max', 14),
    // Deviation D1 (RESULTS.md): walmart.com's cart controls could not be calibrated within budget, so the live run
    // shops by views only. --no-cart skips add/empty; the cart code stays for a later, calibrated run.
    cart: !c.flag('--no-cart'),
    // Deviation D8: walmart.com showed ONE offer to every new visitor on 2026-10-23, so the two-bucket design cannot be
    // enrolled. --single-bucket enrols six profiles on that offer: four shoppers, two controls, drawn at random.
    single: c.flag('--single-bucket'),
  };
  const rec = new Recorder(cfg.out, { study: 'J1.3 does shopping history move the offer', site: site.id, item, device: DEVICE, seed, days: cfg.days, readTimes: cfg.readTimes, shopTime: cfg.shopTime, compressedDayMs: cfg.dayMs || null });
  const storeLabel = storeLabeler();
  const timing = ctx.live ? {} : { minMs: 200, settleMs: 3000 };
  const kept = []; let first = true;
  const counts = new Map();
  const enough = () => (cfg.single ? [...counts.values()].some((v) => v >= 2 * cfg.perBucket) : counts.size >= 2 && [...counts.values()].every((v) => v >= cfg.perBucket));
  for (let i = 1; i <= cfg.enrollMax && !enough(); i++) {
    await powerGate({ onPause: (p) => rec.event({ type: 'power-pause', source: p.source, pct: p.pct }) });
    const dir = path.join(STATE_DIR, 'profiles', `e${String(i).padStart(2, '0')}`);
    fs.mkdirSync(dir, { recursive: true });
    const env = await launch(ctx, { userDataDir: dir });
    if (first) { Object.assign(rec.data.meta, runMeta(ctx), { deviceProfile: ctx.profiles[DEVICE] }); first = false; }
    const page = await devicePage(ctx, env.browser, DEVICE);
    const r = await readItem(page, site.itemUrl(item), timing);
    const jar = await siteJar(env.browser, site.host); rec.secretJar(jar);
    await env.close();
    const s = itemSummary(r, storeLabel);
    const keep = cfg.single ? !!r.product && (counts.size === 0 || counts.has(s.offerId)) && (counts.get(s.offerId) || 0) < 2 * cfg.perBucket : !!r.product && (counts.get(s.offerId) || 0) < cfg.perBucket && (counts.size < 2 || counts.has(s.offerId));
    rec.add({ kind: 'enroll', try: i, at: new Date().toISOString(), kept: keep, ...s, cookies: describeCookies(jar) });
    if (keep) { counts.set(s.offerId, (counts.get(s.offerId) || 0) + 1); kept.push({ dir, offerId: s.offerId, price: s.price, jar: jar.map(({ name, value, domain, path: p }) => ({ name, value, domain, path: p })), at: new Date().toISOString() }); }
    else fs.rmSync(dir, { recursive: true, force: true });
    await sleep(gapMs(rand, ...cfg.gap));
  }
  await closeAll(ctx);
  const buckets = [...counts.keys()];
  if (cfg.single ? !enough() : buckets.length < 2 || buckets.some((b) => counts.get(b) < 2)) {
    rec.event({ type: 'stopped', why: `enrolment found ${buckets.map((b) => `${counts.get(b)}×${b}`).join(', ') || 'nothing'}; J1.3 needs ≥2 profiles in each of two offers` });
    for (const k of kept) fs.rmSync(k.dir, { recursive: true, force: true });
    release(); return;
  }
  const profiles = [];
  let n = 0;
  if (cfg.single) {
    const all = shuffle(kept, rand);
    all.forEach((k, i) => profiles.push({ id: `h${++n}`, dir: k.dir, bucket: 'single', role: i < all.length - 2 ? 'shopper' : 'control', baseline: { offerId: k.offerId, price: k.price, at: k.at }, baselineJar: k.jar, withdrawn: false }));
  } else for (const b of buckets.sort((x, y) => kept.find((k) => k.offerId === x).price - kept.find((k) => k.offerId === y).price)) {
    const inB = shuffle(kept.filter((k) => k.offerId === b), rand);
    inB.forEach((k, i) => profiles.push({ id: `h${++n}`, dir: k.dir, bucket: b === buckets[0] ? 'low' : 'high', role: i < inB.length - 1 ? 'shopper' : 'control', baseline: { offerId: k.offerId, price: k.price, at: k.at }, baselineJar: k.jar, withdrawn: false }));
  }
  const events = schedule(Date.now(), cfg);
  saveState({ cfg, profiles, events, created: new Date().toISOString() });
  rec.event({ type: 'enrolled', profiles: profiles.map(({ id, bucket, role, baseline }) => ({ id, bucket, role, baseline })), schedule: events.map(({ id, type, due }) => ({ id, type, due: new Date(due).toISOString() })) });
  release();
  console.error(`enrolled ${profiles.length}: ${profiles.map((p) => `${p.id}=${p.bucket}/${p.role}`).join(' ')}`);
}

// ── events ──────────────────────────────────────────────────────────────────────────────────────────────
async function runEvent(st, ev, ctx, rec, rules) {
  const { cfg } = st;
  const site = itemSite(cfg.site, cfg.origin);
  const rand = rng(cfg.seed + ev.due % 100000);
  const storeLabel = (raw) => (raw ? (st.stores ??= {}, st.stores[raw] ??= `S${Object.keys(st.stores).length + 1}`) : null);
  const timing = ctx.live ? {} : { minMs: 200, settleMs: 3000 };
  const active = st.profiles.filter((p) => !p.withdrawn);
  const open = async (p) => launch(ctx, { userDataDir: p.dir });
  const read = async (env, p, url, kind, extra = {}) => {
    const page = await devicePage(ctx, env.browser, DEVICE);
    const r = await readItem(page, url, timing);
    const jar = await siteJar(env.browser, site.host); rec.secretJar(jar);
    await rules.note({ wall: r.wall || !r.product, status: r.http });
    const s = itemSummary(r, storeLabel);
    const changed = r.product ? s.offerId !== p.baseline.offerId || s.price !== p.baseline.price : null;
    rec.add({ kind, event: ev.id, day: ev.day ?? null, slot: ev.slot ?? null, profile: p.id, role: p.role, bucket: p.bucket, at: new Date().toISOString(), ...extra, ...s, changedFromBaseline: kind === 'reading' ? changed : undefined, cookieDiff: kind === 'reading' ? jarDiff(p.baselineJar, jar) : undefined, cookies: kind === 'reading' ? describeCookies(jar) : undefined });
    return { r, s, page, jar };
  };
  if (ev.type === 'read') {
    for (const p of shuffle(active, rand)) {
      await powerGate({ onPause: (x) => rec.event({ type: 'power-pause', source: x.source, pct: x.pct }) });
      const env = await open(p);
      const { s, page } = await read(env, p, site.itemUrl(cfg.item), 'reading');
      if (p.role === 'shopper' && s.cartCount) { const e = await emptyCart(page, site.cartUrl); rec.add({ kind: 'cart-cleanup', event: ev.id, profile: p.id, at: new Date().toISOString(), seenCount: s.cartCount, ...e }); }
      await env.close();
      if (rules.stopped) return;
      await sleep(gapMs(rand, ...cfg.gap));
    }
  } else if (ev.type === 'shop') {
    for (const p of shuffle(active.filter((x) => x.role === 'shopper'), rand)) {
      await powerGate({ onPause: (x) => rec.event({ type: 'power-pause', source: x.source, pct: x.pct }) });
      const env = await open(p);
      const step = () => sleep(gapMs(rand, ...cfg.stepGap));
      const v1 = await read(env, p, site.itemUrl(cfg.item), 'shop-view');
      const rel = v1.r.product ? await relatedItems(v1.page, cfg.item, 2) : [];
      for (const id of rel) { await step(); await read(env, p, site.itemUrl(id), 'shop-related', { relatedItem: id }); }
      await step();
      const v2 = await read(env, p, site.itemUrl(cfg.item), 'shop-view');
      if (cfg.cart === false) { await env.close(); if (rules.stopped) return; await sleep(gapMs(rand, ...cfg.gap)); continue; }
      const add = v2.r.product ? await addToCart(v2.page, v2.s.cartCount) : { added: false, why: 'item page did not load' };
      rec.add({ kind: 'cart-add', event: ev.id, profile: p.id, at: new Date().toISOString(), ...add });
      await step();
      let e = await emptyCart(v2.page, site.cartUrl);
      rec.add({ kind: 'cart-empty', event: ev.id, profile: p.id, at: new Date().toISOString(), attempt: 1, ...e });
      if (!e.emptied) {
        await step(); e = await emptyCart(v2.page, site.cartUrl);
        rec.add({ kind: 'cart-empty', event: ev.id, profile: p.id, at: new Date().toISOString(), attempt: 2, ...e });
        if (!e.emptied) {
          const jar = await siteJar(env.browser, site.host);
          await env.browser.deleteCookie(...jar).catch(() => {});
          p.withdrawn = true;
          rec.event({ type: 'withdrawn', profile: p.id, why: 'cart could not be SEEN empty after two attempts; its site cookies were cleared so no cart stays attached to a lab browser' });
        }
      }
      await env.close();
      if (rules.stopped) return;
      await sleep(gapMs(rand, ...cfg.gap));
    }
  } else if (ev.type === 'swap') {
    const readings = rec.data.records.filter((r) => r.kind === 'reading');
    for (const p of st.profiles) {
      const mine = readings.filter((r) => r.profile === p.id && r.offerId);
      const persistent = mine.some((r, i) => i > 0 && r.changedFromBaseline && mine[i - 1].changedFromBaseline);
      if (!persistent) continue;
      const latest = mine.at(-1);
      const src = await open(p);
      const jar = (await siteJar(src.browser, site.host)).filter((k) => !isBotManager(k.name));
      rec.secretJar(jar);
      await src.close();
      for (let k = 1; k <= 2; k++) {
        await powerGate({});
        const env = await launch(ctx);
        await setJar(env.browser, jar);
        const page = await devicePage(ctx, env.browser, DEVICE);
        const r = await readItem(page, site.itemUrl(cfg.item), timing);
        await rules.note({ wall: r.wall || !r.product, status: r.http });
        const s = itemSummary(r, storeLabel);
        rec.add({ kind: 'swap', event: ev.id, source: p.id, copy: k, at: new Date().toISOString(), ...s, transferred: describeCookies(jar).map((x) => x.name), matchesSourceLatest: r.product ? s.offerId === latest.offerId && s.price === latest.price : null, matchesSourceBaseline: r.product ? s.offerId === p.baseline.offerId && s.price === p.baseline.price : null });
        await env.close();
        await sleep(gapMs(rand, ...cfg.gap));
      }
    }
    if (!st.profiles.some((p) => rec.data.records.some((r) => r.kind === 'swap' && r.source === p.id))) rec.event({ type: 'swap-skipped', why: 'no profile had a change that persisted over two consecutive readings' });
  }
}

async function tick({ through = null } = {}) {
  const st = loadState();
  const ctx = makeCtx(c, { label: 'j1-history' });
  ctx.live = st.cfg.live; ctx.headless = c.flag('--headful') ? false : st.cfg.headless;
  const rec = Recorder.resume(st.cfg.out, {});
  const rules = new WallRules({ coolOffMs: c.num('--cooloff-ms', 15 * 60000) });
  let ran = 0;
  for (const ev of st.events) {
    if (ev.doneAt || ev.skipped) { if (through && ev.id === through) break; continue; }
    const now = Date.now();
    if (!through && ev.due > now) break;
    const late = now - ev.due;
    if (!st.cfg.dayMs && ev.type !== 'swap' && late > LATE_SKIP_MS) { ev.skipped = `more than 4 h late (${Math.round(late / 60000)} min)`; rec.event({ type: 'event-skipped', id: ev.id, why: ev.skipped }); saveState(st); continue; }
    const release = await liveLock(ctx, `j1-history-${ev.id}`);
    rec.event({ type: 'event-start', id: ev.id, lateMs: Math.max(0, late) });
    try { await runEvent(st, ev, ctx, rec, rules); } finally { release(); }
    ev.doneAt = new Date().toISOString(); ran++;
    rec.event({ type: 'event-done', id: ev.id, walls: rules.walls, stoppedBy: rules.stopped });
    saveState(st);
    if (rules.stopped) { rec.event({ type: 'stopped', why: rules.stopped }); break; }
    if (through && ev.id === through) break;
  }
  if (st.events.every((e) => e.doneAt || e.skipped) && !st.finished) { st.finished = new Date().toISOString(); rec.event({ type: 'end', nonLoopbackRequestsBlocked: ctx.blocked.length }); saveState(st); }
  await closeAll(ctx);
  return { ran, finished: !!st.finished };
}

async function daemon() {
  for (;;) {
    const st = loadState();
    if (st.finished) break;
    const next = st.events.find((e) => !e.doneAt && !e.skipped);
    if (!next) break;
    const wait = next.due - Date.now();
    if (wait > 0) { await sleep(Math.min(wait, 60000)); continue; }
    const { finished } = await tick();
    if (finished) break;
  }
  console.error('j1-history: all events done');
}

if (cmd === 'init') await init();
else if (cmd === 'tick') { const r = await tick({ through: c.opt('--through') }); console.error(`ran ${r.ran} event(s)${r.finished ? '; finished' : ''}`); }
else if (cmd === 'daemon') await daemon();
else if (cmd === 'status') {
  const st = loadState();
  for (const e of st.events) console.log(`${e.id.padEnd(8)} ${e.type.padEnd(5)} due ${new Date(e.due).toISOString()} ${e.doneAt ? `done ${e.doneAt}` : e.skipped ? `SKIPPED ${e.skipped}` : 'pending'}`);
  console.log(st.profiles.map((p) => `${p.id} ${p.bucket}/${p.role}${p.withdrawn ? ' WITHDRAWN' : ''}`).join('\n'));
} else { console.error(`unknown command ${cmd}`); process.exit(2); }
