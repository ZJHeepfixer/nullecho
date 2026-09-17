# What Nullecho costs a user — measured, 2026-09-17

Harness: `harness/performance.html` (six areas + a paired A/B instrument),
`harness/perf-page.html` (page load), `harness/gen-perf-personas.mjs` →
`harness/perf-personas.js` (personas generated from the real `ext/src/personas.js`,
never transcribed).

**Verdict up front.** Boot cost, memory, steady state and DNR are fine. Two things
are not, and one of them hits every page:

1. 🔴 **The font/layout path costs ~31 µs per `offsetWidth` and ~60 µs per
   `getBoundingClientRect` on any text-bearing leaf element — a 33–53× multiple.**
   A 300-row measuring sweep goes from 0.5 ms to **19 ms**, which is longer than a
   60 fps frame. This is not a fingerprinting cost; it is the ordinary layout path,
   and the trigger is the *common* web font stack. This is the finding that matters.
   ✅ **FIXED the same day — see the 2026-09-17 follow-up at the end of this document
   and DECISIONS.md D34.** The sweep is now 3.55 ms; the per-element cost is +5 µs /
   +12.7 µs. The recommendation in §2 below is left as written, because the follow-up
   explains why its pre-check was not exactly correct and what shipped instead.
2. 🟠 **Canvas readback is O(whole canvas) per read, not O(bytes requested).**
   Reading a 50×50 region of a 1920×1080 canvas costs **70–112 ms**. Full-canvas
   reads run ~120 ns per pixel: 300×200 costs +5–7 ms, 1920×1080 costs +250–280 ms.

Neither is a ship blocker on its own. Both are fixable, and #1 has a cheap fix.

---

## The instrument, and why the old number was wrong

`docs/ARKENFOX-RESPONSE.md` follow-up #6 records canvas reads as **7–12× slower**,
measured incidentally on 2026-08-21 while two agents drove one browser. That figure
is withdrawn below. The reason it could not be trusted is worth stating precisely,
because the same trap was live again today.

**Two page loads cannot be compared on a machine you do not have to yourself.** This
run had another session driving the same Chrome, and (later) the browser tab
backgrounded. Measured evidence of the drift: a control workload the shim cannot
touch — pure arithmetic, no DOM, no patched API — timed **0.20 ms, 0.457 ms and
0.564 ms** across three page loads of the same page. That is a **2.8× swing in a
workload nothing changed.** Any shim-on-vs-shim-off ratio built from separate page
loads inherits that swing, and nothing in the ratio says so.

So the authoritative numbers here come from a different instrument:

> **Paired, interleaved A/B inside a single page load.** `harness/performance.html`
> captures the pristine native functions at `document_start` *before* `shim.js` is
> written into the document, then runs the patched call and the native call
> alternately in ABBA order, milliseconds apart. Contention lands on both sides of
> each quartet and divides out.

Two calibrations, both printed by the harness rather than assumed:

| Calibration | Result |
|---|---|
| **Null run** — `?shim=off`, so both sides are the same native function. Every ratio must be 1.00 | **20–21 cells, median ratio 1.000–1.023, worst deviation 12.5%, rsd 4.3%** |
| **In-page null control** — `Element.clientWidth`, which the shim never patches, measured on a **shim-ON** page beside the patched cells | **0.989×** |

The instrument is unbiased to within about ±10%. Effects below ~1.3× are not
distinguishable from noise; the 30–45× effects reported below are far outside it.

**Environment.** Real Chrome **151.0.7922.174** on macOS 26.6.0, Apple M2 Max — UA
contains `Chrome/151`, no `Electron`. Measured clock resolution **0.1 ms** (Chrome's
clamp), which is why every cell batches operations until a batch clears ~25 ticks.

⚠️ **Three caveats on this run, stated rather than buried.**
- The Chrome tab was **`visibilityState: hidden`** for the whole run (permission to
  bring Chrome forward was declined). A hidden tab never paints, pauses
  `requestAnimationFrame`, and throttles timers and async callbacks — at one point
  to one wake *per minute*. **Synchronous main-thread work is not throttled**, which
  is every paired cell, and the null calibration at 1.000 proves the instrument still
  works there. But **first paint / FCP could not be measured at all** (the entries
  are `null`), and `toBlob` callback latency is not measurable either.
- Another session was driving the same browser in a same-origin tab, which in Chrome
  shares one renderer main thread. The harness was moved to `http://localhost:4886`
  (a different site from `http://127.0.0.1:4886`) to get its own renderer process.
- Absolute per-operation costs reproduce across runs to within about ±25%. **Ratios
  swing more**, because the native baseline is often a few microseconds. Read the
  *added-cost* column as the finding and the ratio as context.
