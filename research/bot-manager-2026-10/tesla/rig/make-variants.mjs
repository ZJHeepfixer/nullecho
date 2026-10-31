#!/usr/bin/env node
// Build the bisect variants of the Chrome extension as scratch COPIES of ext/ (ext/ itself is never edited).
//   node make-variants.mjs <path/to/ext> <outDir>
// Each copy differs from ext/ in exactly one respect:
//   no-ua        the ua-win/mac/linux client-hint removal rules can never match
//   no-shim      shim-loader.js + shim.js content scripts removed (gpc.js, pricing, all rules kept)
//   no-gpc-nav   rule 5000 (Sec-GPC) no longer applies to main_frame / sub_frame
//   no-gpc-js    the gpc.js content script removed (the header rule stays)
//   no-gpc-all   gpc.js removed AND rule 5000 can never match (shim and ua rules kept)
import fs from 'node:fs';
import path from 'node:path';
const [src, out] = process.argv.slice(2);
if (!src || !out) { console.error('usage: make-variants.mjs <ext dir> <out dir>'); process.exit(2); }
const copy = (name) => { const d = path.join(out, name); fs.cpSync(src, d, { recursive: true, filter: (p) => !/\/_metadata(\/|$)/.test(p) }); return d; };
const rd = (d, f) => JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'));
const wr = (d, f, j) => fs.writeFileSync(path.join(d, f), JSON.stringify(j, null, 2));
{ const d = copy('no-ua'); for (const f of ['ua-win', 'ua-mac', 'ua-linux']) { const r = rd(d, `rules/${f}.json`); for (const x of r) x.condition = { requestDomains: ['never.invalid'] }; wr(d, `rules/${f}.json`, r); } }
{ const d = copy('no-shim'); const m = rd(d, 'manifest.json'); m.content_scripts = m.content_scripts.filter((c) => !c.js.some((j) => /shim/.test(j))); wr(d, 'manifest.json', m); }
{ const d = copy('no-gpc-nav'); const r = rd(d, 'rules/gpc.json'); for (const x of r) if (x.id === 5000) x.condition.resourceTypes = x.condition.resourceTypes.filter((t) => t !== 'main_frame' && t !== 'sub_frame'); wr(d, 'rules/gpc.json', r); }
{ const d = copy('no-gpc-js'); const m = rd(d, 'manifest.json'); m.content_scripts = m.content_scripts.filter((c) => !c.js.some((j) => /gpc\.js/.test(j))); wr(d, 'manifest.json', m); }
{ const d = copy('no-gpc-all'); const m = rd(d, 'manifest.json'); m.content_scripts = m.content_scripts.filter((c) => !c.js.some((j) => /gpc\.js/.test(j))); wr(d, 'manifest.json', m); const r = rd(d, 'rules/gpc.json'); wr(d, 'rules/gpc.json', r.map((x) => x.id === 5000 ? { ...x, condition: { ...x.condition, requestDomains: ['never.invalid'] } } : x)); }
console.log('variants:', fs.readdirSync(out).join(' '));
