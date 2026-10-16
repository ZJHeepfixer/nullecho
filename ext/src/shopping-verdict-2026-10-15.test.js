/**
 * 0.9.3 — the shopping lab's verdicts (`harness/shopping-verdict.mjs`), held to the cases that went wrong once.
 *
 * The lab decides whether the "Pricing & personalization" rules changed a price or broke a cart or a search on a real
 * page. Two of its verdict rules were wrong on 2026-10-15 and were caught only by attacking the lab:
 *   · a planted block took a search grid from 60 product links to 0 and the row read NOT-OURS, because the OFF side had
 *     also missed an unrelated add-to-cart;
 *   · an OFF page that loaded with no price at all made the ON side's price "a price OFF never read", and the row read FAIL.
 *
 * Run: `node --test` from `ext/`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { shoppingVerdict, compareShopping } from '../../harness/shopping-verdict.mjs';

const site = { key: 'shop-x', n: 99 };
const rec = (detail, extra = {}) => ({ ok: true, reasons: [], detail, pageErrors: [], personalizationHits: { hits: [] }, ...extra });
const page = ({ price = '10.00', visible = '10.00', atc = true, search = 40, cart = null } = {}) => ({
  declared: price === null ? null : { price, currency: 'USD', source: 'json-ld' },
  visible: visible === null ? null : { price: visible, text: `$${visible}` },
  atc: atc === null ? { attempted: false } : { attempted: true, ok: atc, cartTotal: cart },
  search: { ok: search > 0, count: search },
});
const pair = (round, off, on) => ({ round, off, on });

test('identical prices, cart and search in every pair: PASS', () => {
  const loads = [1, 2, 3].map((r) => pair(r, rec(page()), rec(page())));
  assert.equal(shoppingVerdict(site, loads).verdict, 'PASS');
});

test('ON reads a different declared price in every pair: FAIL, and the difference is listed', () => {
  const loads = [1, 2, 3].map((r) => pair(r, rec(page({ price: '10.00', visible: '10.00' })), rec(page({ price: '12.00', visible: '12.00' }))));
  const v = shoppingVerdict(site, loads);
  assert.equal(v.verdict, 'FAIL');
  assert.ok(v.priceNotes.some((n) => /DECLARED PRICE DIFFERS: OFF 10\.00 vs ON 12\.00/.test(n)));
});

test('a different CART price is a FAIL even when the page price agrees (a client-side price test)', () => {
  const loads = [1, 2, 3].map((r) => pair(r, rec(page({ cart: '10.00' })), rec(page({ cart: '14.00' }))));
  assert.equal(shoppingVerdict(site, loads).verdict, 'FAIL');
});

test('OFF disagrees with itself and ON only ever reads a price OFF also read: INCONCLUSIVE, never hidden', () => {
  const loads = [
    pair(1, rec(page({ price: '10.00', visible: '10.00' })), rec(page({ price: '12.00', visible: '12.00' }))),
    pair(2, rec(page({ price: '12.00', visible: '12.00' })), rec(page({ price: '12.00', visible: '12.00' }))),
    pair(3, rec(page({ price: '10.00', visible: '10.00' })), rec(page({ price: '10.00', visible: '10.00' }))),
  ];
  const v = shoppingVerdict(site, loads);
  assert.equal(v.verdict, 'INCONCLUSIVE');
  assert.ok(v.priceNotes.length > 0, 'the r1 difference must still be reported');
});

test('REGRESSION: a search grid lost ON is a FAIL even when OFF missed an unrelated add-to-cart', () => {
  // The planted-block control, 2026-10-15: gymshark search 60 → 0 links read NOT-OURS before the fix.
  const off = rec(page({ atc: false, search: 60 }), { ok: false, reasons: ['add-to-cart not confirmed'] });
  const on = rec(page({ atc: false, search: 0 }), { ok: false, reasons: ['add-to-cart not confirmed', 'search listed 0 product links'] });
  const v = shoppingVerdict(site, [pair(1, off, on)]);
  assert.equal(v.verdict, 'FAIL');
  assert.match(v.reason, /search: 60 product links OFF, 0 ON/);
});

test('REGRESSION: an OFF page that read no price is a failed measurement, not "a price OFF never read"', () => {
  // The seeded gate, 2026-10-15: harborfreight's OFF page loaded (HTTP 200) with no price, ON read $59.99 → FAIL.
  const off = rec(page({ price: null, visible: null, atc: false, search: 0 }), { ok: false, reasons: ['no declared or rendered price read'] });
  const on = rec(page({ price: '59.99', visible: '59.99', atc: false, search: 0 }), { ok: false, reasons: ['add-to-cart not confirmed'] });
  const v = shoppingVerdict(site, [pair(1, off, on)]);
  assert.notEqual(v.verdict, 'FAIL');
});

test('a price OFF read and ON did not read is still a loss (the reverse of the case above)', () => {
  const off = rec(page({ price: '59.99', visible: '59.99' }));
  const on = rec(page({ price: null, visible: null }), { ok: false });
  const v = shoppingVerdict(site, [pair(1, off, on)]);
  assert.equal(v.verdict, 'FAIL');
  assert.deepEqual(compareShopping(off.detail, on.detail).filter((d) => /none ON/.test(d)).length, 2);
});

test('walls: both sides walled is BLOCKED; walled ON only is FAIL', () => {
  const wall = { blocked: true, blockedEvidence: 'HTTP 403 — Access Denied', detail: {} };
  assert.equal(shoppingVerdict(site, [pair(1, wall, wall)]).verdict, 'BLOCKED');
  assert.equal(shoppingVerdict(site, [pair(1, rec(page()), wall)]).verdict, 'FAIL');
});

test('a load that did not finish is never compared: ON-only is FAIL, both sides is ERROR', () => {
  const err = { ok: false, error: 'timeout after 150000ms', detail: { trace: ['start@0s', 'atc@20s'] } };
  assert.equal(shoppingVerdict(site, [pair(1, rec(page()), err)]).verdict, 'FAIL');
  assert.equal(shoppingVerdict(site, [pair(1, err, err)]).verdict, 'ERROR');
});

test('add-to-cart lost ON in one pair of three is reported but not a FAIL; in two of three it is', () => {
  const ok = () => rec(page());
  const lost = () => rec(page({ atc: false }), { ok: false });
  const minority = shoppingVerdict(site, [pair(1, ok(), lost()), pair(2, ok(), ok()), pair(3, ok(), ok())]);
  assert.equal(minority.verdict, 'PASS');
  assert.ok(minority.functionalNotes.some((n) => /add-to-cart worked OFF, not ON/.test(n)));
  assert.equal(shoppingVerdict(site, [pair(1, ok(), lost()), pair(2, ok(), lost()), pair(3, ok(), ok())]).verdict, 'FAIL');
});
