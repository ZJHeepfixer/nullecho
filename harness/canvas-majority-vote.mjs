#!/usr/bin/env node
/**
 * Canvas majority-vote attack against Nullecho's canvas noise — a port of Algorithm 3 ("The Statistical
 * Attack") from:
 *
 *   Hoang Dai Nguyen and Phani Vadrevu. "Breaking the Shield: Analyzing and Attacking Canvas
 *   Fingerprinting Defenses in the Wild." The ACM Web Conference 2025 (WWW '25), Sydney, pp. 4337-4344.
 *   doi:10.1145/3696410.3714713. https://www.phanivadrevu.com/files/papers/canvas_fp.pdf (CC BY 4.0)
 *
 * The paper broke Brave's farbling — whose noise is keyed on session + domain + CANVAS CONTENT — by drawing
 * the same content on 5 canvases of 500x400, each with a unique-colour 500x10 rectangle on top, reading the
 * region excluding that rectangle with getImageData(), and taking, per pixel and per R/G/B channel, the value
 * present in at least 3 of the 5 reads. Nullecho's kernel (shim.js `noiseRGBA`, DECISIONS.md D22) is keyed on
 * persona key + canvas size + a digest of the WHOLE canvas + position: the same family. This measures it.
 *
 *   NULLECHO_PUPPETEER_DIR=/Users/jasonluker/bodybuilding node harness/canvas-majority-vote.mjs
 *     --trials <n>      trials per (persona, origin, N) cell for the real extension   (default 10)
 *     --ns 5,9,21       canvas counts                                                  (default 5,9,21)
 *     --default-trials  trials per cell with Chrome's DEFAULT canvases, one fresh page each   (default 5)
 *     --ext <dir>       unpacked extension to test (default: a temp COPY of ext/, so Chrome's _metadata
 *                       write-back never lands in the repo)
 *     --package         build the store zip (node ext/tools/package.mjs), unzip it, test THAT
 *     --skip-kernels    skip the in-page kernel matrix (controls + mitigation prototypes)
 *     --json <file>     write every raw result (default: research/canvas-majority-vote/run-<date>.json)
 *     --headful
 *
 * WHAT RUNS (Chrome for Testing, Puppeteer, every page on http://alpha.test and http://bravo.test, both
 * resolved to loopback with --host-resolver-rules; nothing leaves the machine):
 *   1. GROUND TRUTH — a browser with NO extension renders the page on both origins; the 500x400 region of a
 *      plain read is the truth. `sharedCheck` proves the shared region is byte-identical across every strip
 *      colour, every blit offset (translate variant) and every undone colour shift (colour-shift variant).
 *   2. THE REAL EXTENSION — two browsers, two fresh profiles, hence two independently generated salts
 *      (= two personas). In each, on each origin: the negative control (one read must NOT equal the truth),
 *      Algorithm 3 at N in --ns with strict-majority and plurality votes, the translate variant, the A1
 *      uniform-fill subtraction, and the Worker read (gap G1). An isolated-world read of the page's own
 *      canvas, through CDP, re-derives the truth INSIDE the extension browser and must equal (1).
 *   3. IN-PAGE KERNELS (extension OFF, `?kernel=`): the POSITIVE CONTROL (a Brave-shaped weak noise the
 *      attack must beat), an extracted copy of the shipped kernel (must behave like the real extension),
 *      the pre-D22 position-only kernel (the A1 subtraction must beat it — the A1 positive control), and the
 *      mitigation prototypes, each against every attack.
 *
 * Exit code: 0 when every control behaved (the result itself can be "the attack works"), 1 when a control
 * failed — then no number in the run means anything — and 2 on setup errors.
 */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const flag = (n) => argv.includes(n);
const TRIALS = Number(opt('--trials', '10'));
const DTRIALS = Number(opt('--default-trials', '5'));
const ONLY_KERNELS = opt('--kernels', null);          // debugging: a comma list of in-page kernels to run
const SKIP_EXTENSION = flag('--skip-extension');      // debugging: OFF browser only (truth, controls, kernels)
const NS = opt('--ns', '5,9,21').split(',').map(Number);
const HEADFUL = flag('--headful');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const JSON_OUT = opt('--json', path.join(REPO, 'research', 'canvas-majority-vote', `run-${today()}.json`));
const ORIGINS = ['alpha.test', 'bravo.test'];
const log = (...a) => console.error('[mv]', ...a);

