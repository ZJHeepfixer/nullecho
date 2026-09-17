# Nullecho — release-readiness audit, 2026-09-16

Independent pass over the tree at commit `216ce4a` and after (see git log for the exact commit
this was written against — the tree is being actively edited by other lanes as this is written;
numbers below were re-checked at `ed053a2`). Every claim below is labelled **RUN** (I executed the
command myself, this session) or **CLAIM** (asserted by a doc, not re-verified here). A claim is
not a fact.

---

## 1. What is verified green today

| Check | Command | Result |
|---|---|---|
| Test suite | `cd ext && npm test` | **RUN** — 258/258 passing |
| Ruleset validation | `cd ext && npm run validate` | **RUN** — 182 static rules, 182 unique ids, 0 errors; 69 never-block + 24 cookie-block-only entries |
| UA/Client-Hints generator is idempotent | `cd ext && node rules/gen-ua.mjs` then `git status` | **RUN** — regenerates `ua-{win,mac,linux}.json`; working tree unchanged after. 15 personas covered |
| Suffix-mirror generator is idempotent | `cd ext && node tools/gen-suffix-mirror.mjs` | **RUN** — "shim.js suffix mirror already current (104 suffixes)"; no write |
| Manifests agree, CSP set, permissions match `PERMISSIONS.md` | part of the 258 (`manifest.test.js`) | **RUN** — both manifests: identical permission lists, identical `gpc.js` exclude list, Firefox `data_collection_permissions: {required:["none"]}`, `strict_min_version` ≥ 140 |
| No egress API in shipped source; every `fetch()` reads a bundled file | part of the 258 (`manifest.test.js`) | **RUN** |
| `webRequestBlocking` requested on neither platform; no blocking listener in `heuristics.js` | part of the 258 | **RUN** |
| C3 (dead CANVAS/SUPERCOOKIE report path) closed | this session, `review-2026-09-16.test.js` `C3 GUARD` | **RUN** — code fix already shipped in `ea0400b`; test now guards it (DECISIONS.md D28) |
| Loads in Chrome 151, reCAPTCHA/Google SSO unbroken, shim breakage battery 0 fail | `README.md` Status table, `BREAKAGE-TESTING.md` 2026-08-21 run log | **CLAIM** — dated entries, not re-run this session. The breakage battery itself records it ran in the **Electron pane**, not real Chrome, and **without DNR/service worker** (no unpacked install reachable from that environment) — so "0 failures" covers the shim only, not the network-blocking layer against a real login/checkout flow |

**Not run this session, and why:** no GUI/browser is available in this environment, so nothing
requiring `chrome://extensions` → Load unpacked, a real page load, or a rendered popup/options page
could be verified here. That is the majority of what remains — see §3.

---

## 2. Review findings — still open

Cross-referenced against `ext/src/review-2026-09-16.test.js`: a finding is closed only if every
test carrying its letter says `GUARD` or `FIXED`; any `REPRO` means it is still live. As of
`ed053a2`:

**Closed today** (all now `GUARD`/`FIXED`): A1, A2, A3, A4, A5, B1, B2, B4, B5, B7, B8, C2, C3.
`README.md`'s status table (§(a) below) still lists B1/B7/B8/C3 as open — that line is stale and
is fixed in place this session.

**Still open:**

