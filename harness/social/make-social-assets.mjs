#!/usr/bin/env node
/**
 * Social-media assets for Nullecho, made from the repo so they can be re-made and checked.
 *
 *   node harness/social/make-social-assets.mjs                     # cards + demo video → ~/Desktop/Nullecho social assets
 *   node harness/social/make-social-assets.mjs --cards-only
 *   node harness/social/make-social-assets.mjs --video-only
 *   node harness/social/make-social-assets.mjs --out <dir> --puppeteer /Users/jasonluker/bodybuilding
 *
 * OUTPUTS
 *   nullecho-nah-card-1080x1350.png   slogan card, Instagram portrait feed
 *   nullecho-nah-card-1080x1920.png   slogan card, Stories / TikTok
 *   nullecho-blocking-demo-1080x1920.mp4   vertical demo, H.264, no audio
 *   demo-run-log.json                 what the two recorded runs actually measured (the video's numbers come from here)
 *
 * THE VIDEO IS A RECORDING, NOT A MOCKUP. harness/blocking-proof.html is loaded twice in Chrome for Testing,
 * each time in a FRESH temp profile (no accounts, no history, deleted at exit):
 *   OFF  no extension at all;
 *   ON   the STORE PACKAGE (`node ext/tools/package.mjs` → dist/nullecho-<v>-chrome.zip, unzipped to a temp dir)
 *        loaded unpacked, exactly as harness/site-smoke.mjs does — never `ext/` itself.
 * The page's own "Run the test" button is clicked and every frame is a screenshot of that page, timed by the
 * wall clock. The caption numbers are parsed from the page's own report after the run. Nothing is typed into
 * the page and nothing in it is restyled; the only emulation is prefers-color-scheme: light.
 *
 * GATES — the run aborts (exit 1) rather than produce a misleading video:
 *   - every frame: document.visibilityState === 'visible' (a hidden tab gives false results — 2026-09-20);
 *   - OFF: no extension target in the browser, 0 trackers blocked, every control loaded (else the baseline is void);
 *   - ON:  the extension's service worker is running, at least one tracker blocked, every control loaded, and
 *          every tracker the page calls blocked failed with net::ERR_BLOCKED_BY_CLIENT — the page alone cannot
 *          tell a blocked request from a dead network (its own disclosure says so), Chrome's error text can.
 *
 * Requires: puppeteer (resolved like the other harness scripts: repo, --puppeteer <dir>, $NULLECHO_PUPPETEER_DIR;
 * on Jason's Mac it lives in /Users/jasonluker/bodybuilding), ffmpeg + ffprobe with libx264 on PATH, `unzip`,
 * and a network connection (the OFF run really fetches the six tracker library files; see the page's disclosure).
 */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const EXT = path.join(REPO, 'ext');

// ── args ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt; };
const flag = (name) => argv.includes(name);
const OUT = path.resolve(opt('--out', path.join(os.homedir(), 'Desktop', 'Nullecho social assets')));
const DO_CARDS = !flag('--video-only');
const DO_VIDEO = !flag('--cards-only');
const KEEP_WORK = flag('--keep-work');

function loadPuppeteer() {
  const tried = [];
  try { return createRequire(import.meta.url)('puppeteer'); } catch (e) { tried.push(`repo (${e.code})`); }
  for (const dir of [opt('--puppeteer', null), process.env.NULLECHO_PUPPETEER_DIR, '/Users/jasonluker/bodybuilding'].filter(Boolean)) {
    try { return createRequire(path.join(path.resolve(dir), 'package.json'))('puppeteer'); }
    catch (e) { tried.push(`${dir} (${e.code})`); }
  }
  console.error('puppeteer not found: ' + tried.join('; '));
  process.exit(2);
}
const puppeteer = loadPuppeteer();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.error('[social]', ...a);
function fail(msg) { const e = new Error(msg); e.gate = true; throw e; }

// ── brand ────────────────────────────────────────────────────────────────────
// brand/BRAND.md: tile #0D1117, dots #56C3A4. The rest are neutral greys/red chosen to sit on that tile.
const C = { bg: '#0D1117', teal: '#56C3A4', ink: '#E6EDF3', muted: '#8B949E', red: '#FF7B72', line: '#30363D' };
const FONT = `-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif`;

