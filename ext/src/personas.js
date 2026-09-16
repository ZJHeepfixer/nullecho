/**
 * Nullecho — persona pool
 * ────────────────────────
 * A persona is one *internally consistent* machine. We never generate values
 * independently; every entry here describes a real, high-population hardware +
 * OS + browser combination, so that presenting it puts the user inside a crowd
 * rather than making them unique.
 *
 * ── HOST-OS CONSTRAINT (DECISIONS.md D12, added 2026-08-21) ────────────────
 * Selection is constrained to personas whose OS family matches the **host's**
 * OS family. A Mac is never shown a Windows persona.
 *
 * Why: the contradictions that survive the shim — libm results, WebGL extension
 * sets, the font rasterizer, the display layer we already stopped spoofing —
 * all exist *because* the persona's OS differs from the host's. They are
 * engine-level, below the JS layer, and unreachable from a WebExtension. The
 * only way to remove them is to stop claiming a foreign OS.
 *
 * What it costs: nothing that the threat model asks for. The cross-site join is
 * broken by the personas being *different* per origin, not by their being
 * *foreign* — see THREAT-MODEL.md ("the goal is breaking the join between
 * sites") and D9. Hiding which OS you run was never a claim, and the engine
 * leaks it anyway (ARKENFOX-RESPONSE.md claim (a)).
 *
 * What it demands: every family needs enough personas to keep per-origin
 * variety. A macOS user constrained to two personas would get materially weaker
 * separation than a Windows user with five — a regression aimed at one group of
 * users. So the pool carries ≥ MIN_PERSONAS_PER_FAMILY entries per family, and
 * weights are renormalised to sum to 100 *inside* each family (a weight now
 * reads as "percentage of that OS's users", not of the whole pool).
 *
 * Invariants (enforced by persona-validator.js + personas.test.js — do not
 * weaken without a test):
 *   - GPU vendor is possible on the claimed platform.
 *   - cores/memory is a pair that actually ships together.
 *   - font set is the stock set for the claimed OS.
 *   - Client Hints agree with the UA string field by field.
 *   - screen geometry is a common panel, and colorDepth is 24 (never 30 —
 *     HDR is rare enough to re-identify on its own).
 *   - every family has ≥ MIN_PERSONAS_PER_FAMILY entries, weights per family
 *     sum to 100, no persona owns a majority of its family, and each family
 *     spreads across ≥ 3 deviceMemory buckets.
 */

import { UBUNTU_2204_FAMILIES } from './linux-ground-truth.js';

/**
 * Stock font sets. Deliberately conservative: stock OS install, no creative suites.
 *
 * 'windows-11' and 'macos-14' are hand-written from stock-install knowledge and have no
 * measured ground truth in this repo yet. 'ubuntu-22' is not written here at all: it IS
 * the measured `fc-list` of a default Ubuntu 22.04 desktop (src/linux-ground-truth.js,
 * generated from research/linux-ground-truth/). The hand-written version claimed five
 * families no real install has — see that folder's README — and persona-validator.js now
 * rejects any Linux font a real install lacks, so a hand edit cannot bring one back.
 */
