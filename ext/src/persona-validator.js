/**
 * Nullecho — persona consistency validator
 * ─────────────────────────────────────────
 * The whole design rests on personas being *internally consistent*. A persona
 * that contradicts itself is worse than no protection at all: fraud-detection
 * vendors already cross-reference 5–6 signal layers, so a Windows UA next to an
 * Apple GPU string does not read as "unknown machine", it reads as "evasive
 * client". See docs/ARCHITECTURE.md → "Pool invariants" and DECISIONS.md D2/D3.
 *
 * `validatePersona(p)` → `{ valid, errors }`. It never throws, because it is fed
 * deliberately-malformed fixtures by the test suite.
 *
 * Sources for the non-obvious constants are cited inline. Where a fact is
 * implementation-defined rather than specified, the citation says so — the
 * checks that would over-fit are ranges, not equalities.
 */

import {
  FONT_SETS, PERSONAS, FAMILIES, OS_FAMILY, PLATFORM_FAMILY, familyOf,
  MIN_PERSONAS_PER_FAMILY,
} from './personas.js';
import { LINUX_FONT_GROUND_TRUTH } from './linux-ground-truth.js';

// Re-exported: these moved to personas.js when selection started depending on
// them (D12). Importers of the validator keep working.
export { OS_FAMILY, PLATFORM_FAMILY, FAMILIES, MIN_PERSONAS_PER_FAMILY };

// ── constants, with sourcing ───────────────────────────────────────────────

/**
 * `navigator.hardwareConcurrency` values that correspond to real desktop parts.
 * Odd counts and 3 are the classic naive-randomizer tell. 1 is excluded both as
 * unrealistic and because it breaks WASM thread-pool sizing (ARCHITECTURE.md →
 * "Compatibility posture").
 */
export const CORE_COUNTS = [2, 4, 6, 8, 10, 12, 16];

/**
 * `navigator.deviceMemory` is physical RAM rounded to the nearest power of two,
 * then clamped to *implementation-defined* bounds — the Device Memory spec sets
 * no fixed ceiling of its own.
 *
 * VERIFIED 2026-08-20 against Chromium HEAD,
 * `third_party/blink/common/device_memory/approximated_device_memory.cc`:
 *
 *     float kMinMemory = 2.0f;
 *     float kMaxMemory = 32.0f;
 *     #if BUILDFLAG(IS_ANDROID)
 *       kMinMemory = 1.0f;
 *       kMaxMemory = 8.0f;
 *     #endif
 *
 * with the comment "Limit the values to reduce fingerprintability. See:
 * https://crbug.com/454354290 for updated limits."
 *
 * So the widely-repeated "Chrome caps deviceMemory at 8" is now true only on
 * **Android**. On desktop the range is 2–32, and the reachable desktop values
 * are 2, 4, 8, 16, 32. Confirmed empirically on real Chrome 151 (macOS, 32 GB
 * M2 Max): `navigator.deviceMemory === 32`, reproduced in Chromium 148.
 *
 * Consequence for the pool: 8 is no longer what everybody reports, so a pool in
 * which every persona claims 8 would itself be a cluster. See personas.js.
 *
 * MEMORY_VALUES is pool policy — plausible modern machine sizes. 2 GB is
 * reachable on desktop (anything ≤3 GB clamps up to it) but is not a machine
 * class worth claiming in 2026. MAX_DEVICE_MEMORY stays as a guard so a future
 * edit adding 64 is rejected.
 */
export const MEMORY_VALUES = [4, 8, 16, 32];
export const MAX_DEVICE_MEMORY = 32;

/**
 * colorDepth 24. HDR/10-bit displays report 30 and are still the minority of
 * desktops (~20% of panels, and fewer actually driven in 10-bit), so 24 remains
 * the crowd — DECISIONS.md D3 stands.
 *
 * The subtlety: this is only safe while the pool contains no HDR panel. A
 * 10-bit display reporting 24 would be its own contradiction, so HDR_PANELS
 * below is rejected outright rather than silently paired with 24.
 */
export const REQUIRED_COLOR_DEPTH = 24;

/**
 * High-population *logical* (CSS-pixel) panel sizes. The pool exists to put the
 * user in a crowd, so an unusual-but-real resolution is a defect here.
 */
