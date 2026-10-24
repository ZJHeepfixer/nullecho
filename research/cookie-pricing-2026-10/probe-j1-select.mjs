#!/usr/bin/env node
/**
 * J1.4 item selection (METHOD.md §3.4) — calibration, not data. The rule is fixed here so the choice of "other
 * marketplace items" is not made by eye: for each registered query, in order, open the search page once in a fresh
 * mac-chrome profile, take the item links in document order (skipping the J1 item and items already chosen), open
 * up to `--tries` of them, and admit the first whose page names a seller that is not walmart.com itself. Stop at
 * `--want` items. Writes j1-items.json (ids, seller, fulfilment; no cookies).
 *
 *   node probe-j1-select.mjs --site walmart --live --out j1-items.json
 */
import path from 'node:path';
import { cli, makeCtx, launch, devicePage, closeAll, assertTarget, Recorder, WallRules, powerGate, runMeta, gapMs, sleep, liveLock, HERE } from './lib.mjs';
import { itemSite, readItem, itemSummary, storeLabeler } from './adapters.mjs';
import { rng } from './stats.mjs';

export const QUERIES = ['Bose QuietComfort headphones', 'Samsung Galaxy Buds', 'Apple iPad 9th generation', 'Nintendo Switch OLED'];
const c = cli();
const site = itemSite(c.opt('--site', 'fixture'), c.opt('--origin'));
const queries = c.opt('--queries') ? c.opt('--queries').split('|') : QUERIES;
const WANT = c.num('--want', 3), TRIES = c.num('--tries', 3);
const MAIN = c.opt('--item', '5689919121');
const GAP_MIN = c.num('--gap-min', 45000), GAP_MAX = c.num('--gap-max', 75000);
const OUT = c.opt('--out', path.join(HERE, 'j1-items.json'));
const searchUrl = (q) => `${site.origin}/search?q=${encodeURIComponent(q)}`;

const ctx = makeCtx(c, { label: 'j1-select' });
assertTarget(searchUrl(queries[0]), ctx.live);
const release = await liveLock(ctx, 'j1-select');
const rand = rng(c.num('--seed', 20261021));
const rec = new Recorder(OUT, { study: 'J1.4 item selection (calibration; not data)', site: site.id, rule: 'per query in order: first item link (document order) whose page names a non-walmart.com seller; up to --tries items per query', queries, want: WANT, tries: TRIES });
const rules = new WallRules({ coolOffMs: c.num('--cooloff-ms', 15 * 60000) });
const storeLabel = storeLabeler();
const timing = ctx.live ? {} : { minMs: 200, settleMs: 3000 };
const chosen = [];
let first = true;
try {
  for (const q of queries) {
    if (chosen.length >= WANT || rules.stopped) break;
    await powerGate({});
    const env = await launch(ctx);
    if (first) { Object.assign(rec.data.meta, runMeta(ctx)); first = false; }
    const page = await devicePage(ctx, env.browser, 'mac-chrome');
    const resp = await page.goto(searchUrl(q), { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => null);
    await sleep(ctx.live ? 5000 : 300);
    const ids = await page.evaluate(() => [...document.querySelectorAll('a[href*="/ip/"]')].map((a) => (/\/ip\/(?:[^/?#]+\/)?(\d{5,})/.exec(a.getAttribute('href') || '') || [])[1]).filter(Boolean)).catch(() => []);
    const cands = [...new Set(ids)].filter((id) => id !== MAIN && !chosen.some((x) => x.item === id)).slice(0, TRIES);
    rec.add({ kind: 'search', query: q, http: resp ? resp.status() : null, links: ids.length, candidates: cands });
    await rules.note({ wall: !ids.length, status: resp ? resp.status() : null });
    for (const id of cands) {
      await sleep(gapMs(rand, GAP_MIN, GAP_MAX));
      const r = await readItem(page, site.itemUrl(id), timing);
      const s = itemSummary(r, storeLabel);
      await rules.note({ wall: r.wall || !r.product, status: r.http });
      const admit = !!r.product && s.walmartSold === false && Number.isFinite(s.price);
      rec.add({ kind: 'candidate', query: q, item: id, admitted: admit, ...s });
      if (admit) { chosen.push({ item: id, query: q, sellerId: s.sellerId, sellerName: s.sellerName, fulfillment: s.fulfillment, price: s.price }); break; }
      if (rules.stopped) break;
    }
    await env.close();
    await sleep(gapMs(rand, GAP_MIN, GAP_MAX));
  }
} finally {
  rec.data.meta.items = chosen;
  rec.event({ type: 'end', chosen: chosen.map((x) => x.item), stoppedBy: rules.stopped, nonLoopbackRequestsBlocked: ctx.blocked.length });
  await closeAll(ctx);
  release();
}
console.error(`chosen: ${chosen.map((x) => `${x.item} (${x.sellerName})`).join(', ') || 'none'}`);
