# Nullecho — what is actually left before launch

One ordered list. `BREAKAGE-TESTING.md` is the *protocol*; this is the *queue*.
Last revised 2026-09-19.

**Where things stand:** 477/477 tests, 182 DNR rules valid, ~16k lines, loads clean in real
Chrome 151, open-sourced and public but **announced nowhere**. The code is in good shape. Nearly
everything below needs a human in front of a browser, which is the actual bottleneck — so the work
this pass went into making each item *small*, not into writing more code.

---

## 1. Linux GPU strings — blocks release, needs hardware (scope TBD)

**The problem:** the `ubuntu-22` personas' WebGL renderer strings were reconstructed from documented
driver formats and **never read off a real Ubuntu machine**. A renderer string no real driver emits
makes every Nullecho-on-Linux user *uniquely* identifiable — the precise failure the project exists
to prevent. Blast radius is exactly "Chrome on Linux hosts", because D12 selects within the host's
own OS family.

**DECIDED 2026-08-21 (Jason): verify against real Linux.** The carry-don't-apply workaround
(pass the true renderer through on Linux hosts) was considered and **not taken** — we get the
strings right rather than routing around them.

**Full procedure + the constraint: `docs/LINUX-PERSONA-VERIFICATION.md`.** Read it before
sourcing hardware. The headline:

> The five Linux rows name **four distinct driver stacks**, and two of them pin driver, LLVM, DRM
> and kernel revisions. **A physical box verifies exactly the GPU it contains — one of five. A VM
> verifies zero**, because UTM/QEMU and non-GPU cloud instances report `llvmpipe` or `virgl`.

So this closes in one of three ways, and the first is a question for Jason, not a task:
1. **Reachable hardware determines the scope.** Whatever real Ubuntu machines exist verify their
   own rows; the pool narrows to those. Needs an answer to "what Linux hardware can you get to?"
2. **Format verification from primary sources** (ANGLE + Mesa source, plus a real-world corpus for
   population weights) — covers all five, no hardware, but is explicitly weaker evidence and must
   be labelled as such in `personas.js` and the release notes.
3. Ship narrowed to verified rows. ⚠️ Watch `MIN_PERSONAS_PER_FAMILY` (4) and `validatePool()`, and
   **never** drop the family outright — `personasForFamily()` falls back to `'win'`.

## 2. Two remaining hard blockers — decisions, not work

Both are anonymity-set questions from `BREAKAGE-TESTING.md`, and both need a recorded answer
rather than a code change:

- **`uaData.platformVersion` is one constant per family** (`mac 14.6.0 / win 15.0.0 / linux 6.8.0`)
  across the whole user base — a population-level tell of the same shape as "everyone reports 8 GB".
  Vary within realistic bounds, or accept and record why.
- **The OS majors are two versions stale** (personas say macOS 14 / Windows "15.0.0"; this host
  reports `26.6.0`). Confirm those are still high-population, or refresh the pool.

---

## 3. Real-browser gate — Jason, one sitting, ~30 minutes

Do these in the Chrome profile that already has Nullecho loaded unpacked.
Already cleared on 8/21: reCAPTCHA v2, Google SSO, shim breakage battery.

1. **Blocking proof** — open `harness/blocking-proof.html`, click Run.
   Need: **BLOCKING PROVEN** (6/6 trackers cancelled, 3/3 controls loaded). *~1 min.*
2. **Popup counter agrees** — same page still open, open the popup. Need a **non-zero** blocked
   count. Disagreement either way is a real bug and this is the only place it shows. *~1 min.*
3. **GPC mechanism** (D17, replaces the old fifty-site sweep) — on `open.spotify.com` console,
   `navigator.globalPrivacyControl` must be `undefined`, and the page must still get a persona.
   On any other site it must be `true`. *~3 min.*
4. **Stripe test checkout** through to confirmation, including 3-D Secure. *~10 min.*
5. **A bank login** — sign in, view a balance. The fraud-vendor rules are off by default and that
   was verified at the rule level (allow@100 beats block@1), but the live flow is still owed.
   *~5 min.*
6. **Amazon** — add to basket, proceed to checkout, **stop before paying**. *~5 min.*

Any S0 gets a per-origin exception, not a shrug. Record the persona in any bug report — "it broke"
is not a report, "it broke under `win11-chrome-rtx3060`" is.

---

## 3b. Package the store build — MUST happen before any submission

