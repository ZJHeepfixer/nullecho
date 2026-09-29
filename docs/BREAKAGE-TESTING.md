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
   - ✅ **The FONT half of this blocker is closed (2026-09-16).** `FONT_SETS['ubuntu-22']` is now
     ground-truth-derived: generated from a measured default Ubuntu 22.04 desktop
     (`research/linux-ground-truth/`, 180 families) by `gen-fontset.mjs`, never typed. The five
     families it used to claim that no real install has (Noto Sans, Noto Serif, Century
     Schoolbook L, Dingbats, DejaVu Math TeX Gyre) are gone, and a validator invariant plus seven
     tests reject any Linux font a real install lacks. Procedure and detail:
     `LINUX-PERSONA-VERIFICATION.md`.
   - 🔴 **The GPU half is NOT closed by that work, and it is the half that keeps #1 open.** The
     font measurement ran in a Docker container on an M2, which has no Linux GPU driver — Chrome
     there would report SwiftShader, not a real Mesa/NVIDIA string — so nothing about the five
     renderer strings was verified. Read the font fix as *narrowing* #1, not clearing it.
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
- **A hidden tab is not a test environment (2026-09-20).** YouTube fetches no media for a hidden document and
  Google Maps' zoom is an rAF animation that never completes without paint, so both "failed" under every
  extension variant while the OFF control passed — the extension's own first-run options tab had opened in
  front of the test tab (fresh profile = first install), and in a driven real Chrome the agent's tab lived in an
  occluded window. Assert `document.visibilityState === 'visible'` before measuring; `harness/site-bisect.mjs`
  closes extension pages and fronts the test page. Same lesson as the 9/09 hidden Browser pane.

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

15. **GPC exception mechanism** — **two page loads, not fifty** (DECISIONS.md **D17**).
    - On `open.spotify.com` (a shipped exception): `navigator.globalPrivacyControl` must be
      `undefined`, **and the page must still get a fingerprint persona** — the third failure mode,
      and the only one that would silently kill protection on all fifty hosts at once.
    - On any non-excepted site: it must be `true`.
    - The other 48 follow by construction: `validate.mjs` fails the build if any entry is missing
      from `gpc.json`, `manifest.json`, or `manifest.firefox.json`, in both directions. Verified
      2026-08-21 — 50/50/50, zero drift. The fifty hosts share one code path; they differ only in
      list membership, which is EasyPrivacy's to maintain.
    - **Reading the JSON is not the check.** Two real page loads in real Chrome, or it did not
      happen.
    GPC is still the feature most likely to be on by default and therefore the likeliest source of
    an accidental S0 — what changed is the cost of proving it, not its importance.
16. **Allowlist** — toggle the extension off for one site. Confirm blocking stops immediately, and
    confirm the documented residual: a statically-declared content script cannot be un-declared, so
    the shim patches and restores a few ms later. Verify that restore actually happens.
17. **New identity** — rotate the salt. Confirm every origin gets a new persona and nothing breaks
    mid-session. Note that some sites will treat this as a new device and demand re-auth; that is
    why `autoRotateDays` defaults to 0.
18. **Regression protocol** — `research/BASELINE.md` steps 1–4, in real Chrome, not the Electron pane.
19. **Blocking actually blocks** — open `harness/blocking-proof.html` in the Chrome profile that
    has Nullecho installed and click Run. Requires **BLOCKING PROVEN**: all six tracker hosts
    cancelled, all three allowlisted controls loaded. The page refuses to score a pass outside real
    Chrome. See DECISIONS.md **D18** for why the popup counter alone was never sufficient evidence.
20. **The popup counter agrees with the network** — with that same page open, open the popup and
    confirm a **non-zero** blocked count. Harness-blocked + popup-zero means the *counting* path is
    broken even though blocking works; harness-loaded + popup-nonzero means `classifyMatchedRule()`
    is scoring non-blocking rule matches as blocks. This pairing is the only place either bug is
    visible.

---

## Method

