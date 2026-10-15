#!/usr/bin/env node
/**
 * 0.9.3 — attack the personalization ruleset: does every rule actually count, and does nothing protected match?
 *
 *   node ext/tools/package.mjs && unzip -q dist/nullecho-<v>-chrome.zip -d <dir>
 *   node harness/personalization-attack.mjs <dir> [--out <file.json>]
 *       --puppeteer <dir> | NULLECHO_PUPPETEER_DIR=<dir>   a directory whose node_modules has puppeteer
 *
 * Loads the unzipped STORE package into Chrome for Testing with every host resolved to loopback
 * (`--host-resolver-rules`), so no request leaves the machine, and serves harness/fixtures/personalization-rules.html:
 * one request per BLOCK rule in the package's rules/personalization.json, built from that rule's own condition.
 *
 *   1. Baseline: the D55 per-tab count (the webRequest tally the popup shows when getMatchedRules is unavailable)
 *      must credit exactly one blocked request per rule to "personalization", and Chrome's own getMatchedRules
 *      must agree.
 *   2. REMOVE EACH RULE IN TURN (`updateStaticRules({ disableRuleIds })`), reload, and the count must fall by
 *      exactly one — a rule whose removal changes nothing is dead weight or shadowed, and is reported as such.
 *   3. `testMatchOutcome` (unpacked builds only, no request made) over the URLs that render a price, a cart, search
 *      results, a product grid or a Klaviyo sign-up form: no block rule from ANY ruleset may match them. Over the
 *      tracking-only endpoints: the expected personalization rule must.
 * Exit 1 on any failed assertion. Measurement only; never shipped.
 */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const SRC = argv.find((a, i) => !a.startsWith('--') && !['--out', '--puppeteer'].includes(argv[i - 1]));
if (!SRC) { console.error('usage: node harness/personalization-attack.mjs <unzipped chrome package> [--out f.json]'); process.exit(2); }
const { classifyMatchedRule } = await import(path.join(path.resolve(SRC), 'src', 'protocol.js'));

function loadPuppeteer() {
  const dirs = [opt('--puppeteer'), process.env.NULLECHO_PUPPETEER_DIR].filter(Boolean);
  for (const t of [() => createRequire(import.meta.url), ...dirs.map((d) => () => createRequire(path.join(path.resolve(d), 'package.json')))]) {
    try { return t()('puppeteer'); } catch (_) { /* next */ }
  }
  console.error('puppeteer not found: pass --puppeteer <dir> or set NULLECHO_PUPPETEER_DIR'); process.exit(2);
}
const puppeteer = loadPuppeteer();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── one URL per block rule, from the rule's own condition (as block-counter.test.js builds them) ──
const RULES = JSON.parse(fs.readFileSync(path.join(path.resolve(SRC), 'rules', 'personalization.json'), 'utf8'));
const urlFor = (c) => (c.requestDomains
  ? `https://${c.requestDomains[0]}/x.js`
  : 'https://' + c.urlFilter.replace(/^\|\|/, '').replace(/\*/g, 'a').replace(/\^$/, '?q=1').replace(/\^/g, '/'));
const PROBES = RULES.filter((r) => r.action.type === 'block').map((r) => ({ id: r.id, url: urlFor(r.condition), type: r.condition.resourceTypes?.[0] === 'image' ? 'image' : 'fetch' }));

