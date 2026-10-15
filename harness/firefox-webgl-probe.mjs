#!/usr/bin/env node
/**
 * D53 — what real Firefox reports for WebGL / WebGPU, extension OFF then ON, in a fresh profile.
 *
 *   node ext/tools/package.mjs --firefox && unzip -q dist/nullecho-<v>-firefox.zip -d /tmp/ff
 *   node harness/firefox-webgl-probe.mjs /tmp/ff                       # normal profile
 *   node harness/firefox-webgl-probe.mjs /tmp/ff --rfp                 # privacy.resistFingerprinting=true
 *   node harness/firefox-webgl-probe.mjs /tmp/ff --fpp                 # privacy.fingerprintingProtection=true
 *   node harness/firefox-webgl-probe.mjs /tmp/ff --rfp --instrument    # + the shim's own engine/RFP verdict
 *       [--pref name=value ...] [--hosts 127.0.0.1,localhost] [--headless] [--allow-hidden] [--json]
 *       --puppeteer <dir> | NULLECHO_PUPPETEER_DIR=<dir>   a directory whose node_modules has puppeteer(-core)
 *       FIREFOX=/path/to/firefox                            default: /Applications/Firefox.app/Contents/MacOS/firefox
 *
 * Installs the unpacked package over WebDriver BiDi (`browser.installExtension`, as D42/D51 measured
 * Firefox 156), serves the probe page from loopback only, and reads, per host: every WebGL 1/2 string
 * and limit, the extension list, the WebGPU adapter identity, a uniform-clear `readPixels` and 2D
 * `getImageData` (how many pixels differ from the clear colour), and the signals RFP fixes (time zone,
 * screen, UA). Headful by default — WebGL in headless Firefox is not the GPU users have — and every
 * reading is VOID unless `document.visibilityState` is "visible" (an occluded window reports
 * "hidden"; `--allow-hidden` records it instead of aborting). The first-run options tab is closed so it
 * cannot sit in front of the probe page.
 *
 * `--instrument` copies the package to a temp dir and adds ONE line after `GECKO_RFP` in that copy's
 * shim.js, publishing `window.__neProbe = "gecko|other / rfp|no-rfp"` — the boot-time verdict, which a
 * page cannot otherwise observe (both branches answer with Firefox's own values). Measurement only;
 * never shipped. The probe reads it in the top document and in a same-origin child frame.
 */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const argv = process.argv.slice(2);
const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
const VALUED = new Set(['--pref', '--hosts', '--puppeteer']);
const EXT_ARG = argv.find((a, i) => !a.startsWith('--') && !VALUED.has(argv[i - 1]));
const prefs = {};
if (argv.includes('--rfp')) prefs['privacy.resistFingerprinting'] = true;
if (argv.includes('--fpp')) prefs['privacy.fingerprintingProtection'] = true;
argv.forEach((a, i) => {
  if (a !== '--pref') return;
  const [k, v] = argv[i + 1].split('=');
  prefs[k] = v === 'true' ? true : v === 'false' ? false : /^\d+$/.test(v) ? +v : v;
});
const HOSTS = (opt('--hosts') || '127.0.0.1').split(',');
const HEADLESS = argv.includes('--headless');

function loadPuppeteer() {
  const dirs = [opt('--puppeteer'), process.env.NULLECHO_PUPPETEER_DIR].filter(Boolean);
  const tries = [() => createRequire(import.meta.url), ...dirs.map((d) => () => createRequire(path.join(path.resolve(d), 'package.json')))];
  for (const t of tries) {
    for (const name of ['puppeteer-core', 'puppeteer']) {
      try { return t()(name); } catch (_) { /* next */ }
    }
  }
  console.error('puppeteer not found: pass --puppeteer <dir> or set NULLECHO_PUPPETEER_DIR');
  process.exit(2);
}
const puppeteer = loadPuppeteer();

/** The one-line, measurement-only instrumentation of a COPY of the package (see header). */
function instrumentedCopy(src) {
  const dst = fs.mkdtempSync(path.join(os.tmpdir(), 'nullecho-ff-instr-'));
  fs.cpSync(src, dst, { recursive: true });
  const shimPath = path.join(dst, 'src', 'shim.js');
  const shim = fs.readFileSync(shimPath, 'utf8');
  const at = shim.indexOf('const GECKO_RFP = (() => {');
  const end = at < 0 ? -1 : shim.indexOf('})();\n', at);
  if (end < 0) { console.error('--instrument: GECKO_RFP not found in the package shim (pre-D53 build?)'); process.exit(2); }
  const cut = end + '})();\n'.length;
  const line = "  try { Object.defineProperty(globalThis, '__neProbe', { value: (ENGINE_GECKO ? 'gecko' : 'other') + '/' + (GECKO_RFP ? 'rfp' : 'no-rfp'), configurable: true }); } catch (_) {}\n";
  fs.writeFileSync(shimPath, shim.slice(0, cut) + line + shim.slice(cut));
  return dst;
}
const EXT = EXT_ARG ? (argv.includes('--instrument') ? instrumentedCopy(path.resolve(EXT_ARG)) : path.resolve(EXT_ARG)) : null;

