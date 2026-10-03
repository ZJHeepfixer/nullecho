#!/usr/bin/env python3
"""Nullecho for Safari — local fixture server for the phase-1 verification (safari/VERIFY-MACOS.md).

Serves two pages on the loopback interface and logs every request it receives, with every header,
so the log — not a browser panel — is the ground truth for "was Sec-GPC sent" and "was it blocked".

    python3 safari/tools/verify-server.py                 # listen on 127.0.0.1:47301, log under dist/safari/verify/
    python3 safari/tools/verify-server.py --port 47305
    python3 safari/tools/verify-server.py --summary RUN   # read the logs for ?run=RUN and print pass/fail per check

Hosts: `*.lvh.me` is public wildcard DNS for the loopback address, so `a.lvh.me:47301` and
`b.lvh.me:47301` are two origins on this one server without touching /etc/hosts. Pages:

    http://a.lvh.me:47301/page?run=RUN         the GPC fixture: reads navigator.globalPrivacyControl in the
                                               top frame, a same-tick child realm, an about:blank frame, a
                                               srcdoc frame and a cross-origin (b.lvh.me) frame; loads an
                                               image, a script, a fetch and an XHR so the log shows which
                                               request kinds carry Sec-GPC; reports everything to /report
    http://a.lvh.me:47301/blocking-proof.html  harness/blocking-proof.html, served verbatim (real tracker URLs)

Why not an npm server or a one-liner: the summary needs the headers of every request, and the fixture
page needs two origins and a few generated routes; this is the smallest thing that does both.
"""
import argparse
import base64
import json
import os
import sys
import threading
import time
import urllib.parse
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
DEFAULT_LOG_DIR = os.path.join(REPO, 'dist', 'safari', 'verify')
GIF = base64.b64decode('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7')
HOSTS = {'A': 'a.lvh.me', 'B': 'b.lvh.me'}

