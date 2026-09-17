import { registrableDomain } from './suffixes.js';
/**
 * Site report + linkage engine
 * ────────────────────────────
 * Every blocker on the market reports "47 trackers blocked." That number tells
 * you nothing about the actual harm, which is not *observation* — it's the JOIN.
 * One company recognising you on your bank's site and on a health forum is the
 * thing worth caring about.
 *
 * ── Why the PRIMARY export is a per-site report, not your history ────────────
 *
 * This module used to lead with the cross-site graph of *your* browsing. Two
 * findings (DECISIONS.md D10) say that is the wrong artifact to lead with:
 *
 *   1. Revelation alone can backfire. Farke et al. (USENIX Security 2021,
 *      n=153) showed users Google's My Activity dashboard; afterwards they were
 *      *significantly less* concerned about data collection, and only 25%
 *      changed anything. So nothing here returns a finding without a remedy
 *      attached — see `remedyFor()`, and the test that asserts it.
 *
 *   2. Disclosure cost decides what spreads. Blacklight scans *any site you
 *      name* — 18M+ scans, and its best-performing share was a scan of someone
 *      else's product. Lightbeam graphed *your own history*; sharing it is a
 *      confession, nobody did, and its listing is now a 404.
 *
 *      → **A tool that reveals a third party can be shared. A tool that reveals
 *        you cannot.** So `siteReport()` — what THIS site does to whoever
 *        visits it — is the primary export and the shareable one, and
 *        `buildLinkageGraph()` is kept as private, local-only evidence.
 *
 * Nullecho does not need scanning infrastructure to do this: it already
 * observes every request on every site the user visits.
 *
 * ── An honesty constraint that shapes the whole module ──────────────────────
 * We observe that a third party was *present*, and that a page *read* a
 * fingerprinting surface. We do NOT observe that anyone correlated anything —
 * that happens on their servers, where we cannot see. So every term here is
 * about *capability*: `couldLink`, `reach`, `exposure`, `present`, `attempted`.
 * Never `tracked you across`, never `they know`. The UI copy rules in
 * docs/THREAT-MODEL.md depend on this distinction, and it is enforced by naming
 * and by `linkage.test.js`, not by hoping people remember.
 */

/**
 * Owners of tracker domains, so a report names the entity rather than a pile of
 * unrecognisable hostnames. Partial by design — an unmapped domain is shown as
 * itself and flagged `known: false`, never guessed at.
 */
