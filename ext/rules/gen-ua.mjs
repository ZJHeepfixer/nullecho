#!/usr/bin/env node
/**
 * Nullecho — generator for the per-family User-Agent / Client-Hint header rulesets.
 * `node rules/gen-ua.mjs` rewrites `ua-win.json`, `ua-mac.json`, `ua-linux.json`.
 *
 * ⚠ UNLIKE every other file in this directory, the three `ua-*.json` files are
 * BUILD ARTIFACTS, not the source of truth. Their values are the persona pool's
 * `ua` / `uaData` fields (src/personas.js) and the shim's GREASE brand
 * (src/shim.js). Editing the JSON by hand re-creates the exact defect they exist
 * to close — a header that disagrees with what the JS persona says — so
 * `validate.mjs` fails if the files differ from what this script would emit.
 *
 * ── Why family-level, not per-origin (DECISIONS.md D19) ────────────────────
 *
 * Personas are per-origin (D2), but the persona for an origin is not known until
 * the service worker has answered that origin's handshake — and the very first
 * request to a site, the `main_frame` navigation, is sent before any content
 * script exists. A per-origin header rule therefore cannot exist for the request
 * that matters most. What IS known before any request is the host's OS family
 * (D12): every persona this machine can ever be shown — the pre-handshake
 * fallback included — belongs to it, and within a family the pool's `ua` and
 * `uaData` fields are (almost) constant. So one static ruleset per family, with
 * `background.js` enabling the host's, gives a header that agrees with the JS
 * persona from the first byte, with no race to lose.
 *
 * The "almost" is measured, not assumed: for every header this script tallies
 * the pool's values by persona weight, emits the majority, and reports every
 * persona that disagrees as a RESIDUAL. Today there are NONE: the one there was
 * (`macos-chrome-intel-iris`, `architecture: "x86"` against the macOS header's
 * `"arm"`) was retired 2026-09-16 (D24). `rules/ua.test.js` pins the empty list
 * so a pool change that adds a contradiction fails a test instead of shipping.
 *
 * ── DNR facts this design leans on ─────────────────────────────────────────
 *
 *  · `modifyHeaders` rules only apply when their priority beats every matching
 *    `allow` / `allowAllRequests` rule. The per-site allowlist writes
 *    `allowAllRequests` at priority 100000, so on a site where the user switched
 *    Nullecho off — where the shim stands down and `navigator` is real — these
 *    rules are suppressed too and the real headers go out. No new contradiction.
 *  · `set` on a request header that is absent ADDS it. Chrome sends the
 *    high-entropy hints (`Sec-CH-UA-Arch`, `-Platform-Version`, …) only when a
 *    server asked via `Accept-CH`; under these rules they go out on every secure
 *    request. That is a behavioural tell ("this client volunteers hints"), not a
 *    contradiction — and it is common in the wild, because Permissions-Policy
 *    delegation hands third parties hints they never requested. The alternative,
 *    `remove`, would leave a Chrome that ignores `Accept-CH`, which is the rarer
 *    behaviour. See D19 for the full argument.
 *  · Client Hints are never sent over plain HTTP, so the hint rule is scoped to
 *    `https` / `wss`. The `User-Agent` rule is not scoped: that header is on
 *    every request.
 *  · The Chrome Web Store and AMO block content scripts, so on those origins the
 *    JS is always real. They are excluded so the header stays real there too.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PERSONAS, FAMILIES, familyOf, personasForFamily } from '../src/personas.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHIM = path.join(HERE, '..', 'src', 'shim.js');

/** Ruleset id (manifest `rule_resources[].id`) and file per family. Mirrored in background.js. */
export const UA_RULESETS = {
  win: { id: 'ua-win', file: 'ua-win.json', range: [5100, 5199] },
  mac: { id: 'ua-mac', file: 'ua-mac.json', range: [5200, 5299] },
  linux: { id: 'ua-linux', file: 'ua-linux.json', range: [5300, 5399] },
};

/**
 * Origins where content scripts cannot run, so the page's JS is always the real
 * machine. Rewriting the header there would create the contradiction the rules
 * exist to remove. Both request and initiator are excluded: the store's own
 * navigation has no initiator, its subresources have the store as initiator.
 */
export const UA_EXCLUDED_DOMAINS = ['chromewebstore.google.com', 'addons.mozilla.org'];

/** Same list as gpc.json rule 5000 — every type, `main_frame` included. */
export const UA_RESOURCE_TYPES = [
  'main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'font', 'object',
  'xmlhttprequest', 'ping', 'csp_report', 'media', 'websocket', 'other',
];

/** Chrome only sends Client Hints on secure transports. */
export const SECURE_ONLY = '^(https|wss)://';

/**
 * The GREASE brand the shim emits, read from `src/shim.js` as text — it is a
 * classic script and cannot be imported. If the shim moves or renames the
 * constant this throws rather than silently emitting a different brand.
 */
