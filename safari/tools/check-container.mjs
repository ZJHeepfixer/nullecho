#!/usr/bin/env node
// Static checks on the Safari container app project (safari/xcode). Node, no dependencies.
//
//   node safari/tools/check-container.mjs              # check the repo's project
//   node safari/tools/check-container.mjs <dir>        # check another copy (used by --self-test)
//   node safari/tools/check-container.mjs --self-test  # prove every assertion can fail
//
// Each assertion guards something App Review, App Store Connect or the privacy label cares about.
// --self-test copies safari/xcode to a temp dir, applies one mutation per assertion, and requires
// that exactly that assertion fails. A check that cannot fail is not a check.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const defaultProject = path.join(repoRoot, 'safari', 'xcode');

const APP_INFO_PLISTS = ['Config/iOS-App-Info.plist', 'Config/macOS-App-Info.plist'];
const PRIVACY_MANIFESTS = ['App/PrivacyInfo.xcprivacy', 'Extension/PrivacyInfo.xcprivacy'];
const PBXPROJ = 'Nullecho.xcodeproj/project.pbxproj';
const APP_SOURCES_DIR = 'App';
const EXT_SOURCES_DIR = 'Extension';
const ALLOWED_URLS = ['https://nullecho.org/privacy/', 'https://github.com/ZJHeepfixer/nullecho'];
const PRIVACY_POLICY_URL = 'https://nullecho.org/privacy/';
const VERSION_SENTINEL = '0.0.0';
const TARGET_NAMES = ['Nullecho (iOS)', 'Nullecho (macOS)', 'Nullecho Extension (iOS)', 'Nullecho Extension (macOS)'];

// Tip jar (safari/TIP-JAR.md, safari/audit/05-tip-jar-rules.md §0/§4/§5).
const STOREKIT_FILE = 'Nullecho.storekit';
const TIPJAR_SOURCE = 'App/TipJar.swift';
const SCHEMES = {
  'Nullecho (iOS)': 'Nullecho.xcodeproj/xcshareddata/xcschemes/Nullecho (iOS).xcscheme',
  'Nullecho (macOS)': 'Nullecho.xcodeproj/xcshareddata/xcschemes/Nullecho (macOS).xcscheme',
};
const UNIT_TEST_TARGETS = ['Nullecho Tests (iOS)', 'Nullecho Tests (macOS)'];
// 3.2.1(vi)/3.2.2(iv): only approved non-profits may "donate"/fundraise; 2.3.1(a)/3.1.1: nothing is unlocked.
const TIPJAR_BANNED_WORDS = /\b(donate[sd]?|donating|donations?|charit(?:y|ies|able)|fundrais(?:e|er|ers|ing)|causes?|unlock(?:s|ed|ing)?|upgrade[sd]?|upgrading|premium|pro)\b|remove\s+ads/i;
// The one sentence allowed to contain "unlocks": it says the opposite.
const TIPJAR_EXPLANATION = 'Nothing unlocks; this is a thank-you to the people who build Nullecho.';
// The measured truth about networking (safari/audit/04-storekit-sandbox.md §7); apostrophes are normalized.
const NETWORK_SENTENCE = "This app opens no network connections of its own; the two links below are handed to your browser, and a tip is handled by the App Store's own purchase service, not by this app.";
const OLD_NETWORK_SENTENCE = 'This app opens no network connections;';
const HEADER_NETWORK_PHRASE = 'no network connections of its own';

// ---------------------------------------------------------------- tiny plist + pbxproj readers

/** Parse a flat-ish XML plist into JS (dict/array/string/true/false/integer). Enough for ours. */
function parsePlist(xml) {
  const body = xml.replace(/<\?xml[^>]*\?>|<!DOCTYPE[^>]*>/g, '');
  const m = /<plist[^>]*>([\s\S]*)<\/plist>/.exec(body);
  if (!m) throw new Error('not a plist');
  const tokens = m[1].match(/<[^>]+>|[^<]+/g).map((t) => t.trim()).filter(Boolean);
  let i = 0;
  function value() {
    const t = tokens[i++];
    if (t === '<dict>' || t === '<dict/>') {
      const out = {};
      if (t === '<dict/>') return out;
      while (tokens[i] !== '</dict>') {
        const k = tokens[i++];
        if (k !== '<key>') throw new Error('expected <key>, got ' + k);
        const name = tokens[i++];
        if (tokens[i++] !== '</key>') throw new Error('expected </key>');
        out[name] = value();
      }
      i++;
      return out;
    }
    if (t === '<array>' || t === '<array/>') {
      const out = [];
      if (t === '<array/>') return out;
      while (tokens[i] !== '</array>') out.push(value());
      i++;
      return out;
    }
    if (t === '<true/>') return true;
    if (t === '<false/>') return false;
    if (t === '<string>' || t === '<integer>' || t === '<real>' || t === '<date>') {
      const close = t.replace('<', '</');
      if (tokens[i] === close) { i++; return ''; }
      const v = tokens[i++];
      if (tokens[i++] !== close) throw new Error('expected ' + close);
      return t === '<integer>' ? Number(v) : v;
    }
    if (t === '<string/>') return '';
    throw new Error('unexpected token ' + t);
  }
  return value();
}

/** Extract `KEY = value;` build-setting assignments from a pbxproj, grouped by configuration object. */
function pbxBuildSettings(pbx) {
  // Each XCBuildConfiguration object: ID /* name */ = { isa = XCBuildConfiguration; buildSettings = { ... }; name = X; };
  const configs = [];
  const re = /([0-9A-F]{24}) \/\* ([^*]+) \*\/ = \{\s*isa = XCBuildConfiguration;\s*buildSettings = \{([\s\S]*?)\n\t\t\t\};\s*name = (\w+);/g;
  let m;
  while ((m = re.exec(pbx))) {
    const settings = {};
    for (const line of m[3].split('\n')) {
      const s = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?);\s*$/.exec(line);
      if (s) settings[s[1]] = s[2].replace(/^"(.*)"$/, '$1');
    }
    configs.push({ id: m[1], label: m[2], name: m[4], settings });
  }
  return configs;
}

