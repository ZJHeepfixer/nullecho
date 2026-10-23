/**
 * Site adapters for workstream J. The fixture pages (fixtures/server.mjs) reproduce the SHAPES these readers depend
 * on — Walmart's __NEXT_DATA__ product block, a cart with "Add to cart" / "Remove" controls, a client-rendered hotel
 * page with room cards — so the self-test exercises the same code that stage 2 runs on the live sites.
 *
 * Live selectors for carts and room cards cannot be confirmed without a live load. METHOD.md §2.6: stage 2 begins with
 * calibration loads (not data) that may set the per-site options below; the options used are written into each raw
 * file, and none may change once a measured series has started.
 */
import { sleep, wallVerdict } from './lib.mjs';

export const WALMART_SELLER_PREFIX = 'F55CDC31'; // walmart.com's own seller id prefix (walmart-price-gap-2026-10/README.md)

export function itemSite(name, origin = null) {
  if (name === 'walmart') {
    const ITEM_URL = { 5689919121: 'https://www.walmart.com/ip/AirPods-Pro-2nd-generation-with-MagSafe-Case-USB-C/5689919121' };
    return { id: 'walmart', origin: 'https://www.walmart.com', host: 'www.walmart.com', itemUrl: (id) => ITEM_URL[id] || `https://www.walmart.com/ip/${id}`, cartUrl: 'https://www.walmart.com/cart' };
  }
  if (name === 'fixture') {
    if (!origin) throw new Error('fixture site needs --origin');
    return { id: 'fixture', origin, host: new URL(origin).hostname, itemUrl: (id) => `${origin}/ip/${id}`, cartUrl: `${origin}/cart` };
  }
  throw new Error(`unknown item site ${name}`);
}

/** In-page: Walmart's own page data, the visible cart badge, and wall text. Same shape as the prior probe's measure(). */
function itemPageScript() {
  const out = { title: document.title.slice(0, 120) };
  const text = document.body ? document.body.innerText : '';
  out.head = text.slice(0, 1500);
  const nd = document.getElementById('__NEXT_DATA__');
  if (nd) {
    try {
      const p = JSON.parse(nd.textContent).props?.pageProps?.initialData?.data?.product;
      if (p) out.product = { usItemId: p.usItemId ?? null, offerId: p.offerId ?? null, sellerId: p.sellerId ?? null, sellerName: p.sellerName ?? null, fulfillment: p.fulfillmentType ?? null, condition: p.conditionType ?? null, price: p.priceInfo?.currentPrice?.price ?? null, was: p.priceInfo?.wasPrice?.price ?? null, wPlus: p.priceInfo?.wPlusEarlyAccessPrice?.price ?? null };
    } catch (e) { out.ndError = String(e.message).slice(0, 80); }
  }
  out.webdriver = navigator.webdriver;
  const badge = [...document.querySelectorAll('[aria-label*="cart" i], [data-testid*="cart" i]')].map((el) => `${el.getAttribute('aria-label') || ''} ${el.textContent || ''}`).join(' | ');
  const m = /cart contains (\d+) item|(\d+)\s+items?\s+in\s+cart|cart[^0-9|]{0,12}(\d+)\s*items?/i.exec(badge);
  out.cartCount = m ? Number(m[1] ?? m[2] ?? m[3]) : null;
  out.storeRaw = (document.cookie.split('; ').find((c) => c.startsWith('assortmentStoreId=')) || '').split('=')[1] || null;
  return out;
}

/** `minMs`: a challenge page that redirects needs time to do it (live 4 s; the prior probe waited 6 s flat). */
export async function readItem(page, url, { settleMs = 9000, minMs = 4000 } = {}) {
  const rec = { http: null };
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    rec.http = resp ? resp.status() : null;
    const t0 = Date.now();
    if (minMs) await sleep(minMs);
    let d;
    for (;;) {
      d = await page.evaluate(itemPageScript).catch(() => null);
      if ((d && d.product) || Date.now() - t0 >= settleMs) break;
      await sleep(1000);
    }
    d = d || {};
    Object.assign(rec, { title: d.title, product: d.product || null, cartCount: d.cartCount ?? null, webdriver: d.webdriver, storeRaw: d.storeRaw });
    const w = wallVerdict({ status: rec.http, title: d.title, head: d.head, hasData: !!d.product });
    rec.wall = w.wall; if (w.wall) { rec.wallWhy = w.why; rec.wallText = (d.head || '').replace(/\s+/g, ' ').slice(0, 200); }
    // A challenge drawn OVER a page that still carries its data: the offer was observed; the flag says so.
    if (!w.wall && d.product) { const hit = wallVerdict({ status: null, title: d.title, head: d.head, hasData: false }); if (hit.wall) rec.wallPhraseWithData = hit.why; }
  } catch (e) { rec.error = String(e.message || e).split('\n')[0].slice(0, 160); }
  return rec;
}

