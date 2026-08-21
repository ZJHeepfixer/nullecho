#!/usr/bin/env node
/**
 * Nullecho — ruleset validator.  `node ext/rules/validate.mjs`
 *
 * A blocklist is a security-relevant artifact: a malformed rule makes Chrome
 * reject the *entire* ruleset silently, and a wrong domain breaks a site the
 * user needs. Everything checkable is checked here, and this must pass before
 * any ruleset change ships.
 *
 * Checks:
 *   1.  every file parses and is a JSON array
 *   2.  rule ids are unique ACROSS ALL FILES, not just within one
 *   3.  every id sits inside the range this file owns
 *   4.  rule shape is valid MV3 DNR (known keys, valid action/condition)
 *   5.  urlFilter and regexFilter are never both present
 *   6.  no `block` rule targets a NEVER_BLOCK domain
 *   7.  no `block` rule opts into main_frame (that breaks direct navigation)
 *   8.  the ranges declared here match what manifest.json actually registers
 *   9.  the counter's view of these rules (src/protocol.js) matches reality —
 *       every non-`block` rule is declared non-blocking, and the reserved
 *       dynamic ranges agree with the ones below
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NEVER_BLOCK, COOKIE_BLOCK_ONLY, isNeverBlock, isCookieBlockOnly } from '../src/allowlist.js';
import {
  NON_BLOCKING_STATIC_RULE_IDS,
  DYNAMIC_RULE_RANGES,
  BLOCKING_RULESET_IDS,
} from '../src/protocol.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXT = path.resolve(HERE, '..');

/** Owned id range per ruleset file. Ranges must not overlap. */
export const RANGES = {
  'ads.json': [1000, 1999],
  'analytics.json': [2000, 2999],
  'social.json': [3000, 3999],
  'fingerprinting.json': [4000, 4999],
  'gpc.json': [5000, 5099],
};

/** Reserved for runtime rules; static rulesets must stay out of these. */
export const DYNAMIC_RANGES = {
  'allowlist: per-site allowAllRequests': [900_000, 900_999],
  'heuristics: block': [1_000_000, 1_049_999],
  'heuristics: cookie-block': [1_050_000, 1_099_999],
  'gpc: per-site exception': [1_100_000, 1_100_999],
};

/** Same ranges as `DYNAMIC_RULE_RANGES` in src/protocol.js, keyed for humans. */
const DYNAMIC_RANGE_KEYS = {
  'allowlist: per-site allowAllRequests': 'allowlist',
  'heuristics: block': 'heuristicBlock',
  'heuristics: cookie-block': 'heuristicCookie',
  'gpc: per-site exception': 'gpcException',
};

const RESOURCE_TYPES = new Set([
  'main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'font', 'object',
  'xmlhttprequest', 'ping', 'csp_report', 'media', 'websocket', 'webtransport',
  'webbundle', 'other',
]);

const CONDITION_KEYS = new Set([
  'urlFilter', 'regexFilter', 'isUrlFilterCaseSensitive', 'initiatorDomains',
  'excludedInitiatorDomains', 'requestDomains', 'excludedRequestDomains',
  'domainType', 'resourceTypes', 'excludedResourceTypes', 'requestMethods',
  'excludedRequestMethods', 'responseHeaders', 'excludedResponseHeaders',
  'tabIds', 'excludedTabIds',
]);

const ACTION_TYPES = new Set([
  'block', 'allow', 'allowAllRequests', 'upgradeScheme', 'redirect', 'modifyHeaders',
]);

const errors = [];
const warnings = [];
const seenIds = new Map(); // id -> file

/** Best-effort host extraction from an ABP-style urlFilter. */
function hostFromUrlFilter(f) {
  const m = /^\|\|([a-z0-9.*_-]+)/i.exec(f);
  return m ? m[1].replace(/\*+$/, '') : null;
}

