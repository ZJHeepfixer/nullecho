/**
 * Device-price probe. Does a public page declare a DIFFERENT price to different DEVICES,
 * for an anonymous visitor, from one connection, at one moment? This measures SITES, not
 * Nullecho: no extension is loaded, puppeteer's default flags (including
 * --disable-extensions) are left alone, and nothing here touches ext/.
 *
 *   node harness/device-price-probe.mjs control                   # positive control + header echo, then stop
 *   node harness/device-price-probe.mjs check <url> [--visible sel] [--pattern re] [--site-settle ms]
 *                                                                  # one load per device, print what the extractor sees
 *   node harness/device-price-probe.mjs run   [--sites a,b] [--rounds 3] [--out research/device-pricing/raw/<date>.json]
 *   node harness/device-price-probe.mjs reverdict <raw.json> [--note why]   # recompute verdicts, keep verdictAtRun
 *   node harness/device-price-probe.mjs offers <url> [--record raw.json --site id]  # every JSON-LD offer + sku, per device
 *
 * Options
 *   --puppeteer <dir>  a directory whose node_modules holds puppeteer (also $NULLECHO_PUPPETEER_DIR)
 *   --origin <url>     the local server that serves the repo root (default http://localhost:4886)
 *   --sites a,b        only these site ids from harness/device-price-sites.json
 *   --rounds N         interleaved rounds per site (default 3 → 12 loads per site)
 *   --devices a,b      subset of profile ids (default all four)
 *   --no-recheck       skip the 10-minute re-run of any `differs by device` site
 *   --headful          watch it
 *
 * METHOD (research/device-pricing/METHOD.md is the authority; this is the summary):
 *   • Four device profiles, each internally consistent: UA string, client hints, viewport,
 *     touch and deviceScaleFactor agree. The Chrome major version in the UA and the hints
 *     is read from the binary, never typed in.
 *   • A fresh incognito browser context per page load → no cookie carries between loads.
 *   • Interleaved: device 1,2,3,4 then 1,2,3,4 then 1,2,3,4 — 12 loads a site, 3–6 s apart.
 *     Interleaving is what separates a device effect from a price drifting over minutes.
 *   • Price extraction in a fixed priority, recording WHICH source fired:
 *     json-ld (Offer/AggregateOffer price/lowPrice, @graph walked) → microdata itemprop=price
 *     → meta product:price:amount / og:price:amount → a per-site visible-text selector,
 *     flagged `visible`. The first three reuse ext/src/pricing.js's cleaners and order; the one
 *     deviation is that a declared price of ZERO falls through (Hostelworld declares `price: 0`).
 *     Per-site knobs in the sites file: `visibleSelector`, `visiblePattern` (regex, group 1 = the
 *     amount, so the SAME quantity is read from phone and desktop templates — Kayak's phone page
 *     puts the per-day rate before the total), `settleMs` (longer poll budget for slow SPAs).
 *   • Two controls, both mandatory: a local page with a fixed JSON-LD price must read the
 *     same on all four devices (extractor positive control), and the three loads of one
 *     device on one site must agree (same-device repeat control) before any cross-device
 *     claim is made for that site.
 *   • Bail-outs: 45 s per load; 3 consecutive blocked/error loads abandon the site.
 *
 * RULES: read-only GETs, one load in flight, no logins, no forms, no captcha interaction,
 * no attempt to get past a wall. A wall is recorded verbatim and the probe moves on.
 *
 * TRAPS
 *   1. `navigator.webdriver` is true in an automated browser and nothing here hides it.
 *      A site that walls automation walls every profile equally — that is recorded as
 *      `blocked`, never worked around.
 *   2. Setting a UA without metadata makes Chrome send NO Sec-CH-UA headers at all; that is
 *      exactly right for the Safari profile and wrong for the Chrome ones, which is why the
 *      header-echo control prints what each profile actually sent.
 *   3. `waitUntil: 'networkidle2'` never resolves on ad-heavy pages. Load to
 *      domcontentloaded, then poll for a price (or a wall) for a bounded settle window.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

// ── arguments ──────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt; };
const flag = (name) => argv.includes(name);
const positional = [];
for (let i = 0; i < argv.length; i++) {
  if (['--headful', '--no-recheck', '--quiet'].includes(argv[i])) continue;
  if (argv[i].startsWith('--')) { i++; continue; }
  positional.push(argv[i]);
}
const MODE = positional[0] || 'run';
const ORIGIN = (opt('--origin', 'http://localhost:4886')).replace(/\/$/, '');
const HEADFUL = flag('--headful');
const ROUNDS = Number(opt('--rounds', '3'));
const LOAD_TIMEOUT_MS = 45000;
const SETTLE_MS = Number(opt('--settle', '9000'));       // how long to keep polling for a late price
const DELAY_MIN_MS = 3000, DELAY_MAX_MS = 6000;
const TODAY = new Date().toISOString().slice(0, 10);
const OUT = path.resolve(REPO, opt('--out', `research/device-pricing/raw/${TODAY}.json`));
const SITES_FILE = path.join(HERE, 'device-price-sites.json');

// ── puppeteer, without a dependency in the repo ────────────────────────────
function loadPuppeteer() {
  const tried = [];
  try { return createRequire(import.meta.url)('puppeteer'); } catch (e) { tried.push(`repo (${e.code})`); }
  for (const dir of [opt('--puppeteer', null), process.env.NULLECHO_PUPPETEER_DIR, '/Users/jasonluker/bodybuilding'].filter(Boolean)) {
    try { return createRequire(path.join(path.resolve(dir), 'package.json'))('puppeteer'); }
    catch (e) { tried.push(`${dir} (${e.code})`); }
  }
  console.error('puppeteer not found: ' + tried.join('; '));
  process.exit(2);
}
const puppeteer = loadPuppeteer();

// ── the extractor is the extension's own, unchanged ────────────────────────
await import(pathToFileURL(path.join(REPO, 'ext/src/pricing.js')).href);
const P = globalThis.NullechoPricing;
if (!P || typeof P.priceContext !== 'function') { console.error('ext/src/pricing.js did not install NullechoPricing'); process.exit(2); }

// ── device profiles ────────────────────────────────────────────────────────
/**
 * Built once the Chrome major version is known. Every field of a profile agrees with
 * every other: a phone viewport never rides under a desktop UA, a Safari UA never carries
 * Chromium client hints.
 */
