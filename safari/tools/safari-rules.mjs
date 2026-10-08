#!/usr/bin/env node
/**
 * Nullecho for Safari — ruleset generator. Imported by safari/tools/build-extension.mjs.
 *
 *   node safari/tools/safari-rules.mjs      # print what would be generated; writes nothing
 *
 * Safari does not run `declarativeNetRequest` natively: WebKit translates every rule into a
 * content-blocker rule (safari/audit/01-api-support.md §4.2, WebKit
 * `_WKWebExtensionDeclarativeNetRequestRule.mm`). The Chrome rulesets in `ext/rules/` are the
 * source of truth and are not touched; this module derives the Safari rulesets from them at build
 * time. Three things differ, each for a measured reason:
 *
 *  1. TIER B SHIPS AS ITS OWN RULESET, DISABLED. In Chrome, `fingerprinting.json`'s anti-fraud
 *     tier (ids 4500–4699: ThreatMetrix, Iovation, Sift, Forter, Signifyd, SEON, Ravelin,
 *     Riskified) is enabled in the file and switched off at install by `background.js` with
 *     `updateStaticRules({disableRuleIds})`. Safari has no `updateStaticRules` — calling it
 *     throws (audit 01 §3) — so the file copied as-is would block bank sign-in and checkout
 *     for every Safari user by default. The tier is split into `fingerprinting-strict`,
 *     registered `"enabled": false`; tier A and the tier C allow rule (4700) stay in
 *     `fingerprinting`.
 *
 *  2. BARE `requestDomains` BECOME `||domain^` URL FILTERS, ONE RULE PER DOMAIN. WebKit compiles
 *     `requestDomains: [d]` with no `urlFilter` to the url-filter `||d`, which becomes the regex
 *     `^[^:]+://+([^:/]+\.)?d` (dots escaped) with NO boundary after the host
 *     (`_combineRequestDomain:withURLFilter:` → `_regexURLFilterForChromeURLFilter:`). A rule for
 *     `t.co` therefore also matches `t.com` and `t.co.anything`, which Chrome's domain match never
 *     does. Measured 2026-10-02, Safari on the iOS 27.0 Simulator, server log as ground truth
 *     (a request absent from the log is blocked), each probe beside a control:
 *       requestDomains ["sfx.lvh.m"]     → `sfx.lvh.me`                 BLOCKED   (suffix over-match)
 *       requestDomains ["dot.x.lvh.me"]  → `dot.x.lvh.me.evil.lvh.me`   BLOCKED   (the `t.co.evil` shape)
 *                                        → `dot.x.lvh.me`, `sub.dot.x.lvh.me`  blocked (true matches)
 *                                        → `dotzx.lvh.me`               reached   (dots ARE escaped; the
 *                                                                        audit's "unescaped dot" was wrong)
 *                                        → `zdot.x.lvh.me`              reached   (control)
 *       urlFilter "||sfx2.lvh.m^"        → `sfx2.lvh.me`                reached   (fixed)
 *       urlFilter "||dot2.x.lvh.me^"     → `dot2.x.lvh.me.evil.lvh.me`  reached   (fixed)
 *                                        → `dot2.x.lvh.me`, `sub.dot2.x.lvh.me`  blocked (still match,
 *                                                                        with a `:port` after the host)
 *     `||d^` goes through the same translation with the separator class `[^a-zA-Z0-9_.%-]`
 *     appended — exactly the missing boundary — and subdomains still match through the same
 *     optional `([^:/]+\.)?` prefix. `urlFilter` is one pattern, so a rule listing several
 *     domains becomes several rules. Rules that already use a `urlFilter` (the path-scoped
 *     social rules) are copied as they are.
 *
 *  3. `gpc.json` IS COPIED BYTE FOR BYTE, and its rule 5000 is the ONLY rule allowed to carry
 *     `excludedRequestDomains`. WebKit turns each exclusion into an `ignore-following-rules`
 *     rule that also exempts the host from every rule sorted AFTER it (audit 01 §4.5). Rule 5000
 *     sorts last (priority 1, modifyHeaders), so its 50 exclusions bleed into nothing; an
 *     exclusion on a block rule would silently punch a GPC hole for that host. The generator
 *     refuses one.
 *
 * Rule ids. The first domain of each source rule keeps the Chrome id, so the ids in
 * ext/rules/README.md still name the same trackers here. Extra domains get ids from the TOP of
 * the owning block downward (1999, 1998, … for ads; 4499, 4498, … for tier A; 4799, … for the
 * tier C allow rule). Safari has no per-id API this build uses — no `updateStaticRules`, and
 * `getMatchedRules()` returns no rule ids (audit 01 §4.9) — so an extra id only needs to be
 * unique and inside its block. `safari/test/rules.test.mjs` checks that, and that every domain
 * the Chrome lists block is blocked here with the same action, priority, domainType and
 * resourceTypes, and nothing more.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const EXT_RULES_DIR = path.resolve(HERE, '../../ext/rules');

/** `fingerprinting.json` tier B: anti-fraud device ID (ext/rules/README.md). */
export const TIER_B = [4500, 4699];
export const inTierB = (id) => Number.isInteger(id) && id >= TIER_B[0] && id <= TIER_B[1];

