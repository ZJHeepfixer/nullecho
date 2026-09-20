/**
 * Nullecho — price-disclosure observation. Pure functions, no DOM, no network.
 * ══════════════════════════════════════════════════════════════════════════
 * This file answers exactly one question: **does the text a page rendered
 * contain one of the two algorithmic-pricing sentences a U.S. state mandates,
 * and does the page also publish a machine-readable price?**
 *
 * It answers no other question. In particular it never reports whether a
 * business is following the law, and the reason is a primary source rather than
 * caution: the New York Attorney General's 2026-01-08 letter to Maplebear
 * (Instacart) quotes a page carrying the mandated sentence **exactly as the
 * statute prints it** and concludes the disclosure "does not appear to comply
 * with … the 'clear and conspicuous' requirements of the Act" — it was buried
 * mid-sentence on a fine-print-linked policy page and absent from the pages that
 * actually display prices. A text match proves the words are present. It proves
 * nothing else, in either direction.
 *
 * ── The law, verified 2026-09-19 against enacted text ──────────────────────
 *
 * **New York — Gen. Bus. Law § 349-a ("Pricing"), IN FORCE.** Added by L. 2025,
 * ch. 58, pt. X, § 1 (S.3008-C); effective 2025-07-08; enforced from 2025-11-10,
 * when the AG's voluntary stay lapsed 30 days after *NRF v. James* was dismissed
 * with prejudice. § 349-a(2) hard-codes one sentence with no alternative
 * wording, which makes it the only exact-matchable disclosure string in force in
 * the United States:
 *
 *     THIS PRICE WAS SET BY AN ALGORITHM USING YOUR PERSONAL DATA
 *
 * **Connecticut — P.A. 26-130 § 11 (H.B. 5563), effective 2027-07-01.** Approved
 * 2026-06-04, replacing two earlier repealed sections. Its sentence is:
 *
 *     THIS PRICE WAS INCREASED USING YOUR PERSONAL DATA
 *
 * …"**or a substantially similar disclosure**". So Connecticut's wording is not
 * fixed: an exact matcher can only ever find the canonical form, and **absence
 * proves nothing at all** about a Connecticut page. That is a property of the
 * statute, not a limit we could engineer away.
 *
 * **Maryland and New Jersey mandate no wording, and this module has no branch
 * for either.** Maryland's proposed Com. Law § 13-322 — the one carrying
 * `SET BY AN ALGORITHM OR BY USING YOUR PERSONAL DATA` — was **struck by
 * amendment before passage**; what Maryland enacted is § 13-321 alone, a
 * dynamic-pricing ban for large food retailers and third-party delivery, with no
 * disclosure string. (Control: the state's codified-statute endpoint returns
 * text for § 13-321 and "File Not Found" for § 13-322, and the codified
 * §§ 13-408(a)/13-411(a) name only § 13-321.) New Jersey's Fair Price Protection
 * Act is a grocery ban with no prescribed wording. A detector with a Maryland
 * branch is matching a section that does not exist.
 *
 * ── Why the bare anchor is not here ────────────────────────────────────────
 * The obvious shortcut — matching `using your personal data`, the one substring
 * both sentences share — was implemented and measured. It classifies ordinary
 * privacy-policy prose as a pricing disclosure ("the lawful bases for using your
 * personal data", "withdraw consent to our using your personal data"), i.e. the
 * footer of nearly every commercial page on the web. Only the FULL sentence is
 * ever matched here. `pricing.test.js` holds that.
 *
 * ── Shape ─────────────────────────────────────────────────────────────────
 * No `import`/`export`: this file is BOTH a classic content script (declared in
 * both manifests ahead of `pricing-scan.js`, sharing its isolated world) and an
 * ES module imported for its side effect by `background.js`, the popup and the
 * options page. That is the same dual-context shape `gpc.js` already uses. It
 * attaches one object, `globalThis.NullechoPricing`, and touches nothing else.
 */