export const FONT_SETS = {
  'windows-11': [
    'Arial', 'Arial Black', 'Bahnschrift', 'Calibri', 'Cambria', 'Candara',
    'Comic Sans MS', 'Consolas', 'Constantia', 'Corbel', 'Courier New', 'Ebrima',
    'Franklin Gothic Medium', 'Gabriola', 'Gadugi', 'Georgia', 'Impact',
    'Ink Free', 'Javanese Text', 'Leelawadee UI', 'Lucida Console',
    'Lucida Sans Unicode', 'Malgun Gothic', 'Marlett', 'Microsoft Himalaya',
    'Microsoft JhengHei', 'Microsoft New Tai Lue', 'Microsoft PhagsPa',
    'Microsoft Sans Serif', 'Microsoft Tai Le', 'Microsoft YaHei',
    'Microsoft Yi Baiti', 'MingLiU-ExtB', 'Mongolian Baiti', 'MS Gothic',
    'MV Boli', 'Myanmar Text', 'Nirmala UI', 'Palatino Linotype',
    'Segoe MDL2 Assets', 'Segoe Print', 'Segoe Script', 'Segoe UI',
    'Segoe UI Emoji', 'Segoe UI Historic', 'Segoe UI Symbol', 'SimSun',
    'Sitka', 'Sylfaen', 'Symbol', 'Tahoma', 'Times New Roman',
    'Trebuchet MS', 'Verdana', 'Webdings', 'Wingdings', 'Yu Gothic',
  ],
  'macos-14': [
    'American Typewriter', 'Andale Mono', 'Arial', 'Arial Black',
    'Arial Narrow', 'Arial Rounded MT Bold', 'Arial Unicode MS', 'Avenir',
    'Avenir Next', 'Avenir Next Condensed', 'Baskerville', 'Big Caslon',
    'Bodoni 72', 'Bradley Hand', 'Brush Script MT', 'Chalkboard',
    'Chalkduster', 'Charter', 'Cochin', 'Comic Sans MS', 'Copperplate',
    'Courier New', 'Didot', 'Futura', 'Geneva', 'Georgia', 'Gill Sans',
    'Helvetica', 'Helvetica Neue', 'Herculanum', 'Hoefler Text', 'Impact',
    'Lucida Grande', 'Luminari', 'Marker Felt', 'Menlo', 'Monaco', 'Noteworthy',
    'Optima', 'Palatino', 'Papyrus', 'Phosphate', 'Rockwell', 'Savoye LET',
    'SignPainter', 'Skia', 'Snell Roundhand', 'Tahoma', 'Times New Roman',
    'Trattatello', 'Trebuchet MS', 'Verdana', 'Zapfino',
  ],
  // Measured, not curated — 180 families, verbatim from a real default install.
  // Regenerate with `node research/linux-ground-truth/gen-fontset.mjs`; never type here.
  'ubuntu-22': UBUNTU_2204_FAMILIES,
};

// ── OS families ────────────────────────────────────────────────────────────
//
// Defined here rather than in persona-validator.js because selection now needs
// them; the validator imports and re-exports them so its public surface is
// unchanged.

/** The families the pool ships. Selection can only ever return one of these. */
export const FAMILIES = ['win', 'mac', 'linux'];

/** Which platform family an OS key belongs to. */
export const OS_FAMILY = {
  'windows-10': 'win', 'windows-11': 'win',
  'macos-14': 'mac', 'macos-15': 'mac',
  'ubuntu-22': 'linux', 'fedora-40': 'linux',
};

/** Which platform family a `navigator.platform` value belongs to. */
export const PLATFORM_FAMILY = {
  'Win32': 'win',
  'MacIntel': 'mac',
  'Linux x86_64': 'linux',
  'Linux aarch64': 'linux',
};

/**
 * Where an undetectable host lands. Windows is the largest desktop-Chrome
 * population, so it is the biggest crowd to be wrong inside (D3).
 *
 * The alternative — refuse to pick, i.e. fail closed — would leave the APIs
 * unpatched and expose the real machine, which is strictly worse than showing a
 * consistent persona that happens to name the wrong OS. That is the state we
 * were in for every Mac user until today, and it is survivable; no protection
 * at all is not. Picking *randomly* is also out: selection has to stay a pure
 * function of (salt, origin), or the persona would change between page loads
 * and instability is itself a fingerprint (D2).
 */
export const DEFAULT_FAMILY = 'win';

/** Minimum personas per family. Below this, per-origin variety collapses. */
export const MIN_PERSONAS_PER_FAMILY = 4;

/** The family a persona belongs to, derived from its platform. */
export function familyOf(persona) {
  return (persona && PLATFORM_FAMILY[persona.platform]) || null;
}

/**
 * Map any platform-ish string — `navigator.platform`, `userAgentData.platform`,
 * or a UA string — onto a family. Returns null when it names nothing we ship.
 *
 * ChromeOS maps to `linux` deliberately: it is the one non-{win,mac,linux}
 * platform that can actually run this extension, its `navigator.platform` is
 * already "Linux x86_64", and it shares the engine-level surfaces that motivate
 * this whole constraint — fontconfig/FreeType rasterization and a Mesa GL
 * stack. It is an approximation (the stock font set differs), not a match.
 */
