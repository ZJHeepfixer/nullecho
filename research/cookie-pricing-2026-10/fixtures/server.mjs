/**
 * Local fixture site for the stage-1 self-test. It is a STAND-IN with planted, known effects, so the harness and the
 * analysis can be shown to (a) find an effect that is there and (b) report nothing when nothing is there.
 *
 * Item pages copy the shape the Walmart reader depends on (a __NEXT_DATA__ product block, a cart badge, "Add to
 * cart" / "Remove" controls). Hotel pages copy the shape of a client-rendered OTA page (room cards fetched after load).
 * Names of cookies imitate the categories seen on walmart.com so the role labels and the bot-manager exclusion are
 * exercised; values are random. Nothing here contacts the network beyond 127.0.0.1.
 *
 * Item modes (`item`):   none · split-xpa · split-either · split-and · split-botmgr      (+ pLow, deviceBias, history, globalBump)
 * Hotel modes (`hotel`): any of  demand · repeat-cookie · repeat-storage · bucket · noise  joined by "+", or "null"
 * Walls: wallEvery (every k-th page is a wall), wallAll, wallKind ("403" | "px")
 */
import http from 'node:http';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rng } from '../stats.mjs';

const MAIN = '5689919121';
const OFFERS = { L: { offerId: 'BEB7CB59FX0001', price: 149.99 }, H: { offerId: '0C3F46B1FX0001', price: 169.99 } };
const SELLER = { sellerId: '66306FC5FX0000', sellerName: 'Fixture Renew LLC' };
const FOLLOW = {
  F1: { L: { offerId: 'F1LOWOFFER001', price: 24.99 }, H: { offerId: 'F1HIGHOFFER01', price: 29.99 } }, // follows the visitor's main bucket
  F2: { L: { offerId: 'F2ONLYOFFER01', price: 59.0 }, H: { offerId: 'F2ONLYOFFER01', price: 59.0 } }, // one offer for everyone
  F3: { L: { offerId: 'F3LOWOFFER001', price: 9.99 }, H: { offerId: 'F3HIGHOFFER01', price: 12.49 } }, // its own independent split
};
// numeric aliases (live item ids are numeric; the search page and the related-item reader only see digits)
const NUMERIC = { 7000001: 'W1', 7000002: 'F1', 7000003: 'F2', 7000004: 'F3' };
const WALMART_SELLER = { sellerId: 'F55CDC31FX0000', sellerName: 'Walmart.com' };
const ROOMS = [
  { name: 'Standard King Room', base: 189, left: 5 },
  { name: 'Two Queen Beds', base: 199, left: null },
  { name: 'Junior Suite', base: 289, left: 2 },
];
const FAKE_IP = '203.0.113.7'; // TEST-NET-3: documentation range, used to prove walls' IP text is scrubbed