- **Two profiles, not two runs.** Cross-origin persona differences only show with a real profile
  boundary.
- **A driven real browser: signed out, and a visible tab, before anything is measured.** An agent run on
  2026-09-20 assumed a logged-out profile and put a real item in the owner's real Amazon cart (removed
  again); the same run measured two "breaks" in an occluded window. Check `document.visibilityState`
  and the sign-in state of every account-bearing site first, and say in the report which held.
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
- The GPC exception **mechanism** verified **by rendering** — one excepted host, one control host,
  real Chrome (D17). Not by reading the JSON.
- `harness/blocking-proof.html` returns **BLOCKING PROVEN**, and the popup's blocked count agrees
  with it (D18). Without this the extension is only known to *run*.
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

### 2026-08-21 — static verification pass + blocking-proof harness built

No new browser measurement. Everything below was verified by reading the shipped artifacts, and is
recorded because each item was previously *assumed*.

| Check | Result |
|---|---|
| GPC list coherence across all three copies | **PASS** — `gpc.json` 50, `manifest.json` 50, `manifest.firefox.json` 50, symmetric difference empty in both directions |
| `excludedRequestDomains` ≡ `excludedInitiatorDomains` | **PASS** — identical sets |
| `validate.mjs` enforces GPC drift | **PASS** — errors in both directions, per manifest (lines 336–347) |
| All 176 DNR rules valid, ids unique | **PASS** |
| Test suite | **PASS** — 196/196 |
| Fraud-vendor tier really is off by default | **PASS** — rule 4700 `allow` at **priority 100** outranks 4500–4507 `block` at priority 1. Tier A.4's "verify that default actually holds" is satisfied at the rule level; the live bank login is still owed |
| Loader does not stall where `gpc.js` is excluded | **PASS** — `maybeDeliver()` gates on the shim nonce only; the GPC nonce is explicitly optional. **This was the failure that would have silently killed fingerprint protection on all 50 GPC-excepted hosts** and it is already handled, with the reasoning in-comment |
| Packed-build blocked-count path exists | **PASS** — `onRuleMatchedDebug` is unpacked-only and correctly guarded; `matchedRulesForTab()` is the packed fallback via `getMatchedRules()`. The popup labels which it is showing |
| `webRequest` permission is actually used | **PASS** — `heuristics.js` registers three non-blocking listeners. Not a gratuitous permission warning |

**Built: `harness/blocking-proof.html`** (DECISIONS.md D18) — the positive proof that blocking
happens, independent of our own counters. Calibrated in the Electron pane as a **negative control**:
0/6 trackers blocked, 3/3 controls loaded, `globalPrivacyControl` undefined. That is the correct
reading for "no extension present", and it confirms all nine probe URLs are live — so under a real
install, a "blocked" row is attributable to Nullecho rather than to a dead URL. Render-verified in
light and dark; the page refuses to score a pass outside real Chrome.

**Gate reduced, not weakened:** Tier C.15 goes from ~50 site visits to 2 (D17). Tier C gains items
19 and 20. Net human effort on Tier C is down from an afternoon to a few minutes; what is proven
went **up**, because nothing previously proved that blocking blocks.