export function familyFromPlatformString(value) {
  if (!value) return null;
  const v = String(value).toLowerCase();
  if (v.includes('win')) return 'win';
  if (v.includes('mac') || v.includes('darwin')) return 'mac';
  if (v.includes('cros') || v.includes('chrome os')) return 'linux';
  if (v.includes('linux') || v.includes('x11') || v.includes('bsd')) return 'linux';
  return null;
}

/**
 * Detect the host's OS family from a navigator-like object.
 *
 * Order matters, and so does *when* this runs:
 *
 *  1. `userAgentData.platform` — the value Chrome actually derives from the OS.
 *     Unlike the UA string it was never frozen, and it is a low-entropy hint
 *     available without a permission prompt.
 *  2. `navigator.platform` — deprecated but universally present, and the only
 *     option in Firefox, which has no `userAgentData` at all.
 *  3. The UA string — last, because Chrome freezes its OS token ("Windows NT
 *     10.0" for every Windows, "Intel Mac OS X 10_15_7" for every Mac), so it
 *     identifies the family but nothing finer.
 *
 * ⚠ In `src/shim.js` this must be read BEFORE the shim patches `navigator`, or
 * it detects the persona instead of the host and the constraint becomes a
 * no-op that quietly re-introduces the contradiction it exists to remove.
 *
 * @returns {'win'|'mac'|'linux'|null} null when the host is something we do not
 *          model (iOS, Android, an exotic UNIX) — callers use DEFAULT_FAMILY.
 */
export function detectHostFamily(nav) {
  if (!nav || typeof nav !== 'object') return null;
  let hit = null;
  try {
    const uad = nav.userAgentData;
    if (uad && typeof uad.platform === 'string') hit = familyFromPlatformString(uad.platform);
  } catch (_) { /* getter threw: fall through */ }
  if (!hit) {
    try { hit = familyFromPlatformString(nav.platform); } catch (_) { /* ignore */ }
  }
  if (!hit) {
    try { hit = familyFromPlatformString(nav.userAgent); } catch (_) { /* ignore */ }
  }
  return hit;
}

let cachedHostFamily;

/**
 * The host family for this process, detected once and cached. The service
 * worker sees a real, unpatched `navigator`; so does `shim.js`, provided it
 * calls this before installing its patches.
 */
export function hostFamily() {
  if (cachedHostFamily === undefined) {
    cachedHostFamily = detectHostFamily(globalThis.navigator) || DEFAULT_FAMILY;
  }
  return cachedHostFamily;
}

/**
 * The pool. Each entry is a machine millions of people own.
 *
 * ── weights ───────────────────────────────────────────────────────────────
 * Weights are market-share estimates *within an OS family*, and each family
 * sums to 100. Renormalising per family is forced by the host-OS constraint:
 * once a Mac user can only ever draw from the six macOS entries, a weight
 * expressed as a share of the whole pool would no longer describe anything.
 *
 * These are estimates, not measurements — worth replacing with Steam-survey /
 * StatCounter figures before public release.
 *
 * ── memory spread ─────────────────────────────────────────────────────────
 * Chrome's desktop `navigator.deviceMemory` clamp is 2–32, not the 8 that is
 * widely repeated (8 is the *Android* ceiling — see persona-validator.js for
 * the source citation and the measurement). Real desktops therefore report
 * their true rounded RAM, so the honest population is spread across 8/16/32.
 *
 * That spread now has to hold *inside each family*, for the same reason the
 * weights do: a pool where every reachable persona claims 16 GB would make
 * "deviceMemory === 16" the tell, which is the D2 failure mode one level up.
 * Per family, by weight:
 *
 *     win    →  8 GB 34% · 16 GB 50% · 32 GB 16%
 *     mac    →  8 GB 40% · 16 GB 46% · 32 GB 14%
 *     linux  →  8 GB 42% · 16 GB 38% · 32 GB 20%
 */