/** The one rule that may carry `excludedRequestDomains` — see point 3 above. */
export const GPC_HEADER_RULE_ID = 5000;

/**
 * Id blocks per source file (ext/rules/README.md "Rule ID ranges"). Extra ids for split rules
 * are allocated from the top of the block that owns the source rule's id.
 */
export const ID_BLOCKS = {
  'ads.json': [[1000, 1999]],
  'analytics.json': [[2000, 2999]],
  'social.json': [[3000, 3999]],
  'fingerprinting.json': [[4000, 4499], TIER_B, [4700, 4799]],
  'gpc.json': [[5000, 5099]],
};

/**
 * The Safari rulesets, in manifest order. `select` picks which source rules a ruleset carries
 * (the fingerprinting file is split in two); `verbatim` copies the source bytes untouched.
 */
export const SAFARI_RULESETS = [
  { id: 'ads', path: 'rules/ads.json', source: 'ads.json', enabled: true },
  { id: 'analytics', path: 'rules/analytics.json', source: 'analytics.json', enabled: true },
  { id: 'social', path: 'rules/social.json', source: 'social.json', enabled: true },
  { id: 'fingerprinting', path: 'rules/fingerprinting.json', source: 'fingerprinting.json', enabled: true, select: (r) => !inTierB(r.id) },
  { id: 'fingerprinting-strict', path: 'rules/fingerprinting-strict.json', source: 'fingerprinting.json', enabled: false, select: (r) => inTierB(r.id) },
  { id: 'gpc', path: 'rules/gpc.json', source: 'gpc.json', enabled: true, verbatim: true },
];

/** Lowercase hostname: labels of [a-z0-9-], dot-separated, no leading/trailing hyphen or dot. */
const HOSTNAME = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*$/;

const clone = (v) => JSON.parse(JSON.stringify(v));

/**
 * Convert one source file's rules for Safari.
 *
 * @param {string} sourceFile   basename in ext/rules, e.g. 'ads.json' (picks the id blocks)
 * @param {object[]} rules      the parsed source array
 * @param {{select?: (rule) => boolean}} [opts]
 * @returns {object[]}          Safari rules, source order preserved, split domains adjacent
 */
