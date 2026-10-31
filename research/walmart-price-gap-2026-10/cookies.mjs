#!/usr/bin/env node
/**
 * Walmart price gap, step 2: does the price follow the VISITOR (Walmart's own cookies), with no extension at all?
 *
 *   1. Fresh profiles, extension OFF, load item 5689919121 until one profile shows each of the two prices.
 *   2. Copy each profile's walmart.com cookies into brand-new OFF profiles, alternating, `--repeats` times:
 *      if every copy shows its donor's price, the difference can be switched on and off by cookies alone.
 *   3. Narrow it: copy only the experiment cookies (xpa, xptc, exp-ck) vs only the visitor ids (vtc, svtc, ACID, ...).
 *   4. The same two donor profiles load other items: does the $20 gap appear elsewhere?
 * No extension is loaded anywhere in this script. Walls are recorded, never evaded. One load per ~45 s.
 *
 *   NULLECHO_PUPPETEER_DIR=<dir> node research/walmart-price-gap-2026-10/cookies.mjs [--repeats 3]
 */
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (n, d = null) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const REPEATS = Number(opt('--repeats', '3'));
const GAP = Number(opt('--gap-ms', '45000'));
const OTHER = (opt('--others', '11381374703,980653774,17835006350') || '').split(',').filter(Boolean);
// `--with-extension`: the COPIES (not the donors) load the store zip — does the extension change what a copied
// visitor is shown? Donors stay extension-free.
const WITH_EXT = argv.includes('--with-extension');
let EXT_DIR = null;
if (WITH_EXT) {
  const { execFileSync } = await import('node:child_process');
  const REPO = path.resolve(HERE, '..', '..');
  execFileSync('node', ['tools/package.mjs'], { cwd: path.join(REPO, 'ext'), stdio: 'ignore' });
  const v = JSON.parse(fs.readFileSync(path.join(REPO, 'ext', 'manifest.json'), 'utf8')).version;
  EXT_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'wm-cookie-ext-'));
  execFileSync('unzip', ['-q', path.join(REPO, 'dist', `nullecho-${v}-chrome.zip`), '-d', EXT_DIR]);
}
const OUT = opt('--out', path.join(HERE, `raw-cookies-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')}.json`));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const puppeteer = (() => {
  for (const d of [opt('--puppeteer'), process.env.NULLECHO_PUPPETEER_DIR].filter(Boolean)) {
    try { return createRequire(path.join(path.resolve(d), 'package.json'))('puppeteer'); } catch { /* next */ }
  }
  console.error('puppeteer not found'); process.exit(2);
})();
const URL0 = 'https://www.walmart.com/ip/AirPods-Pro-2nd-generation-with-MagSafe-Case-USB-C/5689919121';
const urlOf = (id) => (id === '5689919121' ? URL0 : `https://www.walmart.com/ip/${id}`);
const EXPERIMENT = /^(xpa|xptc|xpm|exp-ck|xptwj|xptwg|_pxvid|bstc)$/;
const VISITOR = /^(vtc|svtc|ACID|hasACID|_m|adblocked|locGuestData|locDataV3|assortmentStoreId|abqme|_astc|auth|userAppVersion|TS01|TS0)/;

const results = [];
const save = () => fs.writeFileSync(OUT, JSON.stringify({ started: START, results }, null, 1));
const START = new Date().toISOString();