export const PERSONAS = [
  // ══ Windows ══════════════════════════════════════════════════════════════
  {
    id: 'win11-chrome-uhd620',
    weight: 23,
    platform: 'Win32',
    os: 'windows-11',
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
    uaData: {
      platform: 'Windows', platformVersion: '15.0.0',
      architecture: 'x86', bitness: '64', model: '', wow64: false,
    },
    gpu: {
      vendor: 'Google Inc. (Intel)',
      renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 620 (0x00003EA0) Direct3D11 vs_5_0 ps_5_0, D3D11)',
      unmaskedVendor: 'Google Inc. (Intel)',
      maxTextureSize: 16384,
    },
    cores: 8, memory: 8,
    screen: { width: 1920, height: 1080, availHeight: 1032, colorDepth: 24, dpr: 1 },
    fonts: 'windows-11',
  },
  {
    // The single most common Windows laptop class in the world: an 11th/12th-gen
    // Core U-series with Iris Xe, 1080p panel at 125% scaling (→ 1536×864 CSS).
    id: 'win11-chrome-iris-xe',
    weight: 31,
    platform: 'Win32',
    os: 'windows-11',
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
    uaData: {
      platform: 'Windows', platformVersion: '15.0.0',
      architecture: 'x86', bitness: '64', model: '', wow64: false,
    },
    gpu: {
      vendor: 'Google Inc. (Intel)',
      renderer: 'ANGLE (Intel, Intel(R) Iris(TM) Xe Graphics (0x00009A49) Direct3D11 vs_5_0 ps_5_0, D3D11)',
      unmaskedVendor: 'Google Inc. (Intel)',
      maxTextureSize: 16384,
    },
    cores: 8, memory: 16,
    // 1080p at 125% scaling: 1080/1.25 = 864 CSS px, taskbar 60 physical = 48 CSS.
    screen: { width: 1536, height: 864, availHeight: 816, colorDepth: 24, dpr: 1.25 },
    fonts: 'windows-11',
  },
  {
    id: 'win11-chrome-rtx3060',
    weight: 19,
    platform: 'Win32',
    os: 'windows-11',
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
    uaData: {
      platform: 'Windows', platformVersion: '15.0.0',
      architecture: 'x86', bitness: '64', model: '', wow64: false,
    },
    gpu: {
      vendor: 'Google Inc. (NVIDIA)',
      renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      unmaskedVendor: 'Google Inc. (NVIDIA)',
      maxTextureSize: 16384,
    },
    // 16, not 8: nobody builds a 6C/12T machine around an RTX 3060 and then
    // fits it with 8 GB. 16 GB is the standard build for this class.
    cores: 12, memory: 16,
    screen: { width: 1920, height: 1080, availHeight: 1032, colorDepth: 24, dpr: 1 },
    fonts: 'windows-11',
  },
  {
    // Carries the Windows 32 GB bucket. Ryzen 7 7700 (8C/16T) + RTX 4060, 1440p.
    id: 'win11-chrome-rtx4060',
    weight: 16,
    platform: 'Win32',
    os: 'windows-11',
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
    uaData: {
      platform: 'Windows', platformVersion: '15.0.0',
      architecture: 'x86', bitness: '64', model: '', wow64: false,
    },
    gpu: {
      vendor: 'Google Inc. (NVIDIA)',
      renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      unmaskedVendor: 'Google Inc. (NVIDIA)',
      maxTextureSize: 16384,
    },
    cores: 16, memory: 32,
    screen: { width: 2560, height: 1440, availHeight: 1392, colorDepth: 24, dpr: 1 },
    fonts: 'windows-11',
  },
  {
    id: 'win11-chrome-amd-vega',
    weight: 11,
    platform: 'Win32',
    os: 'windows-11',
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
    uaData: {
      platform: 'Windows', platformVersion: '15.0.0',
      architecture: 'x86', bitness: '64', model: '', wow64: false,
    },
    gpu: {
      vendor: 'Google Inc. (AMD)',
      renderer: 'ANGLE (AMD, AMD Radeon(TM) Vega 8 Graphics (0x000015D8) Direct3D11 vs_5_0 ps_5_0, D3D11)',
      unmaskedVendor: 'Google Inc. (AMD)',
      maxTextureSize: 16384,
    },
    cores: 8, memory: 8,
    // 768 - 48 = 720. The Windows 11 taskbar is 48px at 100% scale; 728 would
    // be the Windows 10 taskbar (40px) and contradicts platformVersion 15.0.0.
    screen: { width: 1366, height: 768, availHeight: 720, colorDepth: 24, dpr: 1 },
    fonts: 'windows-11',
  },

  // ══ macOS ════════════════════════════════════════════════════════════════
  //
  // Six entries, expanded from two on 2026-08-21 (D12). Before the host-OS
  // constraint a Mac user drew from the whole pool; after it, these six ARE the
  // pool for every Mac user, so two would have meant a 50/50 coin flip per
  // origin — barely better than no persona at all.
  //
  // Pool policy for the macOS strip: `screen.height - availHeight` is 25 px,
  // the menu bar alone, i.e. a Dock that is auto-hidden or on the side. Dock
  // height is user-configurable and would be per-user entropy; the menu bar is
  // not. Same reasoning as the Windows default-taskbar rule.
  {
    // MacBook Air M1 — the highest-population Mac ever sold. Native 2560×1600
    // at the default "looks like 1440×900" scaled mode.
    id: 'macos-chrome-m1',
    weight: 24,
    platform: 'MacIntel',
    os: 'macos-14',
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
    uaData: {
      platform: 'macOS', platformVersion: '14.6.0',
      architecture: 'arm', bitness: '64', model: '', wow64: false,
    },
    gpu: {
      vendor: 'Google Inc. (Apple)',
      renderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)',
      unmaskedVendor: 'Google Inc. (Apple)',
      maxTextureSize: 16384,
    },
    cores: 8, memory: 8,
    screen: { width: 1440, height: 900, availHeight: 875, colorDepth: 24, dpr: 2 },
    fonts: 'macos-14',
  },
  {
    // MacBook Air 13" M2/M3. Native 2560×1664, default scaled mode is
    // "looks like 1470×956" — the panel every 13" Air since 2022 reports.
    id: 'macos-chrome-m2-air',
    weight: 22,
    platform: 'MacIntel',
    os: 'macos-14',
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
    uaData: {
      platform: 'macOS', platformVersion: '14.6.0',
      architecture: 'arm', bitness: '64', model: '', wow64: false,
    },
    gpu: {
      vendor: 'Google Inc. (Apple)',
      renderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)',
      unmaskedVendor: 'Google Inc. (Apple)',
      maxTextureSize: 16384,
    },
    cores: 8, memory: 16,
    screen: { width: 1470, height: 956, availHeight: 931, colorDepth: 24, dpr: 2 },
    fonts: 'macos-14',
  },
  {
    // Mac mini M2 (base, 8 GB) on a 1080p non-Retina external display — dpr 1.
    // The cheapest Mac there is, and the one most often bought as a desktop.
    id: 'macos-chrome-mini-m2',
    weight: 16,
    platform: 'MacIntel',
    os: 'macos-14',
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
    uaData: {
      platform: 'macOS', platformVersion: '14.6.0',
      architecture: 'arm', bitness: '64', model: '', wow64: false,
    },
    gpu: {
      vendor: 'Google Inc. (Apple)',
      renderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)',
      unmaskedVendor: 'Google Inc. (Apple)',
      maxTextureSize: 16384,
    },
    cores: 8, memory: 8,
    screen: { width: 1920, height: 1080, availHeight: 1055, colorDepth: 24, dpr: 1 },
    fonts: 'macos-14',
  },
  {
    // Any M3 Mac driving a 4K display in the default HiDPI mode: macOS reports
    // 1920×1080 CSS px at dpr 2. Distinct machine from the mini above — same
    // logical size, different GPU, RAM and pixel ratio.
    id: 'macos-chrome-m3-4k',
    weight: 16,
    platform: 'MacIntel',
    os: 'macos-14',
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
    uaData: {
      platform: 'macOS', platformVersion: '14.6.0',
      architecture: 'arm', bitness: '64', model: '', wow64: false,
    },
    gpu: {
      vendor: 'Google Inc. (Apple)',
      renderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M3, Unspecified Version)',
      unmaskedVendor: 'Google Inc. (Apple)',
      maxTextureSize: 16384,
    },
    cores: 8, memory: 16,
    screen: { width: 1920, height: 1080, availHeight: 1055, colorDepth: 24, dpr: 2 },
    fonts: 'macos-14',
  },
  {
    // Carries the macOS 32 GB bucket: an M1 Pro MacBook Pro docked to a 1440p
    // external. The built-in 14"/16" XDR panels are deliberately absent from
    // the whole pool — they report colorDepth 30, which D3 excludes (see
    // HDR_PANELS in persona-validator.js). An external monitor is how these
    // machines are used most of the time anyway.
    id: 'macos-chrome-m1-pro',
    weight: 14,
    platform: 'MacIntel',
    os: 'macos-14',
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
    uaData: {
      platform: 'macOS', platformVersion: '14.6.0',
      architecture: 'arm', bitness: '64', model: '', wow64: false,
    },
    gpu: {
      vendor: 'Google Inc. (Apple)',
      renderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Pro, Unspecified Version)',
      unmaskedVendor: 'Google Inc. (Apple)',
      maxTextureSize: 16384,
    },
    cores: 10, memory: 32,
    screen: { width: 2560, height: 1440, availHeight: 1415, colorDepth: 24, dpr: 1 },
    fonts: 'macos-14',
  },
  {
    id: 'macos-chrome-intel-iris',
    weight: 8,
    platform: 'MacIntel',
    os: 'macos-14',
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
    uaData: {
      platform: 'macOS', platformVersion: '14.6.0',
      architecture: 'x86', bitness: '64', model: '', wow64: false,
    },
    gpu: {
      vendor: 'Google Inc. (Intel)',
      // Chrome has defaulted to the ANGLE Metal backend on macOS since Chrome 100.
      // The old "…, OpenGL 4.1" form paired with a Chrome/151 UA is a contradiction
      // a fingerprinter gets for free.
      renderer: 'ANGLE (Intel, ANGLE Metal Renderer: Intel(R) Iris(TM) Plus Graphics 645, Unspecified Version)',
      unmaskedVendor: 'Google Inc. (Intel)',
      maxTextureSize: 16384,
    },
    // The 2019 13" MacBook Pro shipped in 8 and 16 GB SKUs; 16 is chosen here to
    // spread the macOS memory bucket rather than because 8 was wrong. Weighted
    // lowest in the family: Intel Macs are a shrinking share of the install base.
    cores: 8, memory: 16,
    screen: { width: 1440, height: 900, availHeight: 875, colorDepth: 24, dpr: 2 },
    fonts: 'macos-14',
  },

  // ══ Linux ════════════════════════════════════════════════════════════════
  //
  // Five entries, expanded from one on 2026-08-21 (D12) — a single-persona
  // family means every origin sees the same machine, i.e. no cross-site
  // protection whatsoever for Linux users.
  //
  // ⚠ UNVERIFIED, and the honest caveat on this family: the exact ANGLE/Mesa/
  // NVIDIA renderer strings below are reconstructed from the documented driver
  // formats, not read off a real Ubuntu machine (this lane has no Linux host).
  // The Intel entries follow the same form as the one persona that shipped
  // before today. Verify all five against real Chrome on Ubuntu before public
  // release — a renderer string that no driver emits is a fingerprint of
  // Nullecho itself, which is the D2 failure mode. Same caveat applies to
  // `uaData.platformVersion` on Linux.
  //
  // ✅ What IS verified on this family (2026-09-16): `fonts: 'ubuntu-22'` is the
  // measured font list of a real default Ubuntu 22.04 desktop
  // (src/linux-ground-truth.js, from research/linux-ground-truth/). ONLY the
  // fonts. The renderer strings above remain unverified — a container or VM has
  // no Linux GPU driver and reports SwiftShader/llvmpipe, which proves nothing
  // about them. Do not read the font fix as clearing release blocker #1.
  //
  // Pool policy for the Linux strip: 27 px, the GNOME top bar.
  {
    id: 'linux-chrome-mesa',
    weight: 24,
    platform: 'Linux x86_64',
    os: 'ubuntu-22',
    ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
    uaData: {
      platform: 'Linux', platformVersion: '6.8.0',
      architecture: 'x86', bitness: '64', model: '', wow64: false,
    },
    gpu: {
      vendor: 'Google Inc. (Intel)',
      renderer: 'ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 (KBL GT2), OpenGL 4.6)',
      unmaskedVendor: 'Google Inc. (Intel)',
      maxTextureSize: 16384,
    },
    cores: 8, memory: 8,
    screen: { width: 1920, height: 1080, availHeight: 1053, colorDepth: 24, dpr: 1 },
    fonts: 'ubuntu-22',
  },
  {
    // 11th/12th-gen Core U laptop — the Linux counterpart of win11-chrome-iris-xe,
    // and the most common configuration in the ThinkPad/XPS/Framework crowd.
    id: 'linux-chrome-mesa-xe',
    weight: 22,
    platform: 'Linux x86_64',
    os: 'ubuntu-22',
    ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
    uaData: {
      platform: 'Linux', platformVersion: '6.8.0',
      architecture: 'x86', bitness: '64', model: '', wow64: false,
    },
    gpu: {
      vendor: 'Google Inc. (Intel)',
      renderer: 'ANGLE (Intel, Mesa Intel(R) Xe Graphics (TGL GT2), OpenGL 4.6)',
      unmaskedVendor: 'Google Inc. (Intel)',
      maxTextureSize: 16384,
    },
    cores: 8, memory: 16,
    screen: { width: 1920, height: 1080, availHeight: 1053, colorDepth: 24, dpr: 1 },
    fonts: 'ubuntu-22',
  },
  {
    // Ryzen APU laptop (Renoir). radeonsi reports the driver stack inline; the
    // kernel token matches uaData.platformVersion on purpose — two views of one
    // machine that disagreed would be exactly the contradiction D2 forbids.
    id: 'linux-chrome-amd-renoir',
    weight: 20,
    platform: 'Linux x86_64',
    os: 'ubuntu-22',
    ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
    uaData: {
      platform: 'Linux', platformVersion: '6.8.0',
      architecture: 'x86', bitness: '64', model: '', wow64: false,
    },
    gpu: {
      vendor: 'Google Inc. (AMD)',
      renderer: 'ANGLE (AMD, AMD Radeon Graphics (radeonsi, renoir, LLVM 15.0.7, DRM 3.49, 6.8.0-generic), OpenGL 4.6)',
      unmaskedVendor: 'Google Inc. (AMD)',
      maxTextureSize: 16384,
    },
    cores: 8, memory: 8,
    screen: { width: 1366, height: 768, availHeight: 741, colorDepth: 24, dpr: 1 },
    fonts: 'ubuntu-22',
  },
  {
    // Carries the Linux 32 GB bucket: a desktop with the proprietary NVIDIA
    // driver, which reports through the GL vendor "NVIDIA Corporation" rather
    // than the D3D adapter name Windows uses for the same card.
    id: 'linux-chrome-nvidia-rtx3060',
    weight: 20,
    platform: 'Linux x86_64',
    os: 'ubuntu-22',
    ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
    uaData: {
      platform: 'Linux', platformVersion: '6.8.0',
      architecture: 'x86', bitness: '64', model: '', wow64: false,
    },
    gpu: {
      vendor: 'Google Inc. (NVIDIA Corporation)',
      renderer: 'ANGLE (NVIDIA Corporation, NVIDIA GeForce RTX 3060/PCIe/SSE2, OpenGL 4.5.0 NVIDIA 550.120)',
      unmaskedVendor: 'Google Inc. (NVIDIA Corporation)',
      maxTextureSize: 16384,
    },
    cores: 12, memory: 32,
    screen: { width: 2560, height: 1440, availHeight: 1413, colorDepth: 24, dpr: 1 },
    fonts: 'ubuntu-22',
  },
  {
    // Office desktop / refurbished SFF box: 8th-gen Core i5 with UHD 630.
    id: 'linux-chrome-mesa-uhd630',
    weight: 14,
    platform: 'Linux x86_64',
    os: 'ubuntu-22',
    ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
    uaData: {
      platform: 'Linux', platformVersion: '6.8.0',
      architecture: 'x86', bitness: '64', model: '', wow64: false,
    },
    gpu: {
      vendor: 'Google Inc. (Intel)',
      renderer: 'ANGLE (Intel, Mesa Intel(R) UHD Graphics 630 (CFL GT2), OpenGL 4.6)',
      unmaskedVendor: 'Google Inc. (Intel)',
      maxTextureSize: 16384,
    },
    cores: 6, memory: 16,
    screen: { width: 1600, height: 900, availHeight: 873, colorDepth: 24, dpr: 1 },
    fonts: 'ubuntu-22',
  },
];