| Finding | What | File:line (review doc) | Test | Estimated effort |
|---|---|---|---|---|
| **A8** | Web Workers return the real machine (`navigator.*`, `OffscreenCanvas`) — no worker path exists to patch at all | `docs/REVIEW-2026-09-16.md:186` | not reproduced (code/manifest simply has no worker coverage) | Design decision + implementation. Partial mitigation exists (wrap `Worker`/`SharedWorker`, same-origin/blob sources only) — "not free," per the review |
| **B3** | A same-origin `about:blank`/`srcdoc` child gets a *different* persona than its parent (keyed on origin string, not eTLD+1); the worker also refuses to upgrade it | `docs/REVIEW-2026-09-16.md:230` | `B3a`/`B3b` REPRO, `review-2026-09-16.test.js:1119,1137` | "design calls; write the decision first" (review's own ordering, item 6) |
| **B6** | `webgpuIdentity()` maps every Intel GPU to `gen-9` and every NVIDIA GPU to `ampere`; contradicts the per-persona WebGL renderer string for at least 2 of 15 personas | `docs/REVIEW-2026-09-16.md:264` | `B6` REPRO, `review-2026-09-16.test.js:1188` | "verify against real hardware before touching the table" (item 7) — blocked on the same hardware gap as the Linux GPU blocker below |
| **B9** | `Object.prototype.dev = true` (prototype pollution) makes the *genuine* handshake install a debug surface (`window.__nullechoDev`: persona id, forge/read counters, stack traces naming the extension URL) | `docs/REVIEW-2026-09-16.md:291` | `B9` REPRO, `review-2026-09-16.test.js:1267` | "under an hour" (review's ordering, item 5) — fix is `Object.hasOwn` on every handshake payload field |
| **C1** | MAIN→ISOLATED reverse channel (`nullecho:status`, `nullecho:detect`) is unauthenticated — a page can forge `nonce-exposed`, a fake healthy status, or an inflated fingerprint-read counter | `docs/REVIEW-2026-09-16.md:305` | `C1` REPRO, `review-2026-09-16.test.js:1281` | Small feature: mint a second nonce, deliver it in the persona payload, require it on every later report |

**Unconfirmed, code-evident, needs a browser** (not counted above — never reproduced, not
findings the ship gate currently tracks): WebGL2 `readPixels` via `PIXEL_PACK_BUFFER`/`FLOAT` FBO
bypasses the noise kernel; `performance.memory.jsHeapSizeLimit` can contradict a persona's
`deviceMemory`; CSS `(any-pointer: coarse)` still contradicts `maxTouchPoints:0`'s *removal* target
population; actual `Sec-CH-UA-*`/`Accept-Language` header bytes were asserted by code-reading, never
captured off a wire; WebGPU `Symbol.iterator` wrapper's `toString()` differs from real Chrome's.
All at `docs/REVIEW-2026-09-16.md:336-355`.

---

## 3. Things only a human, in a real browser, can do

None of these can be scripted from this environment (no `chrome://extensions`, no unpacked-install
file picker, no real page load). Steps below are condensed from `docs/BREAKAGE-TESTING.md` and
`docs/RELEASE-CHECKLIST.md` — read those for full detail and the triage tree.

1. **Load unpacked in real Chrome 151+.** `chrome://extensions` → Developer mode → Load unpacked
   → `ext/`. Open the service-worker console, confirm clean startup (no uncaught errors from
   `heuristics.install()`, `NullechoGPC.init()`, `ready()`).
2. **Blocking proof.** Open `harness/blocking-proof.html`, click Run. Need **BLOCKING PROVEN**
   (6/6 trackers cancelled, 3/3 controls loaded), then open the popup on the same page and confirm
   a non-zero blocked count (`RELEASE-CHECKLIST.md` §3.1–2).
3. **GPC mechanism.** On `open.spotify.com`, `navigator.globalPrivacyControl` must read `undefined`
   *and* the page must still get a fingerprint persona (the failure mode that would silently kill
   protection on all 50 GPC-excepted hosts at once). On any other site it must read `true`.
4. **Stripe test checkout**, through to confirmation, including 3-D Secure.
5. **A bank login** — sign in, view a balance. Confirm the Tier-B fraud-vendor rules (ThreatMetrix,
   Iovation, etc.) really are off by default in the live flow, not just at the rule-priority level.
6. **Amazon** — add to basket, proceed to checkout, stop before paying.
7. **Google/Apple/Microsoft SSO**, PayPal popup flow, a government/health portal with a session +
   form (`BREAKAGE-TESTING.md` Tier A, items 1–7 — items 4–7 above are the S0 candidates still owed).
8. **Linux GPU renderer strings.** The five `ubuntu-22` personas' WebGL/ANGLE/Mesa renderer strings
   were reconstructed from documented driver formats, never read off real hardware (the font half
   of this was fixed from ground truth on 2026-09-16; the GPU half was not — a Docker/M2 measurement
   has no Linux GPU driver and reports `llvmpipe`, which verifies nothing). Full procedure and the
   "a physical box verifies one of five rows, a VM verifies zero" constraint:
   `docs/LINUX-PERSONA-VERIFICATION.md`. This is release blocker #1 in `RELEASE-CHECKLIST.md` and
   the same hardware gap blocks B6 above.
9. **New-identity rotation, allowlist toggle, regression baseline** — `BREAKAGE-TESTING.md` Tier C
   items 16–18, and Tier B (Maps, YouTube/DRM, Docs/Sheets, a WASM app, a charting page, social
   infinite-scroll, a paywall) for S1 candidates.
10. **Store developer accounts.** Chrome Web Store ($5 one-time) and/or Mozilla AMO — neither
    created yet (no evidence of either in the repo or docs).

---

## 4. Store-listing prerequisites

| Item | State |
|---|---|
| Privacy policy | **Missing.** No `PRIVACY.md`, no policy page under `site/`, nothing found by search. Chrome Web Store requires a privacy-policy URL for any extension requesting broad host permissions (Nullecho requests `<all_urls>`), regardless of how little is actually collected. Firefox's `data_collection_permissions: {required:["none"]}` is a manifest declaration, not a substitute — AMO's own listing flow asks for one too. Drafting this is cheap: the honest answer is already written out in `PERMISSIONS.md`'s "Data handling" section and `THREAT-MODEL.md`; it needs a stable URL. |
| Screenshots / promo images | **Missing.** Chrome Web Store requires at least one 1280×800 or 640×400 screenshot; small promo tile (440×280) is effectively required for discoverability, marquee (1400×560) optional. None exist in `site/` or elsewhere in the repo. The four icon sizes (16/32/48/128) do exist and are wired into both manifests. |
| Description matches the honest claim | **Consistent, checked this session.** `manifest.json`'s `description` ("Degrades commercial ad-tech profiling: tracker blocking, Global Privacy Control, and per-origin fingerprint personas.") does not use any of `THREAT-MODEL.md`'s banned phrases ("protects you from fingerprinting," "anonymous," "untraceable," etc.) and stays inside the canonical claim. The longer store-listing copy has not been drafted yet — when it is, check it against `THREAT-MODEL.md`'s copy rules line by line, the way the popup/options strings already are (per `ext/README.md`). |
| Domains | **Unregistered** — `getnullecho.com` + `nullecho.app`, ~$25, per `RELEASE-CHECKLIST.md` §4. |
| Launch copy | The only drafted blog post (`site/blog-i-built-a-privacy-tool-that-cant-see-you.md`) is explicitly flagged in `RELEASE-CHECKLIST.md` as AI-written and **must not ship as-is** — r/degoogle removes AI-written copy, HN forbids it. Not a formatting nit; a stated launch blocker. |
| Version | `0.1.0` — fine for a first submission. |
| Manifest `minimum_chrome_version` | `121`, comfortably below anything the code uses (per `REVIEW-2026-09-16.md`'s own note). |

---

## 5. Do this next, in order

1. **Linux GPU renderer strings** — reachable hardware, or format-verification from ANGLE/Mesa
   source labelled as weaker evidence, or ship the family narrowed to verified rows (§3.8).
2. **Close C1** — authenticate the MAIN→ISOLATED reverse channel with a second nonce (§2).
3. **Close B9** — `Object.hasOwn` on every handshake payload field (§2, ~1hr).
4. **Decide + close B3** — key same-origin blank/srcdoc children on `registrableDomain(origin)` (§2).
5. **Verify + close B6** — WebGPU architecture table, same hardware pass as #1 (§2).
6. **Record a decision on A8** (Workers) — wrap `Worker`/`SharedWorker` constructors, or accept
   and document the gap explicitly rather than leaving THREAT-MODEL.md's "none available" overstated.
7. **Decide the two anonymity-set questions** — `uaData.platformVersion` per-family constant, and
   the two-versions-stale OS majors (`RELEASE-CHECKLIST.md` §2).
8. **Run the real-browser gate** — blocking proof, popup counter, GPC mechanism, Stripe+3DS, bank
   login, Amazon basket (§3, items 1-7).
9. **Write a privacy policy and produce store screenshots/promo images** — both currently absent (§4).
10. **Register the domains; rewrite the launch blog post in Jason's own voice** — the current draft
    is unshippable as AI-written copy (§4).
11. **Re-run the ten-detector adversarial suite**, adding the detectors this review introduced
    (uniform-fill subtraction, silent-buffer, sub-rect disagreement, FrozenArray identity, `Intl`
    vs `language`), so the count is pinned by name before announcing anything.
12. **Only then:** create Chrome Web Store / AMO developer accounts and submit.

---

*Numbers in this file were checked by running the commands in §1 against commit `ed053a2`. Other
lanes are actively committing to this repo; re-run `npm test`, `npm run validate`, and the finding
cross-reference in §2 before treating this file as current.*