function loadPuppeteer() {
  const dirs = [opt('--puppeteer', null), process.env.NULLECHO_PUPPETEER_DIR].filter(Boolean);
  for (const t of [() => createRequire(import.meta.url), ...dirs.map((d) => () => createRequire(path.join(path.resolve(d), 'package.json')))]) {
    try { const r = t(); return { pp: r('puppeteer'), version: (() => { try { return r('puppeteer/package.json').version; } catch { return '?'; } })() }; } catch { /* next */ }
  }
  console.error('puppeteer not found: pass --puppeteer <dir> or set NULLECHO_PUPPETEER_DIR'); process.exit(2);
}
const { pp: puppeteer, version: PUPPETEER_VERSION } = loadPuppeteer();

// ── the extension under test ────────────────────────────────────────────────
function extensionDir() {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'nullecho-mv-'));
  if (flag('--package')) {
    execFileSync('node', ['tools/package.mjs'], { cwd: path.join(REPO, 'ext'), stdio: ['ignore', 'ignore', 'inherit'] });
    const v = JSON.parse(fs.readFileSync(path.join(REPO, 'ext', 'manifest.json'), 'utf8')).version;
    const zip = path.join(REPO, 'dist', `nullecho-${v}-chrome.zip`);
    execFileSync('unzip', ['-q', zip, '-d', path.join(work, 'ext')]);
    return { dir: path.join(work, 'ext'), label: `package ${path.basename(zip)} sha256 ${crypto.createHash('sha256').update(fs.readFileSync(zip)).digest('hex').slice(0, 16)}`, work };
  }
  const given = opt('--ext', null);
  const src = given ? path.resolve(given) : path.join(REPO, 'ext');
  fs.cpSync(src, path.join(work, 'ext'), { recursive: true, filter: (p) => !/node_modules|_metadata/.test(p) });
  return { dir: path.join(work, 'ext'), label: given ? `--ext ${src}` : 'copy of ext/', work };
}