function buildProfiles(chromeMajor, chromeFull) {
  const brands = [
    { brand: 'Chromium', version: String(chromeMajor) },
    { brand: 'Google Chrome', version: String(chromeMajor) },
    { brand: 'Not;A=Brand', version: '99' },
  ];
  const fullVersionList = [
    { brand: 'Chromium', version: chromeFull },
    { brand: 'Google Chrome', version: chromeFull },
    { brand: 'Not;A=Brand', version: '99.0.0.0' },
  ];
  const iphone = puppeteer.KnownDevices['iPhone 15 Pro'];
  return [
    {
      id: 'mac-chrome',
      label: 'Chrome on macOS (desktop)',
      // Chrome ≥ 110 freezes the desktop UA's OS token: every macOS Chrome says 10_15_7.
      userAgent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeMajor}.0.0.0 Safari/537.36`,
      metadata: { brands, fullVersionList, platform: 'macOS', platformVersion: '15.6.0', architecture: 'arm64', model: '', mobile: false, bitness: '64', wow64: false },
      viewport: { width: 1440, height: 900, deviceScaleFactor: 2, isMobile: false, hasTouch: false },
    },
    {
      id: 'win-chrome',
      label: 'Chrome on Windows (desktop)',
      userAgent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeMajor}.0.0.0 Safari/537.36`,
      metadata: { brands, fullVersionList, platform: 'Windows', platformVersion: '15.0.0', architecture: 'x86', model: '', mobile: false, bitness: '64', wow64: false },
      viewport: { width: 1536, height: 864, deviceScaleFactor: 1.25, isMobile: false, hasTouch: false },
    },
    {
      id: 'iphone-safari',
      label: 'Safari on iPhone (puppeteer KnownDevices "iPhone 15 Pro", UA verbatim)',
      userAgent: iphone.userAgent,
      metadata: null,                                   // Safari sends no client hints; none are invented
      viewport: { ...iphone.viewport },                // 393×659 @3, touch, mobile
    },
    {
      id: 'android-budget',
      label: 'Chrome on a low-end Android phone',
      // Chrome ≥ 110 freezes the Android UA to "Android 10; K"; the model rides in Sec-CH-UA-Model.
      userAgent: `Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeMajor}.0.0.0 Mobile Safari/537.36`,
      metadata: { brands, fullVersionList, platform: 'Android', platformVersion: '13.0.0', architecture: '', model: 'SM-A135F', mobile: true, bitness: '', wow64: false },
      viewport: { width: 360, height: 800, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    },
  ];
}

// ── wall detection ─────────────────────────────────────────────────────────
/** Phrases that, on a page with no declared price, mean a wall rather than a missing price. */
const WALL_PHRASES = [
  'access denied', 'robot or human', 'are you a human', 'are you a robot', 'press & hold', 'press and hold',
  'verify you are human', 'verifying you are human', 'just a moment', 'pardon our interruption',
  'unusual traffic', 'captcha', 'attention required', 'request blocked', 'request unsuccessful',
  'checking your browser', 'enable javascript and cookies to continue', 'access to this page has been denied',
  'please verify you are a human', 'you have been blocked', 'reference #', 'bot detection',
  'something about your browser', 'automated access', 'sign in to see price', 'log in to see price',
  'sign in to view price', 'we need to verify', 'security check', 'human verification', 'incident id',
  'your request has been blocked', 'not a robot', 'confirm you are not a robot',
  'this site can’t be reached', 'this site can\'t be reached',
  'unable to give you access', 'security issue was automatically', 'reference error:', 'performing security verification',
  'hang tight', 'sit tight', 'got our hands full', 'you are in a queue', 'waiting room', 'something went wrong. please refresh',
];
const LOGIN_URL = /\/(login|signin|sign-in|log-in|auth|account\/login|identity)\b/i;

/** Selectors of consent-management containers. A banner is recorded, but is a wall only if no price came through. */
const CONSENT_SELECTORS = '#onetrust-banner-sdk, #onetrust-consent-sdk, .ot-sdk-container, #CybotCookiebotDialog, #truste-consent-track, '
  + '.cc-window, #cookie-banner, #cookieBanner, .cookie-banner, [id*="cookie-consent" i], [class*="cookie-consent" i], '
  + '#didomi-host, .didomi-popup-open, #usercentrics-root, .qc-cmp2-container, #sp_message_container, [id^="sp_message_container"], '
  + '.fc-consent-root, #consent-banner, #gdpr-banner, [aria-label*="cookie" i][role="dialog"], .osano-cm-window';