- **`ext/src/shim.js` changed underneath this run.** Another session landed D32 (the
  CreepJS function-*shape* fix) at 01:57, mid-measurement. D32 routes every patched
  method through `shaped()` — a method-shorthand holder that adds one call
  indirection and a rest-parameter array allocation per call — so it could plausibly
  have moved every number here. The headline cells were therefore **re-measured after
  D32 landed**, and they did not move:

  | Cell (added cost) | Pre-D32 | Post-D32 |
  |---|---|---|
  | `getImageData` 32×32 | +0.137–0.153 ms | +0.146 ms |
  | `getImageData` 300×200 | +5.2–6.9 ms | +9.0 ms |
  | `toDataURL` 300×200 | +9.6–10.5 ms | +10.4 ms |
  | LAYOUT `offsetWidth` leaf | +0.0318 ms | +0.0307 ms |
  | LAYOUT `getBoundingClientRect` leaf | +0.0625 ms | +0.0655 ms |
  | LAYOUT sweep 300 leaves | +18.9–19.1 ms | +19.3 ms |
  | `measureText` chart loop | +0.050–0.082 ms | +0.087 ms |
  | `navigator.userAgent` | +0.14 µs | +0.19 µs |
  | **NULL CONTROL `clientWidth`** | **0.989×** | **1.041×** |

  Everything is inside the ±25% run-to-run band and the null control still reads ≈1.0.
  **The findings in this document hold against `shim.js` as it stands after D32.**

---

## 1. Canvas, WebGL and audio read cost — follow-up #6, settled

Persona `macos-chrome-m1-pro` (host-matched). Two independent runs; ranges span both.

| Operation | Shim off (median) | Shim on (median) | **Added** | Ratio |
|---|---|---|---|---|
| `getImageData` full — 32×32 | 0.009–0.012 ms | 0.147–0.165 ms | **+0.14–0.15 ms** | 13–14× |
| `getImageData` full — 300×200 | 0.19–0.27 ms | 5.4–7.1 ms | **+5.2–6.9 ms** | 31–50× |
| `getImageData` full — 1920×1080 | 8.2–12.9 ms | 255–292 ms | **+247–279 ms** | 23–28× |
| `getImageData` **50×50 sub-rect** of 300×200 | 0.018–0.026 ms | 4.0–4.6 ms | **+4.0–4.6 ms** | 170–280× |
| `getImageData` **50×50 sub-rect** of 1920×1080 | 0.004–0.007 ms | 70–112 ms | **+70–112 ms** | >10,000× |
| `toDataURL` — 32×32 | 0.11–0.13 ms | 0.69–1.01 ms | **+0.58–0.88 ms** | 6.5–7.1× |
| `toDataURL` — 300×200 | 2.35–2.85 ms | 11.95–13.3 ms | **+9.6–10.5 ms** | 4.6–5.1× |
| `toDataURL` — 1920×1080 | 30 ms | 140 ms | **+110 ms** | 4.7× |
| `toBlob` — any size | — | — | **identical to `toDataURL`** | — |
| `readPixels` — 32×32 | 0.126 ms | 0.194 ms | **+0.069 ms** | 1.6× |
| `readPixels` — 300×200 | 0.625 ms | 7.66 ms | **+7.03 ms** | 12.6× |
| `readPixels` — 1024×1024 | 3.6 ms | 121 ms | **+117 ms** | 31× |
| `AudioBuffer.getChannelData` — **first** read, 1 s @ 44.1 kHz | below clock | 3.3 ms | **+3.3 ms** | n/a |
| `AudioBuffer.getChannelData` — repeat read | 0.0001 ms | 0.00034 ms | +0.24 µs | 3× |

`toBlob` is not benchmarked and does not need to be: in `ext/src/shim.js` both
`toBlob` and `toDataURL` call the same `noisedCopy(this)` and then hand the noised
copy to the original, so the shim-added cost is identical. (Its callback latency is
also unmeasurable in a hidden tab — reporting the ~1000 ms that a throttled callback
produces would be the same class of error as the 7–12× figure.)

### The correction to follow-up #6

> **Replace this in `docs/ARKENFOX-RESPONSE.md`:** *"Was 3.7–4.4×… Re-measured
> 2026-08-21 and it is worse: 0.30–0.54 ms/op with the shim off against 3.2–3.6 ms/op
> with it on, ≈7–12× on the same page."*
>
> **With this:** there is no single canvas ratio. Cost scales with **canvas area**,
> not with the size of the read, so the multiple depends entirely on what is being
> read and how much of it. Measured paired in real Chrome 151 on a quiet-by-construction
> instrument: `getImageData` on the 300×200 canvas the old figure used is
> **0.19–0.27 ms → 5.4–7.1 ms (~30–50×, +5–7 ms)**; `toDataURL` on the same canvas is
> **2.4–2.9 ms → 12–13 ms (~5×, +10 ms)**. The old 7–12× reading was taken while two
> agents shared one browser and should not be quoted.

