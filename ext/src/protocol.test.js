/**
 * Nullecho — matched-rule classification tests
 * ─────────────────────────────────────────
 * `onRuleMatchedDebug` and `getMatchedRules` report EVERY rule that acted on a
 * request — blocks, `allow` exceptions and `modifyHeaders` alike — and neither
 * reports the action type. So "was this request blocked?" is a question only
 * the rule id can answer, and getting it wrong is not a cosmetic bug:
 *
 *   - `gpc.json` rule 5000 sets Sec-GPC on nearly every request. Counting its
 *     matches reports the page's entire request log as "requests blocked", and
 *     fills "Blocked domains" with every domain the page contacted — including
 *     the first party itself, since the rule matches main_frame.
 *   - The allowlist writes `allowAllRequests` rules. Matching one means Nullecho
 *     deliberately did NOT block; counting it inverts the number, and does so
 *     precisely on the sites the user switched Nullecho off for.
 *   - The heuristic yellowlist strips Cookie / Set-Cookie and lets the request
 *     through. That is a real outcome, but it is not a blocked request, and
 *     docs/THREAT-MODEL.md's copy rules do not allow it to be counted as one.
 *
 * `protocol.js` is pure constants, so this needs no `chrome` stub.
 *
 * Run: `node --test` from `ext/`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  classifyMatchedRule,
  OUTCOME,
  CATEGORY_LABELS,
  DYNAMIC_RULE_RANGES,
  NON_BLOCKING_STATIC_RULE_IDS,
  BLOCKING_RULESET_IDS,
  ALLOW_RULE_ID_BASE,
  CONTENT_SCRIPT_LITERALS,
  CONTENT_SCRIPT_NUMERIC_LITERALS,
  FORBIDDEN_LITERALS,
} from './protocol.js';

const EXT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readRules = (name) =>
  JSON.parse(fs.readFileSync(path.join(EXT, 'rules', `${name}.json`), 'utf8'));

/** Chrome's synthetic ruleset id for runtime rules. */
const DYNAMIC = '_dynamic';

// ── static rulesets ────────────────────────────────────────────────────────

test('block rules in the category rulesets count as blocked, under their own category', () => {
  for (const ruleset of BLOCKING_RULESET_IDS) {
    for (const rule of readRules(ruleset)) {
      if (rule.action.type !== 'block') continue;
      assert.deepEqual(
        classifyMatchedRule({ ruleId: rule.id, rulesetId: ruleset }),
        { outcome: OUTCOME.BLOCKED, category: ruleset },
        `${ruleset} rule ${rule.id}`,
      );
    }
  }
});

test('the GPC header rule is never counted — it matches nearly every request', () => {
  const { outcome } = classifyMatchedRule({ ruleId: 5000, rulesetId: 'gpc' });
  assert.equal(outcome, OUTCOME.IGNORED);
});

test('the anti-fraud `allow` exception is not counted as a block', () => {
  // fingerprinting.json 4700 lets ThreatMetrix & friends through on bank and
  // checkout origins. It is the opposite of a block.
  const { outcome } = classifyMatchedRule({ ruleId: 4700, rulesetId: 'fingerprinting' });
  assert.equal(outcome, OUTCOME.IGNORED);
});

test('every non-block static rule is declared in NON_BLOCKING_STATIC_RULE_IDS', () => {
  const actual = new Set();
  for (const name of [...BLOCKING_RULESET_IDS, 'gpc']) {
    for (const rule of readRules(name)) {
      if (rule.action.type !== 'block') actual.add(rule.id);
    }
  }
  assert.deepEqual(
    [...NON_BLOCKING_STATIC_RULE_IDS].sort((a, b) => a - b),
    [...actual].sort((a, b) => a - b),
  );
});

test('`gpc` is not a blocking ruleset', () => {
  assert.ok(!BLOCKING_RULESET_IDS.includes('gpc'));
});

// ── dynamic rules ──────────────────────────────────────────────────────────
//
// Chrome reports all of these under one synthetic ruleset id, so only the id
// range distinguishes the layer that wrote them.

test('heuristic block rules count as blocked, under the "heuristic" category', () => {
  const [lo, hi] = DYNAMIC_RULE_RANGES.heuristicBlock;
  for (const id of [lo, lo + 1, Math.floor((lo + hi) / 2), hi]) {
    assert.deepEqual(
      classifyMatchedRule({ ruleId: id, rulesetId: DYNAMIC }),
      { outcome: OUTCOME.BLOCKED, category: 'heuristic' },
      `id ${id}`,
    );
  }
});