/** Store ids become run-local labels (S1, S2, …): a store number locates the visitor, and this repo is public. */
export function storeLabeler() {
  const m = new Map();
  return (raw) => (raw ? (m.has(raw) ? m.get(raw) : (m.set(raw, `S${m.size + 1}`), m.get(raw))) : null);
}
/** What is written about one item load. Offer and seller ids are the site's public catalogue ids, shortened. */
export function itemSummary(r, storeLabel) {
  const p = r.product || {};
  return {
    http: r.http, wall: !!r.wall, wallWhy: r.wallWhy ?? null, wallText: r.wallText ?? null, wallPhraseWithData: r.wallPhraseWithData ?? null, error: r.error ?? null,
    offerId: p.offerId ? p.offerId.slice(0, 14) : null, sellerId: p.sellerId ? p.sellerId.slice(0, 14) : null, sellerName: p.sellerName ?? null,
    walmartSold: p.sellerId ? p.sellerId.startsWith(WALMART_SELLER_PREFIX) : null, fulfillment: p.fulfillment ?? null, condition: p.condition ?? null,
    price: p.price ?? null, was: p.was ?? null, wPlus: p.wPlus ?? null, store: storeLabel(r.storeRaw), cartCount: r.cartCount ?? null, webdriver: r.webdriver ?? null,
  };
}

