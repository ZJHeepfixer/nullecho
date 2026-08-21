/**
 * Nullecho — site-report / linkage tests
 * ═══════════════════════════════════════
 * The load-bearing test in this file is the DISCLOSURE INVARIANT.
 *
 * DECISIONS.md D10: disclosure cost decides what spreads. Blacklight scans a
 * site you name — 18M+ scans. Lightbeam graphed your own history — sharing it
 * was a confession, nobody did, and its listing is now a 404. So Nullecho's
 * shareable artifact describes a *site*, and the sites the user visited must
 * never be able to reach it.
 *
 * `shareCard()` and `siteShareCard()` both assert that in a field
 * (`disclosesSites` / `disclosesOtherSites`). An assertion in a return value is
 * a comment with better punctuation. These tests are what actually holds it:
 * they build a report over sites with unguessable canary names, serialise every
 * string reachable from the shareable output — keys and values, at any depth —
 * and fail if a canary appears anywhere.
 *
 * That shape matters. A test that checks named fields only would pass while a
 * future edit leaks an origin through a new field, a finding `detail`, an object
 * key, or a `sites` array someone spread in "just for debugging".
 *
 * `linkage.js` is pure, so this needs no `chrome` stub.
 * Run: `node --test` from `ext/`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TRACKER_OWNERS,
  FINDING,
  baseDomain,
  ownerOf,
  ownerIsKnown,
  siteReport,
  siteHeadline,
  siteShareCard,
  siteShareText,
  buildLinkageGraph,
  reachByOwner,
  sitePairsFor,
  headline,
  shareCard,
  exposureScore,
  remedyFor,
  fpSurfaceLabel,
} from './linkage.js';

// ── fixtures ────────────────────────────────────────────────────────────────
//
// Canary origins. Deliberately unguessable strings that cannot occur in company
// names, remedy copy or category labels, so a substring hit is unambiguous
// evidence of a leak rather than a coincidence.

const SUBJECT = 'qzx-subject-site-77.example';

const CANARIES = [
  'qzx-oncology-forum-41.example',
  'qzx-creditunion-92.example',
  'qzx-jobsearch-13.example',
  'qzx-dating-58.example',
  'qzx-legalaid-26.example',
];

const trackersFor = (...domains) =>
  Object.fromEntries(domains.map((d, i) => [d, 10 - i]));

/** A stats table spanning the subject plus every canary site. */
function historyFixture() {
  return {
    [SUBJECT]: {
      blocked: 61,
      cookieStripped: 5,
      fp: 14,
      fpByApi: { canvas: 6, webgl: 4, audio: 3, fonts: 1 },
      byCategory: { ads: 34, analytics: 15, social: 6, fingerprinting: 3, 'heuristic-cookie': 5 },
      trackers: trackersFor(
        'doubleclick.net', 'google-analytics.com', 'facebook.net',
        'criteo.com', 'adnxs.com', 'scorecardresearch.com',
        'demdex.net', 'unmapped-adtech-xyz.example',
      ),
      cookieTrackers: { 'youtube.com': 3, 'intercom.io': 2 },
    },
    [CANARIES[0]]: {
      blocked: 22, fp: 3, fpByApi: { canvas: 3 }, byCategory: { ads: 22 },
      trackers: trackersFor('doubleclick.net', 'facebook.net', 'criteo.com'),
    },
    [CANARIES[1]]: {
      blocked: 4, fp: 0, fpByApi: {}, byCategory: { analytics: 4 },
      trackers: trackersFor('google-analytics.com'),
    },
    [CANARIES[2]]: {
      blocked: 31, fp: 1, fpByApi: { fonts: 1 }, byCategory: { ads: 31 },
      trackers: trackersFor('doubleclick.net', 'adnxs.com', 'demdex.net'),
    },
    [CANARIES[3]]: {
      blocked: 17, fp: 0, fpByApi: {}, byCategory: { social: 17 },
      trackers: trackersFor('facebook.net', 'doubleclick.net'),
    },
    [CANARIES[4]]: {
      blocked: 0, fp: 0, fpByApi: {}, byCategory: {}, trackers: {},
    },
  };
}