PAGE_JS = r"""
(() => {
  const cfg = window.__CFG; const H = cfg.hosts; const from = location.hostname; const run = cfg.run;
  const results = {}; const out = document.getElementById('out');
  const log = (k, v) => { results[k] = v; if (out) out.textContent = JSON.stringify({ run, from, results }, null, 1); };
  const post = (obj) => fetch('/report', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(Object.assign({ run, from, href: location.href, visibility: document.visibilityState, t: Date.now() }, obj)) }).catch(() => {});
  const url = (host, p, k) => `http://${host}:${cfg.port}${p}?run=${encodeURIComponent(run)}&k=${k}&from=${from}`;
  const img = (host, p, k) => new Promise((res) => { const i = new Image(); const to = setTimeout(() => res('timeout'), 10000);
    i.onload = () => { clearTimeout(to); res('load'); }; i.onerror = () => { clearTimeout(to); res('error'); }; i.src = url(host, p, k); }).then((v) => log(k, v));
  const script = (host, p, k) => new Promise((res) => { const s = document.createElement('script'); const to = setTimeout(() => res('timeout'), 10000);
    s.onload = () => { clearTimeout(to); res('load'); }; s.onerror = () => { clearTimeout(to); res('error'); }; s.src = url(host, p, k); document.body.appendChild(s); }).then((v) => log(k, v));
  const get = (host, p, k) => fetch(url(host, p, k), { mode: host === from ? 'cors' : 'no-cors', cache: 'no-store' })
    .then((r) => log(k, { status: r.status, type: r.type }), (e) => log(k, { err: String(e) }));
  const xhr = (host, p, k) => new Promise((res) => { const x = new XMLHttpRequest(); x.timeout = 10000; x.onloadend = () => res({ status: x.status }); x.ontimeout = () => res('timeout');
    x.open('GET', url(host, p, k)); x.send(); }).then((v) => log(k, v));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const readGpc = (win) => { try { return { value: win.navigator.globalPrivacyControl, ownOnProto: Object.prototype.hasOwnProperty.call(win.Navigator.prototype, 'globalPrivacyControl'), readyState: win.document.readyState }; } catch (e) { return { err: String(e) }; } };
  window.addEventListener('message', (e) => { if (e.data && typeof e.data === 'object' && e.data.gpcFrame) log('gpc_frame_' + e.data.gpcFrame, e.data); });

  (async () => {
    const d = Object.getOwnPropertyDescriptor(Navigator.prototype, 'globalPrivacyControl');
    log('gpc_top', { first: window.__first, now: navigator.globalPrivacyControl, typeofNow: typeof navigator.globalPrivacyControl,
      desc: d ? { getName: d.get && d.get.name, getSrc: d.get && Function.prototype.toString.call(d.get), enumerable: d.enumerable, configurable: d.configurable } : null,
      keyIndex: Object.keys(Navigator.prototype).indexOf('globalPrivacyControl'), keyCount: Object.keys(Navigator.prototype).length });
    try {  // forged handshakes from page script: must not move the signal
      document.dispatchEvent(new CustomEvent('nullecho:persona', { detail: JSON.stringify({ ok: true, enabled: true, gpc: false, gpcNonce: 'ffffffffffffffffffffffffffffffff' }) }));
      document.dispatchEvent(new CustomEvent('nullecho:persona', { detail: JSON.stringify({ ok: true, enabled: false }) }));
      log('gpc_after_forge', navigator.globalPrivacyControl);
    } catch (e) { log('gpc_after_forge', { err: String(e) }); }
    const f = document.createElement('iframe'); f.style.width = '10px'; f.style.height = '10px'; document.body.appendChild(f);
    log('gpc_child_sametick', readGpc(f.contentWindow));
    await sleep(0); log('gpc_child_task0', readGpc(f.contentWindow));
    await sleep(500); log('gpc_child_500ms', readGpc(f.contentWindow));
    const f2 = document.createElement('iframe'); f2.style.width = '10px'; f2.style.height = '10px';
    const f2load = new Promise((r) => f2.addEventListener('load', () => r(readGpc(f2.contentWindow)), { once: true }));
    document.body.appendChild(f2);
    log('gpc_aboutblank_load', await Promise.race([f2load, sleep(3000).then(() => 'no-load-event')]));
    const f3 = document.createElement('iframe'); f3.style.width = '10px'; f3.style.height = '10px';
    f3.srcdoc = '<script>parent.postMessage({ gpcFrame: "srcdoc", value: navigator.globalPrivacyControl, has: "globalPrivacyControl" in Navigator.prototype }, "*")<\/script>';
    document.body.appendChild(f3);
    const f4 = document.createElement('iframe'); f4.style.width = '10px'; f4.style.height = '10px';
    f4.src = url(H.B, '/frame', 'frame_b'); document.body.appendChild(f4);
    await Promise.all([
      img(from, '/gpc/x.gif', 'hdr_img_self'), img(H.B, '/gpc/x.gif', 'hdr_img_b'), script(H.B, '/gpc/x.js', 'hdr_script_b'),
      get(from, '/gpc/echo', 'hdr_fetch_self'), get(H.B, '/gpc/echo', 'hdr_fetch_b'), xhr(from, '/gpc/x.xhr', 'hdr_xhr_self'),
    ]);
    await sleep(2500);
    log('visibility_at_end', document.visibilityState);
    post({ kind: 'page', results, ua: navigator.userAgent });
    if (out) out.textContent = 'DONE ' + JSON.stringify({ run, from, results }, null, 1);
  })().catch((e) => post({ kind: 'page-error', err: String(e), results }));
})();
"""


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec='milliseconds')


