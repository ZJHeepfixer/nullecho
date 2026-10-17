#!/usr/bin/env node
/**
 * Press-kit icons and print-ready merch files, rendered from brand/ so they can be re-made and checked.
 *
 *   node harness/social/make-brand-files.mjs --font-dir <dir with Inter-*.ttf>       # both jobs
 *   node harness/social/make-brand-files.mjs --icons-only
 *   node harness/social/make-brand-files.mjs --merch-only --font-dir <dir>
 *   … --puppeteer /Users/jasonluker/bodybuilding   (or $NULLECHO_PUPPETEER_DIR)
 *
 * OUTPUTS
 *   site/press/nullecho-icon-512.png, -1024.png   brand/nullecho-icon.svg rasterised, transparent outside the tile
 *   brand/merch/*.png                             print files at 300 DPI, transparent background (brand/MERCH.md)
 *   brand/merch/PREVIEW.png                       the print files on swatches of the garment colours — a preview, NOT a print file
 *
 * THE DOTS ARE NEVER REDRAWN BY HAND: every file reads the eight circles from brand/nullecho-icon.svg, the same way
 * harness/social/make-social-assets.mjs does.
 *
 * FONT: merch text is set in Inter (SIL Open Font License 1.1, https://rsms.me/inter/), which allows its use in
 * artwork that is sold. The social cards use the system font; that is fine for a post and not something to print on
 * a garment for sale, so the merch job refuses to run without Inter rather than fall back silently.
 *
 * GATES — the run exits non-zero rather than write a bad print file:
 *   - every text/dot block stays inside the canvas and inside a 0.25 in safety margin;
 *   - the four corners of every merch file are fully transparent (Printful: "Use a transparent background");
 *   - Inter actually loaded (document.fonts.check), so a missing font can't render in a fallback face;
 *   - the written PNG is the exact pixel size of inches × 300 and carries a 300 DPI pHYs and an sRGB chunk.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt; };
const flag = (name) => argv.includes(name);
const DO_ICONS = !flag('--merch-only');
const DO_MERCH = !flag('--icons-only');
const FONT_DIR = opt('--font-dir', process.env.NULLECHO_FONT_DIR || null);
const ICON_OUT = path.join(REPO, 'site', 'press');
const MERCH_OUT = path.join(REPO, 'brand', 'merch');
const DPI = 300;
const log = (...a) => console.error('[brand]', ...a);

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

// ── brand ────────────────────────────────────────────────────────────────────
// brand/BRAND.md: tile #0D1117, dots #56C3A4. INK/MUTED are the light greys the social cards use on the tile;
// MUTED_ON_LIGHT is the grey for labels on light garments.
const C = { tile: '#0D1117', teal: '#56C3A4', ink: '#E6EDF3', muted: '#8B949E', mutedOnLight: '#57606A' };
const ICON_SVG = fs.readFileSync(path.join(REPO, 'brand', 'nullecho-icon.svg'), 'utf8');
const DOTS = [...ICON_SVG.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"\/>/g)].map((m) => m.slice(1).map(Number));
if (DOTS.length !== 8) throw new Error(`expected 8 dots in brand/nullecho-icon.svg, found ${DOTS.length}`);
const TILE = ICON_SVG.match(/<rect width="1024" height="1024" rx="([\d.]+)" fill="(#[0-9A-Fa-f]{6})"\/>/);
if (!TILE) throw new Error('brand/nullecho-icon.svg: tile <rect> not found');

/** Dots only, cropped to their own bounding box (dark garments: no tile, see MERCH.md). */
function dotsSvg(heightIn, id) {
  const minX = Math.min(...DOTS.map(([x, , r]) => x - r)), maxX = Math.max(...DOTS.map(([x, , r]) => x + r));
  const minY = Math.min(...DOTS.map(([, y, r]) => y - r)), maxY = Math.max(...DOTS.map(([, y, r]) => y + r));
  const w = maxX - minX, h = maxY - minY;
  const circles = DOTS.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('');
  return `<svg class="b" id="${id}" xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${w} ${h}" style="height:${heightIn * 100}px;width:${(heightIn * 100 * w / h).toFixed(2)}px;display:block" fill="${C.teal}">${circles}</svg>`;
}
/** The whole rounded tile with its dots (light garments). */
function tileSvg(heightIn, id) {
  const circles = DOTS.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('');
  return `<svg class="b" id="${id}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" style="height:${heightIn * 100}px;width:${heightIn * 100}px;display:block"><rect width="1024" height="1024" rx="${TILE[1]}" fill="${TILE[2]}"/><g fill="${C.teal}">${circles}</g></svg>`;
}