**The cost is bigger than the August reading, not smaller, and that is consistent with
D22.** D22 made the noise content-keyed by adding an FNV-1a digest and an ink scan
**over the whole canvas on every read** (`scanRGBA` → `scanBytes`). Before D22 the
perturbation was a function of coordinates alone and no scan was needed. That change
bought the fix for the review-A1 subtraction attack — a page could previously read the
pattern off a uniform fill and subtract it from the real fingerprint canvas — and it
is worth the cost. But it is the reason these numbers moved.

### The model, and the part that should be fixed

Across every size the added cost fits **~120 ns per canvas pixel per full read**
(32×32: 134–149 ns/px · 300×200: 87–114 ns/px · 1920×1080: 119–134 ns/px). `readPixels`
fits ~110 ns per pixel *of the read*, because that kernel correctly scans only the
requested rectangle.

The 2D path does not. `patchGetImageData` reads the **whole canvas** through the
native original whenever the request is a sub-rectangle, so it can compute the ink
gate and content digest over the canvas rather than the rectangle (review B5 — a
sub-rect read must return the same bytes as the corresponding region of a full read).
The consequence is the >10,000× row: **reading a 50×50 region of a 1920×1080 canvas
costs 70–112 ms.** A page that polls a small region of a large canvas — image
editors, games, video processing, WebGL-free chart hit-testing — is doing this on a
timer.

🟠 **Recommendation (worth doing, not ship-blocking).** Cache the whole-canvas digest
and ink flag, invalidated on any draw operation, instead of recomputing per read.
The canvas already has to be hooked for `putImageData`/`drawImage`; a dirty flag
turns repeated sub-rect reads of an unchanging canvas from O(canvas) into
O(rectangle) and leaves the D22 guarantee intact, because the digest only has to
change when the content does.

---

## 2. Font enumeration and the layout path — the real finding

Two personas, because the concern was the Linux pool's growth to 180 families:
`macos-chrome-m1-pro` (**53** families) and `linux-chrome-mesa-xe` (**180** families).

| Operation | Shim off | On — mac (53) | On — linux (180) | **Added** | Ratio |
|---|---|---|---|---|---|
| Font probe — `offsetWidth`, per family | 0.043 ms | 0.066 ms | 0.050 ms | +0.023–0.025 ms | 1.7× |
| Font probe — `getBoundingClientRect`, per family | 0.034–0.051 ms | 0.246 ms | 0.254 ms | +0.20–0.21 ms | 5.6–7.1× |
| Font probe — `measureText`, per family | 0.009–0.014 ms | 0.051 ms | 0.071 ms | +0.042–0.057 ms | 4.5–4.9× |
| **LAYOUT — `offsetWidth` on a leaf** | 0.00073–0.00078 ms | 0.0319 ms | 0.0319 ms | **+0.031 ms** | **33–39×** |
| **LAYOUT — `getBoundingClientRect` on a leaf** | 0.0013–0.0015 ms | 0.0638 ms | 0.0610 ms | **+0.060–0.063 ms** | **43×** |
| **LAYOUT — sweep 300 leaf rows** | 0.45–0.58 ms | 19.45 ms | 19.58 ms | **+18.9–19.1 ms** | **36–43×** |
| `measureText` in a chart render loop | 0.0019–0.0022 ms | 0.084 ms | 0.052 ms | **+0.050–0.082 ms** | 29–46× |
| LAYOUT — `getBoundingClientRect` on a **container** (gated out) | 0.0016–0.0023 ms | 0.0068 ms | 0.0073 ms | +0.005 ms | 3.8–4.0× |
| LAYOUT — `offsetWidth` on a **container** (gated out) | 0.0008–0.0010 ms | 0.0011 ms | 0.0015 ms | +0.0003–0.0005 ms | 1.4–1.5× |

### 180 families cost exactly what 53 families cost

Every layout row above is the same for both personas to within noise (+0.031 ms vs
+0.031 ms; 19.45 ms vs 19.58 ms). **The size of the font list is not the cost driver
and the Linux pool's growth to 180 families is free.** The persona list is consulted
through a `Set` (`D().fontSet`), so membership is O(1); the cost is the forced
re-layout in `measureWithFamily`, which is O(1) in list size. That concern is closed.

### What the cost actually is, and why it hits every page

`fontMetric()` gates cheaply first — a container short-circuits at
`elChildElementCount(el) !== 0`, and the container rows above confirm that gate is
nearly free. But a **leaf element with 1–128 characters of text** passes every gate,
reaches `getComputedStyle`, builds a family plan, and then calls
`measureWithFamily()`, which sets `font-family` `!important` on the element, reads the
metric back (a forced synchronous layout), and restores the property (invalidating
layout again).

The trigger is not exotic. `planFamilies()` sets `dropped = true` as soon as the
stack names any known system font the persona lacks — and the ordinary modern stack

```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
```

names `"Segoe UI"` (absent from a macOS or Linux persona) and `Roboto` and
`Helvetica`. **Essentially every real page trips this on essentially every
text-bearing leaf element it measures.** That is why this is the finding that
matters: it is not a fingerprinting cost that only fingerprinting pages pay.