test('heuristic cookie-block rules are stripped, not blocked', () => {
  const [lo, hi] = DYNAMIC_RULE_RANGES.heuristicCookie;
  for (const id of [lo, hi]) {
    assert.deepEqual(
      classifyMatchedRule({ ruleId: id, rulesetId: DYNAMIC }),
      { outcome: OUTCOME.STRIPPED, category: 'heuristic-cookie' },
      `id ${id}`,
    );
  }
});

test('allowlist rules are never counted — matching one means Nullecho did not block', () => {
  for (const id of [ALLOW_RULE_ID_BASE, ALLOW_RULE_ID_BASE + 999]) {
    assert.equal(
      classifyMatchedRule({ ruleId: id, rulesetId: DYNAMIC }).outcome,
      OUTCOME.IGNORED,
      `id ${id}`,
    );
  }
});

test('GPC per-site exception rules are never counted', () => {
  const [lo, hi] = DYNAMIC_RULE_RANGES.gpcException;
  for (const id of [lo, hi]) {
    assert.equal(classifyMatchedRule({ ruleId: id, rulesetId: DYNAMIC }).outcome, OUTCOME.IGNORED);
  }
});

test('the dynamic ranges do not overlap', () => {
  const ordered = Object.entries(DYNAMIC_RULE_RANGES).sort((a, b) => a[1][0] - b[1][0]);
  for (let i = 1; i < ordered.length; i++) {
    assert.ok(
      ordered[i - 1][1][1] < ordered[i][1][0],
      `${ordered[i - 1][0]} overlaps ${ordered[i][0]}`,
    );
  }
});

// ── everything else ────────────────────────────────────────────────────────

test('unrecognised rules are ignored rather than guessed at', () => {
  const cases = [
    undefined,
    null,
    {},
    { ruleId: 7, rulesetId: '_session' },       // session rules: nothing writes these
    { ruleId: 2_000_000, rulesetId: DYNAMIC },  // outside every reserved range
    { ruleId: 1500, rulesetId: 'not-a-ruleset' },
    { rulesetId: DYNAMIC },                     // no id: unattributable
  ];
  for (const rule of cases) {
    assert.deepEqual(
      classifyMatchedRule(rule),
      { outcome: OUTCOME.IGNORED, category: null },
      JSON.stringify(rule),
    );
  }
});

// ── labels ─────────────────────────────────────────────────────────────────

test('every category a match can produce has a human label', () => {
  const ids = [
    ...BLOCKING_RULESET_IDS.flatMap((r) => readRules(r).map((x) => ({ ruleId: x.id, rulesetId: r }))),
    { ruleId: DYNAMIC_RULE_RANGES.heuristicBlock[0], rulesetId: DYNAMIC },
    { ruleId: DYNAMIC_RULE_RANGES.heuristicCookie[0], rulesetId: DYNAMIC },
  ];
  for (const rule of ids) {
    const { category } = classifyMatchedRule(rule);
    if (category === null) continue;
    assert.ok(
      CATEGORY_LABELS[category],
      `category "${category}" would render as a raw string in the popup`,
    );
  }
});

test('no label is the raw ruleset id Chrome hands us', () => {
  assert.ok(!('_dynamic' in CATEGORY_LABELS));
  assert.ok(!('_session' in CATEGORY_LABELS));
});

// ═══════════════════════════════════════════════════════════════════════════
// content-script literal drift
// ═══════════════════════════════════════════════════════════════════════════
//
// MV3 forbids ES modules in content scripts, so `shim-loader.js`, `shim.js` and
// `gpc.js` re-declare these strings as their own consts. Until now the only thing
// holding the two sides together was a comment saying "keep them in sync" — which
// is a hope, not a check. The persona pool in shim.js is a *generated* mirror
// precisely because it drifted twice on a comment like that (gap G7); these
// literals had the same comment and no generator.
//
// Drift here is not cosmetic. The handshake is one event name and one nonce field:
// change `nullecho:persona` in protocol.js alone and every page silently falls back
// to the un-rotated fallback persona, with nothing failing anywhere.

