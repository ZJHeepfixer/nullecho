#!/usr/bin/env node
/**
 * Walmart price-gap isolation (research, not a gate). Twice on 2026-10-15 walmart.com showed AirPods Pro 2
 * (item 5689919121) at $169.99 with the extension OFF and $149.99 ON, with zero personalization-rule matches.
 * This changes ONE variable per arm and runs the arms one after another inside the same few minutes, `--cycles` times:
 *
 *   OFF   no extension                                   ON    the store zip, seeded
 *   A     ON without the personalization ruleset         B     ON without the device layer (no shim / loader):
 *                                                              blocking + the Sec-GPC header only
 *   C     ON with every blocking ruleset, GPC and the     D     OFF, but Chrome's UA + client hints set to what an
 *         learner off: the device persona only                  ON page reported (CDP userAgentMetadata)
 *   E     ON, a NEW seeded profile every cycle             F     ON, a NEW profile every cycle, never seeded
 *
 * Per load: Walmart's own page data (__NEXT_DATA__): item, offer id, seller id/name, fulfilment type, condition,
 * current / was price; the store it assigned (assortmentStoreId cookie) and any ZIP it set; the experiment-assignment
 * cookie (xpa) as a short hash; what the page told JS about the device. A wall is recorded as BLOCKED, never evaded.
 *
 *   NULLECHO_PUPPETEER_DIR=<dir> node research/walmart-price-gap-2026-10/probe.mjs [--cycles 4] [--items 5689919121,...]
 */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const argv = process.argv.slice(2);
const opt = (n, d = null) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const CYCLES = Number(opt('--cycles', '4'));
const ITEMS = (opt('--items', '5689919121') || '').split(',').filter(Boolean);
const ARMS = (opt('--arms', 'OFF,ON,A,B,C,D,E,F') || '').split(',');
const GAP_MS = Number(opt('--gap-ms', '6000'));
const OUT = opt('--out', path.join(HERE, `raw-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')}.json`));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const puppeteer = (() => {
  for (const d of [opt('--puppeteer'), process.env.NULLECHO_PUPPETEER_DIR].filter(Boolean)) {
    try { return createRequire(path.join(path.resolve(d), 'package.json'))('puppeteer'); } catch { /* next */ }
  }
  console.error('puppeteer not found'); process.exit(2);
})();
const ITEM_URL = { '5689919121': 'https://www.walmart.com/ip/AirPods-Pro-2nd-generation-with-MagSafe-Case-USB-C/5689919121' };
const urlOf = (id) => ITEM_URL[id] || `https://www.walmart.com/ip/${id}`;

// ── build the store zip once, and one variant directory per arm ─────────────────────────────────────────────
execFileSync('node', ['tools/package.mjs'], { cwd: path.join(REPO, 'ext'), stdio: 'ignore' });
const version = JSON.parse(fs.readFileSync(path.join(REPO, 'ext', 'manifest.json'), 'utf8')).version;
const zip = path.join(REPO, 'dist', `nullecho-${version}-chrome.zip`);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), 'wm-gap-'));
const base = path.join(WORK, 'full');
fs.mkdirSync(base);
execFileSync('unzip', ['-q', zip, '-d', base]);
function variant(name, edit) {
  const dir = path.join(WORK, name);
  fs.cpSync(base, dir, { recursive: true });
  const mPath = path.join(dir, 'manifest.json');
  const m = JSON.parse(fs.readFileSync(mPath, 'utf8'));
  edit(dir, m);
  fs.writeFileSync(mPath, JSON.stringify(m, null, 2));
  return dir;
}
const empty = (dir, m, ids) => { for (const r of m.declarative_net_request.rule_resources) if (ids.includes(r.id)) fs.writeFileSync(path.join(dir, r.path), '[]\n'); };
const dropScripts = (m, names) => { m.content_scripts = m.content_scripts.map((cs) => ({ ...cs, js: cs.js.filter((f) => !names.some((n) => f.endsWith(n))) })).filter((cs) => cs.js.length); };
const DIRS = {
  full: base,
  nopz: variant('nopz', (dir, m) => empty(dir, m, ['personalization'])),
  noshim: variant('noshim', (dir, m) => dropScripts(m, ['src/shim.js', 'src/shim-loader.js'])),
  personaOnly: variant('persona-only', (dir, m) => { empty(dir, m, ['ads', 'analytics', 'social', 'fingerprinting', 'personalization', 'gpc']); dropScripts(m, ['src/gpc.js']); }),
};