**There is no packaging script today, and zipping `ext/` whole fails AMO validation.**
`npx web-ext@8 lint` on the tree returns **3 errors and 2 warnings**, every one of them from a file
that has no business in a shipped package: the three `.mjs` generators start with a
`#!/usr/bin/env node` shebang that AMO's parser rejects, `src/gpc.test.js` trips
`UNSAFE_VAR_ASSIGNMENT` on a dynamic import, and `src/personas.test.js` trips `DANGEROUS_EVAL` on a
`Function` constructor. `ext/` is 56 files; **21 of them must not ship.**

**The step:**

1. Build the package from an **allowlist**, never by zipping the tree. Ship exactly:
   - `manifest.json` (or `manifest.firefox.json` renamed to `manifest.json` for the AMO build —
     exactly one manifest per zip)
   - `icons/` — `icon-16.png`, `icon-32.png`, `icon-48.png`, `icon-128.png`
   - `src/*.js` **minus every `*.test.js`**
   - `popup/` — `popup.html`, `popup.js`, `popup.css`
   - `options/` — `options.html`, `options.js`, `options.css`, `drop.html`, `drop.js`
   - `rules/*.json` only
2. **Excluded, explicitly** — the 21 files: `PERMISSIONS.md`, `README.md`, `package.json`,
   `rules/README.md`, `rules/gen-ua.mjs`, `rules/validate.mjs`, `rules/ua.test.js`,
   `tools/gen-suffix-mirror.mjs`, and the thirteen `src/*.test.js` files
   (`background`, `claim-verification-2026-09-17`, `gpc`, `handshake-integration`, `heuristics`,
   `layout-early-out`, `linkage`, `manifest`, `native-shape`, `personas`, `protocol`,
   `review-2026-09-16`, `shim-handshake`) — plus `src/same-tick-realm.test.js` and any `*.test.js`
   added after this was written. The rule is the glob, not the list.
   Also excluded by the same rule: the *other* platform's manifest, so a Chrome zip never carries
   `manifest.firefox.json` and vice versa.
3. Re-run **`npx web-ext@8 lint` on the package, not on the tree**, and require **0 errors**.
4. Re-run `npm run validate` and `npm test` from the tree first; both are generators-and-tests work
   that must pass before a package is cut.

> **TODO for the `ext/` owner — not written by this lane.** The script belongs at
> `ext/tools/package.mjs` with an `npm run package` entry in `ext/package.json`, taking a
> `--firefox` flag to swap the manifest. This lane owns docs, not `ext/`, so the step above is the
> checklist item and the script is still owed. Until it exists, the allowlist has to be applied by
> hand, and hand-application is exactly how the 21 files get shipped.

**Reproducible-build facts AMO will ask for** (source-code submission is owed because two custom
generators produce files that ship — `rules/gen-ua.mjs` → `rules/ua-{win,mac,linux}.json`, and
`tools/gen-suffix-mirror.mjs` → the generated blocks in `src/shim.js`):

- Node 20 or newer, macOS or Linux. There is no `engines` field and no `.nvmrc`; pin one.
- **Zero npm dependencies, therefore no `package-lock.json`.** Say that explicitly — an absent
  lockfile reads as an omission unless it is declared.
- Build: `node rules/gen-ua.mjs && node tools/gen-suffix-mirror.mjs && npm run validate && npm test`,
  then the packaging allowlist above. `npm run validate` **fails** if a generated file differs from
  what its generator emits, which is the diff-to-zero property AMO's reviewers check for.

---

## 3c. Pre-release site smoke — run before every store upload

`harness/site-smoke.mjs` (`npm run smoke` from `ext/`) builds the store package
(`ext/tools/package.mjs`), loads THAT zip — not the source tree — into Chrome for Testing, and
runs 14 real sites (CAPTCHA renders, Amazon search, Maps zoom, YouTube playback, a paywalled
NYT article, IRS search, Reddit, and the GPC-exception control on `open.spotify.com`) with the
extension OFF and then ON, side by side. It reuses `site-bisect.mjs`'s hidden-tab handling
(close extension pages, front the tab, assert `visibilityState === 'visible'` before measuring)
and reports PASS / FAIL / NOT-OURS / BLOCKED per site, plus every `Nullecho`/`Illegal invocation`
console line verbatim. Run it — and read the resulting `docs/breakage-runs/<date>-site-smoke.md`
— before every Chrome Web Store or AMO upload; a FAIL there on a site that PASSED under `--off`
is a real regression in the exact package about to ship, not a source-tree finding that may or
may not have made it into the zip.

---

## 4. Launch — after the gate, not before

Ordered by dependency. Everything here is gated on §3 passing.