// ── in-page kernels, built from the SHIPPED shim.js text (never a hand copy) ──
function kernelsJs(shimPath) {
  const shim = fs.readFileSync(shimPath, 'utf8');
  const grab = (re, label) => { const m = shim.match(re); if (!m) throw new Error(`kernel extraction failed: ${label}`); return m[0]; };
  const prfBlock = grab(/function fin32\(x\) \{[\s\S]*?\n {2}function keyMix\(key, a, b\) \{[^\n]*\}/, 'fin32..keyMix');
  const scanBlock = grab(/const facts = \{ ink: false, digest: 0 \};[\s\S]*?function scanRGBA\(data\) \{[^\n]*\}/, 'facts..scanRGBA');
  const contentKey = grab(/function contentKey\(base, a, b, digest\) \{[^\n]*\}/, 'contentKey');
  const noise = grab(/function noiseRGBA\(data, canvasW, key, ox, oy, w, h\) \{[\s\S]*?\n {2}\}\n/, 'noiseRGBA');
  return `// GENERATED by harness/canvas-majority-vote.mjs from ${path.relative(REPO, shimPath)} — test-only, never shipped.
(() => {
'use strict';
const mathImul = Math.imul, mathFloor = Math.floor, taLength = (a) => a.length;
${prfBlock}
${scanBlock}
${contentKey}
${noise}
/** noiseRGBA's per-pixel rule, verbatim, for kernels that select pixels differently. */
function perturb(data, p, hh) {
  for (let c = 0; c < 3; c++) {
    const bits = hh >>> (8 + c * 3);
    const mag = 1 + (bits & 1);
    const sign = (bits & 2) ? 1 : -1;
    const v = data[p + c];
    let n = v + sign * mag;
    if (n < 0 || n > 255) n = v - sign * mag;
    if (n < 0) n = 0; else if (n > 255) n = 255;
    data[p + c] = n;
  }
}
const rgbaAt = (full, CW, x, y) => { const q = (y * CW + x) * 4; return ((full[q] << 24) | (full[q + 1] << 16) | (full[q + 2] << 8) | full[q + 3]) >>> 0; };
const Q = new URLSearchParams(location.search);
const NAME = Q.get('kernel'), BASE = (Number(Q.get('key')) >>> 0) || 0x2545f491;
const seen = new Set();
const KERNELS = {
  /** The shipped kernel, extracted: whole-canvas digest (D22). */
  nullecho(data, ox, oy, iw, ih, full, CW, CH) {
    scanRGBA(full); if (!facts.ink) return;
    noiseRGBA(data, CW, contentKey(BASE, CW, CH, facts.digest), ox, oy, iw, ih);
  },
  /** Pre-D22: key = persona × size only. The A1 subtraction's positive control. */
  'pos-only'(data, ox, oy, iw, ih, full, CW, CH) {
    scanRGBA(full); if (!facts.ink) return;
    noiseRGBA(data, CW, keyMix(BASE, CW, CH), ox, oy, iw, ih);
  },
  /** Prototype: per pixel, keyed on its absolute (x, y) and its OWN real value. No digest, no size. */
  'pos-value'(data, ox, oy, iw, ih, full, CW, CH) {
    scanRGBA(full); if (!facts.ink) return;
    for (let r = 0; r < ih; r++) for (let c = 0; c < iw; c++) {
      const x = ox + c, y = oy + r, hh = prf(keyMix(BASE, rgbaAt(full, CW, x, y), x), y);
      if ((hh & 7) === 0) perturb(data, (r * iw + c) * 4, hh);
    }
  },
  /** Prototype: per pixel, keyed on its own real value ONLY — a per-persona colour table. */
  'value-lut'(data, ox, oy, iw, ih, full, CW, CH) {
    scanRGBA(full); if (!facts.ink) return;
    for (let r = 0; r < ih; r++) for (let c = 0; c < iw; c++) {
      const hh = prf(BASE, rgbaAt(full, CW, ox + c, oy + r) | 0);
      if ((hh & 7) === 0) perturb(data, (r * iw + c) * 4, hh);
    }
  },
  /** Prototype: region keying — a digest per absolute 16×16 tile, position within the tile. */
  tile16(data, ox, oy, iw, ih, full, CW, CH) {
    scanRGBA(full); if (!facts.ink) return;
    const TW = Math.ceil(CW / 16), TH = Math.ceil(CH / 16), dig = new Uint32Array(TW * TH);
    for (let ty = 0; ty < TH; ty++) for (let tx = 0; tx < TW; tx++) {
      let h = 0x811c9dc5;
      for (let y = ty * 16; y < Math.min(CH, ty * 16 + 16); y++) for (let x = tx * 16; x < Math.min(CW, tx * 16 + 16); x++) {
        const q = (y * CW + x) * 4;
        for (let k = 0; k < 4; k++) h = Math.imul(h ^ full[q + k], 0x01000193) >>> 0;
      }
      dig[ty * TW + tx] = fin32(h);
    }
    for (let r = 0; r < ih; r++) for (let c = 0; c < iw; c++) {
      const x = ox + c, y = oy + r, tx = x >> 4, ty = y >> 4;
      const hh = prf(keyMix(BASE, dig[ty * TW + tx], (tx << 16) | ty), ((y & 15) << 4) | (x & 15));
      if ((hh & 7) === 0) perturb(data, (r * iw + c) * 4, hh);
    }
  },
  /**
   * Prototype: the shipped kernel plus a per-document budget of 2 distinct canvases between user
   * activations (Brave's announced direction); past it, a new canvas reads back blank. The budget
   * refills on each NEW trusted pointerdown/keydown — not while userActivation.isActive, which
   * stays true for seconds after one click (and for every Puppeteer evaluate, which runs with
   * userGesture: true — the first run of this prototype measured nothing because of that).
   */
  budget2(data, ox, oy, iw, ih, full, CW, CH) {
    scanRGBA(full); if (!facts.ink) return;
    const tag = CW + 'x' + CH + ':' + facts.digest;
    if (!seen.has(tag)) { if (seen.size >= 2) { data.fill(0); return; } seen.add(tag); }
    noiseRGBA(data, CW, contentKey(BASE, CW, CH, facts.digest), ox, oy, iw, ih);
  },
  /**
   * POSITIVE CONTROL — Brave-shaped weak noise (the paper's Algorithm 2 structure): one channel chosen by a
   * domain byte, a 256-bit canvas key from (session⊕domain, CONTENT), each key bit XORed into that channel's
   * LSB at a pseudo-randomly walked pixel. FNV/xorshift stand in for HMAC-SHA256/LFSR. ≤ 256 pixels change.
   */
  'brave-like'(data, ox, oy, iw, ih, full, CW, CH) {
    scanRGBA(full); if (!facts.ink) return;
    const ck = contentKey(BASE, CW, CH, facts.digest), channel = (BASE & 255) % 3, count = CW * CH;
    let v = prf(ck, 1000) || 1;
    for (let b = 0; b < 32; b++) {
      let byte = prf(ck, b) & 255;
      for (let j = 7; j >= 0; j--) {
        const lsb = byte & 1, pix = v % count, x = pix % CW, y = (pix / CW) | 0;
        if (lsb && x >= ox && x < ox + iw && y >= oy && y < oy + ih) data[((y - oy) * iw + (x - ox)) * 4 + channel] ^= 1;
        byte >>= 1;
        v ^= v << 13; v >>>= 0; v ^= v >>> 17; v ^= v << 5; v >>>= 0;
      }
    }
  },
};
for (const t of ['pointerdown', 'keydown']) addEventListener(t, (e) => { if (e.isTrusted) seen.clear(); }, true);
const run = KERNELS[NAME];
if (!run) throw new Error('unknown kernel ' + NAME);
const proto = CanvasRenderingContext2D.prototype, orig = proto.getImageData;
proto.getImageData = function getImageData(sx, sy, sw, sh) {
  const img = orig.apply(this, arguments);
  const CW = this.canvas.width, CH = this.canvas.height, iw = img.width, ih = img.height;
  const ox = sw < 0 ? (sx | 0) + (sw | 0) : (sx | 0), oy = sh < 0 ? (sy | 0) + (sh | 0) : (sy | 0);
  const whole = ox === 0 && oy === 0 && iw === CW && ih === CH;
  const full = whole ? img.data.slice() : orig.call(this, 0, 0, CW, CH).data;
  run(img.data, ox, oy, iw, ih, full, CW, CH);
  return img;
};
window.__kernel = NAME;
})();
`;
}

// ── a loopback server for the attack page + generated kernels ───────────────
function serve(kernels) {
  const page = fs.readFileSync(path.join(HERE, 'canvas-majority-vote.html'));
  const srv = http.createServer((q, r) => {
    const u = new URL(q.url, 'http://x');
    if (u.pathname === '/harness/canvas-majority-vote.html') { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); r.end(page); return; }
    if (u.pathname === '/harness/canvas-kernels.js') { r.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' }); r.end(kernels); return; }
    r.writeHead(404); r.end();
  }).listen(0, '127.0.0.1');
  return new Promise((res) => srv.on('listening', () => res({ srv, port: srv.address().port })));
}

async function launch({ extDir, profile }) {
  const args = ['--no-first-run', '--no-default-browser-check', '--window-size=1200,900',
    `--host-resolver-rules=MAP alpha.test 127.0.0.1, MAP bravo.test 127.0.0.1`];
  if (extDir) args.push(`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`);
  const browser = await puppeteer.launch({
    headless: !HEADFUL, pipe: true, enableExtensions: !!extDir, protocolTimeout: 300000,
    ignoreDefaultArgs: extDir ? ['--disable-extensions'] : [], args, userDataDir: profile,
  });
  let worker = null;
  if (extDir) {
    const sw = await browser.waitForTarget((t) => t.type() === 'service_worker' && /\/src\/background\.js$/.test(t.url()), { timeout: 20000 });
    worker = await sw.worker();
    await new Promise((r) => setTimeout(r, 1500));
    // First install opens the options page over everything; close it (the 2026-09-20 hidden-tab lesson).
    for (const p of await browser.pages()) if (p.url().startsWith('chrome-extension://')) await p.close();
  }
  return { browser, worker, version: await browser.version() };
}

async function openPage(browser, url, settleMs) {
  const p = await browser.newPage();
  await p.bringToFront();
  for (const q of await browser.pages()) if (q !== p && q.url().startsWith('chrome-extension://')) await q.close();
  await p.goto(url, { waitUntil: 'load', timeout: 60000 });
  await new Promise((r) => setTimeout(r, settleMs));
  const env = await p.evaluate(() => ({ ua: navigator.userAgent, visible: document.visibilityState, kernel: window.__kernel || null }));
  return { p, env };
}

/** The page's own F1 canvas, read from a CDP isolated world: the shim lives in MAIN only, so this is the native read. */
async function isolatedTruthHash(page) {
  const cdp = await page.createCDPSession();
  const { frameTree } = await cdp.send('Page.getFrameTree');
  const { executionContextId } = await cdp.send('Page.createIsolatedWorld', { frameId: frameTree.frame.id, worldName: 'mv-truth' });
  const expr = `(() => {
    const c = document.querySelector('#keep canvas'); if (!c) return null;
    const u8 = c.getContext('2d').getImageData(0, 10, 500, 400).data;
    let h1 = 0x811c9dc5 ^ u8.length, h2 = 0x01000193;
    for (let i = 0; i < u8.length; i++) { const v = u8[i]; h1 = Math.imul(h1 ^ v, 0x01000193); h2 = Math.imul(h2 ^ v, 0x5bd1e995) ^ (h2 >>> 15); }
    return ((h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0'));
  })()`;
  const r = await cdp.send('Runtime.evaluate', { expression: expr, contextId: executionContextId, returnByValue: true });
  await cdp.detach();
  return r.result.value;
}

const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[(s.length - 1) >> 1] : null; };
const pct = (k, n) => `${k}/${n}`;