// ── in-page collection: markup sources, mobile-layout evidence, wall evidence ─
/** Runs inside the page. Everything returned is data; nothing is acted on. */
function collectInPage(visibleSelector) {
  const out = { jsonLd: [], microdata: [], meta: { amount: null, currency: null }, visible: null, visibleCandidates: [] };
  const ldNodes = document.querySelectorAll('script[type="application/ld+json"]');
  for (let i = 0; i < ldNodes.length && out.jsonLd.length < 24; i += 1) {
    const raw = ldNodes[i].textContent;
    if (raw && raw.length < 300000) out.jsonLd.push(raw);
  }
  const mdNodes = document.querySelectorAll('[itemprop="price"]');
  for (let i = 0; i < mdNodes.length && out.microdata.length < 8; i += 1) {
    const el = mdNodes[i];
    const value = el.getAttribute('content') ?? el.textContent;
    const currencyEl = el.parentElement?.querySelector('[itemprop="priceCurrency"]');
    out.microdata.push({ value, currency: currencyEl?.getAttribute('content') ?? currencyEl?.textContent ?? null });
  }
  const metaEl = document.querySelector('meta[property="og:price:amount"], meta[property="product:price:amount"], meta[name="og:price:amount"], meta[name="product:price:amount"]');
  const metaCur = document.querySelector('meta[property="og:price:currency"], meta[property="product:price:currency"], meta[name="og:price:currency"], meta[name="product:price:currency"]');
  out.meta = { amount: metaEl?.getAttribute('content') ?? null, currency: metaCur?.getAttribute('content') ?? null };

  if (visibleSelector) {
    try {
      const els = Array.from(document.querySelectorAll(visibleSelector)).slice(0, 12);
      out.visibleCandidates = els.map((el) => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120));
      out.visible = out.visibleCandidates.find((t) => /\d/.test(t)) ?? null;
    } catch (e) { out.visibleError = String(e.message || e).slice(0, 120); }
  }

  const body = document.body ? (document.body.innerText || '') : '';
  const consentEl = document.querySelector(CONSENT_SELECTORS_PLACEHOLDER);
  out.page = {
    title: (document.title || '').slice(0, 160),
    finalUrl: location.href.slice(0, 300),
    bodyChars: body.length,
    bodyHead: body.replace(/\s+/g, ' ').trim().slice(0, 400),
    consentBannerSeen: !!consentEl,
    consentText: consentEl ? (consentEl.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 200) : null,
    webdriver: navigator.webdriver === true,
  };
  out.layout = {
    clientWidth: document.documentElement.clientWidth,
    innerWidth: window.innerWidth,
    dpr: window.devicePixelRatio,
    maxTouchPoints: navigator.maxTouchPoints,
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
    uaDataMobile: navigator.userAgentData ? navigator.userAgentData.mobile : null,
    uaDataPlatform: navigator.userAgentData ? navigator.userAgentData.platform : null,
    viewportMeta: !!document.querySelector('meta[name="viewport"]'),
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    hamburgerOrMobileNav: !!document.querySelector('[aria-label*="menu" i][aria-expanded], button[aria-label*="menu" i], .hamburger, [class*="hamburger" i], [class*="mobile-nav" i], [class*="mobileNav" i], [data-testid*="hamburger" i]'),
    mobileHostname: /^(m|mobile)\./.test(location.hostname),
  };
  return out;
}
// The selector list is a Node constant; inline it into the page function's source.
const collectSource = collectInPage.toString().replace('CONSENT_SELECTORS_PLACEHOLDER', JSON.stringify(CONSENT_SELECTORS));

/**
 * Looser than pricing.js cleanPrice on purpose: rendered text says "From $189/night". Flagged `visible`.
 * A site may supply `visiblePattern`, a regex whose FIRST capture group is the amount, so that the same
 * quantity is read from every template — Kayak's desktop page renders "$134 Total for 2 days" first while
 * its phone page renders the per-day "$67" first; anchoring on "total" reads 134 on both.
 */