/** Every string reachable from `value`, including object KEYS, at any depth. */
function allStrings(value, out = [], seen = new WeakSet()) {
  if (typeof value === 'string') { out.push(value); return out; }
  if (typeof value === 'number' || typeof value === 'boolean' || value == null) return out;
  if (typeof value === 'object') {
    if (seen.has(value)) return out;
    seen.add(value);
    if (Array.isArray(value)) {
      for (const v of value) allStrings(v, out, seen);
      return out;
    }
    for (const [k, v] of Object.entries(value)) {
      out.push(k);
      allStrings(v, out, seen);
    }
  }
  return out;
}

// ── basics ──────────────────────────────────────────────────────────────────

test('baseDomain collapses subdomains and honours two-part public suffixes', () => {
  assert.equal(baseDomain('www.example.com'), 'example.com');
  assert.equal(baseDomain('a.b.c.example.com'), 'example.com');
  assert.equal(baseDomain('news.bbc.co.uk'), 'bbc.co.uk');
  assert.equal(baseDomain('shop.example.com.au'), 'example.com.au');
  assert.equal(baseDomain(''), '');
});

test('ownerOf names the entity, and echoes the domain when we do not know it', () => {
  assert.equal(ownerOf('doubleclick.net'), 'Google');
  assert.equal(ownerOf('stats.g.doubleclick.net'), 'Google');
  assert.equal(ownerOf('connect.facebook.net'), 'Meta');
  assert.equal(ownerOf('unmapped-adtech-xyz.example'), 'unmapped-adtech-xyz.example');
  assert.equal(ownerIsKnown('doubleclick.net'), true);
  assert.equal(ownerIsKnown('unmapped-adtech-xyz.example'), false);
});

test('no owner mapping guesses — every value is a real named entity', () => {
  for (const [domain, owner] of Object.entries(TRACKER_OWNERS)) {
    assert.ok(owner.length > 1, `${domain} maps to an empty owner`);
    assert.notEqual(owner, domain, `${domain} maps to itself, which is the fallback`);
  }
});

test('fingerprinting surfaces get human labels, unknown ones pass through', () => {
  assert.equal(fpSurfaceLabel('canvas'), 'Canvas readback');
  assert.equal(fpSurfaceLabel('someNewApi'), 'someNewApi');
});

// ── the per-site report (primary export) ────────────────────────────────────

test('siteReport groups tracker domains by the company that owns them', () => {
  const h = historyFixture();
  const r = siteReport(SUBJECT, h[SUBJECT], { blockingEnabled: true, gpcSent: true });

  const google = r.companies.find((c) => c.owner === 'Google');
  assert.ok(google, 'Google should be present');
  assert.deepEqual(
    google.domains.map((d) => d.domain).sort(),
    ['doubleclick.net', 'google-analytics.com'],
  );
  assert.equal(google.requests, 10 + 9);

  const unknown = r.companies.find((c) => c.owner === 'unmapped-adtech-xyz.example');
  assert.ok(unknown, 'an unmapped domain is still reported, as itself');
  assert.equal(unknown.known, false);
});

test('siteReport never counts the first party as a third party on its own site', () => {
  const r = siteReport('example.com', {
    blocked: 3,
    trackers: { 'cdn.example.com': 3, 'doubleclick.net': 1 },
  });
  assert.deepEqual(r.companies.map((c) => c.owner), ['Google']);
});

test('siteReport reports fingerprinting as reads observed, not as tracking proven', () => {
  const h = historyFixture();
  const r = siteReport(SUBJECT, h[SUBJECT], { gpcSent: true });
  assert.equal(r.fingerprinting.attempted, true);
  assert.equal(r.fingerprinting.reads, 14);
  assert.deepEqual(r.fingerprinting.surfaces.map((s) => s.api), ['canvas', 'webgl', 'audio', 'fonts']);
});

