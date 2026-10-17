#!/usr/bin/env node
/**
 * Stage-1 self-test (METHOD.md §7). Runs every probe, unmodified, against local fixtures with planted effects and
 * checks that the pre-registered analysis (analyze.mjs):
 *   - FINDS each planted effect (positive controls),
 *   - reports NOTHING where nothing was planted (negative controls),
 *   - and that the guards hold: a live target is refused without --live; walls are recorded and the stop rules fire;
 *     the battery gate pauses; no cookie value, IP address or local path reaches an output file; no request leaves
 *     127.0.0.1; navigator.webdriver is false; each device profile sends the headers it claims.
 *
 *   NULLECHO_PUPPETEER_DIR=<dir> node selftest.mjs [--only A1,R3] [--jobs 3]
 * Writes selftest/selftest-<date>.json (scrubbed). Raw fixture outputs go to a temp dir and are deleted.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startFixture } from './fixtures/server.mjs';
import { analyzeAssign, analyzeCookies, analyzeHistory, analyzeRepeat } from './analyze.mjs';
import { scrubText } from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const ONLY = (opt('--only', '') || '').split(',').filter(Boolean);
const JOBS = Number(opt('--jobs', '3'));
const HEADFUL = argv.includes('--headful');
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), 'jcp-selftest-'));
const fixtures = [];
const outputs = [];

function run(script, args, env = {}) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const log = fs.openSync(path.join(WORK, `${path.basename(script)}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.log`), 'w');
    const p = spawn(process.execPath, [path.join(HERE, script), ...args, ...(HEADFUL ? ['--headful'] : [])], { stdio: ['ignore', log, log], env: { ...process.env, ...env } });
    p.on('exit', (code) => { fs.closeSync(log); resolve({ code, ms: Date.now() - t0 }); });
  });
}
const raw = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const out = (id) => { const f = path.join(WORK, `${id}.json`); outputs.push(f); return f; };
async function fixture(mode, seed) { const f = await startFixture({ seed }); fixtures.push(f); await f.setMode({ reset: true, resetClock: true, ...mode }); return f; }
const check = (label, ok, observed) => ({ label, pass: !!ok, observed });

// ── the cases ───────────────────────────────────────────────────────────────────────────────────────────
const assignArgs = (f, o, extra = []) => ['--site', 'fixture', '--origin', f.origin, '--gap-min', '0', '--gap-max', '0', '--out', o, ...extra];
const CASES = [
  // guards: nothing may load a live site in stage 1
  { id: 'G1', what: 'guard: J1.1 probe refuses walmart.com without --live', kind: 'negative', fn: async () => { const o = out('G1'); const r = await run('probe-j1-assign.mjs', ['--site', 'walmart', '--out', o]); return [check('exit code 3', r.code === 3, r.code), check('no output file', !fs.existsSync(o), fs.existsSync(o))]; } },
  { id: 'G2', what: 'guard: J1.2 probe refuses walmart.com without --live', kind: 'negative', fn: async () => { const o = out('G2'); const r = await run('probe-j1-cookies.mjs', ['--site', 'walmart', '--out', o]); return [check('exit code 3', r.code === 3, r.code), check('no output file', !fs.existsSync(o), fs.existsSync(o))]; } },
  { id: 'G3', what: 'guard: J1.3 init refuses walmart.com without --live', kind: 'negative', fn: async () => { const o = out('G3'); const st = path.join(WORK, 'G3-state'); const r = await run('probe-j1-history.mjs', ['init', '--site', 'walmart', '--state', st, '--out', o]); return [check('exit code 3', r.code === 3, r.code), check('no output file', !fs.existsSync(o), fs.existsSync(o))]; } },
  { id: 'G4', what: 'guard: J2 probe refuses priceline.com without --live', kind: 'negative', fn: async () => { const o = out('G4'); const t = path.join(WORK, 'G4-targets.json'); fs.writeFileSync(t, JSON.stringify({ sites: [{ id: 'priceline', url: 'https://www.priceline.com/', room: 'king' }] })); const r = await run('probe-j2-repeat.mjs', ['--targets', t, '--out', o]); return [check('exit code 3', r.code === 3, r.code), check('no output file', !fs.existsSync(o), fs.existsSync(o))]; } },

  // J1.1 / 1b / 1.4
  { id: 'A1', what: 'J1.1: a fair 50/50 cookie bucket, no device effect; J1.4 follow items (one follows the bucket, one has a single offer, one splits on its own)', kind: 'positive+negative', fn: async () => {
    const f = await fixture({ item: 'split-either', pLow: 0.5 }, 101); const o = out('A1');
    await run('probe-j1-assign.mjs', assignArgs(f, o, ['--follow', 'F1,F2,F3', '--follow-n', '12']));
    const a = analyzeAssign(raw(o));
    const hdr = deviceHeaders(f);
    return [check('two offers found', a.offers.length === 2, a.offers.map((x) => `${x.offerId}@${x.price}×${x.n}`)), check('verdict SPLIT-CONSISTENT-WITH-HALF', a.verdict === 'SPLIT-CONSISTENT-WITH-HALF', `${a.verdict} ${JSON.stringify(a.split)}`), check('10 observed per device', Object.values(a.perDevice).every((d) => d.n === 10), Object.fromEntries(Object.entries(a.perDevice).map(([k, v]) => [k, v.n]))),
      check('no device effect (negative control)', a.device.verdict === 'NO-DEVICE-EFFECT-DETECTED', a.device), check('no order effect', a.order.verdict === 'NO-ORDER-EFFECT-DETECTED', a.order), check('reloads sticky', a.stickiness.verdict === 'STICKY', a.stickiness),
      check('F1 follows the main bucket (positive)', a.follow.F1?.verdict === 'SPLIT-FOLLOWS-MAIN-BUCKET', a.follow.F1?.vsMainBucket), check('F2 single offer (negative)', /^NO-SPLIT/.test(a.follow.F2?.verdict || ''), a.follow.F2?.verdict), check('F3 splits independently', a.follow.F3?.verdict === 'SPLIT-NOT-SHOWN-TO-FOLLOW-MAIN-BUCKET', a.follow.F3?.vsMainBucket),
      ...hdr]; } },
  { id: 'A2', what: 'J1.1b: phones drawn into the cheap offer 90% of the time, desktops 10%', kind: 'positive', fn: async () => {
    const f = await fixture({ item: 'split-xpa', deviceBias: { mobile: 0.9, desktop: 0.1 } }, 102); const o = out('A2');
    await run('probe-j1-assign.mjs', assignArgs(f, o, ['--reload-every', '0']));
    const a = analyzeAssign(raw(o));
    return [check('device effect detected', a.device.verdict === 'DEVICE-ASSOCIATED', a.device), check('phone CIs above desktop CIs', a.perDevice['iphone-safari'].lo > a.perDevice['mac-chrome'].hi && a.perDevice['android-chrome'].lo > a.perDevice['win-chrome'].hi, a.perDevice)]; } },
  { id: 'A3', what: 'J1.1: one offer for everyone', kind: 'negative', fn: async () => {
    const f = await fixture({ item: 'none' }, 103); const o = out('A3');
    await run('probe-j1-assign.mjs', assignArgs(f, o, ['--per-device', '5']));
    const a = analyzeAssign(raw(o));
    return [check('verdict NO-SPLIT', a.verdict === 'NO-SPLIT', `${a.verdict}, unseen-offer upper bound ${a.unseenOfferUpperBound}`)]; } },
  { id: 'A4', what: 'J1.1: an uneven 90/10 bucket', kind: 'positive', fn: async () => {
    const f = await fixture({ item: 'split-xpa', pLow: 0.9 }, 104); const o = out('A4');
    await run('probe-j1-assign.mjs', assignArgs(f, o, ['--reload-every', '0']));
    const a = analyzeAssign(raw(o));
    return [check('verdict SPLIT-UNEVEN', a.verdict === 'SPLIT-UNEVEN', `${a.verdict} ${JSON.stringify(a.split)}`), check('no device effect', a.device.verdict === 'NO-DEVICE-EFFECT-DETECTED', a.device)]; } },
  { id: 'A5', what: 'walls: every 3rd page walled; walled profiles replaced; wall text kept without the IP', kind: 'guard', fn: async () => {
    const f = await fixture({ item: 'split-either', wallEvery: 3 }, 105); const o = out('A5');
    await run('probe-j1-assign.mjs', assignArgs(f, o, ['--per-device', '3', '--reload-every', '0']));
    const R = raw(o); const a = analyzeAssign(R); const s = fs.readFileSync(o, 'utf8');
    return [check('walls recorded as BLOCKED', a.blocked > 0, a.blocked), check('3 observed per device after replacement', Object.values(a.perDevice || {}).every((d) => d.n === 3), a.perDevice), check('wall text kept', R.records.some((r) => r.wall && /Access Denied/.test(r.wallText || '')), R.records.find((r) => r.wall)?.wallText), check('fake IP scrubbed', !s.includes(f.FAKE_IP), s.includes(f.FAKE_IP)), check('wall reference id scrubbed', s.includes('Reference #[ref]') && !s.includes('6f2a.1760000000'), (R.records.find((r) => r.wall)?.wallText || '').match(/Reference[^.]*\S{0,20}/)?.[0])]; } },
  { id: 'A6', what: 'stop rule: every page walled → cool off after 3, stop after the second run of 3', kind: 'guard', fn: async () => {
    const f = await fixture({ item: 'split-either', wallAll: true, wallKind: 'px' }, 106); const o = out('A6');
    await run('probe-j1-assign.mjs', assignArgs(f, o, ['--cooloff-ms', '300']));
    const end = raw(o).events.find((e) => e.type === 'end');
    return [check('stopped by the wall rule', /2 runs of 3 consecutive walls/.test(end?.stoppedBy || ''), end?.stoppedBy), check('exactly 6 loads', end?.loads === 6, end?.loads)]; } },
  { id: 'A8', what: 'stop rule: 7 of the first 10 pages walled, never 3 in a row → site BLOCKED at load 10', kind: 'guard', fn: async () => {
    const f = await fixture({ item: 'split-either', wallPattern: 'WWOWWOWWOW' }, 109); const o = out('A8');
    await run('probe-j1-assign.mjs', assignArgs(f, o, ['--cooloff-ms', '300', '--reload-every', '0']));
    const end = raw(o).events.find((e) => e.type === 'end');
    return [check('stopped as BLOCKED by the first-10 rule', /of the first 10 loads walled/.test(end?.stoppedBy || ''), end?.stoppedBy), check('exactly 10 loads', end?.loads === 10, end?.loads)]; } },
  { id: 'K1', what: 'calibration: the cart reader adds the item and SEES the cart empty', kind: 'guard', fn: async () => {
    const f = await fixture({ item: 'split-either' }, 110); const o = out('K1');
    await run('probe-calibrate.mjs', ['walmart-cart', '--site', 'fixture', '--origin', f.origin, '--out', o]);
    const v = raw(o).events.find((e) => e.type === 'end')?.verdict;
    return [check('verdict CART-OK', v === 'CART-OK', v), check('fixture cart left empty', [...f.state.carts.values()].every((x) => x.length === 0), [...f.state.carts.values()].map((x) => x.length))]; } },
  { id: 'K2', what: 'calibration: the hotel reader finds the registered room on an unmarked template', kind: 'guard', fn: async () => {
    const f = await fixture({ hotel: 'null', template: 'unmarked' }, 111); const o = out('K2');
    await run('probe-calibrate.mjs', ['hotel', '--url', `${f.origin}/hotel/K2`, '--room', 'standard king', '--out', o]);
    const v = raw(o).events.find((e) => e.type === 'end')?.verdict;
    return [check('verdict HOTEL-OK via heuristic', /^HOTEL-OK \(Standard King Room 189, via heuristic\)$/.test(v || ''), v)]; } },
  { id: 'A7', what: 'battery gate: on battery at 35% then 38% → pauses twice, resumes on AC', kind: 'guard', fn: async () => {
    const f = await fixture({ item: 'split-either' }, 107); const o = out('A7');
    await run('probe-j1-assign.mjs', assignArgs(f, o, ['--per-device', '1', '--reload-every', '0']), { J_PMSET_FAKE: 'Battery Power;35|Battery Power;38|AC Power;38', J_POWER_POLL_MS: '200' });
    const R = raw(o);
    return [check('two power pauses', R.events.filter((e) => e.type === 'power-pause').length === 2, R.events.filter((e) => e.type === 'power-pause').map((e) => `${e.source} ${e.pct}%`)), check('run completed afterwards', R.records.filter((r) => r.offerId).length === 4, R.records.filter((r) => r.offerId).length)]; } },

  { id: 'S1', what: 'J1.4 selection rule: skip the walmart.com-sold item every search lists first; admit three marketplace items', kind: 'guard', fn: async () => {
    const f = await fixture({ item: 'split-either' }, 108); const o = out('S1');
    await run('probe-j1-select.mjs', ['--site', 'fixture', '--origin', f.origin, '--gap-min', '0', '--gap-max', '0', '--out', o]);
    const R = raw(o); const ids = (R.meta.items || []).map((x) => x.item);
    return [check('three items admitted', ids.length === 3, ids), check('walmart.com-sold item never admitted', !ids.includes('7000001') && R.records.some((r) => r.item === '7000001' && r.admitted === false && r.walmartSold === true), ids), check('one item per query, in order', R.meta.items.map((x) => x.query).join('|') === R.meta.queries.slice(0, 3).join('|'), R.meta.items.map((x) => x.query))]; } },

  // J1.2
  ...[
    ['C1', 'split-xpa', 'one deciding cookie (xpa); nothing else carries the offer', (c) => [check('deciders = [xpa]', c.deciders.map((d) => d.name).join() === 'xpa', c.deciders.map((d) => d.name)), check('xpa carries alone', c.deciders[0]?.carriesAlone === 'yes', c.deciders[0]), check('then NO-FURTHER-CARRIER', c.verdict === 'NO-FURTHER-CARRIER', c.conclusion)]],
    ['C2', 'split-either', 'a deciding cookie (xpa) and a fallback carrier (vtc), like walmart.com\'s two subsets', (c) => [check('deciders = [xpa, vtc]', c.deciders.map((d) => d.name).join() === 'xpa,vtc', c.deciders.map((d) => d.name)), check('both carry alone', c.deciders.every((d) => d.carriesAlone === 'yes'), c.deciders.map((d) => d.carriesAlone)), check('then NO-FURTHER-CARRIER', c.verdict === 'NO-FURTHER-CARRIER', c.conclusion)]],
    ['C3', 'split-and', 'only the PAIR (xpa, vtc) carries the offer', (c) => [check('INTERACTION detected', c.verdict === 'INTERACTION', c.conclusion), check('minimal set = {vtc, xpa}', /\{(vtc, xpa|xpa, vtc)\}/.test(c.conclusion || ''), c.conclusion)]],
    ['C4', 'split-botmgr', 'the carrier is a bot-manager-class cookie, which is never transferred', (c) => [check('JAR-DOES-NOT-CARRY', c.verdict === 'JAR-DOES-NOT-CARRY', c.conclusion), check('_px3 listed as excluded', c.excludedBotManager.includes('_px3'), c.excludedBotManager)]],
    ['C5', 'none', 'one offer for everyone', (c) => [check('ONE-OFFER-ONLY', c.verdict === 'ONE-OFFER-ONLY', c.conclusion)]],
  ].map(([id, item, what, expect]) => ({ id, what: `J1.2: ${what}`, kind: item === 'none' || item === 'split-botmgr' ? 'negative' : 'positive', fn: async () => {
    const f = await fixture({ item }, 200 + Number(id.slice(1))); const o = out(id);
    await run('probe-j1-cookies.mjs', ['--site', 'fixture', '--origin', f.origin, '--gap-min', '0', '--gap-max', '0', '--donor-tries', item === 'none' ? '4' : '10', '--out', o]);
    return expect(analyzeCookies(raw(o)));
  } })),

  // J1.3
  { id: 'H1', what: 'J1.3: shopping changes nothing (negative control), run by the daemon on a compressed clock', kind: 'negative', fn: async () => {
    const f = await fixture({ item: 'split-xpa' }, 301); const o = out('H1'); const st = path.join(WORK, 'H1-state');
    await run('probe-j1-history.mjs', ['init', '--site', 'fixture', '--origin', f.origin, '--state', st, '--day-ms', '300', '--gap-min', '0', '--gap-max', '0', '--step-min', '0', '--step-max', '0', '--out', o]);
    await run('probe-j1-history.mjs', ['daemon', '--state', st]);
    const h = analyzeHistory(raw(o));
    return [check('verdict NO-CHANGE', h.verdict === 'NO-CHANGE', h.verdict), check('6 profiles, 2 shoppers + 1 control per bucket', h.profiles.length === 6 && h.profiles.filter((p) => p.role === 'shopper').length === 4, h.profiles.map((p) => `${p.id}:${p.bucket}/${p.role}`)), check('every reading taken', h.profiles.every((p) => p.observed === 6), h.profiles.map((p) => p.observed)), check('12 shopping sessions, every cart SEEN empty', h.cartSafety.sessions === 12 && h.cartSafety.sessionsSeenEmpty === 12 && h.cartSafety.adds === 12, h.cartSafety)]; } },
  { id: 'H2', what: 'J1.3: two cart sessions raise a visitor\'s price by $10 (planted history effect)', kind: 'positive', fn: async () => {
    const f = await fixture({ item: 'split-xpa', history: true }, 302); const o = out('H2'); const st = path.join(WORK, 'H2-state');
    await run('probe-j1-history.mjs', ['init', '--site', 'fixture', '--origin', f.origin, '--state', st, '--day-ms', '1', '--gap-min', '0', '--gap-max', '0', '--step-min', '0', '--step-max', '0', '--out', o]);
    await run('probe-j1-history.mjs', ['tick', '--state', st, '--through', 'swap']);
    const h = analyzeHistory(raw(o));
    return [check('verdict HISTORY-EFFECT', h.verdict === 'HISTORY-EFFECT', h.verdict), check('4 shoppers changed, 0 controls', h.shoppersChanged === 4 && h.controlsChanged === 0, [h.shoppersChanged, h.controlsChanged]), check('swaps carried', h.profiles.filter((p) => p.swap).every((p) => p.swap.carried === p.swap.copies), h.profiles.map((p) => p.swap))]; } },
  { id: 'H3', what: 'J1.3: the item is repriced for everyone mid-study (controls move too)', kind: 'negative', fn: async () => {
    const f = await fixture({ item: 'split-xpa' }, 303); const o = out('H3'); const st = path.join(WORK, 'H3-state');
    await run('probe-j1-history.mjs', ['init', '--site', 'fixture', '--origin', f.origin, '--state', st, '--day-ms', '1', '--gap-min', '0', '--gap-max', '0', '--step-min', '0', '--step-max', '0', '--out', o]);
    await run('probe-j1-history.mjs', ['tick', '--state', st, '--through', 'd1-pm']);
    await f.setMode({ globalBump: 5 });
    await run('probe-j1-history.mjs', ['tick', '--state', st, '--through', 'swap']);
    const h = analyzeHistory(raw(o));
    return [check('verdict GLOBAL-CHANGE (not HISTORY-EFFECT)', h.verdict === 'GLOBAL-CHANGE', h.verdict), check('controls changed too', h.controlsChanged === 2, h.controlsChanged)]; } },

  // J2
  ...[
    ['R1', 'null', 'marked', 0, 'nothing planted', (s) => [check('personal NONE-DETECTED', s.personal.verdict === 'NONE-DETECTED', s.personal), check('demand NONE-DETECTED', s.demand.verdict === 'NONE-DETECTED', s.demand)]],
    ['R2', 'noise', 'unmarked', 0, 'random ±$3 on every response, for everyone', (s) => [check('personal NONE-DETECTED', s.personal.verdict === 'NONE-DETECTED', s.personal), check('demand NONE-DETECTED', s.demand.verdict === 'NONE-DETECTED', s.demand), check('fresh dispersion flagged', s.freshDispersion.flag, s.freshDispersion)]],
    ['R3', 'repeat-cookie', 'marked', 0, '+$12 from a visitor\'s second view, counted on a cookie', (s) => [check('REPEAT-VIEW-EFFECT (carried by cookies)', s.personal.verdict === 'REPEAT-VIEW-EFFECT (carried by cookies)', s.personal), check('demand NONE-DETECTED', s.demand.verdict === 'NONE-DETECTED', s.demand), check('swap-C carries', s.swap.C.verdict === 'CARRIES', s.swap.C)]],
    ['R4', 'repeat-storage', 'unmarked', 0, '+$12 from the second view, counted in localStorage', (s) => [check('REPEAT-VIEW-EFFECT (carried by cookies + localStorage)', s.personal.verdict === 'REPEAT-VIEW-EFFECT (carried by cookies + localStorage)', s.personal), check('swap-C NOT carried', s.swap.C.verdict === 'NOT-CARRIED', s.swap.C), check('swap-CS carries', s.swap.CS.verdict === 'CARRIES', s.swap.CS)]],
    ['R5', 'demand', 'marked', 8000, '+$4 every slot for everyone (demand drift)', (s) => [check('demand RISING', s.demand.verdict === 'RISING', s.demand), check('personal NONE-DETECTED', s.personal.verdict === 'NONE-DETECTED', s.personal)]],
    ['R6', 'demand+repeat-cookie', 'unmarked', 8000, 'demand drift AND a repeat-view bump', (s) => [check('demand RISING', s.demand.verdict === 'RISING', s.demand), check('REPEAT-VIEW-EFFECT (carried by cookies)', s.personal.verdict === 'REPEAT-VIEW-EFFECT (carried by cookies)', s.personal)]],
    ['R7', 'bucket', 'marked', 0, 'a 50/50 visitor bucket (+$10), no repeat effect', (s) => [check('not called a repeat-view effect', !/^REPEAT-VIEW-EFFECT/.test(s.personal.verdict), s.personal.verdict), check('fresh dispersion flagged or VISITOR-BUCKET', s.freshDispersion.flag || s.personal.verdict === 'VISITOR-BUCKET', { dispersion: s.freshDispersion, verdict: s.personal.verdict })]],
    ['R8', 'null', 'unmarked', 0, 'every 4th page walled', (s, txt, f) => [check('walls recorded as BLOCKED', s.blocked > 0, s.blocked), check('not called a repeat-view effect', !/^REPEAT-VIEW-EFFECT/.test(s.personal.verdict), s.personal.verdict), check('fake IP scrubbed', !txt.includes(f.FAKE_IP), txt.includes(f.FAKE_IP))]],
  ].map(([id, hotel, template, slotMs, what, expect]) => ({ id, what: `J2: ${what}`, kind: hotel === 'null' || hotel === 'noise' || hotel === 'bucket' ? 'negative' : 'positive', fn: async () => {
    const f = await fixture({ hotel, template, slotMs: slotMs || 8000, noise: 3, hotelWallEvery: id === 'R8' ? 4 : 0 }, 400 + Number(id.slice(1))); const o = out(id);
    const t = path.join(WORK, `${id}-targets.json`);
    fs.writeFileSync(t, JSON.stringify({ sites: [template === 'marked' ? { id: `fx-${id}`, url: `${f.origin}/hotel/${id}`, room: 'standard king', cardSelector: '[data-testid="room-card"]', nameSelector: '[data-testid="room-name"]', priceSelector: '[data-testid="room-price"]' } : { id: `fx-${id}`, url: `${f.origin}/hotel/${id}`, room: 'standard king' }] }));
    await f.setMode({ resetClock: true });
    await run('probe-j2-repeat.mjs', ['--targets', t, '--slot-min', String(slotMs), '--slot-max', String(slotMs), '--pair-min', '0', '--pair-max', '0', '--cooloff-ms', '300', '--out', o]);
    const a = analyzeRepeat(raw(o));
    return expect(a[`fx-${id}`], fs.readFileSync(o, 'utf8'), f);
  } })),
];

function deviceHeaders(f) {
  const by = (re) => f.state.headers.filter((h) => re.test(h.ua || ''));
  const iph = by(/iPhone/), andr = by(/Android/), win = by(/Windows NT/), mac = by(/Macintosh/);
  const reps = f.state.reports;
  return [
    check('iPhone profile sends no client hints', iph.length && iph.every((h) => !h.ch && !h.chMobile && !h.chPlatform), iph.length),
    check('Android profile sends Sec-CH-UA-Mobile ?1, platform Android', andr.length && andr.every((h) => h.chMobile === '?1' && h.chPlatform === '"Android"'), andr[0]),
    check('Windows profile sends platform Windows', win.length && win.every((h) => h.chPlatform === '"Windows"' && h.chMobile === '?0'), win[0]?.chPlatform),
    check('Mac profile sends platform macOS', mac.length && mac.every((h) => h.chPlatform === '"macOS"'), mac[0]?.chPlatform),
    check('no "Headless" in any user agent', f.state.headers.every((h) => !/Headless/i.test(h.ua || '')), null),
    check('navigator.webdriver false on every page', reps.length && reps.every((r) => r.webdriver === false), reps.length),
    check('navigator.platform matches each profile', reps.every((r) => (/iPhone/.test(r.ua) ? r.platform === 'iPhone' : /Android/.test(r.ua) ? r.platform === 'Linux armv81' : /Windows/.test(r.ua) ? r.platform === 'Win32' : r.platform === 'MacIntel')), [...new Set(reps.map((r) => r.platform))]),
  ];
}

// ── run, then the global privacy checks ─────────────────────────────────────────────────────────────────
const todo = CASES.filter((k) => !ONLY.length || ONLY.includes(k.id));
const results = [];
const t0 = Date.now();
let next = 0;
await Promise.all(Array.from({ length: Math.min(JOBS, todo.length) }, async () => {
  while (next < todo.length) {
    const k = todo[next++];
    const s = Date.now();
    let checks;
    try { checks = await k.fn(); } catch (e) { checks = [check('case ran', false, String(e.stack || e).split('\n').slice(0, 3).join(' | '))]; }
    const r = { id: k.id, what: k.what, kind: k.kind, pass: checks.every((x) => x.pass), seconds: Math.round((Date.now() - s) / 1000), checks };
    results.push(r);
    console.error(`${r.pass ? 'PASS' : 'FAIL'} ${k.id} (${r.seconds}s) ${k.what}${r.pass ? '' : `\n   ${checks.filter((x) => !x.pass).map((x) => `${x.label}: ${JSON.stringify(x.observed)}`).join('\n   ')}`}`);
  }
}));
const issued = new Set(fixtures.flatMap((f) => [...f.state.issued]));
const files = outputs.filter((f) => fs.existsSync(f));
const leaks = { cookieValues: 0, fakeIp: 0, paths: 0, blockedNonLoopback: 0 };
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  for (const v of issued) if (s.includes(v)) leaks.cookieValues++;
  if (fixtures.some((x) => s.includes(x.FAKE_IP))) leaks.fakeIp++;
  if ([os.homedir(), os.tmpdir(), fs.realpathSync(os.tmpdir()), '/Users/'].some((p) => s.includes(p))) leaks.paths++;
  const end = JSON.parse(s).events?.find((e) => e.type === 'end');
  leaks.blockedNonLoopback += end?.nonLoopbackRequestsBlocked || 0;
}
const privacy = { id: 'P1', what: 'privacy: no fixture cookie value, IP address or local path in any output; no request left 127.0.0.1', kind: 'guard', checks: [check(`no cookie value in ${files.length} output files (${issued.size} values issued)`, leaks.cookieValues === 0, leaks.cookieValues), check('no fake IP', leaks.fakeIp === 0, leaks.fakeIp), check('no local path', leaks.paths === 0, leaks.paths), check('no non-loopback request', leaks.blockedNonLoopback === 0, leaks.blockedNonLoopback)] };
privacy.pass = privacy.checks.every((x) => x.pass);
results.push(privacy);
console.error(`${privacy.pass ? 'PASS' : 'FAIL'} P1 ${privacy.what} ${JSON.stringify(leaks)}`);

results.sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
const report = { ranAt: new Date().toISOString(), minutes: Math.round((Date.now() - t0) / 6000) / 10, headless: !HEADFUL, cases: results.length, passed: results.filter((r) => r.pass).length, failed: results.filter((r) => !r.pass).map((r) => r.id), results };
const dest = path.join(HERE, 'selftest', `selftest-${report.ranAt.slice(0, 10)}${ONLY.length ? `-only-${ONLY.join('_')}` : ''}.json`);
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, scrubText(JSON.stringify(report, null, 1)));
for (const f of fixtures) await f.close();
if (!argv.includes('--keep')) fs.rmSync(WORK, { recursive: true, force: true }); else console.error(`kept ${WORK}`);
console.error(`\n${report.passed}/${report.cases} passed in ${report.minutes} min → ${path.relative(process.cwd(), dest)}`);
process.exit(report.failed.length ? 1 : 0);