async function browserWith(cookies = null, ext = null) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'wm-cookie-'));
  const args = ['--no-first-run', '--window-size=1400,900'];
  if (ext) args.push(`--disable-extensions-except=${ext}`, `--load-extension=${ext}`);
  const browser = await puppeteer.launch({ headless: true, userDataDir: profile, args, ignoreDefaultArgs: ext ? ['--disable-extensions'] : [] });
  if (ext) {
    await browser.waitForTarget((t) => t.type() === 'service_worker' && /\/src\/background\.js$/.test(t.url()), { timeout: 20000 });
    await sleep(1500);
    for (const p of await browser.pages()) if (/^chrome-extension:/.test(p.url())) await p.close().catch(() => {});
  }
  const ua = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) ${(await browser.version()).split(' ')[0]} Safari/537.36`;
  if (cookies && cookies.length) await browser.setCookie(...cookies.map(({ name, value, domain, path: p, expires, httpOnly, secure, sameSite }) => ({ name, value, domain, path: p, expires, httpOnly, secure, sameSite })));
  return { browser, ua, close: async () => { await browser.close().catch(() => {}); fs.rmSync(profile, { recursive: true, force: true }); } };
}

async function load(env, item, label) {
  const page = await env.browser.newPage();
  await page.setUserAgent(env.ua);
  await page.setViewport({ width: 1400, height: 900 });
  const rec = { at: new Date().toISOString(), label, item };
  let full = [];
  try {
    const resp = await page.goto(urlOf(item), { waitUntil: 'domcontentloaded', timeout: 40000 });
    rec.http = resp ? resp.status() : null;
    await sleep(6000);
    Object.assign(rec, await page.evaluate(() => {
      const t = document.body ? document.body.innerText : '';
      const o = { wall: /robot or human|press (&|and) hold|access denied|access to this page has been denied/i.test(`${document.title}\n${t.slice(0, 600)}`) };
      try {
        const p = JSON.parse(document.getElementById('__NEXT_DATA__').textContent).props.pageProps.initialData.data.product;
        o.price = p.priceInfo?.currentPrice?.price ?? null; o.was = p.priceInfo?.wasPrice?.price ?? null;
        o.offerId = p.offerId; o.sellerId = p.sellerId; o.sellerName = p.sellerName; o.fulfillmentType = p.fulfillmentType; o.condition = p.conditionType;
      } catch { /* no product data: a wall or a changed page */ }
      o.store = (document.cookie.split('; ').find((c) => c.startsWith('assortmentStoreId=')) || '').split('=')[1] || null;
      return o;
    }));
    full = await page.cookies('https://www.walmart.com');
    // Saved as names + short hashes only: the values are a throwaway lab profile's ids, and the experiment cookie's
    // hash is enough to tell two assignments apart.
    rec.cookies = full.map((c) => ({ name: c.name, h: crypto.createHash('sha256').update(c.value).digest('hex').slice(0, 10) }));
  } catch (e) { rec.error = String(e.message || e).slice(0, 140); }
  await page.close().catch(() => {});
  results.push(rec);
  save();
  console.error(`${label.padEnd(26)} ${item} http=${rec.http} ${rec.wall ? 'WALL ' : ''}price=${rec.price ?? '-'} offer=${rec.offerId?.slice(0, 8) ?? '-'} seller=${rec.sellerId?.slice(0, 8) ?? '-'} store=${rec.store ?? '-'}`);
  return { ...rec, full };
}

// 1. donors
const donors = {};
const TRIES = Number(opt('--tries', '8'));
for (let i = 1; i <= TRIES && !(donors['149.99'] && donors['169.99']); i++) {
  const env = await browserWith();
  const r = await load(env, '5689919121', `donor-search-${i}`);
  if (r.price && !donors[r.price.toFixed(2)]) { donors[r.price.toFixed(2)] = { env, cookies: r.full }; }
  else await env.close();
  await sleep(GAP);
}
console.error(`donors: ${Object.keys(donors).join(', ') || 'none'}`);
if (Object.keys(donors).length === 2) {
  // 2. full cookie copies, alternating
  for (let k = 1; k <= REPEATS; k++) {
    for (const price of Object.keys(donors)) {
      const env = await browserWith(donors[price].cookies, EXT_DIR);
      await load(env, '5689919121', `copy-all-of-${price}${EXT_DIR ? '+EXT' : ''}#${k}`);
      await env.close();
      await sleep(GAP);
    }
  }
  // 3. narrowing: only the experiment cookies, then only the visitor cookies (extension-free runs only)
  for (const [subset, re] of (EXT_DIR ? [] : [['experiment', EXPERIMENT], ['visitor', VISITOR]])) {
    for (let k = 1; k <= 2; k++) {
      for (const price of Object.keys(donors)) {
        const env = await browserWith(donors[price].cookies.filter((c) => re.test(c.name)));
        await load(env, '5689919121', `copy-${subset}-of-${price}#${k}`);
        await env.close();
        await sleep(GAP);
      }
    }
  }
  // 4. other items, in the two donor profiles themselves
  for (const item of (EXT_DIR ? [] : OTHER)) {
    for (const price of Object.keys(donors)) {
      await load(donors[price].env, item, `donor-${price}-other`);
      await sleep(GAP);
    }
  }
}
for (const d of Object.values(donors)) await d.env.close();
save();
console.error(`wrote ${OUT}`);
