/**
 * Generates `harness/claim-personas.generated.js` — the persona blobs that
 * `harness/claim-verification.html` hands the shim through the real handshake.
 *
 *   node harness/gen-claim-personas.mjs            # regenerate, mac host
 *   node harness/gen-claim-personas.mjs --family win
 *
 * WHY A GENERATED FILE INSTEAD OF AN IMPORT.
 * The handshake has to be answered SYNCHRONOUSLY, inside the listener for the
 * shim's boot event — if any shimmed API is read first the shim locks itself to
 * its stage-1 fallback persona (`reason: 'api-read-before-handshake'`) and the
 * whole measurement describes a persona nobody chose. A `<script type="module">`
 * import of `ext/src/personas.js` is deferred by definition, so it cannot be the
 * source. A classic script, generated from the real `personaFor()`, can.
 *
 * WHAT IT GENERATES.
 * One persona per SITE KEY, not per salt — because the site key is the thing the
 * product actually keys on. `background.js siteKeyFor(url)` →
 * `registrableDomain(hostname)`, and for a loopback host that function returns the
 * hostname unchanged. So `localhost` and `127.0.0.1` are two different sites to
 * Nullecho, which is what makes a two-origin join test possible on one machine
 * with no /etc/hosts edits. (Ports are NOT part of a site key: :4886 and :4887 on
 * the same hostname are ONE site and get ONE persona.)
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { personaFor, personasForFamily } from '../ext/src/personas.js';
import { registrableDomain } from '../ext/src/suffixes.js';

/** Fixed so every run of the harness is comparable. Not a secret; not a real salt. */
const SALT = 'nullecho-claim-verification-2026-09-17';

/** Site keys the harness can be loaded under, plus two real-world illustrations. */
const SITE_KEYS = ['localhost', '127.0.0.1', '::1', 'nytimes.com', 'doubleclick.net'];

const family = (() => {
  const i = process.argv.indexOf('--family');
  return i >= 0 ? process.argv[i + 1] : 'mac';
})();

const personas = {};
for (const key of SITE_KEYS) personas[key] = personaFor(SALT, key, family);

const here = dirname(fileURLToPath(import.meta.url));
const lines = [
  '/**',
  ' * GENERATED FILE — do not edit. `node harness/gen-claim-personas.mjs`',
  ` * Generated ${new Date().toISOString().slice(0, 10)} from ext/src/personas.js`,
  ` * salt   = ${JSON.stringify(SALT)}`,
  ` * family = ${JSON.stringify(family)}  (personaFor's third argument; the real`,
  " *          extension detects this from the host, see DECISIONS.md D12)",
  ' *',
  ' * Keyed by SITE KEY = registrableDomain(location.hostname), which is exactly what',
  " * background.js's siteKeyFor() computes for a page URL.",
  ` * Pool for this family: ${personasForFamily(family).map((p) => p.id).join(', ')}`,
  ' */',
  'window.__NULLECHO_CLAIM_SALT = ' + JSON.stringify(SALT) + ';',
  'window.__NULLECHO_CLAIM_FAMILY = ' + JSON.stringify(family) + ';',
  'window.__NULLECHO_CLAIM_PERSONAS = {',
  ...SITE_KEYS.map((k) => '  ' + JSON.stringify(k) + ': ' + JSON.stringify(personas[k]) + ','),
  '};',
  '',
];
writeFileSync(join(here, 'claim-personas.generated.js'), lines.join('\n'));

for (const key of SITE_KEYS) {
  const p = personas[key];
  console.log(
    `${key.padEnd(16)} key=${registrableDomain(key).padEnd(16)} ${p.id.padEnd(22)} ` +
    `${p.cores}c/${p.memory}GB seed=${p.seed}`,
  );
}