class Handler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    server_version = 'nullecho-verify/1'
    log_dir = DEFAULT_LOG_DIR
    port = 47301
    lock = threading.Lock()

    def log_message(self, *a):  # the jsonl is the log
        pass

    def _append(self, name, obj):
        with self.lock:
            with open(os.path.join(self.log_dir, name), 'a') as f:
                f.write(json.dumps(obj, separators=(',', ':')) + '\n')

    def _send(self, status, ctype, body):
        if isinstance(body, str):
            body = body.encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', ctype)
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        origin = self.headers.get('Origin')
        self.send_header('Access-Control-Allow-Origin', origin or '*')
        if origin:
            self.send_header('Vary', 'Origin')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._handle(None)

    def do_GET(self):
        self._handle(None)

    def do_POST(self):
        n = int(self.headers.get('Content-Length') or 0)
        self._handle((self.rfile.read(n) if n else b'').decode('utf-8', 'replace'))

    def _handle(self, body):
        u = urllib.parse.urlsplit(self.path)
        q = urllib.parse.parse_qs(u.query)
        rec = {'iso': now_iso(), 'method': self.command, 'host': self.headers.get('Host'), 'path': self.path,
               'headers': [[k, v] for k, v in self.headers.items()]}
        self._append('requests.jsonl', rec)
        path = u.path
        if self.command == 'OPTIONS':
            return self._send(204, 'text/plain', b'')
        if path == '/report':
            try:
                obj = json.loads(body or 'null')
            except Exception:
                obj = {'unparsed': body}
            self._append('reports.jsonl', {'iso': rec['iso'], 'host': rec['host'], 'report': obj})
            return self._send(200, 'application/json', '{"ok":true}')
        if path == '/ping':
            return self._send(200, 'text/plain', 'pong ' + rec['iso'])
        if path == '/blocking-proof.html':
            with open(os.path.join(REPO, 'harness', 'blocking-proof.html'), 'rb') as f:
                return self._send(200, 'text/html; charset=utf-8', f.read())
        if path.endswith('.gif'):
            return self._send(200, 'image/gif', GIF)
        if path.endswith('.js') and path != '/page.js':
            return self._send(200, 'application/javascript', 'window.__scripts=(window.__scripts||[]).concat([%s]);' % json.dumps(self.path))
        if path == '/page.js':
            return self._send(200, 'application/javascript', PAGE_JS)
        if path == '/page':
            cfg = {'hosts': HOSTS, 'port': self.port, 'run': q.get('run', [''])[0]}
            html = ('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
                    '<script>window.__first = { gpc: navigator.globalPrivacyControl, typeofGpc: typeof navigator.globalPrivacyControl,'
                    ' has: "globalPrivacyControl" in Navigator.prototype, readyState: document.readyState, scripts: document.scripts.length };'
                    'window.__CFG = %s;</script><title>Nullecho GPC fixture</title></head>'
                    '<body><h1 style="font:16px system-ui">Nullecho GPC fixture on %s, run=%s</h1>'
                    '<pre id="out" style="font-size:10px;white-space:pre-wrap">running...</pre><script src="/page.js"></script></body></html>'
                    % (json.dumps(cfg), self.headers.get('Host'), cfg['run']))
            return self._send(200, 'text/html; charset=utf-8', html)
        if path == '/frame':
            html = ('<!doctype html><html><head><meta charset="utf-8"><script>window.__f = { gpc: navigator.globalPrivacyControl,'
                    ' has: "globalPrivacyControl" in Navigator.prototype, readyState: document.readyState };</script></head><body>frame<script>'
                    '(function(){ var q = new URLSearchParams(location.search); var rep = { kind: "frame", run: q.get("run"), href: location.href,'
                    ' first: window.__f, now: navigator.globalPrivacyControl, visibility: document.visibilityState };'
                    ' try { parent.postMessage({ gpcFrame: "crossorigin", value: rep.now, first: rep.first }, "*"); } catch (e) {}'
                    ' fetch("/report", { method: "POST", cache: "no-store", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(rep) }); })();'
                    '</script></body></html>')
            return self._send(200, 'text/html; charset=utf-8', html)
        return self._send(200, 'application/json', json.dumps({'host': rec['host'], 'path': self.path, 'headers': rec['headers']}))