export const TRACKER_OWNERS = {
  'doubleclick.net': 'Google',
  'googlesyndication.com': 'Google',
  'googletagmanager.com': 'Google',
  'google-analytics.com': 'Google',
  'googleadservices.com': 'Google',
  'g.doubleclick.net': 'Google',
  'analytics.google.com': 'Google',
  'facebook.com': 'Meta',
  'facebook.net': 'Meta',
  'connect.facebook.net': 'Meta',
  'fbcdn.net': 'Meta',
  'amazon-adsystem.com': 'Amazon',
  'adsystem.amazon.com': 'Amazon',
  'ads-twitter.com': 'X (Twitter)',
  'analytics.twitter.com': 'X (Twitter)',
  't.co': 'X (Twitter)',
  'licdn.com': 'LinkedIn',
  'linkedin.com': 'LinkedIn',
  'bing.com': 'Microsoft',
  'clarity.ms': 'Microsoft',
  'tiktok.com': 'TikTok',
  'analytics.tiktok.com': 'TikTok',
  'criteo.com': 'Criteo',
  'criteo.net': 'Criteo',
  'taboola.com': 'Taboola',
  'outbrain.com': 'Outbrain',
  'scorecardresearch.com': 'Comscore',
  'quantserve.com': 'Quantcast',
  'segment.com': 'Twilio (Segment)',
  'segment.io': 'Twilio (Segment)',
  'mixpanel.com': 'Mixpanel',
  'amplitude.com': 'Amplitude',
  'hotjar.com': 'Hotjar',
  'fullstory.com': 'FullStory',
  'heap.io': 'Heap',
  'fpjs.io': 'FingerprintJS',
  'fingerprintjs.com': 'FingerprintJS',
  'online-metrix.net': 'LexisNexis (ThreatMetrix)',
  'iovation.com': 'TransUnion (iovation)',
  'sift.com': 'Sift',
  'adnxs.com': 'Microsoft (Xandr)',
  'rubiconproject.com': 'Magnite',
  'pubmatic.com': 'PubMatic',
  'openx.net': 'OpenX',
  'casalemedia.com': 'Index Exchange',
  'bidswitch.net': 'IPONWEB',
  'crwdcntrl.net': 'Lotame',
  'demdex.net': 'Adobe',
  'omtrdc.net': 'Adobe',
  'everesttech.net': 'Adobe',
  'branch.io': 'Branch',
  'appsflyer.com': 'AppsFlyer',
  'adjust.com': 'Adjust',
  'braze.com': 'Braze',
  'onesignal.com': 'OneSignal',
  'newrelic.com': 'New Relic',
  'sentry.io': 'Sentry',
  'permutive.com': 'Permutive',
  'chartbeat.com': 'Chartbeat',
  'parsely.com': 'Parse.ly',
  'nr-data.net': 'New Relic',
  'krxd.net': 'Salesforce (Krux)',
  'tapad.com': 'Experian (Tapad)',
  'liveramp.com': 'LiveRamp',
  'rlcdn.com': 'LiveRamp',
  'agkn.com': 'Neustar',
  'yahoo.com': 'Yahoo',
  'zemanta.com': 'Outbrain (Zemanta)',
  'teads.tv': 'Teads',
  'smartadserver.com': 'Equativ',
  'sharethrough.com': 'Sharethrough',
  '33across.com': '33Across',
  'id5-sync.com': 'ID5',
  'adsrvr.org': 'The Trade Desk',
};

/** Human labels for the fingerprinting surfaces the shim reports. */
export const FP_SURFACE_LABELS = {
  canvas: 'Canvas readback',
  webgl: 'WebGL parameters',
  webgpu: 'WebGPU adapter',
  audio: 'AudioContext',
  fonts: 'Font enumeration',
  screen: 'Screen metrics',
  navigator: 'navigator properties',
  timing: 'High-resolution timing',
  storage: 'Storage quota',
};

export const fpSurfaceLabel = (name) => FP_SURFACE_LABELS[name] ?? String(name ?? 'unknown');

/** What a blocking category means, phrased as a property of the SITE. */
export const CATEGORY_MEANING = {
  ads: 'ad exchanges and bidders',
  analytics: 'analytics and session recording',
  social: 'social pixels and embeds',
  fingerprinting: 'device-identification scripts',
  heuristic: 'domains Nullecho learned to block from their behaviour',
  'heuristic-cookie': 'domains allowed through with their cookies removed',
};

/** Registrable domain for owner lookup — the ONE shared table (src/suffixes.js, D23). */
export function baseDomain(host) {
  return registrableDomain(String(host || '').replace(/^www\./i, ''));
}

/** Owner entity for a tracker domain, falling back to the domain itself. */
export function ownerOf(domain) {
  const d = String(domain || '').toLowerCase().replace(/^www\./, '');
  if (TRACKER_OWNERS[d]) return TRACKER_OWNERS[d];
  const base = baseDomain(d);
  return TRACKER_OWNERS[base] || base || d;
}

/** True when we recognise the company behind a domain rather than echoing it. */
export function ownerIsKnown(domain) {
  const d = String(domain || '').toLowerCase().replace(/^www\./, '');
  return Boolean(TRACKER_OWNERS[d] || TRACKER_OWNERS[baseDomain(d)]);
}

/** `{domain: count}` or `[domain]` → `[{domain, count}]`, biggest first. */
function toCounted(table) {
  if (!table) return [];
  if (Array.isArray(table)) {
    return table.map((d) => (typeof d === 'string' ? { domain: d, count: 0 } : d))
      .filter((x) => x && x.domain);
  }
  return Object.entries(table)
    .map(([domain, count]) => ({ domain, count: Number(count) || 0 }))
    .sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain));
}

// ═══════════════════════════════════════════════════════════════════════════
// PRIMARY — the per-site report
// ═══════════════════════════════════════════════════════════════════════════