const readSrc = (rel) => fs.readFileSync(path.join(EXT, rel), 'utf8');

/** `const NAME = 'value';` — the exact shape the classic scripts use. */
function inlinedString(src, name) {
  const m = new RegExp(`const\\s+${name}\\s*=\\s*(['"])(.*?)\\1\\s*;`).exec(src);
  return m ? m[2] : undefined;
}

function inlinedNumber(src, name) {
  const m = new RegExp(`const\\s+${name}\\s*=\\s*(\\d+)\\s*;`).exec(src);
  return m ? Number(m[1]) : undefined;
}

test('the classic content scripts inline exactly the literals protocol.js exports', () => {
  for (const [rel, expected] of Object.entries(CONTENT_SCRIPT_LITERALS)) {
    const src = readSrc(rel);
    for (const [name, value] of Object.entries(expected)) {
      assert.equal(
        inlinedString(src, name), value,
        `${rel}: const ${name} has drifted from src/protocol.js (expected '${value}')`,
      );
    }
  }
});

test('the numeric literals the content scripts inline match too', () => {
  for (const [rel, expected] of Object.entries(CONTENT_SCRIPT_NUMERIC_LITERALS)) {
    const src = readSrc(rel);
    for (const [name, value] of Object.entries(expected)) {
      assert.equal(
        inlinedNumber(src, name), value,
        `${rel}: const ${name} has drifted from src/protocol.js (expected ${value})`,
      );
    }
  }
});

test('every literal registered for a file is actually declared in it', () => {
  // Guards the other direction: a rename in a content script that leaves the
  // registry pointing at a const that no longer exists would otherwise read as
  // "undefined !== value", which is the same failure with a worse message.
  for (const [rel, expected] of Object.entries(CONTENT_SCRIPT_LITERALS)) {
    const src = readSrc(rel);
    for (const name of Object.keys(expected)) {
      assert.match(src, new RegExp(`const\\s+${name}\\s*=`), `${rel} declares no const ${name}`);
    }
  }
});

test('removed channels stay removed', () => {
  // `protocol.js` is where each ban is declared, so it is the one file allowed to
  // name the string.
  const files = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(js|mjs|json|html)$/.test(entry.name)) files.push(full);
    }
  }(EXT));

  const protocolPath = path.join(EXT, 'src', 'protocol.js');
  for (const [literal, why] of Object.entries(FORBIDDEN_LITERALS)) {
    const quoted = new RegExp(`['"]${literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`);
    for (const file of files) {
      if (file === protocolPath) continue;
      assert.ok(
        !quoted.test(fs.readFileSync(file, 'utf8')),
        `${path.relative(EXT, file)} uses the removed literal "${literal}" — ${why}`,
      );
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// content-script ORDER — the handshake's one ordering dependency
// ═══════════════════════════════════════════════════════════════════════════
//
// `shim-loader.js` (ISOLATED) must be declared before the MAIN-world scripts, at
// the same `run_at`. Content scripts with the same `run_at` are injected in
// declaration order, so this is what puts the loader's `nullecho:status` listener
// in place before `shim.js` publishes its handshake nonce.
//
// Getting this wrong fails silently and completely: the loader never hears a
// nonce, never delivers a persona, and every page runs on the un-rotated fallback
// while the extension looks entirely healthy. It was already load-bearing for the
// "did the shim boot at all?" check; the nonce made it load-bearing twice over.

for (const manifestName of ['manifest.json', 'manifest.firefox.json']) {
  test(`${manifestName}: the loader is declared before the MAIN-world scripts`, () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(EXT, manifestName), 'utf8'));
    const scripts = manifest.content_scripts;
    assert.ok(Array.isArray(scripts) && scripts.length >= 2);

    const files = scripts.map((s) => s.js[0]);
    assert.deepEqual(files, ['src/shim-loader.js', 'src/shim.js', 'src/gpc.js']);

    assert.equal(scripts[0].world, 'ISOLATED');
    for (const s of scripts) {
      assert.equal(s.run_at, 'document_start', `${s.js[0]} must run at document_start`);
      assert.equal(s.all_frames, true, `${s.js[0]} must cover subframes`);
    }
    for (const s of scripts.slice(1)) {
      assert.equal(s.world, 'MAIN', `${s.js[0]} must run in the page realm`);
    }
  });
}