// ════════════════════════════════════════════════════════════════════════════
const failures = [];
const control = (ok, what) => { if (!ok) failures.push(what); log(`${ok ? 'PASS' : 'FAIL'} control: ${what}`); };
const out = { date: today(), paper: 'Nguyen & Vadrevu, WWW 2025, doi:10.1145/3696410.3714713, Algorithm 3', trials: TRIALS, ns: NS, puppeteer: PUPPETEER_VERSION };
try {
  // Which code ran: `-dirty` means ext/ or harness/ had uncommitted edits, so the run is not any commit.
  const git = (...a) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  out.commit = git('rev-parse', '--short=7', 'HEAD') + (git('status', '--porcelain', '--', 'ext', 'harness').length ? '-dirty' : '');
} catch { out.commit = 'nogit'; }

const ext = extensionDir();
const SHIM_PATH = path.join(ext.dir, 'src', 'shim.js');
const kernels = kernelsJs(SHIM_PATH);
const { srv, port } = await serve(kernels);
const url = (origin, q = '') => `http://${origin}:${port}/harness/canvas-majority-vote.html${q}`;
out.extension = ext.label;
log(`extension under test: ${ext.label}`);

// ── 1. ground truth, extension OFF ──────────────────────────────────────────
const off = await launch({ extDir: null, profile: fs.mkdtempSync(path.join(os.tmpdir(), 'nullecho-mv-off-')) });
out.chrome = off.version;
log(`Chrome: ${off.version}`);
const truth = {};
out.off = {};
for (const o of ORIGINS) {
  const { p, env } = await openPage(off.browser, url(o), 200);
  truth[o] = await p.evaluate(() => __mv.truthB64());
  await p.evaluate((t) => __mv.setTruth(t), truth[o]);
  const shared = await p.evaluate((n) => __mv.sharedCheck(n), Math.max(...NS));
  const workerB64 = await p.evaluate(() => __mv.workerB64());
  const plainStrip = await p.evaluate(() => __mv.strip({ N: 5, trial: 1 }));
  out.off[o] = { env, shared, truthHash: shared.hash, workerHash: crypto.createHash('sha256').update(workerB64).digest('hex').slice(0, 16), workerEqualsMain: workerB64 === truth[o], unnoisedVoteExact: plainStrip.modes.majority.exact };
  out.off[o].workerB64 = workerB64;
  await p.close();
}
control(truth[ORIGINS[0]] === truth[ORIGINS[1]], 'extension OFF: the truth is identical on both origins');
// Chrome's DEFAULT (GPU-backed) canvases render differently from CPU-backed ones; that grid has its own truth.
const truthDefault = {};
for (const o of ORIGINS) {
  const { p } = await openPage(off.browser, url(o, '?ctx=default'), 200);
  truthDefault[o] = await p.evaluate(() => __mv.truthB64());
  await p.evaluate((t) => __mv.setTruth(t), truthDefault[o]);
  out.off[o].default = { truthHash: (await p.evaluate(() => __mv.single())).hash, sharedStrip: (await p.evaluate((n) => __mv.sharedCheck(n), Math.max(...NS))).strip };
  await p.close();
}
control(truthDefault[ORIGINS[0]] === truthDefault[ORIGINS[1]], 'extension OFF, default canvases: the truth is identical on both origins');
for (const o of ORIGINS) control(out.off[o].default.sharedStrip, `extension OFF (${o}), default canvases: every strip colour leaves the shared region byte-identical`);
out.cpuVsDefaultTruthDiffer = truthDefault[ORIGINS[0]] !== truth[ORIGINS[0]];
for (const o of ORIGINS) {
  control(out.off[o].shared.strip, `extension OFF (${o}): every strip colour leaves the shared region byte-identical`);
  control(out.off[o].shared.translate, `extension OFF (${o}): every blit offset leaves the region byte-identical (translate variant is exact)`);
  control(out.off[o].shared.colourshiftMismatches === 0, `extension OFF (${o}): undoing every colour shift gives the truth exactly (colour-shift variant is exact; ${out.off[o].shared.colourshiftAbstentions} abstentions)`);
  control(out.off[o].unnoisedVoteExact, `extension OFF (${o}): the vote over un-noised reads reproduces the truth (the scorer works)`);
}
const TRUTH = truth[ORIGINS[0]];