Who measures leaf elements in loops, in practice: virtualised lists
(`react-window`, `react-virtualized`), data grids autosizing columns (ag-Grid,
Handsontable), tooltip/popover positioners (Popper, Floating UI) on every scroll,
text-truncation and ellipsis logic, sticky-header math, and chart libraries laying
out labels. A grid measuring 300 cells in a frame now spends **19 ms** where it spent
0.5 ms — past the 16.7 ms frame budget, so it drops a frame. A chart drawing 200
labels through `measureText` pays **10–16 ms**.

🔴 **Recommendation — and it is cheap.** The plan is computed, and the two forced
layouts are paid, even when the dropped family could never have been used. In the
stack above, `-apple-system` resolves on the host and appears *before* `"Segoe UI"`,
so removing `"Segoe UI"` cannot change a single pixel. A pre-check — *is there a
family earlier in the list than the first dropped family that actually renders on
this machine?* — would return `real()` immediately for the overwhelming majority of
real-world stacks, with no change to what a fingerprinter sees, because a
fingerprinter's probe deliberately puts the single family under test first. Combined
with memoising the plan by computed `font-family` string (it is rebuilt per element
per call today), this should remove most of the 33–53×.

---

## 3. Page-load impact

`harness/perf-page.html` — a representative page (~430 DOM nodes across header, nav,
card grid, 45-row table and footer; a few hundred CSS rules; six images), reloading
itself 12 times per mode. First sample dropped (cold cache). n = 11.

| Metric | Shim off | Shim on | Delta |
|---|---|---|---|
| `responseEnd` | 3.6 ms (p95 11.0) | 3.4 ms (p95 4.0) | ~0 |
| `domInteractive` | 8.4 ms (p95 17.1) | 19.0 ms (p95 20.1) | **+10.6 ms** |
| `DOMContentLoaded` | 8.4 ms (p95 17.1) | 19.0 ms (p95 20.1) | **+10.6 ms** |
| `loadEventEnd` | 10.1 ms (p95 18.8) | 20.5 ms (p95 21.3) | **+10.4 ms** |
| First paint / FCP | — | — | **not measurable (hidden tab)** |

Shim boot breakdown (shim on, n = 11, very tight — p95 within 1.5 ms of median):

| Phase | Median | p95 |
|---|---|---|
| `shim.js` network fetch — **harness artefact** | 4.2 ms | 4.7 ms |
| `shim.js` eval: parse + D21 builtin capture + `installInto(window)` | 5.3 ms | 6.7 ms |
| ↳ up to the boot event (captures done) | 5.9 ms | 7.0 ms |
| ↳ boot event → patched | 3.7 ms | 4.6 ms |
| **Total blocking at `document_start`** | **9.9 ms** | **11.0 ms** |

`shim.js` is **165.8 KB** decoded.

The fetch column is an artefact: this harness loads `shim.js` over HTTP from a Python
`http.server`, while the real extension injects it from local disk with no network.
**The user-facing figure is the ~5.3–6 ms of eval-and-patch**, and the +10.6 ms DCL
delta measured here is that plus the harness's own 4.2 ms fetch.

🟢 **Acceptable.** ~6 ms of main-thread blocking once per document on an M2 Mac is
comparable to a small analytics snippet. It is paid per frame as well as per top
document, so a page with 20 iframes pays it 21 times — but area 5 shows that is not
observable either.

⚠️ **Owed, and it cannot be closed from here.** First paint was never measured,
because Chrome does not paint a hidden tab. Since `shim.js` is a parser-blocking
script at `document_start`, first paint cannot precede it and is necessarily delayed
by at least the blocking time — but "at least ~6 ms" is a deduction from the
mechanism, not a measurement. **Re-run `harness/perf-page.html` in a foreground
Chrome tab to get real `first-contentful-paint` numbers.** The harness records
`visibility` and `paintTimingValid` in its output so a hidden-tab run cannot be
mistaken for a valid one.

---

## 4. Steady state — a page that never fingerprints anything

The common case, and the number most users actually experience.

| Operation | Shim off | Shim on | Added | Ratio |
|---|---|---|---|---|
| `navigator.userAgent` read (patched accessor) | 0.00049 ms | 0.00063 ms | +0.14 µs | 1.45× |
| `navigator.platform` read (patched accessor) | 0.00044 ms | 0.00068 ms | +0.24 µs | 1.4× |
| `navigator.hardwareConcurrency` read (patched accessor) | 0.00384 ms | 0.00424 ms | +0.40 µs | 1.11× |
| `Element.clientWidth` — **never patched (null control)** | 0.00107 ms | 0.00112 ms | +0.05 µs | **0.989×** |
| `getBoundingClientRect` on a container | 0.0016–0.0023 ms | 0.0068–0.0073 ms | +5 µs | 3.8–4.0× |
| `offsetWidth` on a container | 0.0008–0.0010 ms | 0.0011–0.0015 ms | +0.3–0.5 µs | 1.4–1.5× |