/** The dots, read from the master icon (never redrawn by hand), cropped to their own bounding box. */
function dotsSvg(widthPx) {
  const src = fs.readFileSync(path.join(REPO, 'brand', 'nullecho-icon.svg'), 'utf8');
  const dots = [...src.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"\/>/g)].map((m) => m.slice(1).map(Number));
  if (dots.length !== 8) throw new Error(`expected 8 dots in brand/nullecho-icon.svg, found ${dots.length}`);
  const minX = Math.min(...dots.map(([x, , r]) => x - r)), maxX = Math.max(...dots.map(([x, , r]) => x + r));
  const minY = Math.min(...dots.map(([, y, r]) => y - r)), maxY = Math.max(...dots.map(([, y, r]) => y + r));
  const w = maxX - minX, h = maxY - minY;
  const circles = dots.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('');
  return `<svg class="dots" xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${w} ${h}" width="${widthPx}" height="${(widthPx * h / w).toFixed(1)}" fill="${C.teal}" aria-label="Nullecho">${circles}</svg>`;
}

const page0 = (w, h, body, extraCss = '', transparent = false) => `<!doctype html><meta charset="utf-8">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:${w}px;height:${h}px;overflow:hidden;background:${transparent ? 'transparent' : C.bg}}
  body{position:relative;font-family:${FONT};color:${C.ink};-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision}
  .label{font-weight:600;letter-spacing:.01em}
  .q{font-weight:700;letter-spacing:-.015em}
  .nah{font-weight:800;color:${C.teal};letter-spacing:-.035em;line-height:.9;margin-left:-.045em}
  ${extraCss}
</style>
<body>${body}</body>`;

// ── slogan cards ─────────────────────────────────────────────────────────────
// Left-aligned dialogue. Safe zones: Instagram feed crops nothing at 4:5; Stories/TikTok cover roughly the top
// 250 px, the bottom 340–420 px and a right-hand icon column, so the 1920 card keeps everything in y≈300–1540
// and x≤900.
function cardHtml(w, h) {
  const tall = h > 1500;
  const m = 96;
  const s = tall
    ? { top: 330, dots: 240, gapDots: 120, label: 42, q: 88, gapQ: 88, nah: 280, footBottom: 400, foot: 32 }
    : { top: 150, dots: 210, gapDots: 96, label: 40, q: 82, gapQ: 76, nah: 250, footBottom: 90, foot: 30 };
  const body = `
  <div class="b" id="stack" style="position:absolute;left:${m}px;right:${m}px;top:${s.top}px">
    <div class="b" id="icon">${dotsSvg(s.dots)}</div>
    <div class="b label" id="t-label" style="margin-top:${s.gapDots}px;font-size:${s.label}px;color:${C.muted}">Trackers:</div>
    <div class="b q" id="t-quote" style="margin-top:14px;font-size:${s.q}px;line-height:1.1;max-width:${w - 2 * m}px">“Can we follow you around the internet?”</div>
    <div class="b" id="n-label" style="margin-top:${s.gapQ}px;font-size:${s.label}px;color:${C.teal};font-weight:600">Nullecho:</div>
    <div class="b nah" id="n-nah" style="margin-top:6px;font-size:${s.nah}px">Nah.</div>
  </div>
  <div class="b" id="foot" style="position:absolute;left:${m}px;right:${m}px;bottom:${s.footBottom}px;font-size:${s.foot}px;color:${C.muted};font-weight:500">
    Free on the Chrome Web Store <span style="color:${C.muted}">·</span> <span style="color:${C.ink}">nullecho.org</span>
  </div>`;
  return page0(w, h, body);
}

// ── video caption plates (1080×1920) ─────────────────────────────────────────
// Captions start at y=220: the Reels/TikTok top bar sits over roughly y 80–200.
const V = { w: 1080, h: 1920, winX: 36, winY: 490, winW: 1008, winH: 1200, radius: 28 };
const PAGE_CSS_W = 600;                           // the proof page's own layout width
const DSF = V.winW / PAGE_CSS_W;                  // 1.68 → 1008 px; button, verdict and all nine rows fit in one frame
const PAGE_CSS_H = Math.round(V.winH / DSF);
const WINDOW_KEEP_OUT = { left: V.winX - 24, top: V.winY - 24, right: V.winX + V.winW + 24, bottom: V.winY + V.winH + 24 };

function captionPlate({ line1, line2, line2Color, sub }) {
  const body = `
  <div class="b" id="cap" style="position:absolute;left:60px;right:60px;top:220px">
    <div style="font-size:64px;font-weight:800;line-height:1.08;letter-spacing:-.02em">${line1}</div>
    <div style="font-size:64px;font-weight:800;line-height:1.08;letter-spacing:-.02em;color:${line2Color}">${line2}</div>
    ${sub ? `<div style="margin-top:14px;font-size:34px;font-weight:600;line-height:1.25;color:${C.ink}">${sub}</div>` : ''}
  </div>
  <div class="b" id="wm" style="position:absolute;left:60px;top:${V.winY + V.winH + 40}px;display:flex;align-items:center;gap:18px;font-size:34px;font-weight:700;color:${C.ink}">
    ${dotsSvg(52)}<span>nullecho.org</span>
  </div>`;
  return page0(V.w, V.h, body);
}

/** Transparent plate that rounds the page window's corners and draws its edge. */
function windowFrameHtml() {
  const body = `<div style="position:absolute;left:${V.winX}px;top:${V.winY}px;width:${V.winW}px;height:${V.winH}px;
    border-radius:${V.radius}px;box-shadow:0 0 0 2px ${C.line},0 0 0 16px ${C.bg}"></div>`;   // 16 px covers a 28 px corner (needs r·(√2−1) ≈ 12)
  return page0(V.w, V.h, body, '', true);
}

function introHtml(trackerCount) {
  const body = `
  <div class="b" id="stack" style="position:absolute;left:96px;right:96px;top:420px">
    ${dotsSvg(190)}
    <div class="label" style="margin-top:96px;font-size:42px;color:${C.muted}">Trackers:</div>
    <div class="q" style="margin-top:14px;font-size:84px;line-height:1.1">“Can we follow you around the internet?”</div>
    <div style="margin-top:72px;font-size:40px;font-weight:600;line-height:1.3;color:${C.ink}">Let’s test it.<br><span style="color:${C.muted}">One test page, ${trackerCount} known trackers, run twice.</span></div>
  </div>`;
  return page0(V.w, V.h, body);
}

function outroHtml() {
  const body = `
  <div class="b" id="stack" style="position:absolute;left:96px;right:96px;top:400px">
    ${dotsSvg(190)}
    <div style="margin-top:96px;font-size:44px;font-weight:600;color:${C.teal}">Nullecho:</div>
    <div class="nah" style="margin-top:6px;font-size:260px">Nah.</div>
    <div style="margin-top:84px;font-size:52px;font-weight:700;line-height:1.2">Free · no account · open source</div>
    <div style="margin-top:22px;font-size:52px;font-weight:700;color:${C.teal}">nullecho.org</div>
  </div>`;
  return page0(V.w, V.h, body);
}

/** Render HTML to PNG and refuse a layout where a block leaves the canvas or two blocks overlap. */
async function renderPng(browser, html, file, w, h, { transparent = false, avoid = null } = {}) {
  const p = await browser.newPage();
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await p.setContent(html, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  const problems = await p.evaluate((W, H, A) => {
    const out = [];
    const boxes = [...document.querySelectorAll('.b')].filter((e) => !e.querySelector('.b')).map((e) => ({ id: e.id || e.className, r: e.getBoundingClientRect() }));
    for (const { id, r } of boxes) if (r.left < 0 || r.top < 0 || r.right > W || r.bottom > H) out.push(`${id} leaves the canvas (${Math.round(r.left)},${Math.round(r.top)})–(${Math.round(r.right)},${Math.round(r.bottom)})`);
    // keep-out: the page window plus its masking ring and a margin (the ring is a separate plate, so only this sees it)
    if (A) for (const { id, r } of boxes) if (r.left < A.right && A.left < r.right && r.top < A.bottom && A.top < r.bottom) out.push(`${id} runs into the page window (bottom ${Math.round(r.bottom)}, window+ring starts ${A.top})`);
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i].r, b = boxes[j].r;
      if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) out.push(`${boxes[i].id} overlaps ${boxes[j].id}`);
    }
    return out;
  }, w, h, avoid);
  if (problems.length) throw new Error(`${path.basename(file)} layout: ${problems.join('; ')}`);
  await p.screenshot({ path: file, omitBackground: transparent });
  await p.close();
}

