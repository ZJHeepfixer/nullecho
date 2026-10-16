#!/usr/bin/env node
/**
 * Nullecho for Safari — push the App Store listing through the App Store Connect API.
 *
 *   node safari/tools/asc-listing.mjs --plan              # what would be sent; read-only GETs for the record and ids
 *   node safari/tools/asc-listing.mjs --plan --offline    # the same with no network at all (tests, review)
 *   node safari/tools/asc-listing.mjs --apply             # do it (idempotent PATCHes; never deletes anything)
 *
 * Source of truth: safari/store/listing.json, which safari/test/listing.test.mjs holds byte-equal to the code
 * blocks in safari/STORE-LISTING.md. The app record itself, the four in-app purchases and the Paid Apps
 * agreement are the owner's steps (his script A); this tool starts only once GET /v1/apps finds the bundle id.
 *
 * Credentials come from the environment, never from this file or the repo:
 *   ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH (the .p8)            — same names as archive-testflight.sh
 *   ASC_REVIEW_CONTACT_JSON (optional, normally unset: the owner types the review contact in App Store Connect, director 2026-10-15)
 *
 * The API shapes (JWT, appInfos/categories, appInfoLocalizations, appStoreVersions, appStoreVersionLocalizations,
 * ageRatingDeclarations with the unknown-attribute retry, appStoreReviewDetails, appScreenshotSets with the
 * reserve → PUT parts → PATCH md5 → poll COMPLETE cycle, appPriceSchedules) are the ones the owner's other apps
 * shipped with (~/ios-signing/oh-auto-setup-listing.js, oh-auto-upload-screens.mjs, oh-set-app-price.js). Not
 * proven here: the screenshot display-type names for the 2026 size classes, and adding a MAC_OS version to an
 * iOS record. The API answers both at apply time (a 409/422 names the attribute), and --apply stops on the
 * first error with the step named, so nothing half-done goes unnoticed. Availability (EU trader status) and the
 * App Privacy label have no usable API here and stay in App Store Connect for the owner.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, '../..');
export const LISTING_FILE = path.join(REPO, 'safari', 'store', 'listing.json');
export const STORE_DIR = path.join(REPO, 'safari', 'store');
const API = 'https://api.appstoreconnect.apple.com';

export const LIMITS = { subtitle: 30, promotionalText: 170, keywordsBytes: 100, description: 4000, notesBytes: 4000, whatsNew: 4000, copyright: 200 };

// ── listing file ──────────────────────────────────────────────────────────────

export function loadListing(file = LISTING_FILE) {
  const l = JSON.parse(fs.readFileSync(file, 'utf8'));
  const problems = [];
  const v = l.version;
  if (l.app.subtitle.length > LIMITS.subtitle) problems.push(`subtitle ${l.app.subtitle.length} > ${LIMITS.subtitle}`);
  if (v.promotionalText.length > LIMITS.promotionalText) problems.push(`promotionalText ${v.promotionalText.length} > ${LIMITS.promotionalText}`);
  if (Buffer.byteLength(v.keywords) > LIMITS.keywordsBytes) problems.push(`keywords ${Buffer.byteLength(v.keywords)} bytes > ${LIMITS.keywordsBytes}`);
  if (v.description.length > LIMITS.description) problems.push(`description ${v.description.length} > ${LIMITS.description}`);
  if (Buffer.byteLength(l.review.notes) > LIMITS.notesBytes) problems.push(`review notes ${Buffer.byteLength(l.review.notes)} bytes > ${LIMITS.notesBytes}`);
  if (/\s,|,\s/.test(v.keywords)) problems.push('keywords: no spaces around commas');
  if (new RegExp(`\\b${l.app.name}\\b`, 'i').test(v.keywords)) problems.push('keywords repeat the app name');
  for (const set of l.screenshots) {
    for (const f of set.files) {
      const p = path.join(STORE_DIR, f);
      if (!fs.existsSync(p)) { problems.push(`screenshot missing: ${f}`); continue; }
      const dim = imageSize(p);
      if (!dim) problems.push(`${f}: not a PNG/JPEG I can read`);
      else if (dim.width !== set.size[0] || dim.height !== set.size[1]) problems.push(`${f}: ${dim.width}×${dim.height}, set expects ${set.size[0]}×${set.size[1]}`);
      else if (dim.alpha) problems.push(`${f}: has an alpha channel (App Store Connect rejects transparency)`);
    }
  }
  if (problems.length) throw new Error(`listing.json: ${problems.join('; ')}`);
  return l;
}

/** PNG (IHDR) or JPEG (SOF) dimensions; `alpha` is true for PNG colour types 4/6. */
export function imageSize(file) {
  const b = fs.readFileSync(file);
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) {
    return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), alpha: [4, 6].includes(b[25]) };
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      const len = b.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5), alpha: false };
      }
      i += 2 + len;
    }
  }
  return null;
}

