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
 *  4. SAFARI-ONLY EXCLUSIONS. `safari/extension/rules-exclude.json` names Chrome source rules the Safari
 *     build leaves out (licence hygiene: a rule whose only published source is a list Nullecho may not
 *     redistribute here, H-LICENSE-REVIEW §7.2). `domains` drops that exact host wherever it appears — a
 *     `requestDomains` entry (its siblings in the same rule survive) or a `||host^` urlFilter; `urlFilters`
 *     drops the source rule with exactly that urlFilter; `ids` drops a whole source rule, every domain of
 *     it. Exact matches only, no subdomain logic: list each host you mean. Only block rules may be excluded
 *     (an allow rule or the GPC header rule cannot go missing by accident), every entry must match something
 *     (a stale entry fails the build, so a typo cannot keep shipping a rule), and ext/rules is never edited
 *     from here. The generator numbers every domain FIRST and drops the excluded ones AFTERWARDS, so the
 *     surviving rules keep the ids they would have had without the list. `safari/test/rules.test.mjs` proves
 *     an excluded entry is absent from the output and that the mechanism works on a non-empty list.
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

// ── Safari-only exclusions (point 4 above) ─────────────────────────────────────

export const EXCLUDE_FILE = path.resolve(HERE, '../extension/rules-exclude.json');
const EXCLUDE_KEYS = ['about', 'domains', 'urlFilters', 'ids', 'notes'];

/**
 * Validate a parsed rules-exclude.json and turn it into sets. One object per build: `used` collects the
 * entries that matched, and `staleExclusions()` reports the rest.
 *
 * @returns {{label: string, domains: Set<string>, urlFilters: Set<string>, ids: Set<number>, notes: object, used: Set<string>, size: number}}
 */
export function normaliseExclusions(raw, label = 'rules-exclude.json') {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`${label}: top level must be an object`);
  for (const k of Object.keys(raw)) if (!EXCLUDE_KEYS.includes(k)) throw new Error(`${label}: unknown key "${k}" (allowed: ${EXCLUDE_KEYS.join(', ')})`);
  if (raw.about !== undefined && typeof raw.about !== 'string') throw new Error(`${label}: "about" must be a string`);
  const list = (key, ok, what) => {
    const v = raw[key] ?? [];
    if (!Array.isArray(v)) throw new Error(`${label}: "${key}" must be an array`);
    const seen = new Set();
    for (const e of v) {
      if (!ok(e)) throw new Error(`${label}: "${key}" entry ${JSON.stringify(e)} is not ${what}`);
      if (seen.has(e)) throw new Error(`${label}: "${key}" lists ${JSON.stringify(e)} twice`);
      seen.add(e);
    }
    return seen;
  };
  const domains = list('domains', (d) => typeof d === 'string' && HOSTNAME.test(d), 'a lowercase hostname');
  const urlFilters = list('urlFilters', (f) => typeof f === 'string' && f.length > 0 && !/\s/.test(f), 'a urlFilter string');
  const ids = list('ids', (id) => Number.isInteger(id) && id > 0, 'a positive integer rule id');
  const [gpcLo, gpcHi] = ID_BLOCKS['gpc.json'][0];
  for (const id of ids) if (id >= gpcLo && id <= gpcHi) throw new Error(`${label}: id ${id} is in gpc.json, which is copied verbatim and cannot be excluded`);
  const notes = raw.notes ?? {};
  if (!notes || typeof notes !== 'object' || Array.isArray(notes)) throw new Error(`${label}: "notes" must be an object keyed by entry`);
  const keys = new Set([...domains, ...urlFilters, ...[...ids].map(String)]);
  for (const [k, v] of Object.entries(notes)) {
    if (!keys.has(k)) throw new Error(`${label}: note for "${k}", which is not an entry`);
    if (typeof v !== 'string' || !v.trim()) throw new Error(`${label}: note for "${k}" must be a non-empty string`);
  }
  return { label, domains, urlFilters, ids, notes, used: new Set(), size: domains.size + urlFilters.size + ids.size };
}

/** A fresh, empty exclusion object (the default when a caller passes none). */
export const noExclusions = () => normaliseExclusions({}, 'no exclusions');

/** Read and validate the exclusion list. The file must exist: an empty list is fine, a missing one is not. */
export function loadExclusions(file = EXCLUDE_FILE) {
  if (!fs.existsSync(file)) throw new Error(`${file}: missing — the Safari build needs its exclusion list (an empty one is fine)`);
  let raw;
  try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { throw new Error(`${file}: invalid JSON — ${e.message}`); }
  return normaliseExclusions(raw, path.relative(path.resolve(HERE, '../..'), file));
}

/** Entries that matched no source rule: a typo, or a rule that has since left ext/rules. */
export function staleExclusions(exclude) {
  const all = [...exclude.domains].map((d) => `domain ${d}`)
    .concat([...exclude.urlFilters].map((f) => `urlFilter ${f}`), [...exclude.ids].map((id) => `id ${id}`));
  return all.filter((k) => !exclude.used.has(k));
}