// ── browsers ─────────────────────────────────────────────────────────────────────────────────────────────
const isWorker = (t) => t.type() === 'service_worker' && /^chrome-extension:\/\/[a-p]{32}\/src\/background\.js$/.test(t.url());
const SEED = ['google.com', 'youtube.com', 'facebook.com', 'microsoft.com', 'live.com', 'microsoftonline.com', 'apple.com', 'cloudflare.com', 'amazon.com', 'twitter.com', 'x.com', 'linkedin.com'];
async function launch({ extDir = null, seeded = false }) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'wm-gap-profile-'));
  const args = ['--no-first-run', '--no-default-browser-check', '--window-size=1400,900'];
  if (extDir) args.push(`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`);
  const browser = await puppeteer.launch({ headless: true, userDataDir: profile, args, ignoreDefaultArgs: extDir ? ['--disable-extensions'] : [], ...(seeded ? { pipe: true, enableExtensions: true } : {}) });
  const env = { browser, profile, seeded: false, close: async () => { await browser.close().catch(() => {}); fs.rmSync(profile, { recursive: true, force: true }); } };
  if (extDir) {
    const sw = await browser.waitForTarget(isWorker, { timeout: 20000 });
    if (seeded) {
      // The learner's own record, written through the worker and turned into rules by the extension's reconcile()
      // on a reload — the same seed harness/site-smoke.mjs --seeded uses (D50).
      const key = /const STORAGE_KEY = '([^']+)'/.exec(fs.readFileSync(path.join(extDir, 'src', 'heuristics.js'), 'utf8'))[1];
      const w = await sw.worker();
      for (let i = 0; i < 10; i++) { if (await w.evaluate(() => !!globalThis.chrome?.storage).catch(() => false)) break; await sleep(400); }
      const now = Date.now();
      const domains = Object.fromEntries(SEED.map((d, i) => [d, { sites: { 'site-a.example': 1, 'site-b.example': 2, 'site-c.example': 3 }, status: 'blocked', ruleId: 1_000_000 + i, firstSeen: now - 7 * 864e5, lastSeen: now, source: 'learned' }]));
      await w.evaluate(async (k, v) => chrome.storage.local.set({ [k]: v }), key, { version: 1, domains });
      await browser.installExtension(extDir);
      const deadline = Date.now() + 20000;
      while (Date.now() < deadline) {
        await sleep(800);
        const t = browser.targets().filter(isWorker).pop();
        const w2 = t ? await t.worker().catch(() => null) : null;
        const rules = w2 ? await w2.evaluate(() => chrome.declarativeNetRequest.getDynamicRules()).catch(() => null) : null;
        if (rules && SEED.every((d) => rules.some((r) => (r.condition.requestDomains || []).includes(d)))) { env.seeded = true; break; }
      }
      if (!env.seeded) console.error('  ⚠ seeding did not take (the arm runs unseeded and says so)');
    }
    for (const p of await browser.pages()) if (/^chrome-extension:/.test(p.url())) await p.close().catch(() => {});
  }
  return env;
}