/** Map configuration-list ID -> target name, and target name -> its configurations. */
function pbxTargets(pbx) {
  const targets = {};
  const tre = /([0-9A-F]{24}) \/\* ([^*]+) \*\/ = \{\s*isa = PBXNativeTarget;\s*buildConfigurationList = ([0-9A-F]{24})[\s\S]*?buildPhases = \(([\s\S]*?)\);[\s\S]*?productType = "([^"]+)";/g;
  let m;
  while ((m = tre.exec(pbx))) {
    const phases = [...m[4].matchAll(/([0-9A-F]{24}) \/\* ([^*]+) \*\//g)].map((p) => ({ id: p[1], name: p[2].trim() }));
    targets[m[2]] = { id: m[1], configList: m[3], phases, productType: m[5] };
  }
  const lists = {};
  const lre = /([0-9A-F]{24}) \/\* Build configuration list for [^*]+ \*\/ = \{\s*isa = XCConfigurationList;\s*buildConfigurations = \(([\s\S]*?)\);/g;
  while ((m = lre.exec(pbx))) lists[m[1]] = [...m[2].matchAll(/([0-9A-F]{24})/g)].map((x) => x[1]);
  const configs = Object.fromEntries(pbxBuildSettings(pbx).map((c) => [c.id, c]));
  for (const t of Object.values(targets)) t.configs = (lists[t.configList] || []).map((id) => configs[id]).filter(Boolean);
  return targets;
}

function shellScriptPhases(pbx) {
  const out = {};
  const re = /([0-9A-F]{24}) \/\* ([^*]+) \*\/ = \{\s*isa = PBXShellScriptBuildPhase;([\s\S]*?)\n\t\t\};/g;
  let m;
  while ((m = re.exec(pbx))) {
    const body = m[3];
    const script = /shellScript = "((?:[^"\\]|\\.)*)";/.exec(body);
    out[m[1]] = { name: m[2].trim(), script: script ? script[1] : '' };
  }
  return out;
}

/** Double-quoted string literals in Swift source, skipping comment-only lines (comments may say anything). */
function swiftStringLiterals(text) {
  const out = [];
  for (const line of text.split('\n')) {
    if (/^\s*\/\//.test(line)) continue;
    for (const m of line.matchAll(/"((?:[^"\\]|\\.)*)"/g)) out.push(m[1]);
  }
  return out;
}

/** Swift source without comment-only lines, so a comment may name the APIs it forbids. */
const swiftCode = (text) => text.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');

const plainApostrophes = (s) => s.replace(/[\u2018\u2019]/g, "'");

function listFiles(dir, pred, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) listFiles(p, pred, acc);
    else if (pred(p)) acc.push(p);
  }
  return acc;
}

// ---------------------------------------------------------------- the assertions