// ── API client (ES256 JWT, no dependencies) ───────────────────────────────────

function credentials() {
  const keyId = process.env.ASC_KEY_ID, issuer = process.env.ASC_ISSUER_ID, keyPath = process.env.ASC_KEY_PATH;
  const missing = [['ASC_KEY_ID', keyId], ['ASC_ISSUER_ID', issuer], ['ASC_KEY_PATH', keyPath]].filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) throw new Error(`missing in the environment: ${missing.join(', ')} (never put them in the repo)`);
  if (!fs.existsSync(keyPath)) throw new Error(`ASC_KEY_PATH does not exist`);
  return { keyId, issuer, key: fs.readFileSync(keyPath) };
}
const b64url = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function token(c) {
  const now = Math.floor(Date.now() / 1000);
  const h = b64url(JSON.stringify({ alg: 'ES256', kid: c.keyId, typ: 'JWT' }));
  const p = b64url(JSON.stringify({ iss: c.issuer, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' }));
  const s = crypto.createSign('SHA256'); s.update(`${h}.${p}`);
  return `${h}.${p}.${b64url(s.sign({ key: c.key, dsaEncoding: 'ieee-p1363' }))}`;
}
function client(c) {
  return async function api(method, p, body) {
    const res = await fetch(p.startsWith('http') ? p : API + p, {
      method, headers: { Authorization: `Bearer ${token(c)}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json; try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
    if (!res.ok) { const e = new Error(`${method} ${p.slice(0, 100)} -> HTTP ${res.status} ${text.slice(0, 500)}`); e.status = res.status; e.body = json; throw e; }
    return json;
  };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── the steps ─────────────────────────────────────────────────────────────────

/** Human-readable plan: every step, its payload summary, and what is still unverified. */
export function describePlan(l) {
  const v = l.version;
  const lines = [];
  lines.push(`bundle id ${l.bundleId} — the record must exist first (owner's script A); the tool never creates it`);
  lines.push(`1. apps: contentRightsDeclaration = ${l.app.contentRightsDeclaration}`);
  lines.push(`2. appInfos (the in-flight one): primaryCategory ${l.app.primaryCategory}, secondaryCategory ${l.app.secondaryCategory}`);
  lines.push(`3. appInfoLocalizations[${l.primaryLocale}]: name "${l.app.name}" (set by the record; patched only if it differs), subtitle "${l.app.subtitle}" (${l.app.subtitle.length}/${LIMITS.subtitle}), privacyPolicyUrl ${l.app.privacyPolicyUrl}`);
  for (const plat of v.platforms) {
    lines.push(`4.${plat}. appStoreVersions[${plat}]: versionString ${v.versionString}, releaseType ${v.releaseType}, copyright "${v.copyright}"${plat === 'MAC_OS' ? ' (created if the record has no MAC_OS version yet — unverified path, the API decides)' : ''}`);
    lines.push(`5.${plat}. appStoreVersionLocalizations[${l.primaryLocale}]: description ${v.description.length}/${LIMITS.description} chars, keywords ${Buffer.byteLength(v.keywords)}/${LIMITS.keywordsBytes} bytes, promotionalText ${v.promotionalText.length}/${LIMITS.promotionalText}, supportUrl ${v.supportUrl}, marketingUrl ${v.marketingUrl}; whatsNew omitted (first version)`);
    lines.push(`6.${plat}. ageRatingDeclaration: ${Object.keys(l.ageRating).length} attributes, all NONE / false (4+); unknown attributes are dropped on the API's word and reported`);
    lines.push(`7.${plat}. appStoreReviewDetail: demoAccountRequired ${l.review.demoAccountRequired}, notes ${Buffer.byteLength(l.review.notes)}/${LIMITS.notesBytes} bytes (3 paragraphs), contact: the owner types it in App Store Connect${process.env.ASC_REVIEW_CONTACT_JSON ? ' (ASC_REVIEW_CONTACT_JSON is set and will be used instead)' : ''}`);
  }
  for (const set of l.screenshots) {
    const skip = typeof set.status === 'string' && set.status.startsWith('stale');
    lines.push(`8. screenshots ${set.platform} ${set.displayType} (${set.class}): ${set.files.length} file(s) ${set.files.join(', ')}${skip ? ` — SKIPPED: ${set.status}` : ''}${set.displayTypeNote ? ` — ${set.displayTypeNote}` : ''}`);
  }
  lines.push(`9. price: ${l.app.price} (appPriceSchedules, USA base territory, customerPrice 0.0)`);
  lines.push(`10. in-app purchases: read back ${l.inAppPurchases.productIds.length} product ids and report their state (created by the owner, not here)`);
  lines.push(`left in App Store Connect for the owner: availability (${l.app.availability}); App Privacy (${l.app.privacyLabel}); Paid Apps agreement, tax and banking; the submit click`);
  return lines;
}

export async function apply(l, api, log = console.log) {
  const loc = l.primaryLocale;
  const v = l.version;
  const step = (n) => log(`\n== ${n}`);

  step('0. find the record');
  const apps = (await api('GET', `/v1/apps?filter[bundleId]=${encodeURIComponent(l.bundleId)}&fields[apps]=name,bundleId,sku,primaryLocale,contentRightsDeclaration`)).data;
  if (!apps.length) throw new Error(`no app record for ${l.bundleId}: the owner's script A has not run (App IDs registered? record created?)`);
  const app = apps[0];
  log(`app ${app.id} "${app.attributes.name}" sku ${app.attributes.sku ?? '?'} primaryLocale ${app.attributes.primaryLocale ?? '?'}`);

  step('1. content rights');
  await api('PATCH', `/v1/apps/${app.id}`, { data: { type: 'apps', id: app.id, attributes: { contentRightsDeclaration: l.app.contentRightsDeclaration } } });
  log(`contentRightsDeclaration = ${l.app.contentRightsDeclaration}`);

  step('2. categories');
  const infos = (await api('GET', `/v1/apps/${app.id}/appInfos?fields[appInfos]=state`)).data;
  const info = infos.find((i) => i.attributes.state !== 'READY_FOR_DISTRIBUTION') ?? infos[0];
  await api('PATCH', `/v1/appInfos/${info.id}`, { data: { type: 'appInfos', id: info.id, relationships: {
    primaryCategory: { data: { type: 'appCategories', id: l.app.primaryCategory } },
    secondaryCategory: { data: { type: 'appCategories', id: l.app.secondaryCategory } } } } });
  log(`appInfo ${info.id}: ${l.app.primaryCategory} / ${l.app.secondaryCategory}`);

  step('3. app info localization');
  const infoLocs = (await api('GET', `/v1/appInfos/${info.id}/appInfoLocalizations`)).data;
  let infoLoc = infoLocs.find((x) => x.attributes.locale === loc);
  const infoAttrs = { subtitle: l.app.subtitle, privacyPolicyUrl: l.app.privacyPolicyUrl };
  if (!infoLoc) {
    infoLoc = (await api('POST', '/v1/appInfoLocalizations', { data: { type: 'appInfoLocalizations', attributes: { locale: loc, name: l.app.name, ...infoAttrs }, relationships: { appInfo: { data: { type: 'appInfos', id: info.id } } } } })).data;
  } else {
    if (infoLoc.attributes.name !== l.app.name) infoAttrs.name = l.app.name;
    await api('PATCH', `/v1/appInfoLocalizations/${infoLoc.id}`, { data: { type: 'appInfoLocalizations', id: infoLoc.id, attributes: infoAttrs } });
  }
  log(`${loc}: subtitle + privacy policy URL set${infoAttrs.name ? ' + name' : ''}`);

  const versionIds = {};
  for (const plat of v.platforms) {
    step(`4.${plat}. version`);
    let ver = (await api('GET', `/v1/apps/${app.id}/appStoreVersions?filter[platform]=${plat}&fields[appStoreVersions]=versionString,appStoreState,releaseType,platform`)).data[0];
    const attrs = { versionString: v.versionString, releaseType: v.releaseType, copyright: v.copyright };
    if (!ver) {
      ver = (await api('POST', '/v1/appStoreVersions', { data: { type: 'appStoreVersions', attributes: { platform: plat, ...attrs }, relationships: { app: { data: { type: 'apps', id: app.id } } } } })).data;
      log(`created ${plat} version ${ver.id}`);
    } else {
      await api('PATCH', `/v1/appStoreVersions/${ver.id}`, { data: { type: 'appStoreVersions', id: ver.id, attributes: attrs } });
      log(`${plat} version ${ver.id} (${ver.attributes.appStoreState}) → ${v.versionString} ${v.releaseType}`);
    }
    versionIds[plat] = ver.id;

    step(`5.${plat}. version localization`);
    const vlocs = (await api('GET', `/v1/appStoreVersions/${ver.id}/appStoreVersionLocalizations`)).data;
    let vloc = vlocs.find((x) => x.attributes.locale === loc);
    const vattrs = { description: v.description, keywords: v.keywords, promotionalText: v.promotionalText, supportUrl: v.supportUrl, marketingUrl: v.marketingUrl };
    if (!vloc) vloc = (await api('POST', '/v1/appStoreVersionLocalizations', { data: { type: 'appStoreVersionLocalizations', attributes: { locale: loc, ...vattrs }, relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: ver.id } } } } })).data;
    else await api('PATCH', `/v1/appStoreVersionLocalizations/${vloc.id}`, { data: { type: 'appStoreVersionLocalizations', id: vloc.id, attributes: vattrs } });
    log(`${loc} text set (description ${v.description.length} chars, keywords ${Buffer.byteLength(v.keywords)} bytes)`);

    step(`6.${plat}. age rating`);
    const decl = (await api('GET', `/v1/appStoreVersions/${ver.id}/ageRatingDeclaration`)).data;
    const rating = { ...l.ageRating };
    for (let tries = 0; tries < 8; tries++) {
      try { await api('PATCH', `/v1/ageRatingDeclarations/${decl.id}`, { data: { type: 'ageRatingDeclarations', id: decl.id, attributes: rating } }); break; }
      catch (e) {
        const m = /attribute '([A-Za-z]+)'/.exec(e.message) || /'([A-Za-z]+)' is not a valid/.exec(e.message);
        if (m && m[1] in rating) { log(`  API does not know "${m[1]}" — dropped`); delete rating[m[1]]; continue; }
        throw e;
      }
    }
    log(`${Object.keys(rating).length} attributes set`);

    step(`7.${plat}. review details`);
    let rev = null;
    try { rev = (await api('GET', `/v1/appStoreVersions/${ver.id}/appStoreReviewDetail`)).data; } catch (e) { if (e.status !== 404) throw e; }
    const contact = process.env.ASC_REVIEW_CONTACT_JSON ? JSON.parse(process.env.ASC_REVIEW_CONTACT_JSON) : {};
    const revAttrs = { demoAccountRequired: l.review.demoAccountRequired, notes: l.review.notes, ...contact };
    if (rev) await api('PATCH', `/v1/appStoreReviewDetails/${rev.id}`, { data: { type: 'appStoreReviewDetails', id: rev.id, attributes: revAttrs } });
    else await api('POST', '/v1/appStoreReviewDetails', { data: { type: 'appStoreReviewDetails', attributes: revAttrs, relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: ver.id } } } } });
    log(`notes set (${Buffer.byteLength(l.review.notes)} bytes)${Object.keys(contact).length ? ', contact set' : ', contact LEFT EMPTY (owner fills it in App Store Connect)'}`);

    step(`8.${plat}. screenshots`);
    const sets = l.screenshots.filter((s) => s.platform === plat);
    for (const set of sets) {
      if (typeof set.status === 'string' && set.status.startsWith('stale')) { log(`${set.displayType}: SKIPPED — ${set.status}`); continue; }
      await uploadSet(api, vloc.id, set, log);
    }
  }

  step('9. price');
  let next = `/v1/apps/${app.id}/appPricePoints?filter[territory]=USA&limit=200&fields[appPricePoints]=customerPrice,proceeds`, pt;
  while (next && !pt) { const j = await api('GET', next); pt = (j.data || []).find((p) => Number(p.attributes.customerPrice) === 0); next = j.links && j.links.next; }
  if (!pt) throw new Error('no USA price point for 0.0');
  await api('POST', '/v1/appPriceSchedules', { data: { type: 'appPriceSchedules', relationships: { app: { data: { type: 'apps', id: app.id } }, baseTerritory: { data: { type: 'territories', id: 'USA' } },
    manualPrices: { data: [{ type: 'appPrices', id: '${newPrice}' }] } } }, included: [{ type: 'appPrices', id: '${newPrice}', attributes: { startDate: null }, relationships: { appPricePoint: { data: { type: 'appPricePoints', id: pt.id } } } }] });
  log('Free (USA customerPrice 0.0, all territories)');

  step('10. in-app purchases (read back)');
  try {
    const iaps = (await api('GET', `/v1/apps/${app.id}/inAppPurchasesV2?fields[inAppPurchases]=productId,state,inAppPurchaseType&limit=50`)).data;
    for (const id of l.inAppPurchases.productIds) {
      const hit = iaps.find((i) => i.attributes.productId === id);
      log(`${id}: ${hit ? `${hit.attributes.inAppPurchaseType} ${hit.attributes.state}` : 'NOT FOUND (owner\'s script A step)'}`);
    }
  } catch (e) { log(`could not read in-app purchases: ${e.message.slice(0, 160)}`); }

  log(`\nleft for the owner in App Store Connect: availability (EU trader status), App Privacy = Data Not Collected, Paid Apps agreement/tax/banking, the submit click.`);
  return { appId: app.id, versionIds };
}

/** reserve → PUT parts → PATCH uploaded+md5 → assert order → poll COMPLETE. Never deletes; re-uses by fileName. */
async function uploadSet(api, vlocId, set, log) {
  const sets = (await api('GET', `/v1/appStoreVersionLocalizations/${vlocId}/appScreenshotSets`)).data || [];
  let s = sets.find((x) => x.attributes.screenshotDisplayType === set.displayType);
  if (!s) s = (await api('POST', '/v1/appScreenshotSets', { data: { type: 'appScreenshotSets', attributes: { screenshotDisplayType: set.displayType }, relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: vlocId } } } } })).data;
  const list = async () => (await api('GET', `/v1/appScreenshotSets/${s.id}/appScreenshots?limit=50&fields[appScreenshots]=fileName,assetDeliveryState`)).data || [];
  const existing = await list();
  const ids = [];
  for (const f of set.files) {
    const already = existing.find((x) => x.attributes.fileName === f);
    if (already) { log(`${set.displayType}: ${f} already uploaded (${already.id})`); ids.push(already.id); continue; }
    const buf = fs.readFileSync(path.join(STORE_DIR, f));
    const shot = (await api('POST', '/v1/appScreenshots', { data: { type: 'appScreenshots', attributes: { fileName: f, fileSize: buf.length }, relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: s.id } } } } })).data;
    for (const op of shot.attributes.uploadOperations) {
      const headers = {}; for (const h of op.requestHeaders || []) headers[h.name] = h.value;
      const up = await fetch(op.url, { method: op.method, headers, body: buf.subarray(op.offset, op.offset + op.length) });
      if (!up.ok) throw new Error(`upload part failed HTTP ${up.status} for ${f}`);
    }
    await api('PATCH', `/v1/appScreenshots/${shot.id}`, { data: { type: 'appScreenshots', id: shot.id, attributes: { uploaded: true, sourceFileChecksum: crypto.createHash('md5').update(buf).digest('hex') } } });
    log(`${set.displayType}: uploaded ${f} (${(buf.length / 1024).toFixed(0)} KB) → ${shot.id}`);
    ids.push(shot.id);
  }
  await api('PATCH', `/v1/appScreenshotSets/${s.id}/relationships/appScreenshots`, { data: ids.map((id) => ({ type: 'appScreenshots', id })) });
  for (let attempt = 1; attempt <= 30; attempt++) {
    const rows = await list();
    const states = rows.map((x) => (x.attributes.assetDeliveryState || {}).state);
    if (states.length >= set.files.length && states.every((x) => x === 'COMPLETE')) { log(`${set.displayType}: ${rows.length} screenshot(s) COMPLETE, order asserted`); return; }
    if (states.some((x) => x === 'FAILED')) throw new Error(`${set.displayType}: an asset FAILED delivery: ${JSON.stringify(rows)}`);
    await sleep(5000);
  }
  throw new Error(`${set.displayType}: delivery did not complete in time`);
}

