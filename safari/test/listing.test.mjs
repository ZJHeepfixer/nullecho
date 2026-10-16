/**
 * safari/store/listing.json is the machine-readable copy of safari/STORE-LISTING.md that
 * safari/tools/asc-listing.mjs pushes. These tests keep the two from drifting apart, hold the texts to
 * Apple's limits, check every screenshot file's size and alpha, and run the tool's offline plan.
 *
 * Run: `node --test safari/test/*.test.mjs` from the repo root.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { REPO } from './helpers.mjs';
import { loadListing, describePlan, imageSize, LIMITS, LISTING_FILE, STORE_DIR } from '../tools/asc-listing.mjs';

const md = fs.readFileSync(path.join(REPO, 'safari', 'STORE-LISTING.md'), 'utf8');
const l = loadListing();

test('every listing text appears verbatim in STORE-LISTING.md (edit the markdown first, then listing.json)', () => {
  const texts = {
    name: l.app.name, subtitle: l.app.subtitle, privacyPolicyUrl: l.app.privacyPolicyUrl,
    copyright: l.version.copyright, promotionalText: l.version.promotionalText, description: l.version.description,
    keywords: l.version.keywords, supportUrl: l.version.supportUrl, whatsNew: l.version.whatsNew.text,
  };
  for (const [k, t] of Object.entries(texts)) assert.ok(md.includes(t), `${k} is not verbatim in STORE-LISTING.md`);
  for (const [i, para] of l.review.notes.split('\n\n').entries()) assert.ok(md.includes(para), `review notes paragraph ${i + 1} is not verbatim in STORE-LISTING.md §8`);
  assert.equal(l.review.notes.split('\n\n').length, 3, 'the notes carry the three required paragraphs (the optional fourth stays out)');
});

test('texts are inside Apple\'s limits and the keywords follow the rules', () => {
  assert.ok(l.app.subtitle.length <= LIMITS.subtitle);
  assert.ok(l.version.promotionalText.length <= LIMITS.promotionalText);
  assert.ok(Buffer.byteLength(l.version.keywords) <= LIMITS.keywordsBytes);
  assert.ok(l.version.description.length <= LIMITS.description);
  assert.ok(Buffer.byteLength(l.review.notes) <= LIMITS.notesBytes);
  assert.ok(!/\s,|,\s/.test(l.version.keywords));
  assert.ok(!/nullecho/i.test(l.version.keywords), 'the app name is not a keyword');
  for (const kw of l.version.keywords.split(',')) assert.ok(kw.length > 2, `keyword "${kw}" too short`);
  // the director's rule: no third-party list or browser name in store text
  for (const banned of ['DuckDuckGo', 'EasyPrivacy', 'EasyList', 'AdGuard', 'Chrome', 'Firefox', 'Edge']) {
    for (const [k, t] of [['description', l.version.description], ['promotionalText', l.version.promotionalText], ['keywords', l.version.keywords], ['subtitle', l.app.subtitle]]) {
      assert.ok(!t.includes(banned), `${k} names ${banned}`);
    }
  }
  // the review notes may name the lists (App Review reads them, customers do not), and must name the credit location
  assert.ok(l.review.notes.includes('Acknowledgements'));
});

test('fixed values match the decisions on record', () => {
  assert.equal(l.bundleId, 'org.nullecho.app');
  assert.equal(l.app.contentRightsDeclaration, 'USES_THIRD_PARTY_CONTENT');
  assert.equal(l.app.primaryCategory, 'UTILITIES');
  assert.equal(l.version.versionString, JSON.parse(fs.readFileSync(path.join(REPO, 'ext', 'manifest.json'), 'utf8')).version, 'version follows ext/manifest.json');
  assert.deepEqual(l.version.platforms, ['IOS', 'MAC_OS']);
  assert.equal(l.version.releaseType, 'MANUAL');
  assert.equal(l.review.demoAccountRequired, false);
  assert.deepEqual(l.inAppPurchases.productIds, ['org.nullecho.tip.small', 'org.nullecho.tip.medium', 'org.nullecho.tip.large', 'org.nullecho.tip.xlarge']);
  for (const [k, v] of Object.entries(l.ageRating)) assert.ok(v === 'NONE' || v === false || v === null, `ageRating.${k} = ${v} is not NONE/false/null (4+)`);
  assert.ok(!JSON.stringify(l).match(/@[a-z0-9-]+\.[a-z]{2,}|\+1[ -]?\d/i), 'no email or phone number in the public listing file');
});

test('every screenshot file exists in safari/store with the set\'s pixel size and no alpha; nothing else is forgotten', () => {
  const listed = new Set();
  for (const set of l.screenshots) {
    for (const f of set.files) {
      listed.add(f);
      const dim = imageSize(path.join(STORE_DIR, f));
      assert.ok(dim, `${f} unreadable`);
      assert.deepEqual([dim.width, dim.height], set.size, `${f} size`);
      assert.equal(dim.alpha, false, `${f} has alpha`);
    }
  }
  const onDisk = fs.readdirSync(STORE_DIR).filter((f) => /\.(png|jpe?g)$/i.test(f));
  assert.deepEqual(onDisk.filter((f) => !listed.has(f)), [], 'image in safari/store that no screenshot set lists');
  // the Mac set is flagged stale until it is re-captured from a build with the current copy
  const mac = l.screenshots.find((s) => s.platform === 'MAC_OS');
  assert.ok(mac && typeof mac.status === 'string', 'the Mac set carries its status');
});

test('loadListing rejects a broken file (over-long subtitle, missing screenshot)', () => {
  // os.tmpdir(), not dist/: dist is build output and does not exist on a clean checkout.
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'nullecho-listing-')), 'listing.json');
  const broken = JSON.parse(fs.readFileSync(LISTING_FILE, 'utf8'));
  broken.app.subtitle = 'x'.repeat(31);
  fs.writeFileSync(tmp, JSON.stringify(broken));
  assert.throws(() => loadListing(tmp), /subtitle 31 > 30/);
  const broken2 = JSON.parse(fs.readFileSync(LISTING_FILE, 'utf8'));
  broken2.screenshots[0].files.push('nope.png');
  fs.writeFileSync(tmp, JSON.stringify(broken2));
  assert.throws(() => loadListing(tmp), /screenshot missing: nope\.png/);
  fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
});

test('the offline plan runs without credentials or network and names every step', () => {
  const plan = describePlan(l);
  assert.ok(plan.some((x) => x.startsWith('1. apps: contentRightsDeclaration = USES_THIRD_PARTY_CONTENT')));
  assert.ok(plan.some((x) => x.includes('SKIPPED: stale')), 'the stale Mac set is announced as skipped');
  const out = execFileSync('node', [path.join(REPO, 'safari', 'tools', 'asc-listing.mjs'), '--plan', '--offline'], { encoding: 'utf8', env: { PATH: process.env.PATH } });
  assert.ok(out.includes('PLAN for Nullecho 0.9.2 (org.nullecho.app); nothing is sent:'));
  assert.ok(out.includes('10. in-app purchases'));
});
