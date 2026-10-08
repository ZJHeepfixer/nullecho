/**
 * harness/blocking-proof.html and its network-log check (harness/blocking-proof-netlog.mjs).
 *
 *   node --test harness/blocking-proof.test.mjs
 *
 * Offline. Part 1 replays the runs recorded on 2026-10-07 (harness/fixtures/blocking-proof-netlog-2026-10-07.json):
 * the check must flag the defect (the pre-fix page calling cdn.jsdelivr.net "loaded" while Chrome logged
 * net::ERR_ABORTED) and must pass the fixed page. Part 2 is the comparison rules on synthetic log entries.
 * Part 3 loads the real page in Chrome for Testing with every probe URL answered by request interception,
 * so each control state (loaded, http-<n>, unexpected, cancelled, timeout) can be produced on demand and
 * checked against Chrome's log. Interception does not reproduce Opaque Response Blocking (a fulfilled
 * opaque JSON body logs as finished), which is why the defect itself is covered by the recording in part 1
 * and live by `node harness/blocking-proof-check.mjs`. Part 3 is skipped when puppeteer cannot be found
 * ($NULLECHO_PUPPETEER_DIR, or the same fallback as the other harness scripts).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { recordNetwork, compare } from './blocking-proof-netlog.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = JSON.parse(fs.readFileSync(path.join(HERE, 'fixtures', 'blocking-proof-netlog-2026-10-07.json'), 'utf8'));
const recorded = (page, run) => FIXTURE.runs.find((r) => r.page === page && r.run === run);
const opts = (run) => (run.extension ? { blockedBy: 'net::ERR_BLOCKED_BY_CLIENT' } : {});
const JSDELIVR = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/package.json';

// ── 1. the recording ────────────────────────────────────────────────────────
for (const label of ['off', 'on']) {
  test(`recorded 2026-10-07, page before the fix, ${label}: the jsDelivr control disagrees with Chrome's log, nothing else does`, () => {
    const run = recorded('1c009eb', label);
    const bad = compare(run.rows, run.entries, opts(run)).filter((r) => !r.agree);
    assert.deepEqual(bad.map((r) => [r.kind, r.url, r.page]), [['control', JSDELIVR, 'loaded']]);
    assert.match(bad[0].chrome, /^200, then failed net::ERR_ABORTED/);
  });
  test(`recorded 2026-10-07, fixed page, ${label}: every row agrees with Chrome's log`, () => {
    const run = recorded('fixed', label);
    const results = compare(run.rows, run.entries, opts(run));
    assert.equal(results.length, 9);
    assert.deepEqual(results.filter((r) => !r.agree), []);
    assert.ok(results.filter((r) => r.kind === 'control').every((r) => r.page === 'loaded' && /^200, finished/.test(r.chrome)));
  });
}

// ── 2. the rules ────────────────────────────────────────────────────────────
const U = 'https://cdn.example/x';
const entry = (o) => ({ url: U, method: 'GET', type: 'Fetch', response: null, finished: null, failed: null, redirects: [], ...o });
const ok = (status = 200) => ({ response: { status, mimeType: 'x' }, finished: { bytes: 10 } });
const fail = (errorText, extra = {}) => ({ failed: { errorText, canceled: false, blockedReason: null, corsError: null, ...extra } });
const one = (kind, state, e, o) => compare([{ kind, category: 'c', url: U, state }], e ? [entry(e)] : [], o)[0];

test('control: loaded / unexpected need a 2xx response Chrome finished', () => {
  assert.equal(one('control', 'loaded', ok()).agree, true);
  assert.equal(one('control', 'unexpected', ok()).agree, true);
  assert.equal(one('control', 'loaded', { response: { status: 200 }, ...fail('net::ERR_ABORTED') }).agree, false);
  assert.equal(one('control', 'loaded', ok(404)).agree, false);
  assert.equal(one('control', 'loaded', { response: { status: 200 } }).agree, false);       // still loading
});
test('control: http-<n> needs that status; cancelled needs a failure (CORS fails after the response); timeout must not have finished', () => {
  assert.equal(one('control', 'http-503', ok(503)).agree, true);
  assert.equal(one('control', 'http-503', ok(200)).agree, false);
  assert.equal(one('control', 'cancelled', { response: { status: 200 }, ...fail('net::ERR_FAILED', { corsError: 'MissingAllowOriginHeader' }) }).agree, true);
  assert.equal(one('control', 'cancelled', ok()).agree, false);
  assert.equal(one('control', 'timeout', fail('net::ERR_ABORTED', { canceled: true })).agree, true);
  assert.equal(one('control', 'timeout', ok()).agree, false);
});
test('tracker: loaded needs only an answer (ORB may abort the opaque body after it); cancelled needs a failure with no answer', () => {
  assert.equal(one('tracker', 'loaded', ok()).agree, true);
  assert.equal(one('tracker', 'loaded', { response: { status: 404 }, ...fail('net::ERR_ABORTED', { canceled: true }) }).agree, true);
  assert.equal(one('tracker', 'loaded', fail('net::ERR_BLOCKED_BY_CLIENT')).agree, false);
  assert.equal(one('tracker', 'cancelled', fail('net::ERR_BLOCKED_BY_CLIENT')).agree, true);
  // a Chrome that turns ORB into errors for fetch would make an answered tracker reject: the page would say blocked
  assert.equal(one('tracker', 'cancelled', { response: { status: 200 }, ...fail('net::ERR_BLOCKED_BY_ORB') }).agree, false);
  assert.equal(one('tracker', 'timeout', fail('net::ERR_ABORTED', { canceled: true })).agree, true);
});
test('blockedBy attributes a blocked tracker: a DNS failure is not the extension', () => {
  const dns = fail('net::ERR_NAME_NOT_RESOLVED');
  assert.equal(one('tracker', 'cancelled', dns).agree, true);
  const r = one('tracker', 'cancelled', dns, { blockedBy: 'net::ERR_BLOCKED_BY_CLIENT' });
  assert.equal(r.agree, false);
  assert.match(r.why, /not attributable to the extension/);
});
test('a row with no request in the log disagrees; the LAST request for a URL is the one compared', () => {
  assert.equal(one('control', 'loaded', null).agree, false);
  const rows = [{ kind: 'control', category: 'c', url: U, state: 'loaded' }];
  assert.equal(compare(rows, [entry(ok()), entry({ response: { status: 200 }, ...fail('net::ERR_ABORTED') })])[0].agree, false);
  assert.equal(compare(rows, [entry({ response: { status: 200 }, ...fail('net::ERR_ABORTED') }), entry(ok())])[0].agree, true);
});
test('recordNetwork: follows redirects on one request, skips CORS preflights, keeps failures', async () => {
  const cdp = new EventEmitter();
  cdp.send = async () => ({});
  cdp.detach = async () => {};
  const net = await recordNetwork({ createCDPSession: async () => cdp });
  cdp.emit('Network.requestWillBeSent', { requestId: '1', type: 'Fetch', request: { url: U, method: 'GET' } });
  cdp.emit('Network.requestWillBeSent', { requestId: '1', type: 'Fetch', request: { url: U + '/moved', method: 'GET' }, redirectResponse: { status: 301 } });
  cdp.emit('Network.responseReceived', { requestId: '1', response: { status: 200, mimeType: 'application/json' } });
  cdp.emit('Network.loadingFinished', { requestId: '1', encodedDataLength: 1234 });
  cdp.emit('Network.requestWillBeSent', { requestId: '2', type: 'Preflight', request: { url: U, method: 'OPTIONS' } });
  cdp.emit('Network.requestWillBeSent', { requestId: '3', type: 'Fetch', request: { url: 'https://t.example/a.js', method: 'GET' } });
  cdp.emit('Network.loadingFailed', { requestId: '3', errorText: 'net::ERR_BLOCKED_BY_CLIENT', blockedReason: 'other' });
  const e = net.entries();
  assert.equal(e.length, 2);
  assert.deepEqual(e[0].redirects, [{ status: 301, to: U + '/moved' }]);
  assert.deepEqual([e[0].url, e[0].response.status, e[0].finished.bytes], [U, 200, 1234]);
  assert.deepEqual([e[1].failed.errorText, e[1].failed.blockedReason], ['net::ERR_BLOCKED_BY_CLIENT', 'other']);
});

// ── 3. the page itself, every probe answered by interception ────────────────
function findPuppeteer() {
  for (const dir of [null, process.env.NULLECHO_PUPPETEER_DIR, '/Users/jasonluker/bodybuilding']) {
    try { return dir === null ? createRequire(import.meta.url)('puppeteer') : createRequire(path.join(path.resolve(dir), 'package.json'))('puppeteer'); }
    catch { /* next */ }
  }
  return null;
}
const puppeteer = findPuppeteer();