def summary(log_dir, run):
    """Print pass/fail for one run. Expectations are the extension ON with website access granted;
    for an OFF run read the table with the expectations inverted (the script says which)."""
    def load(name):
        p = os.path.join(log_dir, name)
        if not os.path.exists(p):
            return []
        return [json.loads(l) for l in open(p) if l.strip()]
    reqs = load('requests.jsonl')
    reps = load('reports.jsonl')
    gpc = {}
    for r in reqs:
        u = urllib.parse.urlsplit(r['path'])
        q = urllib.parse.parse_qs(u.query)
        if q.get('run', [''])[0] != run:
            continue
        k = q.get('k', ['?'])[0]
        gpc[k] = next((v for kk, v in r['headers'] if kk.lower() == 'sec-gpc'), None)
    page = next((x['report'] for x in reversed(reps) if x['report'].get('kind') == 'page' and x['report'].get('run') == run), None)
    frame = next((x['report'] for x in reversed(reps) if x['report'].get('kind') == 'frame' and x['report'].get('run') == run), None)
    if not page:
        print('no page report for run', run, '- open http://a.lvh.me:PORT/page?run=%s and wait ~6 s with the tab in front' % run)
        return 1
    res = page['results']
    print('run %s  visibility=%s  (a report taken from a hidden tab is not valid)' % (run, page.get('visibility')))
    rows = [
        ('header: Sec-GPC on image (same site)', gpc.get('hdr_img_self'), '1'),
        ('header: Sec-GPC on image (third party)', gpc.get('hdr_img_b'), '1'),
        ('header: Sec-GPC on script', gpc.get('hdr_script_b'), '1'),
        ('header: Sec-GPC on fetch (Safari: expected absent)', gpc.get('hdr_fetch_self'), None),
        ('header: Sec-GPC on XHR (Safari: expected absent)', gpc.get('hdr_xhr_self'), None),
        ('header: Sec-GPC on the document (Safari: expected absent)', gpc.get('?'), None),
        ('JS: top frame, first inline script', (res.get('gpc_top') or {}).get('first', {}).get('gpc'), True),
        ('JS: top frame, later', (res.get('gpc_top') or {}).get('now'), True),
        ('JS: after forged handshakes from page script', res.get('gpc_after_forge'), True),
        ('JS: getter name', ((res.get('gpc_top') or {}).get('desc') or {}).get('getName'), 'get globalPrivacyControl'),
        ('JS: cross-origin iframe', (res.get('gpc_frame_crossorigin') or {}).get('value', frame and frame.get('now')), True),
        ('JS: srcdoc iframe', (res.get('gpc_frame_srcdoc') or {}).get('value'), True),
        ('JS: about:blank iframe at its load event', (res.get('gpc_aboutblank_load') or {}).get('value'), True),
        ('JS: about:blank iframe 500 ms later', (res.get('gpc_child_500ms') or {}).get('value'), True),
        ('JS: same-tick child realm (see VERIFY-MACOS.md for what a miss means)', (res.get('gpc_child_sametick') or {}).get('value'), True),
    ]
    status = 0
    for label, got, want in rows:
        ok = got == want
        status |= 0 if ok else 1
        print('  %-70s got=%-10s want=%-6s %s' % (label, json.dumps(got), json.dumps(want), 'PASS' if ok else 'FAIL'))
    return status


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--port', type=int, default=47301)
    ap.add_argument('--log-dir', default=DEFAULT_LOG_DIR)
    ap.add_argument('--summary', metavar='RUN')
    a = ap.parse_args()
    os.makedirs(a.log_dir, exist_ok=True)
    if a.summary:
        sys.exit(summary(a.log_dir, a.summary))
    Handler.log_dir = a.log_dir
    Handler.port = a.port
    srv = ThreadingHTTPServer(('127.0.0.1', a.port), Handler)
    srv.daemon_threads = True
    print('listening on 127.0.0.1:%d  (log: %s)' % (a.port, a.log_dir), flush=True)
    print('open  http://a.lvh.me:%d/page?run=mac-on   and   http://a.lvh.me:%d/blocking-proof.html' % (a.port, a.port), flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