// ── URLs that must NEVER be blocked: what renders the price, cart, search, grid or a sign-up form ──
// (host/paths observed on 2026-10-14 in the exploration that picked the shopping rows, plus the vendor map's DON'T list)
const MUST_PASS = [
  ['Dynamic Yield page script', 'https://cdn.dynamicyield.com/api/8772758/api_dynamic.js', 'script'],
  ['Dynamic Yield static script', 'https://cdn.dynamicyield.com/api/8772758/api_static.js', 'script'],
  ['Dynamic Yield content (st)', 'https://st.dynamicyield.com/st?sec=8772758&ref=&scriptVersion=2.100.0&inHead=true&id=0', 'script'],
  ['Dynamic Yield SPA content', 'https://st.dynamicyield.com/spa/json?sec=8772758&ref=&scriptVersion=2.100.0&id=0', 'xmlhttprequest'],
  ['Dynamic Yield recommendations', 'https://rcom.dynamicyield.com/v3/recommend/8772758?_=1', 'xmlhttprequest'],
  ['Dynamic Yield images', 'https://cdn.dynamicyield.com/api/8772758/images/0bf339c52d13.webp', 'image'],
  ['Bloomreach search API', 'https://core.dxpapi.com/api/v1/core/?account_id=5073&q=paper', 'xmlhttprequest'],
  ['Bloomreach suggest API', 'https://suggest.dxpapi.com/api/v2/suggest/?account_id=5073&q=pa', 'xmlhttprequest'],
  ['Bloomreach legacy search', 'https://brm-core-0.brsrvr.com/api/v1/core/?account_id=1', 'xmlhttprequest'],
  ['Constructor search/browse', 'https://ac.cnstrc.com/search/jeans?key=key_x', 'xmlhttprequest'],
  ['Constructor recommendations', 'https://ac.cnstrc.com/recommendations/v1/pods/pdp-1?key=key_x', 'xmlhttprequest'],
  ['Constructor beacon script (NEEDS LAB, not blocked)', 'https://cnstrc.com/js/cust/gap_nf8JL7.js', 'script'],
  ['Algolia search', 'https://2deaes0cuo-dsn.algolia.net/1/indexes/production_us_products/query', 'xmlhttprequest'],
  ['Algolia search (alt host)', 'https://2deaes0cuo-1.algolianet.com/1/indexes/production_us_products/query', 'xmlhttprequest'],
  ['Coveo search', 'https://platform.cloud.coveo.com/rest/search/v2', 'xmlhttprequest'],
  ['Salesforce Einstein recs', 'https://e.cquotient.com/recs/x/y', 'xmlhttprequest'],
  ['Salesforce Einstein API', 'https://api.cquotient.com/v3/activities/x/viewProduct', 'xmlhttprequest'],
  ['Intelligems bundle (rewrites the price)', 'https://cdn.intelligems.io/esm/d0df0385db68/bundle.js', 'script'],
  ['Intelligems config', 'https://cdn.intelligems.io/configs/d0df0385db68/config.1791567380.json', 'xmlhttprequest'],
  ['Rebuy cart drawer API', 'https://rebuyengine.com/api/v1/products/recommended?key=x', 'xmlhttprequest'],
  ['Nosto recommendations', 'https://connect.nosto.com/ev1?m=shopify-1', 'xmlhttprequest'],
  ['Rokt SDK (mParticle by Rokt) — not blocked, only its event upload', 'https://apps.rokt-api.com/js/v2/us2-6a2d0e4dc6b9e749870271a2f16058a1/app.js?env=0&', 'script'],
  ['Klaviyo loader', 'https://static.klaviyo.com/onsite/js/klaviyo.js?company_id=pWh7nE', 'script'],
  ['Klaviyo sign-up form bundle', 'https://static.klaviyo.com/onsite/js/signup_forms.783874669fbb8.js?cb=2', 'script'],
  ['Klaviyo form definitions', 'https://static-forms.klaviyo.com/forms/api/v7/pWh7nE/full-forms', 'xmlhttprequest'],
  ['Klaviyo form fonts', 'https://fast.a.klaviyo.com/custom-fonts/api/v1/company-fonts/onsite?company_id=pWh7nE', 'xmlhttprequest'],
  ['Klaviyo form SUBMIT', 'https://a.klaviyo.com/client/subscriptions/?company_id=pWh7nE', 'xmlhttprequest'],
  ['Klaviyo back-in-stock SUBMIT', 'https://a.klaviyo.com/client/back-in-stock-subscriptions/?company_id=pWh7nE', 'xmlhttprequest'],
  ['Klaviyo consent page', 'https://a.klaviyo.com/consent-pages/client/x', 'xmlhttprequest'],
  ['Klaviyo legacy subscribe', 'https://a.klaviyo.com/ajax/subscriptions/subscribe', 'xmlhttprequest'],
  ['Klaviyo forms geo-ip', 'https://a.klaviyo.com/forms/api/v3/geo-ip', 'xmlhttprequest'],
  ['Shopify cart add', 'https://shop.example/cart/add.js', 'xmlhttprequest'],
];
const MUST_BLOCK = [
  ['Klaviyo analytics modules', 'https://static-tracking.klaviyo.com/onsite/js/fender_analytics.231256e109566.js?cb=2', 'script', 6950],
  ['Klaviyo telemetry', 'https://telemetrics.klaviyo.com/v1/metric', 'xmlhttprequest', 6951],
  ['Klaviyo form analytics', 'https://a.klaviyo.com/onsite/track-analytics?company_id=JpiXrs', 'xmlhttprequest', 6952],
  ['Klaviyo legacy analytics script', 'https://fast.a.klaviyo.com/media/js/analytics/klaviyo_analytics.js', 'script', 6953],
  ['Klaviyo browse events', 'https://a.klaviyo.com/client/events/?company_id=pWh7nE', 'xmlhttprequest', 6954],
  ['Dynamic Yield collection', 'https://async-px.dynamicyield.com/uia?cnst=1&_=1', 'xmlhttprequest', 6000],
  ['Bloomreach pixel', 'https://p.brsrvr.com/pix.gif?acct_id=5073', 'image', 6100],
  ['Bloomreach tracker script', 'https://cdns.brsrvr.com/v1/br-trk-6489.js', 'script', 6101],
  ['Rokt/mParticle event upload', 'https://apps.rokt-api.com/webevents/v3/JS/us2-6a2d0e4dc6b9e749870271a2f16058a1/events', 'xmlhttprequest', 6200],
  ['Rokt fallback event upload (D56)', 'https://apps.roktecommerce.com/webevents/v3/JS/us2-6a2d0e4dc6b9e749870271a2f16058a1/events', 'xmlhttprequest', 6201],
  ['Attentive tag', 'https://cdn.attn.tv/gap/dtag.js', 'script', 6300],
  ['Granify', 'https://matching.granify.com/match', 'xmlhttprequest', 6500],
  ['Intelligems tracking', 'https://api.intelligems.io/v3/track', 'xmlhttprequest', 6900],
];