// ── 3a. in-page kernels (extension OFF): positive controls + prototypes ─────
out.kernels = {};
if (!flag('--skip-kernels')) {
  const KTRIALS = Math.max(3, Math.min(TRIALS, 5));
  const plan = [
    ['brave-like', ['single', 'strip', 'translate', 'subtract']],
    ['nullecho', ['single', 'strip', 'translate', 'colourshift', 'subtract']],
    ['pos-only', ['single', 'strip', 'subtract']],
    ['pos-value', ['single', 'strip', 'translate', 'colourshift', 'subtract']],
    ['tile16', ['single', 'strip', 'translate', 'subtract']],
    ['value-lut', ['single', 'strip', 'translate', 'colourshift', 'subtract']],
    ['budget2', ['single', 'strip', 'frames', 'subtract']],
  ];
  for (const [name, attacks] of plan) {
    if (ONLY_KERNELS && !ONLY_KERNELS.split(',').includes(name)) continue;
    out.kernels[name] = {};
    for (const key of [0x2545f491, 0x9e3779b1]) {
      const { p, env } = await openPage(off.browser, url(ORIGINS[0], `?kernel=${name}&key=${key}`), 100);
      if (env.kernel !== name) throw new Error(`kernel ${name} did not install (${env.kernel})`);
      await p.evaluate((t) => __mv.setTruth(t), TRUTH);
      const rows = {};
      for (const a of attacks) {
        if (a === 'single') { rows.single = await p.evaluate(() => __mv.single()); continue; }
        if (a === 'subtract') { rows.subtract = await p.evaluate(() => __mv.subtract()); continue; }
        const ns = a === 'frames' ? [9, 21] : NS;
        for (const N of ns) {
          const runs = [];
          for (let t = 1; t <= KTRIALS; t++) runs.push(await p.evaluate((a2, N2, t2) => __mv[a2]({ N: N2, trial: t2 }), a, N, t));
          rows[`${a}:${N}`] = runs;
        }
      }
      out.kernels[name][key.toString(16)] = rows;
      await p.close();
      log(`kernel ${name} key ${key.toString(16)} done`);
    }
  }
  const K = out.kernels;
  const allExact = (rows, mode) => rows.every((r) => r.modes[mode].exact);
  for (const key of ONLY_KERNELS ? [] : Object.keys(K['brave-like'])) {
    control(!K['brave-like'][key].single.exact, `POSITIVE CONTROL (brave-like, key ${key}): one read differs from the truth (the control noise is on)`);
    control(allExact(K['brave-like'][key]['strip:5'], 'majority'), `POSITIVE CONTROL (brave-like, key ${key}): Algorithm 3 recovers the truth at N=5, strict majority, every trial`);
    const po = K['pos-only'][key].subtract, ne = K.nullecho[key].subtract;
    control(!K['pos-only'][key].single.exact && po.unambiguousErrors === 0, `A1 POSITIVE CONTROL (pre-D22 pos-only kernel, key ${key}): one read is noised AND the uniform-fill subtraction recovers every channel the kernel's clamp rule left recoverable (${po.channelErrors} wrong, all among ${po.ambiguousChannels} clamp-ambiguous)`);
    control(!ne.exact && ne.unambiguousErrors > 0, `A1 NEGATIVE CONTROL (shipped kernel extracted, key ${key}): the uniform-fill subtraction does NOT recover the truth — D22 still holds (${ne.unambiguousErrors} recoverable channels wrong)`);
  }
}
await off.browser.close();
if (SKIP_EXTENSION) {
  // Debugging path: exact-recovery counts per kernel and attack, nothing written.
  for (const [name, byKey] of Object.entries(out.kernels)) {
    for (const [key, rows] of Object.entries(byKey)) {
      const parts = Object.entries(rows).map(([k, v]) => Array.isArray(v)
        ? `${k} ${v.filter((r) => r.modes.plurality.exact).length}/${v.length}`
        : `${k} ${v.exact ? 'exact' : `${v.unambiguousErrors ?? v.channelErrors} wrong`}`);
      console.log(`${name} ${key}: ${parts.join(' · ')}`);
    }
  }
  console.log(failures.length ? `CONTROLS FAILED: ${failures.join(' | ')}` : 'controls ok');
  srv.close(); fs.rmSync(ext.work, { recursive: true, force: true });
  process.exit(failures.length ? 1 : 0);
}