test('siteReport can never claim GPC was honoured — only that it was sent', () => {
  const sent = siteReport(SUBJECT, {}, { gpcSent: true });
  assert.equal(sent.gpc.sent, true);
  assert.equal(sent.gpc.honored, null, 'honoured is unobservable from a browser');

  const notSent = siteReport(SUBJECT, {}, { gpcSent: false });
  assert.equal(notSent.gpc.sent, false);
  assert.equal(notSent.gpc.honored, null);
});

test('a site with nothing recorded still gets a finding and a remedy, not a blank', () => {
  const r = siteReport('quiet.example', {}, { gpcSent: true });
  const clean = r.findings.find((f) => f.kind === FINDING.CLEAN);
  assert.ok(clean, 'an empty site produces a CLEAN finding');
  assert.ok(clean.remedy.text.length > 0);
  assert.match(siteHeadline(r), /nothing third-party recorded/i);
});

test('the cross-site REACH finding only appears when the caller passes local evidence', () => {
  const h = historyFixture();
  const bare = siteReport(SUBJECT, h[SUBJECT], { gpcSent: true });
  assert.equal(bare.findings.some((f) => f.kind === FINDING.REACH), false);

  const graph = buildLinkageGraph(h);
  const withReach = siteReport(SUBJECT, h[SUBJECT], {
    gpcSent: true,
    crossSiteReach: reachByOwner(graph),
  });
  const reach = withReach.findings.find((f) => f.kind === FINDING.REACH);
  assert.ok(reach, 'reach finding appears once cross-site evidence is supplied');
  assert.equal(reach.local, true, 'and it is marked local so the share card drops it');
});

// ── every finding ends in a named action (D10 / Farke et al.) ───────────────

test('EVERY finding carries a remedy with real text — no scary number stands alone', () => {
  const h = historyFixture();
  const graph = buildLinkageGraph(h);
  const contexts = [
    { blockingEnabled: true, gpcSent: true },
    { blockingEnabled: false, gpcSent: false },
    { blockingEnabled: true, gpcSent: true, strictFingerprinting: true },
    { blockingEnabled: true, gpcSent: true, isCalifornian: true },
    { blockingEnabled: true, gpcSent: false, isCalifornian: true, dropFiled: true },
    { blockingEnabled: true, gpcSent: true, crossSiteReach: reachByOwner(graph) },
  ];

  let seen = new Set();
  for (const ctx of contexts) {
    for (const site of Object.keys(h)) {
      const r = siteReport(site, h[site], ctx);
      assert.ok(r.findings.length > 0, `${site} produced no findings`);
      for (const f of r.findings) {
        seen.add(f.kind);
        assert.ok(f.remedy, `${f.kind} has no remedy`);
        assert.equal(typeof f.remedy.text, 'string');
        assert.ok(f.remedy.text.trim().length > 10, `${f.kind} remedy is not a real instruction`);
        assert.doesNotMatch(f.remedy.text, /No remedy defined/,
          `${f.kind} fell through to the missing-remedy fallback`);
      }
    }
  }

  // Guard against the suite silently covering fewer kinds after a refactor.
  for (const kind of Object.values(FINDING)) {
    assert.ok(seen.has(kind), `no fixture exercised the ${kind} finding`);
  }
});

test('an unrecognised finding kind returns a visible failure, never a blank remedy', () => {
  const r = remedyFor({ kind: 'not-a-real-kind', report: {} }, {});
  assert.match(r.text, /No remedy defined/);
});

test('the aggregate remedy escalates in the documented order', () => {
  const graph = buildLinkageGraph(historyFixture());
  assert.equal(remedyFor(graph, {}).action, 'enable-blocking');
  assert.equal(remedyFor(graph, { blockingEnabled: true }).action, 'enable-gpc');
  assert.equal(
    remedyFor(graph, { blockingEnabled: true, gpcEnabled: true, isCalifornian: true }).action,
    'open-drop',
  );
  assert.equal(
    remedyFor(graph, { blockingEnabled: true, gpcEnabled: true }).action,
    'rerun',
  );
  assert.equal(remedyFor(buildLinkageGraph({}), {}).action, null);
});