// ── CLI ───────────────────────────────────────────────────────────────────────
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const offline = argv.includes('--offline');
  try {
    const l = loadListing();
    if (argv.includes('--apply')) {
      if (offline) throw new Error('--apply and --offline do not mix');
      const api = client(credentials());
      await apply(l, api);
    } else {
      console.log(`PLAN for ${l.app.name} ${l.version.versionString} (${l.bundleId}); nothing is sent:`);
      for (const line of describePlan(l)) console.log('  ' + line);
      if (!offline) {
        try {
          const api = client(credentials());
          const apps = (await api('GET', `/v1/apps?filter[bundleId]=${encodeURIComponent(l.bundleId)}&fields[apps]=name,bundleId`)).data;
          console.log(`\nrecord: ${apps.length ? `found (${apps[0].id})` : 'NOT FOUND — --apply will refuse until the owner\'s script A has created it'}`);
          for (const c of [l.app.primaryCategory, l.app.secondaryCategory]) {
            const cat = (await api('GET', `/v1/appCategories/${c}?fields[appCategories]=platforms`)).data;
            console.log(`category ${c}: ${cat.attributes.platforms.join(', ')}`);
          }
        } catch (e) { console.log(`\n(read-only checks skipped: ${e.message.slice(0, 160)})`); }
      }
    }
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
}
