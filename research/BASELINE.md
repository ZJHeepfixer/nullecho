# Nullecho — measured baseline

Captured 2026-08-20. macOS 26.6.0, Apple M2 Max.
Harness: `harness/index.html`. This is the "before" number; every claim gets measured against it.

> **Correction, same day.** The first capture was taken in the Claude app's Browser pane, which is
> **Electron 42.9.2 / Chromium 148**, not Chrome. A persona-validator agent flagged that the recorded
> `deviceMemory: 32` should be impossible under Chromium's documented clamp, which is what prompted
> re-measuring. The numbers below are from **real Chrome 151**, driven through the browser extension.
> Lesson kept: *verify the measurement environment, not just the measurement.* Both runs are shown,
> because the difference between them is itself informative.

## Composite

**Authoritative, re-captured post-rename 2026-08-20 in real Chrome 151** (verified: no `Electron`
in the UA, `Chrome/151.0.0.0`), `harness/index.html`, window 1512×861:

| Browser | Composite | Components |
|---|---|---|
| **Chrome 151** (authoritative) | **`0c5e721f1ea5ac`** | 15 ok / 0 failed |

Consecutive runs in the same browser: **0 of 15 signals changed.** That perfect stability *is* the
tracking identifier. No cookie required.

### Superseded values — do not compare against these

| Composite | Why it is void |
|---|---|
| `0c94099e747b97` | Chrome 151, but pre-rename. |
| `172c75363e13c4` | Electron 42.9.2 / Chromium 148 — wrong engine entirely. |

**Why the rename moved the number.** The canvas probes paint a literal string, and its glyphs are
part of the rasterized pixels the canvas hash digests. Renaming Chaff → Nullecho rewrote those
strings as if they were prose. Exactly one component moved as a result:

| Signal | Pre-rename | Post-rename | |
|---|---|---|---|
| `canvas` | `02453bbf837e82` | `1e49250646cf4a` | changed — the painted text is in the hash |
| `canvasPixels` | `1713b3abe1a4dd` | `1713b3abe1a4dd` | unchanged — its hash covers only the first 400 bytes, which are blank rows above the text |
| all 12 others | — | — | unchanged |

**Fix applied.** The probe strings are now named constants in `harness/fingerprint.js`
(`PROBE_TEXT`), carrying a warning that they are measurement inputs rather than UI copy and that
changing one invalidates every recorded baseline. `harness/shim-test.html` consumes the same
constant instead of duplicating the literal. That is the second time a cosmetic edit silently moved
a measurement; the constant exists so there is not a third.

## What Chrome 151 hands to any script that asks

| Signal | Value | Note |
|---|---|---|
| WebGL renderer | `ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Max, Unspecified Version)` | Names the exact GPU. Very high entropy. |
| WebGPU | `apple` / `metal-3`, 22 features | Richer surface than WebGL; adapter limits alone are ~25-35 bits per current research. |
| CPU cores | 12 | |
| **deviceMemory** | **32** | See the finding below — this is not what the documentation predicts. |
| Screen | 1512×982 @2x, **colorDepth 30** | 30-bit HDR. Uncommon; strong discriminator. Confirmed in both browsers. |
| Storage quota | **10,737,418,240 B (exactly 10 GiB)** | A clean cap, *not* disk-derived — see below. |
| Fonts | 40 detected | |
| Client Hints | platformVersion `26.6.0`, arch `arm` | Exact OS build. |
| Timezone | `America/Los_Angeles`, en-US | |
| performance.now() | ~100 µs resolution | Chrome's default coarsening. |

## Two findings that contradict the documentation

**1. `navigator.deviceMemory` is not clamped to 8 here.**
The W3C spec sets no fixed ceiling (it defers to an implementation-defined upper bound), and
Chromium's documented ceiling is 8 — values 0.25/0.5/1/2/4/8. **Chrome 151 on this machine returns
32**, the true installed RAM. Either the clamp was raised/removed, or it does not apply on this
platform/build.

*Consequence:* `deviceMemory` carries substantially more entropy than the literature assumes, and
the persona-pool invariant "memory must be ≤ 8" rests on a premise that is false for current Chrome.
Capping personas at 8 is still *safe* (8 is a plausible common value), but if real Chrome reports
true RAM, the honest population has a 4/8/16/32 spread and forcing every Nullecho user to exactly 8
could itself become a tell. **Open question — needs cross-machine confirmation before the pool is
finalized.** Do not treat one machine as proof of a Chrome-wide policy change.

**2. Storage quota is capped, not disk-derived — in Chrome.**
Chrome returned exactly 10 GiB (`10737418240`), a round number. Electron returned `13302897039`, an
un-round number consistent with free-disk derivation. My earlier claim that quota is "effectively a
per-machine serial number" was **based on the Electron reading and is wrong for Chrome.** Corrected.

## Read on the combination

*M2 Max + 12 cores + HDR display + that exact font set + macOS 26.6.0* is still almost certainly a
population of one, and it survives incognito and storage clearing. The two corrections above weaken
two individual signals; they do not weaken the conclusion.

## Not measured (and unreachable from any extension)

- **TLS / JA3-JA4** — generated by the TLS stack before page JS exists.
- **IP address / network-layer correlation.**

The honest ceiling on what a WebExtension can do. Product copy must not imply otherwise.

## Regression protocol

1. Extension **off** → record composite. *(Chrome 151, post-rename: `0c5e721f1ea5ac`.)*
2. Extension **on** → composite must change. *(Measured with `harness/shim-test.html`, persona
   `win11-chrome-rtx3060`, matched window geometry: `0c5e721f1ea5ac` → `1e2351e8d63403`, 8 of 14
   hashed signals changed. The 6 unchanged are `screen` and `css` — the display layer, left
   truthful on purpose, see DECISIONS.md D11 — plus `timezone` (also deliberate) and
   `mediaDevices`/`math`/`storage`, which this layer never claimed.)*
3. Run again, same session → composite must **stay the same**. Per-read instability is itself a
   fingerprint and enables the averaging attack that broke Brave's canvas farbling.
4. Second browser profile, extension on → composite must **differ** from profile 1, with every field
   still internally consistent.

Steps 3 and 4 are the ones naive implementations fail.

**And step 0: confirm which browser you are actually measuring.** Cost us a wrong baseline once.