const BODIES = {
  'fonts.gstatic.com': Buffer.concat([Buffer.from('wOF2'), Buffer.alloc(60)]),
  'cdn.jsdelivr.net': Buffer.from(JSON.stringify({ name: 'chart.js', version: '4.4.0' })),
  'cdnjs.cloudflare.com': Buffer.from('/*! jQuery v3.7.1 | (c) OpenJS Foundation */!function(){}();'),
};
const PORTAL = Buffer.from('<!doctype html><title>Sign in to Wi-Fi</title>');

/**
 * Load the page, answer each probe with `answer(host, kind)` → 'ok' | 'block' | 'hang' | { status, body, cors },
 * click Run, and return what the page reported and what Chrome logged.
 */
async function runPage(answer) {
  const html = fs.readFileSync(path.join(HERE, 'blocking-proof.html'));
  const srv = http.createServer((q, s) => { s.writeHead(q.url.startsWith('/blocking-proof.html') ? 200 : 404, { 'content-type': 'text/html' }); s.end(q.url.startsWith('/blocking-proof.html') ? html : ''); });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-first-run', '--no-default-browser-check'] });
  try {
    const page = await browser.newPage();
    const net = await recordNetwork(page);
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const u = new URL(req.url());
      if (u.protocol !== 'https:') return req.continue();
      const h = u.host;
      const kind = BODIES[h] ? 'control' : 'tracker';
      const a = answer(h, kind);
      if (a === 'hang') return;                                     // never answered: the page's 8 s timeout
      if (a === 'block') return req.abort('blockedbyclient');
      const spec = a === 'ok' ? { status: 200, body: kind === 'control' ? BODIES[h] : Buffer.from('/* tracker */'), cors: true } : a;
      return req.respond({ status: spec.status, body: spec.body,
        headers: { 'content-type': 'application/octet-stream', ...(spec.cors ? { 'access-control-allow-origin': '*' } : {}) } });
    });
    await page.goto(`http://127.0.0.1:${srv.address().port}/blocking-proof.html`, { waitUntil: 'load' });
    await page.click('#run');
    await page.waitForFunction(() => window.__proofDone, { timeout: 30000 });
    await new Promise((r) => setTimeout(r, 300));
    const done = await page.evaluate(() => window.__proofDone);
    const report = await page.evaluate(() => document.getElementById('report').textContent);
    return { done, report, entries: net.entries() };
  } finally {
    await browser.close();
    srv.close();
  }
}
const stateOf = (done, host) => done.rows.find((r) => new URL(r.url).host === host).state;
// What interception's abort('blockedbyclient') logs. The extension's own blocks log as net::ERR_BLOCKED_BY_CLIENT
// (blockedReason "other"), so `blockedBy` tells a DevTools block from an extension block.
const INSPECTOR_BLOCK = 'net::ERR_BLOCKED_BY_CLIENT.Inspector';