// ── PNG post-processing: 300 DPI pHYs + sRGB chunk ───────────────────────────
function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0);
  return Buffer.concat([len, td, crc]);
}
function stampPng(file, dpi) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32BE(12) !== 0x49484452) throw new Error(`${file}: IHDR not first`);
  const chunks = []; let off = 8;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), type = buf.toString('ascii', off + 4, off + 8);
    chunks.push({ type, raw: buf.subarray(off, off + 12 + len) });
    off += 12 + len;
  }
  const keep = chunks.filter((c) => !['pHYs', 'sRGB', 'gAMA', 'cHRM', 'iCCP'].includes(c.type));
  const ppm = Math.round(dpi / 0.0254);
  const phys = Buffer.alloc(9); phys.writeUInt32BE(ppm, 0); phys.writeUInt32BE(ppm, 4); phys[8] = 1;
  const out = [buf.subarray(0, 8), keep[0].raw, pngChunk('sRGB', Buffer.from([0])), pngChunk('pHYs', phys), ...keep.slice(1).map((c) => c.raw)];
  fs.writeFileSync(file, Buffer.concat(out));
}
function pngInfo(file) {
  const buf = fs.readFileSync(file);
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20), colorType = buf[25];
  let off = 8, dpi = null, srgb = false;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), type = buf.toString('ascii', off + 4, off + 8);
    if (type === 'pHYs') dpi = Math.round(buf.readUInt32BE(off + 8) * 0.0254);
    if (type === 'sRGB') srgb = true;
    off += 12 + len;
  }
  return { w, h, colorType, dpi, srgb };
}

// ── page shell ───────────────────────────────────────────────────────────────
const fontFace = () => {
  const faces = [['Inter-SemiBold.ttf', 600], ['Inter-Bold.ttf', 700], ['Inter-ExtraBold.ttf', 800], ['Inter-Black.ttf', 900]];
  return faces.map(([f, w]) => {
    const p = path.join(FONT_DIR, f);
    if (!fs.existsSync(p)) throw new Error(`font not found: ${p} (pass --font-dir <dir with Inter-*.ttf>)`);
    return `@font-face{font-family:"InterPrint";font-weight:${w};src:url(data:font/ttf;base64,${fs.readFileSync(p).toString('base64')}) format("truetype")}`;
  }).join('\n');
};
const shell = (wIn, hIn, body, withFont) => `<!doctype html><meta charset="utf-8"><style>
${withFont ? fontFace() : ''}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${wIn * 100}px;height:${hIn * 100}px;overflow:hidden;background:transparent}
body{position:relative;font-family:"InterPrint";-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision;font-kerning:normal}
</style><body>${body}</body>`;

// ── the designs (CSS px = 1/100 in; rendered at deviceScaleFactor 3 → 300 DPI) ─
/** Chest lockup: the dots (or tile) beside lowercase "nah.", centred, near the top so it clears a hoodie pocket. */
function frontHtml(wIn, hIn, scheme) {
  const lockW = Math.min(0.68 * wIn, 10);        // inches; 9.5 in on a 14 in hoodie front, 10 in max
  const iconH = lockW * 0.27;                     // sized against the text below, then fitted to lockW in-page
  const textColor = scheme === 'dark' ? C.teal : C.tile;
  const icon = scheme === 'dark' ? dotsSvg(iconH, 'icon') : tileSvg(iconH, 'icon');
  const body = `
  <div id="lock" style="position:absolute;left:50%;top:${0.75 * 100}px;transform-origin:top center;display:flex;align-items:flex-end;gap:${iconH * 100 * 0.32}px;white-space:nowrap">
    ${icon}
    <div class="b" id="nah" style="font-weight:800;font-size:${iconH * 100 * 1.36}px;line-height:.74;letter-spacing:-.035em;color:${textColor};padding-bottom:${iconH * 100 * 0.0}px">nah.</div>
  </div>
  <script>
    const lock = document.getElementById('lock');
    const target = ${lockW * 100};
    const s = target / lock.getBoundingClientRect().width;
    lock.style.transform = 'translateX(-50%) scale(' + s + ')';
  </script>`;
  return shell(wIn, hIn, body, true);
}