// ── 2. the real extension: two personas × two origins ───────────────────────
out.on = {};
for (const persona of ['A', 'B']) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), `nullecho-mv-${persona}-`));
  const on = await launch({ extDir: ext.dir, profile });
  const id = await on.worker.evaluate(async () => (await chrome.storage.local.get('identity')).identity);
  const saltTag = crypto.createHash('sha256').update(String(id && id.salt)).digest('hex').slice(0, 8);
  out.on[persona] = { saltTag, chrome: on.version, origins: {} };
  log(`persona ${persona}: salt tag ${saltTag}`);
  for (const o of ORIGINS) {
    const { p, env } = await openPage(on.browser, url(o), 1500);
    await p.evaluate((t) => __mv.setTruth(t), TRUTH);
    const cell = { env };
    cell.single = await p.evaluate(() => __mv.single());
    cell.singleAgain = await p.evaluate(() => __mv.single());
    cell.strip = {};
    for (const N of NS) {
      const runs = [];
      for (let t = 1; t <= TRIALS; t++) runs.push(await p.evaluate((N2, t2) => __mv.strip({ N: N2, trial: t2 }), N, t));
      cell.strip[N] = runs;
      log(`persona ${persona} ${o} N=${N}: majority exact ${runs.filter((r) => r.modes.majority.exact).length}/${TRIALS}, plurality exact ${runs.filter((r) => r.modes.plurality.exact).length}/${TRIALS}`);
    }
    cell.isolatedTruthHash = await isolatedTruthHash(p);
    cell.translate = {};
    for (const N of NS.filter((n) => n >= 9)) {
      const runs = [];
      for (let t = 1; t <= Math.min(TRIALS, 5); t++) runs.push(await p.evaluate((N2, t2) => __mv.translate({ N: N2, trial: t2 }), N, t));
      cell.translate[N] = runs;
    }
    cell.subtract = await p.evaluate(() => __mv.subtract());
    const wb64 = await p.evaluate(() => __mv.workerB64());
    cell.worker = { hash: crypto.createHash('sha256').update(wb64).digest('hex').slice(0, 16), equalsOffWorker: wb64 === out.off[o].workerB64, equalsMainTruth: wb64 === TRUTH };
    await p.close();
    // Chrome's default canvases, the paper's setting: one fresh page per trial (see CONTEXT MODE in the page).
    cell.defaultStrip = {};
    for (const N of NS) {
      const runs = [];
      for (let t = 1; t <= DTRIALS; t++) {
        const fresh = await openPage(on.browser, url(o, '?ctx=default'), 1500);
        await fresh.p.evaluate((tr) => __mv.setTruth(tr), truthDefault[o]);
        const r = await fresh.p.evaluate((N2, t2) => __mv.strip({ N: N2, trial: t2 }), N, t);
        r.isolatedTruthOk = (await isolatedTruthHash(fresh.p)) === out.off[o].default.truthHash;
        r.visible = fresh.env.visible === 'visible';
        runs.push(r);
        await fresh.p.close();
      }
      cell.defaultStrip[N] = runs;
      log(`persona ${persona} ${o} DEFAULT canvases N=${N}: majority exact ${runs.filter((r) => r.modes.majority.exact).length}/${DTRIALS}, plurality exact ${runs.filter((r) => r.modes.plurality.exact).length}/${DTRIALS}`);
    }
    out.on[persona].origins[o] = cell;
  }
  await on.browser.close();
}
srv.close();