const hash = (s) => (s ? crypto.createHash('sha256').update(s).digest('hex').slice(0, 10) : null);
async function measure(env, itemId, { uaOverride = null } = {}) {
  const page = await env.browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  const real = await env.browser.version();
  const ua = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) ${real.split(' ')[0]} Safari/537.36`;
  if (uaOverride) await page.setUserAgent(uaOverride.ua, uaOverride.metadata); else await page.setUserAgent(ua);
  await page.bringToFront();
  const rec = { at: new Date().toISOString(), item: itemId };
  try {
    const resp = await page.goto(urlOf(itemId), { waitUntil: 'domcontentloaded', timeout: 40000 });
    rec.http = resp ? resp.status() : null;
    await sleep(6000);
    const d = await page.evaluate(async () => {
      const out = { title: document.title.slice(0, 90) };
      const text = document.body ? document.body.innerText : '';
      out.wall = /robot or human|press (&|and) hold|verify you are|access denied|access to this page has been denied/i.test(`${document.title}\n${text.slice(0, 600)}`);
      const nd = document.getElementById('__NEXT_DATA__');
      if (nd) {
        try {
          const p = JSON.parse(nd.textContent).props?.pageProps?.initialData?.data?.product;
          if (p) out.product = { usItemId: p.usItemId, offerId: p.offerId, selectedOfferId: p.selectedOfferId, sellerId: p.sellerId, sellerName: p.sellerName, fulfillmentType: p.fulfillmentType, conditionType: p.conditionType, current: p.priceInfo?.currentPrice?.price, display: p.priceInfo?.currentPrice?.priceDisplay, was: p.priceInfo?.wasPrice?.price, list: p.priceInfo?.listPrice?.price, wPlus: p.priceInfo?.wPlusEarlyAccessPrice ?? null, conditionOffers: (p.conditionOffers || []).map((o) => ({ c: o.conditionType ?? o.condition, price: o.price?.price ?? o.priceInfo?.currentPrice?.price ?? null })).slice(0, 4) };
        } catch (e) { out.ndError = String(e.message).slice(0, 80); }
      }
      out.microdataPrice = document.querySelector('[itemprop="price"]')?.getAttribute('content') ?? document.querySelector('[itemprop="price"]')?.textContent ?? null;
      out.rendered = (document.querySelector('[data-testid="price-wrap"]')?.innerText || '').replace(/\s+/g, ' ').slice(0, 60) || null;
      out.sellerText = ((text.match(/Sold (and shipped )?by[^\n]{0,60}/i) || [])[0] || null);
      out.fulfillText = (text.match(/(Pickup|Delivery|Shipping|Arrives)[^\n]{0,60}/gi) || []).slice(0, 4);
      out.zipText = ((text.match(/\b\d{5}\b(?=[^\n]{0,30}(delivery|pickup|to\b))/i) || [])[0] || null);
      out.device = { cores: navigator.hardwareConcurrency, mem: navigator.deviceMemory ?? null, screen: `${screen.width}x${screen.height}@${devicePixelRatio}`, platform: navigator.platform, gpc: navigator.globalPrivacyControl ?? null };
      try { out.device.ch = await navigator.userAgentData?.getHighEntropyValues(['platformVersion', 'architecture', 'bitness', 'model', 'fullVersionList']); } catch { out.device.ch = null; }
      out.cookieNames = document.cookie.split('; ').map((c) => c.split('=')[0]).sort();
      const pick = (n) => (document.cookie.split('; ').find((c) => c.startsWith(n + '=')) || '').slice(n.length + 1);
      out.cookies = { assortmentStoreId: pick('assortmentStoreId') || null, xpaRaw: pick('xpa') || null, xptc: decodeURIComponent(pick('xptc') || '') || null, locGuestData: pick('locGuestData') ? decodeURIComponent(pick('locGuestData')).slice(0, 300) : null, ACID: pick('ACID') ? 'set' : null };
      return out;
    });
    Object.assign(rec, d);
    rec.xpa = hash(d.cookies?.xpaRaw); if (rec.cookies) delete rec.cookies.xpaRaw;
    rec.ua = await page.evaluate(() => navigator.userAgent).catch(() => null);
  } catch (e) { rec.error = String(e.message || e).slice(0, 160); }
  await page.close().catch(() => {});
  return rec;
}

// ── run ─────────────────────────────────────────────────────────────────────────────────────────────────
const results = [];
const out = () => fs.writeFileSync(OUT, JSON.stringify({ started: START, chrome: null, arms: ARMS, items: ITEMS, cycles: CYCLES, results }, null, 1));
const START = new Date().toISOString();
const persistent = {};
const getEnv = async (arm) => {
  switch (arm) {
    case 'OFF': return persistent.OFF ??= await launch({});
    case 'D': return persistent.D ??= await launch({});
    case 'ON': return persistent.ON ??= await launch({ extDir: DIRS.full, seeded: true });
    case 'A': return persistent.A ??= await launch({ extDir: DIRS.nopz, seeded: true });
    case 'B': return persistent.B ??= await launch({ extDir: DIRS.noshim, seeded: true });
    case 'C': return persistent.C ??= await launch({ extDir: DIRS.personaOnly });
    default: return null;
  }
};
let lastOnDevice = null;
for (let cycle = 1; cycle <= CYCLES; cycle++) {
  for (const item of ITEMS) {
    for (const arm of ARMS) {
      let env = null, fresh = false;
      if (arm === 'E') { env = await launch({ extDir: DIRS.full, seeded: true }); fresh = true; }
      else if (arm === 'F') { env = await launch({ extDir: DIRS.full, seeded: false }); fresh = true; }
      else env = await getEnv(arm);
      let uaOverride = null;
      if (arm === 'D') {
        if (!lastOnDevice?.ch) { results.push({ cycle, arm, item, skipped: 'no ON device values yet' }); continue; }
        const ch = lastOnDevice.ch;
        const major = (ch.fullVersionList || []).find((b) => /Chrom/.test(b.brand))?.version?.split('.')[0];
        uaOverride = {
          ua: lastOnDevice.ua,
          metadata: { brands: (ch.fullVersionList || []).map((b) => ({ brand: b.brand, version: b.version.split('.')[0] })), fullVersionList: ch.fullVersionList, platform: lastOnDevice.uaPlatform || 'macOS', platformVersion: ch.platformVersion || '', architecture: ch.architecture || '', model: ch.model || '', mobile: false, bitness: ch.bitness || '64', wow64: false },
        };
        void major;
      }
      const rec = await measure(env, item, { uaOverride });
      rec.cycle = cycle; rec.arm = arm; rec.seeded = env.seeded; rec.freshProfile = fresh;
      if (arm === 'ON' && rec.device?.ch) lastOnDevice = { ch: rec.device.ch, ua: rec.ua, uaPlatform: 'macOS' };
      results.push(rec);
      const p = rec.product;
      console.error(`c${cycle} ${arm.padEnd(3)} ${item} http=${rec.http} ${rec.wall ? 'WALL' : ''} price=${p?.current ?? rec.microdataPrice ?? '-'} offer=${p?.offerId?.slice(0, 8) ?? '-'} seller=${p?.sellerId?.slice(0, 8) ?? '-'}/${p?.fulfillmentType ?? '-'} store=${rec.cookies?.assortmentStoreId ?? '-'} xpa=${rec.xpa ?? '-'} cores=${rec.device?.cores}`);
      out();
      if (fresh) await env.close();
      await sleep(GAP_MS);
    }
  }
}
for (const e of Object.values(persistent)) await e.close();
fs.rmSync(WORK, { recursive: true, force: true });
out();
console.error(`wrote ${OUT}`);