/** Back: the whole slogan, with the product named, and the URL. */
function backHtml(wIn, hIn, scheme) {
  const dark = scheme === 'dark';
  const label = dark ? C.muted : C.mutedOnLight, ink = dark ? C.ink : C.tile, accent = dark ? C.teal : C.tile;
  const m = 0.75; // in, side margins
  const body = `
  <div id="stack" style="position:absolute;left:${m * 100}px;right:${m * 100}px;top:${0.75 * 100}px">
    <div class="b" id="t-label" style="font-weight:700;font-size:52px;color:${label};letter-spacing:.005em">Trackers:</div>
    <div class="b" id="t-quote" style="margin-top:14px;font-weight:800;font-size:104px;line-height:1.08;letter-spacing:-.025em;color:${ink}">“Can we follow you around the internet?”</div>
    <div class="b" id="n-label" style="margin-top:84px;font-weight:700;font-size:52px;color:${accent}">Nullecho:</div>
    <div class="b" id="n-nah" style="margin-top:10px;font-weight:800;font-size:330px;line-height:.82;letter-spacing:-.045em;margin-left:-.04em;color:${accent}">Nah.</div>
    <div id="foot" style="margin-top:96px;display:flex;align-items:center;gap:26px">
      ${dark ? dotsSvg(0.62, 'foot-icon') : tileSvg(0.62, 'foot-icon')}
      <div class="b" id="foot-url" style="font-weight:700;font-size:54px;color:${ink};letter-spacing:-.01em">nullecho.org</div>
    </div>
  </div>`;
  return shell(wIn, hIn, body, true);
}

// Print files. Sizes from Printful's "File guidelines" tab for each product (DTG), read 2026-10-17 — see brand/MERCH.md.
const MERCH = [
  { name: 'nah-front-hoodie-gildan18500', wIn: 14, hIn: 14, kind: 'front' },
  { name: 'nah-front-hoodie-m2580', wIn: 13, hIn: 13, kind: 'front' },
  { name: 'nah-front-tee-3001-xs-m', wIn: 11.5, hIn: 13.8, kind: 'front' },
  { name: 'nah-front-tee-3001-l-up', wIn: 15, hIn: 18, kind: 'front' },
  { name: 'nah-back-slogan-12x16', wIn: 12, hIn: 16, kind: 'back' },
];