Single-sided cross-page measurements of DOM building, `classList` toggling,
`querySelectorAll`, `getComputedStyle`, event dispatch, JSON round-trips and
canvas-draw-without-readback all landed inside the ±2.8× control drift documented
above, so **no effect is claimable from them in either direction** — which is itself
the correct reading, since none of those APIs is patched.

🟢 **Acceptable.** A page that never touches a patched API pays the ~6 ms boot and
nothing else — the patches live on prototypes, so code that does not call them is
untouched, and the `clientWidth` null control confirms unpatched DOM work is not
collaterally slowed. Patched `navigator` reads cost a fraction of a microsecond;
a page reading a dozen of them at startup pays single-digit microseconds.

The one caveat is that "never touches a patched API" is a smaller set than it sounds,
because `getBoundingClientRect` and `offsetWidth` are patched — see area 2.

---

## 5. Memory

🔴 **`performance.memory` cannot answer this question, and the harness now says so
rather than printing a number.**

The signal being looked for is a few hundred KB per realm. The noise floor is garbage
collection, which moves tens of MB. Measured `usedJSHeapSize` baselines across runs:
46.5 MB, 45.8 MB, 95.1 MB, 171.3 MB, 196.1 MB. Deltas came back **negative** — one run
reported −3,513 KB "per iframe" and −61,775 KB "retained" — which is not a memory
saving, it is a GC landing inside the measurement window. Chrome also offers no way
to force a collection from a page without `--js-flags=--expose-gc`, and
`performance.measureUserAgentSpecificMemory()` requires cross-origin isolation the
harness does not have. **No retained-heap figure from this run should be quoted**, and
the harness prints a red box saying exactly that when the deltas go negative.

What *is* measurable is the same question asked in time rather than bytes:

| Measurement | Shim off | Shim on |
|---|---|---|
| Synchronous creation of 20 same-origin iframes (each triggering `installInto()`) | 45.4 ms | **38.6 ms** |
| Child realms reachable / confirmed patched | 20 / — | **20 / 20** |

🟢 **`installInto()` across 20 iframes has no measurable time cost** — the shim-on run
was *faster* than the shim-off run, so the per-realm patching is below the noise of
iframe creation itself. The 20/20 patched count is also a correctness result worth
recording: under the Linux persona every child realm reported `Linux x86_64` where
the host is `MacIntel`, so the D21 per-realm capture genuinely reaches every frame.

⚠️ **Owed.** Whether `installInto()` *leaks* — retains realms after their iframes are
removed — is **not established in either direction** by this run. It needs either a
Chrome launched with `--expose-gc`, or a DevTools heap snapshot with a detached-node
search, neither of which is reachable from a page.

---

## 6. DNR rule sets — what is measurable and what genuinely is not

Static facts, read from the shipped files:

| Ruleset | Rules | Bytes | Enabled by default |
|---|---|---|---|
| `ads` | 81 | 14,124 | yes |
| `social` | 41 | 8,484 | yes |
| `analytics` | 35 | 6,216 | yes |
| `fingerprinting` | 18 | 4,015 | yes (tier-B fraud vendors allow-ruled off) |
| `gpc` | 1 | 3,037 | yes |
| `ua-win` / `ua-mac` / `ua-linux` | 2 each | 2,959 / 2,963 / 2,946 | **no — `enabled: false`, switched on at runtime** |
| **Total** | **182** | **44,744** | 176 active in a default profile |

Local request latency, 30 same-origin requests, **negative control with no extension
installed**: median **1.6 ms**, p95 **4.0 ms**. That is the no-DNR baseline, recorded
so the same measurement under a real unpacked install is attributable — the same
method `harness/blocking-proof.html` was calibrated with.

🔴 **Everything else about DNR requires a real unpacked install, and this is not a
gap that more harness work can close.** DNR matching happens in the browser's network
stack, in C++, before any page script exists:

- **Rule-set compile time at install/update** is paid once by the browser, off the
  page's timeline entirely. Observable only via `chrome://extensions` with a real
  install.
- **Per-request match cost** is invisible from a page: a blocked request never
  arrives, and an allowed one carries no marker saying how many rules were evaluated
  against it. The honest instruments are `onRuleMatchedDebug` (unpacked-only) or a
  before/after comparison of a fixed page load with rulesets toggled.
- **Header-rewrite cost for the `ua-*` rulesets** is not present in a default profile
  at all, since all three ship disabled.
- **MV3 service-worker wake-up** — the worker is torn down when idle, and the first
  navigation after that pays a restart the page cannot time. On the evidence of
  `docs/ARCHITECTURE.md` this is the most likely *real* user-visible network cost,
  and it is entirely unmeasured.

Reporting a DNR performance number from a page without that second run would be a
guess wearing a number, so none is reported. 182 rules is small — uBlock Origin
ships tens of thousands — but "small" is an argument, not a measurement.

