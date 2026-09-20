/**
 * Nullecho — options / dashboard controller.
 *
 * Like the popup, this page can be opened directly from a static server for
 * design review; it falls back to a fixture when there is no service worker.
 */

import { MSG, CATEGORY_LABELS } from '../src/protocol.js';
import {
  buildLinkageGraph,
  headline as linkageHeadline,
  shareCard,
  exposureScore,
  remedyFor,
} from '../src/linkage.js';

const api = globalThis.chrome ?? globalThis.browser;
const LIVE = !!api?.runtime?.id;

const $ = (id) => document.getElementById(id);
const nf = new Intl.NumberFormat();

const CATEGORY_BLURB = {
  ads: 'Ad exchanges, bidders and creative delivery.',
  analytics: 'Page-view, session-replay and product-telemetry endpoints.',
  social: 'Share buttons, embeds and conversion pixels.',
  fingerprinting: 'Scripts whose main job is identifying the device.',
};

let state = null;
let rotateArmed = false;
let rotateTimer = null;

// ── plumbing ────────────────────────────────────────────────────────────────

function sendMessage(msg) {
  if (!LIVE) return Promise.resolve({ ok: false, error: 'not running as an extension' });
  return new Promise((resolve) => {
    api.runtime.sendMessage(msg, (res) => {
      void api.runtime.lastError;
      resolve(res ?? { ok: false, error: 'no response' });
    });
  });
}

async function loadOverview() {
  if (!LIVE) return DEMO;
  const res = await sendMessage({ type: MSG.GET_OVERVIEW });
  return res?.ok ? res : DEMO_EMPTY;
}

let toastTimer = null;
function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}

async function patchSettings(patch) {
  state.settings = {
    ...state.settings,
    ...patch,
    categories: { ...state.settings.categories, ...(patch.categories ?? {}) },
  };
  await sendMessage({ type: MSG.SET_SETTINGS, patch });
  toast('Saved. Reload open tabs to apply.');
}

// ── render ──────────────────────────────────────────────────────────────────

function render(s) {
  state = s;

  const version = LIVE ? api.runtime.getManifest().version : '0.1.0';
  $('ver').textContent = `v${version}`;
  $('ver-foot').textContent = `v${version}`;

  $('t-blocked').textContent = nf.format(s.totals?.blocked ?? 0);
  $('t-fp').textContent = nf.format(s.totals?.fp ?? 0);
  $('t-sites').textContent = nf.format(s.totals?.sites ?? 0);

  renderIdentity(s);
  renderLinkage(s);
  renderCategories(s);
  renderSites(s);
  renderAllowlist(s);
  renderPool(s);

  $('gpc').checked = !!s.settings.gpc;
  $('is-californian').checked = !!s.settings.isCalifornian;
  $('loud-failures').checked = !!s.settings.loudFailures;
  $('auto-rotate').value = String(s.settings.autoRotateDays ?? 0);

  if (LIVE) $('drop-link').href = api.runtime.getURL('options/drop.html');
}

function renderIdentity(s) {
  $('id-tag').textContent = s.identity?.tag ?? '—';
  $('id-rotated').textContent = s.identity?.rotatedAt
    ? `rotated ${relTime(s.identity.rotatedAt)}`
    : 'never rotated';
}

// ── cross-site aggregate ────────────────────────────────────────────────────
//
// Built here, in the page, from the per-site tracker lists the worker sends —
// rather than being handed a finished graph — so what renders on this page is
// `linkage.js` actually running, not a fixture shaped like its output.
//
// This view names the user's own origins, which is precisely why it lives on a
// local settings page behind a "stays on this device" banner and never leaves.
// The shareable artifact is the per-site report in the popup.

/** Latest computed graph, kept so the remedy button can act on it. */
let graph = null;

