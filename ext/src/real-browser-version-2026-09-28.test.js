/**
 * D51 (2026-09-28) — the page sees the browser's REAL version, brands and full version.
 *
 * Found in the owner's Chrome 153.0.8010.54 (macOS, arm): a blob Worker — which the shim does
 * not reach (A8) — reported the real `Chrome/153.0.0.0`, the real brands
 * `[Google Chrome/153, Not_A Brand/8, Chromium/153]` in that order, and the real full version,
 * while every page's main thread said `Chrome/151.0.0.0` with a fixed `Not;A=Brand/99` GREASE
 * entry in a fixed order, and the static header rules said the same on the wire. Inside an OS
 * family every persona's UA string and low-entropy hints equal the real reduced UA except the
 * version, so the rewrite hid nothing and only added a claim the browser contradicts — TLS,
 * features, Google's X-Client-Data, any Worker — and Chrome auto-updates every four weeks, so
 * every install drifted into it. Chrome for Testing 146/149 (the harness browsers) had the same
 * contradiction, and no check caught it.
 *
 * Every test here fakes the machine as a browser that is NOT 151 — Chrome 999 with its brands
 * in a non-default order and a GREASE entry that is not the shim's old constant — through
 * `test-realm-rig.js`'s `bootRealm({ real })`, whose NavigatorUAData is modelled on what CfT
 * 146/149 measured on 2026-09-28 (see the rig). Run against the pre-D51 shim with
 * `NULLECHO_SHIM_SRC=<old shim.js>` to see which of these fail on it; the ones that pass there
 * are marked GUARD and exist to keep the NEW implementation honest.
 *
 * Run: `node --test` from `ext/`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { bootRealm, HERE, SHIM_SRC } from './test-realm-rig.js';
import { PERSONAS, FONT_SETS } from './personas.js';

// ── the machines ───────────────────────────────────────────────────────────

const brandList = (spec) => spec.map(([brand, version]) => ({ brand, version }));

/** An Intel Mac on "Chrome 999": arch x86 and macOS 26 are the REAL values the persona must still cover. */
const MAC999 = {
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/999.0.0.0 Safari/537.36',
  appVersion: '5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/999.0.0.0 Safari/537.36',
  platform: 'MacIntel', vendor: 'Google Inc.',
  uaData: {
    brands: brandList([['Google Chrome', '999'], ['Not_A Brand', '8'], ['Chromium', '999']]),
    mobile: false, platform: 'macOS',
    he: {
      architecture: 'x86', bitness: '64', model: '', platformVersion: '26.6.0', wow64: false,
      uaFullVersion: '999.0.1234.56', formFactors: ['Desktop'],
      fullVersionList: brandList([['Google Chrome', '999.0.1234.56'], ['Not_A Brand', '8.0.0.0'], ['Chromium', '999.0.1234.56']]),
    },
  },
};

/** Microsoft Edge on Windows on ARM: a non-Google brand, an `Edg/` token, and arch arm under a frozen x64 UA. */
const EDGE999 = {
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/999.0.0.0 Safari/537.36 Edg/999.0.0.0',
  appVersion: '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/999.0.0.0 Safari/537.36 Edg/999.0.0.0',
  platform: 'Win32', vendor: 'Google Inc.',
  uaData: {
    brands: brandList([['Not)A;Brand', '24'], ['Microsoft Edge', '999'], ['Chromium', '999']]),
    mobile: false, platform: 'Windows',
    he: {
      architecture: 'arm', bitness: '64', model: '', platformVersion: '19.0.0', wow64: false,
      uaFullVersion: '999.0.2000.7', formFactors: ['Desktop'],
      fullVersionList: brandList([['Not)A;Brand', '24.0.0.0'], ['Microsoft Edge', '999.0.2000.7'], ['Chromium', '999.0.2000.7']]),
    },
  },
};