/** Finding kinds. Stable ids, because the UI and the remedy table both key off them. */
export const FINDING = {
  TRACKERS: 'trackers',
  FINGERPRINTING: 'fingerprinting',
  IDENTIFIERS: 'identifiers',
  GPC: 'gpc',
  /** Cross-site reach. LOCAL ONLY — derives from the user's own browsing. */
  REACH: 'reach',
  CLEAN: 'clean',
};

/**
 * What this site does to the people who visit it.
 *
 * Everything in here except the `REACH` finding is a property of the SITE, which
 * is what makes the output shareable: posting it discloses that you opened one
 * page you chose to name, and nothing else about you. `REACH` is marked
 * `local: true` and is stripped by `siteShareCard()`.
 *
 * @param {string} site   eTLD+1 of the page being reported on
 * @param {Object} stats  per-site table from the service worker:
 *                        { blocked, cookieStripped, fp, fpByApi, byCategory,
 *                          trackers, cookieTrackers }
 *                        `trackers` / `cookieTrackers` may be `{domain: count}`
 *                        or `[{domain, count}]`.
 * @param {Object} [ctx]
 * @param {boolean} [ctx.blockingEnabled=true]   Nullecho on for this site
 * @param {boolean} [ctx.gpcSent]                Sec-GPC actually sent here
 * @param {boolean} [ctx.gpcExcepted]            suppressed for this site specifically
 * @param {boolean} [ctx.strictFingerprinting]   tier-B anti-fraud rules enabled
 * @param {boolean} [ctx.isCalifornian]
 * @param {boolean} [ctx.dropFiled]
 * @param {Record<string, number>} [ctx.crossSiteReach]  owner → how many of the
 *        user's own sites that owner also appeared on. Local evidence only.
 */
export function siteReport(site, stats = {}, ctx = {}) {
  const subject = baseDomain(site) || String(site || '');
  const blockingEnabled = ctx.blockingEnabled !== false;

  const blockedDomains = toCounted(stats.trackers);
  const cookieDomains = toCounted(stats.cookieTrackers);

  // owner → { domains, requests, cookieDomains, cookieRequests }
  const byOwner = new Map();
  const bump = (list, key) => {
    for (const { domain, count } of list) {
      // A first party observing itself is not a third-party presence.
      if (baseDomain(domain) === subject) continue;
      const owner = ownerOf(domain);
      if (!byOwner.has(owner)) {
        byOwner.set(owner, {
          owner,
          known: ownerIsKnown(domain),
          domains: [],
          requests: 0,
          cookieDomains: [],
          cookieRequests: 0,
        });
      }
      const rec = byOwner.get(owner);
      rec.known = rec.known || ownerIsKnown(domain);
      if (key === 'blocked') {
        rec.domains.push({ domain, count });
        rec.requests += count;
      } else {
        rec.cookieDomains.push({ domain, count });
        rec.cookieRequests += count;
      }
    }
  };
  bump(blockedDomains, 'blocked');
  bump(cookieDomains, 'cookies');

  const companies = [...byOwner.values()]
    .map((c) => ({
      ...c,
      domains: c.domains.sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain)),
      cookieDomains: c.cookieDomains.sort((a, b) => b.count - a.count),
      total: c.requests + c.cookieRequests,
    }))
    .sort((a, b) => b.total - a.total || a.owner.localeCompare(b.owner));

  const surfaces = Object.entries(stats.fpByApi ?? {})
    .map(([api, count]) => ({ api, label: fpSurfaceLabel(api), count: Number(count) || 0 }))
    .sort((a, b) => b.count - a.count || a.api.localeCompare(b.api));

  const categories = Object.entries(stats.byCategory ?? {})
    .map(([key, count]) => ({
      key,
      count: Number(count) || 0,
      meaning: CATEGORY_MEANING[key] ?? key,
    }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);

  const fingerprinting = {
    // "attempted": the page called a surface whose main use is device
    // identification. We saw the call. We did not see what was done with it.
    attempted: (stats.fp ?? 0) > 0,
    reads: stats.fp ?? 0,
    surfaces,
  };

  const identifiers = {
    // Requests the yellowlist let through with Cookie / Set-Cookie removed —
    // i.e. a third party here was carrying or setting an identifying cookie.
    attempted: (stats.cookieStripped ?? 0) > 0,
    requests: stats.cookieStripped ?? 0,
    domains: cookieDomains,
  };

  const gpc = {
    sent: !!ctx.gpcSent,
    excepted: !!ctx.gpcExcepted,
    // Stated here so no caller has to remember it. We can prove we SENT the
    // signal. We cannot see whether anyone acted on it.
    honored: null,
  };

  const report = {
    site: subject,
    blockingEnabled,
    companies,
    companyCount: companies.length,
    requestsBlocked: stats.blocked ?? 0,
    categories,
    fingerprinting,
    identifiers,
    gpc,
    findings: [],
  };

  report.findings = buildFindings(report, ctx);
  report.headline = siteHeadline(report);
  return report;
}

