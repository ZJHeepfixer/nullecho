/**
 * Nullecho — popup controller.
 *
 * Copy discipline (docs/THREAT-MODEL.md "Copy rules"):
 *   - concrete counts, never a letter grade or a "protection score". A score
 *     would have to be defensible against the measurement protocol in
 *     BASELINE.md, and nothing here measures a per-site outcome, so there is no
 *     honest number to put behind one.
 *   - "requests blocked" and "fingerprint reads seen" are things we literally
 *     counted. Everything else on screen is a description, not a claim.
 *   - the footer states the three biggest non-goals every time the popup opens,
 *     rather than hiding them behind a link.
 */

import { MSG, CATEGORY_LABELS } from '../src/protocol.js';
import {
  siteReport,
  siteShareText,
  fpSurfaceLabel,
  FINDING,
} from '../src/linkage.js';

const api = globalThis.chrome ?? globalThis.browser;
/** True when running as a real extension popup; false when opened as a plain page. */
const LIVE = !!api?.runtime?.id;

const $ = (id) => document.getElementById(id);
const nf = new Intl.NumberFormat();

let state = null;
let pendingReload = false;
let rotateArmed = false;
let rotateTimer = null;

// ── data ────────────────────────────────────────────────────────────────────

async function currentTab() {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

function sendMessage(msg) {
  return new Promise((resolve) => {
    api.runtime.sendMessage(msg, (res) => {
      void api.runtime.lastError;
      resolve(res ?? { ok: false, error: 'no response' });
    });
  });
}

async function load() {
  if (!LIVE) return DEMO;
  const tab = await currentTab();
  const res = await sendMessage({
    type: MSG.GET_SITE_REPORT,
    url: tab?.url ?? '',
    tabId: tab?.id,
  });
  return { ...res, tabId: tab?.id, tabUrl: tab?.url ?? '' };
}

// ── formatting ──────────────────────────────────────────────────────────────

const OS_LABEL = {
  'windows-11': 'Windows 11',
  'macos-14': 'macOS 14',
  'ubuntu-22': 'Ubuntu 22.04',
};

function prettySystem(p) {
  const os = OS_LABEL[p.os] ?? p.os;
  const chrome = /Chrome\/(\d+)/.exec(p.ua ?? '')?.[1];
  return chrome ? `${os} · Chrome ${chrome}` : os;
}

/** ANGLE renderer strings are long and mostly boilerplate. Keep the part a human reads. */
function prettyGpu(renderer = '') {
  const angle = /^ANGLE \(([^,]+),\s*(.+?)(?:\s+Direct3D11.*|,\s*(?:OpenGL|Unspecified|ANGLE).*)?\)$/.exec(renderer);
  if (angle) {
    const model = angle[2].replace(/\s*\(0x[0-9A-Fa-f]+\)/, '').replace(/^ANGLE Metal Renderer:\s*/, '').trim();
    return model || renderer;
  }
  return renderer;
}

function prettyScreen(s = {}) {
  return `${s.width}×${s.height} · ${s.dpr}x · ${s.colorDepth}-bit`;
}

/** Single source of truth lives in linkage.js, so the report and this list agree. */
const apiLabel = fpSurfaceLabel;

// ── render ──────────────────────────────────────────────────────────────────

function render(s) {
  state = s;
  $('wrap').hidden = false;

  if (!s?.ok || !s.site) {
    $('site').textContent = s?.tabUrl ? new URL(s.tabUrl).protocol.replace(':', '') + ':' : '—';
    $('inert').hidden = false;
    $('inert-copy').textContent =
      s?.reason ?? 'Nullecho only runs on regular web pages (http and https).';
    $('main').hidden = true;
    $('site-switch').hidden = true;
    $('identity').textContent = '';
    return;
  }

  $('inert').hidden = true;
  $('main').hidden = false;
  $('site-switch').hidden = false;

  $('site').textContent = s.site;
  $('site').title = s.site;

  const enabled = s.enabled !== false;
  $('site-toggle').checked = enabled;
  $('site-toggle-label').textContent = enabled ? 'On' : 'Off';

  $('stat-blocked').textContent = nf.format(s.stats?.blocked ?? 0);
  $('stat-fp').textContent = nf.format(s.stats?.fp ?? 0);

  renderReport(s, enabled);
  renderPersona(s, enabled);
  renderTrackers(s);
  renderCookiesStripped(s);
  renderFingerprintReads(s);
  renderAlerts(s, enabled);

  const id = s.identity;
  $('identity').textContent = id
    ? `identity ${id.tag} · rotated ${relTime(id.rotatedAt)}`
    : '';
}

// ── the per-site report ─────────────────────────────────────────────────────
//
// The primary view, and the shareable one. It describes what THIS SITE does to
// whoever opens it — companies present, fingerprint reads, identifying cookies,
// whether the GPC signal went out. Posting that discloses one origin the user
// deliberately named and nothing else about them, which is the whole reason it
// replaced the cross-site graph of the user's own history as the headline
// feature (DECISIONS.md D10).
//
// The cross-site view is still available, on the options page, labelled as
// local evidence. It is never what gets copied out of here.

/** Latest computed report, kept so the copy button does not rebuild it. */
let report = null;

function renderReport(s, enabled) {
  const panel = $('report-panel');
  if (!s.site) { panel.hidden = true; report = null; return; }

  report = siteReport(s.site, s.stats ?? {}, {
    blockingEnabled: enabled,
    gpcSent: !!s.gpc?.sent,
    gpcExcepted: !!s.gpc?.excepted,
    strictFingerprinting: !!s.strictFingerprinting,
    isCalifornian: !!s.settings?.isCalifornian,
    dropFiled: !!s.settings?.dropFiled,
    // Local evidence. Company names and counts, never origins — and the finding
    // it produces is marked `local`, so `siteShareText()` drops it.
    crossSiteReach: s.crossSiteReach ?? null,
  });

  panel.hidden = false;
  $('report-headline').textContent = report.headline;
  renderFindings(report);
  renderCompanies(report);

  // Rendered in full rather than generated on click: the user should be able to
  // read exactly what they are about to post before they post it.
  $('share-text').textContent = siteShareText(report);
}

function renderFindings(r) {
  const ul = $('findings');
  ul.replaceChildren();

  for (const f of r.findings) {
    const li = document.createElement('li');
    li.className = `finding${f.local ? ' local' : ''}`;

    const title = document.createElement('span');
    title.className = 'finding-title';
    title.textContent = f.title;

    const detail = document.createElement('span');
    detail.className = 'finding-detail';
    detail.textContent = f.detail;

    li.append(title, detail);

    if (f.local) {
      const tag = document.createElement('span');
      tag.className = 'finding-local-tag';
      tag.textContent = 'from your own browsing · stays on this device';
      li.append(tag);
    }

    // Never a finding without a next action. A number with nothing to do about
    // it is the failure mode Farke et al. measured.
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'remedy';
    btn.textContent = f.remedy.text;
    if (f.remedy.action) {
      btn.addEventListener('click', () => runRemedy(f.remedy.action));
    } else {
      btn.disabled = true;
    }
    li.append(btn);

    ul.append(li);
  }
}

function renderCompanies(r) {
  const panel = $('companies-panel');
  const ul = $('companies');
  ul.replaceChildren();

  if (!r.companies.length) { panel.hidden = true; return; }
  panel.hidden = false;
  $('companies-summary').textContent = `Companies present (${r.companies.length})`;

  for (const c of r.companies) {
    const li = document.createElement('li');

    const left = document.createElement('span');
    const name = document.createElement('span');
    name.className = 'co-name';
    name.textContent = c.owner;
    left.append(name);

    if (!c.known) {
      // We do not know who owns this domain, so we say the domain and stop.
      const tag = document.createElement('span');
      tag.className = 'co-unknown';
      tag.textContent = 'owner unknown';
      left.append(tag);
    }

    const domains = [...c.domains, ...c.cookieDomains].map((d) => d.domain);
    if (domains.length && !(domains.length === 1 && domains[0] === c.owner)) {
      const sub = document.createElement('span');
      sub.className = 'co-domains';
      sub.textContent = domains.join(' · ');
      sub.title = domains.join('\n');
      left.append(sub);
    }

    const count = document.createElement('span');
    count.className = 'co-count';
    count.textContent = nf.format(c.total);

    li.append(left, count);
    ul.append(li);
  }
}

/** Named actions the remedies dispatch to. Every one of these does something. */
async function runRemedy(action) {
  const openOptions = (hash) => {
    if (!LIVE) { location.hash = hash; return; }
    api.tabs.create({ url: api.runtime.getURL(`options/options.html${hash}`) });
    window.close();
  };

  switch (action) {
    case 'enable-site':
      $('site-toggle').checked = true;
      $('site-toggle').dispatchEvent(new Event('change'));
      return;

    case 'review-blocked': {
      const d = $('trackers-panel')?.querySelector('details');
      if (d) { d.open = true; d.scrollIntoView({ block: 'nearest' }); }
      return;
    }

    case 'enable-gpc':
      if (LIVE) await sendMessage({ type: MSG.SET_SETTINGS, patch: { gpc: true } });
      pendingReload = true;
      state = { ...state, gpc: { sent: true, excepted: false } };
      render(state);
      return;

    case 'open-blocking-settings': return openOptions('#blocking');
    case 'open-overview':          return openOptions('#linkage');
    case 'open-drop':
      if (!LIVE) { location.hash = '#delete'; return; }
      api.tabs.create({ url: api.runtime.getURL('options/drop.html') });
      window.close();
      return;

    case 'rotate':
      $('rotate').scrollIntoView({ block: 'nearest' });
      $('rotate').focus();
      return;

    case 'share-report': {
      const d = $('share-panel');
      d.open = true;
      d.scrollIntoView({ block: 'nearest' });
      return;
    }

    case 'rerun':
      if (LIVE && Number.isInteger(state?.tabId)) {
        await api.tabs.reload(state.tabId);
        window.close();
      }
      return;

    default:
      return;
  }
}

function renderPersona(s, enabled) {
  const p = s.persona;
  if (!p) {
    $('persona-id').textContent = 'none';
    for (const k of ['p-system', 'p-gpu', 'p-cpu', 'p-screen']) $(k).textContent = '—';
    return;
  }
  $('persona-id').textContent = p.id;
  $('p-system').textContent = prettySystem(p);
  $('p-gpu').textContent = prettyGpu(p.gpu?.renderer);
  $('p-cpu').textContent = `${p.cores} cores · ${p.memory} GB`;
  $('p-screen').textContent = prettyScreen(p.screen);

  $('persona').style.opacity = enabled ? '' : '.5';
  const note = document.querySelector('.persona + .note');
  if (note) {
    note.textContent = enabled
      ? 'This profile stays the same for this site until you rotate it. Every other site gets a different one, which is what breaks the join between them.'
      : 'Nullecho is off here, so this site sees your real device. This is the profile it would see if you turned Nullecho back on.';
  }
}

function renderTrackers(s) {
  const list = s.stats?.trackers ?? [];
  const live = s.live;
  const panel = $('trackers-panel');
  const ul = $('trackers');
  const note = $('trackers-note');
  ul.replaceChildren();

  if (list.length) {
    $('trackers-summary').textContent = `Blocked domains (${list.length})`;
    for (const { domain, count } of list) ul.append(row(domain, count));
    note.textContent = '';
    panel.hidden = false;
    return;
  }

  if (live && live.total > 0) {
    // Packed Chrome build: getMatchedRules() gives ruleset + count but no URLs.
    // `live.total` counts blocking rules only — see classifyMatchedRule().
    $('trackers-summary').textContent = `Blocked in this tab (${live.total})`;
    for (const [cat, n] of Object.entries(live.byCategory)) {
      ul.append(row(CATEGORY_LABELS[cat] ?? cat, n));
    }
    note.textContent =
      'Chrome only reports the individual blocked URLs to unpacked (developer) builds, so this is a per-category count for the current tab, not a domain list.';
    panel.hidden = false;
    return;
  }

  panel.hidden = true;
}

/**
 * Domains the heuristic yellowlist let through with their cookies removed. Kept
 * out of "Blocked domains" on purpose: these requests were answered, and the
 * copy rules only allow a count to say what it literally is.
 */
function renderCookiesStripped(s) {
  const list = s.stats?.cookieTrackers ?? [];
  const total = s.stats?.cookieStripped ?? 0;
  const panel = $('cookies-panel');
  const ul = $('cookies-list');
  ul.replaceChildren();

  if (!total) { panel.hidden = true; return; }

  $('cookies-summary').textContent = `Cookies stripped (${nf.format(total)})`;
  // Packed builds have the count but no per-domain URLs; show the count alone.
  for (const { domain, count } of list) ul.append(row(domain, count));
  panel.hidden = false;
}

function renderFingerprintReads(s) {
  const byApi = Object.entries(s.stats?.fpByApi ?? {}).sort((a, b) => b[1] - a[1]);
  const panel = $('fp-panel');
  const ul = $('fp-list');
  ul.replaceChildren();
  if (!byApi.length) { panel.hidden = true; return; }
  $('fp-summary').textContent = `Fingerprinting reads (${byApi.length} surfaces)`;
  for (const [name, n] of byApi) ul.append(row(apiLabel(name), n));
  panel.hidden = false;
}

function row(label, count) {
  const li = document.createElement('li');
  const a = document.createElement('span');
  a.className = 'd';
  a.textContent = label;
  a.title = label;
  const b = document.createElement('span');
  b.className = 'c';
  b.textContent = nf.format(count);
  li.append(a, b);
  return li;
}

function renderAlerts(s, enabled) {
  const box = $('alerts');
  box.replaceChildren();

  const add = (html, kind = 'warn') => {
    const d = document.createElement('div');
    d.className = `alert ${kind === 'info' ? 'info' : ''}`.trim();
    d.append(...html);
    box.append(d);
  };

  if (pendingReload) {
    add([txt('Reload this page for the change to take effect.')], 'info');
  }

  if (!enabled) {
    add([b('Nullecho is off for this site.'), txt(' Blocking and the device shim are disabled here.')], 'info');
  }

  const st = s.stats?.lastShimStatus;
  if (enabled && st?.reason === 'shim-never-booted') {
    add([
      b('The device shim did not start on this page.'),
      txt(' Fingerprinting APIs were not patched here. Blocking still applied.'),
    ]);
  } else if (enabled && st?.lockedToFallback) {
    add([
      b('Profile not rotated on this load.'),
      txt(' This page read device APIs before your rotated profile arrived, so it saw the fallback profile. It is still consistent and still different from other sites — but “New identity” will not change what this page already saw.'),
    ]);
  }

  if (enabled && Array.isArray(s.stats?.patchFailures) && s.stats.patchFailures.length) {
    add([
      b('Some device APIs could not be patched on this page.'),
      txt(' The device shim reported: ' + s.stats.patchFailures.join(', ') + '. Those APIs are not protected here. Please report this — a silently unpatched API is the failure Nullecho most wants to hear about.'),
    ]);
  }

  // Measured, not inferred: shim-loader.js checks from the extension's own world
  // — which the page cannot reach into — whether page script had already run when
  // the device shim started. If it had, the shim started too late to be sure it
  // patched anything before the page looked, and too late for its handshake to be
  // private. Say so rather than showing a clean panel.
  if (enabled && s.stats?.nonceExposedAt) {
    add([
      b('The device shim started late on this page.'),
      txt(' The browser ran page code before Nullecho’s device shim, so this page may have read real device values before they were replaced. Blocking still applied. This is a known browser-level timing problem, not a setting you can change.'),
    ]);
  }
}

const txt = (t) => document.createTextNode(t);
const b = (t) => { const e = document.createElement('b'); e.textContent = t; return e; };

function relTime(ts) {
  if (!ts) return 'never';
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

// ── interactions ────────────────────────────────────────────────────────────

$('site-toggle').addEventListener('change', async (e) => {
  const enabled = e.target.checked;
  $('site-toggle-label').textContent = enabled ? 'On' : 'Off';
  if (!LIVE) { state.enabled = enabled; pendingReload = true; render(state); return; }
  await sendMessage({ type: MSG.SET_SITE_ENABLED, site: state.site, enabled });
  pendingReload = true;
  render({ ...state, enabled });
});

$('rotate').addEventListener('click', async () => {
  const btn = $('rotate');

  // Two-step. Rotating re-rolls every site at once and can force re-authentication,
  // so it should not be a single stray click.
  if (!rotateArmed) {
    rotateArmed = true;
    btn.textContent = 'Confirm — re-roll every site';
    btn.classList.remove('primary');
    rotateTimer = setTimeout(() => {
      rotateArmed = false;
      btn.textContent = 'New identity';
      btn.classList.add('primary');
    }, 5000);
    return;
  }

  clearTimeout(rotateTimer);
  rotateArmed = false;
  btn.disabled = true;
  btn.textContent = 'Rotating…';

  let identity = state.identity;
  if (LIVE) {
    const res = await sendMessage({ type: MSG.ROTATE_SALT });
    if (res?.ok) identity = res.identity;
    const fresh = await load();
    state = { ...fresh, identity: identity ?? fresh.identity };
  } else {
    identity = { tag: randTag(), rotatedAt: Date.now() };
    state = { ...state, identity, persona: DEMO_ALT_PERSONA };
  }

  pendingReload = true;
  render(state);
  btn.disabled = false;
  btn.textContent = 'New identity';
  btn.classList.add('primary');
});

$('copy-report').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  // Copy the text that is on screen, not a freshly generated one. If the two
  // could differ, the "check it before you post it" promise above would be a lie.
  const text = $('share-text').textContent;
  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch {
    // Clipboard API needs a secure context and can be blocked by policy. Fall
    // back to selecting the text so the user can copy it by hand rather than
    // being told nothing happened.
    const range = document.createRange();
    range.selectNodeContents($('share-text'));
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
  btn.textContent = ok ? 'Copied' : 'Select and press ⌘C';
  setTimeout(() => { btn.textContent = 'Copy report'; }, 2200);
});

$('open-options').addEventListener('click', (e) => {
  e.preventDefault();
  if (!LIVE) return;
  if (api.runtime.openOptionsPage) api.runtime.openOptionsPage();
  else api.tabs.create({ url: api.runtime.getURL('options/options.html') });
  window.close();
});

$('open-limits').addEventListener('click', (e) => {
  e.preventDefault();
  if (!LIVE) { location.hash = '#limits'; return; }
  api.tabs.create({ url: api.runtime.getURL('options/options.html#limits') });
  window.close();
});

// ── demo fixture ────────────────────────────────────────────────────────────
// Lets `popup.html` be opened directly (static server, screenshot, design review)
// without a live service worker. Never reachable inside the packed extension:
// `api.runtime.id` is always set there.

const randTag = () =>
  Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0').toUpperCase();

const DEMO_ALT_PERSONA = {
  id: 'macos-chrome-m1',
  os: 'macos-14',
  ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
  gpu: { renderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)' },
  cores: 8,
  memory: 8,
  screen: { width: 1440, height: 900, dpr: 2, colorDepth: 24 },
};

const DEMO = {
  ok: true,
  site: 'theguardian.com',
  enabled: true,
  tabUrl: 'https://www.theguardian.com/international',
  identity: { tag: 'A7F3C1', rotatedAt: Date.now() - 1000 * 60 * 260 },
  settings: { gpc: true, isCalifornian: true, dropFiled: false },
  gpc: { sent: true, excepted: false },
  strictFingerprinting: false,
  /**
   * owner → how many of the user's own sites that company also appeared on.
   * Company names and counts only — no origins. This is what the LOCAL reach
   * finding is built from, and `siteShareText()` drops that finding entirely.
   */
  crossSiteReach: {
    Google: 34,
    Meta: 19,
    Criteo: 7,
    'Microsoft (Xandr)': 6,
    Comscore: 5,
    Adobe: 3,
    Quantcast: 3,
    FingerprintJS: 2,
  },
  persona: {
    id: 'win11-chrome-rtx3060',
    os: 'windows-11',
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
    gpu: { renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
    cores: 12,
    memory: 8,
    screen: { width: 1920, height: 1080, dpr: 1, colorDepth: 24 },
  },
  stats: {
    blocked: 53,
    fp: 9,
    fpByApi: { canvas: 4, webgl: 3, audio: 1, fonts: 1 },
    byCategory: { ads: 28, analytics: 12, social: 5, fingerprinting: 2, heuristic: 6, 'heuristic-cookie': 4 },
    cookieStripped: 4,
    cookieTrackers: [
      { domain: 'youtube.com', count: 2 },
      { domain: 'intercom.io', count: 2 },
    ],
    lastShimStatus: { upgraded: true, lockedToFallback: false, reason: null },
    trackers: [
      { domain: 'doubleclick.net', count: 11 },
      { domain: 'google-analytics.com', count: 8 },
      { domain: 'scorecardresearch.com', count: 6 },
      { domain: 'facebook.net', count: 5 },
      { domain: 'criteo.com', count: 5 },
      { domain: 'permutive.com', count: 4 },
      { domain: 'adnxs.com', count: 4 },
      { domain: 'fingerprintjs.com', count: 2 },
      { domain: 'quantserve.com', count: 2 },
      { domain: 'trackingsaas.example', count: 6 },
    ],
    trackerListComplete: true,
  },
  live: null,
};

// ── boot ────────────────────────────────────────────────────────────────────

load().then(render).catch((err) => {
  console.error('[nullecho] popup failed to load', err);
  $('wrap').hidden = false;
  $('main').hidden = true;
  $('inert').hidden = false;
  $('inert-copy').textContent = 'Nullecho could not read its own state. Try reopening the popup.';
});
