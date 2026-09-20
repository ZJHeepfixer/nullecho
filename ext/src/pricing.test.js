/**
 * Nullecho — price-disclosure observation tests
 * ═════════════════════════════════════════════
 * The feature this file guards reports **what a page displayed**. It never
 * reports a compliance verdict, because the one enforcement action on the
 * record makes that impossible: the New York Attorney General's 2026-01-08
 * letter to Maplebear/Instacart ruled a page NON-COMPLIANT that carried the
 * mandated sentence *exactly as the statute prints it* — it failed on
 * placement. A text match proves the words are present and proves nothing else.
 *
 * Every false-positive and false-negative case below is ported from the
 * read-only review at `docs/review-2026-09-19/pricing.md` (BLOCKER 2, 19
 * reproducing tests) and from its ⛔ ERRATUM, which voided the Maryland branch:
 * the proposed Md. Com. Law § 13-322 — and its `OR BY` string — was **struck by
 * amendment before passage**. Maryland enacted § 13-321 only, a food-retailer
 * ban with no wording. New Jersey is likewise a ban with no string. So there are
 * exactly TWO mandated sentences in the United States:
 *
 *   NY  GBL § 349-a          in force (enforced since 2025-11-10)
 *       "THIS PRICE WAS SET BY AN ALGORITHM USING YOUR PERSONAL DATA"
 *       Hard-coded. No alternative wording. The only exact-matchable string in
 *       force in the U.S.
 *
 *   CT  P.A. 26-130 § 11     effective 2027-07-01
 *       "THIS PRICE WAS INCREASED USING YOUR PERSONAL DATA"
 *       …"or a substantially similar disclosure". So an exact matcher can only
 *       ever find the canonical wording, and ABSENCE PROVES NOTHING.
 *
 * Run: `node --test` from `ext/`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import './pricing.js';

const P = globalThis.NullechoPricing;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXT = path.resolve(HERE, '..');
const read = (rel) => fs.readFileSync(path.join(EXT, rel), 'utf8');

const NY = P.LEVEL.NY;
const CT = P.LEVEL.CT;
const levelOf = (text) => P.findDisclosure(text)?.level ?? null;

// ═══════════════════════════════════════════════════════════════════════════
// 1 — the two sentences, exactly as enacted
// ═══════════════════════════════════════════════════════════════════════════

test('the two canonical sentences are the enacted text, verbatim', () => {
  // Verified 2026-09-19 against the NY AG's letter quoting § 349-a(2) and
  // against Conn. P.A. 26-130 § 11(b)(1) (2026PA-00130-R00HB-05563-PA.PDF).
  assert.equal(
    P.SENTENCES[NY],
    'this price was set by an algorithm using your personal data',
  );
  assert.equal(
    P.SENTENCES[CT],
    'this price was increased using your personal data',
  );
  assert.deepEqual(Object.keys(P.SENTENCES).sort(), [CT, NY].sort());
});

test('the struck Maryland string is not recognised as any state’s disclosure', () => {
  // ⛔ ERRATUM, 2026-09-19. `pdftotext` drops strikethrough; two agents read the
  // struck § 13-322 as live text. The state's own codified-statute endpoint is
  // the control: §13-321 returns text, §13-322 returns "File Not Found", and the
  // codified §§ 13-408(a)/13-411(a) name only 13-321. A detector with a Maryland
  // branch is matching a section that was struck before passage.
  assert.equal(
    levelOf('THIS PRICE WAS SET BY AN ALGORITHM OR BY USING YOUR PERSONAL DATA'),
    null,
    'the struck Maryland § 13-322 string is not any state’s law',
  );
  // …and it must not be quietly rescued into the New York branch either: the
  // inserted `OR BY` breaks New York's sentence, which is why the review's FN1
  // existed at all.
  assert.ok(!P.findDisclosure('THIS PRICE WAS SET BY AN ALGORITHM OR BY USING YOUR PERSONAL DATA'));
  // No live branch anywhere in the module carries it.
  assert.ok(!Object.values(P.SENTENCES).some((s) => /or by/.test(s)));
});

// ═══════════════════════════════════════════════════════════════════════════
// 2 — what fires: the real-world renderings
// ═══════════════════════════════════════════════════════════════════════════

test('WSJ form — standalone, all caps, trailing period', () => {
  // research/NY-349A-COMPLIANCE-SWEEP.md §3, observed formulation 1.
  assert.equal(
    levelOf('THIS PRICE WAS SET BY AN ALGORITHM USING YOUR PERSONAL DATA.'),
    NY,
  );
});

test('Instacart form — lower case, buried mid-sentence behind a colon', () => {
  // Quoted verbatim in the NY AG letter, p.3. This page was ruled
  // NON-COMPLIANT. We match the words; we say nothing about compliance.
  const t = 'New York law requires the following disclosure because certain prices '
    + 'and/or fees may vary based on randomized tests, we use personal information '
    + '(such as delivery address) to calculate fees, and we offer certain personalized '
    + 'incentives: this price was set by an algorithm using your personal data.';
  const hit = P.findDisclosure(t);
  assert.equal(hit.level, NY);
  assert.match(hit.matched, /^this price was set by an algorithm using your personal data$/i);
});

test('NEW YORK RESIDENTS preamble form', () => {
  // Observed formulation 2. The colon is a segment boundary, so the preamble is
  // not part of the match — but the mandated sentence that follows it is.
  assert.equal(
    levelOf('NEW YORK RESIDENTS: PLEASE NOTE THAT WE ARE REQUIRED TO INFORM YOU THAT '
      + 'THIS PRICE WAS SET BY AN ALGORITHM USING YOUR PERSONAL DATA.'),
    NY,
  );
});

test('the Connecticut canonical sentence resolves to ct-style-language', () => {
  assert.equal(levelOf('THIS PRICE WAS INCREASED USING YOUR PERSONAL DATA'), CT);
});

test('New York and Connecticut never collide — neither sentence contains the other', () => {
  assert.equal(levelOf(P.SENTENCES[NY]), NY);
  assert.equal(levelOf(P.SENTENCES[CT]), CT);
  assert.ok(!P.SENTENCES[NY].includes(P.SENTENCES[CT]));
  assert.ok(!P.SENTENCES[CT].includes(P.SENTENCES[NY]));
});

// ═══════════════════════════════════════════════════════════════════════════
// 3 — FALSE NEGATIVES the review reproduced (FN4, FN5) — all must now match
// ═══════════════════════════════════════════════════════════════════════════

test('FN4 — split across two block elements, so innerText inserts a newline', () => {
  assert.equal(
    levelOf('THIS PRICE WAS SET BY AN\nALGORITHM USING YOUR PERSONAL DATA'),
    NY,
  );
});

test('FN5 — non-breaking spaces in &nbsp;-joined legal boilerplate', () => {
  assert.equal(
    levelOf('THIS PRICE WAS SET BY AN ALGORITHM'
      + ' USING YOUR PERSONAL DATA'),
    NY,
  );
});

test('soft hyphens and zero-width characters do not defeat the match', () => {
  assert.equal(
    levelOf('THIS PRICE WAS SET BY AN AL­GO​RITHM USING YOUR PER⁠SONAL DATA'),
    NY,
  );
});

test('curly quotes around the sentence do not defeat the match', () => {
  assert.equal(
    levelOf('“THIS PRICE WAS SET BY AN ALGORITHM USING YOUR PERSONAL DATA”'),
    NY,
  );
});

test('runs of mixed whitespace collapse', () => {
  assert.equal(
    levelOf('this   price\t was \r\n set  by an algorithm using your personal data'),
    NY,
  );
});

test('mixed case and a stray comma inside the sentence still match', () => {
  assert.equal(
    levelOf('This Price Was Set By An Algorithm, Using Your Personal Data'),
    NY,
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// 4 — FALSE POSITIVES the review reproduced (FP1–FP6) — none may match
// ═══════════════════════════════════════════════════════════════════════════

test('FP4 — the bare anchor "using your personal data" is never matched', () => {
  // D16 calls this "the one substring that survives all three strings". It also
  // survives every GDPR/CCPA privacy policy on the web, i.e. the site footer of
  // nearly every commercial page the extension will ever see.
  for (const prose of [
    'We take great care in protecting your privacy when using your personal data.',
    'You may withdraw consent to our using your personal data at any time.',
    'The lawful bases for using your personal data are set out below.',
    'We stop using your personal data when you close your account.',
  ]) {
    assert.equal(levelOf(prose), null, prose);
  }
});

test('FP1 — the Nieman Lab headline "This price was set by an algorithm" does not fire', () => {
  assert.equal(levelOf('This price was set by an algorithm'), null);
  assert.equal(
    levelOf('This price was set by an algorithm | Nieman Journalism Lab'),
    null,
  );
});

test('FP5 — "personalized algorithmic pricing" is a defined TERM, not a mandated string', () => {
  assert.equal(
    levelOf('Our pricing team does not use personalized algorithmic pricing.'),
    null,
  );
});

test('FP6 — the sentence may not be assembled across a sentence boundary', () => {
  // The unbounded /NEW YORK RESIDENTS:.*required to inform you/ regex joined two
  // unrelated sentences on one flattened line. Sentence-terminating punctuation
  // is a hard barrier here, so the same construction cannot be assembled.
  assert.equal(
    levelOf('The fare was set by an algorithm. Using your personal data, we then '
      + 'apply a loyalty discount.'),
    null,
  );
  assert.equal(
    levelOf('NEW YORK RESIDENTS: see our state notices page. We are required to '
      + 'inform you of your rights under the CCPA.'),
    null,
  );
});

test('a privacy policy page with the anchor in four places stays silent', () => {
  const policy = [
    'Privacy Policy',
    'We are required to inform you about our processing.',
    'This section explains the lawful bases for using your personal data.',
    'Prices on this site are set by an algorithm that considers demand and inventory.',
    'You can object to us using your personal data for marketing.',
  ].join('\n');
  assert.equal(levelOf(policy), null);
});

test('a cookie banner mentioning personal data stays silent', () => {
  assert.equal(
    levelOf('We and our 812 partners store and access personal data on your device. '
      + 'You can accept, reject, or manage your choices at any time.'),
    null,
  );
});

test('a law-firm client alert quoting only the anchor stays silent', () => {
  assert.equal(
    levelOf('Under the new statute, merchants that price using your personal data may '
      + 'need to post a notice. Our team can help you assess exposure.'),
    null,
  );
});

test('a legal blog quoting the statute DOES match the words — and that is why price context is separate', () => {
  // Honest limit, stated as a test rather than hidden. A news article or a law
  // firm quoting § 349-a in full contains the mandated sentence; no text matcher
  // can distinguish a quotation from a price display. The price-context gate in
  // §5 below — not the matcher — is what keeps the notice off these pages.
  const article = 'The statute requires the words "THIS PRICE WAS SET BY AN ALGORITHM '
    + 'USING YOUR PERSONAL DATA" to appear near every price.';
  assert.equal(levelOf(article), NY);
  assert.equal(P.priceContext({ jsonLd: [], microdata: [], meta: {} }), null);
});

test('a price commented out of the markup is not a price context', () => {
  // The attack: hide a JSON-LD price inside an HTML comment so the page reads as
  // a product page without being one. A comment is not an element, so the
  // `script[type="application/ld+json"]` query never returns it — and if the raw
  // text did somehow arrive here, it is not JSON and is discarded.
  const commented = '<!-- {"@type":"Offer","price":"19.99","priceCurrency":"USD"} -->';
  assert.equal(P.priceContext({ jsonLd: [commented] }), null);
});

// ═══════════════════════════════════════════════════════════════════════════
// 4b — the attack pass: trying to break it on purpose
// ═══════════════════════════════════════════════════════════════════════════
//
// Written after the implementation, by trying to make it fire where it must not
// and miss where it must not. Two genuine misses came out of it, and both are
// recorded here as passing tests rather than left for someone to find later.

test('ATTACK — concatenation with no whitespace at all is NOT a match', () => {
  // `<b>THIS PRICE WAS SET BY AN</b><span>ALGORITHM …</span>` renders as
  // "…SET BY ANALGORITHM…" with no space — inline elements do not introduce
  // one. A reader does not see the mandated sentence there, so neither do we.
  // This is a deliberate MISS, and it is the right answer to "what did this
  // page display".
  assert.equal(
    levelOf('THIS PRICE WAS SET BY ANALGORITHM USING YOUR PERSONAL DATA'),
    null,
  );
});

test('ATTACK — a paragraph break may not be used to assemble the sentence', () => {
  // `innerText` emits two newlines around a <p>. A headline that ends
  // "…set by an algorithm" followed by a paragraph that opens "Using your
  // personal data…" is the Nieman Lab shape, and it must not assemble.
  assert.equal(
    levelOf('This price was set by an algorithm\n\nUsing your personal data, we '
      + 'estimate demand and set a rate.'),
    null,
  );
  // …but a SINGLE newline, which is what two <div>s produce, still matches.
  assert.equal(
    levelOf('This price was set by an algorithm\nusing your personal data'),
    NY,
  );
});

test('ATTACK — the sentence may not be assembled across a list or a table row', () => {
  assert.equal(levelOf('THIS PRICE WAS SET BY AN ALGORITHM;\n\nUSING YOUR PERSONAL DATA'), null);
  assert.equal(levelOf('• This price was set by an algorithm\n\n• Using your personal data'), null);
});

test('ATTACK — a legal blog, a cookie banner and a footer, all with the anchors', () => {
  const blog = 'Merchants pricing using your personal data should review placement. '
    + 'Our view: the statute is about where the notice sits.';
  const banner = 'We and our partners process personal data. Prices are set by an '
    + 'algorithm; using your personal data is optional.';
  const footer = 'Terms · Privacy · Do not sell my personal information · '
    + 'Learn how we are using your personal data';
  for (const t of [blog, banner, footer]) assert.equal(levelOf(t), null, t);
});

test('ATTACK — a case-folding trick does not open a new door', () => {
  // Turkish dotted capital I folds to two code points. The map has to survive
  // that, or the quoted "as displayed" text would be cut in the wrong place.
  const t = 'THİS PRICE WAS SET BY AN ALGORITHM USING YOUR PERSONAL DATA';
  assert.equal(levelOf(t), null, 'a different letter is a different word');
  const ok = 'THIS PRİCE WAS SET BY AN ALGORITHM USING YOUR PERSONAL DATA'.replace('İ', 'I');
  assert.equal(levelOf(ok), NY);
});

test('ATTACK — a 400 KB page of prose does not hang or overflow the context', () => {
  const noise = 'We value your privacy and the lawful bases for using your personal data. ';
  const page = noise.repeat(5200) + 'THIS PRICE WAS SET BY AN ALGORITHM USING YOUR PERSONAL DATA.';
  const t0 = Date.now();
  const hit = P.findDisclosure(page);
  assert.equal(hit.level, NY);
  assert.ok(hit.context.length <= P.MAX_CONTEXT);
  assert.ok(Date.now() - t0 < 500, 'the matcher should be linear, not pathological');
});

test('ATTACK — a hostile "price" cannot put arbitrary text in a receipt', () => {
  const ld = JSON.stringify({ '@type': 'Offer', price: 'CALL 1-800-CLICK-HERE NOW', priceCurrency: 'USD' });
  assert.equal(P.priceContext({ jsonLd: [ld] }), null);
  const ld2 = JSON.stringify({ '@type': 'Offer', price: '19.99 <script>alert(1)</script>' });
  assert.equal(P.priceContext({ jsonLd: [ld2] }), null);
});

// ═══════════════════════════════════════════════════════════════════════════
// 5 — PRICE CONTEXT: the false-positive guard for news and legal pages
// ═══════════════════════════════════════════════════════════════════════════

test('JSON-LD Offer price is extracted', () => {
  const ld = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Widget',
    offers: { '@type': 'Offer', price: '19.99', priceCurrency: 'USD' },
  });
  assert.deepEqual(P.priceContext({ jsonLd: [ld] }), {
    price: '19.99', currency: 'USD', source: 'json-ld',
  });
});

test('JSON-LD priceSpecification is extracted', () => {
  const ld = JSON.stringify({
    '@type': 'Offer',
    priceSpecification: { '@type': 'UnitPriceSpecification', price: 42, priceCurrency: 'EUR' },
  });
  assert.deepEqual(P.priceContext({ jsonLd: [ld] }), {
    price: '42', currency: 'EUR', source: 'json-ld',
  });
});

test('JSON-LD inside @graph is found', () => {
  const ld = JSON.stringify({
    '@graph': [
      { '@type': 'WebPage' },
      { '@type': 'Product', offers: [{ price: '7.50', priceCurrency: 'GBP' }] },
    ],
  });
  assert.equal(P.priceContext({ jsonLd: [ld] })?.price, '7.50');
});

test('malformed JSON-LD is ignored, not thrown', () => {
  assert.equal(P.priceContext({ jsonLd: ['{not json'] }), null);
});

test('microdata itemprop=price is extracted when there is no JSON-LD', () => {
  assert.deepEqual(
    P.priceContext({ microdata: [{ value: '$24.00', currency: 'USD' }] }),
    { price: '24.00', currency: 'USD', source: 'microdata' },
  );
});

test('og:price:amount / product:price:amount are extracted', () => {
  assert.deepEqual(
    P.priceContext({ meta: { amount: '12.00', currency: 'usd' } }),
    { price: '12.00', currency: 'USD', source: 'meta' },
  );
});

test('JSON-LD wins over microdata which wins over meta', () => {
  const ld = JSON.stringify({ '@type': 'Offer', price: '1.00', priceCurrency: 'USD' });
  assert.equal(P.priceContext({
    jsonLd: [ld],
    microdata: [{ value: '2.00' }],
    meta: { amount: '3.00' },
  }).price, '1.00');
});

test('a non-numeric or absurd price is rejected rather than reported', () => {
  assert.equal(P.priceContext({ meta: { amount: 'call for pricing' } }), null);
  assert.equal(P.priceContext({ microdata: [{ value: '' }] }), null);
  assert.equal(P.priceContext({ jsonLd: [JSON.stringify({ price: null })] }), null);
});

test('an empty page carries no price context', () => {
  assert.equal(P.priceContext({}), null);
  assert.equal(P.priceContext({ jsonLd: [], microdata: [], meta: {} }), null);
});

// ═══════════════════════════════════════════════════════════════════════════
// 6 — the matched text, as displayed
// ═══════════════════════════════════════════════════════════════════════════

test('the match reports the sentence as the page displayed it, not the normalized form', () => {
  const hit = P.findDisclosure('Fine print. THIS PRICE WAS SET BY AN ALGORITHM USING YOUR '
    + 'PERSONAL DATA. Terms apply.');
  assert.equal(hit.matched, 'THIS PRICE WAS SET BY AN ALGORITHM USING YOUR PERSONAL DATA');
});

test('the context is capped at 200 characters', () => {
  const pad = 'x'.repeat(2000);
  const hit = P.findDisclosure(`${pad} this price was set by an algorithm using your personal data ${pad}`);
  assert.ok(hit.context.length <= P.MAX_CONTEXT, `context ${hit.context.length} chars`);
  assert.ok(hit.context.includes('set by an algorithm'));
});

test('the context is a single line — a receipt is pasted into an email', () => {
  const hit = P.findDisclosure('Heading\n\nTHIS PRICE WAS SET BY AN\nALGORITHM USING YOUR PERSONAL DATA\n\nFooter');
  assert.ok(!/[\r\n]/.test(hit.context));
});

// ═══════════════════════════════════════════════════════════════════════════
// 7 — the receipt: local only, FIFO-capped, pasteable
// ═══════════════════════════════════════════════════════════════════════════

test('the stored URL carries no query string', () => {
  assert.equal(
    P.urlWithoutQuery('https://shop.example.com/p/widget?utm_source=x&session=abc#frag'),
    'https://shop.example.com/p/widget',
  );
  assert.equal(P.urlWithoutQuery('not a url'), '');
});

test('an observation records exactly the documented fields and nothing else', () => {
  const entry = P.observation({
    siteKey: 'example.com',
    url: 'https://example.com/p/1?q=secret',
    level: NY,
    price: '19.99',
    currency: 'USD',
    context: 'this price was set by an algorithm using your personal data',
    now: 1_758_300_000_000,
  });
  assert.deepEqual(Object.keys(entry).sort(), [
    'context', 'currency', 'level', 'price', 'siteKey', 'timestamp', 'url',
  ]);
  assert.equal(entry.url, 'https://example.com/p/1', 'the query string never reaches storage');
  assert.equal(entry.timestamp, 1_758_300_000_000);
});

test('the receipt list is FIFO-capped', () => {
  let list = [];
  for (let i = 0; i < P.RECEIPT_CAP + 25; i++) {
    list = P.pushReceipt(list, P.observation({
      siteKey: 'a.example', url: `https://a.example/${i}`, level: NY, context: 'x', now: i,
    }));
  }
  assert.equal(list.length, P.RECEIPT_CAP);
  assert.equal(list[0].url, `https://a.example/25`, 'oldest entries drop first');
  assert.equal(list[list.length - 1].url, `https://a.example/${P.RECEIPT_CAP + 24}`);
});

test('re-observing the same page and price replaces rather than piles up', () => {
  const mk = (now) => P.observation({
    siteKey: 'a.example', url: 'https://a.example/p', level: NY, price: '9.99',
    currency: 'USD', context: 'c', now,
  });
  let list = P.pushReceipt([], mk(1));
  list = P.pushReceipt(list, mk(2));
  assert.equal(list.length, 1, 'the ~3s SPA re-scan must not double the list');
  assert.equal(list[0].timestamp, 2);
});

test('a changed price on the same URL is a NEW observation', () => {
  const mk = (price, now) => P.observation({
    siteKey: 'a.example', url: 'https://a.example/p', level: NY, price,
    currency: 'USD', context: 'c', now,
  });
  let list = P.pushReceipt([], mk('9.99', 1));
  list = P.pushReceipt(list, mk('14.99', 2));
  assert.equal(list.length, 2);
});

test('the receipt text carries the disclaimer sentence verbatim', () => {
  const text = P.receiptText(P.observation({
    siteKey: 'shop.example',
    url: 'https://shop.example/p/widget?ref=1',
    level: NY,
    price: '19.99',
    currency: 'USD',
    context: 'this price was set by an algorithm using your personal data',
    now: Date.UTC(2026, 8, 19, 18, 42, 0),
  }));
  assert.ok(text.includes(
    'Observed by the Nullecho browser extension; this is a record of what the '
    + 'page displayed, not a legal conclusion.',
  ));
  assert.ok(text.includes('https://shop.example/p/widget'));
  assert.ok(!text.includes('ref=1'));
  assert.ok(text.includes('2026-09-19'));
  assert.ok(text.includes('19.99'));
  assert.ok(text.includes('USD'));
  assert.ok(text.includes('this price was set by an algorithm using your personal data'));
});

test('the receipt text names the wording without naming a verdict', () => {
  const ny = P.receiptText(P.observation({
    siteKey: 's', url: 'https://s.example/', level: NY, context: 'c', now: 0,
  }));
  const ct = P.receiptText(P.observation({
    siteKey: 's', url: 'https://s.example/', level: CT, context: 'c', now: 0,
  }));
  assert.match(ny, /New York/);
  assert.match(ct, /Connecticut/);
  assert.match(ct, /2027/, 'the Connecticut receipt has to date itself');
  for (const t of [ny, ct]) {
    for (const banned of ['compliant', 'violation', 'illegal', 'you are protected']) {
      assert.ok(!t.toLowerCase().includes(banned), `receipt says "${banned}"`);
    }
  }
});

test('a receipt with no price observed says so rather than printing an empty field', () => {
  const text = P.receiptText(P.observation({
    siteKey: 's', url: 'https://s.example/', level: NY, context: 'c', now: 0,
  }));
  assert.ok(!/Price[^\n]*:\s*$/m.test(text));
  assert.match(text, /no machine-readable price/i);
});

// ═══════════════════════════════════════════════════════════════════════════
// 8 — the module cannot transmit anything, and says nothing to the console
// ═══════════════════════════════════════════════════════════════════════════

test('pricing.js and pricing-scan.js contain no egress API and no console call', () => {
  // `manifest.test.js` already fails the build for the whole tree; this is the
  // local, specific version, because THIS module is the one that holds page text
  // and a price. It must be impossible for it to leave the machine (D15, and the
  // Firefox `data_collection_permissions: ["none"]` declaration), and it must be
  // silent in the page (D33 — the shim never writes to the page console).
  for (const rel of ['src/pricing.js', 'src/pricing-scan.js']) {
    const src = read(rel);
    for (const re of [
      /\bfetch\s*\(/, /\bXMLHttpRequest\b/, /sendBeacon/, /new\s+WebSocket/,
      /new\s+EventSource/, /importScripts/, /chrome\.storage\.sync/,
      /navigator\.clipboard/,
    ]) {
      assert.ok(!re.test(src), `${rel} matches ${re}`);
    }
    assert.ok(!/console\s*\./.test(src), `${rel} writes to a console (D33)`);
  }
});

test('the scan reads what the page RENDERED, never the markup or the hidden tree', () => {
  const src = read('src/pricing-scan.js');
  assert.ok(/\binnerText\b/.test(src));
  for (const worse of [/\binnerHTML\b/, /\bouterHTML\b/, /body\s*\.\s*textContent\b/]) {
    assert.ok(!worse.test(src), `${worse} would report text the user never saw`);
  }
});

test('the scan runs the CHEAP price-context check before it ever forces layout', () => {
  // Read the body of `scan()` rather than the whole file, so a doc comment that
  // mentions the expensive call first cannot make this pass or fail by accident.
  const src = read('src/pricing-scan.js');
  const body = src.slice(src.indexOf('function scan()'));
  const ctxAt = body.indexOf('collectPriceContext()');
  const textAt = body.indexOf('renderedText()');
  assert.ok(ctxAt > -1 && textAt > -1, 'both calls should be in scan()');
  assert.ok(ctxAt < textAt, 'the layout-forcing read may only run behind the price gate');
  assert.match(
    body.slice(ctxAt, textAt + 40),
    /price\s*\?\s*renderedText\(\)/,
    'the rendered-text read must be guarded by the price context, not merely ordered after it',
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// 9 — UI copy: the banned-phrase list, enforced mechanically
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Banned outright in this feature's user-facing copy. Each one turns an
 * observation into a verdict, and the NY AG's Instacart letter is the proof that
 * we cannot support a verdict: a page carrying the exact sentence was ruled
 * non-compliant on placement.
 *
 * Note "required" is banned and "requires" is not, and the distinction is
 * deliberate, not an oversight. "New York law **requires** that sentence when a
 * price was set by an algorithm using your personal data" is a statement about
 * the statute and is true. "A disclosure was **required** here" is a statement
 * about this page and this merchant, which is exactly the claim we cannot make.
 */