---

## Summary: six areas, graded

| # | Area | Verdict | Number |
|---|---|---|---|
| 1 | Canvas / WebGL / audio read cost | 🟠 **needs optimisation** | ~120 ns per canvas pixel per read; sub-rect reads pay the whole canvas (50×50 of 1920×1080 = **70–112 ms**) |
| 2 | Font enumeration | 🟢 **acceptable** | +0.02–0.2 ms per family probed; **180-family Linux persona costs the same as 53** |
| 2 | **Layout path** | 🔴 **needs optimisation** | **+31 µs per leaf `offsetWidth`, +60–65 µs per leaf `getBoundingClientRect`, 19 ms per 300-row sweep (33–53×)** |
| 3 | Page load | 🟢 **acceptable** | **~6 ms** eval+patch blocking at `document_start`; DCL +10.6 ms including the harness's own fetch. ⚠️ first paint unmeasured |
| 4 | Steady state | 🟢 **acceptable** | patched `navigator` reads +0.1–0.4 µs; unpatched DOM work **0.989×** (unaffected) |
| 5 | Memory | ⚪ **not resolvable from a page** | `installInto()` across 20 iframes: **no measurable time cost**, 20/20 realms patched. Retained heap and leak behaviour still owed |
| 6 | DNR | ⚪ **needs a real install** | 182 rules / 44.7 KB static. No per-request number is obtainable from a page |

## Is it fast enough to ship?

**Yes — but ship area 2's layout fix first, because it is cheap and it is the only
cost a user can plausibly notice.**

Where a user would actually notice something:

- **A data grid, virtualised list, or spreadsheet-like table that measures rows.**
  19 ms for 300 measured elements turns a smooth scroll into a dropped frame. This is
  the realistic complaint, it arrives as "this site feels janky", and the user will
  never connect it to us — which is exactly the uninstall mechanism
  `docs/BREAKAGE-TESTING.md` warns about. Under the severity model this is **S2**
  (degraded performance) bordering on **S1** on grid-heavy sites.
- **A canvas app polling a region of a large canvas** — image editors, some games,
  video frame processing. 70–112 ms per read is not a slowdown, it is a stall. Narrow
  in scope, severe where it lands, and the dirty-flag fix removes it.
- **A charting page** drawing hundreds of `measureText` labels pays 10–16 ms per
  render. Noticeable on a dashboard that re-renders on hover.

Where a user would **not** notice anything: ordinary page loads (~6 ms once),
ordinary DOM and JavaScript work (unmeasurable), `navigator` reads (sub-microsecond),
iframe-heavy pages (no measurable per-realm cost), one-off fingerprint-shaped canvas
reads (a 300×200 probe costs 5–7 ms once — a fingerprinter's cost, not the user's).

The honest framing for the store listing and for `ARKENFOX-RESPONSE.md`: **Nullecho's
steady-state cost is negligible, its boot cost is a few milliseconds, and its
worst-case cost falls on pages that measure text or read pixels in loops.** The
canvas cost is inherent to per-pixel noise — Brave pays a version of it too — but the
layout cost is not inherent, it is a missing early-out, and it should not ship as-is
on a tool whose second-biggest uninstall reason is "it made the web slow".

---

## Incidental finding — a false alarm in `shim.js` (not a performance issue)

Not what this work was for, but the harness surfaced it and it should not be lost.

**Every shim-on page load in this harness logs, to `console.error`:**

> `[Nullecho] No crypto.getRandomValues in this realm, so the persona handshake
> cannot be authenticated. Staying on the fallback persona for this page and
> refusing every handshake, including a genuine one.`

**The message is false.** Verified on the same loads it appears: `crypto.getRandomValues`
present, `isSecureContext` true, boot event carried a real 128-bit nonce, status
`{"upgraded":true,"lockedToFallback":false,"reason":null}`, `forged: 0`, persona applied
(`navigator.platform` reads `Linux x86_64` on a Mac host, 180 families). The handshake
had *just succeeded* when the shim announced it could not authenticate one.

The cause is a read-after-consume in the boot sequence:

```js
// ext/src/shim.js ~3119
emit(EV_STATUS, { phase: BOOT_PHASE, channel: CHANNEL, nonce: nonceBox.value });
if (!nonceBox.value) { console.error('[Nullecho] No crypto.getRandomValues …'); }
```

`emit()` dispatches **synchronously**. A listener that replies synchronously runs
`handleHandshake()` inside that dispatch, which reaches
`nonceBox.value = null;  // used once; no replay value` (~line 2959). Control then
returns to the `if (!nonceBox.value)` check, which now sees `null` — and reports
"no CSPRNG" for what was actually a clean, authenticated handshake.