// ── fixture server ──
const srv = http.createServer((q, r) => {
  const u = new URL(q.url, 'http://x');
  if (u.pathname === '/urls.json') { r.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); r.end(JSON.stringify(PROBES)); return; }
  if (u.pathname === '/' || u.pathname === '/personalization-rules.html') {
    r.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    fs.createReadStream(path.join(HERE, 'fixtures', 'personalization-rules.html')).pipe(r); return;
  }
  r.writeHead(404); r.end();
}).listen(0, '127.0.0.1');
await new Promise((r) => srv.on('listening', r));
const fixture = `http://127.0.0.1:${srv.address().port}/personalization-rules.html`;

const EXT = fs.mkdtempSync(path.join(os.tmpdir(), 'nullecho-pz-attack-'));
fs.cpSync(path.resolve(SRC), EXT, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nullecho-pz-attack-profile-'));
const browser = await puppeteer.launch({
  headless: true, pipe: true, enableExtensions: true, protocolTimeout: 120000, userDataDir: profile,
  ignoreDefaultArgs: ['--disable-extensions'],
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--window-size=1400,900', '--host-resolver-rules=MAP * 127.0.0.1, EXCLUDE 127.0.0.1'],
});
const sw = await browser.waitForTarget((t) => t.type() === 'service_worker' && /\/src\/background\.js$/.test(t.url()), { timeout: 20000 });
const worker = await sw.worker();
await sleep(1500);
for (const p of await browser.pages()) if (/^chrome-extension:/.test(p.url())) await p.close().catch(() => {});

const failures = [];
const check = (ok, what) => { if (!ok) failures.push(what); return ok; };

/** Load the fixture in a fresh tab; return the D55 tally for it (and, if asked, getMatchedRules sorted). */
async function measure({ withMatched = false } = {}) {
  const p = await browser.newPage();
  await p.bringToFront();
  await p.goto(fixture, { waitUntil: 'load', timeout: 30000 });
  await p.waitForFunction(() => document.title === 'done', { timeout: 30000 }).catch(() => {});
  await sleep(1200);   // the tally is written 500 ms after the last block (background.js saveTallies)
  const at = p.url();
  const raw = await worker.evaluate(async (u, wantMatched) => {
    const tab = (await chrome.tabs.query({})).find((t) => t.url === u);
    if (!tab) return { error: 'tab not found' };
    const tally = (await chrome.storage.session.get('nullecho:tab-blocked'))['nullecho:tab-blocked']?.[tab.id] ?? { total: 0, byCategory: {} };
    let matched = null;
    if (wantMatched) { try { matched = (await chrome.declarativeNetRequest.getMatchedRules({ tabId: tab.id })).rulesMatchedInfo.map((m) => m.rule); } catch (e) { matched = String(e.message || e); } }
    return { tally, matched };
  }, at, withMatched);
  const log = await p.evaluate(() => document.getElementById('log').textContent).catch(() => '');
  await p.close();
  return { ...raw, log };
}

const out = { chrome: await browser.version(), package: path.resolve(SRC), probes: PROBES.length, baseline: null, removals: [], mustPass: [], mustBlock: [] };
try {
  // 1. baseline
  const base = await measure({ withMatched: true });
  const pz = base.tally.byCategory?.personalization ?? 0;
  let gmr = null;
  if (Array.isArray(base.matched)) {
    gmr = base.matched.map(classifyMatchedRule).filter((c) => c.outcome === 'blocked' && c.category === 'personalization').length;
  }
  out.baseline = { tallyPersonalization: pz, tallyTotal: base.tally.total, getMatchedRulesPersonalization: gmr, rawMatched: Array.isArray(base.matched) ? base.matched.length : base.matched };
  check(pz === PROBES.length, `baseline: per-tab count credits ${pz} blocked requests to personalization, expected ${PROBES.length} (one per block rule)`);
  check(gmr === PROBES.length, `baseline: getMatchedRules credits ${gmr} to personalization, expected ${PROBES.length}`);
  console.error(`[attack] baseline: tally personalization ${pz}/${PROBES.length}, getMatchedRules ${gmr}`);

  // 2. remove each rule in turn
  for (const probe of PROBES) {
    await worker.evaluate((id) => chrome.declarativeNetRequest.updateStaticRules({ rulesetId: 'personalization', disableRuleIds: [id] }), probe.id);
    const m = await measure();
    await worker.evaluate((id) => chrome.declarativeNetRequest.updateStaticRules({ rulesetId: 'personalization', enableRuleIds: [id] }), probe.id);
    const n = m.tally.byCategory?.personalization ?? 0;
    const drop = pz - n;
    out.removals.push({ id: probe.id, url: probe.url, count: n, drop });
    check(drop === 1, `rule ${probe.id} removed: personalization count ${pz} → ${n} (expected ${pz - 1}) for ${probe.url}`);
    console.error(`[attack] −${probe.id}: ${pz} → ${n}${drop === 1 ? '' : '  ✗'}`);
  }
  const restored = await worker.evaluate(() => chrome.declarativeNetRequest.getDisabledRuleIds({ rulesetId: 'personalization' }));
  check(restored.length === 0, `rules still disabled after the attack: ${restored.join(',')}`);

  // 3. testMatchOutcome: protected URLs match no block rule anywhere; tracking endpoints match their rule
  const outcome = (url, type) => worker.evaluate(async (u, t) => {
    try { return (await chrome.declarativeNetRequest.testMatchOutcome({ url: u, type: t, initiator: 'https://shop.example', tabId: -1 })).matchedRules; }
    catch (e) { return String(e.message || e); }
  }, url, type);
  for (const [label, url, type] of MUST_PASS) {
    const matched = await outcome(url, type);
    // classifyMatchedRule is the counter's own sorting: a block from any blocking ruleset or a learned block.
    const blocks = Array.isArray(matched) ? matched.filter((r) => classifyMatchedRule(r).outcome === 'blocked') : matched;
    out.mustPass.push({ label, url, matched });
    check(Array.isArray(blocks) && blocks.length === 0, `MUST PASS but a block rule matched: ${label} ${url} → ${JSON.stringify(blocks)}`);
  }
  for (const [label, url, type, id] of MUST_BLOCK) {
    const matched = await outcome(url, type);
    out.mustBlock.push({ label, url, expected: id, matched });
    check(Array.isArray(matched) && matched.some((r) => r.rulesetId === 'personalization' && r.ruleId === id), `MUST BLOCK via ${id}: ${label} ${url} → ${JSON.stringify(matched)}`);
  }
  out.failures = failures;
  out.ok = failures.length === 0;
  console.log(JSON.stringify(out, null, 1));
  if (opt('--out')) fs.writeFileSync(opt('--out'), JSON.stringify(out, null, 1));
  for (const f of failures) console.error('  ✗ ' + f);
  console.error(out.ok ? `[attack] OK — ${PROBES.length} rules each counted exactly once and each removal dropped the count by one; ${MUST_PASS.length} protected URLs matched no block rule; ${MUST_BLOCK.length} tracking URLs matched their rule.` : `[attack] ${failures.length} FAILURE(S)`);
  process.exitCode = out.ok ? 0 : 1;
} finally {
  await browser.close(); srv.close();
  fs.rmSync(EXT, { recursive: true, force: true });
  fs.rmSync(profile, { recursive: true, force: true });
}