const BANNED = [
  'compliant', 'non-compliant', 'noncompliant', 'violation', 'illegal',
  'required', 'you are protected', 'failed to disclose', 'missing disclosure',
  'should have disclosed', 'breaking the law', 'unlawful',
];

/** Text between two markers, so the extraction cannot silently drift. */
function between(rel, open, close) {
  const src = read(rel);
  const a = src.indexOf(open);
  assert.ok(a > -1, `${rel}: marker "${open}" is missing`);
  const b = src.indexOf(close, a + open.length);
  assert.ok(b > -1, `${rel}: marker "${close}" is missing`);
  return src.slice(a + open.length, b);
}

/** The copy surfaces this feature owns. */
function pricingCopy() {
  return [
    ['linkage.js notice card', between(
      'src/linkage.js', 'PRICE-DISCLOSURE NOTICE — copy begins', 'PRICE-DISCLOSURE NOTICE — copy ends',
    )],
    ['pricing.js receipt', between(
      'src/pricing.js', 'RECEIPT TEXT — copy begins', 'RECEIPT TEXT — copy ends',
    )],
    ['options explainer', between(
      'options/options.html', '<section class="card" id="pricing">', '</section>',
    )],
    ['popup notice panel', between(
      'popup/popup.html', '<section class="panel" id="pricing-panel"', '</section>',
    )],
  ];
}