async function render(browser, html, file, wIn, hIn, { checkFont = false, safetyIn = 0 } = {}) {
  const p = await browser.newPage();
  await p.setViewport({ width: Math.round(wIn * 100), height: Math.round(hIn * 100), deviceScaleFactor: DPI / 100 });
  await p.setContent(html, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  if (checkFont) {
    const ok = await p.evaluate(async () => {
      const ws = ['600', '700', '800'];
      const loaded = await Promise.all(ws.map((w) => document.fonts.load(`${w} 40px InterPrint`, 'nah.')));
      return loaded.every((faces) => faces.length > 0) && ws.every((w) => document.fonts.check(`${w} 40px InterPrint`, 'nah.'));
    });
    if (!ok) throw new Error(`${path.basename(file)}: Inter did not load`);
  }
  const problems = await p.evaluate((W, H, S) => {
    const out = [];
    for (const e of document.querySelectorAll('.b')) {
      const r = e.getBoundingClientRect();
      if (r.left < S || r.top < S || r.right > W - S || r.bottom > H - S) out.push(`${e.id} outside the ${S / 100} in margin: (${r.left | 0},${r.top | 0})–(${r.right | 0},${r.bottom | 0}) of ${W}×${H}`);
    }
    return out;
  }, wIn * 100, hIn * 100, safetyIn * 100);
  if (problems.length) throw new Error(`${path.basename(file)} layout: ${problems.join('; ')}`);
  await p.screenshot({ path: file, omitBackground: true });
  await p.close();
  stampPng(file, DPI);
  const info = pngInfo(file);
  const wantW = Math.round(wIn * DPI), wantH = Math.round(hIn * DPI);
  if (info.w !== wantW || info.h !== wantH) throw new Error(`${path.basename(file)}: ${info.w}×${info.h}, expected ${wantW}×${wantH}`);
  if (info.colorType !== 6) throw new Error(`${path.basename(file)}: PNG colour type ${info.colorType}, expected 6 (RGBA)`);
  if (info.dpi !== DPI || !info.srgb) throw new Error(`${path.basename(file)}: pHYs/sRGB not written`);
  return info;
}

async function cornersTransparent(browser, file) {
  const p = await browser.newPage();
  const b64 = fs.readFileSync(file).toString('base64');
  const res = await p.evaluate(async (src) => {
    const img = new Image(); img.src = src; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const a = (px, py) => x.getImageData(px, py, 1, 1).data[3];
    const W = img.width - 1, H = img.height - 1;
    const d = x.getImageData(0, 0, img.width, img.height).data;
    let opaque = 0, partial = 0, clear = 0;
    for (let i = 3; i < d.length; i += 4) { if (d[i] === 255) opaque++; else if (d[i] === 0) clear++; else partial++; }
    return { corners: [a(0, 0), a(W, 0), a(0, H), a(W, H)], opaque, partial, clear };
  }, `data:image/png;base64,${b64}`);
  await p.close();
  if (res.corners.some((v) => v !== 0)) throw new Error(`${path.basename(file)}: corners not transparent (${res.corners})`);
  return res;
}

function previewHtml(files) {
  // Two garment swatches per colourway, taken from Printful's catalog colour codes (brand/MERCH.md).
  const swatch = { dark: [['Black', '#0b0b0b'], ['Navy', '#131928']], light: [['White', '#ffffff'], ['Ash', '#dedede']] };
  const cells = [];
  for (const f of files) for (const [nm, hex] of swatch[f.scheme]) {
    cells.push(`<figure style="margin:0;background:${hex};border:1px solid #ccc;border-radius:10px;padding:18px;display:flex;flex-direction:column;align-items:center;gap:8px">
      <img src="data:image/png;base64,${fs.readFileSync(f.file).toString('base64')}" style="height:300px;width:auto;outline:1px dashed ${f.scheme === 'dark' ? '#444' : '#bbb'}">
      <figcaption style="font:600 15px/1.3 -apple-system,sans-serif;color:${f.scheme === 'dark' ? '#ccc' : '#333'};text-align:center">${path.basename(f.file)}<br>on ${nm} ${hex}</figcaption></figure>`);
  }
  return `<!doctype html><meta charset="utf-8"><body style="margin:0;padding:24px;background:#f4f4f2;font:16px -apple-system,sans-serif">
  <h1 style="font:700 22px -apple-system,sans-serif;margin:0 0 6px">Nullecho "nah." print files — preview only, not a print file</h1>
  <p style="margin:0 0 18px;color:#444">Dashed outline = the print file's canvas (Printful's print area). Swatch colours are Printful's catalog colour codes. Generated by harness/social/make-brand-files.mjs.</p>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px">${cells.join('')}</div></body>`;
}

async function main() {
  const puppeteer = loadPuppeteer();
  const browser = await puppeteer.launch({ headless: true, args: ['--no-first-run', '--no-default-browser-check'] });
  try {
    if (DO_ICONS) {
      fs.mkdirSync(ICON_OUT, { recursive: true });
      for (const px of [512, 1024]) {
        const file = path.join(ICON_OUT, `nullecho-icon-${px}.png`);
        const html = `<!doctype html><meta charset="utf-8"><style>*{margin:0}html,body{width:${px}px;height:${px}px;background:transparent;overflow:hidden}svg{display:block;width:${px}px;height:${px}px}</style><body>${ICON_SVG.replace(/<title>.*?<\/title>/, '')}</body>`;
        const p = await browser.newPage();
        await p.setViewport({ width: px, height: px, deviceScaleFactor: 1 });
        await p.setContent(html, { waitUntil: 'load' });
        await p.screenshot({ path: file, omitBackground: true });
        await p.close();
        const info = pngInfo(file);
        if (info.w !== px || info.h !== px) throw new Error(`${file}: ${info.w}×${info.h}`);
        await cornersTransparent(browser, file);
        log('icon', path.relative(REPO, file));
      }
    }
    if (DO_MERCH) {
      if (!FONT_DIR) throw new Error('merch needs Inter: pass --font-dir <dir with Inter-SemiBold/Bold/ExtraBold/Black.ttf> or set NULLECHO_FONT_DIR');
      fs.mkdirSync(MERCH_OUT, { recursive: true });
      const made = [];
      for (const spec of MERCH) for (const scheme of ['dark', 'light']) {
        const px = `${Math.round(spec.wIn * DPI)}x${Math.round(spec.hIn * DPI)}`;
        const file = path.join(MERCH_OUT, `${spec.name}-${scheme}-${px}.png`);
        const html = spec.kind === 'front' ? frontHtml(spec.wIn, spec.hIn, scheme) : backHtml(spec.wIn, spec.hIn, scheme);
        await render(browser, html, file, spec.wIn, spec.hIn, { checkFont: true, safetyIn: 0.25 });
        const a = await cornersTransparent(browser, file);
        made.push({ file, scheme });
        log('merch', path.relative(REPO, file), `opaque ${a.opaque}, edge ${a.partial}, clear ${a.clear}`);
      }
      const prev = path.join(MERCH_OUT, 'PREVIEW.png');
      const p = await browser.newPage();
      await p.setViewport({ width: 1400, height: 900, deviceScaleFactor: 1 });
      await p.setContent(previewHtml(made), { waitUntil: 'load' });
      await p.screenshot({ path: prev, fullPage: true });
      await p.close();
      log('preview', path.relative(REPO, prev));
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error('[brand] FAILED:', e.message); process.exit(1); });