function visiblePrice(text, pattern) {
  if (!text) return null;
  if (pattern) {
    const pm = new RegExp(pattern, 'i').exec(text);
    if (!pm || !pm[1]) return null;
    const amount = pm[1].replace(/,(?=\d{3}(\D|$))/g, '');
    if (isZero(amount)) return null;
    const cur = /US\$|USD|\$/.test(text) ? 'USD' : /€|EUR/.test(text) ? 'EUR' : /£|GBP/.test(text) ? 'GBP' : null;
    return { price: amount, currency: cur, text: text.slice(0, 120) };
  }
  const m = /([$€£¥]|US\$|USD|EUR|GBP)\s?(\d{1,3}(?:[,.]\d{3})*(?:[.,]\d{1,2})?)|(\d{1,3}(?:[,.]\d{3})*(?:[.,]\d{1,2})?)\s?(€|£|USD|EUR|GBP)/.exec(text);
  if (!m) return null;
  const amount = (m[2] ?? m[3]).replace(/,(?=\d{3}(\D|$))/g, '');
  if (isZero(amount)) return null;
  const sym = m[1] ?? m[4];
  const currency = { '$': 'USD', 'US$': 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY' }[sym] ?? (/^[A-Z]{3}$/.test(sym) ? sym : null);
  return { price: amount, currency, text: text.slice(0, 120) };
}

/**
 * A declared price of zero is a placeholder, not a price (Hostelworld's property JSON-LD says
 * `price: 0, priceCurrency: EUR` and shows the real from-price only in text). pricing.js accepts
 * "0" because for its purpose — "does this page publish a price at all" — that is the right call;
 * for comparing numbers across devices it is not, so zeros fall through to the next source here.
 * Same three sources, same order, same cleaners as pricing.js `priceContext()`.
 */
const isZero = (p) => p !== null && /^0+(?:[.,]0+)?$/.test(p);
function firstUsableNonZero(cands, source) {
  for (const c of cands) {
    const price = P.cleanPrice(c?.price);
    if (price === null || isZero(price)) continue;
    return { price, currency: P.cleanCurrency(c?.currency, c?.price), source };
  }
  return null;
}
function priceContextNonZero(sources) {
  return firstUsableNonZero(P.jsonLdPrices(sources.jsonLd ?? []), 'json-ld')
    ?? firstUsableNonZero((sources.microdata ?? []).map((m) => ({ price: m?.value, currency: m?.currency })), 'microdata')
    ?? firstUsableNonZero([{ price: sources.meta?.amount, currency: sources.meta?.currency }], 'meta');
}

function extract(collected, site = {}) {
  const ctx = priceContextNonZero({ jsonLd: collected.jsonLd, microdata: collected.microdata, meta: collected.meta });
  const allLd = P.jsonLdPrices(collected.jsonLd).map((c) => ({ price: P.cleanPrice(c.price), currency: P.cleanCurrency(c.currency, c.price) })).filter((c) => c.price !== null).slice(0, 40);
  if (ctx) {
    // A page that declares MANY offers (Apple's "Buy iPad", one Offer per model — found by the
    // 2026-09-22 run's own recheck): the FIRST offer is whichever model the template lists first,
    // and desktop and phone templates order them differently, so "first offer" read as a device
    // difference that was ours. Compare the sorted SET of distinct declared prices instead. A
    // single-product page is unchanged. METHOD.md §2.x.
    const distinct = [...new Set(allLd.map((c) => c.price).filter((p) => !isZero(p)))];
    if (ctx.source === 'json-ld' && distinct.length > 1) {
      const sorted = distinct.map(Number).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
      return { ...ctx, price: sorted.join('/'), source: `json-ld-set(${sorted.length})`, multiOffer: true, allJsonLdPrices: allLd };
    }
    return { ...ctx, allJsonLdPrices: allLd };
  }
  for (const text of collected.visibleCandidates ?? []) {
    const v = visiblePrice(text, site.visiblePattern);
    if (v) return { price: v.price, currency: v.currency, source: 'visible', visibleText: v.text, allJsonLdPrices: allLd };
  }
  return { price: null, currency: null, source: null, allJsonLdPrices: allLd };
}

function wallVerdict(collected, status, finalUrl) {
  const hay = `${collected.page.title}\n${collected.page.bodyHead}`.toLowerCase();
  const hit = WALL_PHRASES.find((p) => hay.includes(p));
  if (hit) return { blocked: true, kind: 'bot-wall', matched: hit, text: collected.page.bodyHead.slice(0, 300) || collected.page.title };
  if (status && (status === 403 || status === 429 || status === 503 || status === 401)) return { blocked: true, kind: `http-${status}`, matched: `HTTP ${status}`, text: collected.page.bodyHead.slice(0, 300) || collected.page.title };
  if (LOGIN_URL.test(finalUrl || '')) return { blocked: true, kind: 'login-redirect', matched: finalUrl, text: collected.page.bodyHead.slice(0, 300) };
  // Booking.com's JavaScript challenge: HTTP 202, then a client-side reload with `chal_t=<ts>` appended and a generic page in place of the hotel.
  if (/[?&]chal_t=/.test(finalUrl || '') || status === 202) return { blocked: true, kind: 'js-challenge', matched: status === 202 ? 'HTTP 202 challenge' : 'chal_t challenge redirect', text: collected.page.bodyHead.slice(0, 300) || collected.page.title };
  if (collected.page.consentBannerSeen && collected.page.bodyChars < 600) return { blocked: true, kind: 'consent-wall', matched: 'consent container with almost no other page text', text: collected.page.consentText };
  return { blocked: false };
}

// ── one load ───────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = () => DELAY_MIN_MS + Math.floor(Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS));

async function loadOnce(browser, profile, site) {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const context = await browser.createBrowserContext();               // fresh: no cookies carry
  const rec = { device: profile.id, url: site.url, startedAt, status: null, httpStatus: null };
  let page;
  try {
    page = await context.newPage();
    await page.setViewport(profile.viewport);
    if (profile.metadata) await page.setUserAgent(profile.userAgent, profile.metadata);
    else await page.setUserAgent(profile.userAgent);
    page.setDefaultTimeout(LOAD_TIMEOUT_MS);

    const work = (async () => {
      const resp = await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: LOAD_TIMEOUT_MS });
      rec.httpStatus = resp ? resp.status() : null;
      // Poll for a declared price (or a wall) up to SETTLE_MS; client-rendered pages need it.
      const deadline = Date.now() + (Number(site.settleMs) || SETTLE_MS);
      let collected, ex, wall;
      let contextLost = 0;
      for (;;) {
        try {
          collected = await page.evaluate(`(${collectSource})(${JSON.stringify(site.visibleSelector ?? null)})`);
        } catch (e) {
          // A client-side redirect mid-poll destroys the execution context; wait and read the new document.
          if (/Execution context was destroyed|Cannot find context|Target closed|detached/i.test(String(e.message)) && Date.now() < deadline + 8000) { contextLost++; await sleep(900); continue; }
          throw e;
        }
        ex = extract(collected, site);
        wall = wallVerdict(collected, rec.httpStatus, collected.page.finalUrl);
        if (ex.price !== null || wall.blocked || Date.now() > deadline) break;
        await sleep(700);
      }
      if (contextLost) rec.redirectsDuringPoll = contextLost;
      // One more beat after a price appears: some pages rewrite JSON-LD after hydration.
      if (ex.price !== null) {
        await sleep(1200);
        const again = await page.evaluate(`(${collectSource})(${JSON.stringify(site.visibleSelector ?? null)})`);
        const ex2 = extract(again, site);
        if (ex2.price !== null) { collected = again; ex = ex2; }
        rec.priceChangedAfterHydration = ex2.price !== null && ex2.price !== ex.price ? { first: ex.price, later: ex2.price } : null;
      }
      rec.price = ex.price; rec.currency = ex.currency; rec.source = ex.source;
      if (ex.visibleText) rec.visibleText = ex.visibleText;
      rec.allJsonLdPrices = ex.allJsonLdPrices;
      rec.page = collected.page; rec.layout = collected.layout;
      rec.microdataSeen = collected.microdata.length; rec.jsonLdScripts = collected.jsonLd.length; rec.metaAmount = collected.meta.amount;
      if (collected.visibleCandidates?.length) rec.visibleCandidates = collected.visibleCandidates;
      if (collected.visibleError) rec.visibleError = collected.visibleError;
      if (ex.price !== null) rec.status = 'price';
      else if (wall.blocked) { rec.status = 'blocked'; rec.wall = wall; }
      else rec.status = 'no-price';
    })();
    await Promise.race([work, sleep(LOAD_TIMEOUT_MS + 5000).then(() => { throw new Error(`load exceeded ${LOAD_TIMEOUT_MS} ms`); })]);
  } catch (e) {
    rec.status = 'error';
    rec.error = String(e.message || e).slice(0, 240);
  } finally {
    rec.ms = Date.now() - t0;
    try { await context.close(); } catch (_) { /* gone */ }
  }
  return rec;
}