function checkRule(file, rule, index) {
  const at = `${file}[${index}]`;
  if (typeof rule !== 'object' || rule === null || Array.isArray(rule)) {
    return errors.push(`${at}: rule is not an object`);
  }

  for (const key of Object.keys(rule)) {
    if (!['id', 'priority', 'action', 'condition'].includes(key)) {
      errors.push(`${at}: unknown top-level key "${key}" (Chrome rejects the whole ruleset)`);
    }
  }

  // ── id ────────────────────────────────────────────────────────────────
  if (!Number.isInteger(rule.id) || rule.id < 1) {
    errors.push(`${at}: id must be a positive integer, got ${JSON.stringify(rule.id)}`);
  } else {
    if (seenIds.has(rule.id)) {
      errors.push(`${at}: duplicate id ${rule.id} (already used in ${seenIds.get(rule.id)})`);
    }
    seenIds.set(rule.id, at);
    const [lo, hi] = RANGES[file];
    if (rule.id < lo || rule.id > hi) {
      errors.push(`${at}: id ${rule.id} outside ${file}'s range ${lo}-${hi}`);
    }
    for (const [name, [dlo, dhi]] of Object.entries(DYNAMIC_RANGES)) {
      if (rule.id >= dlo && rule.id <= dhi) {
        errors.push(`${at}: id ${rule.id} collides with reserved runtime range "${name}"`);
      }
    }
  }

  // ── priority ──────────────────────────────────────────────────────────
  if (rule.priority !== undefined && (!Number.isInteger(rule.priority) || rule.priority < 1)) {
    errors.push(`${at}: priority must be an integer >= 1`);
  }

  // ── action ────────────────────────────────────────────────────────────
  const action = rule.action;
  if (!action || typeof action !== 'object') {
    errors.push(`${at}: missing action`);
  } else if (!ACTION_TYPES.has(action.type)) {
    errors.push(`${at}: unknown action.type "${action.type}"`);
  } else if (action.type === 'modifyHeaders') {
    const lists = [...(action.requestHeaders ?? []), ...(action.responseHeaders ?? [])];
    if (lists.length === 0) errors.push(`${at}: modifyHeaders with no headers`);
    for (const h of lists) {
      if (!h.header) errors.push(`${at}: modifyHeaders entry missing "header"`);
      if (!['set', 'remove', 'append'].includes(h.operation)) {
        errors.push(`${at}: bad header operation "${h.operation}"`);
      }
      if (h.operation === 'set' && h.value === undefined) {
        errors.push(`${at}: header "${h.header}" set without a value`);
      }
    }
  }

  // ── condition ─────────────────────────────────────────────────────────
  const c = rule.condition;
  if (!c || typeof c !== 'object') return errors.push(`${at}: missing condition`);

  for (const key of Object.keys(c)) {
    if (!CONDITION_KEYS.has(key)) errors.push(`${at}: unknown condition key "${key}"`);
  }
  if (c.urlFilter && c.regexFilter) {
    errors.push(`${at}: urlFilter and regexFilter are mutually exclusive`);
  }
  if (c.domainType && !['firstParty', 'thirdParty'].includes(c.domainType)) {
    errors.push(`${at}: bad domainType "${c.domainType}"`);
  }
  for (const key of ['resourceTypes', 'excludedResourceTypes']) {
    if (!c[key]) continue;
    if (!Array.isArray(c[key]) || c[key].length === 0) {
      errors.push(`${at}: ${key} must be a non-empty array`);
    }
    for (const t of c[key] ?? []) {
      if (!RESOURCE_TYPES.has(t)) errors.push(`${at}: unknown resource type "${t}"`);
    }
  }
  for (const key of ['requestDomains', 'excludedRequestDomains', 'initiatorDomains', 'excludedInitiatorDomains']) {
    if (!c[key]) continue;
    if (!Array.isArray(c[key]) || c[key].length === 0) {
      errors.push(`${at}: ${key} must be a non-empty array`);
      continue;
    }
    for (const d of c[key]) {
      if (typeof d !== 'string' || !/^[a-z0-9.-]+$/i.test(d) || d !== d.toLowerCase()) {
        errors.push(`${at}: ${key} entry "${d}" must be a lowercase hostname (no scheme, path or wildcard)`);
      }
    }
  }
  if (!c.urlFilter && !c.regexFilter && !c.requestDomains
      && !c.excludedRequestDomains && !c.initiatorDomains) {
    warnings.push(`${at}: matches every URL — intended only for the GPC header rule`);
  }

  // ── safety ────────────────────────────────────────────────────────────
  if (action?.type === 'block') {
    if (c.resourceTypes?.includes('main_frame')) {
      errors.push(`${at}: block rule opts into main_frame — this breaks direct navigation`);
    }
    const hosts = [...(c.requestDomains ?? [])];
    const fromFilter = c.urlFilter ? hostFromUrlFilter(c.urlFilter) : null;
    if (fromFilter) hosts.push(fromFilter);
    for (const h of hosts) {
      if (isNeverBlock(h)) errors.push(`${at}: blocks NEVER_BLOCK domain "${h}"`);
      else if (isCookieBlockOnly(h)) warnings.push(`${at}: blocks COOKIE_BLOCK_ONLY domain "${h}" — should be cookie-stripped, not blocked`);
    }
  }
}

