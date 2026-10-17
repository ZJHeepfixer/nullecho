#!/usr/bin/env node
// Shim ON vs shim OFF across the candidate sites in survey/sites.json, one site at a time, politely:
// two loads per site (one per variant, each in a fresh profile), a pause between runs and a longer
// one between sites. Nothing here retries a wall or works around one; a wall is a result.
//
//   NULLECHO_PUPPETEER_DIR=<dir> node survey.mjs <outDir> <shimOnExt> <shimOffExt> [vendor ...]
//
// <shimOnExt>  the extension as shipped (main), shim included
// <shimOffExt> the same extension with shim-loader.js + shim.js removed (tesla/rig/make-variants.mjs no-shim)
// Writes <outDir>/<vendor>/<host>/{shim-on,shim-off}.json via probe-site.mjs, and a summary.json.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const [OUT, ON, OFF, ...only] = process.argv.slice(2);
if (!OUT || !ON || !OFF) { console.error('usage: survey.mjs <outDir> <shimOnExt> <shimOffExt> [vendor ...]'); process.exit(2); }
const sites = JSON.parse(fs.readFileSync(path.join(HERE, '../survey/sites.json'), 'utf8'));
const summary = [];
for (const [vendor, urls] of Object.entries(sites)) {
  if (vendor.startsWith('_') || (only.length && !only.includes(vendor))) continue;
  for (const url of urls) {
    const host = new URL(url).hostname;
    const dir = path.join(OUT, vendor, host);
    const r = spawnSync(process.execPath, [path.join(HERE, 'probe-site.mjs'), '--pause', '6000', dir, url, `shim-on=${ON}`, `shim-off=${OFF}`],
      { encoding: 'utf8', timeout: 240000 });
    process.stdout.write(`## ${vendor} ${host}\n${(r.stdout || '').split('\n').filter((l) => l.startsWith('==')).join('\n')}\n`);
    if (r.status !== 0) process.stdout.write(`   (exit ${r.status}) ${(r.stderr || '').split('\n').slice(-3).join(' ')}\n`);
    const read = (l) => { try { return JSON.parse(fs.readFileSync(path.join(dir, `${l}.json`), 'utf8')).visits[0]; } catch { return null; } };
    const on = read('shim-on'); const off = read('shim-off');
    const names = new Set([...(on?.cookiesAfterLoad ?? []), ...(off?.cookiesAfterLoad ?? []),
      ...[...(on?.documents ?? []), ...(off?.documents ?? [])].flatMap((d) => d.setCookieNames)]);
    summary.push({ vendor, url, shimOn: on ? (on.wall ?? 'OK') : 'error', shimOff: off ? (off.wall ?? 'OK') : 'error',
      firstDocSetCookie: on?.documents?.[0]?.setCookieNames ?? null, cookieNames: [...names].sort() });
    fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
    await new Promise((res) => setTimeout(res, 8000));
  }
}
console.log('SURVEY-DONE');