// ══════════════════════════════════════════════════════════════════════════
// THE DISCLOSURE INVARIANT
// ══════════════════════════════════════════════════════════════════════════

test('shareCard(): NO site the user visited appears anywhere in the aggregate card', () => {
  const h = historyFixture();
  const graph = buildLinkageGraph(h);
  const card = shareCard(graph, 78);

  assert.ok(card, 'fixture must produce a card, or this test proves nothing');
  assert.equal(card.disclosesSites, false);

  const haystack = allStrings(card).join(' ');
  for (const site of [SUBJECT, ...CANARIES]) {
    assert.ok(!haystack.includes(site), `aggregate share card leaked the origin ${site}`);
  }
  // Not through a `sites` array someone spread in "just for debugging", either.
  assert.ok(!haystack.includes('qzx-'), 'aggregate share card leaked a visited origin');
  assert.equal(JSON.stringify(card).includes('qzx-'), false);
});

test('shareCard(): the graph it is built from DOES hold origins — so the card is doing work', () => {
  const graph = buildLinkageGraph(historyFixture());
  assert.equal(graph.localOnly, true, 'the graph is flagged as un-transmittable');
  const graphStrings = allStrings(graph).join(' ');
  for (const site of CANARIES) {
    assert.ok(graphStrings.includes(site),
      `${site} must be in the graph, otherwise the leak test above is vacuous`);
  }
});

test('siteShareCard(): only the ONE site the user chose to report on appears', () => {
  const h = historyFixture();
  const graph = buildLinkageGraph(h);
  const report = siteReport(SUBJECT, h[SUBJECT], {
    blockingEnabled: true,
    gpcSent: true,
    crossSiteReach: reachByOwner(graph),
  });

  // The full report is a local object and may name other sites via findings.
  assert.ok(report.findings.some((f) => f.local), 'fixture must include a local finding');

  const card = siteShareCard(report);
  assert.equal(card.disclosesOtherSites, false);
  assert.equal(card.subject, SUBJECT);

  const haystack = allStrings(card).join(' ');
  assert.ok(haystack.includes(SUBJECT), 'the subject site is the point of the card');
  for (const site of CANARIES) {
    assert.ok(!haystack.includes(site), `site share card leaked the other origin ${site}`);
  }
  assert.equal(card.findings.some((f) => f.kind === FINDING.REACH), false,
    'local findings must be stripped from the shareable card');
});

test('siteShareText(): the pasteable string names one site and no other', () => {
  const h = historyFixture();
  const graph = buildLinkageGraph(h);
  const report = siteReport(SUBJECT, h[SUBJECT], {
    blockingEnabled: true,
    gpcSent: true,
    crossSiteReach: reachByOwner(graph),
  });
  const text = siteShareText(report);

  assert.ok(text.includes(SUBJECT));
  for (const site of CANARIES) {
    assert.ok(!text.includes(site), `share text leaked ${site}`);
  }
  // Every canary-prefixed origin — the marker for "a site the user visited" —
  // and there must be exactly one: the subject.
  const visited = [...new Set(text.match(/qzx-[a-z0-9-]+\.example\b/g) ?? [])];
  assert.deepEqual(visited, [SUBJECT]);

  // An UNMAPPED third-party domain is allowed to appear as itself, and should:
  // naming the party is the point, and a tracker domain is not the user.
  assert.ok(text.includes('unmapped-adtech-xyz.example'),
    'an unrecognised tracker is still named, never dropped or guessed at');
});

test('the invariant holds for EVERY site in the history, not just the fixture subject', () => {
  const h = historyFixture();
  const graph = buildLinkageGraph(h);
  const reach = reachByOwner(graph);

  for (const subject of Object.keys(h)) {
    const report = siteReport(subject, h[subject], {
      blockingEnabled: true, gpcSent: true, crossSiteReach: reach,
    });
    const strings = allStrings(siteShareCard(report)).join(' ') + ' ' + siteShareText(report);
    for (const other of Object.keys(h)) {
      if (other === subject) continue;
      assert.ok(!strings.includes(other),
        `report on ${subject} leaked ${other}`);
    }
  }
});