test('page: every probe answered → trackers loaded, controls loaded (file checked), all agree with the log', { skip: !puppeteer && 'puppeteer not found' }, async () => {
  const { done, report, entries } = await runPage(() => 'ok');
  assert.deepEqual(done.rows.map((r) => r.state), Array(9).fill('loaded'));
  assert.equal(done.verdict, 'BLOCKING IS NOT HAPPENING');
  assert.match(report, /controls:\s+3\/3 loaded/);                  // what make-social-assets parses
  assert.equal(report.match(/^\s+(tracker|control)\s+(\S+)\s+(\S+)\s+(\S+)$/gm).length, 9);
  assert.deepEqual(compare(done.rows, entries).filter((r) => !r.agree), []);
});

test('page: trackers blocked by the client, controls answered wrongly in three ways → three distinct states, all agree', { skip: !puppeteer && 'puppeteer not found' }, async () => {
  const { done, entries } = await runPage((h, kind) => {
    if (kind === 'tracker') return 'block';
    if (h === 'fonts.gstatic.com') return { status: 503, body: Buffer.from('unavailable'), cors: true };
    if (h === 'cdn.jsdelivr.net') return { status: 200, body: PORTAL, cors: true };           // a captive portal's 200
    return { status: 200, body: BODIES[h], cors: false };                                    // the right file, CORS dropped
  });
  assert.deepEqual(done.rows.filter((r) => r.kind === 'tracker').map((r) => r.state), Array(6).fill('cancelled'));
  assert.equal(stateOf(done, 'fonts.gstatic.com'), 'http-503');
  assert.equal(stateOf(done, 'cdn.jsdelivr.net'), 'unexpected');
  assert.equal(stateOf(done, 'cdnjs.cloudflare.com'), 'cancelled');
  assert.equal(done.verdict, 'VOID — no signal');                   // not one control arrived intact
  assert.deepEqual(compare(done.rows, entries, { blockedBy: INSPECTOR_BLOCK }).filter((r) => !r.agree), []);
  // and the attribution check can fail: these blocks are not the extension's
  const notOurs = compare(done.rows, entries, { blockedBy: 'net::ERR_BLOCKED_BY_CLIENT' }).filter((r) => !r.agree);
  assert.deepEqual(notOurs.map((r) => r.kind), Array(6).fill('tracker'));
});

test('page: a control that never answers times out and is not counted as loaded; trackers blocked + two good controls → PARTIAL', { skip: !puppeteer && 'puppeteer not found' }, async () => {
  const { done, entries } = await runPage((h, kind) => (kind === 'tracker' ? 'block' : h === 'cdn.jsdelivr.net' ? 'hang' : 'ok'));
  assert.equal(stateOf(done, 'cdn.jsdelivr.net'), 'timeout');
  assert.equal(stateOf(done, 'fonts.gstatic.com'), 'loaded');
  assert.match(done.verdict, /^PARTIAL — 6\/6 blocked, but a control did not load/);
  assert.deepEqual(compare(done.rows, entries, { blockedBy: INSPECTOR_BLOCK }).filter((r) => !r.agree), []);
});