// ── verdicts ───────────────────────────────────────────────────────────────
function verdictFor(loads, deviceIds) {
  const byDevice = {};
  for (const id of deviceIds) byDevice[id] = loads.filter((l) => l.device === id);
  const perDevice = {};
  let withinDeviceVariation = [];
  for (const id of deviceIds) {
    const priced = byDevice[id].filter((l) => l.status === 'price');
    const prices = [...new Set(priced.map((l) => `${l.price}${l.currency ? ' ' + l.currency : ''}`))];
    const sources = [...new Set(priced.map((l) => l.source))];
    perDevice[id] = { loads: byDevice[id].length, priced: priced.length, prices, sources, statuses: byDevice[id].map((l) => l.status) };
    if (prices.length > 1) withinDeviceVariation.push(`${id}: ${prices.join(' | ')}`);
  }
  const devicesWithPrice = deviceIds.filter((id) => perDevice[id].priced >= 1);
  const devicesConsistent = deviceIds.filter((id) => perDevice[id].priced >= 2 && perDevice[id].prices.length === 1);
  const blockedLoads = loads.filter((l) => l.status === 'blocked');
  const errorLoads = loads.filter((l) => l.status === 'error');
  const noPriceLoads = loads.filter((l) => l.status === 'no-price');
  const notes = [];
  const sourcesUsed = [...new Set(loads.filter((l) => l.status === 'price').map((l) => l.source))];
  if (sourcesUsed.length > 1) notes.push(`extraction source differed across loads: ${sourcesUsed.join(', ')}`);
  if (blockedLoads.length) notes.push(`${blockedLoads.length} blocked load(s): ${[...new Set(blockedLoads.map((l) => l.wall?.matched))].join('; ')}`);
  if (errorLoads.length) notes.push(`${errorLoads.length} error load(s): ${[...new Set(errorLoads.map((l) => l.error))].join('; ')}`);
  if (loads.some((l) => l.priceChangedAfterHydration)) notes.push('a load rewrote its declared price after hydration (first read kept only if the later read was empty)');

  let verdict, reason;
  if (withinDeviceVariation.length) {
    verdict = 'inconclusive'; reason = `price varies within one device (A/B test, inventory, or time): ${withinDeviceVariation.join('; ')}`;
  } else if (devicesWithPrice.length === 0) {
    if (blockedLoads.length && blockedLoads.length >= noPriceLoads.length && blockedLoads.length >= errorLoads.length) { verdict = 'blocked'; reason = [...new Set(blockedLoads.map((l) => l.wall?.matched))].join('; '); }
    else if (errorLoads.length > noPriceLoads.length) { verdict = 'error'; reason = [...new Set(errorLoads.map((l) => l.error))].join('; '); }
    else { verdict = 'no declared price'; reason = 'no json-ld/microdata/meta price and the visible selector (if any) matched nothing'; }
  } else if (devicesConsistent.length < 2) {
    verdict = 'inconclusive'; reason = `fewer than 2 devices returned a price on at least 2 loads (${devicesConsistent.length} did)`;
  } else {
    const distinct = [...new Set(devicesConsistent.map((id) => perDevice[id].prices[0]))];
    const silent = deviceIds.filter((id) => perDevice[id].priced === 0);           // a device that never returned a price
    if (distinct.length > 1) {
      // Two or more devices, each consistent with itself, read different numbers. Devices that returned nothing are named, not ignored.
      // THE MULTI-OFFER TRAP (found on apple.com/shop/buy-ipad/ipad, 2026-09-22): a page that declares one Offer per
      // configuration can order them differently per template, so "first JSON-LD candidate" is a different
      // configuration on a phone than on a desktop — not a different price for the same thing. If every device's
      // SET of declared prices is identical, the difference is ordering, and no device claim is made.
      const setFor = (id) => JSON.stringify([...new Set(byDevice[id].filter((l) => l.status === 'price' && l.source === 'json-ld').flatMap((l) => (l.allJsonLdPrices ?? []).map((c) => `${c.price} ${c.currency ?? ''}`)))].sort());
      const sets = [...new Set(devicesConsistent.map(setFor))];
      const multiOffer = devicesConsistent.every((id) => byDevice[id].some((l) => (l.allJsonLdPrices ?? []).length > 1));
      if (multiOffer && sets.length === 1 && sets[0] !== '[]') {
        verdict = 'inconclusive';
        reason = `multi-offer page: the first JSON-LD candidate differs by template (${devicesConsistent.map((id) => `${id}=${perDevice[id].prices[0]}`).join(', ')}) but every device declared the same set of prices ${sets[0]} — an ordering difference, not a price difference; no device claim`;
      } else {
        verdict = 'differs by device'; reason = devicesConsistent.map((id) => `${id}=${perDevice[id].prices[0]}`).join(', ') + (silent.length ? ` (no price from ${silent.join(', ')})` : '');
        if (multiOffer && sets.length > 1) notes.push(`multi-offer page and the declared price SETS also differ by device: ${devicesConsistent.map((id) => `${id}=${setFor(id)}`).join(' ; ')}`);
      }
    } else if (devicesConsistent.length === deviceIds.length && loads.every((l) => l.status === 'price')) {
      verdict = 'same'; reason = `all ${loads.length} loads read ${distinct[0]}`;
    } else if (devicesConsistent.length === deviceIds.length) {
      // Every device agreed on the number; a load or two errored/timed out. Not a device effect, and said so.
      verdict = 'same'; reason = `every priced load read ${distinct[0]}; ${loads.filter((l) => l.status !== 'price').length} load(s) returned no price (${[...new Set(loads.filter((l) => l.status !== 'price').map((l) => l.status))].join(', ')})`;
    } else {
      // The devices that answered agreed — but at least one device never did twice. "Same" would overstate it; "differs" would too.
      verdict = 'inconclusive'; reason = `${devicesConsistent.length} device(s) agreed at ${distinct[0]} but ${deviceIds.filter((id) => !devicesConsistent.includes(id)).join(', ')} returned no usable price on ≥2 loads (different template, wall, or error) — no device claim`;
    }
  }
  return { verdict, reason, perDevice, notes };
}

