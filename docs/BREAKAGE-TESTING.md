# Nullecho — breakage testing protocol

**This is the ship gate.** Nothing goes public until this passes.

## 🚫 Hard release blockers (a green test suite does not clear these)

These are correctness risks that our own tooling **cannot** catch, because the thing that would
verify them isn't in this toolchain. Each one, if shipped wrong, becomes a *Nullecho-specific
fingerprint* — the exact failure the whole design exists to prevent. Do not ship with any open.

1. **Linux renderer strings are UNVERIFIED.** The macOS/Windows persona GPU strings were read off
   real hardware; the **Linux (`ubuntu-22`) ANGLE/Mesa/NVIDIA renderer strings were reconstructed
   from documented driver formats, never read off a real Ubuntu machine** — this dev box is a Mac
   (`personas.js` flags it in-code, ~line 500; `DECISIONS.md` D12). A renderer string no real driver
   emits identifies every Nullecho-on-Linux user uniquely. **Verify each Linux persona's WebGL
   renderer against a real Ubuntu + Chrome install before any release that includes the Linux
   family, or ship without the Linux family until then.**
2. **`uaData.platformVersion` is a per-family constant** (`mac 14.6.0 / win 15.0.0 / linux 6.8.0`)
   across the entire user base. That is an anonymity-set cost of the same shape as the "everyone
   reports 8 GB" tell the pool already warns about — not a linkage leak, but a population-level tell.
   Decide before launch whether to vary it within realistic bounds, and record the decision.
3. **The macOS/Windows OS *major* is two versions stale** vs what a current host reports (personas
   say macOS 14 / Windows "15.0.0"; this host reports `26.6.0`). Same class as #2 — verify the
   claimed versions are still high-population, or refresh the pool.
4. **Do not trust a detector that is hardcoded to one platform.** The WebGL-extension detector only
   fires on `Win32`, so it reads "clean" for free under a Mac persona. A "clean" row from a
   platform-gated check is not evidence of safety (host-OS agent, 2026-08-21).

## ⚠️ Measurement hygiene (learned the hard way this project)

- **Cache-bust every measurement while files are being edited.** A cached `shim.js` against a fresh
  `shim-test.html` produced a confident, entirely bogus "5 of 10 detectors, applied-wrong" reading.
- **Confirm the browser.** Measure in real Chrome (UA contains `Chrome/151`, no `Electron`), never
  the in-app Electron pane — that mistake produced a wrong baseline. Authoritative shim-OFF
  composite is **`0c5e721f1ea5ac`**; if a shim-OFF capture doesn't reproduce it, stop and find out
  why before trusting anything downstream.
- **Never run two agents against the same browser when timing matters.** Concurrent drivers made the
  timing side-channel unmeasurable (1.2–3.7 ms/op, wildly variable). Timing ratios from a shared
  session are noise.

---

The reason is not perfectionism. Firefox ships `resistFingerprinting` as advanced-users-only
*because it breaks sites*. An uninstalled extension protects nobody, and the uninstall usually
happens without the user ever connecting the broken page to us — they just conclude the web is
janky and remove the most recent thing they installed. We get one chance.