// ── controls on the extension runs ──────────────────────────────────────────
const cells = [];
for (const persona of ['A', 'B']) for (const o of ORIGINS) cells.push({ persona, o, c: out.on[persona].origins[o] });
const truthHash = out.off[ORIGINS[0]].truthHash;
for (const { persona, o, c } of cells) {
  control(c.env.visible === 'visible', `persona ${persona} ${o}: the tab was visible`);
  control(!c.single.exact, `NEGATIVE CONTROL persona ${persona} ${o}: one read with the extension ON differs from the truth (${c.single.pixelErrors} pixels)`);
  control(c.single.hash === c.singleAgain.hash, `persona ${persona} ${o}: a repeated read is byte-identical (the 50-reads property)`);
  control(c.isolatedTruthHash === truthHash, `persona ${persona} ${o}: the page's own canvas, read natively from an isolated world, equals the extension-OFF truth`);
  const d = Object.values(c.defaultStrip).flat();
  control(d.every((r) => r.isolatedTruthOk && r.visible), `persona ${persona} ${o}, default canvases: every fresh page was visible and its F1, read natively from an isolated world, equals the default-canvas truth`);
  control(d.every((r) => !r.f1.exact), `NEGATIVE CONTROL persona ${persona} ${o}, default canvases: F1 read through the extension differs from the truth in every trial`);
}
const singleHashes = new Set(cells.map(({ c }) => c.single.hash));
control(singleHashes.size === cells.length, `the four persona×origin cells read FOUR different single-read hashes (salted personas are in effect, not the salt-free fallback): ${singleHashes.size}`);
control(out.on.A.saltTag !== out.on.B.saltTag, 'the two profiles hold different salts');

