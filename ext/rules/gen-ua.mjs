#!/usr/bin/env node
/**
 * Nullecho — generator for the per-family Client-Hint rulesets.
 * `node rules/gen-ua.mjs` rewrites `ua-win.json`, `ua-mac.json`, `ua-linux.json`.
 *
 * ⚠ UNLIKE every other file in this directory, the three `ua-*.json` files are
 * BUILD ARTIFACTS, not the source of truth. `validate.mjs` fails if they differ
 * from what this script emits; never edit them by hand.
 *
 * ── What they do since D51 (2026-09-28): REMOVE seven hints, rewrite nothing ──
 *
 * They used to `set` User-Agent, Sec-CH-UA, -Mobile and -Platform to the persona
 * family's values (D19), which pinned "Chrome/151.0.0.0" and a synthesised brand
 * list with a fixed GREASE entry (`"Not;A=Brand";v="99"`) in a fixed order. The
 * owner's Chrome was 153 and sends `"Google Chrome";v="153", "Not_A Brand";v="8",
 * "Chromium";v="153"`; Chrome for Testing 146/149 sends no "Google Chrome" brand
 * at all. Inside a family every persona's UA and low-entropy hints equal the real
 * reduced UA except the version, so the rewrite hid nothing and added a claim the
 * browser contradicts — the TLS stack, the feature set, Google's X-Client-Data,
 * every Worker, and every four-weekly Chrome release — and on Edge, Brave, Opera
 * and Firefox it renamed the browser. The shim stopped reporting those values in
 * the same change (src/shim.js REAL_UA), so JS and the wire now both say what the
 * browser says, and there is nothing to rewrite: those four headers go out
 * exactly as the browser writes them.
 *
 * What stays is D49: the seven high-entropy hints a server can ask for with
 * `Accept-CH` (Full-Version-List, Full-Version, Platform-Version, Arch, Bitness,
 * Model, WoW64) are REMOVED. The JS persona still answers platformVersion /
 * architecture / bitness / model / wow64 with its own values, and a request
 * header carrying the machine's real ones would contradict it; DNR cannot express
 * "send the persona's value only when asked", and `set` volunteered them on every
 * request (the D49 wrong turn). Full-Version(-List) would now agree with the JS,
 * but a Chrome that answers some Accept-CH hints and drops others is its own
 * tell, so all seven go together, as D49 decided.
 *
 * ── Why still three files ─────────────────────────────────────────────────
 *
 * The rule no longer depends on the family: the three files are identical but
 * for their rule ids. They are kept — one per family, `background.js` enabling
 * the host's — so the manifests, the enable logic and the id ranges did not have
 * to move in the same change. Folding them into one always-enabled ruleset is a
 * later simplification (it would also close D19 residual 7, the install/update
 * window in which the hints are not yet removed).
 *
 * ── DNR facts this leans on ───────────────────────────────────────────────
 *
 *  · `modifyHeaders` rules only apply when their priority beats every matching
 *    `allow` / `allowAllRequests` rule. The per-site allowlist writes
 *    `allowAllRequests` at priority 100000, so on a site where the user switched
 *    Nullecho off — where the shim stands down and `navigator` is real — the
 *    hints go out as the browser writes them.
 *  · NOT scoped to `https` / `wss` any more (it was, D19–D50). Measured in Chrome
 *    for Testing 149 on 2026-09-28: Chrome sends every requested hint to
 *    `http://localhost` — a potentially trustworthy origin, so a secure context —
 *    and the old `^(https|wss)://` filter let the real platformVersion / arch /
 *    full version through there next to the persona's JS values. A `remove` of an
 *    absent header does nothing, so scoping bought nothing once nothing is SET.
 *  · The Chrome Web Store and AMO block content scripts, so on those origins the
 *    JS is always real. They are excluded so the headers stay real there too.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FAMILIES } from '../src/personas.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * Ruleset id (manifest `rule_resources[].id`), file and id range per family.
 * Mirrored in background.js. The hint rule keeps the id it had before D51
 * (`range[0] + 1`); `range[0]` was the retired User-Agent rule.
 */
export const UA_RULESETS = {
  win: { id: 'ua-win', file: 'ua-win.json', range: [5100, 5199] },
  mac: { id: 'ua-mac', file: 'ua-mac.json', range: [5200, 5299] },
  linux: { id: 'ua-linux', file: 'ua-linux.json', range: [5300, 5399] },
};

/**
 * Origins where content scripts cannot run, so the page's JS is always the real
 * machine. Both request and initiator are excluded: the store's own navigation
 * has no initiator, its subresources have the store as initiator.
 */
export const UA_EXCLUDED_DOMAINS = ['chromewebstore.google.com', 'addons.mozilla.org'];

/** Same list as gpc.json rule 5000 — every type, `main_frame` included. */
export const UA_RESOURCE_TYPES = [
  'main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'font', 'object',
  'xmlhttprequest', 'ping', 'csp_report', 'media', 'websocket', 'other',
];

/** The seven Accept-CH hints D49 removes. Order is the emitted order. */
export const REMOVED_HINTS = [
  'Sec-CH-UA-Full-Version-List', 'Sec-CH-UA-Full-Version', 'Sec-CH-UA-Platform-Version',
  'Sec-CH-UA-Arch', 'Sec-CH-UA-Bitness', 'Sec-CH-UA-Model', 'Sec-CH-UA-WoW64',
];

/**
 * Headers the browser writes on every request that these rules must NEVER touch
 * (D51): the JS reports the real browser, so the wire must too.
 */
export const NEVER_REWRITTEN = ['User-Agent', 'Sec-CH-UA', 'Sec-CH-UA-Mobile', 'Sec-CH-UA-Platform'];

/** The one DNR rule for one family. */
export function rulesForFamily(family) {
  const { range } = UA_RULESETS[family];
  return [
    {
      id: range[0] + 1,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: REMOVED_HINTS.map((header) => ({ header, operation: 'remove' })),
      },
      condition: {
        excludedRequestDomains: UA_EXCLUDED_DOMAINS,
        excludedInitiatorDomains: UA_EXCLUDED_DOMAINS,
        resourceTypes: UA_RESOURCE_TYPES,
      },
    },
  ];
}

/** Every family's ruleset, as `{ [file]: rules }`. */
export function buildUaRulesets() {
  const out = {};
  for (const family of FAMILIES) out[UA_RULESETS[family].file] = rulesForFamily(family);
  return out;
}

export const serialise = (rules) => JSON.stringify(rules, null, 2) + '\n';

// ── CLI ──────────────────────────────────────────────────────────────────
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const [file, rules] of Object.entries(buildUaRulesets())) {
    fs.writeFileSync(path.join(HERE, file), serialise(rules));
    console.log(`wrote ${file} (${rules.length} rule${rules.length === 1 ? '' : 's'})`);
  }
}