// ── the recorded runs ────────────────────────────────────────────────────────
function buildAndUnpack(work) {
  log('building the store package (node ext/tools/package.mjs)…');
  execFileSync('node', ['tools/package.mjs'], { cwd: EXT, stdio: ['ignore', 'inherit', 'inherit'] });
  const version = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8')).version;
  const zipPath = path.join(REPO, 'dist', `nullecho-${version}-chrome.zip`);
  if (!fs.existsSync(zipPath)) throw new Error('package build did not produce ' + zipPath);
  const unpackDir = path.join(work, 'ext-unpacked');
  fs.mkdirSync(unpackDir, { recursive: true });
  execFileSync('unzip', ['-q', zipPath, '-d', unpackDir]);
  if (!fs.existsSync(path.join(unpackDir, 'manifest.json'))) throw new Error('unzip produced no manifest.json');
  return { version, zipPath, zipBytes: fs.statSync(zipPath).size, unpackDir };
}

function serveProofPage() {
  const html = fs.readFileSync(path.join(REPO, 'harness', 'blocking-proof.html'));
  const srv = http.createServer((req, res) => {
    if (new URL(req.url, 'http://x').pathname === '/blocking-proof.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(html);
    } else { res.writeHead(404); res.end(); }
  });
  return new Promise((resolve) => srv.listen(0, '127.0.0.1', () => resolve({ srv, origin: `http://127.0.0.1:${srv.address().port}` })));
}