function renderLinkage(s) {
  const sites = Object.fromEntries(
    (s.sites ?? []).map((row) => [row.site, { trackers: row.trackers ?? [] }]),
  );
  graph = buildLinkageGraph(sites);

  $('lk-exposure').textContent = String(exposureScore(graph));
  $('lk-exposure').append(Object.assign(document.createElement('span'), {
    className: 'pct', textContent: '%',
  }));
  $('lk-linkers').textContent = nf.format(graph.linkers.length);
  $('lk-headline').textContent = linkageHeadline(graph);

  renderLinkers(graph);
  renderLinkageRemedy(s, graph);

  // The counts-and-companies version, shown so the difference between "private
  // evidence" and "shareable artifact" is a thing you can see rather than a
  // claim in a doc.
  const card = shareCard(graph);
  $('lk-share-text').textContent = card
    ? [
        card.headline,
        `${card.stat}. Exposure ${card.exposure}%.`,
        `Companies: ${card.companies.map((c) => `${c.owner} (${c.reach})`).join(', ')}.`,
        '',
        'Presence, not correlation — whether any of them joined those visits happens on their servers.',
        'Measured with Nullecho.',
      ].join('\n')
    : 'Nothing to share yet — no company has turned up on two of your sites.';
}

function renderLinkers(g) {
  const body = $('linkers-body');
  body.replaceChildren();
  $('linkers-empty').hidden = g.linkers.length > 0;

  for (const l of g.linkers) {
    const tr = document.createElement('tr');

    const name = document.createElement('td');
    name.textContent = l.owner;

    const domains = document.createElement('td');
    const dspan = document.createElement('span');
    dspan.className = 'lk-domains';
    dspan.textContent = l.domains.join(' · ');
    dspan.title = l.domains.join('\n');
    domains.append(dspan);

    // The sites are the concrete, convincing part — "your bank and that health
    // forum" lands in a way "34 sites" does not — so they are here, collapsed,
    // and they never reach the share card.
    const where = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = `which ${l.reach} sites`;
    const list = document.createElement('p');
    list.className = 'lk-sites';
    list.textContent = l.sites.join(', ');
    where.append(summary, list);
    domains.append(where);

    tr.append(
      name,
      domains,
      td(nf.format(l.reach), 'n'),
      td(`${l.reachPct}%`, 'n'),
      td(nf.format(l.couldLinkPairs), 'n'),
    );
    body.append(tr);
  }
}

function renderLinkageRemedy(s, g) {
  const remedy = remedyFor(g, {
    blockingEnabled: Object.values(s.settings?.categories ?? {}).some(Boolean),
    gpcEnabled: !!s.settings?.gpc,
    isCalifornian: !!s.settings?.isCalifornian,
    dropFiled: !!s.settings?.dropFiled,
  });

  $('lk-remedy').textContent = remedy.text;
  const btn = $('lk-remedy-btn');
  btn.hidden = !remedy.action;
  if (!remedy.action) return;

  const LABELS = {
    'enable-blocking': 'Turn blocking on',
    'enable-gpc': 'Send GPC',
    'open-drop': 'Open the deletion walkthrough',
    rerun: 'Reload this page',
  };
  btn.textContent = LABELS[remedy.action] ?? 'Do it';
  btn.onclick = () => runLinkageRemedy(remedy.action);
}

async function runLinkageRemedy(action) {
  switch (action) {
    case 'enable-blocking':
      await patchSettings({
        categories: { ads: true, analytics: true, social: true, fingerprinting: true },
      });
      render(await loadOverview());
      return;
    case 'enable-gpc':
      await patchSettings({ gpc: true });
      render(await loadOverview());
      return;
    case 'open-drop':
      location.href = LIVE ? api.runtime.getURL('options/drop.html') : 'drop.html';
      return;
    case 'rerun':
      location.reload();
      return;
    default:
      return;
  }
}