function runChecks(project) {
  const read = (rel) => fs.readFileSync(path.join(project, rel), 'utf8');
  const exists = (rel) => fs.existsSync(path.join(project, rel));
  const results = [];
  const check = (id, title, fn) => {
    try {
      const detail = fn();
      results.push({ id, title, ok: true, detail: detail || '' });
    } catch (e) {
      results.push({ id, title, ok: false, detail: e.message });
    }
  };
  const fail = (msg) => { throw new Error(msg); };

  const pbx = read(PBXPROJ);
  const targets = pbxTargets(pbx);
  const scripts = shellScriptPhases(pbx);
  const settingOf = (targetName, key) => {
    const t = targets[targetName] || fail(`target "${targetName}" not found in pbxproj`);
    const vals = new Set(t.configs.map((c) => c.settings[key]).filter((v) => v !== undefined));
    if (vals.size === 0) return undefined;
    if (vals.size > 1) fail(`${targetName}: ${key} differs between configurations: ${[...vals].join(' vs ')}`);
    return [...vals][0];
  };
  const projectSetting = (key) => {
    const vals = new Set(pbxBuildSettings(pbx).filter((c) => /PBXProject/.test(c.label) || c.label === 'Debug' || c.label === 'Release')
      .map((c) => c.settings[key]).filter((v) => v !== undefined));
    return vals.size === 1 ? [...vals][0] : undefined;
  };
  const effective = (targetName, key) => settingOf(targetName, key) ?? projectSetting(key);

  check('targets', 'the four expected targets exist', () => {
    for (const n of TARGET_NAMES) if (!targets[n]) fail(`missing target "${n}"`);
    return TARGET_NAMES.join(', ');
  });

  check('encryption', 'ITSAppUsesNonExemptEncryption is false in both app Info.plists', () => {
    for (const rel of APP_INFO_PLISTS) {
      if (!exists(rel)) fail(`${rel} missing`);
      const plist = parsePlist(read(rel));
      if (plist.ITSAppUsesNonExemptEncryption !== false) fail(`${rel}: ITSAppUsesNonExemptEncryption is ${JSON.stringify(plist.ITSAppUsesNonExemptEncryption)}, expected false`);
    }
    // And nothing in build settings overrides it to YES.
    for (const c of pbxBuildSettings(pbx)) {
      const v = c.settings.INFOPLIST_KEY_ITSAppUsesNonExemptEncryption;
      if (v !== undefined && v !== 'NO') fail(`${c.label}: INFOPLIST_KEY_ITSAppUsesNonExemptEncryption = ${v}`);
    }
    return APP_INFO_PLISTS.join(', ');
  });

  check('privacy-manifest', 'PrivacyInfo.xcprivacy present for app and extension: no tracking, no collected data, no accessed APIs', () => {
    for (const rel of PRIVACY_MANIFESTS) {
      if (!exists(rel)) fail(`${rel} missing`);
      const p = parsePlist(read(rel));
      if (p.NSPrivacyTracking !== false) fail(`${rel}: NSPrivacyTracking must be false`);
      if (!Array.isArray(p.NSPrivacyTrackingDomains) || p.NSPrivacyTrackingDomains.length) fail(`${rel}: NSPrivacyTrackingDomains must be empty`);
      if (!Array.isArray(p.NSPrivacyCollectedDataTypes) || p.NSPrivacyCollectedDataTypes.length) fail(`${rel}: NSPrivacyCollectedDataTypes must be empty`);
      if (!Array.isArray(p.NSPrivacyAccessedAPITypes) || p.NSPrivacyAccessedAPITypes.length) fail(`${rel}: NSPrivacyAccessedAPITypes must be empty (the app uses no required-reason API; declare one here the day it does)`);
    }
    // They are picked up because App/ and Extension/ are file-system-synchronized groups of the
    // app and extension targets respectively. Assert that wiring, or the files would never ship.
    const syncGroups = [...pbx.matchAll(/([0-9A-F]{24}) \/\* ([^*]+) \*\/ = \{\s*isa = PBXFileSystemSynchronizedRootGroup;[\s\S]*?path = ([^;]+);/g)]
      .map((m) => ({ id: m[1], path: m[3].replace(/"/g, '').trim() }));
    const byPath = Object.fromEntries(syncGroups.map((g) => [g.path, g.id]));
    if (!byPath[APP_SOURCES_DIR] || !byPath[EXT_SOURCES_DIR]) fail(`App/ and Extension/ must be synchronized root groups (found: ${syncGroups.map((g) => g.path).join(', ') || 'none'})`);
    for (const n of TARGET_NAMES) {
      const want = n.includes('Extension') ? byPath[EXT_SOURCES_DIR] : byPath[APP_SOURCES_DIR];
      const block = new RegExp(`isa = PBXNativeTarget;[\\s\\S]*?name = "${n.replace(/[()]/g, '\\$&')}";`).exec(pbx)?.[0]
        || new RegExp(`${targets[n].id} /\\* [^*]+ \\*/ = \\{[\\s\\S]*?productType`).exec(pbx)?.[0] || '';
      const member = new RegExp(`fileSystemSynchronizedGroups = \\([\\s\\S]*?${want}[\\s\\S]*?\\);`).test(block);
      if (!member) fail(`${n} is not a member of the ${n.includes('Extension') ? EXT_SOURCES_DIR : APP_SOURCES_DIR}/ synchronized group, so its PrivacyInfo.xcprivacy would not be copied`);
    }
    return PRIVACY_MANIFESTS.join(', ');
  });

  check('team', 'DEVELOPMENT_TEAM is empty everywhere under safari/xcode', () => {
    const files = listFiles(project, (p) => /\.(pbxproj|xcconfig|xcscheme|plist|xcworkspacedata|xcsettings|json)$/.test(p) || /xcuserdata/.test(p));
    for (const f of files) {
      const text = fs.readFileSync(f, 'utf8');
      const m = /DEVELOPMENT_TEAM\s*=\s*"?([A-Za-z0-9]+)"?\s*;/.exec(text) || /<key>DEVELOPMENT_TEAM<\/key>\s*<string>([^<]+)<\/string>/.exec(text);
      if (m && m[1]) fail(`${path.relative(project, f)} contains DEVELOPMENT_TEAM = ${m[1]}`);
      const team = /"?(?:DevelopmentTeam|teamID|TeamIdentifier)"?\s*[:=]\s*"?([A-Z0-9]{10})"?/.exec(text);
      if (team) fail(`${path.relative(project, f)} contains a team identifier (${team[1]})`);
    }
    if (fs.existsSync(path.join(project, 'Nullecho.xcodeproj', 'xcuserdata'))) fail('xcuserdata/ is present inside the project; it must stay ignored');
    return `${files.length} files scanned`;
  });

  check('bundle-ids', 'extension bundle ids are prefixed by the app bundle id; iOS and macOS app ids are identical (universal purchase)', () => {
    const iosApp = settingOf('Nullecho (iOS)', 'PRODUCT_BUNDLE_IDENTIFIER');
    const macApp = settingOf('Nullecho (macOS)', 'PRODUCT_BUNDLE_IDENTIFIER');
    const iosExt = settingOf('Nullecho Extension (iOS)', 'PRODUCT_BUNDLE_IDENTIFIER');
    const macExt = settingOf('Nullecho Extension (macOS)', 'PRODUCT_BUNDLE_IDENTIFIER');
    for (const [n, v] of Object.entries({ iosApp, macApp, iosExt, macExt })) if (!v) fail(`${n}: PRODUCT_BUNDLE_IDENTIFIER missing`);
    if (iosApp !== macApp) fail(`app bundle ids differ: iOS ${iosApp} vs macOS ${macApp}`);
    if (iosExt !== macExt) fail(`extension bundle ids differ: iOS ${iosExt} vs macOS ${macExt}`);
    if (!iosExt.startsWith(iosApp + '.')) fail(`extension id ${iosExt} is not prefixed by app id ${iosApp}. (App Store Connect rejects embedded bundles whose id is not prefixed by the parent's.)`);
    if (/[A-Z]/.test(iosExt.slice(iosApp.length))) fail(`extension id suffix should be lowercase: ${iosExt}`);
    return `${iosApp} / ${iosExt}`;
  });

  check('deployment-targets', 'app and extension deployment targets match per platform', () => {
    const ios = [effective('Nullecho (iOS)', 'IPHONEOS_DEPLOYMENT_TARGET'), effective('Nullecho Extension (iOS)', 'IPHONEOS_DEPLOYMENT_TARGET')];
    const mac = [effective('Nullecho (macOS)', 'MACOSX_DEPLOYMENT_TARGET'), effective('Nullecho Extension (macOS)', 'MACOSX_DEPLOYMENT_TARGET')];
    if (!ios[0] || ios[0] !== ios[1]) fail(`iOS deployment targets differ or are unset: app ${ios[0]} vs extension ${ios[1]}`);
    if (!mac[0] || mac[0] !== mac[1]) fail(`macOS deployment targets differ or are unset: app ${mac[0]} vs extension ${mac[1]}`);
    return `iOS ${ios[0]}, macOS ${mac[0]}`;
  });

  check('version', 'MARKETING_VERSION is not hand-kept: every value is the sentinel and every target stamps CFBundleShortVersionString from the extension manifest', () => {
    for (const c of pbxBuildSettings(pbx)) {
      const v = c.settings.MARKETING_VERSION;
      if (v !== undefined && v !== VERSION_SENTINEL) fail(`${c.label}: MARKETING_VERSION = ${v} (must be the sentinel ${VERSION_SENTINEL}; the manifest is the only source of the version)`);
    }
    if (projectSetting('MARKETING_VERSION') !== VERSION_SENTINEL) fail(`project-level MARKETING_VERSION must be the sentinel ${VERSION_SENTINEL}`);
    for (const n of TARGET_NAMES) {
      const t = targets[n];
      const stamp = t.phases.map((p) => scripts[p.id]).find((s) => s && /stamp-version\.sh/.test(s.script));
      if (!stamp) fail(`${n} has no build phase running Scripts/stamp-version.sh`);
      if (t.phases.findIndex((p) => scripts[p.id] === stamp) !== t.phases.length - 1) fail(`${n}: the version stamp must be the last build phase`);
    }
    const stampScript = read('Scripts/stamp-version.sh');
    if (!/dist\/safari\/extension\/manifest\.json/.test(stampScript)) fail('Scripts/stamp-version.sh does not read dist/safari/extension/manifest.json');
    if (!/CFBundleShortVersionString/.test(stampScript)) fail('Scripts/stamp-version.sh does not set CFBundleShortVersionString');
    return `sentinel ${VERSION_SENTINEL}; 4 stamp phases`;
  });

  check('extension-embed', 'both extension targets run safari/tools/build-extension.mjs before their Resources phase and fail loudly without node', () => {
    for (const n of ['Nullecho Extension (iOS)', 'Nullecho Extension (macOS)']) {
      const t = targets[n];
      const idx = t.phases.findIndex((p) => scripts[p.id] && /embed-extension\.sh/.test(scripts[p.id].script));
      if (idx < 0) fail(`${n} has no build phase running Scripts/embed-extension.sh`);
      const resIdx = t.phases.findIndex((p) => p.name === 'Resources');
      if (resIdx >= 0 && idx > resIdx) fail(`${n}: the embed phase must run before Resources`);
    }
    const embed = read('Scripts/embed-extension.sh');
    if (!/safari\/tools\/build-extension\.mjs/.test(embed)) fail('embed-extension.sh does not run safari/tools/build-extension.mjs');
    if (!/dist\/safari\/extension/.test(embed)) fail('embed-extension.sh does not consume dist/safari/extension');
    if (!/node not found/i.test(embed) || !/exit 1/.test(embed)) fail('embed-extension.sh must fail the build when node is missing');
    if (!/set -e/.test(embed)) fail('embed-extension.sh must run with set -e');
    // The extension folder is consumed from dist/, never checked into the project.
    if (exists('Extension/manifest.json') || listFiles(path.join(project, 'Extension'), (p) => /manifest\.json$/.test(p)).length) fail('a manifest.json is checked into safari/xcode/Extension; the extension must come from dist/safari/extension');
    return 'ok';
  });

  check('policy-link', 'the in-app content contains the privacy-policy link (Guideline 5.1.1(i))', () => {
    const swift = listFiles(path.join(project, APP_SOURCES_DIR), (p) => p.endsWith('.swift')).map((p) => fs.readFileSync(p, 'utf8')).join('\n');
    if (!swift.includes(PRIVACY_POLICY_URL)) fail(`${PRIVACY_POLICY_URL} not found in App/*.swift`);
    if (!/Link\(destination:\s*ExternalLink\.privacyPolicy\)/.test(swift) && !/openURL/.test(swift)) fail('the privacy policy URL is present but not wired to a Link/openURL');
    return PRIVACY_POLICY_URL;
  });

  check('no-network', 'app code has no network client, no web view and no URL other than the two external links', () => {
    const files = listFiles(path.join(project, APP_SOURCES_DIR), (p) => p.endsWith('.swift'))
      .concat(listFiles(path.join(project, EXT_SOURCES_DIR), (p) => p.endsWith('.swift')));
    const forbidden = [/URLSession/, /URLRequest/, /\bWKWebView\b/, /\bWebKit\b/, /\bSFSafariViewController\b/, /NSURLConnection/, /\bNWConnection\b/, /\bimport Network\b/, /CFSocket/, /dataTask/, /loadFileURL/, /loadHTMLString/, /\bNWBrowser\b/, /Crashlytics/i, /Firebase/i, /Sentry/i, /sendBeacon/];
    for (const f of files) {
      const text = fs.readFileSync(f, 'utf8');
      for (const re of forbidden) if (re.test(text)) fail(`${path.relative(project, f)} matches ${re}`);
      for (const m of text.matchAll(/https?:\/\/[^\s"')]+/g)) {
        if (!ALLOWED_URLS.includes(m[0])) fail(`${path.relative(project, f)} contains a URL that is not one of the two external links: ${m[0]}`);
      }
      // StoreKit's traffic is the system agent's, not the app's, but keep it in one file so the posture
      // stays reviewable: "StoreKit only, via the system" (audit 04 §7).
      if (/^\s*import StoreKit\b/m.test(text) && path.relative(project, f) !== TIPJAR_SOURCE) fail(`${path.relative(project, f)} imports StoreKit; only ${TIPJAR_SOURCE} may`);
      if (/^\s*import StoreKitTest\b/m.test(text)) fail(`${path.relative(project, f)} imports StoreKitTest, a test-only framework`);
    }
    // macOS app sandbox without the network-client entitlement (the sandbox then enforces this).
    const net = settingOf('Nullecho (macOS)', 'ENABLE_OUTGOING_NETWORK_CONNECTIONS');
    const sandbox = settingOf('Nullecho (macOS)', 'ENABLE_APP_SANDBOX');
    if (sandbox !== 'YES') fail('macOS app: ENABLE_APP_SANDBOX must be YES');
    if (net !== 'NO') fail(`macOS app: ENABLE_OUTGOING_NETWORK_CONNECTIONS must be NO (is ${net})`);
    for (const f of listFiles(project, (p) => p.endsWith('.entitlements'))) {
      const text = fs.readFileSync(f, 'utf8');
      if (/network\.client<\/key>\s*<true\/>/.test(text)) fail(`${path.relative(project, f)} grants com.apple.security.network.client`);
    }
    return `${files.length} Swift files; URLs allowed: ${ALLOWED_URLS.join(', ')}`;
  });

  check('no-personal-data', 'no generated "Created by" headers, emails or user paths in project files', () => {
    const files = listFiles(project, (p) => /\.(swift|pbxproj|plist|sh|md|xcscheme|xcprivacy|json|storekit)$/.test(p));
    for (const f of files) {
      const text = fs.readFileSync(f, 'utf8');
      if (/Created by /.test(text)) fail(`${path.relative(project, f)} has a "Created by" header`);
      // `@2x.png` asset names are not addresses.
      if (/[A-Za-z0-9._%+-]+@(?!\dx\b)[A-Za-z0-9-]+\.[A-Za-z]{2,}/.test(text)) fail(`${path.relative(project, f)} contains an email address`);
      if (/\/Users\/[A-Za-z0-9_-]+\//.test(text)) fail(`${path.relative(project, f)} contains an absolute user path`);
    }
    return `${files.length} files scanned`;
  });

  check('banned-phrases', 'copy avoids the phrases docs/THREAT-MODEL.md bans', () => {
    const swift = listFiles(path.join(project, APP_SOURCES_DIR), (p) => p.endsWith('.swift')).map((p) => fs.readFileSync(p, 'utf8')).join('\n').toLowerCase();
    const banned = ['protects you from fingerprinting', 'prevents fingerprinting', 'blocks fingerprinting', 'makes you anonymous', 'untraceable', 'invisible', 'makes you look like a different computer', 'stops sites from selling', 'anonymous'];
    for (const phrase of banned) if (swift.includes(phrase)) fail(`banned phrase in app copy: "${phrase}"`);
    return `${banned.length} phrases absent`;
  });

  // ------------------------------------------------------------ tip jar

  const appSwiftFiles = () => listFiles(path.join(project, APP_SOURCES_DIR), (p) => p.endsWith('.swift'));
  const storekit = () => {
    if (!exists(STOREKIT_FILE)) fail(`${STOREKIT_FILE} missing`);
    let json;
    try { json = JSON.parse(read(STOREKIT_FILE)); } catch (e) { fail(`${STOREKIT_FILE} is not JSON: ${e.message}`); }
    if (!Array.isArray(json.products)) fail(`${STOREKIT_FILE} has no products array`);
    return json;
  };
  const codeProductIDs = () => {
    if (!exists(TIPJAR_SOURCE)) fail(`${TIPJAR_SOURCE} missing`);
    const m = /static let productIDs(?:\s*:\s*\[String\])?\s*=\s*\[([\s\S]*?)\]/.exec(read(TIPJAR_SOURCE));
    if (!m) fail(`${TIPJAR_SOURCE} has no "static let productIDs = [...]"`);
    return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  };

  check('tipjar-products', `the three consumable product ids are identical in ${STOREKIT_FILE} and in code, and appear in code in one place`, () => {
    const json = storekit();
    const ids = codeProductIDs();
    if (ids.length !== 3) fail(`code lists ${ids.length} product ids, expected exactly 3: ${ids.join(', ')}`);
    if (new Set(ids).size !== 3) fail(`duplicate product id in code: ${ids.join(', ')}`);
    const products = json.products;
    if (products.length !== 3) fail(`${STOREKIT_FILE} has ${products.length} products, expected exactly 3`);
    const fileIDs = products.map((p) => p.productID);
    if ([...ids].sort().join() !== [...fileIDs].sort().join()) fail(`product ids differ: code [${ids.join(', ')}] vs ${STOREKIT_FILE} [${fileIDs.join(', ')}]`);
    for (const p of products) {
      if (p.type !== 'Consumable') fail(`${p.productID} is ${p.type}; every tip must be a Consumable`);
      if (!(Number(p.displayPrice) > 0)) fail(`${p.productID} has no positive displayPrice`);
      for (const loc of p.localizations || []) {
        if (!(loc.displayName.length >= 2 && loc.displayName.length <= 30)) fail(`${p.productID}: display name must be 2–30 characters (App Store Connect): "${loc.displayName}"`);
        if (!((loc.description || '').length <= 45)) fail(`${p.productID}: description must be ≤ 45 characters (App Store Connect): "${loc.description}"`);
      }
    }
    if (json.subscriptionGroups?.length || json.nonRenewingSubscriptions?.length) fail(`${STOREKIT_FILE} defines subscriptions; the tip jar is consumables only`);
    // One place in code: every literal that looks like a tip id lives in that array.
    const prefix = ids[0].split('.').slice(0, -1).join('.') + '.';
    for (const f of appSwiftFiles()) {
      const n = (fs.readFileSync(f, 'utf8').match(new RegExp(prefix.replace(/\./g, '\\.'), 'g')) || []).length;
      const expected = path.relative(project, f) === TIPJAR_SOURCE ? 3 : 0;
      if (n !== expected) fail(`${path.relative(project, f)} mentions "${prefix}" ${n} time(s); expected ${expected} (ids live only in TipJar.productIDs)`);
    }
    return ids.join(', ');
  });

  check('tipjar-scheme', `both shared schemes attach ${STOREKIT_FILE} to Run (the Test action inherits it) and carry their test bundles, which ship the file as a resource`, () => {
    for (const [name, rel] of Object.entries(SCHEMES)) {
      if (!exists(rel)) fail(`${rel} missing`);
      const xml = read(rel);
      const launch = /<LaunchAction[\s\S]*?<\/LaunchAction>/.exec(xml)?.[0] || fail(`${name}: no LaunchAction`);
      const ref = /<StoreKitConfigurationFileReference\s+identifier\s*=\s*"([^"]+)"/.exec(launch);
      if (!ref) fail(`${name}: LaunchAction has no StoreKitConfigurationFileReference (the iOS Simulator then leaves the test environment and shows the App Store sign-in sheet)`);
      if (path.basename(ref[1]) !== STOREKIT_FILE) fail(`${name}: StoreKitConfigurationFileReference points at ${ref[1]}, not ${STOREKIT_FILE}`);
      // Xcode's scheme format has the StoreKit reference on the Launch action only (IDELaunchSchemeAction is the
      // sole class that reads it); the Test action takes the Run action's launch parameters.
      const test = /<TestAction[\s\S]*?<\/TestAction>/.exec(xml)?.[0] || fail(`${name}: no TestAction`);
      if (!/shouldUseLaunchSchemeArgsEnv\s*=\s*"YES"/.test(test)) fail(`${name}: TestAction must use the Run action's arguments and environment (shouldUseLaunchSchemeArgsEnv = YES)`);
      const testables = [...test.matchAll(/<TestableReference[\s\S]*?BlueprintName\s*=\s*"([^"]+)"/g)].map((m) => m[1]);
      const unit = name === 'Nullecho (iOS)' ? 'Nullecho Tests (iOS)' : 'Nullecho Tests (macOS)';
      if (!testables.includes(unit)) fail(`${name}: TestAction does not run ${unit} (testables: ${testables.join(', ') || 'none'})`);
      if (/<TestableReference[^>]*skipped\s*=\s*"YES"/.test(test)) fail(`${name}: a testable is marked skipped`);
    }
    // SKTestSession(configurationFileNamed:) loads the file from the test bundle, so each unit-test target
    // must copy it; and each must link StoreKitTest and be hosted in the app it tests.
    const fileRef = /([0-9A-F]{24}) \/\* Nullecho\.storekit \*\/ = \{isa = PBXFileReference;/.exec(pbx)?.[1] || fail(`pbxproj has no file reference for ${STOREKIT_FILE}`);
    const buildFiles = [...pbx.matchAll(/([0-9A-F]{24}) \/\* Nullecho\.storekit in Resources \*\/ = \{isa = PBXBuildFile; fileRef = ([0-9A-F]{24})/g)].filter((m) => m[2] === fileRef).map((m) => m[1]);
    for (const n of UNIT_TEST_TARGETS) {
      const t = targets[n] || fail(`target "${n}" not found in pbxproj`);
      if (t.productType !== 'com.apple.product-type.bundle.unit-test') fail(`${n} is ${t.productType}, expected a unit-test bundle`);
      const res = t.phases.find((p) => p.name === 'Resources') || fail(`${n} has no Resources phase`);
      const block = new RegExp(`${res.id} /\\* Resources \\*/ = \\{[\\s\\S]*?files = \\(([\\s\\S]*?)\\);`).exec(pbx)?.[1] || '';
      if (!buildFiles.some((id) => block.includes(id))) fail(`${n} does not copy ${STOREKIT_FILE} into its bundle, so SKTestSession(configurationFileNamed:) would throw`);
      const host = settingOf(n, 'TEST_HOST') || '';
      if (!/Nullecho\.app/.test(host)) fail(`${n}: TEST_HOST must be the Nullecho app (is ${host || 'unset'})`);
      const fw = t.phases.find((p) => p.name === 'Frameworks');
      const fwBlock = fw ? new RegExp(`${fw.id} /\\* Frameworks \\*/ = \\{[\\s\\S]*?files = \\(([\\s\\S]*?)\\);`).exec(pbx)?.[1] || '' : '';
      if (!/StoreKitTest\.framework/.test(fwBlock)) fail(`${n} does not link StoreKitTest.framework`);
    }
    return `${Object.keys(SCHEMES).join(', ')}; ${UNIT_TEST_TARGETS.join(', ')}`;
  });

  check('tipjar-copy', 'tip-jar wording never says donate/charity/fundraiser/cause and never implies unlocking, upgrading, premium or removing ads', () => {
    const offenders = [];
    for (const f of appSwiftFiles()) {
      for (const s of swiftStringLiterals(fs.readFileSync(f, 'utf8'))) {
        const stripped = s.split(TIPJAR_EXPLANATION).join('');
        const m = TIPJAR_BANNED_WORDS.exec(stripped);
        if (m) offenders.push(`${path.relative(project, f)}: "${s}" contains "${m[0]}"`);
      }
    }
    const json = storekit();
    for (const p of json.products) {
      const strings = [p.referenceName, ...(p.localizations || []).flatMap((l) => [l.displayName, l.description])].filter(Boolean);
      for (const s of strings) {
        const m = TIPJAR_BANNED_WORDS.exec(s);
        if (m) offenders.push(`${STOREKIT_FILE} ${p.productID}: "${s}" contains "${m[0]}"`);
      }
    }
    if (offenders.length) fail(offenders.join('; '));
    const swift = appSwiftFiles().map((f) => fs.readFileSync(f, 'utf8')).join('\n');
    if (!swift.includes(TIPJAR_EXPLANATION)) fail(`the explanatory line is missing: "${TIPJAR_EXPLANATION}"`);
    if (!swift.includes('"Support the project"')) fail('the section header "Support the project" is missing');
    return `banned pattern ${TIPJAR_BANNED_WORDS}`;
  });

  check('tipjar-no-persistence', 'the app stores nothing: no UserDefaults/AppStorage/keychain/database/file writes, no appAccountToken; FileManager only reads the bundle in EmbeddedExtension.swift', () => {
    const forbidden = [/UserDefaults/, /@AppStorage/, /@SceneStorage/, /NSUbiquitousKeyValueStore/, /Keychain/i, /SecItem(Add|Update|Copy|Delete)/, /\bimport SwiftData\b/, /\bimport CoreData\b/, /NSPersistent/, /\.write\(to/, /createFile\(atPath/, /appAccountToken/, /FileHandle/, /NSKeyedArchiver/, /PropertyListEncoder/, /JSONEncoder/];
    for (const f of appSwiftFiles()) {
      const rel = path.relative(project, f);
      const text = swiftCode(fs.readFileSync(f, 'utf8'));
      for (const re of forbidden) if (re.test(text)) fail(`${rel} matches ${re}`);
      if (/FileManager/.test(text) && rel !== 'App/EmbeddedExtension.swift') fail(`${rel} uses FileManager; only EmbeddedExtension.swift may (it reads the bundle)`);
    }
    return `${forbidden.length} patterns absent from App/*.swift`;
  });

  check('tipjar-prices', 'no price is typed into the app: tiers show the App Store\'s displayPrice', () => {
    for (const f of appSwiftFiles()) {
      for (const s of swiftStringLiterals(fs.readFileSync(f, 'utf8'))) {
        if (/[$€£¥]\s?\d|\d+[.,]\d\d\b|\bUSD\b/.test(s)) fail(`${path.relative(project, f)} contains a hard-coded price: "${s}"`);
      }
    }
    const tip = read(TIPJAR_SOURCE);
    if (!/\.displayPrice\b/.test(tip)) fail(`${TIPJAR_SOURCE} never reads product.displayPrice`);
    if (!/\.displayName\b/.test(tip)) fail(`${TIPJAR_SOURCE} never reads product.displayName`);
    return 'displayPrice/displayName only';
  });

  check('tipjar-network-sentence', 'the "Collects nothing" copy states the measured truth: no connections of the app\'s own, links to the browser, tips through the App Store\'s purchase service', () => {
    const content = plainApostrophes(read('App/ContentView.swift'));
    if (!content.includes(NETWORK_SENTENCE)) fail(`App/ContentView.swift lacks the sentence: "${NETWORK_SENTENCE}"`);
    if (content.includes(OLD_NETWORK_SENTENCE)) fail(`App/ContentView.swift still carries the absolute sentence "${OLD_NETWORK_SENTENCE}"`);
    const header = plainApostrophes(read('App/NullechoApp.swift'));
    if (!header.includes(HEADER_NETWORK_PHRASE)) fail(`App/NullechoApp.swift header lacks "${HEADER_NETWORK_PHRASE}"`);
    if (/opens no network connections[;.]/.test(header)) fail('App/NullechoApp.swift header still has the absolute sentence');
    return 'ContentView.swift + NullechoApp.swift';
  });

  return results;
}

// ---------------------------------------------------------------- self-test: each check must be able to fail

const MUTATIONS = [
  { id: 'encryption', apply: (p) => replaceIn(p, 'Config/iOS-App-Info.plist', '<key>ITSAppUsesNonExemptEncryption</key>\n\t<false/>', '<key>ITSAppUsesNonExemptEncryption</key>\n\t<true/>') },
  { id: 'privacy-manifest', apply: (p) => replaceIn(p, 'Extension/PrivacyInfo.xcprivacy', '<key>NSPrivacyTracking</key>\n\t<false/>', '<key>NSPrivacyTracking</key>\n\t<true/>') },
  { id: 'privacy-manifest', apply: (p) => fs.rmSync(path.join(p, 'App/PrivacyInfo.xcprivacy')), label: 'delete App/PrivacyInfo.xcprivacy' },
  { id: 'privacy-manifest', apply: (p) => replaceIn(p, 'App/PrivacyInfo.xcprivacy', '<key>NSPrivacyCollectedDataTypes</key>\n\t<array/>', '<key>NSPrivacyCollectedDataTypes</key>\n\t<array><dict><key>NSPrivacyCollectedDataType</key><string>NSPrivacyCollectedDataTypeDeviceID</string></dict></array>'), label: 'declare a collected data type' },
  { id: 'team', apply: (p) => replaceIn(p, PBXPROJ, 'CODE_SIGN_STYLE = Automatic;', 'CODE_SIGN_STYLE = Automatic;\n\t\t\t\tDEVELOPMENT_TEAM = ABCDE12345;', 1) },
  { id: 'bundle-ids', apply: (p) => replaceIn(p, PBXPROJ, 'PRODUCT_BUNDLE_IDENTIFIER = org.nullecho.app.extension;', 'PRODUCT_BUNDLE_IDENTIFIER = org.nullecho.extension;'), label: 'extension id not prefixed by the app id' },
  { id: 'bundle-ids', apply: (p) => replaceIn(p, PBXPROJ, 'PRODUCT_BUNDLE_IDENTIFIER = org.nullecho.app;', 'PRODUCT_BUNDLE_IDENTIFIER = org.nullecho.mac;', 2, 2), label: 'macOS app id differs from iOS' },
  { id: 'deployment-targets', apply: (p) => replaceIn(p, PBXPROJ, 'SDKROOT = iphoneos;\n\t\t\t\tSKIP_INSTALL = YES;', 'IPHONEOS_DEPLOYMENT_TARGET = 15.0;\n\t\t\t\tSDKROOT = iphoneos;\n\t\t\t\tSKIP_INSTALL = YES;') },
  { id: 'version', apply: (p) => replaceIn(p, PBXPROJ, `MARKETING_VERSION = ${VERSION_SENTINEL};`, 'MARKETING_VERSION = 1.0;', 1), label: 'hard-code MARKETING_VERSION' },
  { id: 'version', apply: (p) => removePhaseFromTarget(p, 'Nullecho (macOS)', 'Stamp version from extension manifest'), label: 'drop the stamp phase from one target' },
  { id: 'extension-embed', apply: (p) => removePhaseFromTarget(p, 'Nullecho Extension (iOS)', 'Build and embed web extension'), label: 'drop the embed phase from one extension target' },
  { id: 'extension-embed', apply: (p) => fs.writeFileSync(path.join(p, 'Extension/manifest.json'), '{}'), label: 'check a manifest.json into the project' },
  { id: 'policy-link', apply: (p) => replaceIn(p, 'App/ContentView.swift', '    static let privacyPolicy = URL(string: "https://nullecho.org/privacy/")!\n', ''), label: 'remove the privacy-policy URL' },
  { id: 'no-network', apply: (p) => fs.appendFileSync(path.join(p, 'App/ContentView.swift'), '\nlet sneaky = URLSession.shared\n'), label: 'add URLSession' },
  { id: 'no-network', apply: (p) => fs.appendFileSync(path.join(p, 'App/ContentView.swift'), '\nlet other = URL(string: "https://example.com/ping")\n'), label: 'add a third URL' },
  { id: 'no-network', apply: (p) => replaceIn(p, PBXPROJ, 'ENABLE_OUTGOING_NETWORK_CONNECTIONS = NO;', 'ENABLE_OUTGOING_NETWORK_CONNECTIONS = YES;'), label: 'grant the macOS network-client entitlement' },
  { id: 'no-personal-data', apply: (p) => replaceIn(p, 'App/NullechoApp.swift', '// Nullecho for Safari', '//\n//  Created by Someone on 1/1/26.\n//\n// Nullecho for Safari') },
  { id: 'banned-phrases', apply: (p) => replaceIn(p, 'App/ContentView.swift', 'No fingerprint disguise', 'Protects you from fingerprinting') },
  // Tip jar.
  { id: 'no-network', apply: (p) => replaceIn(p, 'App/ContentView.swift', 'import SwiftUI\n', 'import SwiftUI\nimport StoreKit\n', 1), label: 'import StoreKit outside TipJar.swift' },
  { id: 'tipjar-products', apply: (p) => replaceIn(p, STOREKIT_FILE, '"productID" : "org.nullecho.tip.medium"', '"productID" : "org.nullecho.tip.middle"'), label: 'rename a product id in the .storekit only' },
  { id: 'tipjar-products', apply: (p) => replaceIn(p, STOREKIT_FILE, '"type" : "Consumable"', '"type" : "NonConsumable"', 1), label: 'make one tip non-consumable' },
  { id: 'tipjar-products', apply: (p) => replaceIn(p, TIPJAR_SOURCE, '        "org.nullecho.tip.large",\n', '        "org.nullecho.tip.large",\n        "org.nullecho.tip.huge",\n'), label: 'a fourth id in code' },
  { id: 'tipjar-products', apply: (p) => fs.appendFileSync(path.join(p, 'App/ContentView.swift'), '\nlet favourite = "org.nullecho.tip.small"\n'), label: 'a product id literal in a second place' },
  { id: 'tipjar-scheme', apply: (p) => replaceIn(p, SCHEMES['Nullecho (iOS)'], /\s*<StoreKitConfigurationFileReference[\s\S]*?<\/StoreKitConfigurationFileReference>/, ''), label: 'detach the .storekit from the iOS Run action' },
  { id: 'tipjar-scheme', apply: (p) => replaceIn(p, SCHEMES['Nullecho (macOS)'], /<Testables>[\s\S]*?<\/Testables>/, '<Testables>\n      </Testables>'), label: 'drop the macOS test bundle from the scheme' },
  { id: 'tipjar-scheme', apply: (p) => replaceIn(p, PBXPROJ, '4E430000000000000000E005 /* Nullecho.storekit in Resources */,\n', ''), label: 'stop copying the .storekit into the iOS test bundle' },
  { id: 'tipjar-copy', apply: (p) => replaceIn(p, TIPJAR_SOURCE, 'Text("Support the project")', 'Text("Donate to the project")'), label: 'say "Donate"' },
  { id: 'tipjar-copy', apply: (p) => replaceIn(p, STOREKIT_FILE, '"displayName" : "Large tip"', '"displayName" : "Premium tip"'), label: '"Premium" in a .storekit display name' },
  { id: 'tipjar-copy', apply: (p) => replaceIn(p, TIPJAR_SOURCE, 'Thank you. Nothing has changed, and that’s the point.', 'Thank you. Pro features unlocked.'), label: 'a thank-you that promises an unlock' },
  { id: 'tipjar-no-persistence', apply: (p) => fs.appendFileSync(path.join(p, TIPJAR_SOURCE), '\nlet tipped = UserDefaults.standard.bool(forKey: "tipped")\n'), label: 'remember a tip in UserDefaults' },
  { id: 'tipjar-no-persistence', apply: (p) => replaceIn(p, 'App/ContentView.swift', '    @Environment(TipJar.self) private var tipJar\n', '    @Environment(TipJar.self) private var tipJar\n    @AppStorage("supporter") private var supporter = false\n'), label: '@AppStorage in the view' },
  { id: 'tipjar-prices', apply: (p) => replaceIn(p, TIPJAR_SOURCE, 'Button(product.displayPrice, action: action)', 'Button("$1.99", action: action)'), label: 'hard-code a price' },
  { id: 'tipjar-network-sentence', apply: (p) => replaceIn(p, 'App/ContentView.swift', 'This app opens no network connections of its own; the two links below are handed to your browser, and a tip is handled by the App Store’s own purchase service, not by this app.', 'This app opens no network connections; the two links below are handed to your browser.'), label: 'revert to the absolute no-network sentence' },
  { id: 'tipjar-network-sentence', apply: (p) => replaceIn(p, 'App/NullechoApp.swift', 'It opens no network connections of its own: the two links it', 'It opens no network connections; the two links it'), label: 'absolute sentence back in the app header' },
  { ids: ['no-network', 'tipjar-scheme'], apply: (p) => { replaceIn(p, PBXPROJ, 'ENABLE_OUTGOING_NETWORK_CONNECTIONS = NO;', 'ENABLE_OUTGOING_NETWORK_CONNECTIONS = YES;'); replaceIn(p, SCHEMES['Nullecho (macOS)'], /\s*<StoreKitConfigurationFileReference[\s\S]*?<\/StoreKitConfigurationFileReference>/, ''); }, label: 'entitlement YES and macOS Run action without the .storekit (two checks must both fail)' },
];

function replaceIn(project, rel, from, to, count = Infinity, skip = 0) {
  const file = path.join(project, rel);
  let text = fs.readFileSync(file, 'utf8');
  if (from instanceof RegExp) {
    if (!from.test(text)) throw new Error(`self-test mutation target not found in ${rel}: ${from}`);
    fs.writeFileSync(file, text.replace(from, to));
    return;
  }
  if (!text.includes(from)) throw new Error(`self-test mutation target not found in ${rel}: ${JSON.stringify(from)}`);
  let seen = 0, done = 0, idx = 0, out = '';
  while (true) {
    const at = text.indexOf(from, idx);
    if (at < 0 || done >= count) { out += text.slice(idx); break; }
    out += text.slice(idx, at);
    if (seen >= skip) { out += to; done++; } else out += from;
    seen++;
    idx = at + from.length;
  }
  fs.writeFileSync(file, out);
}

function removePhaseFromTarget(project, targetName, phaseName) {
  const file = path.join(project, PBXPROJ);
  const text = fs.readFileSync(file, 'utf8');
  const re = new RegExp(`(isa = PBXNativeTarget;[\\s\\S]*?buildPhases = \\([\\s\\S]*?)\\n\\t\\t\\t\\t[0-9A-F]{24} /\\* ${phaseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\*/,([\\s\\S]*?name = "${targetName.replace(/[()]/g, '\\$&')}";)`);
  if (!re.test(text)) throw new Error(`self-test: phase "${phaseName}" not found in target "${targetName}"`);
  fs.writeFileSync(file, text.replace(re, '$1$2'));
}

function copyProject(src, dst) {
  fs.cpSync(src, dst, { recursive: true, filter: (p) => !/DerivedData|xcuserdata|\/build\//.test(p) });
}

function selfTest() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'nullecho-check-container-'));
  let failures = 0;
  // Control: the pristine copy passes.
  const pristine = path.join(base, 'pristine');
  copyProject(defaultProject, pristine);
  const control = runChecks(pristine);
  const bad = control.filter((r) => !r.ok);
  if (bad.length) {
    console.log('self-test control FAILED: pristine copy does not pass:');
    for (const r of bad) console.log(`  - ${r.id}: ${r.detail}`);
    return 1;
  }
  console.log(`control: pristine copy passes all ${control.length} checks`);
  MUTATIONS.forEach((m, i) => {
    const dir = path.join(base, `m${i}`);
    copyProject(defaultProject, dir);
    m.apply(dir);
    const results = runChecks(dir);
    const failed = results.filter((r) => !r.ok).map((r) => r.id);
    // A mutation names the check(s) it must trip: exactly those fail, nothing else.
    const wanted = m.ids || [m.id];
    const missing = wanted.filter((id) => !failed.includes(id));
    const extra = failed.filter((id) => !wanted.includes(id));
    const ok = missing.length === 0 && extra.length === 0;
    const label = m.label || wanted.join('+');
    const detail = wanted.map((id) => `${id}: ${results.find((r) => r.id === id && !r.ok)?.detail || '(did not fail)'}`).join('\n       ');
    console.log(`${ok ? 'PASS' : 'FAIL'}  mutation ${String(i + 1).padStart(2)}: ${label}\n       -> ${wanted.join(', ')} ${missing.length ? `DID NOT FAIL: ${missing.join(', ')}` : 'failed as required'}${extra.length ? `; unexpected extra failures: ${extra.join(', ')}` : ''}\n       ${detail}`);
    if (!ok) failures++;
  });
  fs.rmSync(base, { recursive: true, force: true });
  console.log(failures ? `\nself-test: ${failures} mutation(s) not caught` : `\nself-test: all ${MUTATIONS.length} mutations caught by exactly the intended check`);
  return failures ? 1 : 0;
}

// ---------------------------------------------------------------- main

const args = process.argv.slice(2);
if (args.includes('--self-test')) {
  process.exit(selfTest());
}
const project = args.find((a) => !a.startsWith('--')) ? path.resolve(args.find((a) => !a.startsWith('--'))) : defaultProject;
if (!fs.existsSync(path.join(project, PBXPROJ))) {
  console.error(`no project at ${project}`);
  process.exit(2);
}
const results = runChecks(project);
for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.id.padEnd(20)} ${r.title}${r.detail ? `\n     ${r.detail}` : ''}`);
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} of ${results.length} checks failed` : `\nall ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