export const COMMON_PANELS = [
  [1280, 720], [1280, 800], [1280, 1024], [1366, 768], [1440, 900],
  // 1470×956 is the default scaled mode of every 13" MacBook Air since the M2
  // (2022) — native 2560×1664. Added 2026-08-21 with the macOS family expansion
  // (D12): an odd-looking size, but a very large crowd.
  [1470, 956],
  [1536, 864], [1600, 900], [1680, 1050],
  [1920, 1080], [1920, 1200], [2560, 1440], [2560, 1600], [3840, 2160],
];

/**
 * Common panels that are 10-bit, and therefore make Chrome report colorDepth 30.
 * Excluded from the pool by D3 — not because the machines are rare, but because
 * the colour depth they force is.
 *
 * 1512×982 (14" MacBook Pro, Liquid Retina XDR) is MEASURED: Chrome 151 on that
 * exact panel returns colorDepth 30, pixelDepth 30, `(dynamic-range: high)` and
 * `(color-gamut: p3)`. 1728×1117 (16" MacBook Pro) is INFERRED from the same XDR
 * display family and has not been measured here.
 */
export const HDR_PANELS = [
  [1512, 982],
  [1728, 1117],
];

/**
 * Height reserved by OS chrome, i.e. `screen.height - screen.availHeight`.
 *
 * Windows is an exact value because the taskbar has a documented default height
 * at 100% scale (Windows 11: 48 CSS px, Windows 10: 40) — which is why 1080p
 * Windows 11 machines report availHeight 1032 en masse. Pool policy is the
 * default, non-auto-hidden taskbar; auto-hidden is real but is a smaller crowd.
 *
 * macOS and Linux are ranges, not equalities: the reserved strip depends on
 * whether the Dock / GNOME dock is visible or auto-hidden, and asserting an
 * exact value there would be over-fitting a fact I cannot pin down.
 */
export const OS_CHROME_HEIGHT = {
  'windows-11': { exact: 48 },
  'windows-10': { exact: 40 },
  'macos-14': { min: 20, max: 100 },   // menu bar alone .. menu bar + Dock
  'macos-15': { min: 20, max: 100 },
  'ubuntu-22': { min: 20, max: 60 },   // GNOME top bar
};

/**
 * Fonts that only ship with one OS. Used to check the *contents* of the font
 * list, not just its key — a persona can name a legitimate font-set key and
 * still carry the wrong list (or a hand-built `fontList`).
 */
export const FONT_MARKERS = {
  win: {
    required: ['Segoe UI', 'Calibri'],
    forbidden: ['Helvetica Neue', 'Lucida Grande', 'Zapfino', 'Menlo', 'Ubuntu', 'DejaVu Sans'],
  },
  mac: {
    required: ['Helvetica Neue', 'Lucida Grande'],
    forbidden: ['Segoe UI', 'Calibri', 'Bahnschrift', 'MS Gothic', 'Ubuntu', 'DejaVu Sans'],
  },
  linux: {
    required: ['DejaVu Sans'],
    forbidden: ['Segoe UI', 'Calibri', 'Helvetica Neue', 'Lucida Grande', 'Zapfino'],
  },
};

/**
 * Windows Client Hint `platformVersion` → marketing version. Chrome froze the
 * UA string at "Windows NT 10.0" for both Windows 10 and 11, so platformVersion
 * is the *only* place the two are distinguishable; per Chrome's own mapping,
 * major >= 13 means Windows 11.
 */
const WINDOWS_11_MIN_PLATFORM_VERSION = 13;

// GPU renderer families that only exist on x86 hosts in the consumer market.
const X86_ONLY_GPU = /NVIDIA|GeForce|Quadro|Radeon|\bAMD\b|Intel\(R\)|\bIris\b|\bUHD Graphics\b/i;
const APPLE_SILICON_GPU = /Apple\s+M[1-9]\b/i;

/**
 * Discrete gaming GPUs. A machine someone paid for a dedicated GPU to build is
 * not a machine they then fitted with 8 GB of RAM — that pairing does not exist
 * as a shipping class. Note this deliberately does NOT match integrated parts
 * like "Radeon(TM) Vega 8 Graphics", which do ship alongside 8 GB.
 */
const DISCRETE_GPU = /GeForce (RTX|GTX)|Radeon RX/i;
const DISCRETE_GPU_MIN_MEMORY = 16;

// ── small helpers ──────────────────────────────────────────────────────────

