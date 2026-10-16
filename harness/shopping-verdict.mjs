/**
 * Nullecho — the shopping lab's verdicts (0.9.3), pure: `harness/site-smoke.mjs` runs the pages, this file judges
 * the OFF/ON pairs, and `ext/src/shopping-verdict-2026-10-15.test.js` holds it to the cases that went wrong once.
 */

/** ON vs OFF for one pair of loads. Every price difference is reported, whatever its cause. */
export function compareShopping(off, on) {
  const out = [];
  const p = (x) => (x ? x.price : null);
  if (p(off.declared) !== null && p(on.declared) !== null && p(off.declared) !== p(on.declared)) out.push(`DECLARED PRICE DIFFERS: OFF ${p(off.declared)} vs ON ${p(on.declared)}`);
  if (p(off.declared) !== null && p(on.declared) === null) out.push(`declared price ${p(off.declared)} OFF, none ON`);
  if (p(off.visible) && p(on.visible) && p(off.visible) !== p(on.visible)) out.push(`RENDERED PRICE DIFFERS: OFF ${p(off.visible)} vs ON ${p(on.visible)}`);
  if (p(off.visible) && !p(on.visible)) out.push(`rendered price ${p(off.visible)} OFF, none ON`);
  if (off.atc && off.atc.cartTotal && on.atc && on.atc.cartTotal && off.atc.cartTotal !== on.atc.cartTotal) out.push(`CART PRICE DIFFERS: OFF ${off.atc.cartTotal} vs ON ${on.atc.cartTotal}`);
  if (off.atc && off.atc.ok && on.atc && on.atc.attempted && !on.atc.ok) out.push('add-to-cart worked OFF, not ON');
  if (off.search && off.search.ok && on.search && !on.search.ok && !on.search.blocked) out.push(`search: ${off.search.count} product links OFF, ${on.search.count} ON`);
  if (typeof off.render === 'number' && off.render > 0 && on.render === 0) out.push(`render: ${off.render} vendor-rendered elements OFF, 0 ON`);
  if (off.klaviyo && on.klaviyo && off.klaviyo.formNodes > 0 && !on.klaviyo.formNodes) out.push(`Klaviyo form rendered OFF (${off.klaviyo.formNodes} nodes), not ON`);
  return out;
}