test('no banned phrase appears in any user-facing string this feature ships', () => {
  for (const [label, text] of pricingCopy()) {
    const lower = text.toLowerCase();
    for (const banned of BANNED) {
      assert.ok(
        !lower.includes(banned),
        `${label} contains the banned phrase "${banned}" — see docs/THREAT-MODEL.md `
        + 'and the NY AG Instacart letter: presence of the sentence is not compliance',
      );
    }
  }
});

test('the copy never names a state that has no mandated string', () => {
  // The brief's §6 correction: "Maryland and New Jersey: nothing to detect."
  // A count of states is also banned — it has been wrong twice.
  for (const [label, text] of pricingCopy()) {
    assert.ok(
      !/\bTHIS PRICE WAS SET BY AN ALGORITHM OR BY\b/i.test(text),
      `${label} quotes the struck Maryland string`,
    );
    assert.ok(
      !/(?:two|three|four|2|3|4)\s+states\s+(?:have|now|require)/i.test(text),
      `${label} counts states — that count has been wrong twice`,
    );
  }
});

test('the Connecticut copy always carries its date and its "other wording" caveat', () => {
  const card = between(
    'src/linkage.js', 'PRICE-DISCLOSURE NOTICE — copy begins', 'PRICE-DISCLOSURE NOTICE — copy ends',
  );
  assert.match(card, /2027/);
  assert.match(card, /substantially similar|other wording|different wording/i);
});