/** The first `n` other items linked from this item page, in document order (the "related items" a shopper sees). */
export async function relatedItems(page, selfId, n = 2) {
  const ids = await page.evaluate(() => [...document.querySelectorAll('a[href*="/ip/"]')].map((a) => (/\/ip\/(?:[^/?#]+\/)?(\d{5,})/.exec(a.getAttribute('href') || '') || [])[1]).filter(Boolean)).catch(() => []);
  return [...new Set(ids)].filter((id) => id !== String(selfId)).slice(0, n);
}

/** Click the first visible, enabled control whose aria-label OR visible text matches (each tested on its own). */
async function clickByText(page, re) {
  return page.evaluate((src) => {
    const rx = new RegExp(src, 'i');
    const els = [...document.querySelectorAll('button, [role="button"], a, input[type="submit"]')];
    const el = els.find((e) => {
      const r = e.getBoundingClientRect();
      return [e.getAttribute('aria-label') || '', (e.innerText || e.value || '').trim()].some((l) => rx.test(l)) && !e.disabled && r.width > 0 && r.height > 0;
    });
    if (!el) return false;
    el.scrollIntoView({ block: 'center' });
    el.click();
    return true;
  }, re.source);
}
/** Calibration aid: the labels of visible controls that mention `word` (no values, no personal text: control labels). */
export async function controlLabels(page, word) {
  return page.evaluate((w) => [...document.querySelectorAll('button, [role="button"], a, input[type="submit"]')]
    .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
    .map((e) => `${e.tagName.toLowerCase()}${e.disabled ? '[disabled]' : ''} aria="${(e.getAttribute('aria-label') || '').slice(0, 60)}" text="${(e.innerText || e.value || '').trim().replace(/\s+/g, ' ').slice(0, 60)}"`)
    .filter((s) => s.toLowerCase().includes(w)).slice(0, 12), word).catch(() => []);
}

// Calibrated 2026-10-17 (METHOD.md §2.6): "add" matched the whole aria-label+text string exactly and found nothing on
// walmart.com; each label is now tested on its own and may continue after "Add to cart" (e.g. "Add to cart - <item>").
export const CART = {
  add: /^\s*add to cart\b/,
  remove: /^\s*remove\b|remove item|^\s*delete\s*$/,
  empty: /your cart is empty|cart is empty|time to start shopping|no items in (your )?cart/i,
};

/** Click "Add to cart" on the current item page; confirmed by the page saying so or the badge going up. */
export async function addToCart(page, before) {
  if (!(await clickByText(page, CART.add))) return { added: false, why: 'no add-to-cart control' };
  for (let i = 0; i < 10; i++) {
    await sleep(800);
    const s = await page.evaluate(itemPageScript).catch(() => null);
    const txt = await page.evaluate(() => document.body.innerText.slice(0, 4000)).catch(() => '');
    if ((s && s.cartCount !== null && before !== null && s.cartCount > before) || /added to cart|item added|in your cart/i.test(txt)) return { added: true, cartCount: s?.cartCount ?? null };
  }
  return { added: false, why: 'no confirmation within 8 s' };
}

/** Open the cart and press Remove until it says it is empty. Returns whether the empty state was SEEN. */
export async function emptyCart(page, cartUrl) {
  let removed = 0;
  const resp = await page.goto(cartUrl, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => null);
  const http = resp ? resp.status() : null;
  for (let i = 0; i < 8; i++) {
    await sleep(1500);
    const txt = await page.evaluate(() => document.body.innerText.slice(0, 6000)).catch(() => '');
    if (CART.empty.test(txt)) return { emptied: true, removed, http };
    if (await clickByText(page, CART.remove)) removed++;
  }
  return { emptied: false, removed, http };
}

// ── hotels ──────────────────────────────────────────────────────────────────────────────────────────────
/**
 * In-page: every room card the visitor is shown, with its name, nightly price, total, fee lines, scarcity and
 * member-only notes. A configured `cardSelector` wins; otherwise a card is the innermost element whose text holds a
 * room word AND a price (the heuristic is exercised by the "unmarked" fixture template).
 */
function hotelPageScript(cfg) {
  const kw = new RegExp(cfg.roomKeyword || '\\b(king|queen|double|twin|suite|room|studio|bed|deluxe|standard)\\b', 'i');
  const priceRe = /(?:US\$|USD\s?|\$)\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/;
  const priceAll = new RegExp(priceRe.source, 'g');
  const num = (s) => { const m = priceRe.exec(s || ''); return m ? Number(m[1].replace(/,/g, '')) : null; };
  const vis = (el) => { const r = el.getBoundingClientRect(); const st = getComputedStyle(el); return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none'; };
  let cards = cfg.cardSelector ? [...document.querySelectorAll(cfg.cardSelector)].filter(vis) : [];
  // A configured selector that matches nothing YET means "not rendered yet" (the read keeps polling), never "use the
  // heuristic": on agoda.com the heuristic otherwise locks onto unrelated text before the room grid arrives.
  let how = cards.length ? 'selector' : cfg.cardSelector ? 'selector-none-yet' : 'heuristic';
  if (!cards.length && !cfg.cardSelector) {
    const cand = [...document.querySelectorAll('div, li, section, article, tr')].filter((el) => { const t = el.innerText || ''; return t.length > 0 && t.length < 1600 && kw.test(t) && priceRe.test(t) && vis(el); });
    cards = cand.filter((el) => !cand.some((o) => o !== el && el.contains(o)));
  }
  const rooms = cards.slice(0, 40).map((card) => {
    const t = (card.innerText || '').replace(/ /g, ' ');
    // Calibrated 2026-10-17 on priceline.com (METHOD.md §2.6): a price split over elements renders as "$" / "17" lines
    // and its label as a line of its own ("Per night" / "$17"); both are re-joined. A price followed by "2 nights, …"
    // is the stay total.
    const lines = [];
    for (const l of t.split('\n').map((s) => s.trim()).filter(Boolean)) {
      const prev = lines[lines.length - 1];
      if (prev !== undefined && /^(US\$|USD|\$)$/.test(prev) && /^\d/.test(l)) lines[lines.length - 1] = `${prev}${l}`;
      else if (prev !== undefined && !priceRe.test(prev) && /^(per night|nightly|avg\.? ?\/? ?night|price per night|total)$/i.test(prev) && /^(US\$|USD\s?|\$)\s?\d/.test(l)) lines[lines.length - 1] = `${prev} ${l}`;
      else lines.push(l);
    }
    // `nameAncestor` (calibrated on agoda.com): the card is one rate offer; the room's name sits on the enclosing room.
    const nameRoot = cfg.nameAncestor ? card.closest(cfg.nameAncestor) || card : card;
    // `nameAttr` (priceline.com's 2026-10-23 layout): the room name is an attribute of the ancestor, "<name>-<index>".
    const attrName = cfg.nameAttr ? (nameRoot.getAttribute(cfg.nameAttr) || '').replace(/-\d+$/, '') : '';
    const name = (attrName || (cfg.nameSelector && nameRoot.querySelector(cfg.nameSelector)?.innerText) || lines.find((l) => kw.test(l) && !priceRe.test(l)) || lines[0] || '').trim().slice(0, 90);
    const struck = [...card.querySelectorAll('s, del, strike, [style*="line-through"]')].map((e) => num(e.innerText)).filter((v) => v !== null);
    const priceLines = lines.filter((l) => priceRe.test(l));
    const nightlyLine = (cfg.priceSelector && card.querySelector(cfg.priceSelector)?.innerText) || priceLines.find((l) => /night|nightly|avg|per room/i.test(l) && !/total/i.test(l)) || priceLines.find((l) => !/total|tax|fee/i.test(l) && !struck.includes(num(l)));
    // Priceline renders the stay total under one of two captions ("2 nights, 1 room" or "with taxes and fees"; found in
    // the aborted 2026-10-17 J2 run, D7). Agoda's "Per night before taxes" caption is NOT a total.
    const totalLine = priceLines.find((l) => /total/i.test(l)) || lines.find((l, i) => priceRe.test(l) && l !== nightlyLine && /^(\d+ nights?\b|with taxes and fees|incl(?:uding|\.)? taxes)/i.test(lines[i + 1] || ''));
    return {
      name,
      nightly: num(nightlyLine),
      total: num(totalLine),
      struck: struck.slice(0, 3),
      fees: lines.filter((l) => /tax|fee/i.test(l)).map((l) => l.slice(0, 120)).slice(0, 4),
      left: (() => { const m = /only (\d+) (?:rooms? )?left/i.exec(t); return m ? Number(m[1]) : null; })(),
      soldOut: /sold out|no longer available|not available for your dates/i.test(t),
      memberOnly: /sign in to (unlock|see|get)|member price|members save|vip price/i.test(t),
      prices: [...t.matchAll(priceAll)].map((m) => Number(m[1].replace(/,/g, ''))).slice(0, 8),
    };
  });
  const body = document.body ? document.body.innerText : '';
  return { title: document.title.slice(0, 120), head: body.slice(0, 1500), how, rooms, currencyHint: /US\$|USD/.test(body) ? 'USD' : /\$/.test(body) ? '$' : null, webdriver: navigator.webdriver };
}

/** Load a hotel page and read it once it stops changing (two equal reads 1.5 s apart) or the budget runs out. */
export async function readHotel(page, url, cfg = {}) {
  const rec = { http: null };
  const settleMs = Number(cfg.settleMs) || 25000;
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    rec.http = resp ? resp.status() : null;
    const t0 = Date.now();
    // Calibrated 2026-10-17 on agoda.com: its room grid loads only when scrolled into view, as it would for a person.
    if (Number(cfg.scrollSteps) > 0) {
      await sleep(2000);
      for (let i = 0; i < Number(cfg.scrollSteps); i++) { await page.evaluate(() => window.scrollBy(0, Math.round(window.innerHeight * 0.8))).catch(() => {}); await sleep(700); }
    }
    // `scrollTo` (calibrated on agoda.com): bring the room grid itself into view, again on every poll until cards appear.
    const toGrid = () => (cfg.scrollTo ? page.evaluate((s) => { const el = document.querySelector(s); if (el) el.scrollIntoView({ block: 'start' }); return !!el; }, cfg.scrollTo).catch(() => false) : null);
    await toGrid();
    let prev = null, d = null;
    for (;;) {
      await sleep(1500);
      d = await page.evaluate(hotelPageScript, cfg).catch(() => null);
      if (cfg.scrollTo && !(d && d.rooms.length)) await toGrid();
      const sig = d ? JSON.stringify(d.rooms.map((r) => [r.name, r.nightly, r.total])) : null;
      if (d && d.rooms.length && sig === prev) break;
      prev = sig;
      if (Date.now() - t0 >= settleMs) break;
    }
    d = d || { rooms: [] };
    Object.assign(rec, { title: d.title, how: d.how, rooms: d.rooms, currencyHint: d.currencyHint, webdriver: d.webdriver, settledMs: Date.now() - t0 });
    const w = wallVerdict({ status: rec.http, title: d.title, head: d.head, hasData: d.rooms.length > 0 });
    rec.wall = w.wall; if (w.wall) { rec.wallWhy = w.why; rec.wallText = (d.head || '').replace(/\s+/g, ' ').slice(0, 200); }
  } catch (e) { rec.error = String(e.message || e).split('\n')[0].slice(0, 160); }
  return rec;
}

/** Calibration aid: the text lines and markup hooks of the first room cards (hotel page text; nothing personal). */
export async function hotelCardDebug(page, cfg = {}, n = 6) {
  return page.evaluate((c, max) => {
    const kw = new RegExp(c.roomKeyword || '\\b(king|queen|double|twin|suite|room|studio|bed|deluxe|standard)\\b', 'i');
    const priceRe = /(?:US\$|USD\s?|\$)\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/;
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    let cards = c.cardSelector ? [...document.querySelectorAll(c.cardSelector)].filter(vis) : [];
    if (!cards.length) { const cand = [...document.querySelectorAll('div, li, section, article, tr')].filter((el) => { const t = el.innerText || ''; return t.length < 1600 && kw.test(t) && priceRe.test(t) && vis(el); }); cards = cand.filter((el) => !cand.some((o) => o !== el && el.contains(o))); }
    const hook = (el) => `${el.tagName.toLowerCase()}${el.getAttribute('data-testid') ? `[data-testid="${el.getAttribute('data-testid')}"]` : ''}${el.getAttribute('data-autobot-element-id') ? `[data-autobot-element-id="${el.getAttribute('data-autobot-element-id')}"]` : ''}${typeof el.className === 'string' && el.className ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : ''}`;
    return cards.slice(0, max).map((card) => {
      const chain = []; let e = card; for (let i = 0; i < 6 && e; i++, e = e.parentElement) chain.push(hook(e));
      const priced = [...card.querySelectorAll('*')].filter((x) => x.children.length === 0 && priceRe.test(x.textContent || '')).slice(0, 6).map((x) => `${hook(x)} → "${(x.textContent || '').trim().slice(0, 40)}"`);
      return { lines: (card.innerText || '').split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 14).map((s) => s.slice(0, 90)), chain, pricedLeaves: priced };
    });
  }, cfg, n).catch(() => []);
}

/** Calibration aid: the markup of elements matching `sel` (tags, class, aria-label, data-testid, strike styling, text). */
export async function markupDump(page, sel, n = 3) {
  return page.evaluate((s, max) => [...document.querySelectorAll(s)].slice(0, max).map((root) => {
    const walk = (el, depth) => {
      if (depth > 9) return '';
      const st = getComputedStyle(el);
      const attrs = [el.getAttribute('aria-label') ? `aria="${el.getAttribute('aria-label').slice(0, 80)}"` : '', el.getAttribute('data-testid') ? `testid="${el.getAttribute('data-testid')}"` : '', typeof el.className === 'string' && el.className ? `class="${el.className.trim().split(/\s+/).slice(0, 2).join(' ')}"` : '', /line-through/.test(st.textDecorationLine) ? 'STRUCK' : '', st.display === 'none' || st.visibility === 'hidden' ? 'HIDDEN' : ''].filter(Boolean).join(' ');
      const own = [...el.childNodes].filter((x) => x.nodeType === 3).map((x) => x.textContent.trim()).filter(Boolean).join(' ').slice(0, 40);
      return `${'  '.repeat(depth)}<${el.tagName.toLowerCase()} ${attrs}>${own ? ` "${own}"` : ''}\n${[...el.children].map((ch) => walk(ch, depth + 1)).join('')}`;
    };
    return walk(root, 0).slice(0, 2500);
  }), sel, n).catch(() => []);
}

/** The pre-registered measure: the lowest nightly price among rooms whose name matches the registered room type. */
export function primaryRoom(rooms, roomRe) {
  const re = new RegExp(roomRe, 'i');
  const hits = (rooms || []).filter((r) => re.test(r.name) && Number.isFinite(r.nightly) && !r.soldOut);
  if (!hits.length) return null;
  const best = hits.reduce((a, b) => (b.nightly < a.nightly ? b : a));
  return { name: best.name, nightly: best.nightly, total: best.total, fees: best.fees, left: best.left, memberOnly: best.memberOnly, matches: hits.length };
}
export function availability(rooms) {
  const rs = rooms || [];
  return { roomCards: rs.length, priced: rs.filter((r) => Number.isFinite(r.nightly)).length, soldOut: rs.filter((r) => r.soldOut).length, left: rs.filter((r) => r.left !== null).map((r) => [r.name.slice(0, 40), r.left]), cheapest: rs.filter((r) => Number.isFinite(r.nightly) && !r.soldOut).reduce((m, r) => (m === null || r.nightly < m ? r.nightly : m), null) };
}
