#!/usr/bin/env node
/**
 * Calibration (METHOD.md §2.6) — NOT data. Confirms, in one fresh mac-chrome profile, that a reader works on a site
 * before a measured series depends on it, and prints what it saw so selectors can be set if the heuristic fails.
 *
 *   node probe-calibrate.mjs walmart-cart --site walmart --live [--item 5689919121]
 *        reads the item, presses Add to cart, empties the cart, and reports whether each step was SEEN
 *   node probe-calibrate.mjs hotel --url <hotel page with dates> --room '\bking\b' --live [--card sel --name sel --price sel]
 *        reads the room cards and the registered room's primary measure
 * Output: --out <file> (scrubbed; no cookies), plus a one-line verdict on stderr.
 */
import path from 'node:path';
import { cli, makeCtx, launch, devicePage, closeAll, assertTarget, Recorder, powerGate, runMeta, liveLock, sleep, HERE, today } from './lib.mjs';
import { itemSite, readItem, itemSummary, storeLabeler, addToCart, emptyCart, readHotel, primaryRoom, availability } from './adapters.mjs';

const c = cli();
const what = c.positional[0];
const ctx = makeCtx(c, { label: 'calibrate' });
const OUT = c.opt('--out', path.join(HERE, 'raw', `calibration-${what}-${today()}.json`));
const rec = new Recorder(OUT, { study: `calibration: ${what} (not data)` });
let verdict = 'NOT-RUN';

if (what === 'walmart-cart') {
  const site = itemSite(c.opt('--site', 'fixture'), c.opt('--origin'));
  const item = c.opt('--item', '5689919121');
  assertTarget(site.itemUrl(item), ctx.live);
  const release = await liveLock(ctx, 'calibrate');
  await powerGate({});
  const env = await launch(ctx);
  Object.assign(rec.data.meta, runMeta(ctx));
  const page = await devicePage(ctx, env.browser, 'mac-chrome');
  const r = await readItem(page, site.itemUrl(item), ctx.live ? {} : { minMs: 200, settleMs: 3000 });
  const s = itemSummary(r, storeLabeler());
  rec.add({ kind: 'item', ...s });
  let add = { added: false, why: 'item not read' }, empty = { emptied: false };
  if (r.product) {
    await sleep(ctx.live ? 20000 : 200);
    add = await addToCart(page, s.cartCount);
    rec.add({ kind: 'cart-add', ...add });
    await sleep(ctx.live ? 20000 : 200);
    empty = await emptyCart(page, site.cartUrl);
    rec.add({ kind: 'cart-empty', ...empty });
    if (!empty.emptied) { await sleep(ctx.live ? 20000 : 200); empty = await emptyCart(page, site.cartUrl); rec.add({ kind: 'cart-empty', attempt: 2, ...empty }); }
  }
  if (!empty.emptied && add.added) { const jar = await env.browser.cookies(); await env.browser.deleteCookie(...jar).catch(() => {}); rec.event({ type: 'cookies-cleared', why: 'cart not seen empty; the calibration profile is discarded with its cart' }); }
  await env.close();
  verdict = !r.product ? `ITEM-NOT-READ (${r.wall ? `wall: ${r.wallWhy}` : r.error || 'no product data'})` : !add.added ? `ADD-NOT-CONFIRMED (${add.why})` : !empty.emptied ? 'EMPTY-NOT-SEEN' : 'CART-OK';
  release();
} else if (what === 'hotel') {
  const url = c.opt('--url');
  if (!url) { console.error('--url required'); process.exit(2); }
  assertTarget(url, ctx.live);
  const release = await liveLock(ctx, 'calibrate');
  await powerGate({});
  const env = await launch(ctx);
  Object.assign(rec.data.meta, runMeta(ctx));
  const page = await devicePage(ctx, env.browser, 'mac-chrome');
  const cfg = { cardSelector: c.opt('--card'), nameSelector: c.opt('--name'), priceSelector: c.opt('--price'), settleMs: c.num('--settle-ms', ctx.live ? 25000 : 6000) };
  const r = await readHotel(page, url, cfg);
  const prim = primaryRoom(r.rooms, c.opt('--room', '\\bking\\b'));
  rec.add({ kind: 'hotel', url, http: r.http, wall: !!r.wall, wallWhy: r.wallWhy ?? null, wallText: r.wallText ?? null, how: r.how, title: r.title, rooms: r.rooms, primary: prim, availability: availability(r.rooms), cfg });
  for (const x of (r.rooms || []).slice(0, 12)) console.error(`  card: ${x.name} | nightly ${x.nightly} | total ${x.total} | ${x.fees.join(' / ')}`);
  await env.close();
  verdict = r.wall ? `BLOCKED (${r.wallWhy})` : !(r.rooms || []).length ? 'NO-ROOM-CARDS' : !prim ? 'NO-REGISTERED-ROOM' : `HOTEL-OK (${prim.name} ${prim.nightly}, via ${r.how})`;
  release();
} else { console.error('usage: probe-calibrate.mjs walmart-cart|hotel …'); process.exit(2); }
rec.event({ type: 'end', verdict, nonLoopbackRequestsBlocked: ctx.blocked.length });
await closeAll(ctx);
console.error(verdict);