export function convertRules(sourceFile, rules, { select = () => true } = {}) {
  const blocks = ID_BLOCKS[sourceFile];
  if (!blocks) throw new Error(`${sourceFile}: no id blocks declared for this file`);
  if (!Array.isArray(rules)) throw new Error(`${sourceFile}: top level must be an array`);

  // Every SOURCE id is reserved up front — including the ones `select` leaves to the other half
  // of a split file — so an extra id can never collide with a rule that ships in a sibling ruleset.
  const taken = new Set(rules.map((r) => r?.id));
  const cursor = blocks.map(([, hi]) => hi);

  function allocate(ownerId) {
    const b = blocks.findIndex(([lo, hi]) => ownerId >= lo && ownerId <= hi);
    if (b < 0) throw new Error(`${sourceFile}: rule ${ownerId} is outside every id block this file owns`);
    while (taken.has(cursor[b])) cursor[b]--;
    const id = cursor[b];
    if (id < blocks[b][0] || id <= ownerId) {
      throw new Error(`${sourceFile}: id block ${blocks[b][0]}-${blocks[b][1]} has no room for another split of rule ${ownerId}`);
    }
    taken.add(id);
    cursor[b]--;
    return id;
  }

  const out = [];
  for (const rule of rules) {
    if (!rule || typeof rule !== 'object' || !Number.isInteger(rule.id)) {
      throw new Error(`${sourceFile}: malformed rule ${JSON.stringify(rule)}`);
    }
    if (!select(rule)) continue;
    const c = rule.condition;
    if (!c || typeof c !== 'object') throw new Error(`${sourceFile}: rule ${rule.id} has no condition`);

    if (c.excludedRequestDomains && rule.id !== GPC_HEADER_RULE_ID) {
      throw new Error(
        `${sourceFile}: rule ${rule.id} carries excludedRequestDomains — in Safari that exempts the host ` +
        `from every rule sorted after it, including the GPC header rule (audit 01 §4.5)`,
      );
    }

    if (!c.requestDomains) {
      out.push(clone(rule));
      continue;
    }
    if (c.urlFilter || c.regexFilter) {
      throw new Error(
        `${sourceFile}: rule ${rule.id} combines requestDomains with a urlFilter/regexFilter — WebKit merges ` +
        `those heuristically (_combineRequestDomain:withURLFilter:); express it as a single urlFilter in ext/rules first`,
      );
    }
    if (!Array.isArray(c.requestDomains) || c.requestDomains.length === 0) {
      throw new Error(`${sourceFile}: rule ${rule.id} has an empty requestDomains`);
    }

    const { requestDomains, ...rest } = c;
    requestDomains.forEach((domain, i) => {
      if (typeof domain !== 'string' || !HOSTNAME.test(domain)) {
        throw new Error(`${sourceFile}: rule ${rule.id} requestDomains entry ${JSON.stringify(domain)} is not a lowercase hostname`);
      }
      out.push({
        id: i === 0 ? rule.id : allocate(rule.id),
        priority: rule.priority,
        action: clone(rule.action),
        // `||domain^`: domain anchor, then WebKit's separator class — the boundary `||domain` lacks.
        condition: { urlFilter: `||${domain}^`, ...clone(rest) },
      });
    });
  }
  return out;
}

/** Same shape as the hand-edited files in ext/rules (two-space JSON, trailing newline). */
export const serialise = (rules) => JSON.stringify(rules, null, 2) + '\n';

/**
 * Build every Safari ruleset from the ext/rules directory.
 *
 * @param {string} [extRulesDir]
 * @returns {Array<{id, path, source, enabled, rules: object[], text: string}>}
 */
export function buildSafariRulesets(extRulesDir = EXT_RULES_DIR) {
  return SAFARI_RULESETS.map((rs) => {
    const file = path.join(extRulesDir, rs.source);
    if (!fs.existsSync(file)) throw new Error(`${rs.source}: missing from ${extRulesDir}`);
    const text = fs.readFileSync(file, 'utf8');
    let parsed;
    try { parsed = JSON.parse(text); } catch (e) { throw new Error(`${rs.source}: invalid JSON — ${e.message}`); }
    if (rs.verbatim) {
      if (!Array.isArray(parsed)) throw new Error(`${rs.source}: top level must be an array`);
      for (const rule of parsed) {
        if (rule?.condition?.excludedRequestDomains && rule.id !== GPC_HEADER_RULE_ID) {
          throw new Error(`${rs.source}: rule ${rule.id} carries excludedRequestDomains (only ${GPC_HEADER_RULE_ID} may)`);
        }
      }
      return { ...rs, rules: parsed, text };
    }
    const rules = convertRules(rs.source, parsed, { select: rs.select });
    return { ...rs, rules, text: serialise(rules) };
  });
}

// ── CLI: summary only ──────────────────────────────────────────────────────────
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const rs of buildSafariRulesets()) {
    const ids = rs.rules.map((r) => r.id);
    const split = rs.rules.filter((r) => r.condition.urlFilter && /^\|\|[a-z0-9.-]+\^$/.test(r.condition.urlFilter)).length;
    console.log(
      `${rs.path.padEnd(34)} ${String(rs.rules.length).padStart(4)} rules  ids ${Math.min(...ids)}-${Math.max(...ids)}` +
      `  ${rs.enabled ? 'enabled ' : 'DISABLED'}  ${rs.verbatim ? 'verbatim copy of ext/rules/' + rs.source : split + ' domain filters'}`,
    );
  }
}
