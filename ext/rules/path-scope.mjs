/**
 * Nullecho — which path-scoped NEVER_BLOCK entries a block rule would reach.
 * Dev-only (validate.mjs check 11 and its tests); never packaged — the manifest
 * reaches nothing in here.
 *
 * `isNeverBlock()` matches HOSTS. A path-scoped entry (`www.google.com/recaptcha/`,
 * `a.klaviyo.com/client/subscriptions/`) is skipped by it on purpose — the host
 * is not protected, the path is — so until 0.9.3 nothing stopped a static rule
 * from blocking `a.klaviyo.com` whole, or `||a.klaviyo.com/client/`, and taking
 * every Klaviyo sign-up form's submit with it.
 */
import { NEVER_BLOCK } from '../src/allowlist.js';
import { compileUrlFilter, hostIsUnder } from '../src/block-counter.js';

/**
 * Path-scoped NEVER_BLOCK entries a block condition would reach (check 11).
 *
 * The entry is a URL prefix (`a.klaviyo.com/client/subscriptions/`). It is
 * reached when the rule's hosts cover the entry's host AND the rule's urlFilter
 * (if any) matches a URL at or under that prefix. Sampled, not proven: the
 * prefix itself, with a query string, and one segment deeper — which is what a
 * real form submit looks like (`…/client/subscriptions/?company_id=X`). Initiator
 * and party conditions are ignored on purpose: a rule that blocks the path on
 * SOME site still blocks it.
 */
export function reachedPathScopedEntries(c, neverBlock = NEVER_BLOCK) {
  const out = [];
  const re = c.urlFilter ? compileUrlFilter(c.urlFilter) : null;
  for (const raw of neverBlock) {
    if (!raw.includes('/')) continue;
    const entry = raw.toLowerCase();
    const host = entry.split('/')[0];
    if (c.requestDomains && !c.requestDomains.some((d) => hostIsUnder(host, d))) continue;
    if (c.excludedRequestDomains && c.excludedRequestDomains.some((d) => hostIsUnder(host, d))) continue;
    if (!c.requestDomains && !c.urlFilter) continue; // matches nothing by host; check 6 territory
    const base = `https://${entry}`;
    const samples = [base, `${base}?company_id=x`, `${base.replace(/\/$/, '')}/x/y?z=1`];
    const urlHit = re ? samples.some((u) => re.test(u)) : true;
    if (urlHit) out.push(raw);
  }
  return out;
}