Worse, breakage is asymmetric: a site that breaks silently (a button that does nothing, a form that
won't submit) is more damaging than one that errors loudly, because the user blames the site,
tells the site's support team, and quietly disables us later.

---

## What our own defenses are most likely to break

Ordered by expected damage, not by likelihood.

| Defense | Breaks | Why |
|---|---|---|
| **Canvas noise** | CAPTCHAs, charts, image editors, games, PDF viewers | Anything that reads pixels back and compares them. Our noise is sub-perceptual but non-zero. |
| **Font spoofing** | Layout, truncation, text measurement | We report a Windows font set on a Mac. Sites that measure text to size containers get wrong answers. |
| **WebGL/WebGPU spoofing** | Maps, 3D, some video players | Renderer strings drive capability decisions and shader workarounds. |
| **`deviceMemory` / `hardwareConcurrency`** | WASM apps, video encoding | Thread-pool sizing. Report too few and things get slow; report too many on a weak machine and they crash. |
| **UA / Client Hints** | "Unsupported browser" walls, server-side feature detection | Sites branch on UA server-side where we cannot intervene. |
| **Tracker blocking** | SSO login, checkout, embedded video, comments | Auth and payment flows routinely traverse domains our lists touch. |
| **GPC** | ~50 known sites incl. USAA, Costco, Spotify, Delta | EasyPrivacy maintains a dedicated section neutralising `navigator.globalPrivacyControl` because it broke them. It breaks on the **JS property**, not the header. |

## Severity model

| | Definition | Response |
|---|---|---|
| **S0 — Blocker** | User cannot complete a core task: log in, pay, submit a form, access an account. | Ship-blocking. Fix or add to the shipped exception list. No exceptions. |
| **S1 — Major** | Feature broken but a workaround exists; or visibly wrong rendering. | Fix before public launch. |
| **S2 — Minor** | Cosmetic, or degraded performance under ~2×. | Document. Fix if cheap. |
| **S3 — Cosmetic** | Noticeable only when looking for it. | Log and move on. |

**Any S0 on a top-100 site ships with a per-origin exception, not a shrug.** The exception list is a
feature, not an admission — Brave, uBlock and AdGuard all ship one.

---

## The suite

Run each with the extension **off**, then **on**, in the same browser profile. Record both.
A flow that is already broken with the extension off is not our bug — that check is why the
"off" pass exists and it is not optional.

### Tier A — S0 candidates. All must pass.

1. **Google SSO** — sign in to any site with "Sign in with Google." Also Apple and Microsoft.
2. **Stripe checkout** — a real test-mode checkout through to confirmation, including 3-D Secure.
3. **PayPal** — the popup flow specifically; it crosses origins repeatedly.
4. **A bank** — log in, view a balance. Fraud vendors (ThreatMetrix, Iovation) sit *inside* bank
   sign-in, which is why `fingerprinting.json` ships its tier-B rules **disabled by default**.
   Verify that default actually holds.
5. **CAPTCHA** — reCAPTCHA v2 checkbox, reCAPTCHA v3 invisible, hCaptcha, Cloudflare Turnstile.
   Canvas noise is a plausible failure cause here and a CAPTCHA you cannot pass is an S0 by
   definition.
6. **Amazon** — add to basket, proceed to checkout (stop before paying).
7. **Government/health portal** — anything with a session and a form. These are the least
   forgiving and the most consequential to break.

### Tier B — high traffic, S1 candidates.

8. **Google Maps** and **OpenStreetMap** — pan, zoom, satellite. WebGL.
9. **YouTube** — playback, fullscreen, quality switch. Also a DRM title (Netflix/Spotify) — Widevine.
10. **Google Docs / Sheets** — open, type, save. Canvas-based rendering.
11. **Figma** or another WASM app — thread-pool sizing against our spoofed `hardwareConcurrency`.
12. **A charting page** — Grafana, TradingView, or any Chart.js dashboard. Canvas readback.
13. **Instagram / X / Reddit** — infinite scroll, media, login.
14. **A news paywall** — should behave *normally*. We are not a paywall bypass and must not
    accidentally become one; that is a legal posture (see the Bypass Paywalls Clean takedown), not
    a preference.

### Tier C — our own claims.

15. **GPC exception list** — visit each of the ~50 EasyPrivacy-listed sites (USAA, Costco, Spotify,
    Delta at minimum) and confirm our exceptions actually suppress the JS property, not just the
    header. **This is the single most likely source of an S0 we ship by accident**, because GPC is
    the feature most likely to be on by default.
16. **Allowlist** — toggle the extension off for one site. Confirm blocking stops immediately, and
    confirm the documented residual: a statically-declared content script cannot be un-declared, so
    the shim patches and restores a few ms later. Verify that restore actually happens.
17. **New identity** — rotate the salt. Confirm every origin gets a new persona and nothing breaks
    mid-session. Note that some sites will treat this as a new device and demand re-auth; that is
    why `autoRotateDays` defaults to 0.
18. **Regression protocol** — `research/BASELINE.md` steps 1–4, in real Chrome, not the Electron pane.

---

## Method

- **Two profiles, not two runs.** Cross-origin persona differences only show with a real profile
  boundary.
- **Watch the console, not just the page.** Our shims are instrumented to fail loud; a silent
  console with a broken page means the breakage is *not* ours and the triage should say so.
- **Record the persona.** Bugs will be persona-specific — a Windows persona on a Mac breaks
  differently than a Linux one. "It broke" is not a report; "it broke under `win11-chrome-rtx3060`"
  is.
- **Test light mode.** Standing lesson from PourIQ: 39 invisible inputs once locked a reviewer out
  entirely, and nobody caught it because everyone tested dark.

## Triage decision tree

```
Site broken with extension ON?
├─ Also broken OFF? ─────────────────→ not ours. Note and move on.
└─ Only broken ON:
   ├─ Disable BLOCKING only, retest
   │   └─ fixed? → a ruleset entry is too aggressive.
   │              Narrow the rule. Do NOT allowlist the whole site.
   ├─ Disable SHIM only, retest
   │   └─ fixed? → bisect: navigator → canvas → fonts → webgl → matchMedia.
   │              Narrow the shim, or exclude that origin from that ONE shim.
   ├─ Disable GPC only, retest
   │   └─ fixed? → add to the GPC exception list (all three copies —
   │              gpc.json and BOTH manifests; validate.mjs fails on drift).
   └─ Still broken with everything off but installed?
       └─ the extension's mere presence is detectable and being acted on.
          That is a finding worth writing up, not just fixing.
```

## Exit criteria

- **Zero S0** across Tier A and Tier C.
- Every S1 either fixed or documented with a shipped exception.
- The GPC exception list verified **by rendering**, on real sites — not by reading the JSON.
- A written breakage log committed to the repo, including what we chose *not* to fix and why.

## The honest note

We will not catch everything. Brave, uBlock and AdGuard all ship exception lists maintained
continuously by many people, and they still break things. What this protocol buys is that the
**first** breakage a user hits is not a checkout page — because that is the one they never forgive.

---

## Run log

### 2026-08-21 — shim breakage battery (harness/breakage-battery.html)

Real `ext/src/shim.js` + real nonce handshake + `win11-chrome-iris-xe` persona (cross-OS: Windows
persona on a Mac host — the hardest consistency case). Ran a battery of real-world workloads.

**Result: 0 fail, 1 warn.** Nothing broke.

| Workload | Result |
|---|---|
| Canvas 2D render + readback | PASS — 16000/16000 px inked, stable across reads |
| WebGL context + render | PASS — cleared, renderer spoofed to Iris Xe |
| Chart/dashboard canvas | PASS |
| Font measurement / layout | PASS — 415×20px, sane |
| Font spoof consistency | PASS — Segoe present, Helvetica Neue absent |
| AudioContext | PASS — running, 48kHz |
| Form input roundtrip (card field) | PASS |
| matchMedia | **WARN** — dynamic-range:high / color-gamut:p3 still true (XDR display via CSS; CSS `@media` is unreachable, `cssRules` throws cross-origin — accepted detectability gap, NOT breakage) |
| Patched fns `[native code]` | PASS |
| WebIDL brand check (Illegal invocation) | PASS |
| Canvas read timing | PASS — 0.49 ms/op |
| Console errors | PASS — none |

**Scope / what this does NOT cover (still gates release):**
- Ran in the **Electron pane (Chromium 148)**, not real Chrome 151.
- Ran **post-load**, not at `document_start` — tests breakage, not protection timing.
- **No DNR blocking, no service worker** — those need a true unpacked install (the OS "Load unpacked"
  file picker is not reachable from the automation tools). So a blocklist entry breaking a cross-origin
  SSO/checkout/bank flow is UNTESTED. That remains the ship gate.

**Read:** the fingerprint shim — the layer most likely to break sites — does not break realistic
canvas/WebGL/audio/font/form workloads even under a cross-OS persona. The network-blocking layer
against real login/checkout flows is the remaining unknown and needs a human + a real unpacked install.
