#!/usr/bin/env node
// D59 attack pages, served locally. Chrome reaches them through
//   --host-resolver-rules="MAP top.test 127.0.0.1, MAP third.test 127.0.0.1, MAP own.test 127.0.0.1"
//
//   node attack-server.mjs [port=4959]
//
// http://top.test:<port>/       a page with NO bot-manager cookie of its own, embedding a CROSS-SITE frame
//                               (third.test) and a third-party script, every one of which answers with
//                               Set-Cookie: _abck / bm_sz. The frame also calls back to top.test's host.
//                               Expected: neither top.test nor third.test is flagged; both keep a persona.
// http://own.test:<port>/       the positive control: the site's OWN first document sets _abck.
//                               Expected: own.test flagged before its handshake, device layer stood down,
//                               and its two listed tracker requests still blocked.
// Every request is logged to stdout as `<host> <path> set-cookie=<names>`.
import http from 'node:http';

const PORT = Number(process.argv[2] || 4959);
const BM = ['_abck=attack~0~x; Path=/', 'bm_sz=attack~1; Path=/'];

const pages = {
  'top.test /': () => ({ cookies: [], type: 'text/html', body: `<!doctype html><title>top.test</title>
<h1>top.test — no bot manager here</h1>
<iframe src="http://third.test:${PORT}/frame" width="400" height="120"></iframe>
<script src="http://third.test:${PORT}/s.js"></script>
<script>fetch('http://third.test:${PORT}/api', { mode: 'no-cors', credentials: 'include' }).catch(() => {});</script>` }),
  'third.test /frame': () => ({ cookies: BM, type: 'text/html', body: `<!doctype html><title>third.test frame</title><p>cross-site frame</p>
<script>fetch('/api').catch(() => {}); fetch('http://top.test:${PORT}/api-from-frame', { mode: 'no-cors', credentials: 'include' }).catch(() => {});</script>` }),
  'third.test /s.js': () => ({ cookies: BM, type: 'text/javascript', body: 'void 0;' }),
  'third.test /api': () => ({ cookies: BM, type: 'application/json', body: '{}' }),
  'top.test /api-from-frame': () => ({ cookies: BM, type: 'application/json', body: '{}' }),
  // Two requests Nullecho's static lists block: on a stood-down site they must still fail BLOCKED_BY_CLIENT
  // (blocking stays on). DNR cancels them before they leave the browser.
  'own.test /': () => ({ cookies: BM, type: 'text/html', body: `<!doctype html><title>own.test</title><h1>own.test sets its own _abck</h1>
<img src="https://www.google-analytics.com/collect?v=1&t=pageview" width="1" height="1">
<script src="https://connect.facebook.net/en_US/fbevents.js"></script>` }),
};

http.createServer((req, res) => {
  const host = String(req.headers.host || '').split(':')[0];
  const key = `${host} ${req.url.split('?')[0]}`;
  const page = pages[key];
  if (!page) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('404'); console.log(`${key} 404`); return; }
  const { cookies, type, body } = page();
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store', ...(cookies.length ? { 'Set-Cookie': cookies } : {}) });
  res.end(body);
  console.log(`${key} set-cookie=${cookies.map((c) => c.split('=')[0]).join(',') || '-'}`);
}).listen(PORT, '127.0.0.1', () => console.log(`attack pages on 127.0.0.1:${PORT}`));