const PAGE = `<!doctype html><title>firefox-webgl-probe</title><body>probe<script>
function gl(kind){const g=document.createElement('canvas').getContext(kind);if(!g)return null;
  const d=g.getExtension('WEBGL_debug_renderer_info');const arr=(v)=>v&&v.length!==undefined?Array.from(v):v;
  return {VERSION:g.getParameter(g.VERSION),SHADING_LANGUAGE_VERSION:g.getParameter(g.SHADING_LANGUAGE_VERSION),
    VENDOR:g.getParameter(g.VENDOR),RENDERER:g.getParameter(g.RENDERER),debugExt:!!d,
    UNMASKED_VENDOR:g.getParameter(0x9245),UNMASKED_RENDERER:g.getParameter(0x9246),
    MAX_TEXTURE_SIZE:g.getParameter(g.MAX_TEXTURE_SIZE),MAX_CUBE_MAP_TEXTURE_SIZE:g.getParameter(g.MAX_CUBE_MAP_TEXTURE_SIZE),
    MAX_RENDERBUFFER_SIZE:g.getParameter(g.MAX_RENDERBUFFER_SIZE),MAX_VIEWPORT_DIMS:arr(g.getParameter(g.MAX_VIEWPORT_DIMS)),
    ALIASED_LINE_WIDTH_RANGE:arr(g.getParameter(g.ALIASED_LINE_WIDTH_RANGE)),extensions:g.getSupportedExtensions()};}
async function gpu(){if(!navigator.gpu)return 'no navigator.gpu';
  try{const a=await navigator.gpu.requestAdapter();if(!a)return 'no adapter';const i=a.info||{};
    return {vendor:i.vendor,architecture:i.architecture,device:i.device,description:i.description,
      subgroupMinSize:i.subgroupMinSize,subgroupMaxSize:i.subgroupMaxSize,features:Array.from(a.features||[]).sort()};}
  catch(e){return 'error '+e;}}
function pixels(){const c=document.createElement('canvas');c.width=16;c.height=16;const g=c.getContext('webgl');
  g.clearColor(0.2,0.4,0.6,1);g.clear(g.COLOR_BUFFER_BIT);const px=new Uint8Array(1024);g.readPixels(0,0,16,16,g.RGBA,g.UNSIGNED_BYTE,px);
  let gl=0;for(let i=0;i<px.length;i+=4)if(px[i]!==51||px[i+1]!==102||px[i+2]!==153||px[i+3]!==255)gl++;
  const c2=document.createElement('canvas');c2.width=16;c2.height=16;const x=c2.getContext('2d');x.fillStyle='rgb(51,102,153)';x.fillRect(0,0,16,16);
  const d=x.getImageData(0,0,16,16).data;let c2d=0;for(let i=0;i<d.length;i+=4)if(d[i]!==51||d[i+1]!==102||d[i+2]!==153||d[i+3]!==255)c2d++;
  return {webglOffClear:gl,canvas2dOffClear:c2d};}
async function child(){const f=document.createElement('iframe');f.src='/child';document.body.appendChild(f);
  await new Promise((r)=>f.onload=r);try{const v=f.contentWindow.__neProbe;return v===undefined?'(unset)':v;}catch(e){return 'error '+e;}}
window.run=async()=>({visibility:document.visibilityState,
  verdict:window.__neProbe===undefined?'(unset)':window.__neProbe,verdictChild:await child(),
  userAgent:navigator.userAgent,platform:navigator.platform,hardwareConcurrency:navigator.hardwareConcurrency,
  timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,tzOffset:new Date().getTimezoneOffset(),
  screen:{width:screen.width,height:screen.height,availWidth:screen.availWidth,availHeight:screen.availHeight,
    availLeft:screen.availLeft,availTop:screen.availTop,colorDepth:screen.colorDepth},
  pixels:pixels(),webgl:gl('webgl'),webgl2:gl('webgl2'),webgpu:await gpu(),visibilityAtEnd:document.visibilityState});
</script>`;

