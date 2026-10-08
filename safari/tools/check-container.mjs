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
    const files = listFiles(project, (p) => /\.(swift|pbxproj|plist|sh|md|xcscheme|xcprivacy|json)$/.test(p));
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
];

function replaceIn(project, rel, from, to, count = Infinity, skip = 0) {
  const file = path.join(project, rel);
  let text = fs.readFileSync(file, 'utf8');
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
    const ok = failed.includes(m.id) && failed.every((id) => id === m.id);
    const label = m.label || m.id;
    const detail = results.find((r) => r.id === m.id && !r.ok)?.detail || '(did not fail)';
    console.log(`${ok ? 'PASS' : 'FAIL'}  mutation ${String(i + 1).padStart(2)}: ${label}\n       -> ${m.id} ${failed.includes(m.id) ? 'failed as required' : 'DID NOT FAIL'}${failed.filter((id) => id !== m.id).length ? `; unexpected extra failures: ${failed.filter((id) => id !== m.id).join(', ')}` : ''}\n       ${detail}`);
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