/** An ARM Chromebook: `CrOS` in the UA, "Chrome OS" in the hints — a platform in no family. */
const CROS999 = {
  userAgent: 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/999.0.0.0 Safari/537.36',
  appVersion: '5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/999.0.0.0 Safari/537.36',
  platform: 'Linux aarch64', vendor: 'Google Inc.',
  uaData: {
    brands: brandList([['Chromium', '999'], ['Google Chrome', '999'], ['Not-A.Brand', '24']]),
    mobile: false, platform: 'Chrome OS',
    he: {
      architecture: 'arm', bitness: '64', model: '', platformVersion: '16181.61.0', wow64: false,
      uaFullVersion: '999.0.3000.1', formFactors: ['Desktop'],
      fullVersionList: brandList([['Chromium', '999.0.3000.1'], ['Google Chrome', '999.0.3000.1'], ['Not-A.Brand', '24.0.0.0']]),
    },
  },
};

/** Chrome on Linux aarch64: the reduced UA still says x86_64; navigator.platform and the arch hint do not. */
const LINUXARM999 = {
  userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/999.0.0.0 Safari/537.36',
  appVersion: '5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/999.0.0.0 Safari/537.36',
  platform: 'Linux aarch64', vendor: 'Google Inc.',
  uaData: {
    brands: brandList([['Not-A.Brand', '24'], ['Chromium', '999'], ['Google Chrome', '999']]),
    mobile: false, platform: 'Linux',
    he: {
      architecture: 'arm', bitness: '64', model: '', platformVersion: '6.14.0', wow64: false,
      uaFullVersion: '999.0.4000.2', formFactors: ['Desktop'],
      fullVersionList: brandList([['Not-A.Brand', '24.0.0.0'], ['Chromium', '999.0.4000.2'], ['Google Chrome', '999.0.4000.2']]),
    },
  },
};

/** Firefox: no userAgentData at all, an empty vendor, and a UA that names the architecture. */
const FIREFOX_MAC = {
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:140.0) Gecko/20100101 Firefox/140.0',
  appVersion: '5.0 (Macintosh)', platform: 'MacIntel', vendor: '',
};
const FIREFOX_LINUX_ARM = {
  userAgent: 'Mozilla/5.0 (X11; Linux aarch64; rv:140.0) Gecko/20100101 Firefox/140.0',
  appVersion: '5.0 (X11)', platform: 'Linux aarch64', vendor: '',
};

// ── the personas, as the service worker delivers them ──────────────────────

const delivered = (id, extra = {}) => {
  const p = PERSONAS.find((x) => x.id === id);
  assert.ok(p, `rig: no persona ${id}`);
  return { ...p, fontList: FONT_SETS[p.fonts], seed: 0x0badf00d, noise: { canvas: 0.31, audio: 0.57, webgl: 0.73 }, ...extra };
};
const MAC_PERSONA = delivered('macos-chrome-m1-pro');        // arm, 14.6.0, cores 10
const WIN_PERSONA = delivered('win11-chrome-rtx3060');       // x86, 15.0.0, cores 12
const LINUX_PERSONA = delivered('linux-chrome-mesa-xe');     // x86, 6.8.0, cores 8

const HE_ALL = ['architecture', 'bitness', 'model', 'platformVersion', 'uaFullVersion', 'fullVersionList', 'wow64', 'formFactors'];
const PERSONA_HINTS = ['architecture', 'bitness', 'model', 'platformVersion', 'wow64'];
const plain = (x) => JSON.parse(JSON.stringify(x));
const he = (s, hints = HE_ALL) => s.page(`navigator.userAgentData.getHighEntropyValues(${JSON.stringify(hints)})`);
/** Settle a promise that belongs to the vm realm (a cross-realm rejection must still reach us). */
const settle = (p) => new Promise((resolve) => p.then((v) => resolve({ ok: true, v }), (e) => resolve({ ok: false, e })));

// ═══════════════════════════════════════════════════════════════════════════