// ── run ──────────────────────────────────────────────────────────────────
const counts = {};
for (const file of Object.keys(RANGES)) {
  const full = path.join(HERE, file);
  if (!fs.existsSync(full)) { errors.push(`${file}: missing`); continue; }
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(full, 'utf8'));
  } catch (e) {
    errors.push(`${file}: invalid JSON — ${e.message}`);
    continue;
  }
  if (!Array.isArray(parsed)) { errors.push(`${file}: top level must be an array`); continue; }
  counts[file] = parsed.length;
  parsed.forEach((rule, i) => checkRule(file, rule, i));
}

// ── ranges must not overlap each other ───────────────────────────────────
const ordered = Object.entries(RANGES).sort((a, b) => a[1][0] - b[1][0]);
for (let i = 1; i < ordered.length; i++) {
  if (ordered[i][1][0] <= ordered[i - 1][1][1]) {
    errors.push(`range overlap: ${ordered[i - 1][0]} and ${ordered[i][0]}`);
  }
}

// ── the counter's view of these rules must match reality ─────────────────
//
// `onRuleMatchedDebug` and `getMatchedRules()` report every rule that acted on a
// request and never say what the action was, so background.js decides "was this
// a block?" from the id alone (src/protocol.js `classifyMatchedRule`). Adding an
// `allow` exception or a header rule without telling that table turns it into an
// over-count on a number the UI presents as literally true.
{
  const actualNonBlocking = new Set();
  for (const file of Object.keys(RANGES)) {
    const full = path.join(HERE, file);
    if (!fs.existsSync(full)) continue;
    let parsed;
    try { parsed = JSON.parse(fs.readFileSync(full, 'utf8')); } catch { continue; }
    if (!Array.isArray(parsed)) continue;
    for (const rule of parsed) {
      if (rule?.action?.type !== 'block' && Number.isInteger(rule?.id)) {
        actualNonBlocking.add(rule.id);
      }
    }
  }
  for (const id of actualNonBlocking) {
    if (!NON_BLOCKING_STATIC_RULE_IDS.has(id)) {
      errors.push(`rule ${id} does not block, but src/protocol.js NON_BLOCKING_STATIC_RULE_IDS omits it — the popup would count its matches as blocked requests`);
    }
  }
  for (const id of NON_BLOCKING_STATIC_RULE_IDS) {
    if (!actualNonBlocking.has(id)) {
      errors.push(`src/protocol.js NON_BLOCKING_STATIC_RULE_IDS lists ${id}, but no such non-block static rule ships — the popup would under-count`);
    }
  }

  // Every blocking ruleset must be a ruleset that exists, and `gpc` must not be
  // one: its only rule sets a header on nearly every request.
  for (const id of BLOCKING_RULESET_IDS) {
    if (!(`${id}.json` in RANGES)) {
      errors.push(`src/protocol.js BLOCKING_RULESET_IDS names "${id}", which is not a ruleset`);
    }
  }
  if (BLOCKING_RULESET_IDS.includes('gpc')) {
    errors.push('src/protocol.js BLOCKING_RULESET_IDS must not include "gpc" — rule 5000 matches nearly every request');
  }

  for (const [name, range] of Object.entries(DYNAMIC_RANGES)) {
    const key = DYNAMIC_RANGE_KEYS[name];
    const theirs = DYNAMIC_RULE_RANGES[key];
    if (!theirs) {
      errors.push(`src/protocol.js DYNAMIC_RULE_RANGES has no entry for "${name}"`);
    } else if (theirs[0] !== range[0] || theirs[1] !== range[1]) {
      errors.push(`reserved range drift for "${name}": validate.mjs says ${range[0]}-${range[1]}, src/protocol.js says ${theirs[0]}-${theirs[1]}`);
    }
  }
  for (const key of Object.keys(DYNAMIC_RULE_RANGES)) {
    if (!Object.values(DYNAMIC_RANGE_KEYS).includes(key)) {
      errors.push(`src/protocol.js DYNAMIC_RULE_RANGES has an extra range "${key}" that validate.mjs does not reserve`);
    }
  }
}

// ── manifest agreement ───────────────────────────────────────────────────
// Both manifests are checked. The Chrome and Firefox builds ship the same
// rulesets and the same GPC exception list; a fix applied to one and not the
// other is the kind of divergence nobody notices until a user reports it.
const MANIFESTS = ['manifest.json', 'manifest.firefox.json'];
for (const manifestName of MANIFESTS) checkManifest(manifestName);