**Production is not affected today**, and for a reason already written down at boot
step (c): the real `shim-loader.js` replies asynchronously via a service-worker round
trip. That same comment records an *earlier* synchronous-reply bug found on
2026-08-21 (the fallback persona overwriting the salted one) which was guarded; this
one has the identical root cause and was not.

Worth fixing anyway, on two grounds:

1. **It burns the console signal.** `docs/BREAKAGE-TESTING.md` triage says *"Watch the
   console, not just the page… our shims are instrumented to fail loud."* Every
   harness in this repo that replies synchronously — `shim-test.html`,
   `breakage-battery.html`, `performance.html` — prints a red error claiming
   protection is degraded. A permanent false alarm trains everyone to ignore exactly
   the channel that is supposed to be load-bearing.
2. **It is latent, not impossible.** Any future loader fast path that delivers a
   cached persona without a round trip — a natural optimisation — turns this into a
   live false alarm on every page load, at which point users file bugs saying
   Nullecho reports itself broken.

The fix is one line: sample the nonce *before* emitting.

```js
const hadNonce = !!nonceBox.value;
emit(EV_STATUS, { phase: BOOT_PHASE, channel: CHANNEL, nonce: nonceBox.value });
if (!hadNonce) { … }
```

(`state.handshakeDone` would serve equally well as the guard.) Not applied here —
this task was scoped to new files only and must not touch `ext/src/shim.js`.

⚠️ **Check for overlap before acting on this.** As of 2026-09-17 ~02:00 another
session is working in exactly this area: `ext/src/claim-verification-2026-09-17.test.js`
adds failing guards named *"nothing the page can provoke makes the shim write to the
page console"* and *"(lint): shim.js contains no console call at all — the loader's
isolated world is where anything naming the extension is printed."* If that work
lands, it removes this message from `shim.js` by relocating console output to the
loader. **Relocating the message does not by itself fix the bug** — the false
*condition* (`!nonceBox.value` read after the handshake consumed it) has to be
corrected too, or the loader will print the same false alarm from a different
file. Worth confirming against whatever that session ships rather than filing twice.

---

## Reproducing this

```bash
# launch.json config `nullecho-root` serves the repo root on 4886 (already present).
node harness/gen-perf-personas.mjs      # regenerate personas from ext/src/personas.js

# Null calibration FIRST — it must come back ≈1.00 or nothing else is trustworthy.
open 'http://localhost:4886/harness/performance.html?shim=off'
open 'http://localhost:4886/harness/performance.html?shim=on&salt=nullecho-shim-test-0003'  # macOS, 53 fonts
open 'http://localhost:4886/harness/performance.html?shim=on&salt=nullecho-shim-test-0005'  # Linux, 180 fonts

# Page load (reloads itself 12×; run each mode separately)
open 'http://localhost:4886/harness/perf-page.html?shim=off&n=12'
open 'http://localhost:4886/harness/perf-page.html?shim=on&n=12&salt=nullecho-shim-test-0003'
```

`?only=paired,canvas,fonts,steady,memory,dnr` runs a subset. Results are rendered and
also published on `window.__perf` / `window.__perfPage`.

**Do this in a FOREGROUND tab** if you want paint timing, and **use `localhost`, not
`127.0.0.1`, if another session has a `127.0.0.1` tab open** — same-site tabs share a
renderer main thread in Chrome, and a neighbour's workload lands directly on your
measurements. Cache-bust the harness HTML too (`&hcb=…`), not just `shim.js`: this
run lost twenty minutes to a cached `perf-page.html`.

## Traps this harness now defends against

Recorded because each one silently produced a wrong or absent number during this run:

1. **A cached harness page.** `shim.js` was cache-busted; the harness HTML was not,
   and an edited collector never ran. Bust both.
