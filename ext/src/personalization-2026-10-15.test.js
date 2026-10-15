/**
 * 0.9.3 — the "Pricing & personalization" category: `rules/personalization.json`, its place in the counter,
 * the settings and the UI, the rule that it never touches what renders a price, and the Klaviyo narrowing.
 *
 * The lab that put these rules in front of real shopping pages is `harness/site-smoke.mjs --shopping`
 * (docs/breakage-runs/*-site-smoke-shopping-*) and `harness/personalization-attack.mjs`. These tests pin what
 * that lab found to the source, so a later edit cannot quietly widen a rule onto a price-rendering host.
 *
 * Run: `node --test` from `ext/`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  RULESETS, BLOCKING_RULESET_IDS, CATEGORY_LABELS, DEFAULT_SETTINGS, NON_BLOCKING_STATIC_RULE_IDS,
  classifyMatchedRule, OUTCOME,
} from './protocol.js';
import { NEVER_BLOCK, COOKIE_BLOCK_ONLY, isNeverBlock, isCookieBlockOnly, protectedHostsUnder } from './allowlist.js';
import { buildMatcher, requestFacts } from './block-counter.js';
import { CATEGORY_MEANING, ownerOf } from './linkage.js';
import { reachedPathScopedEntries } from '../rules/path-scope.mjs';

const EXT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(EXT, p), 'utf8');
const RULES = JSON.parse(read('rules/personalization.json'));
const ALL = BLOCKING_RULESET_IDS.map((id) => ({ id, rules: JSON.parse(read(`rules/${id}.json`)) }));
const M = buildMatcher({ rulesets: ALL });
const PZ = buildMatcher({ rulesets: [{ id: 'personalization', rules: RULES }] });
const req = (url, type = 'xmlhttprequest', initiator = 'https://shop.example') => requestFacts({ url, initiator, type, tabId: 1 });

// ── the category exists everywhere a category has to exist ─────────────────────────────────────────────────

test('personalization is a blocking ruleset, on by default, labelled "Pricing & personalization"', () => {
  assert.equal(RULESETS.personalization, 'personalization');
  assert.ok(BLOCKING_RULESET_IDS.includes('personalization'));
  assert.equal(DEFAULT_SETTINGS.categories.personalization, true);
  assert.equal(CATEGORY_LABELS.personalization, 'Pricing & personalization');
  assert.ok(CATEGORY_MEANING.personalization, 'linkage.js has no meaning for the category, so the site report would print its key');
});

test('both manifests register rules/personalization.json, enabled, as ruleset "personalization"', () => {
  for (const name of ['manifest.json', 'manifest.firefox.json']) {
    const m = JSON.parse(read(name));
    const entry = m.declarative_net_request.rule_resources.find((r) => r.id === 'personalization');
    assert.ok(entry, `${name} does not register it`);
    assert.equal(entry.path, 'rules/personalization.json', name);
    assert.equal(entry.enabled, true, name);
  }
});

test('the options page lists the category with a blurb, and "turn blocking on" turns it on too', () => {
  const src = read('options/options.js');
  assert.match(src, /for \(const key of \['ads', 'analytics', 'social', 'fingerprinting', 'personalization'\]\)/);
  assert.match(src, /personalization: 'Shopper-profiling, offer-targeting and price-test tracking on shopping pages\. Never what shows a price, cart or search results\.'/);
  const enableAll = src.match(/categories: \{ ads: true, analytics: true, social: true, fingerprinting: true(, personalization: true)? \}/g);
  assert.equal(enableAll.length, 2);
  assert.ok(enableAll.every((s) => s.includes('personalization: true')), 'a remedy or demo fixture leaves the new category off');
});

test('version 0.9.3 in both manifests and the options page\'s offline fallback', () => {
  assert.equal(JSON.parse(read('manifest.json')).version, '0.9.3');
  assert.equal(JSON.parse(read('manifest.firefox.json')).version, '0.9.3');
  assert.match(read('options/options.js'), /getManifest\(\)\.version : '0\.9\.3'/);
});

// ── the counter's view ───────────────────────────────────────────────────────────────────────────────────

test('every block rule counts as "personalization"; the Dynamic Yield cookie strip counts as nothing', () => {
  for (const r of RULES) {
    const c = classifyMatchedRule({ ruleId: r.id, rulesetId: 'personalization' });
    if (r.action.type === 'block') assert.deepEqual(c, { outcome: OUTCOME.BLOCKED, category: 'personalization' }, `rule ${r.id}`);
    else assert.equal(c.outcome, OUTCOME.IGNORED, `rule ${r.id} is not a block and must not be counted`);
  }
  assert.ok(NON_BLOCKING_STATIC_RULE_IDS.has(6090));
});

test('ids sit in 6000–6999, no rule reaches main_frame, and 6090 is the only non-block: a third-party Cookie/Set-Cookie strip', () => {
  for (const r of RULES) {
    assert.ok(r.id >= 6000 && r.id <= 6999, `id ${r.id}`);
    assert.ok(!(r.condition.resourceTypes || []).includes('main_frame'), `rule ${r.id} opts into main_frame`);
  }
  const nonBlock = RULES.filter((r) => r.action.type !== 'block');
  assert.deepEqual(nonBlock.map((r) => r.id), [6090]);
  const [strip] = nonBlock;
  assert.deepEqual(strip.action, {
    type: 'modifyHeaders',
    requestHeaders: [{ header: 'Cookie', operation: 'remove' }],
    responseHeaders: [{ header: 'Set-Cookie', operation: 'remove' }],
  });
  assert.equal(strip.condition.domainType, 'thirdParty');
  assert.deepEqual(strip.condition.requestDomains, ['dynamicyield.com', 'dy-api.com']);
});

// ── never what renders a price, a cart, search results, a product grid or a sign-up form ───────────────────

// Observed on real shopping pages 2026-10-14 (the exploration that chose the lab's rows) plus the vendor map's
// DON'T list. No block rule in ANY shipped ruleset may cover one of these.
const MUST_PASS = [
  ['https://cdn.dynamicyield.com/api/8772758/api_dynamic.js', 'script'],
  ['https://cdn.dynamicyield.com/api/8772758/api_static.js', 'script'],
  ['https://st.dynamicyield.com/st?sec=8772758&ref=&scriptVersion=2.100.0&inHead=true&id=0', 'script'],
  ['https://st.dynamicyield.com/spa/json?sec=8772758&ref=&id=0', 'xmlhttprequest'],
  ['https://rcom.dynamicyield.com/v3/recommend/8772758?_=1', 'xmlhttprequest'],
  ['https://cdn.dynamicyield.com/api/8772758/images/0bf339c52d13.webp', 'image'],
  ['https://core.dxpapi.com/api/v1/core/?account_id=5073&q=paper', 'xmlhttprequest'],
  ['https://suggest.dxpapi.com/api/v2/suggest/?account_id=5073&q=pa', 'xmlhttprequest'],
  ['https://staging-core.dxpapi.com/api/v1/core/?account_id=1', 'xmlhttprequest'],
  ['https://brm-core-0.brsrvr.com/api/v1/core/?account_id=1', 'xmlhttprequest'],
  ['https://ac.cnstrc.com/search/jeans?key=key_x', 'xmlhttprequest'],
  ['https://ac.cnstrc.com/browse/group_id/123?key=key_x', 'xmlhttprequest'],
  ['https://ac.cnstrc.com/recommendations/v1/pods/pdp-1?key=key_x', 'xmlhttprequest'],
  ['https://2deaes0cuo-dsn.algolia.net/1/indexes/production_us_products/query', 'xmlhttprequest'],
  ['https://2deaes0cuo-1.algolianet.com/1/indexes/production_us_products/query', 'xmlhttprequest'],
  ['https://platform.cloud.coveo.com/rest/search/v2', 'xmlhttprequest'],
  ['https://e.cquotient.com/recs/x/y', 'xmlhttprequest'],
  ['https://api.cquotient.com/v3/activities/x/viewProduct', 'xmlhttprequest'],
  ['https://cdn.cquotient.com/js/v2/gretel.min.js', 'script'],
  ['https://cdn.intelligems.io/esm/d0df0385db68/bundle.js', 'script'],
  ['https://cdn.intelligems.io/configs/d0df0385db68/config.1791567380.json', 'xmlhttprequest'],
  ['https://rebuyengine.com/api/v1/products/recommended?key=x', 'xmlhttprequest'],
  ['https://cdn.rebuyengine.com/onsite/js/rebuy.js', 'script'],
  ['https://connect.nosto.com/ev1?m=shopify-1', 'xmlhttprequest'],
  ['https://apps.rokt-api.com/js/v2/us2-6a2d0e4dc6b9e749870271a2f16058a1/app.js?env=0&', 'script'],
  ['https://apps.roktecommerce.com/js/v2/us2-6a2d0e4dc6b9e749870271a2f16058a1/app.js?env=0&', 'script'],
  ['https://static.klaviyo.com/onsite/js/klaviyo.js?company_id=pWh7nE', 'script'],
  ['https://static.klaviyo.com/onsite/js/signup_forms.783874669fbb8.js?cb=2', 'script'],
  ['https://static-forms.klaviyo.com/forms/api/v7/pWh7nE/full-forms', 'xmlhttprequest'],
  ['https://fast.a.klaviyo.com/custom-fonts/api/v1/company-fonts/onsite?company_id=pWh7nE', 'xmlhttprequest'],
  ['https://a.klaviyo.com/client/subscriptions/?company_id=pWh7nE', 'xmlhttprequest'],
  ['https://a.klaviyo.com/client/back-in-stock-subscriptions/?company_id=pWh7nE', 'xmlhttprequest'],
  ['https://a.klaviyo.com/consent-pages/client/x', 'xmlhttprequest'],
  ['https://a.klaviyo.com/forms/api/v3/geo-ip', 'xmlhttprequest'],
  ['https://launchdarkly.com/sdk/evalx/x', 'xmlhttprequest'],
  ['https://app.launchdarkly.com/sdk/evalx/x/contexts/y', 'xmlhttprequest'],
];

test('no shipped block rule covers a host or path that renders a price, cart, search results, grid or sign-up form', () => {
  for (const [url, type] of MUST_PASS) {
    const hit = M.match(req(url, type));
    assert.equal(hit, null, `${url} is blocked by ${hit && `${hit.rulesetId}#${hit.ruleId}`}`);
  }
});

const MUST_BLOCK = [
  [6000, 'https://async-px.dynamicyield.com/uia?cnst=1&_=1'], [6000, 'https://async-px.dynamicyield.com/batch?cnst=1'],
  [6001, 'https://direct-collect.dy-api.com/v2/collect/user/pageview'],
  [6002, 'https://st.dynamicyield.com/uia?x=1'],
  [6100, 'https://p.brsrvr.com/pix.gif?acct_id=5073'], [6101, 'https://cdns.brsrvr.com/v1/br-trk-6489.js'], [6102, 'https://cdn.brcdn.com/v1/br-trk-5073.js'],
  [6200, 'https://apps.rokt-api.com/webevents/v3/JS/us2-x/events'], [6201, 'https://apps.roktecommerce.com/webevents/v3/JS/us2-x/events'],
  [6300, 'https://cdn.attn.tv/gap/dtag.js'], [6300, 'https://cdn.attn.tv/allbirds/dtag.js?shop=weareallbirds.myshopify.com'],
  [6301, 'https://cdn.attn.tv/tag/2026-latest/unified-tag.js?v=1'], [6302, 'https://events.attentivemobile.com/ct-ev'],
  [6400, 'https://tag.wknd.ai/123/i.js'], [6400, 'https://assets.bounceexchange.com/x.js'], [6400, 'https://events.bouncex.net/track'],
  [6500, 'https://cdn.granify.com/assets/javascript.js?id=TgCeU'], [6500, 'https://matching.granify.com/match'],
  [6600, 'https://acme.us-7.evergage.com/api2/event/x'], [6601, 'https://p.cquotient.com/pebble?x=1'],
  [6700, 'https://insights.algolia.io/1/events'], [6701, 'https://ac.cnstrc.com/behavior?action=session_start'],
  [6710, 'https://onsitestats.bluecore.com/events?ns=gpus'], [6900, 'https://api.intelligems.io/v3/track'],
  [6950, 'https://static-tracking.klaviyo.com/onsite/js/fender_analytics.231256e109566.js?cb=2'],
  [6951, 'https://telemetrics.klaviyo.com/v1/metric'], [6952, 'https://a.klaviyo.com/onsite/track-analytics?company_id=JpiXrs'],
  [6953, 'https://fast.a.klaviyo.com/media/js/analytics/klaviyo_analytics.js'], [6954, 'https://a.klaviyo.com/client/events/?company_id=pWh7nE'],
];

test('the tracking endpoints the lab saw are blocked, each by the rule meant for it', () => {
  for (const [id, url] of MUST_BLOCK) {
    const hit = PZ.match(req(url));
    assert.ok(hit, `${url} is not blocked`);
    assert.equal(hit.ruleId, id, `${url} is blocked by ${hit.ruleId}, expected ${id}`);
  }
});

test('nothing qualifies through DuckDuckGo alone: the DDG-only candidates (Rokt launcher/snippet, Black Crow core script) stay out', () => {
  // Tracker Radar is CC BY-NC-SA 4.0 (counter-program H, 2026-10-15): a corroborating reference, never the reason
  // a personalization rule exists. These three were planned and qualified only through it.
  for (const url of ['https://apps.rokt.com/wsdk/integrations/launcher.js', 'https://apps.rokt.com/wsdk/integrations/snippet.js', 'https://cdn.blackcrow.ai/js/core/x.js']) {
    assert.equal(PZ.match(req(url, 'script')), null, `${url} is blocked, but only DuckDuckGo lists it`);
  }
  assert.ok(!RULES.some((r) => [6202, 6203, 6511].includes(r.id)));
});

test('the Rokt fallback (D56) is blocked at the event path the primary is listed for, not at the SDK', () => {
  for (const host of ['apps.rokt-api.com', 'apps.roktecommerce.com']) {
    assert.ok(PZ.match(req(`https://${host}/webevents/v3/JS/us2-6a2d0e4dc6b9e749870271a2f16058a1/events`)), `${host} event upload not blocked`);
    assert.equal(PZ.match(req(`https://${host}/js/v2/us2-6a2d0e4dc6b9e749870271a2f16058a1/app.js?env=0&`, 'script')), null, `${host} SDK blocked`);
    assert.equal(PZ.match(req(`https://${host}/identity/v1/identify`)), null, `${host} identity call is on no list and must not be blocked`);
  }
});

test('EasyPrivacy / AdGuard breakage exceptions are honoured: evergage on mbusa.com, Convert on skratchlabs.com, RichRelevance tracking on blue-tomato.com', () => {
  assert.equal(PZ.match(req('https://x.us-7.evergage.com/api2/event/y', 'xmlhttprequest', 'https://www.mbusa.com')), null);
  assert.ok(PZ.match(req('https://x.us-7.evergage.com/api2/event/y', 'xmlhttprequest', 'https://shop.example')));
  assert.equal(PZ.match(req('https://cdn-3.convertexperiments.com/js/1.js', 'script', 'https://www.skratchlabs.com')), null);
  assert.ok(PZ.match(req('https://cdn-3.convertexperiments.com/js/1.js', 'script', 'https://shop.example')));
  assert.equal(PZ.match(req('https://recs.richrelevance.com/rrserver/tracking?a=1', 'xmlhttprequest', 'https://www.blue-tomato.com')), null);
});

test('third-party-only rules never fire on the vendor\'s own site', () => {
  assert.equal(PZ.match(req('https://www.granify.com/demo.js', 'script', 'https://www.granify.com')), null);
  assert.equal(PZ.match(req('https://cdn.brcdn.com/x.js', 'script', 'https://www.brcdn.com')), null);
});

test('Dynamic Yield\'s rendering hosts are cookie-stripped (the MUST_PASS test above proves no block reaches them)', () => {
  const strip = RULES.find((r) => r.id === 6090);
  for (const host of ['st.dynamicyield.com', 'cdn.dynamicyield.com', 'rcom.dynamicyield.com', 'st-eu.dynamicyield.com', 'direct.dy-api.com']) {
    assert.ok(strip.condition.requestDomains.some((d) => host === d || host.endsWith(`.${d}`)), `${host} is not cookie-stripped`);
  }
});

// ── Klaviyo: narrowed from the whole domain to what its forms need ────────────────────────────────────────

test('Klaviyo is no longer whole-domain NEVER_BLOCK; its form hosts and paths are, and the domain is cookie-strip-only', () => {
  assert.ok(!NEVER_BLOCK.includes('klaviyo.com'));
  assert.equal(isNeverBlock('klaviyo.com'), false);
  assert.equal(isNeverBlock('static-tracking.klaviyo.com'), false);
  assert.equal(isNeverBlock('telemetrics.klaviyo.com'), false);
  assert.equal(isNeverBlock('static.klaviyo.com'), true);
  assert.equal(isNeverBlock('static-forms.klaviyo.com'), true);
  for (const p of ['a.klaviyo.com/client/subscriptions/', 'a.klaviyo.com/client/back-in-stock-subscriptions/', 'a.klaviyo.com/consent-pages/', 'fast.a.klaviyo.com/custom-fonts/']) {
    assert.ok(NEVER_BLOCK.includes(p), `${p} lost its protection`);
  }
  assert.ok(COOKIE_BLOCK_ONLY.includes('klaviyo.com'));
  assert.equal(isCookieBlockOnly('static-tracking.klaviyo.com'), true);
  assert.deepEqual(protectedHostsUnder('klaviyo.com'), ['a.klaviyo.com', 'fast.a.klaviyo.com', 'static-forms.klaviyo.com', 'static.klaviyo.com']);
});

// ── validate.mjs check 11: a static rule may not reach a path-scoped NEVER_BLOCK entry ────────────────────

test('path-scope: a whole-host or too-wide rule over a protected path is caught; a narrow one is not', () => {
  const reached = (c) => reachedPathScopedEntries(c);
  assert.ok(reached({ requestDomains: ['a.klaviyo.com'] }).includes('a.klaviyo.com/client/subscriptions/'));
  assert.ok(reached({ requestDomains: ['klaviyo.com'] }).includes('fast.a.klaviyo.com/custom-fonts/'));
  assert.ok(reached({ urlFilter: '||a.klaviyo.com/client/' }).includes('a.klaviyo.com/client/back-in-stock-subscriptions/'));
  assert.ok(reached({ urlFilter: '||klaviyo.com/client/subscriptions' }).includes('a.klaviyo.com/client/subscriptions/'));
  assert.ok(reached({ requestDomains: ['www.google.com'] }).includes('www.google.com/recaptcha/'), 'the reCAPTCHA path (D50) was never checked against static rules');
  assert.deepEqual(reached({ urlFilter: '||a.klaviyo.com/client/events/' }), []);
  assert.deepEqual(reached({ urlFilter: '||a.klaviyo.com/onsite/track-analytics' }), []);
  assert.deepEqual(reached({ requestDomains: ['static-tracking.klaviyo.com'] }), []);
  assert.deepEqual(reached({ urlFilter: '||connect.facebook.net/*fbevents.js' }), [], 'the SDK path entry is not reached by the pixel rule');
});

test('no shipped block rule reaches a path-scoped NEVER_BLOCK entry', () => {
  for (const { id, rules } of ALL) {
    for (const r of rules) {
      if (r.action.type !== 'block') continue;
      assert.deepEqual(reachedPathScopedEntries(r.condition), [], `${id}#${r.id}`);
    }
  }
});

test('validate.mjs fails (exit 1) on a planted whole-host block of a.klaviyo.com, and passes on the shipped tree', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nullecho-validate-'));
  try {
    fs.cpSync(EXT, tmp, { recursive: true, filter: (src) => !/[\\/](node_modules|_metadata)([\\/]|$)/.test(src) });
    execFileSync(process.execPath, ['rules/validate.mjs'], { cwd: tmp, stdio: 'pipe' });   // throws on non-zero
    const f = path.join(tmp, 'rules', 'personalization.json');
    const rules = JSON.parse(fs.readFileSync(f, 'utf8'));
    rules.push({ id: 6998, priority: 1, action: { type: 'block' }, condition: { requestDomains: ['a.klaviyo.com'] } });
    fs.writeFileSync(f, JSON.stringify(rules, null, 2) + '\n');
    let failed = null;
    try { execFileSync(process.execPath, ['rules/validate.mjs'], { cwd: tmp, stdio: 'pipe' }); } catch (e) { failed = e; }
    assert.ok(failed, 'validate.mjs passed a block on a.klaviyo.com');
    assert.equal(failed.status, 1);
    assert.match(String(failed.stdout), /reaches path-scoped NEVER_BLOCK entry "a\.klaviyo\.com\/client\/subscriptions\/"/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── the report names who runs each endpoint ───────────────────────────────────────────────────────────────

test('the site report names the company behind each new endpoint', () => {
  assert.equal(ownerOf('async-px.dynamicyield.com'), 'Dynamic Yield (Mastercard)');
  assert.equal(ownerOf('p.brsrvr.com'), 'Bloomreach');
  assert.equal(ownerOf('apps.roktecommerce.com'), 'Rokt');
  assert.equal(ownerOf('events.attentivemobile.com'), 'Attentive');
  assert.equal(ownerOf('static-tracking.klaviyo.com'), 'Klaviyo');
});