// ═══════════════════════════════════════════════════════════════════════════
// 10 — protocol + manifest wiring
// ═══════════════════════════════════════════════════════════════════════════

test('the scan is declared in BOTH manifests: ISOLATED, document_idle, top frame only', () => {
  for (const name of ['manifest.json', 'manifest.firefox.json']) {
    const m = JSON.parse(read(name));
    const entry = m.content_scripts.find((s) => s.js.includes('src/pricing-scan.js'));
    assert.ok(entry, `${name} does not declare the pricing scan`);
    assert.deepEqual(entry.js, ['src/pricing.js', 'src/pricing-scan.js'],
      `${name}: the pure module must load first, in the same isolated world`);
    assert.equal(entry.world ?? 'ISOLATED', 'ISOLATED', `${name}: never the page realm`);
    assert.equal(entry.run_at, 'document_idle', `${name}: there is no rendered text before idle`);
    assert.equal(entry.all_frames, false, `${name}: a price in an ad iframe is not this page's price`);
    assert.deepEqual(entry.matches, ['http://*/*', 'https://*/*']);
    assert.ok(!('match_origin_as_fallback' in entry) && !('match_about_blank' in entry),
      `${name}: about:blank has no price`);
  }
});

test('the pricing message types are namespaced and distinct from MSG', async () => {
  const { MSG, PRICING_MSG } = await import('./protocol.js');
  const shell = new Set(Object.values(MSG));
  for (const type of Object.values(PRICING_MSG)) {
    assert.match(type, /^nullecho:pricing:/);
    assert.ok(!shell.has(type), `${type} would be routed to handleShell, which knows nothing about it`);
  }
});