const isStr = (v) => typeof v === 'string' && v.length > 0;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** `ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 …, D3D11)` → 'NVIDIA' */
function angleVendorToken(renderer) {
  const m = /^ANGLE \(([^,]+),/.exec(renderer || '');
  return m ? m[1].trim() : null;
}

/** `Google Inc. (NVIDIA)` → 'NVIDIA' */
function reportedVendorToken(vendor) {
  const m = /\(([^)]+)\)\s*$/.exec(vendor || '');
  return m ? m[1].trim() : null;
}

function chromeMajorFrom(ua) {
  const m = /Chrome\/(\d+)\./.exec(ua || '');
  return m ? Number(m[1]) : null;
}

// ── the validator ──────────────────────────────────────────────────────────

/**
 * @param {object} persona
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validatePersona(persona) {
  const errors = [];
  const push = (msg) => errors.push(msg);

  if (persona === null || typeof persona !== 'object') {
    return { valid: false, errors: ['persona is not an object'] };
  }

  const id = isStr(persona.id) ? persona.id : '<no id>';
  const at = (msg) => push(`[${id}] ${msg}`);

  try {
    // ── identity / weight ────────────────────────────────────────────────
    if (!isStr(persona.id)) {
      push('persona is missing a string `id`');
    }
    if (!isNum(persona.weight) || persona.weight <= 0) {
      at(`weight must be a number > 0, got ${JSON.stringify(persona.weight)} — ` +
         'a zero or negative weight makes the persona unreachable in selection');
    }

    // ── platform ─────────────────────────────────────────────────────────
    const family = PLATFORM_FAMILY[persona.platform] ?? null;
    if (!family) {
      at(`navigator.platform ${JSON.stringify(persona.platform)} is not a known value ` +
         `(expected one of ${Object.keys(PLATFORM_FAMILY).join(', ')})`);
    }

    // ── OS key ───────────────────────────────────────────────────────────
    const osFamily = isStr(persona.os) ? OS_FAMILY[persona.os] ?? null : null;
    if (isStr(persona.os) && !osFamily) {
      at(`unknown os key ${JSON.stringify(persona.os)}`);
    } else if (osFamily && family && osFamily !== family) {
      at(`os ${JSON.stringify(persona.os)} (${osFamily}) contradicts platform ` +
         `${JSON.stringify(persona.platform)} (${family})`);
    }

    // ── UA string ↔ Client Hints ─────────────────────────────────────────
    const ua = persona.ua;
    const uaData = (persona.uaData && typeof persona.uaData === 'object') ? persona.uaData : null;

    if (!isStr(ua)) {
      at('missing `ua` string');
    }
    if (!uaData) {
      at('missing `uaData` (Client Hints) object');
    }

    if (isStr(ua) && uaData) {
      const markers = [
        { re: /Windows NT/, hint: 'Windows', platform: 'Win32', fam: 'win' },
        { re: /Macintosh/, hint: 'macOS', platform: 'MacIntel', fam: 'mac' },
        { re: /X11; Linux/, hint: 'Linux', platform: null, fam: 'linux' },
      ];
      const hit = markers.filter((m) => m.re.test(ua));

      if (hit.length === 0) {
        at(`UA string names no recognised OS (expected "Windows NT", "Macintosh" or ` +
           `"X11; Linux"): ${JSON.stringify(ua)}`);
      } else if (hit.length > 1) {
        at(`UA string names more than one OS (${hit.map((h) => h.hint).join(' + ')}) — ` +
           'that is not a real user agent');
      } else {
        const m = hit[0];
        if (uaData.platform !== m.hint) {
          at(`UA claims ${m.hint} but uaData.platform is ${JSON.stringify(uaData.platform)} — ` +
             `Client Hints must agree with the UA string (expected ${JSON.stringify(m.hint)})`);
        }
        if (m.platform && persona.platform !== m.platform) {
          at(`UA claims ${m.hint} but navigator.platform is ${JSON.stringify(persona.platform)} ` +
             `(expected ${JSON.stringify(m.platform)})`);
        }
        if (family && m.fam !== family) {
          at(`UA claims ${m.hint} but navigator.platform ${JSON.stringify(persona.platform)} ` +
             `is a ${family} value`);
        }
      }

      // Chrome pins these two literals; a mismatch is a self-inflicted tell.
      if (!/AppleWebKit\/537\.36/.test(ua) || !/Safari\/537\.36/.test(ua)) {
        at('Chrome UA must contain "AppleWebKit/537.36" and "Safari/537.36"');
      }
      if (chromeMajorFrom(ua) === null) {
        at('UA does not contain a parseable "Chrome/<major>." version');
      }
      // Windows UA is frozen at NT 10.0 — an "NT 11.0" would be instantly fake.
      if (/Windows NT/.test(ua) && !/Windows NT 10\.0/.test(ua)) {
        at('Chrome freezes the Windows UA token at "Windows NT 10.0"; ' +
           `got ${JSON.stringify(/Windows NT [\d.]+/.exec(ua)?.[0])}`);
      }
    }

    if (uaData) {
      if (!isStr(uaData.platformVersion)) {
        at('uaData.platformVersion is missing');
      }
      if (uaData.architecture !== 'x86' && uaData.architecture !== 'arm') {
        at(`uaData.architecture must be "x86" or "arm", got ${JSON.stringify(uaData.architecture)}`);
      }
      if (uaData.bitness !== '64' && uaData.bitness !== '32') {
        at(`uaData.bitness must be "64" or "32", got ${JSON.stringify(uaData.bitness)}`);
      }
      if (uaData.platform === 'Windows' && uaData.wow64 === true && uaData.bitness === '64') {
        at('uaData.wow64 true with bitness "64" is contradictory (WOW64 is 32-on-64)');
      }
      // platformVersion is the only signal separating Windows 10 from 11.
      if (uaData.platform === 'Windows' && isStr(uaData.platformVersion) && isStr(persona.os)) {
        const major = Number(uaData.platformVersion.split('.')[0]);
        if (Number.isFinite(major)) {
          const claims11 = major >= WINDOWS_11_MIN_PLATFORM_VERSION;
          if (claims11 && persona.os !== 'windows-11') {
            at(`uaData.platformVersion ${uaData.platformVersion} means Windows 11 ` +
               `but os is ${JSON.stringify(persona.os)}`);
          }
          if (!claims11 && persona.os === 'windows-11') {
            at(`os is windows-11 but uaData.platformVersion ${uaData.platformVersion} ` +
               `is below the Windows 11 threshold (${WINDOWS_11_MIN_PLATFORM_VERSION}.0.0)`);
          }
        }
      }
    }

    // ── GPU ↔ platform ───────────────────────────────────────────────────
    const gpu = (persona.gpu && typeof persona.gpu === 'object') ? persona.gpu : null;
    if (!gpu) {
      at('missing `gpu` object');
    } else {
      const renderer = isStr(gpu.renderer) ? gpu.renderer : '';
      if (!renderer) {
        at('gpu.renderer is missing');
      }

      const hasApple = /\bApple\b|\bMetal\b/i.test(renderer);
      const hasD3D = /Direct3D11|\bD3D11\b/i.test(renderer);
      const hasMesa = /\bMesa\b/i.test(renderer);

      if (renderer && (family === 'win' || family === 'linux') && hasApple) {
        at(`GPU renderer names Apple/Metal but the platform is ${persona.platform} — ` +
           `Apple GPUs and the Metal backend do not exist there: ${JSON.stringify(renderer)}`);
      }
      if (renderer && (family === 'mac' || family === 'linux') && hasD3D) {
        at(`GPU renderer names Direct3D11/D3D11 but the platform is ${persona.platform} — ` +
           `Direct3D is Windows-only: ${JSON.stringify(renderer)}`);
      }
      if (renderer && (family === 'win' || family === 'mac') && hasMesa) {
        at(`GPU renderer names Mesa but the platform is ${persona.platform} — ` +
           `Mesa is the Linux/BSD userspace GL stack: ${JSON.stringify(renderer)}`);
      }

      // Chrome has defaulted to the ANGLE Metal backend on macOS since Chrome 100.
      // A Chrome 151 persona reporting an OpenGL backend on macOS contradicts its
      // own UA version.
      const chromeMajor = chromeMajorFrom(ua);
      if (renderer && family === 'mac' && chromeMajor !== null && chromeMajor >= 100) {
        if (!/ANGLE Metal Renderer/i.test(renderer)) {
          at(`Chrome ${chromeMajor} on macOS uses the ANGLE Metal backend by default, ` +
             `so the renderer should read "ANGLE Metal Renderer: …"; got ${JSON.stringify(renderer)}`);
        }
      }

      // vendor and renderer are two views of the same ANGLE report; they must agree.
      const rTok = angleVendorToken(renderer);
      const vTok = reportedVendorToken(gpu.vendor);
      if (renderer && rTok === null) {
        at(`gpu.renderer is not in ANGLE form "ANGLE (<vendor>, …)": ${JSON.stringify(renderer)}`);
      }
      if (isStr(gpu.vendor) && vTok === null) {
        at(`gpu.vendor is not in the form "Google Inc. (<vendor>)": ${JSON.stringify(gpu.vendor)}`);
      }
      if (rTok && vTok && rTok !== vTok) {
        at(`gpu.vendor names "${vTok}" but gpu.renderer names "${rTok}" — ` +
           'the two are the same ANGLE report and cannot disagree');
      }
      if (isStr(gpu.unmaskedVendor) && isStr(gpu.vendor) && gpu.unmaskedVendor !== gpu.vendor) {
        at(`gpu.unmaskedVendor ${JSON.stringify(gpu.unmaskedVendor)} !== gpu.vendor ` +
           `${JSON.stringify(gpu.vendor)}`);
      }
      if (gpu.maxTextureSize !== undefined &&
          ![4096, 8192, 16384, 32768].includes(gpu.maxTextureSize)) {
        at(`gpu.maxTextureSize ${gpu.maxTextureSize} is not a real GL_MAX_TEXTURE_SIZE value`);
      }

      // ── architecture ↔ GPU ─────────────────────────────────────────────
      const arch = uaData ? uaData.architecture : undefined;
      if (renderer && arch === 'arm' && X86_ONLY_GPU.test(renderer) && !APPLE_SILICON_GPU.test(renderer)) {
        at(`uaData.architecture is "arm" but the GPU is an x86-host part ` +
           `(${JSON.stringify(renderer)}) — that pairing does not ship`);
      }
      if (renderer && APPLE_SILICON_GPU.test(renderer) && arch !== 'arm') {
        at(`GPU renderer names Apple Silicon (${JSON.stringify(renderer)}) but ` +
           `uaData.architecture is ${JSON.stringify(arch)} — Apple M-series is arm64`);
      }

      // ── GPU class ↔ memory ─────────────────────────────────────────────
      if (renderer && DISCRETE_GPU.test(renderer) &&
          isNum(persona.memory) && persona.memory < DISCRETE_GPU_MIN_MEMORY) {
        at(`a discrete gaming GPU (${JSON.stringify(renderer)}) with only ` +
           `${persona.memory} GB of RAM is not a shipping configuration — ` +
           `expect ≥ ${DISCRETE_GPU_MIN_MEMORY} GB`);
      }
    }

    // ── cores / memory ───────────────────────────────────────────────────
    if (!CORE_COUNTS.includes(persona.cores)) {
      at(`cores ${JSON.stringify(persona.cores)} is not a real hardwareConcurrency value ` +
         `(expected one of ${CORE_COUNTS.join(', ')})`);
    }
    if (!MEMORY_VALUES.includes(persona.memory)) {
      at(`memory ${JSON.stringify(persona.memory)} is not a plausible RAM size ` +
         `(expected one of ${MEMORY_VALUES.join(', ')})`);
    } else if (persona.memory > MAX_DEVICE_MEMORY) {
      at(`memory ${persona.memory} exceeds the ceiling Chrome reports for ` +
         `navigator.deviceMemory on desktop (${MAX_DEVICE_MEMORY}) — the value is clamped, ` +
         'so it is unreachable and therefore re-identifying');
    }
    if (isNum(persona.cores) && isNum(persona.memory)) {
      if (persona.cores >= 12 && persona.memory < 8) {
        at(`cores ${persona.cores} with memory ${persona.memory} is not a machine that ships — ` +
           'high core counts do not pair with sub-8 GB RAM');
      }
      if (persona.memory >= 32 && persona.cores < 8) {
        at(`memory ${persona.memory} with only ${persona.cores} cores is not a machine that ` +
           'ships — 32 GB builds are enthusiast/workstation parts with 8+ cores');
      }
    }

    // ── screen ───────────────────────────────────────────────────────────
    const screen = (persona.screen && typeof persona.screen === 'object') ? persona.screen : null;
    if (!screen) {
      at('missing `screen` object');
    } else {
      if (screen.colorDepth !== REQUIRED_COLOR_DEPTH) {
        at(`screen.colorDepth must be ${REQUIRED_COLOR_DEPTH}, got ${JSON.stringify(screen.colorDepth)} — ` +
           '30-bit HDR is rare enough to re-identify on its own (DECISIONS.md D3)');
      }
      if (screen.pixelDepth !== undefined && screen.pixelDepth !== screen.colorDepth) {
        at(`screen.pixelDepth ${screen.pixelDepth} !== screen.colorDepth ${screen.colorDepth}`);
      }

      const isHdrPanel = HDR_PANELS.some(([w, h]) => w === screen.width && h === screen.height);
      const known = COMMON_PANELS.some(([w, h]) => w === screen.width && h === screen.height);
      if (isHdrPanel) {
        at(`screen ${screen.width}×${screen.height} is a 10-bit HDR panel — Chrome reports ` +
           'colorDepth 30 on it, which DECISIONS.md D3 excludes as re-identifying. Pairing it ' +
           'with colorDepth 24 would be a contradiction, so the panel itself is out of scope');
      } else if (!known) {
        at(`screen ${screen.width}×${screen.height} is not a high-population panel size — ` +
           'an unusual-but-real resolution still leaves the user identifiable');
      }

      if (!isNum(screen.availHeight) || !isNum(screen.height)) {
        at('screen.height / screen.availHeight must be numbers');
      } else {
        if (screen.availHeight >= screen.height) {
          at(`screen.availHeight ${screen.availHeight} must be < screen.height ${screen.height} — ` +
             'the OS always reserves a strip for its own chrome');
        } else if (screen.availHeight < screen.height * 0.7) {
          at(`screen.availHeight ${screen.availHeight} is implausibly small next to ` +
             `screen.height ${screen.height}`);
        }

        const budget = isStr(persona.os) ? OS_CHROME_HEIGHT[persona.os] : undefined;
        if (budget) {
          const delta = screen.height - screen.availHeight;
          if (budget.exact !== undefined && delta !== budget.exact) {
            at(`screen.height - availHeight = ${delta}px of OS chrome, but ${persona.os} ` +
               `reserves ${budget.exact}px for its default taskbar ` +
               `(expected availHeight ${screen.height - budget.exact})`);
          }
          if (budget.min !== undefined && (delta < budget.min || delta > budget.max)) {
            at(`screen.height - availHeight = ${delta}px of OS chrome, outside the ` +
               `plausible ${budget.min}–${budget.max}px range for ${persona.os}`);
          }
        }
      }

      if (screen.availWidth !== undefined && screen.availWidth > screen.width) {
        at(`screen.availWidth ${screen.availWidth} > screen.width ${screen.width}`);
      }
      if (![1, 1.25, 1.5, 2, 3].includes(screen.dpr)) {
        at(`screen.dpr ${JSON.stringify(screen.dpr)} is not a common devicePixelRatio`);
      } else if (family === 'mac' && screen.dpr !== 1 && screen.dpr !== 2) {
        at(`screen.dpr ${screen.dpr} does not occur on macOS (1 or 2 only)`);
      }
    }

    // ── fonts ────────────────────────────────────────────────────────────
    const fontKey = persona.fonts;
    const listFromKey = isStr(fontKey) ? FONT_SETS[fontKey] : undefined;
    // personaFor() attaches a resolved `fontList`; fixtures may supply one directly.
    const fontList = Array.isArray(persona.fontList) ? persona.fontList : listFromKey;

    if (!isStr(fontKey)) {
      at('missing `fonts` key');
    } else if (!listFromKey) {
      at(`fonts key ${JSON.stringify(fontKey)} does not exist in FONT_SETS ` +
         `(known: ${Object.keys(FONT_SETS).join(', ')})`);
    }

    const fontFamily = isStr(fontKey) ? OS_FAMILY[fontKey] ?? null : null;
    if (isStr(fontKey) && listFromKey && !fontFamily) {
      at(`fonts key ${JSON.stringify(fontKey)} has no known OS family`);
    }
    if (fontFamily && family && fontFamily !== family) {
      at(`font set ${JSON.stringify(fontKey)} is a ${fontFamily} set but the platform ` +
         `${JSON.stringify(persona.platform)} is ${family}`);
    }

    // ── Linux: every claimed family must exist on a real default install ──
    // Added after research/linux-ground-truth/ measured a default Ubuntu 22.04
    // desktop (2026-08-21) and found FIVE families the pool claimed that no real
    // install has: Noto Sans, Noto Serif, Century Schoolbook L, Dingbats, DejaVu
    // Math TeX Gyre. Font detection records present/absent per probed family, so
    // a persona that says "present" where every real Ubuntu says "absent" is the
    // D2 self-contradiction — and Noto Sans is on most probe lists, so an
    // ordinary script catches it, not just an adversary looking for us.
    //
    // The marker check above proves the list is the right OS. This one proves
    // every entry is REAL: the shipped list is generated from the measurement
    // (src/linux-ground-truth.js) and this check is what stops a hand edit from
    // re-inventing a family. A Linux fonts key with no measurement behind it is
    // rejected outright — "contains no phantom today" is not the invariant,
    // "derived from a real install" is. Windows and macOS have no measured list
    // in this repo yet, so this is Linux-only. That is a gap, not a pass.
    if (family === 'linux' && isStr(fontKey)) {
      const truth = LINUX_FONT_GROUND_TRUTH[fontKey];
      if (!truth) {
        at(`fonts key ${JSON.stringify(fontKey)} has no measured ground truth in ` +
           'src/linux-ground-truth.js — a Linux font set is derived from a real default ' +
           'install (research/linux-ground-truth/) or it does not ship');
      } else if (Array.isArray(fontList)) {
        const real = new Set(truth);
        for (const f of fontList) {
          if (!real.has(f)) {
            at(`font list claims ${JSON.stringify(f)}, which does not exist on a real default ` +
               `${fontKey} desktop (research/linux-ground-truth/) — present here, absent on ` +
               'every real install, is a self-contradicting persona (D2)');
          }
        }
      }
    }

    if (Array.isArray(fontList) && family) {
      const markers = FONT_MARKERS[family];
      if (markers) {
        const present = new Set(fontList);
        for (const f of markers.forbidden) {
          if (present.has(f)) {
            at(`font list contains ${JSON.stringify(f)}, which does not ship on ` +
               `${persona.platform} — the font set must be the stock set for the claimed OS`);
          }
        }
        for (const f of markers.required) {
          if (!present.has(f)) {
            at(`font list is missing ${JSON.stringify(f)}, which ships on every ` +
               `${persona.platform} install`);
          }
        }
      }
      if (fontList.length < 10) {
        at(`font list has only ${fontList.length} entries — a stock OS install has far more`);
      }
      if (new Set(fontList).size !== fontList.length) {
        at('font list contains duplicates');
      }
    }

    // ── timing (optional) ────────────────────────────────────────────────
    if (persona.timing && typeof persona.timing === 'object' &&
        persona.timing.resolutionUs !== undefined && persona.timing.resolutionUs !== 100) {
      at(`timing.resolutionUs ${persona.timing.resolutionUs} — Chrome coarsens ` +
         'performance.now() to 100µs; another value is itself a signal');
    }
  } catch (err) {
    push(`[${id}] validator threw while checking this persona: ${err && err.message}`);
  }

  return { valid: errors.length === 0, errors };
}

// ── family-level policy (DECISIONS.md D12) ─────────────────────────────────
//
// Selection is constrained to the host's OS family, so every property the pool
// needed as a whole is now needed *per family*. A family that is thin, lopsided
// or single-memory-valued is not a smaller version of the same protection — it
// is a different, weaker product for whoever runs that OS.

/** Weights are intra-family market share, so each family must sum to this. */
export const FAMILY_WEIGHT_TOTAL = 100;