const domainOfFilter = (f) => /^\|\|([a-z0-9.-]+)\^$/.exec(f ?? '')?.[1] ?? null;

/** Why a whole source rule is excluded — by id, by exact urlFilter, or a `||host^` filter naming an excluded host — or null. */
function wholeRuleExclusion(rule, exclude) {
  if (exclude.ids.has(rule.id)) return `id ${rule.id}`;
  const f = rule.condition?.urlFilter;
  if (f && exclude.urlFilters.has(f)) return `urlFilter ${f}`;
  const d = domainOfFilter(f);
  if (d && exclude.domains.has(d)) return `domain ${d}`;
  return null;
}

function markExcluded(sourceFile, rule, key, exclude) {
  if (rule.action?.type !== 'block') {
    throw new Error(`${sourceFile}: exclusion "${key}" names rule ${rule.id}, whose action is ${rule.action?.type ?? 'missing'} — only block rules may be excluded`);
  }
  exclude.used.add(key);
}

/**
 * The source rules with the exclusions applied and NO Safari conversion: what the Chrome list would be if
 * it too dropped these entries. The tests compare the Safari output against this.
 */
export function excludeFromSource(sourceFile, rules, exclude) {
  const out = [];
  for (const rule of rules) {
    const whole = wholeRuleExclusion(rule, exclude);
    if (whole) { markExcluded(sourceFile, rule, whole, exclude); continue; }
    const rd = rule.condition?.requestDomains;
    if (!Array.isArray(rd)) { out.push(rule); continue; }
    const keep = [];
    for (const d of rd) {
      if (exclude.domains.has(d)) markExcluded(sourceFile, rule, `domain ${d}`, exclude);
      else keep.push(d);
    }
    if (keep.length === 0) continue;
    out.push(keep.length === rd.length ? rule : { ...rule, condition: { ...rule.condition, requestDomains: keep } });
  }
  return out;
}

/**
 * Convert one source file's rules for Safari.
 *
 * @param {string} sourceFile   basename in ext/rules, e.g. 'ads.json' (picks the id blocks)
 * @param {object[]} rules      the parsed source array
 * @param {{select?: (rule) => boolean, exclude?: object}} [opts]  `exclude` from normaliseExclusions/loadExclusions
 * @returns {object[]}          Safari rules, source order preserved, split domains adjacent
 */
export function convertRules(sourceFile, rules, { select = () => true, exclude = noExclusions() } = {}) {
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

    const whole = wholeRuleExclusion(rule, exclude);
    if (!c.requestDomains) {
      if (whole) { markExcluded(sourceFile, rule, whole, exclude); continue; }
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
      // Number first, drop second: an exclusion never renumbers the rules around it.
      const id = i === 0 ? rule.id : allocate(rule.id);
      const key = whole ?? (exclude.domains.has(domain) ? `domain ${domain}` : null);
      if (key) { markExcluded(sourceFile, rule, key, exclude); return; }
      out.push({
        id,
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
 * @param {{exclude?: object}} [opts]  a fresh exclusion object (loadExclusions / normaliseExclusions); its
 *                                     entries must all match a block rule, or this throws
 * @returns {Array<{id, path, source, enabled, rules: object[], text: string}>}
 */
export function buildSafariRulesets(extRulesDir = EXT_RULES_DIR, { exclude = noExclusions() } = {}) {
  const built = SAFARI_RULESETS.map((rs) => {
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
    const rules = convertRules(rs.source, parsed, { select: rs.select, exclude });
    return { ...rs, rules, text: serialise(rules) };
  });
  const stale = staleExclusions(exclude);
  if (stale.length) {
    throw new Error(`${exclude.label}: ${stale.length} exclusion(s) matched no block rule in ${extRulesDir}: ${stale.join(', ')}`);
  }
  return built;
}

// ── CLI: summary only ──────────────────────────────────────────────────────────
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const exclude = loadExclusions();
  for (const rs of buildSafariRulesets(EXT_RULES_DIR, { exclude })) {
    const ids = rs.rules.map((r) => r.id);
    const split = rs.rules.filter((r) => r.condition.urlFilter && /^\|\|[a-z0-9.-]+\^$/.test(r.condition.urlFilter)).length;
    console.log(
      `${rs.path.padEnd(34)} ${String(rs.rules.length).padStart(4)} rules  ids ${Math.min(...ids)}-${Math.max(...ids)}` +
      `  ${rs.enabled ? 'enabled ' : 'DISABLED'}  ${rs.verbatim ? 'verbatim copy of ext/rules/' + rs.source : split + ' domain filters'}`,
    );
  }
  console.log(`${exclude.label}: ${exclude.size} Safari-only exclusion(s)${exclude.size ? ' — ' + [...exclude.used].sort().join(', ') : ''}`);
}