export async function startFixture({ seed = 7, port = 0 } = {}) {
  const S = {
    mode: { item: 'split-either', pLow: 0.5, deviceBias: null, history: false, globalBump: 0, wallEvery: 0, wallAll: false, wallKind: '403', hotel: 'null', template: 'marked', slotMs: 1500, demandStep: 4, repeatBump: 12, bucketBump: 10, noise: 0, hotelWallEvery: 0 },
    rand: rng(seed), t0: Date.now(),
    xpa: new Map(), vtc: new Map(), pair: new Map(), px: new Map(), f3: new Map(), visitors: new Map(), carts: new Map(), views: new Map(),
    issued: new Set(), headers: [], reports: [], itemLoads: 0, hotelLoads: 0,
  };
  const tok = (n = 18) => { const v = crypto.randomBytes(n).toString('base64url'); S.issued.add(v); return v; };
  const parse = (req) => Object.fromEntries((req.headers.cookie || '').split(/;\s*/).filter(Boolean).map((p) => { const i = p.indexOf('='); return [p.slice(0, i), decodeURIComponent(p.slice(i + 1))]; }));
  const set = (out, name, value, { session = false } = {}) => out.push(`${name}=${encodeURIComponent(value)}; Path=/${session ? '' : '; Max-Age=31536000'}; SameSite=Lax`);
  const isMobile = (ua) => /Mobile|iPhone|Android/i.test(ua || '');
  const draw = (ua) => {
    const db = S.mode.deviceBias;
    const p = db ? (isMobile(ua) ? db.mobile : db.desktop) : S.mode.pLow;
    return S.rand() < p ? 'L' : 'H';
  };

  /** The planted mechanisms: which cookie carries the visitor's bucket. Returns [bucket, visitorKey]. */
  function resolveBucket(ck, out, ua) {
    const m = S.mode.item;
    if (m === 'none') { if (!ck.xpa) { const x = tok(); S.xpa.set(x, 'H'); set(out, 'xpa', x); ck.xpa = x; } return ['H', ck.xpa]; }
    if (m === 'split-xpa') {
      if (ck.xpa && S.xpa.has(ck.xpa)) return [S.xpa.get(ck.xpa), ck.xpa];
      const b = draw(ua); const x = tok(); S.xpa.set(x, b); set(out, 'xpa', x); ck.xpa = x; return [b, x];
    }
    if (m === 'split-either') { // xpa wins; without it the visitor id (vtc) decides; with neither, a new draw
      if (ck.xpa && S.xpa.has(ck.xpa)) return [S.xpa.get(ck.xpa), ck.xpa];
      if (ck.vtc && S.vtc.has(ck.vtc)) { const b = S.vtc.get(ck.vtc); const x = tok(); S.xpa.set(x, b); set(out, 'xpa', x); ck.xpa = x; return [b, x]; }
      const b = draw(ua); const x = tok(); const v = tok(); S.xpa.set(x, b); S.vtc.set(v, b); set(out, 'xpa', x); set(out, 'vtc', v); ck.xpa = x; ck.vtc = v; return [b, x];
    }
    if (m === 'split-and') { // only the PAIR (xpa, vtc) is recognised; a mixed or partial pair is a new visitor
      const k = `${ck.xpa}|${ck.vtc}`;
      if (S.pair.has(k)) return [S.pair.get(k), k];
      const b = draw(ua); const x = tok(); const v = tok(); S.pair.set(`${x}|${v}`, b); set(out, 'xpa', x); set(out, 'vtc', v); ck.xpa = x; ck.vtc = v; return [b, `${x}|${v}`];
    }
    if (m === 'split-botmgr') { // carried by a bot-manager-style cookie, which the harness never transfers
      if (ck._px3 && S.px.has(ck._px3)) return [S.px.get(ck._px3), ck._px3];
      const b = draw(ua); const x = tok(); S.px.set(x, b); set(out, '_px3', x); ck._px3 = x; return [b, x];
    }
    throw new Error(`unknown item mode ${m}`);
  }
  function decoys(ck, out) { // cookies that never carry anything here
    const want = { vtc: 0, ACID: 0, _m: 0, xptc: 0, 'exp-ck': 0, locGuestData: 0, _pxvid: 0, TS01a1b2c3: 0, _px3: 0, userAppVersion: 0, abqme: 0 };
    for (const n of Object.keys(want)) if (!ck[n] && !out.some((c) => c.startsWith(`${n}=`))) { const v = tok(); set(out, n, v, { session: n === 'abqme' }); ck[n] = v; }
    if (!ck.assortmentStoreId) { set(out, 'assortmentStoreId', '9001'); ck.assortmentStoreId = '9001'; }
    if (!ck.hasACID) set(out, 'hasACID', 'true');
  }
  const wallPage = (res, out) => {
    if (S.mode.wallKind === 'px') { res.writeHead(200, { 'content-type': 'text/html', 'set-cookie': out }); res.end(`<!doctype html><title>Robot or human?</title><body><h1>Robot or human?</h1><p>Press &amp; Hold to confirm you are a human. Your IP address: ${FAKE_IP}</p></body>`); return; }
    res.writeHead(403, { 'content-type': 'text/html', 'set-cookie': out });
    res.end(`<!doctype html><title>Access Denied</title><body><h1>Access Denied</h1><p>You don't have permission to access this page. Reference #18.6f2a.1760000000.abc. Your IP address: ${FAKE_IP}</p></body>`);
  };
  const cartOf = (ck, out) => { let c = ck.cart; if (!c || !S.carts.has(c)) { c = tok(); S.carts.set(c, []); set(out, 'cart', c); ck.cart = c; } return S.carts.get(c); };
  const reportJs = `<script>fetch('/__report',{method:'POST',body:JSON.stringify({webdriver:navigator.webdriver,platform:navigator.platform,ua:navigator.userAgent,touch:navigator.maxTouchPoints,w:innerWidth,dpr:devicePixelRatio,mobile:navigator.userAgentData?navigator.userAgentData.mobile:null})});</script>`;

  function itemPage(req, res, id0, ck) {
    const id = NUMERIC[id0] || id0;
    const out = [];
    S.headers.push({ path: req.url, ua: req.headers['user-agent'], ch: req.headers['sec-ch-ua'] || null, chMobile: req.headers['sec-ch-ua-mobile'] || null, chPlatform: req.headers['sec-ch-ua-platform'] || null, lang: req.headers['accept-language'] || null });
    S.itemLoads++;
    const pat = S.mode.wallPattern; // e.g. "WWOWWOWWOW": W = walled, O = served, cycled per item page
    if (S.mode.wallAll || (S.mode.wallEvery && S.itemLoads % S.mode.wallEvery === 0) || (pat && pat[(S.itemLoads - 1) % pat.length] === 'W')) return wallPage(res, out);
    let offer;
    if (id === MAIN || id === 'F1') {
      const [b, key] = resolveBucket(ck, out, req.headers['user-agent']);
      offer = { ...(id === MAIN ? OFFERS[b] : FOLLOW.F1[b]) };
      if (id === MAIN && S.mode.history) { const v = S.visitors.get(key) || { cartAdds: 0 }; if (v.cartAdds >= 2) offer.price = Math.round((offer.price + 10) * 100) / 100; }
    } else if (id === 'F2') offer = FOLLOW.F2.L;
    else if (id === 'W1') offer = { offerId: 'W1WALMARTOFF1', price: 99.0 };
    else if (id === 'F3') { let k = ck.f3b; if (!k || !S.f3.has(k)) { k = tok(); S.f3.set(k, S.rand() < 0.5 ? 'L' : 'H'); set(out, 'f3b', k); } offer = FOLLOW.F3[S.f3.get(k)]; }
    else offer = { offerId: `REL${id}`.slice(0, 14), price: 10 + (Number(id) % 50) };
    if (id === MAIN) offer.price = Math.round((offer.price + S.mode.globalBump) * 100) / 100;
    decoys(ck, out);
    const cart = cartOf(ck, out);
    const product = { usItemId: id, offerId: offer.offerId, selectedOfferId: offer.offerId, ...(id === 'W1' ? WALMART_SELLER : SELLER), fulfillmentType: 'MARKETPLACE', conditionType: 'New', priceInfo: { currentPrice: { price: offer.price, priceDisplay: `$${offer.price.toFixed(2)}` }, wasPrice: { price: 199 } } };
    const nd = JSON.stringify({ props: { pageProps: { initialData: { data: { product } } } } });
    res.writeHead(200, { 'content-type': 'text/html', 'set-cookie': out });
    res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Fixture item ${id}</title></head><body>
<header><a href="/cart" id="cartlink" aria-label="Cart contains ${cart.length} items">Cart ${cart.length}</a></header>
<h1>Fixture item ${id}</h1><div data-testid="price-wrap">$${offer.price.toFixed(2)}</div>
<button id="atc">Add to cart</button><div id="msg"></div>
<section><h2>Similar items</h2><a href="/ip/${id}">this item</a> <a href="/ip/Related-one/100001">related one</a> <a href="/ip/Related-two/100002">related two</a> <a href="/ip/Related-three/100003">related three</a></section>
<script id="__NEXT_DATA__" type="application/json">${nd}</script>
<script>document.getElementById('atc').onclick=async()=>{const r=await fetch('/api/cart/add?id=${id}',{method:'POST'});const j=await r.json();const a=document.getElementById('cartlink');a.setAttribute('aria-label','Cart contains '+j.count+' items');a.textContent='Cart '+j.count;document.getElementById('msg').textContent='Added to cart';};</script>
${reportJs}</body></html>`);
  }

  function cartPage(req, res, ck) {
    const out = [];
    const cart = cartOf(ck, out);
    res.writeHead(200, { 'content-type': 'text/html', 'set-cookie': out });
    const items = cart.map((id) => `<li>Item ${id} <button class="rm" data-id="${id}" aria-label="Remove item ${id}">Remove</button></li>`).join('');
    res.end(`<!doctype html><title>Cart</title><body><h1>Cart</h1>${cart.length ? `<ul>${items}</ul>` : '<p>Your cart is empty</p>'}
<script>for(const b of document.querySelectorAll('.rm'))b.onclick=async()=>{await fetch('/api/cart/remove?id='+b.dataset.id,{method:'POST'});location.reload();};</script></body>`);
  }

  function hotelShell(req, res, id, ck) {
    const out = [];
    S.hotelLoads++;
    if (S.mode.hotelWallEvery && S.hotelLoads % S.mode.hotelWallEvery === 0) return wallPage(res, out);
    if (!ck.sid) set(out, 'sid', tok());
    if (/bucket/.test(S.mode.hotel) && !ck.ab) set(out, 'ab', S.rand() < 0.5 ? 'A' : 'B');
    for (const n of ['pclnvid', '_abck', 'bm_sz', '_ga']) if (!ck[n]) set(out, n, tok());
    res.writeHead(200, { 'content-type': 'text/html', 'set-cookie': out });
    const marked = S.mode.template !== 'unmarked';
    res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Fixture Hotel ${id}</title></head><body>
<header><p>Member deals from $99 — sign in</p></header><h1>Fixture Hotel ${id}</h1><div id="rooms">Loading rates…</div>
<aside><p>Nearby: The Example Inn — from $120 per night</p></aside>
<script>
const rv=Number(localStorage.getItem('rv')||0)+1;localStorage.setItem('rv',String(rv));
setTimeout(async()=>{const r=await fetch('/api/rooms?id=${id}&rv='+rv);const j=await r.json();
const el=document.getElementById('rooms');el.innerHTML='';
for(const x of j.rooms){const d=document.createElement('div');
${marked
    ? "d.setAttribute('data-testid','room-card');d.innerHTML='<h3 data-testid=\"room-name\">'+x.name+'</h3><div><span data-testid=\"room-price\">$'+x.nightly+'</span> per night</div><div>Total $'+x.total.toFixed(2)+' for 2 nights incl. taxes</div><div>Taxes and fees: $'+x.taxes.toFixed(2)+'</div><div>Resort fee: $45.00 per night (not included)</div>'+(x.left?'<div>Only '+x.left+' rooms left</div>':'')+(x.soldOut?'<div>Sold out</div>':'');"
    : "d.innerHTML='<div><div>'+x.name+'</div><div><div>$'+x.nightly+' avg/night</div><div>$'+x.total.toFixed(2)+' total</div></div><div>Includes taxes and fees</div>'+(x.left?'<div>Only '+x.left+' left</div>':'')+'</div>';"}
el.appendChild(d);}},400);
</script>${reportJs}</body></html>`);
  }

  function roomsApi(req, res, url, ck) {
    const m = S.mode.hotel;
    const views = (S.views.get(ck.sid) || 0) + 1; if (ck.sid) S.views.set(ck.sid, views);
    const rv = Number(url.searchParams.get('rv') || 1);
    let adj = 0;
    if (/demand/.test(m)) adj += S.mode.demandStep * Math.floor((Date.now() - S.t0) / S.mode.slotMs);
    if (/repeat-cookie/.test(m) && views >= 2) adj += S.mode.repeatBump;
    if (/repeat-storage/.test(m) && rv >= 2) adj += S.mode.repeatBump;
    if (/bucket/.test(m) && ck.ab === 'B') adj += S.mode.bucketBump;
    if (/noise/.test(m)) adj += Math.round((S.rand() * 2 - 1) * S.mode.noise);
    const slot = Math.floor((Date.now() - S.t0) / S.mode.slotMs);
    const rooms = ROOMS.map((r) => {
      const nightly = r.base + adj;
      const taxes = Math.round(nightly * 2 * 0.175 * 100) / 100;
      return { name: r.name, nightly, total: nightly * 2 + taxes, taxes, left: r.left === null ? null : Math.max(1, r.left - (/demand/.test(m) ? Math.floor(slot / 3) : 0)), soldOut: false };
    });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ rooms }));
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const ck = parse(req);
    let m;
    if (url.pathname === '/__mode') {
      const patch = JSON.parse(url.searchParams.get('json') || '{}');
      if (patch.reset) { for (const k of ['xpa', 'vtc', 'pair', 'px', 'f3', 'visitors', 'carts', 'views']) S[k].clear(); S.itemLoads = 0; S.hotelLoads = 0; delete patch.reset; }
      if (patch.resetClock) { S.t0 = Date.now(); delete patch.resetClock; }
      Object.assign(S.mode, patch);
      res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(S.mode)); return;
    }
    if (url.pathname === '/__report' && req.method === 'POST') { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { try { S.reports.push(JSON.parse(b)); } catch { /* ignore */ } res.end('ok'); }); return; }
    if ((m = /^\/ip\/(?:[^/]+\/)?([A-Za-z0-9]+)$/.exec(url.pathname))) return itemPage(req, res, m[1], ck);
    if (url.pathname === '/cart') return cartPage(req, res, ck);
    if (url.pathname === '/search') { // every query lists a walmart.com-sold item first, then the three marketplace items
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(`<!doctype html><title>Search</title><body><h1>Results for ${String(url.searchParams.get('q') || '').replace(/[<>&]/g, '')}</h1>${Object.keys(NUMERIC).map((n) => `<a href="/ip/Some-item-${n}/${n}">item ${n}</a>`).join(' ')}</body>`);
      return;
    }
    if (url.pathname === '/api/cart/add' && req.method === 'POST') {
      const out = []; const cart = cartOf(ck, out); const id = url.searchParams.get('id'); cart.push(id);
      if (S.mode.history && id === MAIN) { const key = S.mode.item === 'split-xpa' ? ck.xpa : `${ck.xpa}`; const v = S.visitors.get(key) || { cartAdds: 0 }; v.cartAdds++; S.visitors.set(key, v); }
      res.writeHead(200, { 'content-type': 'application/json', 'set-cookie': out }); res.end(JSON.stringify({ count: cart.length })); return;
    }
    if (url.pathname === '/api/cart/remove' && req.method === 'POST') {
      const out = []; const cart = cartOf(ck, out); const i = cart.indexOf(url.searchParams.get('id')); if (i >= 0) cart.splice(i, 1);
      res.writeHead(200, { 'content-type': 'application/json', 'set-cookie': out }); res.end(JSON.stringify({ count: cart.length })); return;
    }
    if ((m = /^\/hotel\/([A-Za-z0-9-]+)$/.exec(url.pathname))) return hotelShell(req, res, m[1], ck);
    if (url.pathname === '/api/rooms') return roomsApi(req, res, url, ck);
    if (url.pathname === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found');
  });
  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  return {
    origin, state: S, FAKE_IP,
    setMode: async (patch) => { const r = await fetch(`${origin}/__mode?json=${encodeURIComponent(JSON.stringify(patch))}`); return r.json(); },
    close: () => new Promise((r) => server.close(r)),
  };
}

// `node fixtures/server.mjs` keeps a fixture up for manual poking.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const f = await startFixture({ port: Number(process.argv[2] || 0) });
  console.log(`fixture at ${f.origin}  (item ${f.origin}/ip/${MAIN}, hotel ${f.origin}/hotel/H1)`);
}