/** No single persona may own this much of its family (a coin-flip pool). */
export const MAX_INTRA_FAMILY_SHARE = 0.5;

/** Distinct `deviceMemory` values a family must span, and the cap on any one. */
export const MIN_MEMORY_BUCKETS_PER_FAMILY = 3;
export const MAX_MEMORY_BUCKET_SHARE = 0.6;

/**
 * The number this change is really about: P(two unrelated origins draw the SAME
 * persona) = Σ(wᵢ/W)². That is the probability a tracker embedded on both can
 * still join them on device class, and it is the direct measure of how much
 * cross-site separation a family buys.
 *
 * The pre-D12 pool, unconstrained, sat at 0.153 across all 8 personas. The
 * ceiling here is set loose enough to survive weight edits and tight enough
 * that a family cannot quietly degrade toward a coin flip. Measured after the
 * expansion: win 0.223, mac 0.183, linux 0.206.
 */
export const MAX_FAMILY_COLLISION = 0.25;

/**
 * Pool-level checks: everything `validatePersona` cannot see from a single
 * entry. Unique ids matter because the id is the selection key; a duplicate
 * silently makes one entry unreachable and skews the weighting.
 *
 * @param {object[]} personas
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validatePool(personas = PERSONAS) {
  const errors = [];

  if (!Array.isArray(personas) || personas.length === 0) {
    return { valid: false, errors: ['pool must be a non-empty array'] };
  }

  const seen = new Map();
  for (const p of personas) {
    const pid = p && p.id;
    if (typeof pid === 'string') seen.set(pid, (seen.get(pid) ?? 0) + 1);
    errors.push(...validatePersona(p).errors);
  }

  for (const [pid, n] of seen) {
    if (n > 1) errors.push(`duplicate persona id ${JSON.stringify(pid)} appears ${n} times`);
  }

  const total = personas.reduce((a, p) => a + (isNum(p?.weight) ? p.weight : 0), 0);
  if (total <= 0) errors.push('total pool weight must be > 0');

  errors.push(...validateFamilies(personas));

  return { valid: errors.length === 0, errors };
}

/**
 * The invariants the host-OS constraint introduces (D12). Split out so a test
 * can call it against a hand-built pool without also tripping every per-persona
 * rule.
 *
 * @param {object[]} personas
 * @returns {string[]} errors
 */