function buildFindings(report, ctx) {
  const out = [];
  const push = (kind, title, detail, extra = {}) => {
    out.push({
      id: `${report.site}:${kind}`,
      kind,
      title,
      detail,
      local: false,
      ...extra,
      remedy: remedyFor({ kind, report }, ctx),
    });
  };

  if (report.companyCount) {
    const named = report.companies.slice(0, 3).map((c) => c.owner).join(', ');
    push(
      FINDING.TRACKERS,
      `${report.companyCount} ${plural(report.companyCount, 'company', 'companies')} with tracking infrastructure on this page`,
      report.blockingEnabled
        ? `${fmt(report.requestsBlocked)} ${plural(report.requestsBlocked, 'request', 'requests')} cut at the network layer. Most requests went to ${named}.`
        : `Nullecho is off here, so these loaded. Most requests went to ${named}.`,
    );
  }

  if (report.fingerprinting.attempted) {
    const names = report.fingerprinting.surfaces.slice(0, 4).map((s) => s.label).join(', ');
    push(
      FINDING.FINGERPRINTING,
      `This page read ${report.fingerprinting.surfaces.length} device-fingerprinting ${plural(report.fingerprinting.surfaces.length, 'surface', 'surfaces')}`,
      `${fmt(report.fingerprinting.reads)} ${plural(report.fingerprinting.reads, 'read', 'reads')} of ${names}. A single read is not proof of tracking — some of these have ordinary uses. Repeated reads of the same surface are the strong signal.`,
    );
  }

  if (report.identifiers.attempted) {
    push(
      FINDING.IDENTIFIERS,
      `Third parties here carried identifying cookies`,
      `${fmt(report.identifiers.requests)} ${plural(report.identifiers.requests, 'request', 'requests')} to ${report.identifiers.domains.length} ${plural(report.identifiers.domains.length, 'domain', 'domains')} went through with their Cookie and Set-Cookie headers removed. Each one carries something you can see on the page, so blocking it outright would break the site.`,
    );
  }

  push(
    FINDING.GPC,
    report.gpc.sent
      ? 'Global Privacy Control was sent to this site'
      : 'Global Privacy Control was not sent to this site',
    report.gpc.sent
      ? 'In California, Colorado and several other states this is a legally binding do-not-sell request. Whether the site acted on it happens on their servers — Nullecho can show the signal went out, never that anyone honoured it.'
      : report.gpc.excepted
        ? 'You turned the signal off for this site, or it ships off here because the site breaks when it sees it.'
        : 'The signal is switched off, so this site was never asked not to sell or share your data.',
  );

  // ── LOCAL ONLY from here. Never leaves the device. ──
  const reach = ctx.crossSiteReach ?? null;
  if (reach) {
    const alsoElsewhere = report.companies
      .map((c) => ({ owner: c.owner, reach: reach[c.owner] ?? 0 }))
      .filter((c) => c.reach > 1)
      .sort((a, b) => b.reach - a.reach);
    if (alsoElsewhere.length) {
      const top = alsoElsewhere[0];
      push(
        FINDING.REACH,
        `${alsoElsewhere.length} of these ${plural(alsoElsewhere.length, 'company', 'companies')} was also present on other sites you visited`,
        `${top.owner} was present on ${top.reach} of them — enough to be positioned to connect those visits. Nullecho sees presence, not whether the connection was made.`,
        { local: true, companies: alsoElsewhere.slice(0, 5) },
      );
    }
  }

  if (!out.some((f) => f.kind !== FINDING.GPC)) {
    out.unshift({
      id: `${report.site}:${FINDING.CLEAN}`,
      kind: FINDING.CLEAN,
      title: 'Nothing third-party recorded on this site yet',
      detail: 'Either this site does not load trackers, or you have not browsed it enough for Nullecho to see any.',
      local: false,
      remedy: remedyFor({ kind: FINDING.CLEAN, report }, ctx),
    });
  }

  return out;
}

