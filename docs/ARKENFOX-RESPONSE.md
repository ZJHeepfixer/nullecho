# Arkenfox says don't bother. How much of that applies to us?

Written 2026-08-20, after building `ext/src/shim.js` and then attacking it.

Source: [arkenfox/user.js wiki — 4.1 Extensions](https://github.com/arkenfox/user.js/wiki/4.1-Extensions),
"DON'T BOTHER — Anti-Fingerprinting Extensions". Privacy Guides defers to Arkenfox here, which makes
this the most credible objection in the category. It deserves measurements, not rhetoric.

Every number below was produced by `harness/shim-test.html` against `ext/src/shim.js`, in **real
Chrome 151 on macOS 26.6.0 (Apple M2 Max)**, persona `win11-chrome-rtx3060`.

> ⚠ **Read the tables below as the pre-D12 record.** That persona is a *Windows* one, measured on a
> Mac — which is precisely what open follow-up #5 turned out to be about. #5 is now closed
> (DECISIONS.md D12: the persona always names the host's own OS), and the post-D12 numbers, taken on
> the same rig with a stricter suite of ten detectors, are in the follow-ups section at the end.
> Nothing here has been rewritten to match; the point of keeping it is that the argument moved.

**Verdict up front: they are right about more than they are wrong about.** Four of their six claims
land cleanly on what we built. One is partly answered by the per-origin design. One is answered only
in a narrow sense. The correct response is not to argue — it is to narrow what Nullecho claims.

---

## The measurements this rests on

Same browser, same window geometry (verified matched programmatically), one navigation apart,
**real Chrome 151** — not the Electron pane, which produced a wrong baseline once already:

| | Composite |
|---|---|
| Shim **off** | `0c5e721f1ea5ac` *(reproduces `research/BASELINE.md` exactly)* |
| Shim **on** | `1e2351e8d63403` |

8 of 14 hashed signals moved. The 6 that did not: `screen` and `css` — the display layer, which we
**deliberately stopped spoofing** (see the split-brain table below) — plus `timezone` (also
deliberate) and `mediaDevices`, `math`, `storage`, which this layer never claimed.

Repeated runs in one session: **0 of 15 signals drift.** 50 consecutive canvas reads → **1** hash via
`toDataURL` and **1** via `getImageData`. The averaging attack that broke Brave's per-read farbling in
2025 does not work here. `harness/shim-test.html` passes **39 of 39** correctness assertions.

And then the adversarial half — a page trying to prove the shim is installed:

| Detector | Before | After |
|---|---|---|
| `Function.prototype.toString` on patched methods | clean | clean |
| Wrong-receiver brand check (`getter.call({})`) | clean *(after a fix — see (f))* | clean |
| **Uniform-fill canvas noise** | **DETECTED** | **DETECTED** — inherent |
| `offsetWidth` vs `getBoundingClientRect` split-brain | **DETECTED** | **clean — fixed** |
| **Pristine child realm via `window[n]`** | **DETECTED** | **DETECTED** — unreachable |
| Child realm via `.contentWindow` | clean | clean |
| CSS `@media` vs `matchMedia` disagreement | **DETECTED** | **clean — reverted** |
| WebGL extension list vs claimed GPU | **DETECTED** | **clean — fixed** |
| Timing side channel | informational — 3.7× / 4.4× slower | unchanged |

**5 of 9 → 2 of 9.** The two that remain are the two that cannot be closed by an extension.

### What we did with each self-contradiction

The governing rule, now recorded as DECISIONS.md D11: *a detectable-but-consistent persona is
acceptable; a self-contradicting one is not.* A contradiction is worse than a leak because it is
both identifying **and** marks the user as evasive — the D2 failure mode.

| Split-brain | Action | Cost |
|---|---|---|
| **CSS `@media` vs `matchMedia`** | **REVERTED — and wider than asked.** Not just the `matchMedia` patch: the entire display layer went with it (`screen.*`, `devicePixelRatio`, colour depth). | Screen geometry, DPR and colour depth now leak truthfully. The largest single protection reduction in the shim. |
| **Fonts** | **FIXED.** `getBoundingClientRect` now measures through the same font plan and shares one presence delta with `offsetWidth`, in both directions. | `getClientRects()` (non-constructible `DOMRectList`) and SVG text metrics remain uncovered. |
| **WebGL extensions** | **FIXED.** Filtered to what the claimed GPU class exposes; `getExtension()` filtered by the same list. | An app wanting ASTC falls back — which is what it would do on the hardware we claim to be. |

**Why the display revert went wider than the instruction.** The brief was "revert `matchMedia` if
CSS cannot be reached". Measurement showed the contradiction was not created by the `matchMedia`
patch at all — it was created by spoofing `screen.*`. With the spoof in place, CSS disagreed with
`matchMedia` on **9 of 12** display features, including `device-width`, `device-height`,
`resolution`, `dynamic-range`, `color-gamut` and `color`. Reverting only `matchMedia` would have
left CSS *and* `matchMedia` both contradicting `screen.*` — strictly more contradictions, not fewer.
The only self-consistent configurations were "spoof all of it and accept a contradiction any
stylesheet can expose" or "spoof none of it". We spoof none of it.

CSS is genuinely unreachable, not merely inconvenient: `document.styleSheets[i].cssRules` **throws**
for a cross-origin stylesheet, so a tracker serving its detection CSS from its own domain cannot be
touched at all; and rewriting the sheets we *can* see would leave `CSSMediaRule.media.mediaText`
visibly altered, which is just a different detector.

**Note on reading the detector count.** It fell 5 → 2, but the display revert is *not* what made it
fall in a way we should feel good about — the contradiction *was* the detector, so removing the
spoof removed the detector and the protection together. The real cost of that revert does not appear
in the detector count at all; it appears in the before/after table above, where `screen` and `css`
moved from "changed" to "unchanged". Two fewer detectors, two fewer protected signals.

---

## Claim (a) — "It's impossible (engine, OS, version)"

**They are right. Measured.**

Nullecho presents a Windows/NVIDIA machine. The engine underneath is still Chrome-on-macOS, and it
says so in at least four places we do not reach:

1. **The display, via CSS.** This is the one that forced a retreat. `@media` is evaluated in the
   style engine, below JS, and it mirrors screen geometry, `devicePixelRatio`, colour depth, HDR and
   gamut. With the display spoofed, CSS and `matchMedia` disagreed on **9 of 12** features, and a
   cross-origin stylesheet cannot even be read to correct it. There was no way to make the claim
   consistent, so **we withdrew the claim**: screen size, DPR and colour depth are now reported
   truthfully. Arkenfox's word for this is "impossible", and on this surface it is exactly right.
2. **WebGL extension list.** `getSupportedExtensions()` was returning 39 entries including
   `WEBGL_compressed_texture_astc`, `_etc`, `_etc1` and `_pvrtc` — mobile/Apple-GPU formats a desktop
   RTX 3060 on D3D11 does not expose. *This one we could fix*, because the fix is subtractive: filter
   the list, and filter `getExtension()` with it. Now 35 entries, none of them contradictory. A
   useful boundary marker — the difference between (1) and (2) is whether the truth is reachable from
   JS at all, not how hard we tried.
3. **`math`.** `Math.acos`, `Math.sinh`, `Math.tan` at the extremes are libm/CPU artifacts. Hash
   unchanged from baseline. Untouchable from JS without breaking arithmetic.
4. **Font rasterization.** We fake font *metrics*. We cannot fake the rasterizer. Canvas text under a
   Windows persona is still rendered by CoreText with macOS hinting; the hash differs from baseline
   but it is not the hash a Windows machine would produce.

We do not make a Mac look like a Windows PC to anyone who checks. **Nullecho must never claim it
does.**

## Claim (b) — "It's not a lie (sites expect and use a valid value)"

**Half right, and the half they mean is the right half.**

The valid-value half we do satisfy by construction: personas come from a curated pool of real,
high-population configurations (`ext/src/personas.js`), validated by `personas.test.js`. We never
generate a value independently, so `deviceMemory: 16` next to `cores: 12` next to an RTX 3060 is a
machine that exists. That is exactly why D2/D3 exist.

But their deeper point stands: *internal* consistency across the fields we control does not buy
*external* consistency with the fields we do not. Claim (a) lists four places where the lie is
visible. Coherence within our own layer is necessary, not sufficient.

We found this the hard way twice while building:

- The display media features were leaking `dynamic-range: high` and `color-gamut: p3` straight
  through a `colorDepth: 24` persona. Now fixed for `matchMedia` (gap remains in CSSOM).
- `navigator.userAgentData.brands` would have been **empty**, because `personas.js` has no `brands`
  field. An empty brands array on a Chrome UA is an anomaly no real Chrome produces. The shim now
  synthesises the list from the Chrome major version in the persona's own UA string.

Both were self-contradictions that would have made the persona *more* identifiable than not spoofing.
That is the failure mode Arkenfox is pointing at, and we hit it twice in one afternoon.

## Claim (c) — "It's dumb (successfully spoofing X is the same as just being X)"

**This is where our design genuinely diverges, and it is the only claim I would push back on.**

The argument holds for a *global* spoof. If every site sees you as the same fake Windows box, you have
simply become that Windows box, and you have gained nothing over owning one.

Nullecho does not do that. The persona is `HMAC(session_salt, eTLD+1)` — **a different machine per
site**:

| Site | Persona | Cores/RAM | Screen |
|---|---|---|---|
| `nytimes.com` | `win11-chrome-uhd620` | 8c / 8 GB | 1920×1080 |
| `doubleclick.net` | `macos-chrome-intel-iris` | 8c / 16 GB | 1440×900 |
| `facebook.com` | `win11-chrome-iris-xe` | 8c / 16 GB | 1536×864 |
| `shop.example` | `win11-chrome-iris-xe` | 8c / 16 GB | 1536×864 |

"Successfully spoofing X is the same as being X" assumes one X. With a different X per origin, the
thing being defeated is not *identification* but *correlation* — and correlation is the actual
business model. A tracker embedded on both `nytimes.com` and `shop.example` cannot join those visits
on a device fingerprint, because it is looking at two different devices.

**The honest caveat:** this only works while the spoof holds. Claim (a) says a determined tracker can
recover engine-level invariants (libm results, WebGL extension list, rasterizer artifacts) that are
*identical across all our personas* and would re-join the sessions. So this defeats composite-hash
correlation, not a well-resourced adversary who fingerprints below our layer.

## Claim (d) — "It's equivalency"

**Right, and we can measure the cost.**

Adding an anti-fingerprinting tool adds the bit "this user runs an anti-fingerprinting tool", which
shrinks the anonymity set. We measured that bit: **2 of 9 detectors fire** after the fixes below (5 of 9 before them). A page can determine
Nullecho is installed in about ten lines:

```js
const c = document.createElement('canvas'); c.width = 128; c.height = 128;
const x = c.getContext('2d');
x.fillStyle = 'rgb(128,128,128)'; x.fillRect(0, 0, 128, 128);
const px = x.getImageData(0, 0, 128, 128).data;
const vals = new Set(); for (let i = 0; i < px.length; i += 4) vals.add(px[i]);
// clean browser: 1.  With Nullecho: 5  → {126,127,128,129,130}
```

That is not a bug we can fix; it is what canvas noise *is*. Brave has the same property. The mitigation
is that the set "runs an anti-fingerprinting tool" is large and growing, and — crucially — **it is not
a per-user identifier.** It costs anonymity-set size, not unlinkability. That distinction is the
whole defence, and it is a real but modest one.

There is a timing cost too, and it is bigger than I expected:

| Operation | Shim off | Shim on | Ratio |
|---|---|---|---|
| `getImageData` (300×200) | 0.325 ms | 1.19 ms | **3.7×** |
| `toDataURL` (300×200) | 0.523 ms | 2.317 ms | **4.4×** |

A tracker that benchmarks canvas operations has another cheap signal. This is inherent to per-pixel
noise, though the constant could be improved.

## Claim (e) — "It has too many methods (fonts: at least a dozen and counting)"

**Right, and our own harness proved it within minutes of the font shim being written.**

We shim three font-measurement paths: `HTMLElement.offsetWidth`, `offsetHeight`, and
`CanvasRenderingContext2D.measureText`. The adversarial test runs the *same* font-detection routine
down a fourth path we do not shim:

```
"Bahnschrift" (claimed by the persona, absent from this machine):
  offsetWidth              564 → 565     ⇒ "font is present"
  getBoundingClientRect  563.52 → 563.52 ⇒ "font is absent"

"Segoe UI", same test:
  offsetWidth              564 → 563     ⇒ "font is present"
  getBoundingClientRect  563.52 → 563.52 ⇒ "font is absent"
```

Two APIs measuring one span disagree about reality. That is simultaneously **a bypass** (use
`getClientRects` and get the truth) **and a detector** (the disagreement itself is impossible on a
clean browser). Still unshimmed: `Range.getClientRects`, SVG `getComputedTextLength`,
`getBBox`, `FontFace.load()` success/failure, and `@font-face { src: local(…) }` resolution.

`document.fonts.check()` turned out **not** to be a detection vector in Chrome — it returns `true` for
every family, including invented ones. We verified that before patching, and patching it would have
*created* an anomaly. That is the lesson of this claim generalised: each new method you cover is
another chance to introduce a contradiction.

We are not going to win the font-enumeration arms race with a JS shim. `docs/ARCHITECTURE.md` should
say so.

## Claim (f) — "Web Extensions are detectable, and often uniquely fingerprintable, when they touch the DOM"

**Right on detectability. We have some evidence against the "uniquely" half.**

Detectable: yes — 2 of 9 after the fixes, and both survivors are unclosable from an extension.

*Uniquely* fingerprintable is the more serious charge — an extension that leaks a per-user value is
worse than useless. Here we did better, and it was deliberate:

- No stray globals. The dev surface exists only when the boot payload sets `dev: true`, which
  `background.js` never does; in production nothing is added to `window`.
- No injected DOM nodes, no injected stylesheets, no `web_accessible_resources` probe surface.
- `navigator` has **0 own properties** — prototypes are patched, never instances.
- Descriptors keep their original `enumerable`/`configurable`/`writable` flags.
- Patched functions report `[native code]`, while genuine user functions still show real source (a
  blanket lie would itself be a tell).

The one thing we leak is *that we exist*, identically for every Nullecho user on the same persona.
That is a set membership, not a serial number.

**One detector we did close, and it is worth recording because it was a 3-line total break:**
patched accessors originally returned a value when called with the wrong receiver, where a genuine
WebIDL accessor throws `TypeError: Illegal invocation`:

```js
Object.getOwnPropertyDescriptor(Navigator.prototype, 'userAgent').get.call({})
// native: throws.  Naive shim: returns the spoofed UA.
```

Every spoofed accessor now delegates to the original first, purely for the brand check. Found by
attacking our own work; it would have identified the shim on any site that bothered.

The method wrappers had the mirror-image bug, found by CreepJS on 2026-09-17: five of them ran shim
work *before* the original, so the brand check's `Illegal invocation` landed in the wrapper's own
catch and was logged to the page console as a patch failure — naming the product. Since D33 every
wrapper lets the original speak first, and the shim writes to no console the page can reach.

---

## What I would change about our claims

Arkenfox's objections are aimed at tools that claim to *prevent fingerprinting*. If Nullecho claims
that, they are simply correct and we should not ship. So we should not claim it.

**Do not claim:**
- "Prevents fingerprinting" / "makes you anonymous" / "makes you look like a different computer."
- Any implication that a site cannot tell the extension is installed. It can, in ten lines.
- That the persona survives a determined adversary. It does not — see (a).

**Do claim, and we can defend each word with a measurement:**
> Nullecho shows each site a different, internally consistent device profile, which breaks the
> device-fingerprint join that ad-tech uses to follow you between sites. It is detectable, it does
> not defeat a determined adversary, and it does nothing about your IP address.

**Say out loud, in-product, that better options exist:** Arkenfox's recommendation — Firefox's own
`privacy.resistFingerprinting` / `fingerprintingProtection` — is genuinely stronger than any
extension, because it operates below the JS layer where claims (a) and (e) are decided. Brave's
built-in farbling is similarly better-positioned. Nullecho's honest niche is **Chrome, where neither
exists**, and **per-origin rather than uniform**, which is a different trade than RFP makes (RFP buys
uniformity at the cost of breakage and of being visibly a Tor/RFP user).

## Follow-ups — what this analysis generated, and what became of them

**Done:**

1. ~~**CSSOM `@media` leak.**~~ **RESOLVED by retreat.** CSS is unreachable, so the whole display
   layer stopped being spoofed rather than shipping half a fix. See the split-brain table.
2. ~~**WebGL extension list.**~~ **FIXED.** Filtered per GPU class, with `getExtension()` filtered by
   the same list. Still lives in the shim rather than `personas.js`; it should move to a
   `gpu.extensionDeny` field so `personas.test.js` can validate it against the renderer string, which
   is the one thing the current placement cannot do.
3. ~~**Font metric split-brain.**~~ **FIXED.** `getBoundingClientRect` shares one font plan and one
   presence delta with `offsetWidth`, verified in both the claim and the removal direction.
   `getClientRects()` and SVG text metrics remain out of reach.
4. ~~**`window[n]` child realms.**~~ Documented. `MutationObserver` covers the async case; the
   same-tick case is genuinely unreachable.
5. ~~**Persona OS should probably match the real OS.**~~ **DONE 2026-08-21 — DECISIONS.md D12.**
   Selection is now constrained to the host's OS family, detected from the real `navigator` before
   the shim patches it. The pool went from 8 personas (5 win / 2 mac / **1 linux**) to 16 (5/6/5) — 15 (5/5/5) since 2026-09-16, when the Intel-Mac persona was retired (D24) —
   because the constraint makes each family somebody's *entire* pool — two would have been a coin
   flip for Mac users and one meant Linux users had no cross-site protection at all.

   **Measured, same rig, real Chrome 151 on this Mac.** Detectors firing: shim off **0/10**, the
   old cross-OS Windows persona **3/10**, a host-matched macOS persona **2/10**. Read that against
   ten detectors, not the nine below: this analysis added a *tenth* — "Host OS vs claimed OS",
   which compares the now-truthful display layer against the persona's platform — and tightened the
   child-realm probes from `navigator.platform` alone to `{platform, cores, memory}`, because a
   platform-only probe reports clean by construction once the persona names the host's OS and would
   have manufactured the improvement it was supposed to measure. Both changes were made before the
   host-matched run.

   The prediction in the original wording held: **unlinkability did not fall.** 8 of 14 hashed
   signals still move against the shim-off baseline — the same 8 for a Windows persona and a macOS
   one. Two macOS personas on this host still produce different composites (`022e2b68c014e7` vs
   `02cae21b7f5fe7`). What it did cost is measurable: those two differ on 5 of 14 signals rather
   than 8, because `fonts`, `clientHints` and `webgpu` are constant inside a family. Same-persona
   collision probability per family is 0.223/0.183/0.206 against 0.153 for the old pool.

   What closed: the display-layer contradiction (claim (a) item 1) is gone, the same-tick child
   realm still leaks but now over one field instead of three, and the WebGL extension list needs no
   filtering at all under an Apple persona because the real list *is* the claimed GPU's list.

**Open:**

6. **Canvas timing.** Was 3.7–4.4× on `getImageData`/`toDataURL`. **Re-measured 2026-08-21 and it
   is worse: 0.30–0.54 ms/op with the shim off against 3.2–3.6 ms/op with it on, ≈7–12× on the
   same page.** This is not a D12 effect — the noise kernel is untouched by it and the figure is
   the same for a Windows and a macOS persona — but it is a bigger signal than the number recorded
   above, and whoever owns the kernel should re-measure deliberately rather than inherit this
   incidental reading.
7. **Add the adversarial suite to CI.** `harness/shim-test.html` should fail a build when a *new*
   detector starts firing. The detector count is a regression metric, and **today's number is 2 of
   10** (canvas farbling; same-tick pristine child realm) on a host-matched persona. Both are
   known-unclosable; a third means a regression. Note the denominator changed with follow-up 5 —
   a CI check has to pin the detector *names*, not just the count, or adding a detector looks like
   a regression and removing one looks like progress.