export function validateFamilies(personas = PERSONAS) {
  const errors = [];
  const byFamily = new Map(FAMILIES.map((f) => [f, []]));

  for (const p of personas) {
    const fam = familyOf(p);
    if (!fam) continue; // already reported by validatePersona
    byFamily.get(fam)?.push(p);
  }

  for (const [family, list] of byFamily) {
    if (list.length < MIN_PERSONAS_PER_FAMILY) {
      errors.push(
        `family "${family}" has only ${list.length} persona(s); selection is constrained to ` +
        `the host OS family, so a ${family} user would be choosing between ${list.length} ` +
        `machine(s) for every site (minimum ${MIN_PERSONAS_PER_FAMILY}) — that is materially ` +
        'weaker cross-site separation than the other families get');
      continue;
    }

    const W = list.reduce((a, p) => a + (isNum(p.weight) ? p.weight : 0), 0);
    if (W !== FAMILY_WEIGHT_TOTAL) {
      errors.push(
        `family "${family}" weights sum to ${W}, not ${FAMILY_WEIGHT_TOTAL} — weights are ` +
        'intra-family market share now, so they must be renormalised per family');
    }
    if (W <= 0) continue;

    for (const p of list) {
      const share = p.weight / W;
      if (share > MAX_INTRA_FAMILY_SHARE) {
        errors.push(
          `[${p.id}] takes ${(share * 100).toFixed(0)}% of the "${family}" family — above ` +
          `${MAX_INTRA_FAMILY_SHARE * 100}% the family behaves like a single persona for most origins`);
      }
    }

    const collision = list.reduce((a, p) => a + (p.weight / W) ** 2, 0);
    if (collision > MAX_FAMILY_COLLISION) {
      errors.push(
        `family "${family}" has a same-persona collision probability of ${collision.toFixed(3)} ` +
        `(max ${MAX_FAMILY_COLLISION}) — that is how often two unrelated origins show a tracker ` +
        'the same device, which is exactly the join Nullecho exists to break');
    }

    const memory = new Map();
    for (const p of list) {
      if (!isNum(p.memory)) continue;
      memory.set(p.memory, (memory.get(p.memory) ?? 0) + p.weight);
    }
    if (memory.size < MIN_MEMORY_BUCKETS_PER_FAMILY) {
      errors.push(
        `family "${family}" spans only ${memory.size} deviceMemory value(s) — a family where ` +
        'every reachable persona reports the same RAM makes that value the tell (D2)');
    }
    for (const [value, weight] of memory) {
      if (weight / W > MAX_MEMORY_BUCKET_SHARE) {
        errors.push(
          `family "${family}": ${(weight / W * 100).toFixed(0)}% of it reports deviceMemory ` +
          `${value} — that concentration is a cluster`);
      }
    }
  }

  return errors;
}