const isExtWorker = (t) => t.type() === 'service_worker' && /^chrome-extension:\/\/[a-p]{32}\/src\/background\.js$/.test(t.url());

/**
 * One run of the proof page, recorded. Timeline (wall clock): hold on the top of the page, scroll to the
 * button, click it, keep recording until `seconds`. Returns the frames with their real timestamps and what the
 * page reported.
 */
async function recordRun({ label, extDir, origin, frameDir, seconds }) {
  fs.mkdirSync(frameDir, { recursive: true });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), `nullecho-social-profile-${label}-`));
  const args = ['--no-first-run', '--no-default-browser-check'];
  if (extDir) args.push(`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`);
  const browser = await puppeteer.launch({ headless: true, ignoreDefaultArgs: extDir ? ['--disable-extensions'] : [], args, userDataDir: profile });
  const run = { label, extension: !!extDir, profile: 'fresh temp dir, deleted after the run' };
  try {
    run.browser = await browser.version();
    // Presence. A fresh profile is a first install: the extension opens its options page, which would cover the
    // test tab. Wait for that page and close it BEFORE making ours (site-smoke's hidden-tab trap).
    if (extDir) {
      const w = await browser.waitForTarget(isExtWorker, { timeout: 15000 }).catch(() => null);
      if (!w) fail(`${label}: the extension's service worker never started`);
      run.extensionWorker = w.url();
      await browser.waitForTarget((t) => t.type() === 'page' && /^chrome-extension:\/\//.test(t.url()), { timeout: 5000 }).catch(() => null);
    } else {
      await sleep(1500);
      const ext = browser.targets().filter((t) => /^chrome-extension:\/\//.test(t.url()));
      if (ext.length) fail(`${label}: an extension is present in the no-extension browser: ${ext.map((t) => t.url()).join(', ')}`);
      run.extensionWorker = null;
    }
    for (const p of await browser.pages()) if (/^chrome-extension:\/\//.test(p.url())) await p.close().catch(() => {});

    const page = await browser.newPage();
    await page.setViewport({ width: PAGE_CSS_W, height: PAGE_CSS_H, deviceScaleFactor: DSF });
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
    await page.bringToFront();
    for (const p of await browser.pages()) if (p !== page && /^chrome-extension:\/\//.test(p.url())) await p.close().catch(() => {});

    const blockedByClient = [];
    const failedOther = [];
    page.on('requestfailed', (req) => {
      const err = (req.failure() && req.failure().errorText) || 'failed';
      (/ERR_BLOCKED_BY_CLIENT/.test(err) ? blockedByClient : failedOther).push({ url: req.url(), error: err });
    });

    await page.goto(`${origin}/blocking-proof.html?run=${label}-${Date.now()}`, { waitUntil: 'load' });
    run.pageUA = await page.evaluate(() => navigator.userAgent);

    const frames = [];
    const t0 = Date.now();
    const now = () => (Date.now() - t0) / 1000;
    let resultAt = null;
    const snap = async (phase) => {
      const st = await page.evaluate(() => ({
        vis: document.visibilityState,
        done: !document.getElementById('verdict').hidden && document.getElementById('run').textContent === 'Run it again',
      }));
      if (st.vis !== 'visible') fail(`${label}: page is not visible (visibilityState=${st.vis}) at frame ${frames.length}; a hidden tab gives false results`);
      const t = now();
      const file = path.join(frameDir, `f${String(frames.length).padStart(4, '0')}.png`);
      await page.screenshot({ path: file });
      if (st.done && resultAt === null) resultAt = t;
      frames.push({ file, t, phase, visibility: st.vis });
    };

    while (now() < 1.4) await snap('top');
    const target = await page.evaluate(() => Math.max(0, document.getElementById('run').getBoundingClientRect().top + scrollY - 14));   // the box above ends 16 px up
    const s0 = now();
    for (;;) {
      const p = Math.min(1, (now() - s0) / 0.9);
      const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;      // ease in-out
      await page.evaluate((y) => window.scrollTo(0, y), Math.round(target * e));
      await snap('scroll');
      if (p >= 1) break;
    }
    const h0 = now(); while (now() - h0 < 0.5) await snap('ready');
    run.clickAt = now();
    await page.click('#run');                                           // the page's own button, a real mouse click
    while (now() < seconds) await snap(resultAt === null ? 'running' : 'result');
    if (resultAt === null) fail(`${label}: the page never finished its run within ${seconds}s`);
    run.resultAt = resultAt;
    run.frames = frames.length;
    run.frameList = frames.map(({ file, t }) => ({ file, t }));       // for ffmpeg; stripped from the log
    run.allFramesVisible = frames.every((f) => f.visibility === 'visible');

    // What the page itself reported — the only source of the caption numbers.
    const report = await page.evaluate(() => document.getElementById('report').textContent);
    run.report = report;
    const num = (re) => { const m = re.exec(report); if (!m) fail(`${label}: cannot parse ${re} from the page report`); return [Number(m[1]), Number(m[2])]; };
    [run.trackersBlocked, run.trackersTotal] = num(/trackers:\s+(\d+)\/(\d+) blocked/);
    [run.controlsLoaded, run.controlsTotal] = num(/controls:\s+(\d+)\/(\d+) loaded/);
    run.verdict = (/verdict:\s+(.+)/.exec(report) || [])[1];
    run.gpc = (/GPC:\s+(.+)/.exec(report) || [])[1];
    run.rows = [...report.matchAll(/^\s+(tracker|control)\s+(\S+)\s+(\S+)\s+(\S+)$/gm)].map((m) => ({ kind: m[1], state: m[2], category: m[3], host: m[4] }));
    run.blockedByClient = blockedByClient.map((x) => new URL(x.url).host);
    run.otherFailedRequests = failedOther;

    // Gates.
    if (run.controlsLoaded !== run.controlsTotal) fail(`${label}: only ${run.controlsLoaded}/${run.controlsTotal} control requests loaded — network trouble or an over-broad rule; re-run`);
    if (!extDir) {
      if (run.trackersBlocked !== 0) fail(`${label}: ${run.trackersBlocked} trackers failed with no extension installed — the baseline is void (network/DNS filtering?)`);
      if (blockedByClient.length) fail(`${label}: ERR_BLOCKED_BY_CLIENT with no extension installed: ${run.blockedByClient.join(', ')}`);
    } else {
      if (run.trackersBlocked === 0) fail(`${label}: no tracker was blocked with the extension in`);
      for (const r of run.rows.filter((x) => x.kind === 'tracker' && x.state !== 'loaded')) {
        if (!run.blockedByClient.includes(r.host)) fail(`${label}: the page calls ${r.host} blocked, but Chrome reported no ERR_BLOCKED_BY_CLIENT for it — not attributable to the extension`);
      }
    }
    return run;
  } finally {
    await browser.close().catch(() => {});
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

// ── ffmpeg ───────────────────────────────────────────────────────────────────
const FPS = 30;
const XF = 0.4;                                    // cross-fade between segments
const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });
const X264 = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(FPS)];

function stillSegment(png, seconds, out) {
  ff(['-loop', '1', '-framerate', String(FPS), '-t', String(seconds), '-i', png, '-vf', 'format=yuv420p', ...X264, out]);
}

function demoSegment({ run, prePng, postPng, framePng, seconds, work, out }) {
  const list = path.join(work, `${run.label}-frames.ffconcat`);
  const f = run.frameList;
  const lines = ['ffconcat version 1.0'];
  for (let i = 0; i < f.length; i++) {
    const dur = (i + 1 < f.length ? f[i + 1].t : seconds) - f[i].t;
    lines.push(`file '${f[i].file}'`, `duration ${Math.max(dur, 0.001).toFixed(4)}`);
  }
  lines.push(`file '${f[f.length - 1].file}'`);
  fs.writeFileSync(list, lines.join('\n') + '\n');
  const showPost = run.resultAt.toFixed(3);
  ff([
    '-loop', '1', '-framerate', String(FPS), '-t', String(seconds), '-i', prePng,
    '-loop', '1', '-framerate', String(FPS), '-t', String(seconds), '-i', postPng,
    '-f', 'concat', '-safe', '0', '-i', list,
    '-loop', '1', '-framerate', String(FPS), '-t', String(seconds), '-i', framePng,
    '-filter_complex',
    `[0][1]overlay=0:0:enable='gte(t,${showPost})'[bg];` +
    `[2]fps=${FPS},setpts=PTS-STARTPTS[pg];` +
    `[bg][pg]overlay=${V.winX}:${V.winY}:eof_action=repeat[a];` +
    `[3]format=rgba[fr];[a][fr]overlay=0:0,format=yuv420p[v]`,
    '-map', '[v]', '-t', String(seconds), ...X264, out,
  ]);
}

function probe(file) {
  const j = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size:stream=codec_name,codec_type,width,height,pix_fmt,r_frame_rate,nb_frames,profile', '-of', 'json', file], { encoding: 'utf8' }));
  return j;
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'nullecho-social-'));
  log('work dir', work);
  const renderer = await puppeteer.launch({ headless: true, args: ['--no-first-run', '--no-default-browser-check'] });
  try {
    if (DO_CARDS) {
      for (const [w, h] of [[1080, 1350], [1080, 1920]]) {
        const file = path.join(OUT, `nullecho-nah-card-${w}x${h}.png`);
        await renderPng(renderer, cardHtml(w, h), file, w, h);
        log('card', file);
      }
    }
    if (!DO_VIDEO) return;

    const pkg = buildAndUnpack(work);
    const { srv, origin } = await serveProofPage();
    const DEMO_S = 9.5;
    let off, on;
    try {
      log('recording OFF (no extension)…');
      off = await recordRun({ label: 'off', extDir: null, origin, frameDir: path.join(work, 'frames-off'), seconds: DEMO_S });
      log(`OFF: ${off.trackersBlocked}/${off.trackersTotal} blocked, ${off.controlsLoaded}/${off.controlsTotal} controls, ${off.frames} frames`);
      log('recording ON (packaged extension)…');
      on = await recordRun({ label: 'on', extDir: pkg.unpackDir, origin, frameDir: path.join(work, 'frames-on'), seconds: DEMO_S });
      log(`ON:  ${on.trackersBlocked}/${on.trackersTotal} blocked, ${on.controlsLoaded}/${on.controlsTotal} controls, ${on.frames} frames`);
    } finally { srv.close(); }
    if (off.trackersTotal !== on.trackersTotal) fail('the two runs saw different tracker lists');

    const T = off.trackersTotal;
    const plates = {
      intro: introHtml(T),
      offPre: captionPlate({ line1: 'Without Nullecho:', line2: 'trackers load', line2Color: C.red }),
      offPost: captionPlate({ line1: 'Without Nullecho:', line2: 'trackers load', line2Color: C.red,
        sub: `${T - off.trackersBlocked} of ${T} tracker requests went through` }),
      onPre: captionPlate({ line1: 'With Nullecho:', line2: 'blocked', line2Color: C.teal }),
      onPost: captionPlate({ line1: 'With Nullecho:', line2: 'blocked', line2Color: C.teal,
        sub: `${on.trackersBlocked} of ${T} tracker requests blocked<br><span style="color:${C.muted}">Regular files still loaded: ${on.controlsLoaded} of ${on.controlsTotal}</span>` }),
      outro: outroHtml(),
    };
    const png = {};
    for (const [k, html] of Object.entries(plates)) {
      png[k] = path.join(work, `plate-${k}.png`);
      await renderPng(renderer, html, png[k], V.w, V.h, /^(off|on)/.test(k) ? { avoid: WINDOW_KEEP_OUT } : {});
    }
    png.frame = path.join(work, 'plate-window.png');
    await renderPng(renderer, windowFrameHtml(), png.frame, V.w, V.h, { transparent: true });
    if (KEEP_WORK) for (const k of Object.keys(png)) fs.copyFileSync(png[k], path.join(OUT, `_plate-${k}.png`));

    const D = { intro: 3.2, off: DEMO_S, on: DEMO_S, outro: 4.2 };
    const seg = (k) => path.join(work, `seg-${k}.mp4`);
    stillSegment(png.intro, D.intro, seg('intro'));
    demoSegment({ run: off, prePng: png.offPre, postPng: png.offPost, framePng: png.frame, seconds: D.off, work, out: seg('off') });
    demoSegment({ run: on, prePng: png.onPre, postPng: png.onPost, framePng: png.frame, seconds: D.on, work, out: seg('on') });
    stillSegment(png.outro, D.outro, seg('outro'));

    const o1 = D.intro - XF, o2 = D.intro + D.off - 2 * XF, o3 = D.intro + D.off + D.on - 3 * XF;
    const video = path.join(OUT, 'nullecho-blocking-demo-1080x1920.mp4');
    ff([
      '-i', seg('intro'), '-i', seg('off'), '-i', seg('on'), '-i', seg('outro'),
      '-filter_complex',
      `[0][1]xfade=transition=fade:duration=${XF}:offset=${o1.toFixed(3)}[x1];` +
      `[x1][2]xfade=transition=fade:duration=${XF}:offset=${o2.toFixed(3)}[x2];` +
      `[x2][3]xfade=transition=fade:duration=${XF}:offset=${o3.toFixed(3)},format=yuv420p[v]`,
      '-map', '[v]', '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
      '-r', String(FPS), '-movflags', '+faststart', video,
    ]);
    const meta = probe(video);
    log('video', video, JSON.stringify(meta.format));

    // Where in the FINAL video each run's result first shows (for whoever checks the video against this log).
    const offStart = o1, onStart = o2;
    const strip = ({ frameList, ...r }) => r;
    const runLog = {
      made: new Date().toString(),
      repoHead: (() => { try { return execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim(); } catch { return null; } })(),
      package: { version: pkg.version, zip: path.relative(REPO, pkg.zipPath), bytes: pkg.zipBytes },
      page: `harness/blocking-proof.html, served from 127.0.0.1, prefers-color-scheme: light, ${PAGE_CSS_W}×${PAGE_CSS_H} CSS px at ${DSF.toFixed(2)}x`,
      off: { ...strip(off), resultShownInVideoAt: +(offStart + off.resultAt).toFixed(2) },
      on: { ...strip(on), resultShownInVideoAt: +(onStart + on.resultAt).toFixed(2) },
      video: { file: path.basename(video), segments: D, crossfade: XF, ffprobe: meta },
    };
    fs.writeFileSync(path.join(OUT, 'demo-run-log.json'), JSON.stringify(runLog, null, 2) + '\n');
    log('log', path.join(OUT, 'demo-run-log.json'));
  } finally {
    await renderer.close().catch(() => {});
    if (!KEEP_WORK) fs.rmSync(work, { recursive: true, force: true });
  }
}

main().catch((e) => { console.error(e.gate ? `ABORTED: ${e.message}` : e); process.exit(1); });