function renderCategories(s) {
  const box = $('category-toggles');
  box.replaceChildren();
  for (const key of ['ads', 'analytics', 'social', 'fingerprinting']) {
    const row = document.createElement('div');
    row.className = 'toggle-row';

    const meta = document.createElement('div');
    meta.className = 'meta';
    const t = document.createElement('span');
    t.className = 't';
    t.textContent = CATEGORY_LABELS[key];
    const sub = document.createElement('span');
    sub.className = 's';
    sub.textContent = CATEGORY_BLURB[key];
    meta.append(t, sub);

    const label = document.createElement('label');
    label.className = 'switch';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!s.settings.categories[key];
    input.addEventListener('change', () =>
      patchSettings({ categories: { [key]: input.checked } })
    );
    const track = document.createElement('span');
    track.className = 'track';
    track.setAttribute('aria-hidden', 'true');
    const thumb = document.createElement('span');
    thumb.className = 'thumb';
    track.append(thumb);
    label.append(input, track);

    row.append(meta, label);
    box.append(row);
  }
}

function renderSites(s) {
  const body = $('sites-body');
  body.replaceChildren();
  const rows = s.sites ?? [];
  $('sites-empty').hidden = rows.length > 0;

  for (const r of rows) {
    const tr = document.createElement('tr');
    if (!r.enabled) tr.className = 'off';

    tr.append(
      td(r.site, 'm'),
      tdPersona(r.persona),
      td(nf.format(r.blocked ?? 0), 'n'),
      td(nf.format(r.fp ?? 0), 'n'),
      td(relTime(r.lastSeen), 'dim'),
      tdToggle(r)
    );
    body.append(tr);
  }
}

function td(text, cls = '') {
  const e = document.createElement('td');
  if (cls) e.className = cls;
  e.textContent = text;
  return e;
}

function tdPersona(p) {
  const e = document.createElement('td');
  if (!p) { e.textContent = '—'; return e; }
  const pill = document.createElement('span');
  pill.className = 'pill';
  pill.textContent = p.id;
  pill.title = `${p.platform} · ${p.gpu} · ${p.cores} cores · ${p.memory} GB`;
  e.append(pill);
  return e;
}

function tdToggle(r) {
  const e = document.createElement('td');
  e.className = 'c';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn tiny';
  btn.textContent = r.enabled ? 'On' : 'Off';
  btn.addEventListener('click', async () => {
    await sendMessage({ type: MSG.SET_SITE_ENABLED, site: r.site, enabled: !r.enabled });
    render(await loadOverview());
    toast(r.enabled ? `Nullecho turned off on ${r.site}` : `Nullecho turned back on for ${r.site}`);
  });
  e.append(btn);
  return e;
}

function renderAllowlist(s) {
  const ul = $('allow-chips');
  ul.replaceChildren();
  const list = s.allowlist ?? [];
  $('allow-empty').hidden = list.length > 0;

  for (const domain of list) {
    const li = document.createElement('li');
    li.append(document.createTextNode(domain));
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = `Turn Nullecho back on for ${domain}`;
    btn.setAttribute('aria-label', `Turn Nullecho back on for ${domain}`);
    btn.textContent = '×';
    btn.addEventListener('click', async () => {
      await sendMessage({ type: MSG.SET_SITE_ENABLED, site: domain, enabled: true });
      render(await loadOverview());
      toast(`Nullecho turned back on for ${domain}`);
    });
    li.append(btn);
    ul.append(li);
  }
}

function renderPool(s) {
  const body = $('pool-body');
  body.replaceChildren();
  for (const p of s.pool ?? []) {
    const tr = document.createElement('tr');
    const idCell = document.createElement('td');
    const pill = document.createElement('span');
    pill.className = 'pill';
    pill.textContent = p.id;
    idCell.append(pill);
    tr.append(
      idCell,
      td(p.platform, 'm'),
      td(prettyGpu(p.gpu), 'm'),
      td(String(p.cores), 'n'),
      td(`${p.memory} GB`, 'n'),
      td(p.screen, 'm'),
      td(String(p.weight), 'n')
    );
    body.append(tr);
  }
}