// ── controls ───────────────────────────────────────────────────────────────
/** A throwaway local server that echoes the request headers it received, so each profile's wire identity is on record. */
function startEchoServer() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const keep = {};
      for (const [k, v] of Object.entries(req.headers)) if (/^(user-agent|sec-ch-ua|sec-ch-ua-mobile|sec-ch-ua-platform|sec-ch-ua-model|sec-ch-ua-platform-version|sec-ch-ua-full-version-list|accept-language|viewport-width|dpr|width)$/.test(k)) keep[k] = v;
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'accept-ch': 'Sec-CH-UA-Model, Sec-CH-UA-Platform-Version, Sec-CH-UA-Full-Version-List' });
      res.end(`<!doctype html><title>echo</title><meta name="viewport" content="width=device-width, initial-scale=1"><pre id="h">${JSON.stringify(keep)}</pre>`);
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, url: `http://127.0.0.1:${srv.address().port}/echo` }));
  });
}

async function runControls(browser, profiles) {
  const results = { positive: [], echo: [] };
  const controlUrl = `${ORIGIN}/harness/device-price-control.html`;
  // Confirm the local server serves the repo root before relying on it.
  const head = await fetch(controlUrl).then((r) => ({ ok: r.ok, status: r.status })).catch((e) => ({ ok: false, status: String(e.message) }));
  results.serverCheck = { url: controlUrl, ...head };
  if (!head.ok) return results;
  for (const prof of profiles) {
    const r = await loadOnce(browser, prof, { id: 'control', url: controlUrl });
    results.positive.push({ device: prof.id, status: r.status, price: r.price, currency: r.currency, source: r.source, layout: r.layout, error: r.error });
  }
  const { srv, url } = await startEchoServer();
  try {
    for (const prof of profiles) {
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      await page.setViewport(prof.viewport);
      if (prof.metadata) await page.setUserAgent(prof.userAgent, prof.metadata); else await page.setUserAgent(prof.userAgent);
      await page.goto(url, { waitUntil: 'load' });
      await page.goto(url + '?second=1', { waitUntil: 'load' });     // the Accept-CH from the first response applies to the second request
      const headers = JSON.parse(await page.$eval('#h', (el) => el.textContent));
      const js = await page.evaluate(() => ({ ua: navigator.userAgent, uaData: navigator.userAgentData ? { brands: navigator.userAgentData.brands, mobile: navigator.userAgentData.mobile, platform: navigator.userAgentData.platform } : null, innerWidth: innerWidth, dpr: devicePixelRatio, touch: navigator.maxTouchPoints, webdriver: navigator.webdriver }));
      results.echo.push({ device: prof.id, headers, js });
      await context.close();
    }
  } finally { srv.close(); }
  return results;
}