(function installNullechoPricing() {
  'use strict';

  /** Which state's wording was found. Never a verdict — a label for the words. */
  const LEVEL = {
    NY: 'ny-disclosure',
    CT: 'ct-style-language',
  };

  /**
   * The two sentences, normalized exactly as `normalize()` would render them.
   * New York first: it is the one in force, and the two share no prefix, so
   * order is presentation rather than precedence.
   */
  const SENTENCES = {
    [LEVEL.NY]: 'this price was set by an algorithm using your personal data',
    [LEVEL.CT]: 'this price was increased using your personal data',
  };
  const LEVELS = [LEVEL.NY, LEVEL.CT];

  /** Longest slice of page text kept with an observation. */
  const MAX_CONTEXT = 200;

  /** Observations kept on the device, oldest dropped first. */
  const RECEIPT_CAP = 200;

  // ═══════════════════════════════════════════════════════════════════════
  // NORMALIZATION
  // ═══════════════════════════════════════════════════════════════════════
  //
  // Two separator characters come out of this, and the difference between them
  // is the whole false-positive story:
  //
  //   SEP (a space)  — whitespace, and punctuation that can sit inside a
  //                    sentence without ending it: quotes (straight and curly),
  //                    commas, brackets, dashes, slashes. A single newline is a
  //                    SEP because `innerText` puts exactly one between two
  //                    block elements, which is how a sentence split across
  //                    `<div>`s reaches us.
  //
  //   BAR (U+0001)   — a barrier the match may never cross: sentence-ending
  //                    punctuation (. ! ? ; :) and a paragraph break (two or
  //                    more newlines, which is what `innerText` emits around a
  //                    `<p>`). Without this, "…was set by an algorithm. Using
  //                    your personal data, we then…" and a headline followed by
  //                    a paragraph both assemble into a false match. The review
  //                    reproduced exactly that shape as FP6.
  //
  // U+0001 cannot appear in rendered page text, and appears in neither sentence,
  // so an ordinary `indexOf` can never span one.

  const SEP = ' ';
  const BAR = '\u0001';

  /** Invisible characters: dropped outright, never even a separator. */
  const DROP = new Set([
    '­', // soft hyphen — renders as nothing unless the line wraps
    '​', '‌', '‍', // zero-width space / non-joiner / joiner
    '⁠', '﻿', // word joiner, BOM
    '‎', '‏', '؜', // bidi marks
    '᠎',
  ]);

  /** Whitespace, including every space character that is not U+0020. */
  const SPACE = new Set([
    ' ', '\t', '\n', '\r', '\f', '\v',
    ' ', ' ', ' ', ' ', ' ', ' ', ' ',
    ' ', ' ', ' ', ' ', ' ', ' ', ' ',
    ' ', '　',
  ]);

  /** Ends a sentence. The match may not cross one. */
  const BARRIER = new Set(['.', '!', '?', ';', ':', '…', '|', '¶']);

  /** Cosmetic: removed, and the gap treated as a space. */
  const STRIP = new Set([
    '"', "'", '‘', '’', '‚', '‛',
    '“', '”', '„', '«', '»', '‹', '›',
    ',', '(', ')', '[', ']', '{', '}', '<', '>',
    '-', '‐', '‑', '‒', '–', '—', '―',
    '/', '\\', '*', '_', '`', '~', '^', '=', '+', '#', '@', '&',
  ]);

  const isWordChar = (c) => !!c && /[\p{L}\p{N}]/u.test(c);

  /**
   * Fold page text to a comparable form, keeping a map back to the original so
   * the observation can quote the sentence **as the page displayed it** rather
   * than as we rewrote it.
   *
   * @param {string} input
   * @returns {{ text: string, map: number[] }} `map[i]` is the source index the
   *          normalized character at `i` came from.
   */
  function normalize(input) {
    const src = String(input ?? '');
    const out = [];
    const map = [];

    const push = (ch, at) => {
      const last = out.length ? out[out.length - 1] : '';
      if (ch === SEP || ch === BAR) {
        if (out.length === 0) return;          // never lead with a separator
        if (last === BAR) return;              // a barrier absorbs what follows
        if (last === SEP) {
          if (ch === BAR) { out[out.length - 1] = BAR; map[map.length - 1] = at; }
          return;
        }
      }
      out.push(ch);
      map.push(at);
    };

    let i = 0;
    while (i < src.length) {
      const c = src[i];

      if (DROP.has(c)) { i += 1; continue; }

      if (SPACE.has(c)) {
        // Walk the whole whitespace run once and decide what it means. Two or
        // more line breaks is a paragraph break, which is a barrier.
        let breaks = 0;
        let j = i;
        while (j < src.length && (SPACE.has(src[j]) || DROP.has(src[j]))) {
          if (src[j] === '\r') { breaks += 1; if (src[j + 1] === '\n') j += 1; }
          else if (src[j] === '\n') { breaks += 1; }
          j += 1;
        }
        push(breaks >= 2 ? BAR : SEP, i);
        i = j;
        continue;
      }

      if (BARRIER.has(c)) { push(BAR, i); i += 1; continue; }
      if (STRIP.has(c)) { push(SEP, i); i += 1; continue; }

      // `toLowerCase()` can widen one character into several; every one of them
      // maps back to the same source index, so the quote stays exact.
      const folded = c.toLowerCase();
      for (const ch of folded) { out.push(ch); map.push(i); }
      i += 1;
    }

    while (out.length) {
      const last = out[out.length - 1];
      if (last !== SEP && last !== BAR) break;
      out.pop();
      map.pop();
    }

    return { text: out.join(''), map };
  }

  /** Whitespace-collapse for display. A receipt is pasted into an email. */
  const collapseWs = (s) => String(s ?? '').replace(/\s+/gu, ' ').trim();

  /** Up to MAX_CONTEXT characters of the page, centred on the sentence. */
  function contextAround(text, start, end) {
    const core = collapseWs(text.slice(start, end));
    if (core.length >= MAX_CONTEXT) return `${core.slice(0, MAX_CONTEXT - 1)}…`;

    const budget = MAX_CONTEXT - core.length;
    const leftWant = Math.floor(budget / 2);
    const rightWant = budget - leftWant;

    // Collapse ONE contiguous slice rather than three pieces and glue them: the
    // glue is what put a space before the full stop in an early build, which
    // made a quoted receipt read as if we had retyped the page.
    const lo = Math.max(0, start - (leftWant + 8) * 4);
    const hi = Math.min(text.length, end + (rightWant + 8) * 4);
    const whole = collapseWs(text.slice(lo, hi));

    const at = whole.indexOf(core);
    if (at === -1) return core;   // boundary landed oddly; quote the sentence alone

    let out = whole;
    if (at > leftWant) out = `…${whole.slice(Math.max(0, at - (leftWant - 1)))}`;
    if (out.length > MAX_CONTEXT) out = `${out.slice(0, MAX_CONTEXT - 1)}…`;
    return out;
  }

  /**
   * Find a mandated sentence in rendered page text.
   *
   * @param {string} text  what the page rendered (`innerText`, never markup)
   * @returns {null | { level: string, matched: string, context: string, index: number }}
   */
  function findDisclosure(text) {
    const src = String(text ?? '');
    if (src.length < 40) return null;              // shorter than either sentence
    const { text: norm, map } = normalize(src);
    if (!norm) return null;

    for (const level of LEVELS) {
      const needle = SENTENCES[level];
      let from = 0;
      let at = norm.indexOf(needle, from);
      while (at !== -1) {
        const before = at === 0 ? '' : norm[at - 1];
        const after = norm[at + needle.length] ?? '';
        // The sentence must stand as its own run of words — not be the tail of
        // a longer token, which is how a concatenation without whitespace would
        // otherwise slip through.
        if (!isWordChar(before) && !isWordChar(after)) {
          const start = map[at];
          const end = map[at + needle.length - 1] + 1;
          return {
            level,
            matched: collapseWs(src.slice(start, end)),
            context: contextAround(src, start, end),
            index: start,
          };
        }
        from = at + 1;
        at = norm.indexOf(needle, from);
      }
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRICE CONTEXT — the guard that keeps this off news and legal pages
  // ═══════════════════════════════════════════════════════════════════════
  //
  // No text matcher can tell a price display from a newspaper quoting the
  // statute; both contain the same sentence, and the review measured exactly
  // that (a Nieman Lab article, a law-firm client alert, and this repository's
  // own brief all carry it). What separates them is not the wording — it is
  // whether the page also publishes a machine-readable price. Structured
  // product data is cheap to read, is published by the pages this feature is
  // for, and is published by essentially none of the pages it is not for.

  /** Currency symbols that mean exactly one currency. `$` does not. */
  const SYMBOL_CURRENCY = { '€': 'EUR', '£': 'GBP', '¥': 'JPY' };

  function cleanCurrency(raw, near = '') {
    const s = String(raw ?? '').trim();
    if (/^[A-Za-z]{3}$/.test(s)) return s.toUpperCase();
    for (const [sym, code] of Object.entries(SYMBOL_CURRENCY)) {
      if (s.includes(sym) || String(near).includes(sym)) return code;
    }
    return null;
  }

  /**
   * A price, or null. Deliberately strict: a field that holds anything other
   * than a number and a currency marker is not reported as a price, because a
   * wrong number in a receipt someone hands to a regulator is worse than no
   * number at all.
   */
  function cleanPrice(raw) {
    if (typeof raw === 'number') return Number.isFinite(raw) ? String(raw) : null;
    const s = String(raw ?? '').trim();
    if (!s) return null;
    const m = /\d{1,3}(?:[,  ]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?/.exec(s);
    if (!m) return null;
    const residue = s.replace(m[0], '')
      .replace(/[\p{Sc}\s]/gu, '')
      .replace(/^[A-Za-z]{3}$/, '');
    if (/[\p{L}]/u.test(residue)) return null;   // "20% off", "call for pricing"
    return m[0].replace(/[  ]/g, '');
  }

  /** Every `price` / `lowPrice` in a JSON-LD blob, with its nearest currency. */
  function jsonLdPrices(raw = []) {
    const found = [];
    const walk = (node, currency, depth) => {
      if (depth > 12 || node == null) return;
      if (Array.isArray(node)) {
        for (const n of node) walk(n, currency, depth + 1);
        return;
      }
      if (typeof node !== 'object') return;
      const cur = node.priceCurrency ?? currency;
      for (const key of ['price', 'lowPrice']) {
        if (Object.prototype.hasOwnProperty.call(node, key)) {
          found.push({ price: node[key], currency: cur });
        }
      }
      for (const k of Object.keys(node)) {
        if (k === 'price' || k === 'lowPrice' || k === 'priceCurrency') continue;
        walk(node[k], cur, depth + 1);
      }
    };
    for (const text of raw) {
      let data;
      try { data = JSON.parse(String(text)); } catch { continue; }
      walk(data, null, 0);
    }
    return found;
  }

  function firstUsable(candidates) {
    for (const c of candidates) {
      const price = cleanPrice(c?.price);
      if (price === null) continue;
      return { price, currency: cleanCurrency(c?.currency, c?.price) };
    }
    return null;
  }

  /**
   * Does this page publish a price a machine can read?
   *
   * @param {Object} [sources]
   * @param {string[]} [sources.jsonLd]    raw `application/ld+json` script texts
   * @param {Array<{value: string, currency?: string}>} [sources.microdata]
   *        `[itemprop="price"]` values
   * @param {{amount?: string, currency?: string}} [sources.meta]
   *        `og:price:amount` / `product:price:amount`
   * @returns {null | { price: string, currency: string|null, source: string }}
   */
  function priceContext(sources = {}) {
    const ld = firstUsable(jsonLdPrices(sources.jsonLd ?? []));
    if (ld) return { ...ld, source: 'json-ld' };

    const md = firstUsable((sources.microdata ?? [])
      .map((m) => ({ price: m?.value, currency: m?.currency })));
    if (md) return { ...md, source: 'microdata' };

    const meta = sources.meta ?? {};
    const mt = firstUsable([{ price: meta.amount, currency: meta.currency }]);
    if (mt) return { ...mt, source: 'meta' };

    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // THE RECEIPT — local only, and that is structural, not a promise
  // ═══════════════════════════════════════════════════════════════════════
  //
  // Nothing in this file can transmit anything. `manifest.test.js` enumerates
  // the egress APIs and fails the build if one appears anywhere in the shipped
  // tree — that test is what earns Firefox's
  // `data_collection_permissions: ["none"]`, and it is why the names are not
  // written out here either. `pricing.test.js` repeats the check against this
  // module specifically, because this is the one module that holds page text
  // and a price at the same time.

  /** The stored URL never carries a query string. Sessions and carts live there. */
  function urlWithoutQuery(url) {
    try {
      const u = new URL(String(url));
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
      return `${u.origin}${u.pathname}`;
    } catch { return ''; }
  }

  /** One observation. Exactly these seven fields, and no others, ever. */
  function observation({ siteKey, url, level, price, currency, context, now } = {}) {
    return {
      siteKey: String(siteKey ?? ''),
      url: urlWithoutQuery(url),
      timestamp: Number.isFinite(now) ? now : Date.now(),
      level: String(level ?? ''),
      price: price === null || price === undefined || price === '' ? null : String(price),
      currency: currency === null || currency === undefined || currency === '' ? null : String(currency),
      context: collapseWs(context).slice(0, MAX_CONTEXT),
    };
  }

  /** Same page, same wording, same number = the same observation, seen again. */
  const observationKey = (e) => `${e?.url} ${e?.level} ${e?.price}`;

  /**
   * Append an observation, replacing an identical earlier one, and keep the
   * list at `cap` by dropping the oldest. The re-scan a few seconds after load
   * (for client-routed pages) would otherwise double every entry.
   */
  function pushReceipt(list, entry, cap = RECEIPT_CAP) {
    const key = observationKey(entry);
    const next = (Array.isArray(list) ? list : []).filter((e) => observationKey(e) !== key);
    next.push(entry);
    while (next.length > cap) next.shift();
    return next;
  }

  // ── RECEIPT TEXT — copy begins ──────────────────────────────────────────
  // Plain text a person can paste into an email to a state Attorney General's
  // office. It states what was on the screen and stops there; the closing
  // sentence is load-bearing and is asserted verbatim by a test.

  const WORDING_NOTE = {
    [LEVEL.NY]: 'New York’s mandated sentence (N.Y. Gen. Bus. Law § 349-a, '
      + 'in force since 2025-11-10).',
    [LEVEL.CT]: 'Connecticut’s canonical sentence (Conn. P.A. 26-130 § 11, which '
      + 'takes effect 2027-07-01 and also accepts a substantially similar sentence).',
  };

  const NO_PRICE_LINE = 'no machine-readable price was published on this page';

  const CLOSING = 'Observed by the Nullecho browser extension; this is a record of '
    + 'what the page displayed, not a legal conclusion.';

  function receiptText(entry) {
    const stamp = new Date(entry?.timestamp ?? 0).toISOString().replace('T', ' ').slice(0, 19);
    const money = entry?.price
      ? `${entry.price}${entry.currency ? ` ${entry.currency}` : ''}`
      : NO_PRICE_LINE;
    return [
      'Nullecho — price disclosure observation',
      '',
      `Page:          ${entry?.url ?? ''}`,
      `Seen:          ${stamp} UTC`,
      `Price on page: ${money}`,
      `Wording:       ${WORDING_NOTE[entry?.level] ?? entry?.level ?? ''}`,
      '',
      'What the page displayed:',
      entry?.context ?? '',
      '',
      CLOSING,
    ].join('\n');
  }
  // ── RECEIPT TEXT — copy ends ────────────────────────────────────────────

  globalThis.NullechoPricing = {
    LEVEL,
    LEVELS,
    SENTENCES,
    MAX_CONTEXT,
    RECEIPT_CAP,
    normalize,
    findDisclosure,
    priceContext,
    jsonLdPrices,
    cleanPrice,
    cleanCurrency,
    urlWithoutQuery,
    observation,
    observationKey,
    pushReceipt,
    receiptText,
  };
}());