export const uniq = (xs) => [...new Set(xs)];
const priceOf = (rec, k) => rec && rec.detail && rec.detail[k] ? rec.detail[k].price : null;
export const normErr = (e) => e.replace(/https?:\/\/\S+/g, (u) => u.replace(/[?#].*$/, '')).replace(/\d{3,}/g, '#').slice(0, 160);

/**
 * One verdict per shopping row from all its OFF/ON pairs.
 *   BLOCKED       walled in every pair, both sides (recorded, never evaded)
 *   FAIL          a wall ON only; or, in most pairs, ON lost add-to-cart / search / a vendor-rendered element / a
 *                 Klaviyo form that OFF had; or ON read a price OFF never read (declared, rendered, or cart)
 *   INCONCLUSIVE  ON's prices are all prices OFF also read, but OFF disagreed with itself (A/B or time noise)
 *   NOT-OURS      the page's own checks fail with the extension OFF too, and ON is no worse
 *   PASS          otherwise
 * Every price difference in every pair is listed in `priceNotes`, whatever the verdict.
 */
export function shoppingVerdict(site, loads) {
  const done = loads.filter((l) => l.off && l.on);
  const voided = done.filter((l) => l.off.void || l.on.void);
  const usable = done.filter((l) => !l.off.void && !l.on.void);
  const base = { pairs: done.length, summary: null, priceNotes: [], functionalNotes: [] };
  if (!usable.length) return { ...base, verdict: voided.length ? 'VOID' : 'SKIPPED', reason: voided.length ? 'every pair void (network or hidden tab)' : 'not run (runtime budget)' };
  const offWall = usable.filter((l) => l.off.blocked).length;
  const onWall = usable.filter((l) => l.on.blocked).length;
  // A load that errored (navigation failed, or the check ran out of time) measured only part of the page: it is
  // never compared. An ON-only error counts against the extension; an OFF-only or two-sided one is reported.
  const unwalled = usable.filter((l) => !l.off.blocked && !l.on.blocked);
  const both = unwalled.filter((l) => !l.off.error && !l.on.error);
  const onOnlyErr = unwalled.filter((l) => !l.off.error && l.on.error);
  const otherErr = unwalled.filter((l) => l.off.error);
  const s = {
    declaredOff: uniq(both.map((l) => priceOf(l.off, 'declared') ?? '—')), declaredOn: uniq(both.map((l) => priceOf(l.on, 'declared') ?? '—')),
    visibleOff: uniq(both.map((l) => priceOf(l.off, 'visible') ?? '—')), visibleOn: uniq(both.map((l) => priceOf(l.on, 'visible') ?? '—')),
    cartOff: uniq(both.map((l) => l.off.detail?.atc?.cartTotal ?? '—')), cartOn: uniq(both.map((l) => l.on.detail?.atc?.cartTotal ?? '—')),
    atcOff: both.map((l) => (l.off.detail?.atc?.attempted ? (l.off.detail.atc.ok ? '✓' : '✗') : '·')).join(''),
    atcOn: both.map((l) => (l.on.detail?.atc?.attempted ? (l.on.detail.atc.ok ? '✓' : '✗') : '·')).join(''),
    searchOff: both.map((l) => (l.off.detail?.search ? (l.off.detail.search.blocked ? 'W' : l.off.detail.search.count) : '·')).join('/'),
    searchOn: both.map((l) => (l.on.detail?.search ? (l.on.detail.search.blocked ? 'W' : l.on.detail.search.count) : '·')).join('/'),
    rulesFired: {}, tallyPersonalization: [], tallyTotal: [],
    newOnErrors: [], walls: { off: offWall, on: onWall },
  };
  for (const l of usable) {
    for (const h of l.on.personalizationHits?.hits || []) s.rulesFired[h.ruleId] = (s.rulesFired[h.ruleId] || 0) + 1;
    const t = l.on.detail?.productTally;
    if (t) { s.tallyPersonalization.push(t.byCategory?.personalization ?? 0); s.tallyTotal.push(t.total ?? 0); }
  }
  const offErrs = new Set(usable.flatMap((l) => (l.off.pageErrors || []).map(normErr)));
  s.newOnErrors = uniq(usable.flatMap((l) => (l.on.pageErrors || []).map(normErr)).filter((e) => !offErrs.has(e)));
  s.newOnPageErrors = s.newOnErrors.filter((e) => !/ERR_BLOCKED_BY_CLIENT/.test(e));
  const out = { ...base, summary: s };
  for (const l of onOnlyErr) out.functionalNotes.push(`r${l.round}: ON did not finish (${String(l.on.error).slice(0, 80)}; reached ${(l.on.detail?.trace || []).slice(-1)[0] || 'nothing'}), OFF did`);
  for (const l of otherErr) out.functionalNotes.push(`r${l.round}: not compared — OFF ${String(l.off.error).slice(0, 60)}${l.on.error ? `, ON ${String(l.on.error).slice(0, 60)}` : ''}`);
  if (!both.length && unwalled.length) {
    if (onOnlyErr.length) return { ...out, verdict: 'FAIL', reason: out.functionalNotes.slice(0, 2).join(' | ') };
    return { ...out, verdict: 'ERROR', reason: `no pair finished on both sides — ${out.functionalNotes.slice(0, 2).join(' | ')}` };
  }
  if (!both.length) {
    if (onWall && !offWall) return { ...out, verdict: 'FAIL', reason: `bot wall ON only, ${onWall}/${usable.length} pair(s): ${(usable.find((l) => l.on.blocked).on.blockedEvidence || '').slice(0, 120)}` };
    return { ...out, verdict: 'BLOCKED', reason: (usable.find((l) => l.off.blocked) || usable[0]).off.blockedEvidence || (usable[0].on.blockedEvidence || 'walled') };
  }
  for (const l of both) {
    for (const d of compareShopping(l.off.detail || {}, l.on.detail || {})) {
      (/PRICE DIFFERS|price .* none ON/.test(d) ? out.priceNotes : out.functionalNotes).push(`r${l.round}: ${d}`);
    }
  }
  const lostPairs = both.filter((l) => compareShopping(l.off.detail || {}, l.on.detail || {}).some((d) => !/PRICE DIFFERS/.test(d))).length + onOnlyErr.length;
  const offVaries = s.declaredOff.length > 1 || s.visibleOff.length > 1 || s.cartOff.length > 1;
  // Novel = a price ON read that OFF never read, judged only where OFF read that kind of price at all. An OFF side
  // that read NO price (a half-loaded or challenge page) is a failed measurement, not a different price (gate run
  // 2026-10-15: harborfreight's OFF page loaded with HTTP 200 and no price, and the row read FAIL).
  const onOnly = (on, off) => (off.some((p) => p !== '—') ? on.filter((p) => p !== '—' && !off.includes(p)) : []);
  const novelPrice = [...onOnly(s.declaredOn, s.declaredOff), ...onOnly(s.visibleOn, s.visibleOff), ...onOnly(s.cartOn, s.cartOff)];
  const allOffFail = both.every((l) => !l.off.ok);
  if (onWall && !offWall) return { ...out, verdict: 'FAIL', reason: `bot wall ON only in ${onWall}/${usable.length} pair(s)` };
  if (novelPrice.length) return { ...out, verdict: 'FAIL', reason: `ON read a price OFF never read: ${novelPrice.join(', ')} — ${out.priceNotes.slice(0, 2).join(' | ')}` };
  // A loss is a check that PASSED OFF and failed ON in the same pair, so it is the extension's whatever else OFF failed.
  // (Attacked 2026-10-15: with a block planted on Algolia and Constructor, gymshark's and jcpenney's search went
  // from 60 product links to 0 — and the row read NOT-OURS, because OFF had also missed an unrelated add-to-cart.)
  if (lostPairs * 2 > both.length + onOnlyErr.length) return { ...out, verdict: 'FAIL', reason: out.functionalNotes.slice(0, 3).join(' | ') };
  if (out.priceNotes.length && offVaries) return { ...out, verdict: 'INCONCLUSIVE', reason: `price varies with the extension OFF too (OFF ${s.declaredOff.join('/')}${s.visibleOff.length > 1 ? `, rendered ${s.visibleOff.join('/')}` : ''}) — ${out.priceNotes.slice(0, 2).join(' | ')}` };
  if (allOffFail && both.every((l) => !l.on.ok)) return { ...out, verdict: 'NOT-OURS', reason: `fails with the extension OFF too — off: ${(both[0].off.reasons || []).join('; ') || both[0].off.error || 'check failed'}` };
  const notes = [...out.priceNotes, ...out.functionalNotes];
  return { ...out, verdict: 'PASS', reason: notes.length ? `minority differences: ${notes.slice(0, 3).join(' | ')}` : '' };
}
