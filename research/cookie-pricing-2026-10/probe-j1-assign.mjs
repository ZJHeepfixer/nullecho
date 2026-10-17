#!/usr/bin/env node
/**
 * J1.1 + J1.1b + J1.4 (METHOD.md §3.1, §3.4): which offer does a BRAND-NEW visitor get, does the device it presents
 * change that, does the visitor keep it on a reload, and do other marketplace items split the same way?
 *
 * Every profile is new (no seeding, no extension) and loads the item once. Devices run in shuffled blocks of four, so
 * time cannot masquerade as device. A walled profile is discarded and replaced by a new profile of the same device at
 * the end of the queue. Every `--reload-every`-th successful profile reloads once (stickiness). The first `--follow-n`
 * successful profiles then load the `--follow` items (J1.4).
 *
 *   node probe-j1-assign.mjs --site walmart --live --follow 111,222,333 --out raw/j1-assign-2026-10-xx.json
 *   node probe-j1-assign.mjs --site fixture --origin http://127.0.0.1:PORT --gap-min 0 --gap-max 0 --out /tmp/x.json
 */
import path from 'node:path';
import { cli, makeCtx, launch, devicePage, closeAll, assertTarget, Recorder, WallRules, powerGate, siteJar, describeCookies, runMeta, gapMs, sleep, liveLock, DEVICE_IDS, HERE, today } from './lib.mjs';
import { itemSite, readItem, itemSummary, storeLabeler } from './adapters.mjs';
import { rng, shuffle } from './stats.mjs';

const c = cli();
const site = itemSite(c.opt('--site', 'fixture'), c.opt('--origin'));
const ITEM = c.opt('--item', '5689919121');
const DEVICES = c.list('--devices', DEVICE_IDS.join(','));
const PER_DEVICE = c.num('--per-device', 10);
const FOLLOW = c.list('--follow', '');
const FOLLOW_N = c.num('--follow-n', FOLLOW.length ? 12 : 0);
const RELOAD_EVERY = c.num('--reload-every', 4);
const GAP_MIN = c.num('--gap-min', 45000), GAP_MAX = c.num('--gap-max', 75000);
const MAX_LOADS = c.num('--max-loads', 110);
const MAX_REPLACE = c.num('--max-replacements', 6); // per device
const SEED = c.num('--seed', 20261017);
const OUT = c.opt('--out', path.join(HERE, 'raw', `j1-assign-${today()}.json`));

const ctx = makeCtx(c, { label: 'j1-assign' });
assertTarget(site.itemUrl(ITEM), ctx.live);
for (const f of FOLLOW) assertTarget(site.itemUrl(f), ctx.live);
const release = await liveLock(ctx, 'j1-assign');
const rand = rng(SEED);
const storeLabel = storeLabeler();
const rec = new Recorder(OUT, { study: 'J1.1 assignment + J1.1b device + J1.4 other items', site: site.id, item: ITEM, devices: DEVICES, perDevice: PER_DEVICE, follow: FOLLOW, followN: FOLLOW_N, reloadEvery: RELOAD_EVERY, gapMs: [GAP_MIN, GAP_MAX], maxLoads: MAX_LOADS, seed: SEED });
const rules = new WallRules({ coolOffMs: c.num('--cooloff-ms', 15 * 60000) });
const timing = ctx.live ? {} : { minMs: 200, settleMs: 3000 };

const queue = [];
for (let b = 0; b < PER_DEVICE; b++) queue.push(...shuffle(DEVICES, rand));
const ok = Object.fromEntries(DEVICES.map((d) => [d, 0]));
const replaced = Object.fromEntries(DEVICES.map((d) => [d, 0]));
let loads = 0, profiles = 0, successes = 0, followDone = 0, first = true;

async function one(env, device, item, kind, profile, extra = {}) {
  const page = await devicePage(ctx, env.browser, device);
  const r = await readItem(page, site.itemUrl(item), timing);
  const jar = await siteJar(env.browser, site.host);
  rec.secretJar(jar);
  await page.close().catch(() => {});
  loads++;
  await rules.note({ wall: r.wall || !r.product, status: r.http });
  const s = itemSummary(r, storeLabel);
  rec.add({ kind, profile, device, item, at: new Date().toISOString(), loadNo: loads, ...extra, ...s, cookies: describeCookies(jar) });
  console.error(`${kind.padEnd(6)} ${profile} ${device.padEnd(14)} ${item} http=${r.http} ${r.wall ? `WALL(${r.wallWhy})` : ''} offer=${s.offerId ?? '-'} price=${s.price ?? '-'} store=${s.store ?? '-'}`);
  return { r, s };
}

try {
  while (queue.length && loads < MAX_LOADS && !rules.stopped) {
    const device = queue.shift();
    if (ok[device] >= PER_DEVICE) continue;
    await powerGate({ onPause: (p) => rec.event({ type: 'power-pause', source: p.source, pct: p.pct }) });
    const env = await launch(ctx);
    if (first) { Object.assign(rec.data.meta, runMeta(ctx), { profiles: Object.fromEntries(DEVICES.map((d) => [d, ctx.profiles[d]])) }); first = false; }
    const profile = `p${String(++profiles).padStart(3, '0')}`;
    const { r, s } = await one(env, device, ITEM, 'main', profile);
    if (r.wall || !r.product) {
      if (replaced[device]++ < MAX_REPLACE) queue.push(device);
      else rec.event({ type: 'device-gave-up', device, why: `more than ${MAX_REPLACE} replacements` });
    } else {
      ok[device]++; successes++;
      if (RELOAD_EVERY && successes % RELOAD_EVERY === 0) { await sleep(gapMs(rand, GAP_MIN, GAP_MAX)); await one(env, device, ITEM, 'reload', profile, { firstOffer: s.offerId, firstPrice: s.price }); }
      if (followDone < FOLLOW_N) {
        followDone++;
        for (const f of FOLLOW) { if (rules.stopped) break; await sleep(gapMs(rand, GAP_MIN, GAP_MAX)); await one(env, device, f, 'follow', profile, { mainOffer: s.offerId, mainPrice: s.price }); }
      }
    }
    await env.close();
    if (queue.length) await sleep(gapMs(rand, GAP_MIN, GAP_MAX));
  }
} finally {
  rec.event({ type: 'end', loads, profiles, successesPerDevice: ok, stoppedBy: rules.stopped || (loads >= MAX_LOADS ? 'max loads' : null), walls: rules.walls, nonLoopbackRequestsBlocked: ctx.blocked.length });
  await closeAll(ctx);
  release();
}
console.error(`wrote ${path.relative(process.cwd(), OUT)}`);