test('a tracker domain that happens to look like a visited site cannot smuggle one in', () => {
  // The user visited `qzx-dating-58.example`. If that origin ALSO shows up as a
  // third-party domain somewhere, the card may legitimately name it as a
  // company — but only for a report whose subject actually loaded it.
  const h = historyFixture();
  const report = siteReport(CANARIES[1], h[CANARIES[1]], { gpcSent: true });
  const strings = allStrings(siteShareCard(report)).join(' ');
  assert.ok(!strings.includes(CANARIES[3]));
  assert.ok(!strings.includes(SUBJECT));
});

// ── copy rules (docs/THREAT-MODEL.md) ───────────────────────────────────────

test('no produced string claims correlation, knowledge, or anonymity', () => {
  const banned = [
    /\bthey know\b/i,
    /\btracked you across\b/i,
    /\btracking you across\b/i,
    /\banonymous\b/i,
    /\buntraceable\b/i,
    /\binvisible\b/i,
    /protects you from surveillance/i,
    /\bstops? (?:sites? )?(?:from )?selling\b/i,
  ];

  const h = historyFixture();
  const graph = buildLinkageGraph(h);
  const reach = reachByOwner(graph);
  const strings = [];

  for (const ctx of [
    { blockingEnabled: true, gpcSent: true, crossSiteReach: reach },
    { blockingEnabled: false, gpcSent: false, crossSiteReach: reach },
    { blockingEnabled: true, gpcSent: true, isCalifornian: true, crossSiteReach: reach },
  ]) {
    for (const site of Object.keys(h)) {
      const r = siteReport(site, h[site], ctx);
      strings.push(...allStrings(r), siteShareText(r), siteHeadline(r));
    }
  }
  strings.push(...allStrings(shareCard(graph, 78) ?? {}), headline(graph));

  for (const s of strings) {
    for (const rx of banned) {
      assert.doesNotMatch(s, rx, `banned phrasing in: ${s}`);
    }
  }
});

test('capability language survives: presence and could-link, never did-link', () => {
  const graph = buildLinkageGraph(historyFixture());
  assert.match(headline(graph), /was present on/);
  assert.match(shareCard(graph).headline, /could connect/);
});

// ── the aggregate, still correct ────────────────────────────────────────────

test('buildLinkageGraph counts distinct sites, not requests', () => {
  const graph = buildLinkageGraph(historyFixture());
  const google = graph.linkers.find((l) => l.owner === 'Google');
  // doubleclick on subject + 3 canaries, google-analytics on subject + 1 canary
  assert.equal(google.reach, 5);
  assert.equal(google.couldLinkPairs, 10);
  assert.equal(graph.totalSites, 6);
});

test('a party present on only one site is not a linker', () => {
  const graph = buildLinkageGraph({
    'a.example': { trackers: { 'sentry.io': 4 } },
    'b.example': { trackers: { 'doubleclick.net': 1 } },
    'c.example': { trackers: { 'doubleclick.net': 1 } },
  });
  assert.deepEqual(graph.linkers.map((l) => l.owner), ['Google']);
  assert.deepEqual(graph.isolatedSites, ['a.example']);
});

test('exposureScore is the share of site-pairs at least one party can join', () => {
  const graph = buildLinkageGraph({
    'a.example': { trackers: { 'doubleclick.net': 1 } },
    'b.example': { trackers: { 'doubleclick.net': 1 } },
    'c.example': { trackers: {} },
    'd.example': { trackers: {} },
  });
  // 1 joined pair out of C(4,2) = 6
  assert.equal(exposureScore(graph), 17);
  assert.equal(exposureScore(buildLinkageGraph({ 'a.example': {} })), 0);
});

test('sitePairsFor caps output rather than returning hundreds of rows', () => {
  const sites = Array.from({ length: 40 }, (_, i) => `s${i}.example`);
  assert.equal(sitePairsFor({ sites }, 20).length, 20);
});

test('shareCard returns null when there is nothing to share', () => {
  assert.equal(shareCard(buildLinkageGraph({})), null);
  assert.equal(siteShareCard(null), null);
});