**Still owed, unchanged:** Tier A checkout + bank login on real sites, and the Linux renderer
strings (hard release blocker #1 — see `RELEASE-CHECKLIST.md` for the three options). The Linux
*font* list was fixed from measured ground truth on 2026-09-16 (203/203 tests); that leaves the
renderer strings as the whole of blocker #1, still open.

### 2026-09-20 — first unpacked run in the owner's Chrome + site bisect (docs/breakage-runs/2026-09-20-unpacked-chrome-run1.md)

Agent-driven ON-only pass over 14 logged-out sites in Jason's everyday Chrome (0.9.0 unpacked): 12 PASS, 2 FAIL
(YouTube playback, Google Maps interaction), 1 driver-blocked. Both FAILs were then bisected in Chrome for
Testing with `harness/site-bisect.mjs` and **both were the hidden-tab artifact above, not the extension**: the
complete extension plays YouTube (19 s buffered, persona active) and zooms Maps (12 → 14.42, same as OFF) once the
test tab is in front. Tier C.15 verified by rendering in real Chrome: `open.spotify.com` GPC undefined + persona
present; control true. Real follow-ups are protection misses, not breakage: `offscreenCanvas.getImageData`
runtime failure on Maps; the D30 boot-check timeout on cold-worker first loads. Owner-only Tier A items (bank,
Google SSO, real checkout) still owed.

### 2026-09-26 — owner's Tier A in his everyday Chrome (0.9.0 unpacked, extension ON)

Reported by Jason: **bank login — works; a real B2B checkout (ordered beer for the bar from his supplier) —
works; a real Amazon order placed — works.** No breakage noticed. Tier A.4 (bank, with the fraud-vendor
tier off by default) and A.6 (Amazon checkout, taken through to a real order) are cleared by the owner.
**Still owed:** A.1 Google SSO on the current code (last cleared 2026-08-21, before D35/D46/D47/D48 changed
child-realm and popup handling, which SSO exercises) — to be tried during the store review window, since the
submission goes in with automatic publishing off. A.2 Stripe test-mode and A.3 PayPal popup not run.

### 2026-09-28 — reCAPTCHA script 503 in the owner's Chrome (field report from the Director session) — RESOLVED same day: a LEARNED `google.com` block (D50), not a header and not a 503

| Where | google.com/recaptcha/api.js | Widget |
|---|---|---|
| Owner's everyday Chrome (Nullecho 0.9.0 unpacked, ON), google.com's own demo (first-party) | 200 | renders |
| Owner's Chrome, ascendpartner.com signup (third-party) | **503** | 0 px |
| Owner's Chrome, patrickhlauke.github.io/recaptcha (third-party) | **503** | none |
| Clean Chrome for Testing, store zip OFF / ON — google demo, ascendpartner, patrickhlauke | 200 / 200 | renders |
| curl, same Mac + network, with Nullecho's exact UA + Client-Hint + Sec-GPC header set and the site's Referer | 200 (3/3) | — |

Not a Nullecho *block*: a blocked request shows `net::ERR_BLOCKED_BY_CLIENT`, not an HTTP status, and no ruleset names
recaptcha/gstatic. A 503 is Google's answer. No service worker on the site. The store build does not reproduce it in a
clean profile. **Still possible that Nullecho contributes in the owner's profile**: branded Chrome sends Google-only
headers (X-Client-Data variations, signed-in cookies) that neither CfT nor curl carries, and Nullecho rewrites the UA and
all Client Hints (Full-Version "151.0.0.0", Platform-Version "14.6.0") beside them — an inconsistency only a real signed-in
profile would present. The other candidate is Google scoring that profile as automated (claude-in-chrome drives it).
**Decider (owner, 30 s):** on a failing page, popup → turn Nullecho off for this site → reload. Widget appears ⇒ ours (S0,
fix before publish). Still 503 ⇒ not ours. Publishing is on hold regardless (auto-publish is off).

**Resolution (same evening).** Owner's toggle test: Nullecho off for the site ⇒ box back, so ours. D49 (hints removed)
reloaded and verified live via httpbin — **still failing**. A second experiment (User-Agent + Sec-CH-UA left real, i.e.
Chrome 153 — the owner's Chrome had auto-updated past the pool's hardcoded 151) — **still failing**; both hypotheses
falsified in the owner's Chrome before any fix was built on them. Then the dynamic rules on disk
(`Default/DNR Extension Rules/<id>/rules.json`) showed the cause, written at 17:18 that day:

    {"action":{"type":"block"},"condition":{"domainType":"thirdParty","requestDomains":["google.com"]},"id":1000000,"priority":1}

The heuristic learner had promoted `google.com` (its account cookies ride on every Google embed, so a normal week of
browsing gives it three strikes) and the rule's `requestDomains` covered every subdomain — `www.google.com/recaptcha/`,
`accounts.google.com`, `apis.google.com`. Third-party only, which is why google.com's own demo worked; a fresh profile
has no learned state, which is why CfT, the store zip and curl never reproduced it; the allowlist's `allowAllRequests`
outranks dynamic rules, which is why "off for this site" fixed it.

**The measurement error that sent us after headers:** the "503" came from claude-in-chrome's `read_network_requests`,
which reports ANY failed request as `statusCode: 503` — checked the same evening: `google-analytics.com/analytics.js`,
which the static analytics list blocks, is listed as 503 too. Google never answered 503. The first triage also checked
the static rulesets for google.com and stopped there; the dynamic ones were never read. **Rule: a status from that tool
is not a server response; for "is Nullecho blocking this", read `rules.json` in the profile.**

**Fixed (D50), verified in the owner's Chrome with Nullecho ON:** reload migrated the record to a cookie-strip with
`excludedRequestDomains: [accounts.google.com, apis.google.com, www.google.com]`; `grecaptcha` loaded and the anchor
iframe rendered 304×78 on patrickhlauke.github.io/recaptcha **and** ascendpartner.com signup (anchor + bframe 200).
The reload itself surfaced a second defect — `install()` and `onInstalled` ran `reconcile()` concurrently and Chrome
refused the duplicate id ("Rule with id 1050000 does not have a unique ID") — fixed in the same change (serialised,
idempotent writes); the race test reproduces it only with IPC-like latency in the DNR stub.

**Gap this exposes in our testing:** every automated run starts from a profile with no learned state. The learner is
the one layer that changes behaviour with use, so the smoke must also run with a SEEDED learned state (the big
multi-service domains promoted) — see PRELAUNCH-HARDENING step 4.

### 2026-09-28 — seeded learned-state smoke built and proven (docs/breakage-runs/2026-09-28-seeded-learned-state.md)

The gap above, closed for the automated gate: `harness/site-smoke.mjs --seeded` (`npm run smoke:seeded`) seeds the
learner's storage with twelve multi-service domains promoted (`blocked`, `source: 'learned'`), reloads the extension so
the shipped `reconcile()` writes the rules, and aborts unless `getDynamicRules()` shows them live and a probe fetch is
blocked and attributed. Then 14 + 13 third-party rows (reCAPTCHA v2 ×2, Enterprise, Turnstile, hCaptcha, Google Sign-In
×2, YouTube / Maps ×2 / Calendar embeds, Facebook plugin, X post) OFF and ON, with every learned-rule match attributed to
its row via `onRuleMatchedDebug` — the "is Nullecho blocking this" question answered by the worker, not by a status code.

**Current code: exit 0** — 24 PASS, nytimes BLOCKED (bot wall, both passes), 2 POLICY-BLOCKED, zero learned blocks on
protected hosts. **Negative control, same zip with the pre-D50 learner: exit 1** — 14 FAIL, each attributed (reCAPTCHA
api.js / enterprise.js, `accounts.google.com/gsi/client`, `challenges.cloudflare.com`, the Google embeds), plus the D50
reload race in the worker console. Three of those FAILs (Spotify, YouTube watch, Reddit) were rows whose own checks still
passed: the gate also checks every learned block in every row against NEVER_BLOCK / COOKIE_BLOCK_ONLY.

**Found, not fixed:** (1) a learned `facebook.com` / `twitter.com` block removes Facebook plugins and embedded X posts
from every third-party site — POLICY-BLOCKED until the owner decides on COOKIE_BLOCK_ONLY; Apple Music / OneDrive /
LinkedIn embeds predicted by the same rule shapes, not rendered. (2) A learned `microsoft.com` block stops
microsoft.com's own silent sign-in callback (`/cascadeauth/account/signin-oidc`, initiator `login.live.com`) — the
carve-outs cover requests *to* identity hosts, not an IdP posting *back* into a learned domain; user impact not verified.
(3) Top-level navigations are untouched by learned `thirdParty` rules (measured).