// ── report ──────────────────────────────────────────────────────────────────
const lines = [];
lines.push(`Chrome ${out.chrome} · puppeteer ${PUPPETEER_VERSION} · commit ${out.commit} · ${ext.label} · trials ${TRIALS} · truth ${truthHash}`);
lines.push('');
lines.push('| Persona | Origin | N | Vote | Recovered = truth | Median channel errors | Median pixel errors | Median attack ms (draw+read+vote) | Median vote ms |');
lines.push('|---|---|---|---|---|---|---|---|---|');
for (const { persona, o, c } of cells) {
  for (const N of NS) for (const m of ['majority', 'plurality']) {
    const rs = c.strip[N].map((r) => r.modes[m]);
    lines.push(`| ${persona} | ${o} | ${N} | ${m} | ${pct(rs.filter((r) => r.exact).length, rs.length)} | ${median(rs.map((r) => r.channelErrors))} | ${median(rs.map((r) => r.pixelErrors))} | ${median(rs.map((r) => r.attackMs)).toFixed(0)} | ${median(rs.map((r) => r.voteMs)).toFixed(0)} |`);
  }
}
lines.push('');
lines.push(`Chrome's DEFAULT canvases (the paper's setting; truth ${out.off[ORIGINS[0]].default.truthHash}; one fresh page per trial):`);
lines.push('');
lines.push('| Persona | Origin | N | Vote | Recovered = truth | Median channel errors | Median attack ms |');
lines.push('|---|---|---|---|---|---|---|');
for (const { persona, o, c } of cells) {
  for (const N of NS) for (const m of ['majority', 'plurality']) {
    const rs = c.defaultStrip[N].map((r) => r.modes[m]);
    lines.push(`| ${persona} | ${o} | ${N} | ${m} | ${pct(rs.filter((r) => r.exact).length, rs.length)} | ${median(rs.map((r) => r.channelErrors))} | ${median(rs.map((r) => r.attackMs)).toFixed(0)} |`);
  }
}
lines.push('');
lines.push('| Persona | Origin | Single read: pixel errors | Translate N=9/21 plurality exact | A1 subtraction | Worker read = OFF worker read | Worker read = truth | Isolated-world truth ok |');
lines.push('|---|---|---|---|---|---|---|---|');
for (const { persona, o, c } of cells) {
  const tr = Object.entries(c.translate).map(([N, rs]) => `${N}: ${pct(rs.filter((r) => r.modes.plurality.exact).length, rs.length)}`).join(', ');
  lines.push(`| ${persona} | ${o} | ${c.single.pixelErrors} | ${tr} | ${c.subtract.unambiguousErrors === 0 ? 'recovered' : `fails (${c.subtract.unambiguousErrors} channels wrong)`} | ${c.worker.equalsOffWorker} | ${c.worker.equalsMainTruth} | ${c.isolatedTruthHash === truthHash} |`);
}
const recovered = new Set();
for (const { c } of cells) for (const N of NS) for (const r of c.strip[N]) if (r.modes.plurality.exact) recovered.add(r.modes.plurality.hash);
lines.push('');
lines.push(`Distinct single-read hashes across the 4 cells: ${singleHashes.size}. Distinct hashes among EXACT recoveries across all cells: ${recovered.size} (1 = the cross-site join is restored).`);
if (Object.keys(out.kernels).length) {
  lines.push('');
  lines.push('In-page kernels (extension OFF, alpha.test, two keys pooled): exact recoveries, plurality vote (strict majority in brackets)');
  lines.push('');
  lines.push('| Kernel | Single read px errors | ' + NS.map((n) => `Strip N=${n}`).join(' | ') + ' | Translate N=21 | Colour-shift N=21 | Frames N=21 | A1 subtraction |');
  lines.push('|---|---|' + NS.map(() => '---').join('|') + '|---|---|---|---|');
  for (const [name, byKey] of Object.entries(out.kernels)) {
    const keys = Object.values(byKey);
    const cellOf = (k) => {
      const rs = keys.flatMap((r) => r[k] || []);
      if (!rs.length) return '—';
      return `${rs.filter((r) => r.modes.plurality.exact).length}/${rs.length} (${rs.filter((r) => r.modes.majority.exact).length})`;
    };
    const sub = keys.map((r) => r.subtract).filter(Boolean);
    const subCell = sub.length ? sub.map((s) => s.unambiguousErrors === 0 ? `recovered (${s.ambiguousChannels} clamp-lost)` : `fails (${s.unambiguousErrors} wrong)`).join(' / ') : '—';
    lines.push(`| ${name} | ${keys.map((r) => r.single.pixelErrors).join(' / ')} | ${NS.map((n) => cellOf(`strip:${n}`)).join(' | ')} | ${cellOf('translate:21')} | ${cellOf('colourshift:21')} | ${cellOf('frames:21')} | ${subCell} |`);
  }
}
lines.push('');
lines.push(failures.length ? `CONTROLS FAILED (${failures.length}):\n  - ${failures.join('\n  - ')}` : 'All controls passed.');
console.log(lines.join('\n'));

for (const o of ORIGINS) delete out.off[o].workerB64;
out.failures = failures;
fs.mkdirSync(path.dirname(JSON_OUT), { recursive: true });
fs.writeFileSync(JSON_OUT, JSON.stringify(out, null, 1));
log(`raw results → ${path.relative(REPO, JSON_OUT)}`);
fs.rmSync(ext.work, { recursive: true, force: true });
process.exit(failures.length ? 1 : 0);
