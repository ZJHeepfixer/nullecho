// tesla.com under Akamai Bot Manager: one labelled run per extension variant, with the evidence saved.
// Usage: NULLECHO_PUPPETEER_DIR=<dir> node run-tesla.mjs <outDir> label=extDir|none ...
// Headful Chrome for Testing, automation flags off (navigator.webdriver false); fresh profile per run.
import { createRequire } from 'node:module';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const PUPPETEER_DIR = process.env.NULLECHO_PUPPETEER_DIR; // a directory whose node_modules holds puppeteer (as harness/unpacked-chrome.mjs --puppeteer)
if (!PUPPETEER_DIR) { console.error('set NULLECHO_PUPPETEER_DIR to a directory whose node_modules holds puppeteer'); process.exit(2); }
const puppeteer = createRequire(path.join(PUPPETEER_DIR, 'package.json'))('puppeteer');
const OUT = process.argv[2]; const runs = process.argv.slice(3);
const URL = 'https://www.tesla.com/';
const cookieName = (line) => line.split(';')[0].split('=')[0].trim();
async function run(label, ext) {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ne-tesla4-'));
  const args = ['--no-first-run', '--window-size=1280,900', '--disable-blink-features=AutomationControlled'];
  if (ext) args.push(`--disable-extensions-except=${ext}`, `--load-extension=${ext}`);
  const browser = await puppeteer.launch({ headless: false, userDataDir, args, ignoreDefaultArgs: ['--enable-automation', '--disable-extensions'] });
  const page = (await browser.pages())[0] || await browser.newPage();
  const cdp = await page.target().createCDPSession(); await cdp.send('Network.enable');
  const reqs = new Map(); const docs = []; const docIds = new Set(); const failed = []; const navHeaders = [];
  cdp.on('Network.requestWillBeSent', (e) => { reqs.set(e.requestId, { url: e.request.url, type: e.type }); if (e.type === 'Document') docIds.add(e.requestId); });
  cdp.on('Network.requestWillBeSentExtraInfo', (e) => { if (docIds.has(e.requestId)) navHeaders.push(Object.fromEntries(Object.entries(e.headers).filter(([k]) => /^(sec-ch-ua|sec-gpc|user-agent|accept|cookie)/i.test(k)).map(([k, v]) => [k, String(v).slice(0, 160)]))); });
  cdp.on('Network.responseReceived', (e) => { if (e.type === 'Document') docs.push({ requestId: e.requestId, url: e.response.url, status: e.response.status, server: e.response.headers.server || e.response.headers.Server || '', setCookieNames: [] }); });
  cdp.on('Network.responseReceivedExtraInfo', (e) => { const d = docs.find((x) => x.requestId === e.requestId); if (!d) return; const sc = e.headers['set-cookie'] || e.headers['Set-Cookie']; if (sc) d.setCookieNames = String(sc).split('\n').map(cookieName); const h = e.headers; d.responseHeaders = Object.fromEntries(Object.entries(h).filter(([k]) => /^(server|x-akamai|akamai|x-cache|content-type|location|accept-ch|critical-ch|cache-control)/i.test(k)).map(([k, v]) => [k, String(v).slice(0, 200)])); });
  cdp.on('Network.loadingFailed', (e) => { const r = reqs.get(e.requestId) || {}; failed.push({ url: r.url, type: r.type, error: e.errorText }); });
  let navError = null;
  try { await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 }); } catch (e) { navError = e.message.split('\n')[0]; }
  await new Promise((r) => setTimeout(r, 5000));
  const info = await page.evaluate(() => ({ title: document.title, href: location.href, text: (document.body?.innerText || '').replace(/\s+/g, ' ').slice(0, 300), webdriver: navigator.webdriver, gpc: navigator.globalPrivacyControl ?? null, ua: navigator.userAgent }));
  const cookies = (await cdp.send('Network.getCookies', { urls: [URL] })).cookies.map((c) => c.name);
  await page.screenshot({ path: path.join(OUT, `${label}.png`) });
  const blocked = failed.filter((f) => /BLOCKED_BY_CLIENT/.test(f.error)).map((f) => f.url);
  const verdict = info.title.includes('Access Denied') ? 'DENIED' : 'OK';
  const record = { label, extension: ext ? path.basename(ext) : null, verdict, navError, documents: docs.map(({ requestId, ...d }) => d), navigationRequestHeaders: navHeaders.slice(0, 3), cookiesAfterLoad: cookies, blockedByClient: blocked, otherFailures: failed.filter((f) => !/BLOCKED_BY_CLIENT/.test(f.error)).slice(0, 10), page: info, capturedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(OUT, `${label}.json`), JSON.stringify(record, null, 2));
  console.log(`== ${label.padEnd(12)} ${verdict.padEnd(7)} docs ${docs.map((d) => `${d.status}${d.server ? ' ' + d.server : ''} [${d.setCookieNames.join(',')}]`).join(' → ')} | gpc ${info.gpc} | cookies after: ${cookies.join(',')}`);
  await browser.close(); fs.rmSync(userDataDir, { recursive: true, force: true });
}
for (const r of runs) { const [label, dir] = r.split('='); await run(label, dir === 'none' ? null : dir); }
console.log('RECORD-DONE');