2. **`setTimeout` in a background tab.** Chrome throttles it to ~1/second, and after
   five minutes hidden to ~1/**minute**. A benchmark that yields with
   `setTimeout(0)` between batches appears to hang. The hot path now yields through
   a `MessageChannel`, which is not throttled.
3. **`requestAnimationFrame` in a hidden tab never fires**, so an rAF-gated collector
   waits forever. Removed from the load path.
4. **Same-site tabs share a renderer main thread.** Another session's page on the same
   origin is running on *your* thread. Move to a different host to get a different
   process.
5. **A ratio against a native call below the clock clamp** is a division by the timer,
   not a measurement. `paired()` refuses the ratio and reports added cost instead.
6. **A rep count calibrated on a dirty layout** under-counts for the steady state.
   Calibration targets ~25 clock ticks, measured, not a hardcoded millisecond figure.

---

# FOLLOW-UP, 2026-09-17 (later the same day) — §2 fixed and re-measured

The §2 recommendation is implemented and shipped as **DECISIONS.md D34**. This section
records the before/after on the same instrument, and corrects the recommendation's own
reasoning, which was not exactly right.

## The rule that shipped, and why it is not the one recommended above

§2 proposed: *is there a family earlier in the list than the first dropped family that
actually renders on this machine?* That is **not sound**, because CSS font matching is
per **glyph**, not per element. An earlier family that resolves can still lack a
codepoint, and the browser falls through to later families — including the one about to
be dropped. "An earlier family renders" therefore proves only that the dropped family is
unused *for the glyphs the earlier family happens to cover*.

What shipped instead: **does the MACHINE have the dropped family at all?** If it does
not, the browser's font matching already skipped it at every codepoint — a family with no
installed faces supplies no glyph — so the shim's removal is a no-op and the real
measurement already *is* the shimmed measurement. That statement is about the machine, so
it holds for every string, and needs no per-glyph reasoning. Host presence is decided once
per family name per realm by a canvas width comparison over three generics and five
scripts, using the natives captured at boot (D21), on a detached canvas — no layout, and
nothing a `MutationObserver` can see. Undecidable reads as *present*, which keeps the slow
path. Full rationale, including the `claimedFirst` clause that keeps every fingerprinter
probe on the old path byte-for-byte, is in D34.

## Before / after

Same instrument, same machine, same afternoon: **real Chrome 151.0.7922.174**, macOS
26.6.0, Apple M2 Max, persona `macos-chrome-m1-pro` (53 families), paired ABBA inside one
page load, `?only=paired&q=1`. The tab was `visibilityState: hidden` for both runs, as
before; synchronous main-thread work is not throttled and the calibration proves it.

**The in-page null control — `Element.clientWidth`, which the shim never patches —
read 1.00× on the before run and 1.00× on the after run.** The ratios below are
comparable; the browser was not differently busy.

| Cell | Before (added) | Before (ratio) | After (added) | After (ratio) |
|---|---|---|---|---|
| **LAYOUT — `offsetWidth` on a leaf** | +0.0258 ms | 39.0× | **+0.0050 ms** | **7.9×** |
| **LAYOUT — `getBoundingClientRect` on a leaf** | +0.0525 ms | 40.3× | **+0.0127 ms** | **11.2×** |
| **LAYOUT — sweep 300 leaf rows** | +15.50 ms | 43.9× | **+3.25 ms** | **11.0×** |
| `measureText` in a chart render loop | +0.0724 ms | 54.9× | **+0.0034 ms** | **3.2×** |
| font probe — `getBoundingClientRect`, per family | +0.2146 ms | 7.5× | +0.0204 ms | 1.7× |
| font probe — `measureText`, per family | +0.0316 ms | 4.3× | +0.0086 ms | 2.8× |
| LAYOUT — `getBoundingClientRect` on a container (gated out) | +0.0049 ms | 4.3× | +0.0041 ms | 4.2× |
| **NULL CONTROL — `Element.clientWidth`** | +0.0000 ms | **1.00×** | +0.0000 ms | **1.00×** |

**The headline.** A 300-row measuring sweep goes from **15.83 ms to 3.55 ms** total — from
most of a 60 fps frame to a fifth of one. Per-element cost on the ordinary page stack drops
**5×** for `offsetWidth` and **4×** for `getBoundingClientRect`. The 🔴 in this document's
verdict is cleared; what remains is the 🟠 canvas sub-rect finding in §1, which is untouched.

The font-probe rows drop too, and that is the same mechanism rather than a second effect:
most of the harness's 60 probe families are absent from this machine, so dropping them was
already a no-op and the early-out now says so. **The values those cells return did not
move** — see the verification below.

## Verification that nothing the page can see moved

Run in the same real Chrome, against the live shim, comparing every reading to the pristine
native getter the harness captured before `shim.js` loaded:

- **57 probe families × `"F", monospace`, macOS persona: 0 leaks, 0 hidden.** No family the
  persona lacks reports present; no family the persona claims reports absent. Identical to
  the pre-change shim.
- **Cross-OS sweep — Windows persona on this macOS host, all 57 claimed families: 0 hidden,
  and 0 of the Mac-only families (`Helvetica` 648→564, `Avenir` 665→564, `Geneva` 694→564)
  leaked.** Identical to the pre-change shim. This sweep is what caught the one case the
  first version of the rule got wrong (`Symbol`: installed on macOS, no Latin glyph) and
  forced the `claimedFirst` clause.
- **An independent host-presence oracle** — `new FontFace(…, 'local("F")')`, which the shim
  does not patch — found 7 families installed here and absent from the persona; 126 probes
  across 3 generics and 6 scripts found **0 leaks**.
- **Per-glyph attacks** (emoji, CJK, Arabic, Devanagari, symbols; a stack of only dropped
  families; `"Segoe UI Emoji"` alone with emoji text; the probed family listed second):
  shimmed value equals native exactly, in both `offsetWidth` and the fractional rect.

One number did move, and it moved toward the truth: on a stack where a generic resolves
before the claimed family, the ordinary page stack went from **474 px to 479 px**, and 479
is what the un-shimmed browser reports. D34 explains why the old value had no defensive
content. Stacks that name a system family first keep the old behaviour exactly.
