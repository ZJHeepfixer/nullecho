/**
 * 2026-09-22 — the store screenshot of the popup read "12 of these companies was also
 * present on other sites you visited". The reach finding's title agreed the verb with
 * nothing, and its noun with the count ("1 of these company"). "N of these companies"
 * always takes the plural noun; the verb follows N.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { siteReport, ownerOf, FINDING } from './linkage.js';

function reachTitle(domains) {
  const trackers = Object.fromEntries(domains.map((d, i) => [d, 5 - i]));
  const reach = Object.fromEntries(domains.map((d) => [ownerOf(d), 3]));
  const report = siteReport('example.com', { trackers }, { crossSiteReach: reach });
  const f = report.findings.find((x) => x.kind === FINDING.REACH);
  assert.ok(f, 'rig: no reach finding produced');
  return f.title;
}

test('reach finding, several companies: "N of these companies were also present"', () => {
  assert.equal(reachTitle(['doubleclick.net', 'facebook.net']), '2 of these companies were also present on other sites you visited');
});

test('reach finding, one company: "1 of these companies was also present"', () => {
  assert.equal(reachTitle(['doubleclick.net']), '1 of these companies was also present on other sites you visited');
});