- **Chrome program prerequisites — each one is a hard gate on the submit button:**
  - **2-Step Verification on the developer account.** It is its own section of the Developer Program
    Policies and is a precondition for publishing. Neither developer account exists yet.
  - **Opt into CWS verified uploads** (RSA-signed uploads). This is the direct countermeasure to the
    Cyberhaven-style account takeover the README's trust section is written about.
  - **EU trader declaration.** Mandatory, and *posted publicly on the listing* — legal name, phone,
    address. It interacts with the `LICENSE` copyright-holder question (legal name vs. handle);
    whichever Jason picks, `LICENSE`, the store publisher name and the trader declaration must agree.
- **Register `getnullecho.com` + `nullecho.app`** (~$25, still unregistered).
- **Rewrite the blog post in Jason's own voice** — `site/blog-i-built-a-privacy-tool-that-cant-see-you.md`
  is a draft written by Claude and **must not ship as-is**: r/degoogle removes AI-written copy and
  HN forbids it outright. This is not optional polish.
- **Lead with the technical essay, not a launch announcement.** A fingerprinting writeup scored 756
  points where a comparable extension launch scored 20; "extension" in a Show HN title runs about a
  third of baseline. r/privacy is effectively closed (8 of 8 open-source launches removed in 2026).
- **Every claim must be true at default settings.** People install and check within the hour, and
  overclaiming gets dismantled in public.
- Full channel research: `docs/LAUNCH.md`, kit at `site/LAUNCH-KIT.md`.

---

## What is deliberately NOT on this list

- **Decoy ad-clicking.** Cut on the merits (D1): Google counts phantom clicks and bills advertisers,
  so the cost lands on small businesses. Not a risk call — a targeting one.
- **Monetization.** No premium tier, no affiliate VPN, no data sales. The telemetry and account
  hooks were removed on purpose and are not coming back.
- **Anything implying we beat a determined adversary, or touch your IP.** The honest claim is fixed:
  *shows each site a different, internally consistent device profile, which breaks the cross-site
  device-fingerprint join. It is detectable, it does not defeat a determined adversary, and it does
  nothing about your IP.* Firefox RFP and Brave are genuinely stronger; we say so in-product. Our
  niche is Chrome, where neither exists.

## Versioning — what the number is allowed to say

`0.9.0` (2026-09-20) means **release candidate**: feature-complete for the claims in `THREAT-MODEL.md`, every
claim measured by a third-party library or a loaded browser, legal surfaces reviewed 2026-09-19. Chrome's
`version_name` carried that sentence until 2026-09-26, when it was removed at store submission: the Chrome Web Store displays `version_name` publicly as the version, and "release candidate — every claim independently measured" read as unfinished and as a slogan in a version field. Both stores now show the bare number.

**`1.0.0` may be set only when all three are true, in this order, and each is recorded in this file with a date:**
1. Loaded **unpacked in stable Chrome by the owner** (not Chrome for Testing) and the popup, options, per-site
   GPC switch and the measure-it-yourself panel each rendered and worked.
2. **Tier A breakage pass clean** (`docs/BREAKAGE-TESTING.md`: checkout, bank login, SSO, CAPTCHA) on that install.
3. **Store submission filed** (Chrome Web Store and/or AMO) with the packaged zip from `ext/tools/package.mjs`.

Until then the number stays `0.9.x`; patch releases bump the third digit. The version is a claim like any other.

## 2026-09-26 — submitted to the Chrome Web Store

- Item ID `ngolhoibjdchbbidglcfpljnabjfkfbn`, publisher "Nullecho" (Core Capital Investments LLC, trader, verified).
- Package 0.9.0 built by `ext/tools/package.mjs` from commit `4f048c0` (tag `v0.9.0-cws-submitted`), zip sha256 `b12246d478c1feaec960a0c3a769c5431f0157231e8af3f87162cdf40e6c8814`.
- Listing: description, Privacy & Security, English (US), icon, 5 screenshots, official URL nullecho.org (Search
  Console-verified), homepage, support = GitHub issues. Privacy tab: single purpose, six justifications, remote code
  **No**, data usage **Web history + User activity + Website content** (local-only handling must be disclosed per
  Google's User Data FAQ), three certifications, privacy policy nullecho.org/privacy/. Test instructions ≤500 chars.
- **"Publish automatically after review" unchecked** — approval stages it; Jason publishes after the Google SSO check.
- Lessons at submission: the store summary comes from the manifest `description` (rewritten in plain words);
  `version_name` displays publicly (removed); the reviewer-notes box is 500 characters, not 16,000; `pbcopy` needs a
  UTF-8 locale or em dashes paste as "‚Äî".