/**
 * One line about the site. Presence and reads — both things we literally
 * counted — never a claim about what was done with them.
 */
export function siteHeadline(report) {
  if (!report?.site) return 'No site to report on.';
  const bits = [];
  if (report.companyCount) {
    bits.push(
      `${fmt(report.requestsBlocked)} tracker ${plural(report.requestsBlocked, 'request', 'requests')} to ` +
      `${report.companyCount} ${plural(report.companyCount, 'company', 'companies')}`,
    );
  }
  if (report.fingerprinting.attempted) {
    bits.push(
      `${fmt(report.fingerprinting.reads)} device-fingerprint ${plural(report.fingerprinting.reads, 'read', 'reads')}`,
    );
  }
  if (report.identifiers.attempted) {
    bits.push(`${fmt(report.identifiers.requests)} cookie-bearing ${plural(report.identifiers.requests, 'request', 'requests')}`);
  }
  if (!bits.length) return `${report.site}: nothing third-party recorded yet.`;
  return `${report.site}: ${joinList(bits)}.`;
}

// ═══════════════════════════════════════════════════════════════════════════
// The shareable artifact
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The per-site share card — and the reason it is shaped this way is worth
 * reading before editing.
 *
 * Blacklight scans a site you name; the scan is about the site, so posting it
 * costs the poster nothing and 18M+ scans followed. Lightbeam graphed your own
 * history; posting it was a confession, so nobody did.
 *
 * So this card describes **one named site**. The only origin in it is the
 * subject — the page the user deliberately chose to report on. Every other site
 * the user has visited is excluded, including through `findings`: anything
 * marked `local: true` is dropped here.
 *
 * Anything added to this function that could name a second origin turns a
 * shareable report back into a confession. `linkage.test.js` proves it does not.
 *
 * @returns {{subject, headline, companies, fingerprinting, gpc, remedy,
 *            disclosesOtherSites: false}}
 */
export function siteShareCard(report) {
  if (!report?.site) return null;
  const shareable = report.findings.filter((f) => !f.local);

  return {
    /** The one origin in this object, and the user picked it. */
    subject: report.site,
    headline: siteHeadline(report),
    stat: `${report.companyCount} ${plural(report.companyCount, 'company', 'companies')}`,
    companies: report.companies.slice(0, 8).map((c) => ({
      owner: c.owner,
      requests: c.total,
      known: c.known,
    })),
    fingerprinting: {
      attempted: report.fingerprinting.attempted,
      reads: report.fingerprinting.reads,
      surfaces: report.fingerprinting.surfaces.map((s) => s.label),
    },
    identifiers: {
      attempted: report.identifiers.attempted,
      requests: report.identifiers.requests,
      // Counts only. Cookie DOMAINS are third parties, so they would be safe —
      // but keeping the card to companies + counts is the rule that is easy to
      // audit, and an easy-to-audit rule is the one that survives edits.
    },
    gpc: { sent: report.gpc.sent, honored: null },
    findings: shareable.map((f) => ({
      kind: f.kind,
      title: f.title,
      remedy: f.remedy?.text ?? null,
    })),
    /** Asserted so a test can prove the invariant rather than trusting review. */
    disclosesOtherSites: false,
  };
}

