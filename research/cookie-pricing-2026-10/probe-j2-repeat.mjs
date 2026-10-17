#!/usr/bin/env node
/**
 * J2 (METHOD.md §4): does looking at the same hotel again raise the price — for you (PERSONAL) or for everyone
 * (DEMAND)?
 *
 * Per site: one REPEAT browser, kept open for the whole run, views the fixed hotel/dates once per slot; at the same
 * slot a FRESH browser (new profile every slot) views it too, the two loads back to back in a counterbalanced,
 * seeded order (5 slots repeat-first, 5 fresh-first). Slots are 6–9 min apart (10 slots ≈ 60–90 min). Sites
 * alternate inside a slot. After the last slot: the repeat browser reads once more, then its cookies (never the
 * bot-manager class) go into fresh browsers — twice with cookies only (swap-C), once with cookies + localStorage
 * (swap-CS) — each next to a new fresh control.
 *
 * Targets come from a JSON file written at calibration (METHOD.md §4.2) and committed BEFORE the first slot:
 *   { "sites": [ { "id": "priceline", "url": "https://…", "room": "<regex for the registered room type>",
 *                  "cardSelector": null, "nameSelector": null, "priceSelector": null, "settleMs": 25000 } ] }
 *
 *   node probe-j2-repeat.mjs --targets j2-targets.json --live --out raw/j2-2026-10-xx.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { cli, makeCtx, launch, devicePage, closeAll, assertTarget, Recorder, WallRules, powerGate, siteJar, setJar, describeCookies, isBotManager, dumpLocalStorage, restoreLocalStorageOnLoad, runMeta, gapMs, sleep, liveLock, HERE, today } from './lib.mjs';
import { readHotel, primaryRoom, availability } from './adapters.mjs';
import { rng, shuffle } from './stats.mjs';

const c = cli();
const targets = JSON.parse(fs.readFileSync(c.opt('--targets', path.join(HERE, 'j2-targets.json')), 'utf8'));
const SITES = targets.sites.filter((s) => !c.opt('--sites') || c.list('--sites').includes(s.id));
const SLOTS = c.num('--slots', 10);
const SLOT_MIN = c.num('--slot-min', 360000), SLOT_MAX = c.num('--slot-max', 540000);
const PAIR_MIN = c.num('--pair-min', 8000), PAIR_MAX = c.num('--pair-max', 20000);
const SEED = c.num('--seed', 20261020);
const OUT = c.opt('--out', path.join(HERE, 'raw', `j2-${today()}.json`));
const DEVICE = 'mac-chrome';

const ctx = makeCtx(c, { label: 'j2' });
for (const s of SITES) assertTarget(s.url, ctx.live);
const release = await liveLock(ctx, 'j2');
const rand = rng(SEED);
const rec = new Recorder(OUT, { study: 'J2 repeat views vs fresh views', device: DEVICE, slots: SLOTS, slotGapMs: [SLOT_MIN, SLOT_MAX], pairGapMs: [PAIR_MIN, PAIR_MAX], seed: SEED, targets: SITES.map(({ id, url, room, cardSelector, nameSelector, priceSelector, settleMs }) => ({ id, url, room, cardSelector: cardSelector ?? null, nameSelector: nameSelector ?? null, priceSelector: priceSelector ?? null, settleMs: settleMs ?? null })) });
const timingFor = (s) => ({ ...s, settleMs: s.settleMs ?? (ctx.live ? 25000 : 6000) });
// balanced, seeded order per site: exactly half of the slots load the repeat browser first
const order = Object.fromEntries(SITES.map((s) => [s.id, shuffle(Array.from({ length: SLOTS }, (_, i) => i < Math.ceil(SLOTS / 2)), rand)]));
const state = Object.fromEntries(SITES.map((s) => [s.id, { rules: new WallRules({ coolOffMs: c.num('--cooloff-ms', 15 * 60000) }), repeat: null, views: 0, host: new URL(s.url).hostname, origin: new URL(s.url).origin }]));
rec.data.meta.order = Object.fromEntries(Object.entries(order).map(([k, v]) => [k, v.map((x) => (x ? 'repeat-first' : 'fresh-first'))]));
let first = true;

async function view(site, arm, slot, { env = null, jar = null, storage = null } = {}) {
  const st = state[site.id];
  await powerGate({ onPause: (p) => rec.event({ type: 'power-pause', source: p.source, pct: p.pct }) });
  const own = !env;
  if (own) env = await launch(ctx);
  if (first) { Object.assign(rec.data.meta, runMeta(ctx), { deviceProfile: ctx.profiles[DEVICE] }); first = false; }
  if (jar) await setJar(env.browser, jar);
  const page = await devicePage(ctx, env.browser, DEVICE);
  let restoredKeys = null;
  if (storage) restoredKeys = await restoreLocalStorageOnLoad(page, st.origin, storage);
  const r = await readHotel(page, site.url, timingFor(site));
  const cookies = await siteJar(env.browser, st.host);
  rec.secretJar(cookies);
  let ls = null;
  if (arm === 'repeat-now') { ls = await dumpLocalStorage(page); for (const [, v] of ls) rec.secret(v); }
  await page.close().catch(() => {});
  if (own) await env.close();
  if (arm === 'repeat' || arm === 'repeat-now') st.views++;
  await st.rules.note({ wall: r.wall || !(r.rooms || []).length, status: r.http });
  const prim = primaryRoom(r.rooms, site.room);
  const out = rec.add({
    kind: 'load', site: site.id, slot, arm, repeatViewNo: arm.startsWith('repeat') ? st.views : null, at: new Date().toISOString(),
    http: r.http, wall: !!r.wall, wallWhy: r.wallWhy ?? null, wallText: r.wallText ?? null, error: r.error ?? null, how: r.how ?? null, settledMs: r.settledMs ?? null, webdriver: r.webdriver ?? null,
    primary: prim, availability: availability(r.rooms), rooms: (r.rooms || []).map(({ name, nightly, total, struck, fees, left, soldOut, memberOnly }) => ({ name, nightly, total, struck, fees, left, soldOut, memberOnly })),
    cookies: describeCookies(cookies), ...(jar ? { transferred: describeCookies(jar).map((x) => x.name) } : {}), ...(restoredKeys ? { restoredLocalStorageKeys: restoredKeys } : {}),
  });
  console.error(`s${String(slot).padStart(2)} ${site.id.padEnd(10)} ${arm.padEnd(10)} http=${r.http} ${r.wall ? `WALL(${r.wallWhy})` : ''} rooms=${(r.rooms || []).length} primary=${prim ? `${prim.nightly} (${prim.name})` : '-'}`);
  return { out, cookies, ls };
}

try {
  for (const s of SITES) state[s.id].repeat = await launch(ctx);
  for (let slot = 1; slot <= SLOTS; slot++) {
    const t0 = Date.now();
    const siteOrder = slot % 2 ? SITES : SITES.slice().reverse();
    for (const s of siteOrder) {
      const st = state[s.id];
      if (st.rules.stopped) { rec.add({ kind: 'skip', site: s.id, slot, why: st.rules.stopped }); continue; }
      const arms = order[s.id][slot - 1] ? ['repeat', 'fresh'] : ['fresh', 'repeat'];
      for (const [i, arm] of arms.entries()) {
        await view(s, arm, slot, arm === 'repeat' ? { env: st.repeat } : {});
        if (i === 0) await sleep(gapMs(rand, PAIR_MIN, PAIR_MAX));
        if (st.rules.stopped) { rec.event({ type: 'site-stopped', site: s.id, why: st.rules.stopped }); break; }
      }
    }
    if (slot < SLOTS) { const wait = t0 + gapMs(rand, SLOT_MIN, SLOT_MAX) - Date.now(); if (wait > 0) await sleep(wait); }
  }
  // the swap: does whatever the repeat browser sees travel with its cookies (and storage)?
  for (const s of SITES) {
    const st = state[s.id];
    if (st.rules.stopped) continue;
    const now = await view(s, 'repeat-now', 'swap', { env: st.repeat });
    const jar = now.cookies.filter((k) => !isBotManager(k.name));
    const plan = shuffle([['swap-C', 1], ['swap-C', 2], ['swap-CS', 3]], rand);
    for (const [arm, k] of plan) {
      if (st.rules.stopped) break;
      const pair = rand() < 0.5 ? [arm, 'swap-fresh'] : ['swap-fresh', arm];
      for (const a of pair) {
        await view(s, a, `swap-${k}`, a === 'swap-fresh' ? {} : { jar, storage: a === 'swap-CS' ? now.ls : null });
        await sleep(gapMs(rand, PAIR_MIN, PAIR_MAX));
      }
    }
  }
} finally {
  for (const s of SITES) await state[s.id].repeat?.close();
  rec.event({ type: 'end', walls: Object.fromEntries(SITES.map((s) => [s.id, state[s.id].rules.walls])), stopped: Object.fromEntries(SITES.map((s) => [s.id, state[s.id].rules.stopped])), nonLoopbackRequestsBlocked: ctx.blocked.length });
  await closeAll(ctx);
  release();
}
console.error(`wrote ${path.relative(process.cwd(), OUT)}`);