export function shimGrease(shimSrc = fs.readFileSync(SHIM, 'utf8')) {
  const m = /GREASE\s*=\s*\{\s*brand:\s*'([^']*)'\s*,\s*version:\s*'([^']*)'/.exec(shimSrc);
  if (!m) throw new Error('rules/gen-ua.mjs: could not find `const GREASE = { brand, version }` in src/shim.js');
  return { brand: m[1], version: m[2] };
}

/** Mirror of `brandsFor()` in src/shim.js — same order, same GREASE entry. */
export function brandsFor(ua, grease) {
  const m = /Chrome\/([\d.]+)/.exec(ua || '');
  const full = (m && m[1]) || '151.0.0.0';
  const major = full.split('.')[0];
  return {
    full,
    brands: [
      { brand: grease.brand, version: grease.version },
      { brand: 'Chromium', version: major },
      { brand: 'Google Chrome', version: major },
    ],
    fullVersionList: [
      { brand: grease.brand, version: grease.version + '.0.0.0' },
      { brand: 'Chromium', version: full },
      { brand: 'Google Chrome', version: full },
    ],
  };
}

// ── RFC 8941 structured-field serialisation (the subset Client Hints use) ──

/** sf-string: quoted, with `\` and `"` escaped. */
export const sfString = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
/** sf-boolean. */
export const sfBoolean = (b) => (b ? '?1' : '?0');
/** sf-list of brand items exactly as Chrome writes `Sec-CH-UA`: `"Brand";v="99", …`. */
export const sfBrandList = (list) => list.map((b) => `${sfString(b.brand)};v=${sfString(b.version)}`).join(', ');

/**
 * Header name → value, for ONE persona. The JS side of each pair is what
 * `navigator.userAgent` / `navigator.userAgentData` report under the shim; the
 * header is Chrome's wire form of the same value.
 */
export function headersForPersona(persona, grease) {
  const b = brandsFor(persona.ua, grease);
  const d = persona.uaData || {};
  return {
    'User-Agent': persona.ua,
    'Sec-CH-UA': sfBrandList(b.brands),
    'Sec-CH-UA-Mobile': sfBoolean(false),
    'Sec-CH-UA-Platform': sfString(d.platform || ''),
    'Sec-CH-UA-Full-Version-List': sfBrandList(b.fullVersionList),
    'Sec-CH-UA-Full-Version': sfString(b.full),
    'Sec-CH-UA-Platform-Version': sfString(d.platformVersion || ''),
    'Sec-CH-UA-Arch': sfString(d.architecture || ''),
    'Sec-CH-UA-Bitness': sfString(d.bitness || ''),
    'Sec-CH-UA-Model': sfString(d.model || ''),
    'Sec-CH-UA-WoW64': sfBoolean(!!d.wow64),
  };
}

/** Headers that are on every request (no `Accept-CH` needed). The rest are hints. */
export const ALWAYS_SENT = new Set(['User-Agent', 'Sec-CH-UA', 'Sec-CH-UA-Mobile', 'Sec-CH-UA-Platform']);

/**
 * One family's header plan: the weight-majority value per header, and every
 * persona whose own value differs from it (the residual contradictions).
 */
export function familyHeaderPlan(family, grease = shimGrease()) {
  const pool = personasForFamily(family).filter((p) => familyOf(p) === family);
  const perPersona = pool.map((p) => ({ persona: p, headers: headersForPersona(p, grease) }));
  const names = Object.keys(perPersona[0].headers);
  const headers = {};
  const residuals = [];
  for (const name of names) {
    const weight = new Map();
    for (const { persona, headers: h } of perPersona) {
      weight.set(h[name], (weight.get(h[name]) ?? 0) + persona.weight);
    }
    const [winner] = [...weight.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))[0];
    headers[name] = winner;
    for (const { persona, headers: h } of perPersona) {
      if (h[name] !== winner) {
        residuals.push({ persona: persona.id, header: name, persona_value: h[name], header_value: winner });
      }
    }
  }
  return { family, headers, residuals };
}

/** The two DNR rules for one family. */
export function rulesForFamily(family, grease = shimGrease()) {
  const { headers } = familyHeaderPlan(family, grease);
  const { range } = UA_RULESETS[family];
  const condition = {
    excludedRequestDomains: UA_EXCLUDED_DOMAINS,
    excludedInitiatorDomains: UA_EXCLUDED_DOMAINS,
    resourceTypes: UA_RESOURCE_TYPES,
  };
  const entry = (name) => ({ header: name, operation: 'set', value: headers[name] });
  return [
    {
      id: range[0],
      priority: 1,
      action: { type: 'modifyHeaders', requestHeaders: [entry('User-Agent')] },
      condition,
    },
    {
      id: range[0] + 1,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: Object.keys(headers).filter((n) => n !== 'User-Agent').map(entry),
      },
      condition: { regexFilter: SECURE_ONLY, ...condition },
    },
  ];
}

/** Every family's ruleset, as `{ [file]: rules }`. */
export function buildUaRulesets(grease = shimGrease()) {
  const out = {};
  for (const family of FAMILIES) out[UA_RULESETS[family].file] = rulesForFamily(family, grease);
  return out;
}

export const serialise = (rules) => JSON.stringify(rules, null, 2) + '\n';

// ── CLI ──────────────────────────────────────────────────────────────────
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const grease = shimGrease();
  for (const [file, rules] of Object.entries(buildUaRulesets(grease))) {
    fs.writeFileSync(path.join(HERE, file), serialise(rules));
    console.log(`wrote ${file} (${rules.length} rules)`);
  }
  for (const family of FAMILIES) {
    const { residuals } = familyHeaderPlan(family, grease);
    for (const r of residuals) {
      console.log(`residual: ${family}/${r.persona} ${r.header}: JS says ${r.persona_value}, header says ${r.header_value}`);
    }
  }
  console.log(`personas covered: ${PERSONAS.length}`);
}