// ── main ───────────────────────────────────────────────────────────────────
async function main() {
  const browser = await puppeteer.launch({ headless: !HEADFUL, args: ['--no-first-run', '--no-default-browser-check', '--lang=en-US'] });
  const version = await browser.version();                           // e.g. Chrome/149.0.7827.22
  const chromeFull = (version.match(/\/([\d.]+)/) || [])[1] || '0.0.0.0';
  const chromeMajor = Number(chromeFull.split('.')[0]);
  const allProfiles = buildProfiles(chromeMajor, chromeFull);
  const wanted = opt('--devices', null)?.split(',');
  const profiles = wanted ? allProfiles.filter((p) => wanted.includes(p.id)) : allProfiles;
  const env = { chrome: version, chromeMajor, puppeteer: puppeteer.default?.version ?? null, node: process.version, headless: !HEADFUL, startedAt: new Date().toISOString(), host: 'one machine, one connection', extensionLoaded: false };
  console.log('env ' + JSON.stringify(env));

  try {
    if (MODE === 'control') {
      const c = await runControls(browser, profiles);
      console.log(JSON.stringify(c, null, 1));
      return;
    }

    if (MODE === 'reverdict') {
      // Recompute verdicts on a finished raw file with the current rules; per-load data is untouched, the
      // run-time verdict is kept as `verdictAtRun`, and the file says when and why it was recomputed.
      const file = positional[1] ? path.resolve(REPO, positional[1]) : OUT;
      const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
      const ids = (doc.devices ?? []).map((d) => d.id);
      for (const s of doc.sites) {
        const v = verdictFor(s.loads, ids);
        const atk = doc.attacks?.[s.id];
        if (v.verdict === 'differs by device' && atk && atk.distinctOffers > 1 && atk.mismatches?.length === 0) {
          // Recorded full-offer evidence outranks the truncated per-load candidate list.
          v.verdict = 'inconclusive';
          v.reason = `multi-offer page: first JSON-LD candidate differs by template (${v.reason}), but the recorded offers attack (${atk.at}) found ${atk.distinctOffers} distinct (name|sku) offers priced identically on every device — an ordering difference, not a price difference; no device claim`;
          // The per-load candidate list is capped; a "sets also differ" note computed from it is truncation, not evidence.
          v.notes = v.notes.filter((n) => !n.startsWith('multi-offer page and the declared price SETS also differ'));
          v.notes.push(`per-load candidate lists were capped (${Math.max(...s.loads.map((l) => (l.allJsonLdPrices ?? []).length))} kept of ${atk.distinctOffers} offers) and differ by truncation only; the recorded offers attack is authoritative`);
        }
        if (s.abandoned) { v.notes.push('abandoned after 3 consecutive blocked/error loads'); if (v.verdict !== 'blocked' && v.verdict !== 'error') v.verdict = s.loads.some((l) => l.status === 'blocked') ? 'blocked' : 'error'; }
        if (!s.verdictAtRun) s.verdictAtRun = { verdict: s.verdict, reason: s.reason };
        Object.assign(s, v);
        console.log(`${s.id}${s.tag ? ' (' + s.tag + ')' : ''}: ${s.verdictAtRun.verdict} → ${s.verdict}${s.verdict !== s.verdictAtRun.verdict ? '  CHANGED' : ''}`);
      }
      doc.verdictRecomputed = { at: new Date().toISOString(), note: opt('--note', 'verdict rules updated; per-load data unchanged') };
      fs.writeFileSync(file, JSON.stringify(doc, null, 1));
      console.log('wrote ' + file);
      return;
    }

    if (MODE === 'offers') {
      // THE MULTI-OFFER ATTACK. One load per device; every JSON-LD node carrying price/lowPrice is listed with
      // its product name and sku, and the (name|sku → price) maps are compared across devices. A page that
      // orders its Offers differently per template reads as "differs" on the first candidate while every
      // configuration is priced identically — this is the check that tells the two apart. With --record
      // <raw.json> --site <id> the evidence is written into the raw file, where `reverdict` will use it.
      const url = positional[1];
      if (!url) { console.error('usage: offers <url> [--record raw.json --site id]'); process.exit(2); }
      const perDevice = {};
      for (const prof of profiles) {
        const context = await browser.createBrowserContext();
        const page = await context.newPage();
        await page.setViewport(prof.viewport);
        if (prof.metadata) await page.setUserAgent(prof.userAgent, prof.metadata); else await page.setUserAgent(prof.userAgent);
        let offers = [];
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: LOAD_TIMEOUT_MS });
          await sleep(4000);
          const rawLd = await page.evaluate(() => Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map((el) => el.textContent));
          const walk = (node, ctxName, depth) => {
            if (!node || depth > 12) return;
            if (Array.isArray(node)) { node.forEach((n) => walk(n, ctxName, depth + 1)); return; }
            if (typeof node !== 'object') return;
            const name = node.name ?? ctxName;
            if (Object.prototype.hasOwnProperty.call(node, 'price') || Object.prototype.hasOwnProperty.call(node, 'lowPrice')) {
              offers.push({ name: String(name ?? '').slice(0, 80), sku: node.sku ?? node.mpn ?? node.itemOffered?.sku ?? null, price: P.cleanPrice(node.price ?? node.lowPrice), currency: P.cleanCurrency(node.priceCurrency, node.price ?? node.lowPrice), type: node['@type'] ?? null });
            }
            for (const k of Object.keys(node)) walk(node[k], name, depth + 1);
          };
          for (const t of rawLd) { try { walk(JSON.parse(t), null, 0); } catch (_) { /* not JSON */ } }
        } catch (e) { offers = [{ error: String(e.message || e).slice(0, 200) }]; }
        perDevice[prof.id] = offers;
        console.log(`=== ${prof.id}  offers=${offers.length}`);
        offers.forEach((o, i) => console.log(`  ${String(i + 1).padStart(2)}. ${String(o.price ?? o.error).padStart(7)} ${o.currency ?? ''}  ${o.type ?? ''}  ${o.name ?? ''}${o.sku ? '  [' + o.sku + ']' : ''}`));
        await context.close();
        await sleep(jitter());
      }
      const key = (o) => `${o.name}|${o.sku ?? ''}`;
      const maps = Object.fromEntries(Object.entries(perDevice).map(([d, offers]) => [d, new Map(offers.filter((o) => !o.error).map((o) => [key(o), `${o.price} ${o.currency ?? ''}`.trim()]))]));
      const ids = Object.keys(maps);
      const union = new Set(ids.flatMap((d) => [...maps[d].keys()]));
      const mismatches = [];
      for (const k of union) {
        const vals = ids.map((d) => maps[d].get(k) ?? '(absent)');
        if (new Set(vals).size > 1) mismatches.push({ offer: k, byDevice: Object.fromEntries(ids.map((d, i) => [d, vals[i]])) });
      }
      const sets = Object.fromEntries(ids.map((d) => [d, [...new Set([...maps[d].values()])].sort()]));
      const attack = { at: new Date().toISOString(), url, tool: 'device-price-probe.mjs offers', distinctOffers: union.size, mismatches, priceSets: sets, perDevice };
      for (const m of mismatches) console.log(`MISMATCH ${m.offer}: ${JSON.stringify(m.byDevice)}`);
      console.log(`RESULT: ${union.size} distinct (name|sku) offers across ${ids.length} devices; ${mismatches.length} priced differently on some device.`);
      console.log('price sets: ' + ids.map((d) => `${d}=${JSON.stringify(sets[d])}`).join(' ; '));
      const rec = opt('--record', null), siteId = opt('--site', null);
      if (rec && siteId) {
        const file = path.resolve(REPO, rec);
        const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
        doc.attacks = doc.attacks ?? {};
        doc.attacks[siteId] = attack;
        fs.writeFileSync(file, JSON.stringify(doc, null, 1));
        console.log(`recorded as attacks[${siteId}] in ${file} — run \`reverdict\` to apply`);
      }
      return;
    }

    if (MODE === 'check') {
      const url = positional[1];
      if (!url) { console.error('usage: check <url> [--visible selector]'); process.exit(2); }
      const site = { id: 'check', url, visibleSelector: opt('--visible', null), visiblePattern: opt('--pattern', null), settleMs: opt('--site-settle', null) };
      for (const prof of profiles) {
        const r = await loadOnce(browser, prof, site);
        const { page, layout, ...rest } = r;
        console.log(JSON.stringify({ ...rest, title: page?.title, finalUrl: page?.finalUrl, bodyHead: page?.bodyHead?.slice(0, 160), clientWidth: layout?.clientWidth, consent: page?.consentBannerSeen, visibleCandidates: rest.visibleCandidates }));
        if (profiles.length > 1) await sleep(1500);
      }
      return;
    }

    // ── run ──
    const sitesDoc = JSON.parse(fs.readFileSync(SITES_FILE, 'utf8'));
    const only = opt('--sites', null)?.split(',');
    const sites = sitesDoc.sites.filter((s) => !only || only.includes(s.id));
    if (!sites.length) { console.error('no sites selected'); process.exit(2); }
    const budgetSec = sites.length * ROUNDS * profiles.length * 13;
    console.log(`plan ${sites.length} sites × ${ROUNDS} rounds × ${profiles.length} devices = ${sites.length * ROUNDS * profiles.length} loads, ~${Math.round(budgetSec / 60)} min at ~13 s/load`);

    console.log('── controls ──');
    const controls = await runControls(browser, profiles);
    console.log(JSON.stringify(controls.serverCheck));
    for (const p of controls.positive) console.log(`  positive ${p.device.padEnd(15)} ${p.status.padEnd(8)} ${p.price ?? '-'} ${p.currency ?? ''} via ${p.source ?? '-'}  clientWidth=${p.layout?.clientWidth} dpr=${p.layout?.dpr} touch=${p.layout?.maxTouchPoints}`);
    for (const e of controls.echo) console.log(`  echo     ${e.device.padEnd(15)} ${JSON.stringify(e.headers)}`);
    const controlPrices = [...new Set(controls.positive.map((p) => `${p.price} ${p.currency}`))];
    const controlPass = controls.positive.length === profiles.length && controls.positive.every((p) => p.status === 'price') && controlPrices.length === 1;
    controls.pass = controlPass;
    if (!controlPass) {
      console.error('POSITIVE CONTROL FAILED — the probe is broken; stopping before any site is loaded.');
      fs.mkdirSync(path.dirname(OUT), { recursive: true });
      fs.writeFileSync(OUT, JSON.stringify({ env, controls, sites: [] }, null, 1));
      process.exitCode = 4;
      return;
    }
    console.log(`  positive control PASS: all ${profiles.length} devices read ${controlPrices[0]}`);

    const out = { env, method: sitesDoc.method ?? null, controls, rounds: ROUNDS, devices: profiles.map(({ id, label, userAgent, metadata, viewport }) => ({ id, label, userAgent, clientHints: metadata, viewport })), sites: [] };
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    const save = () => fs.writeFileSync(OUT, JSON.stringify(out, null, 1));

    const runSite = async (site, tag) => {
      console.log(`── ${site.id}${tag ? ' (' + tag + ')' : ''}  ${site.url}`);
      const loads = [];
      let consecutiveBad = 0, abandoned = false;
      outer: for (let round = 1; round <= ROUNDS; round++) {
        for (const prof of profiles) {
          const r = await loadOnce(browser, prof, site);
          r.round = round;
          loads.push(r);
          const line = r.status === 'price' ? `${r.price} ${r.currency ?? ''} via ${r.source}` : r.status === 'blocked' ? `BLOCKED (${r.wall.matched})` : r.status === 'error' ? `ERROR ${r.error}` : 'no price';
          console.log(`  r${round} ${prof.id.padEnd(15)} ${String(r.ms).padStart(6)}ms  ${line}  [cw=${r.layout?.clientWidth ?? '?'}${r.httpStatus ? ' http=' + r.httpStatus : ''}]`);
          consecutiveBad = (r.status === 'blocked' || r.status === 'error') ? consecutiveBad + 1 : 0;
          if (consecutiveBad >= 3) { abandoned = true; console.log('  abandoned after 3 consecutive blocked/error loads'); break outer; }
          await sleep(jitter());
        }
      }
      const v = verdictFor(loads, profiles.map((p) => p.id));
      if (abandoned) { v.notes.push('abandoned after 3 consecutive blocked/error loads'); if (v.verdict !== 'blocked' && v.verdict !== 'error') v.verdict = loads.some((l) => l.status === 'blocked') ? 'blocked' : 'error'; }
      console.log(`  ⇒ ${v.verdict}: ${v.reason}${v.notes.length ? '  | ' + v.notes.join(' | ') : ''}`);
      return { ...site, tag: tag ?? null, abandoned, loads, ...v, finishedAt: new Date().toISOString() };
    };

    for (const site of sites) {
      out.sites.push(await runSite(site));
      save();
    }

    // Attack the finding: a `differs by device` site is re-run 10 minutes later. If the split does not hold, say so.
    const differs = out.sites.filter((s) => s.verdict === 'differs by device' && !s.tag).slice(0, 2);
    if (differs.length && !flag('--no-recheck')) {
      console.log(`── recheck: ${differs.length} site(s) read differently by device; waiting 10 minutes, then loading them again`);
      await sleep(600000);
      for (const s of differs) {
        const { loads, verdict, reason, perDevice, notes, tag, abandoned, finishedAt, ...site } = s;
        out.sites.push(await runSite(site, 'recheck +10min'));
        save();
      }
    }
    out.env.finishedAt = new Date().toISOString();
    save();

    // Summary table (markdown) — pasted into the RUN file verbatim, so no number is retyped.
    console.log('\n## Summary\n');
    console.log(`| Site | Category | Verdict | ${profiles.map((p) => p.id).join(' | ')} | Source | Notes |`);
    console.log(`|---|---|---|${profiles.map(() => '---').join('|')}|---|---|`);
    for (const s of out.sites) {
      const cells = profiles.map((p) => { const d = s.perDevice[p.id]; return d.prices.length ? d.prices.join(' / ') + (d.priced < d.loads ? ` (${d.priced}/${d.loads})` : '') : d.statuses.every((x) => x === 'blocked') ? 'blocked' : d.statuses.every((x) => x === 'error') ? 'error' : '—'; });
      const src = [...new Set(s.loads.filter((l) => l.status === 'price').map((l) => l.source))].join(', ') || '—';
      console.log(`| ${s.id}${s.tag ? ' (' + s.tag + ')' : ''} | ${s.category ?? ''} | **${s.verdict}** | ${cells.join(' | ')} | ${src} | ${[s.reason, ...s.notes].filter(Boolean).join('; ').replace(/\|/g, '/').slice(0, 220)} |`);
    }
    const counts = {};
    for (const s of out.sites.filter((x) => !x.tag)) counts[s.verdict] = (counts[s.verdict] ?? 0) + 1;
    console.log('\ncounts ' + JSON.stringify(counts));
    console.log(`raw ${OUT}`);
  } finally {
    await browser.close().catch(() => {});
  }
}

main().then(() => process.exit(process.exitCode ?? 0), (e) => { console.error(e && e.stack || e); process.exit(1); });