/** Plain-text form of the site card, ready to paste. */
export function siteShareText(report, opts = {}) {
  const card = siteShareCard(report);
  if (!card) return '';
  const lines = [];
  lines.push(card.headline);

  if (card.companies.length) {
    lines.push(`Companies present: ${card.companies.map((c) => c.owner).join(', ')}.`);
  }
  if (card.fingerprinting.attempted) {
    lines.push(`Fingerprinting surfaces read: ${card.fingerprinting.surfaces.join(', ')}.`);
  }
  if (card.identifiers.attempted) {
    lines.push(
      `${fmt(card.identifiers.requests)} third-party ${plural(card.identifiers.requests, 'request', 'requests')} carried identifying cookies.`,
    );
  }
  lines.push(
    card.gpc.sent
      ? 'Global Privacy Control was sent. Whether the site acted on it is not observable from a browser.'
      : 'Global Privacy Control was not sent to this site.',
  );
  lines.push('');
  lines.push('Presence measured in-browser, not correlation — what these companies do with the data happens on their servers.');
  lines.push(opts.footer ?? 'Measured with Nullecho.');
  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// SECONDARY — the cross-site aggregate. Local-only, private evidence.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build the join graph across the sites the user has visited.
 *
 * This is genuinely useful — it is the thing that convinces *you* — but it is
 * evidence, not an artifact. It is rendered on the options page behind an
 * explicit "stays on this device" label, and `shareCard()` below carries counts
 * and company names out of it, never site identities.
 *
 * @param {Object} sites  service-worker stats table:
 *                        { "example.com": { trackers: { "doubleclick.net": 12, … } } }
 *                        `trackers` may also be an array of domain strings.
 * @param {Object} [opts]
 * @param {number} [opts.minSites=2]  a party present on only one site cannot join
 *                                    anything, so it is not a linker.
 * @returns {{
 *   totalSites: number,
 *   linkers: Array<{owner, domains, sites, reach, reachPct, couldLinkPairs}>,
 *   isolatedSites: string[],
 *   maxReach: number,
 *   pairCount: number,
 *   localOnly: true
 * }}
 */
export function buildLinkageGraph(sites, opts = {}) {
  const minSites = opts.minSites ?? 2;
  const siteNames = Object.keys(sites || {});
  const totalSites = siteNames.length;

  // owner → { domains:Set, sites:Set }
  const byOwner = new Map();

  for (const site of siteNames) {
    const entry = sites[site] || {};
    const raw = entry.trackers || {};
    const domains = Array.isArray(raw) ? raw : Object.keys(raw);

    for (const domain of domains) {
      const owner = ownerOf(domain);
      // A first party observing itself is not a cross-site join.
      if (baseDomain(domain) === baseDomain(site)) continue;

      if (!byOwner.has(owner)) byOwner.set(owner, { domains: new Set(), sites: new Set() });
      const rec = byOwner.get(owner);
      rec.domains.add(domain);
      rec.sites.add(site);
    }
  }

  const linkers = [];
  for (const [owner, rec] of byOwner) {
    const reach = rec.sites.size;
    if (reach < minSites) continue;
    linkers.push({
      owner,
      domains: [...rec.domains].sort(),
      sites: [...rec.sites].sort(),
      reach,
      reachPct: totalSites ? Math.round((reach / totalSites) * 100) : 0,
      // Every unordered pair of your sites this party was present on — the number
      // of distinct visit-pairs it is *positioned* to correlate.
      couldLinkPairs: (reach * (reach - 1)) / 2,
    });
  }

  linkers.sort((a, b) => b.reach - a.reach || a.owner.localeCompare(b.owner));

  const linkedSites = new Set(linkers.flatMap((l) => l.sites));
  const isolatedSites = siteNames.filter((s) => !linkedSites.has(s)).sort();

  return {
    totalSites,
    linkers,
    isolatedSites,
    maxReach: linkers.length ? linkers[0].reach : 0,
    pairCount: linkers.reduce((a, l) => a + l.couldLinkPairs, 0),
    /** Flag for callers: this object contains site identities. Do not transmit. */
    localOnly: true,
  };
}

/** owner → reach, for feeding the local REACH finding into a `siteReport()`. */
export function reachByOwner(graph) {
  const out = Object.create(null);
  for (const l of graph?.linkers ?? []) out[l.owner] = l.reach;
  return out;
}

/**
 * The pairs of YOUR sites a given party was present on. This is the view that
 * makes the harm concrete — "your bank and that health forum" lands in a way
 * "34 sites" does not.
 *
 * Local-only, obviously: it is a list of the user's origins. Capped, because
 * reach=40 is 780 pairs and nobody reads 780 rows.
 */
export function sitePairsFor(linker, limit = 20) {
  const out = [];
  const s = linker.sites;
  for (let i = 0; i < s.length && out.length < limit; i++) {
    for (let j = i + 1; j < s.length && out.length < limit; j++) {
      out.push([s[i], s[j]]);
    }
  }
  return out;
}

/**
 * One-line summary of the aggregate. Deliberately phrased as presence and
 * capability, never as proven correlation.
 */
export function headline(graph) {
  if (!graph.totalSites) return 'No browsing recorded yet.';
  if (!graph.linkers.length) {
    return `No third party was present on more than one of your ${graph.totalSites} sites.`;
  }
  const top = graph.linkers[0];
  return `${top.owner} was present on ${top.reach} of your ${graph.totalSites} sites — ` +
         `enough to connect ${top.couldLinkPairs.toLocaleString()} pairs of visits.`;
}

/**
 * The aggregate share card.
 *
 * Kept because a rank is a score and scores get posted (D10) — but it is the
 * *weaker* artifact, and `siteShareCard()` is what the product leads with.
 * It carries counts and company names. **It must never carry a site the user
 * visited.** Anything added here that could identify one origin turns a
 * shareable card into a confession.
 *
 * @returns {{headline, stat, detail, companies, exposure, disclosesSites: false}}
 */
export function shareCard(graph, rank) {
  if (!graph.linkers.length) return null;
  const top = graph.linkers[0];

  // `rank` is optional and only present once there is a real comparison set.
  // A fact becomes a score when it has a denominator — and scores get posted.
  const rankLine = (typeof rank === 'number' && Number.isFinite(rank))
    ? `More exposed than ${rank}% of people who ran this.`
    : null;

  return {
    headline: `${top.owner} could connect ${top.couldLinkPairs.toLocaleString()} pairs of my visits.`,
    stat: `${top.reach} of ${graph.totalSites} sites`,
    detail: rankLine,
    // Company names only. Deliberately NOT top.sites.
    companies: graph.linkers.slice(0, 5).map((l) => ({ owner: l.owner, reach: l.reach })),
    exposure: exposureScore(graph),
    /** Asserted so a test can prove the invariant rather than trusting review. */
    disclosesSites: false,
  };
}

/**
 * Exposure score, 0-100. Share of all possible site-pairs that at least one
 * party is positioned to join.
 *
 * Reported alongside the raw counts, never instead of them — per the copy rules,
 * a score is only allowed if it is defensible, and a score with no visible
 * arithmetic behind it is not.
 */
export function exposureScore(graph) {
  const n = graph.totalSites;
  if (n < 2) return 0;
  const allPairs = (n * (n - 1)) / 2;

  const joined = new Set();
  for (const l of graph.linkers) {
    for (let i = 0; i < l.sites.length; i++) {
      for (let j = i + 1; j < l.sites.length; j++) {
        joined.add(`${l.sites[i]}|${l.sites[j]}`);
      }
    }
  }
  return Math.round((joined.size / allPairs) * 100);
}

// ═══════════════════════════════════════════════════════════════════════════
// Remedies — every reveal must terminate in something to DO
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Farke et al. (USENIX Security 2021, n=153) found that showing users a privacy
 * dashboard left them *less* concerned about data collection and more positive
 * about it, with only 25% changing any setting. A reveal that ends at the reveal
 * can inoculate rather than motivate.
 *
 * So: never return a finding without a next action attached. `buildFindings()`
 * calls this for every finding it emits, and `linkage.test.js` asserts that no
 * finding — present or future — can reach the UI without one.
 *
 * Two shapes, one function:
 *   remedyFor(graph, state)                  → the aggregate remedy (unchanged)
 *   remedyFor({ kind, report }, state)       → the remedy for one site finding
 *
 * @returns {{text: string, action: string|null}}
 */
export function remedyFor(subject, state = {}) {
  if (subject && typeof subject === 'object' && 'kind' in subject) {
    return siteRemedy(subject.kind, subject.report ?? {}, state);
  }

  const graph = subject ?? { totalSites: 0, linkers: [] };
  if (!graph.totalSites) {
    return { text: 'Browse normally for a day, then check back.', action: null };
  }
  if (!graph.linkers.length) {
    return { text: 'Nothing is joining your sites right now. Keep protection on.', action: null };
  }
  if (!state.blockingEnabled) {
    return { text: 'Turn on tracker blocking, then re-run this.', action: 'enable-blocking' };
  }
  if (!state.gpcEnabled) {
    return { text: 'Send Global Privacy Control — it is legally enforceable in some states.', action: 'enable-gpc' };
  }
  if (state.isCalifornian && !state.dropFiled) {
    return { text: 'Blocking stops new data. File a DROP request to delete what brokers already hold.', action: 'open-drop' };
  }
  return { text: 'Re-run after a week of browsing to see the difference.', action: 'rerun' };
}

function siteRemedy(kind, report, state) {
  const blockingOn = report.blockingEnabled !== false;

  switch (kind) {
    case FINDING.TRACKERS:
      if (!blockingOn) {
        return {
          text: 'Nullecho is switched off for this site, so none of this was cut. Turn it back on.',
          action: 'enable-site',
        };
      }
      return {
        text: 'These were cut at the network layer. Open the blocked list to check nothing you need is in it.',
        action: 'review-blocked',
      };

    case FINDING.FINGERPRINTING:
      if (!blockingOn) {
        return {
          text: 'The device shim is off here, so this page read your real device. Turn Nullecho back on for this site.',
          action: 'enable-site',
        };
      }
      if (!state.strictFingerprinting) {
        return {
          text: 'This site was shown a stand-in device profile. For a site you never sign in to, turn on strict fingerprinting blocking as well — it ships off because it breaks some bank and checkout flows.',
          action: 'open-blocking-settings',
        };
      }
      return {
        text: 'This site was shown a stand-in device profile, and strict fingerprinting blocking is already on. Use "New identity" if you want it re-rolled.',
        action: 'rotate',
      };

    case FINDING.IDENTIFIERS:
      return {
        text: 'The cookies were removed, so the requests kept working and stopped carrying a name for you. If you want these blocked outright instead, switch the domain to blocked in settings.',
        action: 'open-blocking-settings',
      };

    case FINDING.GPC:
      if (!report.gpc?.sent) {
        return {
          text: 'Turn on Global Privacy Control. In California, Colorado and several other states it is a legally binding do-not-sell request.',
          action: 'enable-gpc',
        };
      }
      if (state.isCalifornian && !state.dropFiled) {
        return {
          text: 'The signal only covers data collected from now on. File a California DROP request to delete what brokers already hold.',
          action: 'open-drop',
        };
      }
      return {
        text: 'Nothing more to do here. Share this report if you want the site to answer for it.',
        action: 'share-report',
      };

    case FINDING.REACH:
      if (state.isCalifornian && !state.dropFiled) {
        return {
          text: 'Blocking stops new data. File a California DROP request to delete what brokers already hold.',
          action: 'open-drop',
        };
      }
      return {
        text: 'A different device profile per site is what breaks this join. Keep Nullecho on everywhere you can, and re-check in a week.',
        action: 'open-overview',
      };

    case FINDING.CLEAN:
      return {
        text: 'Nothing to do. Browse this site normally and check again.',
        action: 'rerun',
      };

    default:
      // A new finding kind with no remedy is a bug, not a blank space. Say so
      // rather than rendering a scary number with nothing to do about it.
      return {
        text: 'No remedy defined for this finding — please report it.',
        action: null,
      };
  }
}

// ── small helpers ───────────────────────────────────────────────────────────

const fmt = (n) => Number(n ?? 0).toLocaleString('en-US');
const plural = (n, one, many) => (Number(n) === 1 ? one : many);

function joinList(parts) {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}