function prettyGpu(renderer = '') {
  const angle = /^ANGLE \(([^,]+),\s*(.+?)(?:\s+Direct3D11.*|,\s*(?:OpenGL|Unspecified|ANGLE).*)?\)$/.exec(renderer);
  if (!angle) return renderer;
  return angle[2].replace(/\s*\(0x[0-9A-Fa-f]+\)/, '').replace(/^ANGLE Metal Renderer:\s*/, '').trim() || renderer;
}

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

$('gpc').addEventListener('change', (e) => patchSettings({ gpc: e.target.checked }));
// User-declared, never inferred: the DROP walkthrough is California-only, and
// until this control existed `isCalifornian` was read in three places and
// written in exactly one — popup.js's DEMO fixture (review 2026-09-19).
$('is-californian').addEventListener('change', (e) => patchSettings({ isCalifornian: e.target.checked }));
$('loud-failures').addEventListener('change', (e) => patchSettings({ loudFailures: e.target.checked }));
$('auto-rotate').addEventListener('change', (e) =>
  patchSettings({ autoRotateDays: Number(e.target.value) })
);

$('rotate').addEventListener('click', async () => {
  const btn = $('rotate');
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

  await sendMessage({ type: MSG.ROTATE_SALT });
  render(await loadOverview());

  btn.disabled = false;
  btn.textContent = 'New identity';
  btn.classList.add('primary');
  toast('New identity. Reload open tabs to apply.');
});

$('clear-stats').addEventListener('click', async () => {
  await sendMessage({ type: MSG.CLEAR_STATS });
  render(await loadOverview());
  toast('Site history cleared.');
});

$('allow-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const raw = $('allow-input').value.trim();
  if (!raw) return;
  // Accept a pasted URL or a bare domain.
  let domain = raw;
  try { if (/^https?:\/\//i.test(raw)) domain = new URL(raw).hostname; } catch { /* keep raw */ }
  domain = domain.replace(/^www\./i, '').toLowerCase();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain) && domain !== 'localhost') {
    toast('That does not look like a domain.');
    return;
  }
  await sendMessage({ type: MSG.SET_SITE_ENABLED, site: domain, enabled: false });
  $('allow-input').value = '';
  render(await loadOverview());
  toast(`Nullecho turned off on ${domain}`);
});

// ── demo fixtures (static-server / design-review only) ──────────────────────

const DEMO_SETTINGS = {
  categories: { ads: true, analytics: true, social: true, fingerprinting: true },
  gpc: true,
  isCalifornian: false,
  autoRotateDays: 0,
  loudFailures: true,
};