test('the content script inlines the message literals, and protocol.js knows it does', async () => {
  const { CONTENT_SCRIPT_LITERALS, PRICING_MSG } = await import('./protocol.js');
  const declared = CONTENT_SCRIPT_LITERALS['src/pricing-scan.js'];
  assert.ok(declared, 'pricing-scan.js is a CLASSIC script — its literals must be registered');
  assert.equal(declared.MSG_PRICING_OBSERVED, PRICING_MSG.OBSERVED);
  const src = read('src/pricing-scan.js');
  assert.ok(src.includes(`'${PRICING_MSG.OBSERVED}'`));
});

test('the feature owns exactly one storage key, named once, in protocol.js', async () => {
  const { PRICING_STORAGE_KEY } = await import('./protocol.js');
  assert.equal(PRICING_STORAGE_KEY, 'pricingObservations');

  // The key is never spelled out anywhere but protocol.js — that is what makes
  // "one key" checkable, and what keeps PRIVACY-POLICY.md's list honest.
  for (const rel of ['src/background.js', 'src/pricing.js', 'src/pricing-scan.js',
    'popup/popup.js', 'options/options.js']) {
    assert.ok(
      !read(rel).includes(`'${PRICING_STORAGE_KEY}'`),
      `${rel} spells the storage key out instead of importing PRICING_STORAGE_KEY`,
    );
  }

  const bg = read('src/background.js');
  assert.ok(bg.includes('PRICING_STORAGE_KEY'), 'background.js must own the key');
  assert.equal(
    [...bg.matchAll(/storage\.local\.set\(\{\s*\[PRICING_STORAGE_KEY\]/g)].length, 1,
    'exactly one writer',
  );
});

test('the pricing handler block in background.js is self-contained and delimited', () => {
  const bg = read('src/background.js');
  const open = '§3 — price disclosure notice';
  const at = bg.indexOf(open);
  assert.ok(at > -1, 'the block carries no section marker');
  const block = bg.slice(at);
  assert.ok(block.length < 6000, 'the block should stay small; it is a second lane in a shared file');
  assert.ok(/chrome\.runtime\.onMessage\.addListener/.test(block),
    'the block registers its OWN listener rather than joining handleShell');
  assert.ok(/sender/.test(block) && !/msg\.url|message\.url/.test(block),
    'the site and URL come from `sender`, never from the message body');
});