function checkManifest(manifestName) {
const manifestPath = path.join(EXT, manifestName);
if (fs.existsSync(manifestPath)) {
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const declared = manifest.declarative_net_request?.rule_resources ?? [];
    const declaredFiles = new Set(declared.map((r) => path.basename(r.path)));
    for (const file of Object.keys(RANGES)) {
      if (!declaredFiles.has(file)) errors.push(`${manifestName} does not register ${file}`);
    }
    for (const r of declared) {
      const p = path.join(EXT, r.path);
      if (!fs.existsSync(p)) errors.push(`${manifestName} points at missing ruleset "${r.path}"`);
    }
    const ids = declared.map((r) => r.id);
    if (new Set(ids).size !== ids.length) errors.push(`${manifestName} has duplicate ruleset ids`);

    // ── GPC's two exception lists must agree ──────────────────────────────
    // The header is suppressed by rule 5000's excludedRequestDomains; the JS
    // property is suppressed by excluding the gpc.js content script from the
    // same hosts. If they drift, a site gets one half of the signal — which is
    // the exact state that breaks USAA and friends, and it would be invisible.
    const gpcPath = path.join(HERE, 'gpc.json');
    if (fs.existsSync(gpcPath)) {
      const headerRule = JSON.parse(fs.readFileSync(gpcPath, 'utf8'))
        .find((r) => r.id === 5000);
      const headerExcluded = new Set(headerRule?.condition?.excludedRequestDomains ?? []);
      const initiatorExcluded = new Set(headerRule?.condition?.excludedInitiatorDomains ?? []);

      for (const d of headerExcluded) {
        if (!initiatorExcluded.has(d)) {
          errors.push(`gpc.json rule 5000: "${d}" excluded as a request domain but not as an initiator domain`);
        }
      }

      const script = (manifest.content_scripts ?? [])
        .find((cs) => (cs.js ?? []).includes('src/gpc.js'));
      if (!script) {
        errors.push(`${manifestName} does not declare src/gpc.js as a content script`);
      } else {
        if (script.world !== 'MAIN') errors.push(`${manifestName}: src/gpc.js must run in the MAIN world`);
        if (script.run_at !== 'document_start') {
          errors.push(`${manifestName}: src/gpc.js must run at document_start or pages read GPC before it is set`);
        }
        const scriptExcluded = new Set(
          (script.exclude_matches ?? [])
            .map((p) => /^\*:\/\/\*\.([a-z0-9.-]+)\/\*$/.exec(p)?.[1])
            .filter(Boolean),
        );
        for (const d of headerExcluded) {
          if (!scriptExcluded.has(d)) {
            errors.push(`GPC drift in ${manifestName}: "${d}" suppresses the header but not navigator.globalPrivacyControl (add *://*.${d}/* to src/gpc.js exclude_matches)`);
          }
        }
        for (const d of scriptExcluded) {
          if (!headerExcluded.has(d)) {
            errors.push(`GPC drift in ${manifestName}: "${d}" suppresses navigator.globalPrivacyControl but not the Sec-GPC header (add it to gpc.json rule 5000)`);
          }
        }
      }
    }
  } catch (e) {
    errors.push(`${manifestName}: ${e.message}`);
  }
} else {
  warnings.push(`${manifestName} not found — skipping its registration check`);
}
}

// ── report ───────────────────────────────────────────────────────────────
const total = Object.values(counts).reduce((a, b) => a + b, 0);
console.log('Nullecho ruleset validation\n');
for (const [file, [lo, hi]] of Object.entries(RANGES)) {
  const ids = [...seenIds.entries()].filter(([, at]) => at.startsWith(file)).map(([id]) => id);
  const used = ids.length ? `${Math.min(...ids)}-${Math.max(...ids)}` : '(none)';
  console.log(`  ${file.padEnd(22)} ${String(counts[file] ?? 0).padStart(4)} rules   ids ${used.padEnd(13)} range ${lo}-${hi}`);
}
console.log(`  ${'TOTAL'.padEnd(22)} ${String(total).padStart(4)} rules   ${seenIds.size} unique ids`);
console.log(`\n  allowlist: ${NEVER_BLOCK.length} never-block, ${COOKIE_BLOCK_ONLY.length} cookie-block-only`);

if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  for (const w of warnings) console.log(`  ! ${w}`);
}
if (errors.length) {
  console.log(`\n${errors.length} ERROR(S):`);
  for (const e of errors) console.log(`  x ${e}`);
  process.exit(1);
}
console.log('\nOK — all rulesets valid, all ids unique.');