/** The personas a host in `family` can be shown. Never empty. */
export function personasForFamily(family) {
  const want = FAMILIES.includes(family) ? family : DEFAULT_FAMILY;
  const list = PERSONAS.filter((p) => familyOf(p) === want);
  // A family with no entries would mean no persona at all, i.e. no protection.
  // Falling back to the default family keeps the guarantee; validatePool() makes
  // this unreachable in a shipped build by requiring every family to be stocked.
  return list.length ? list : PERSONAS.filter((p) => familyOf(p) === DEFAULT_FAMILY);
}

// ── deterministic selection ────────────────────────────────────────────────

/**
 * FNV-1a. We need a stable, dependency-free integer hash — not a secure one.
 * The salt supplies unpredictability; this only has to distribute evenly.
 */
export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Seed for one (salt, origin) pair. Same inputs → same persona, always. */
export function seedFor(salt, origin) {
  return hashString(`${salt}::${origin}`);
}

/** xorshift32 PRNG — deterministic stream from a seed. */
export function rngFrom(seed) {
  let s = seed || 1;
  return function next() {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;  s >>>= 0;
    return s / 0x100000000;
  };
}

/**
 * Pick a persona for an origin, from the host's OS family only (D12).
 *
 * Weighted so that common machines are chosen far more often than rare ones —
 * the point is to land in a big crowd.
 *
 * Determinism is unchanged by the family constraint: the seed is still
 * `hash(salt::origin)`, the PRNG stream is still consumed in the same order
 * (one draw for the roll, then three for the noise keys), so the noise keys for
 * a given (salt, origin) are byte-for-byte what they were before. Only the
 * candidate list narrows.
 *
 * @param {string} salt    session salt (or the public fallback pepper)
 * @param {string} origin  registrable domain — the persona boundary
 * @param {'win'|'mac'|'linux'} [family] host family. Omitted (`undefined`) means
 *        "detect the host". `null` or anything unrecognised means "the host is
 *        one we do not model" and lands on DEFAULT_FAMILY — the two cases are
 *        different and a caller that has already run detection should pass its
 *        null through rather than dropping the argument.
 */
export function personaFor(salt, origin, family = hostFamily()) {
  const seed = seedFor(salt, origin);
  const rand = rngFrom(seed);
  const pool = personasForFamily(family);
  const total = pool.reduce((a, p) => a + p.weight, 0);
  let roll = rand() * total;
  let chosen = pool[pool.length - 1];
  for (const p of pool) {
    roll -= p.weight;
    if (roll <= 0) { chosen = p; break; }
  }
  return {
    ...chosen,
    fontList: FONT_SETS[chosen.fonts],
    seed,
    // Per-origin noise keys. Derived from the same seed, so canvas/audio noise
    // is stable for this origin+session — which is precisely what defeats the
    // repeated-sampling attack that broke per-read noise schemes.
    noise: {
      canvas: rand(),
      audio: rand(),
      webgl: rand(),
    },
  };
}

/**
 * Session salt. Rotating this re-rolls every origin's persona at once, which is
 * the user-facing "new identity" button. Stored by the service worker.
 */
export function newSalt() {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
}