const POOL = [
  { id: 'win11-chrome-uhd620', platform: 'Win32', weight: 30, cores: 8, memory: 8, screen: '1920×1080 @1x', gpu: 'ANGLE (Intel, Intel(R) UHD Graphics 620 (0x00003EA0) Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { id: 'win11-chrome-rtx3060', platform: 'Win32', weight: 22, cores: 12, memory: 8, screen: '1920×1080 @1x', gpu: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { id: 'win11-chrome-amd-vega', platform: 'Win32', weight: 12, cores: 8, memory: 8, screen: '1366×768 @1x', gpu: 'ANGLE (AMD, AMD Radeon(TM) Vega 8 Graphics (0x000015D8) Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { id: 'macos-chrome-m1', platform: 'MacIntel', weight: 18, cores: 8, memory: 8, screen: '1440×900 @2x', gpu: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)' },
  { id: 'macos-chrome-m2-air', platform: 'MacIntel', weight: 10, cores: 8, memory: 16, screen: '1470×956 @2x', gpu: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)' },
  { id: 'linux-chrome-mesa', platform: 'Linux x86_64', weight: 8, cores: 8, memory: 8, screen: '1920×1080 @1x', gpu: 'ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 (KBL GT2), OpenGL 4.6)' },
];

const p = (id, platform, gpu, cores = 8, memory = 8) => ({ id, platform, gpu, cores, memory, os: '' });
const min = 60000;

/** Tracker domains per demo site — what the aggregate view is actually built from. */
const T = {
  guardian: ['doubleclick.net', 'google-analytics.com', 'facebook.net', 'criteo.com',
             'scorecardresearch.com', 'permutive.com', 'adnxs.com', 'quantserve.com'],
  hn: [],
  reddit: ['doubleclick.net', 'googletagmanager.com', 'facebook.net', 'adnxs.com',
           'branch.io', 'amazon-adsystem.com'],
  nyt: ['doubleclick.net', 'google-analytics.com', 'facebook.net', 'demdex.net',
        'chartbeat.com', 'criteo.com', 'adsrvr.org', 'scorecardresearch.com'],
  bank: [],
  wikipedia: [],
  stackoverflow: ['googletagmanager.com', 'google-analytics.com', 'clarity.ms',
                  'adsrvr.org', 'demdex.net'],
};

const DEMO = {
  ok: true,
  settings: DEMO_SETTINGS,
  allowlist: ['my-bank.example', 'intranet.example'],
  identity: { tag: 'A7F3C1', rotatedAt: Date.now() - 260 * min },
  pool: POOL,
  totals: { blocked: 1284, fp: 63, sites: 7 },
  sites: [
    { site: 'theguardian.com', blocked: 47, fp: 9, lastSeen: Date.now() - 1 * min, enabled: true,  persona: p('win11-chrome-rtx3060', 'Win32', 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)', 12), trackers: T.guardian },
    { site: 'news.ycombinator.com', blocked: 0, fp: 0, lastSeen: Date.now() - 12 * min, enabled: true, persona: p('linux-chrome-mesa', 'Linux x86_64', 'ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 (KBL GT2), OpenGL 4.6)'), trackers: T.hn },
    { site: 'reddit.com', blocked: 312, fp: 21, lastSeen: Date.now() - 41 * min, enabled: true, persona: p('win11-chrome-uhd620', 'Win32', 'ANGLE (Intel, Intel(R) UHD Graphics 620 (0x00003EA0) Direct3D11 vs_5_0 ps_5_0, D3D11)'), trackers: T.reddit },
    { site: 'nytimes.com', blocked: 508, fp: 17, lastSeen: Date.now() - 3 * 60 * min, enabled: true, persona: p('macos-chrome-m1', 'MacIntel', 'ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)'), trackers: T.nyt },
    { site: 'my-bank.example', blocked: 0, fp: 0, lastSeen: Date.now() - 5 * 60 * min, enabled: false, persona: p('macos-chrome-m2-air', 'MacIntel', 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)'), trackers: T.bank },
    { site: 'wikipedia.org', blocked: 0, fp: 1, lastSeen: Date.now() - 26 * 60 * min, enabled: true, persona: p('win11-chrome-amd-vega', 'Win32', 'ANGLE (AMD, AMD Radeon(TM) Vega 8 Graphics (0x000015D8) Direct3D11 vs_5_0 ps_5_0, D3D11)'), trackers: T.wikipedia },
    { site: 'stackoverflow.com', blocked: 417, fp: 15, lastSeen: Date.now() - 30 * 60 * min, enabled: true, persona: p('win11-chrome-rtx3060', 'Win32', 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)', 12), trackers: T.stackoverflow },
  ],
};

const DEMO_EMPTY = {
  ok: true,
  settings: DEMO_SETTINGS,
  allowlist: [],
  identity: { tag: '——————', rotatedAt: 0 },
  pool: POOL,
  totals: { blocked: 0, fp: 0, sites: 0 },
  sites: [],
};

// ── boot ────────────────────────────────────────────────────────────────────

loadOverview().then(render).catch((err) => {
  console.error('[nullecho] options failed to load', err);
  render(DEMO_EMPTY);
});