const handler = (q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(PAGE); };
const srv = http.createServer(handler).listen(0, '127.0.0.1');
await new Promise((r) => srv.on('listening', r));
const PORT = srv.address().port;
const srv6 = HOSTS.some((h) => h.includes(':') || h === 'localhost') ? http.createServer(handler).listen(PORT, '::1') : null;
if (srv6) await new Promise((r) => srv6.on('listening', r));

const browser = await puppeteer.launch({
  browser: 'firefox', protocol: 'webDriverBiDi', headless: HEADLESS,
  executablePath: process.env.FIREFOX || '/Applications/Firefox.app/Contents/MacOS/firefox',
  extraPrefsFirefox: prefs,
});

async function closeExtensionTabs() {
  for (const pg of await browser.pages()) if (pg.url().startsWith('moz-extension://')) await pg.close();
}

async function measure(host) {
  await closeExtensionTabs();
  const p = await browser.newPage();
  await p.bringToFront();
  await p.goto(`http://${host}:${PORT}/`, { waitUntil: 'load' });
  for (let i = 0; i < 20 && await p.evaluate(() => document.visibilityState) !== 'visible'; i++) {
    await p.bringToFront(); await new Promise((r) => setTimeout(r, 250));
  }
  const r = await p.evaluate(() => window.run());
  r.host = host;
  await p.close();
  if ((r.visibility !== 'visible' || r.visibilityAtEnd !== 'visible') && !argv.includes('--allow-hidden')) {
    throw new Error(`VOID: probe page on ${host} was not visible (${r.visibility} → ${r.visibilityAtEnd})`);
  }
  return r;
}

const line = (r) => {
  const g = r.webgl || {};
  const w = r.webgpu;
  return [
    `  ${r.host} vis=${r.visibility}/${r.visibilityAtEnd} verdict=${r.verdict} child=${r.verdictChild} hwc=${r.hardwareConcurrency} tz=${r.timeZone}/${r.tzOffset}`,
    `    screen ${r.screen.width}x${r.screen.height} avail ${r.screen.availWidth}x${r.screen.availHeight}@${r.screen.availLeft},${r.screen.availTop} depth ${r.screen.colorDepth}`,
    `    WebGL VENDOR="${g.VENDOR}" RENDERER="${g.RENDERER}" UNMASKED="${g.UNMASKED_VENDOR}" / "${g.UNMASKED_RENDERER}"`,
    `          VERSION="${g.VERSION}" SLV="${g.SHADING_LANGUAGE_VERSION}" MAX_TEXTURE_SIZE=${g.MAX_TEXTURE_SIZE} VIEWPORT=${JSON.stringify(g.MAX_VIEWPORT_DIMS)} extensions=${(g.extensions || []).length}`,
    `    WebGL2 VERSION="${r.webgl2?.VERSION}" UNMASKED="${r.webgl2?.UNMASKED_VENDOR}" / "${r.webgl2?.UNMASKED_RENDERER}" extensions=${(r.webgl2?.extensions || []).length}`,
    `    WebGPU ${typeof w === 'object' ? `vendor="${w.vendor}" architecture="${w.architecture}" subgroups=${w.subgroupMinSize}/${w.subgroupMaxSize} features=${w.features.length}` : w}`,
    `    read-back pixels unlike the clear colour: webgl ${r.pixels.webglOffClear}/256, canvas2d ${r.pixels.canvas2dOffClear}/256`,
  ].join('\n');
};

try {
  const version = await browser.version();
  const off = [];
  for (const h of HOSTS) off.push(await measure(h));
  let on = null, id = null;
  if (EXT) {
    id = await browser.installExtension(EXT);
    await new Promise((r) => setTimeout(r, 2500));   // let the background script register its rules
    on = [];
    for (const h of HOSTS) on.push(await measure(h));
  }
  const out = { browser: version, headless: HEADLESS, prefs, extension: EXT_ARG || null, instrumented: argv.includes('--instrument'), extensionId: id, off, on };
  if (argv.includes('--json')) console.log(JSON.stringify(out, null, 1));
  console.log(`${version}${HEADLESS ? ' (HEADLESS)' : ''} prefs=${JSON.stringify(prefs)}${out.instrumented ? ' [instrumented copy]' : ''}`);
  console.log('OFF (no extension)'); for (const r of off) console.log(line(r));
  if (on) { console.log(`ON (${EXT_ARG})`); for (const r of on) console.log(line(r)); }
} finally {
  await browser.close();
  srv.close(); if (srv6) srv6.close();
}
