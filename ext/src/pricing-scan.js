/**
 * Nullecho — price-disclosure scan. Content script, ISOLATED world, top frame.
 * ══════════════════════════════════════════════════════════════════════════
 * A CLASSIC content script: MV3 does not support ES modules for content
 * scripts, so the one message literal it needs is inlined and registered in
 * `protocol.js`'s `CONTENT_SCRIPT_LITERALS`, where `protocol.test.js` fails the
 * build if the two ever drift apart.
 *
 * It is declared in both manifests as the SECOND file of an entry whose first
 * file is `src/pricing.js`, so the pure functions are already in this isolated
 * world's global scope by the time this runs. Nothing here is in the page
 * realm; the page cannot see it, call it, or feed it.
 *
 * ── The order of operations is the design ─────────────────────────────────
 *
 *  1. **Price context first.** Three `querySelectorAll` calls and a JSON parse.
 *     On a page with no structured price — every news article, every law-firm
 *     alert, every privacy policy — this is where the scan stops, and it costs
 *     effectively nothing.
 *  2. **Only then the rendered-text read.** That call forces layout and is the
 *     expensive half, so it never runs on a page that has no price to disclose.
 *     This ordering is asserted by a test, not left to habit.
 *
 * ── Two passes, and why ───────────────────────────────────────────────────
 * One at `document_idle`, one ~3s later. Checkout and product flows are
 * overwhelmingly client-routed: the price and its fine print frequently render
 * after the initial paint. Two timed passes cost two scans; a `MutationObserver`
 * on a commercial page costs a scan per mutation burst, which is the
 * performance regression the review warned about. If the second pass sees the
 * same page, the same wording and the same number, the service worker replaces
 * the entry rather than adding one.
 *
 * ── Quiet by construction ─────────────────────────────────────────────────
 * No console output at all (D33), and no DOM event channel: this script speaks
 * only to the service worker over `chrome.runtime`, which a page cannot forge
 * or observe. The worker takes the URL from `sender`, never from this message.
 */

(function nullechoPricingScan() {
  'use strict';

  const api = globalThis.chrome ?? globalThis.browser;
  const P = globalThis.NullechoPricing;
  if (!api?.runtime?.id || !P) return;

  // Inlined because a classic content script cannot import. Registered in
  // protocol.js → CONTENT_SCRIPT_LITERALS; protocol.test.js holds them equal.
  const MSG_PRICING_OBSERVED = 'nullecho:pricing:observed';

  /** Belt and braces: the manifest already says top frame only. */
  if (globalThis.top !== globalThis) return;

  const SECOND_PASS_MS = 3000;
  const MAX_LD_SCRIPTS = 12;

  /**
   * The cheap half. Structured product data only — no heuristics over rendered
   * text, because "a currency-shaped token somewhere on the page" is true of
   * every article that mentions a dollar figure.
   */
  function collectPriceContext() {
    const jsonLd = [];
    const ldNodes = document.querySelectorAll('script[type="application/ld+json"]');
    for (let i = 0; i < ldNodes.length && jsonLd.length < MAX_LD_SCRIPTS; i += 1) {
      const raw = ldNodes[i].textContent;
      if (raw && raw.length < 200000) jsonLd.push(raw);
    }

    const microdata = [];
    const mdNodes = document.querySelectorAll('[itemprop="price"]');
    for (let i = 0; i < mdNodes.length && microdata.length < 8; i += 1) {
      const el = mdNodes[i];
      const value = el.getAttribute('content') ?? el.textContent;
      const currencyEl = el.parentElement?.querySelector('[itemprop="priceCurrency"]');
      microdata.push({
        value,
        currency: currencyEl?.getAttribute('content') ?? currencyEl?.textContent ?? null,
      });
    }

    const metaEl = document.querySelector(
      'meta[property="og:price:amount"], meta[property="product:price:amount"], '
      + 'meta[name="og:price:amount"], meta[name="product:price:amount"]',
    );
    const metaCur = document.querySelector(
      'meta[property="og:price:currency"], meta[property="product:price:currency"], '
      + 'meta[name="og:price:currency"], meta[name="product:price:currency"]',
    );
    const meta = {
      amount: metaEl?.getAttribute('content') ?? null,
      currency: metaCur?.getAttribute('content') ?? null,
    };

    return P.priceContext({ jsonLd, microdata, meta });
  }

  /**
   * What the page RENDERED. `innerText`, never markup and never the raw text
   * content of the tree: the claim this feature makes is "the page displayed
   * these words", and the raw form would also return text inside a closed
   * `<details>`, a `display:none` block, or a `<template>` — none of which the
   * reader saw.
   * The cost of that honesty is a real limit, written down in `DECISIONS.md`:
   * a disclosure the site hides behind a closed disclosure widget is not
   * reported, which is the correct answer to "what did this page display".
   */
  function renderedText() {
    const body = document.body;
    if (!body) return '';
    const text = body.innerText;
    return typeof text === 'string' ? text : '';
  }

  let lastSent = '';

  function scan() {
    let price = null;
    try { price = collectPriceContext(); } catch { /* a hostile DOM is not an error */ }

    const text = price ? renderedText() : '';
    let hit = null;
    try { hit = text ? P.findDisclosure(text) : null; } catch { hit = null; }

    // Statutory language on a page with no price of its own: a news article, a
    // law-firm alert, this project's own brief. Nothing is shown and nothing is
    // stored — the observation is only interesting where a price is quoted.
    if (!price || !hit) return;

    const payload = {
      type: MSG_PRICING_OBSERVED,
      level: hit.level,
      context: hit.context,
      price: price.price,
      currency: price.currency,
    };

    // The second pass re-sends only when something actually changed.
    const digest = `${payload.level} ${payload.price} ${payload.currency} ${payload.context}`;
    if (digest === lastSent) return;
    lastSent = digest;

    try {
      api.runtime.sendMessage(payload, () => { void api.runtime.lastError; });
    } catch { /* the worker is gone; there is nothing useful to say about it */ }
  }

  scan();
  setTimeout(scan, SECOND_PASS_MS);
}());