test('D51: navigator.userAgent and appVersion are the real browser\'s — on the fallback, after the handshake, and when a delivered persona still carries a stale `ua`', () => {
  const s = bootRealm({ real: MAC999 });
  assert.equal(s.page('navigator.userAgent'), MAC999.userAgent, 'fallback persona: the UA is the real one');
  assert.equal(s.page('navigator.appVersion'), MAC999.appVersion);
  s.upgrade({ persona: MAC_PERSONA });
  assert.equal(s.page('navigator.hardwareConcurrency'), MAC_PERSONA.cores, 'sanity: the delivered persona is in place');
  assert.equal(s.page('navigator.userAgent'), MAC999.userAgent, 'delivered persona: the UA is the real one');
  assert.equal(s.page('navigator.appVersion'), MAC999.appVersion);

  // An old service worker mid-update, or a harness page, can still hand the shim a persona with
  // a `ua` in it. The shim must not be talked back into claiming a version.
  const t = bootRealm({ real: MAC999 });
  t.upgrade({ persona: { ...MAC_PERSONA, ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36' } });
  assert.equal(t.page('navigator.hardwareConcurrency'), MAC_PERSONA.cores, 'sanity: delivered');
  assert.equal(t.page('navigator.userAgent'), MAC999.userAgent, 'a persona `ua` field is ignored');
});

test('D51: userAgentData.brands is the browser\'s own list verbatim — its GREASE entry, its order — fresh and frozen per read; toJSON() the same', () => {
  const s = bootRealm({ real: MAC999 });
  s.upgrade({ persona: MAC_PERSONA });
  assert.deepEqual(plain(s.page('navigator.userAgentData.brands')), MAC999.uaData.brands);
  assert.equal(s.page('navigator.userAgentData.brands === navigator.userAgentData.brands'), false, 'a fresh array per read (D27, measured)');
  assert.equal(s.page('Object.isFrozen(navigator.userAgentData.brands)'), true);
  assert.equal(s.page('Object.isFrozen(navigator.userAgentData.brands[0])'), false);
  assert.equal(s.page('navigator.userAgentData.platform'), 'macOS');
  assert.equal(s.page('navigator.userAgentData.mobile'), false);
  assert.deepEqual(plain(s.page('navigator.userAgentData.toJSON()')), { brands: MAC999.uaData.brands, mobile: false, platform: 'macOS' });
  assert.deepEqual(plain(s.page('Object.keys(navigator.userAgentData.toJSON())')), ['brands', 'mobile', 'platform']);
});

test('D51: getHighEntropyValues — the version fields are the browser\'s, the five platform fields are the persona\'s', async () => {
  const s = bootRealm({ real: MAC999 });
  const beforeHandshake = plain(await he(s));
  s.upgrade({ persona: MAC_PERSONA });
  const after = plain(await he(s));
  for (const [label, v] of [['fallback', beforeHandshake], ['delivered', after]]) {
    assert.equal(v.uaFullVersion, '999.0.1234.56', `${label}: uaFullVersion is real`);
    assert.deepEqual(v.fullVersionList, MAC999.uaData.he.fullVersionList, `${label}: fullVersionList is real, verbatim`);
    assert.deepEqual(v.brands, MAC999.uaData.brands, `${label}: brands are real`);
    assert.deepEqual(v.formFactors, ['Desktop']);
    assert.equal(v.platform, 'macOS');
    assert.equal(v.mobile, false);
    // What still varies per persona is the persona's — the real Intel Mac on macOS 26 is covered.
    assert.equal(v.architecture, 'arm', `${label}: the persona's architecture, not the real x86`);
    assert.equal(v.platformVersion, '14.6.0', `${label}: the persona's platformVersion, not the real 26.6.0`);
    assert.equal(v.bitness, '64');
    assert.equal(v.model, '');
    assert.equal(v.wow64, false);
  }
  // Only what was asked for (plus the low-entropy trio), as the engine does.
  assert.deepEqual(Object.keys(await he(s, ['uaFullVersion'])), ['brands', 'mobile', 'platform', 'uaFullVersion']);
  assert.deepEqual(Object.keys(await he(s, [])), ['brands', 'mobile', 'platform']);
});

test('D51: getHighEntropyValues keys come back in the engine\'s lexicographic order (measured, CfT 146/149)', async () => {
  const s = bootRealm({ real: MAC999 });
  s.upgrade({ persona: MAC_PERSONA });
  assert.deepEqual(Object.keys(await he(s, ['wow64', 'uaFullVersion', 'platformVersion', 'model', 'fullVersionList', 'formFactors', 'bitness', 'architecture'])),
    ['architecture', 'bitness', 'brands', 'formFactors', 'fullVersionList', 'mobile', 'model', 'platform', 'platformVersion', 'uaFullVersion', 'wow64']);
  assert.deepEqual(Object.keys(await he(s, ['platformVersion', 'architecture'])), ['architecture', 'brands', 'mobile', 'platform', 'platformVersion']);
  assert.equal(s.page('Object.getPrototypeOf(navigator.userAgentData.getHighEntropyValues([])) === Promise.prototype'), true, 'a promise of the page realm');
  const v = await he(s, ['fullVersionList']);
  assert.equal(Object.getPrototypeOf(v), s.page('Object.prototype'), 'a plain object of the page realm');
  assert.equal(Object.isFrozen(v.fullVersionList), false, 'fullVersionList is an unfrozen dictionary member (measured)');
});

test('D51 GUARD: the real API is never asked for a hint the persona answers — even through an Array iterator hook, and an Object.prototype.then trap sees no real platform value', async () => {
  const s = bootRealm({ real: MAC999 });
  s.upgrade({ persona: MAC_PERSONA });
  s.page(`
    globalThis.__seen = [];
    Object.defineProperty(Object.prototype, 'then', { configurable: true, get() {
      if (this && typeof this === 'object' && 'platform' in this && 'brands' in this) __seen.push(Object.keys(this).join(',') + '|' + this.platformVersion + '|' + this.architecture);
      return undefined;
    } });
    const it = Array.prototype[Symbol.iterator];
    Array.prototype[Symbol.iterator] = function () {
      const inner = Reflect.apply(it, this, []);
      let extra = ['platformVersion', 'architecture', 'bitness', 'model', 'wow64'];
      return { next() { const r = inner.next(); if (!r.done) return r; return extra.length ? { value: extra.shift(), done: false } : r; } };
    };
  `);
  const v = plain(await he(s, ['fullVersionList']));
  s.page('delete Object.prototype.then');
  const asked = plain(s.page('__rigAsked'));
  for (const h of PERSONA_HINTS) assert.ok(!asked.includes(h), `the engine was asked for "${h}": ${asked.join(',')}`);
  const seen = plain(s.page('__seen'));
  assert.ok(seen.length > 0, 'rig: the then-trap did fire (positive control)');
  for (const line of seen) {
    assert.doesNotMatch(line, /26\.6\.0|\|x86/, `the page saw a REAL platform value through the thenable check: ${line}`);
  }
  // The hooked iterator did extend the page's own request, so the answer carries those keys —
  // from the persona.
  assert.equal(v.platformVersion, '14.6.0');
  assert.equal(v.architecture, 'arm');
  assert.deepEqual(v.fullVersionList, MAC999.uaData.he.fullVersionList);
});

test('D51: a wrong receiver gets the engine\'s REJECTION, not a synchronous throw (measured: CfT rejects with "Illegal invocation")', async () => {
  const s = bootRealm({ real: MAC999 });
  s.upgrade({ persona: MAC_PERSONA });
  let p;
  assert.doesNotThrow(() => { p = s.page('NavigatorUAData.prototype.getHighEntropyValues.call({}, ["architecture"])'); }, 'the engine never throws here');
  const r = await settle(p);
  assert.equal(r.ok, false);
  assert.equal(r.e.name, 'TypeError');
  assert.match(r.e.message, /Illegal invocation/);
  assert.throws(() => s.page('NavigatorUAData.prototype.toJSON.call({})'), /Illegal invocation/, 'toJSON does throw synchronously (measured)');
});

test('D51: argument errors are the engine\'s own — none, null, a plain object, a Symbol hint, a throwing iterator — and a Set is a sequence', async () => {
  const s = bootRealm({ real: MAC999 });
  s.upgrade({ persona: MAC_PERSONA });
  const cases = [
    ['navigator.userAgentData.getHighEntropyValues()', /1 argument required/],
    ['navigator.userAgentData.getHighEntropyValues(null)', /cannot be converted to a sequence/],
    ['navigator.userAgentData.getHighEntropyValues("architecture")', /cannot be converted to a sequence/],
    ['navigator.userAgentData.getHighEntropyValues({})', /callable @@iterator/],
    ['navigator.userAgentData.getHighEntropyValues([Symbol("x")])', /Cannot convert a Symbol value to a string/],
    ['navigator.userAgentData.getHighEntropyValues({ [Symbol.iterator]() { throw new RangeError("mine"); } })', /^mine$/],
  ];
  for (const [code, re] of cases) {
    let p;
    assert.doesNotThrow(() => { p = s.page(code); }, `${code} threw synchronously`);
    const r = await settle(p);
    assert.equal(r.ok, false, `${code} resolved`);
    assert.match(r.e.message, re, code);
  }
  const set = plain(await s.page('navigator.userAgentData.getHighEntropyValues(new Set(["platformVersion", "uaFullVersion"]))'));
  assert.deepEqual(Object.keys(set), ['brands', 'mobile', 'platform', 'platformVersion', 'uaFullVersion']);
  assert.equal(set.platformVersion, '14.6.0');
  assert.equal(set.uaFullVersion, '999.0.1234.56');
  // A hint's own toString is called exactly once, as the engine does.
  s.page('globalThis.__ts = 0');
  await s.page('navigator.userAgentData.getHighEntropyValues([{ toString() { __ts++; return "bitness"; } }])');
  assert.equal(s.page('__ts'), 1);
});

test('D51 GUARD: standing down leaves userAgentData entirely the engine\'s', async () => {
  const s = bootRealm({ real: MAC999 });
  s.upgrade({ persona: null, enabled: false });
  const v = plain(await he(s));
  assert.equal(v.architecture, 'x86');
  assert.equal(v.platformVersion, '26.6.0');
  assert.equal(s.page('navigator.hardwareConcurrency'), 12, 'sanity: stood down');
});

test('D51: nothing a page can read says 151 or the old fixed GREASE brand', async () => {
  for (const [real, persona] of [[MAC999, MAC_PERSONA], [EDGE999, WIN_PERSONA], [LINUXARM999, LINUX_PERSONA]]) {
    const s = bootRealm({ real });
    const reads = () => [
      s.page('navigator.userAgent'), s.page('navigator.appVersion'), s.page('navigator.vendor'), s.page('navigator.platform'),
      JSON.stringify(s.page('navigator.userAgentData.brands')), JSON.stringify(s.page('navigator.userAgentData.toJSON()')),
    ];
    const all = [...reads(), JSON.stringify(await he(s))];
    s.upgrade({ persona });
    all.push(...reads(), JSON.stringify(await he(s)));
    for (const v of all) {
      assert.doesNotMatch(v, /\b151\b/, `${real.userAgent.slice(13, 40)}: a page read "151": ${v}`);
      assert.doesNotMatch(v, /Not;A=Brand/, `the shim's old fixed GREASE entry: ${v}`);
    }
  }
});

test('D51 edge — Microsoft Edge: the non-Google brand, its order and "Edg/" pass through; the persona still covers Windows-on-ARM', async () => {
  const s = bootRealm({ real: EDGE999 });
  s.upgrade({ persona: WIN_PERSONA });
  assert.equal(s.page('navigator.userAgent'), EDGE999.userAgent);
  assert.deepEqual(plain(s.page('navigator.userAgentData.brands')), EDGE999.uaData.brands);
  assert.equal(s.page('navigator.platform'), 'Win32');
  const v = plain(await he(s));
  assert.deepEqual(v.fullVersionList, EDGE999.uaData.he.fullVersionList);
  assert.equal(v.uaFullVersion, '999.0.2000.7');
  assert.equal(v.architecture, 'x86', 'the persona, not the real arm');
  assert.equal(v.platformVersion, '15.0.0', 'the persona, not the real 19.0.0');
});

test('D51 edge — ChromeOS, a platform in no family: navigator.platform and every hint are the real ones, so nothing contradicts the real "CrOS" UA', async () => {
  const s = bootRealm({ real: CROS999 });
  const check = async (label) => {
    assert.equal(s.page('navigator.userAgent'), CROS999.userAgent, label);
    assert.equal(s.page('navigator.userAgentData.platform'), 'Chrome OS', `${label}: never "Linux" next to a CrOS UA`);
    assert.equal(s.page('navigator.platform'), 'Linux aarch64', `${label}: the real platform, which agrees with the real arch`);
    const v = plain(await he(s));
    assert.equal(v.architecture, 'arm', label);
    assert.equal(v.platformVersion, '16181.61.0', `${label}: a Linux kernel version next to "Chrome OS" would be a contradiction`);
    assert.deepEqual(v.fullVersionList, CROS999.uaData.he.fullVersionList, label);
  };
  await check('fallback');
  s.upgrade({ persona: LINUX_PERSONA });
  assert.equal(s.page('navigator.hardwareConcurrency'), LINUX_PERSONA.cores, 'the rest of the persona still applies');
  await check('delivered');
});

test('D51 edge — Linux on ARM, Chrome: the persona\'s x86_64 platform and x86 arch stand, consistent with Chrome\'s frozen x86_64 UA', async () => {
  const s = bootRealm({ real: LINUXARM999 });
  s.upgrade({ persona: LINUX_PERSONA });
  assert.equal(s.page('navigator.userAgent'), LINUXARM999.userAgent);
  assert.equal(s.page('navigator.platform'), 'Linux x86_64', 'the persona, which the reduced UA already agrees with');
  const v = plain(await he(s));
  assert.equal(v.architecture, 'x86');
  assert.equal(v.platformVersion, '6.8.0');
  assert.equal(v.uaFullVersion, '999.0.4000.2');
});

test('D51 edge — Firefox (no userAgentData): the real Firefox UA and empty vendor, no userAgentData invented, and navigator.platform follows a UA that names the arch', () => {
  const s = bootRealm({ real: FIREFOX_MAC });
  s.upgrade({ persona: MAC_PERSONA });
  assert.equal(s.page('navigator.hardwareConcurrency'), MAC_PERSONA.cores, 'sanity: the persona is in place');
  assert.equal(s.page('navigator.userAgent'), FIREFOX_MAC.userAgent, 'never a Chrome UA on Firefox');
  assert.equal(s.page('navigator.appVersion'), FIREFOX_MAC.appVersion);
  assert.equal(s.page('navigator.vendor'), '', 'Firefox\'s vendor is empty; "Google Inc." next to a Firefox UA is a lie');
  assert.equal(s.page('"userAgentData" in navigator'), false, 'no userAgentData is invented');
  assert.equal(s.page('typeof NavigatorUAData'), 'undefined');
  assert.equal(s.page('navigator.platform'), 'MacIntel');

  const t = bootRealm({ real: FIREFOX_LINUX_ARM });
  t.upgrade({ persona: LINUX_PERSONA });
  assert.equal(t.page('navigator.userAgent'), FIREFOX_LINUX_ARM.userAgent);
  assert.equal(t.page('navigator.platform'), 'Linux aarch64', 'the UA says aarch64, so "Linux x86_64" would contradict it');
});

test('D51 GUARD: a persona\'s uaData is read as OWN fields — a page\'s Object.prototype cannot fill one a delivery omitted (D29)', async () => {
  const s = bootRealm({ real: MAC999 });
  s.page(`Object.prototype.platformVersion = '66.6.6'; Object.prototype.model = 'EVIL'; Object.prototype.architecture = 'EVIL';`);
  const { platformVersion, model, ...rest } = MAC_PERSONA.uaData;
  s.upgrade({ persona: { ...MAC_PERSONA, uaData: rest } });
  assert.equal(s.page('navigator.hardwareConcurrency'), MAC_PERSONA.cores, 'sanity: delivered');
  const v = plain(await he(s, ['platformVersion', 'model', 'architecture']));
  s.page('delete Object.prototype.platformVersion; delete Object.prototype.model; delete Object.prototype.architecture;');
  assert.equal(v.platformVersion, '', 'an omitted field is empty, never the page\'s');
  assert.equal(v.model, '');
  assert.equal(v.architecture, 'arm', 'a delivered field is the persona\'s');
});

test('D51: the source — personas carry no browser version, and the shim has no fixed brand list or GREASE constant', () => {
  const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');
  const personas = strip(fs.readFileSync(path.join(HERE, 'personas.js'), 'utf8'));
  assert.doesNotMatch(personas, /Chrome\/\d/, 'personas.js carries a Chrome version');
  for (const p of PERSONAS) assert.equal(p.ua, undefined, `${p.id} still has a ua`);
  const shim = strip(SHIM_SRC);          // honours NULLECHO_SHIM_SRC, like every other test here
  assert.doesNotMatch(shim, /Chrome\/\d/, 'shim.js carries a Chrome version');
  assert.doesNotMatch(shim, /Not;A=Brand|\bGREASE\b/, 'shim.js still has a GREASE constant');
  assert.doesNotMatch(shim, /['"]Google Chrome['"]/, 'shim.js still names a brand');
});
