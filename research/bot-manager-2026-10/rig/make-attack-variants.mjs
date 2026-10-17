#!/usr/bin/env node
// D59 attack builds: scratch COPIES of an unzipped store package, each broken in exactly one way.
// The shipped files are never edited.
//   node make-attack-variants.mjs <unzipped chrome zip> <outDir>
//
//   no-detect      Akamai's trigger cookie list is empty — the observer sees tesla's Set-Cookie and matches
//                  nothing, i.e. the detection is gone. Expect tesla.com to be denied again.
//   late-main      every hit is recorded 400 ms late — the persona handshake wins the race on the first
//                  document, so only the race fallback (one guarded reload) can save the visit.
//   subresource-only  main_frame responses are ignored; only the top document's own later requests
//                  (the sensor's script / POST answers) can flag the site — the late-cookie case.
import fs from 'node:fs';
import path from 'node:path';

const [src, out] = process.argv.slice(2);
if (!src || !out) { console.error('usage: make-attack-variants.mjs <unzipped zip> <outDir>'); process.exit(2); }
const copy = (name) => { const d = path.join(out, name); fs.rmSync(d, { recursive: true, force: true }); fs.cpSync(src, d, { recursive: true }); return d; };
function patch(dir, rel, from, to) {
  const f = path.join(dir, rel);
  const s = fs.readFileSync(f, 'utf8');
  if (!s.includes(from)) throw new Error(`${rel}: anchor not found: ${from}`);
  fs.writeFileSync(f, s.replace(from, to));
}
patch(copy('no-detect'), 'src/bot-manager.js', "cookies: Object.freeze(['_abck', 'bm_sz'])", 'cookies: Object.freeze([])');
patch(copy('late-main'), 'src/background.js',
  'return ready().then(() => recordBotManager(hit, details)).catch(warn(\'bot-manager\'));',
  'return new Promise((r) => setTimeout(r, 400)).then(() => ready()).then(() => recordBotManager(hit, details)).catch(warn(\'bot-manager\'));');
patch(copy('subresource-only'), 'src/bot-manager.js',
  "const mainFrame = details.type === 'main_frame';",
  "const mainFrame = details.type === 'main_frame'; if (mainFrame) return null;");
console.log('attack variants:', fs.readdirSync(out).join(' '));
