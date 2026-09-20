# Nullecho — store, licensing, privacy-statement and truth-in-advertising review

**Lane:** our own compliance as a published extension. **Date:** 2026-09-19.
**Tree:** working tree at `f71a139` (`ext/src/shim.js` read from `git show HEAD:` — another lane owns it).
**Mode:** read-only. Nothing under `ext/` was modified; nothing outside this file was modified.

Every policy quotation below was fetched from the live policy page this session, and every
code/count claim is labelled **RUN** (I executed it) or **READ** (I read it). A claim is not a fact.

**Counts: 7 BLOCKER · 14 SHOULD-FIX · 8 NICE.**

---

## 0. What was actually run

| Check | Command | Result |
|---|---|---|
| Test suite | `cd ext && npm test` | **RUN** — **310/310 passing** (not 258 — see S2) |
| Ruleset validation | `cd ext && npm run validate` | **RUN** — 182 rules, 182 unique ids, 0 errors; 69 never-block, 24 cookie-block-only |
| AMO linter | `npx web-ext@8 lint` on a scratch copy of `ext/` with `manifest.firefox.json` renamed to `manifest.json` | **RUN** — **3 errors, 2 warnings, 0 notices** (see B7) |
| Vendor integrity | `shasum -a 256 harness/vendor/*.js` | **RUN** — all three match `harness/vendor/README.md` byte-for-byte |
| Egress surface | `grep -rn "fetch(\|XMLHttpRequest\|sendBeacon\|WebSocket\|EventSource\|importScripts\|eval(\|new Function\|storage.sync" ext/` | **RUN** — exactly two `fetch()`, both `chrome.runtime.getURL(...)`; zero `eval`/`new Function` in shipped (non-test) source |
| Checkout Report | `grep -rni "checkout" .` | **RUN** — **zero implementation**; see B1 |
| ClientJS NOTICE | GitHub contents API on `jackspirou/clientjs` | **RUN** — no `NOTICE` file upstream; Apache-2.0 §4(d) does not bite |

---

## 1. BLOCKERS

> Would get us rejected/removed, or is a false public claim.

### B1 — The Checkout Report is promised in four public documents and does not exist in the code

**Evidence (RUN).** `grep -rni "checkout"` across the repo returns no implementation. There is no
`checkout*.js`, no popup or options surface, no DNR rule, no §349-a detector. The only place it is
described as something to build is `research/SURVEILLANCE-PRICING.md:454` — *"What to build: the
Checkout Report (option b)"*. It is nonetheless promised as a shipped feature in:

- `README.md:31` — "**Checkout Report** — what a shopping page contacted before it quoted you a price, and whether it carried the algorithmic-pricing disclosure NY/MD/CT law now requires."
- `docs/PRIVACY-POLICY.md:14` — "…and offers a Checkout Report plus a guided link to California's data-broker deletion platform (DROP)."
- `docs/STORE-LISTING.md:52` — "it can show you what a shopping page contacted before it quoted you one."
- `docs/STORE-LISTING.md:68` — "per-origin device personas, a Checkout Report, and a guided link to California's DROP…"
- `docs/STORE-LISTING.md:122` — screenshot shot-list item 5, "**The Checkout Report on a real checkout page**"
- `site/blog-…md:58` — "Shows you what each shopping page did before it quoted you a price…"

**Policy.** Chrome Web Store, *Deceptive Installation Tactics*: **"Extensions must be marketed
responsibly. The set of functionalities promised by the extension must be stated clearly and in a
transparent manner."** And *Misleading or Unexpected Behavior*: **"We do not allow products that
deceive or mislead users, including in the content, title, description, or screenshots."** A
listing whose screenshot shot-list includes a feature that does not exist is a direct hit on both.
FTC Act §5: a representation is deceptive if it is likely to mislead a consumer acting reasonably
and is material to a purchase/install decision — a named product feature is material by definition.

**Also.** `docs/STORE-LISTING.md:122` instructs Jason to *capture a screenshot* of this feature. It
cannot be captured. Whoever runs the shot-list will discover this the hard way.

**Fix (choose one, do not do both):**
- Delete every Checkout Report sentence from `README.md`, `docs/PRIVACY-POLICY.md`,
  `docs/STORE-LISTING.md` (including shot-list item 5) and the blog draft; or
- Build it before any listing copy ships.

A third option that is **not** acceptable: relabelling it "planned". A roadmap item inside a
features list still reads as a feature to an installer.

---

### B2 — "2 of 10 adversarial detectors fire" is published in six places and the project's own threat model says it is false

**Evidence (READ).** `docs/THREAT-MODEL.md:28`, the governing document, was amended 2026-09-17:

> ⚠ **Our "2 of 9" was measured by our own detectors and is far too low.** CreepJS (2026-09-17):
> **453 lies across 198 APIs**, `hasToStringProxy: true`, `webDriverIsOn: true` — it classifies
> Nullecho as a *bot*. … **Both closed 2026-09-17** (shape: D32, 453 → 199 lie records …).

And `docs/CLAIM-VERIFICATION-2026-09-17.md:398`: *"Publishing the lower number while the higher one
is a `<script>` tag away is the kind of understatement this project's threat model exists to
prevent."*

The stale number is still live in every user-facing surface:

| File:line | Quoted sentence |
|---|---|
| `README.md:42` | "**It is detectable.** 2 of 10 adversarial detection methods still fire against our own build." |
| `SECURITY.md:19` | "it is detectable (2/10 adversarial detectors fire)" |
| `site/prove-it/index.html:140` | "**It is detectable.** Against our own build, 2 of 10 adversarial detection methods still fire. We publish that number rather than hide it." |
| `site/LAUNCH-KIT.md:63` | "it's detectable (2/10 methods still fire)" |
| `site/blog-….md:66` | "When I tested my own build adversarially, 2 of 10 detection methods still fire — mostly things no browser extension can reach." |
| `.github/ISSUE_TEMPLATE/detection.md:12` | "(CSS `@media` display leak, WASM fingerprinting, IP/TLS, 2/10 adversarial detectors)" |

Three of these six make the number worse by editorialising it as candour: *"We publish that number
rather than hide it"*, *"mostly things no browser extension can reach"*. The measured reality is 199
lie records across a third-party library and a **bot** classification — which
`CLAIM-VERIFICATION-2026-09-17.md:3a` notes is the *more expensive* verdict for the user than a
privacy-tool verdict (Fingerprint.com weights: bad bot 7, privacy settings 6).

**Policy.** *Misleading or Unexpected Behavior* — falsely characterising a security/privacy
property. FTC §5 — a quantified limitation claim that understates the limitation by two orders of
magnitude, published in the very sentence that asks the reader to trust the disclosure.

**Proposed rewrite** (one sentence, usable in all six places):

> **It is detectable.** Our own ten-detector suite catches two, but that number is our score on our
> own test. CreepJS — a free, off-the-shelf library — flags ~199 lying API records and classifies
> the browser as automated. We publish the worse number because it is the true one.

---

### B3 — "breaks the join / can't link you" is stated unqualified in eight places after the 2026-09-17 qualification

**Evidence (READ).** `docs/THREAT-MODEL.md:27`, the canonical-claim evidence table, ends the "breaks
the join" row with: **"So this clause is true of the most-deployed commercial library and FALSE of a
lie-discarding one. It may not be stated unqualified."**

Still unqualified:

| File:line | Quoted sentence | Rank |
|---|---|---|
| `docs/STORE-LISTING.md:16` | "Blocks trackers, sends Global Privacy Control, and shows each site a different device profile **so they can't link you.**" | worst — this is the ≤132-char store summary |
| `docs/STORE-LISTING.md:36` | "…so sites **can't join your visits together by fingerprint.**" | |
| `docs/PRIVACY-POLICY.md:13` | "…shows each site a different but internally-consistent device profile **so sites can't join your activity together by fingerprint**" | |
| `README.md:29` | "Site A and Site B **can't join you.**" | |
| `site/prove-it/index.html:130` | "Site A and Site B see different machines and **can't connect your visit** to one with your visit to the other." | |
| `site/blog-….md:39` | "**Neither can join you to the other**, which is the actual harm." | |
| `ext/popup/popup.html:99` | "…which is **what breaks the join between them.**" | in-product |
| `ext/options/options.html:346` | "…**breaks the join those sites use to follow you between them.**" | in-product |

`CLAIM-VERIFICATION-2026-09-17.md:6.1` already supplies the defensible sentence:

> *breaks the join for trackers that hash the signals we cover; does not break it for a tracker that
> discards spoofed signals and keys on the display layer.*

**Proposed store summary (≤132 chars, 128 used):**

> Blocks trackers, sends Global Privacy Control, and shows each site a different device profile so most trackers can't link you.

**Proposed body sentence:**

> Site A and Site B see different machines, which breaks the join for trackers that hash the signals
> we cover — verified against FingerprintJS and ClientJS. A tracker that detects and discards
> spoofed values and keys on the display layer can still re-join them; CreepJS does exactly that.

**Policy.** Same two Chrome policies as B2, plus the project's own binding copy rule. The in-product
strings (`popup.html`, `options.html`) belong to the shim lane's file set only insofar as they are
under `ext/` — flagged here, not edited.

---

### B4 — No privacy-policy URL and no contact method exist; the policy itself still carries two unresolved `[VERIFY]` blocks

**Evidence (RUN).** `grep -rni "mailto:|support@|contact@|security@|@nullecho"` finds **no mailbox
anywhere in the repo**. `nullecho@nullecho.app` (`ext/manifest.firefox.json:8`) is a Gecko extension
ID, not an address, and `nullecho.app` is unregistered (`docs/RELEASE-READINESS-2026-09-16.md:104`).

`docs/PRIVACY-POLICY.md:113-119` ends with an unresolved placeholder:

> `[VERIFY: no support email or contact address exists yet anywhere in this repo — add one before
> submitting to any store; Chrome Web Store requires a working contact method on the listing. This
> policy also needs a stable, permanent URL to link from the listing …]`

**Policy — and this answers the question the task asked.** Chrome's *Privacy Policy* /
*Disclosure Requirements*:

> **"Products that handle user data must, at a minimum: Post a privacy policy in the Chrome Web
> Store Developer Dashboard."**
>
> **"Extensions are required to disclose how they handle user data, even when data is processed or
> stored locally on a user's device."**

So: **yes, a privacy policy URL is required even though we collect nothing.** "Handle" is the
trigger, not "transmit". Nullecho handles browsing activity (`webRequest` observation, per-site
stats keyed by registrable domain, a persona salt) locally — that is squarely inside the sentence
above. `chrome.storage.local` does not exempt it.

The *Limited Use* answer, also asked: Google's Limited Use text reads **"Developers are only allowed
to use permissions, which collect, to provide or improve your single purpose or user-facing
features"** and **"Developers are never allowed to use or transfer user data to serve users
personalized, re-targeted, or interest-based advertisements."** Both are satisfied trivially, but
they are **not optional to answer** — the dashboard gates publication on them:
**"Every item will need to provide these data collection disclosures and limited use certification
in order to be updated or published."** So the `[VERIFY]` at `PRIVACY-POLICY.md:103-110` resolves
to: *the certification is mandatory; the Limited Use statement is a checkbox set in the dashboard,
not prose you write*. Replace that block with a plain statement that no Google API or OAuth scope is
used and that the dashboard certification is completed at submission.

**Also.** Chrome's *Handling Requirements* — **"Handle the user data securely, including transmitting
it via modern cryptography"** — has no application here (nothing is transmitted), and the policy
should say so in one line rather than leaving a reviewer to infer it.

**Fix:** (1) register a mailbox and put it in `SECURITY.md`, the privacy policy, and both store
listings; (2) host `PRIVACY-POLICY.md` at a stable URL (GitHub Pages `/privacy` is acceptable and
free — see N1 for the log-collection consequence); (3) delete both `[VERIFY]` blocks.

---

### B5 — Launch copy still carries the "our Firefox build is strictly more capable" claim the project recorded as its one over-claim

**Evidence (READ).** `ext/PERMISSIONS.md:187-193`:

> ⚠️ **This is the one place the project has over-claimed.** `docs/ARCHITECTURE.md` and
> `ext/README.md` used to say or imply the Firefox build was strictly more capable *because* Firefox
> retained blocking webRequest. True of Firefox; false of the artifact. Both were corrected on
> 2026-08-21…

`docs/ARCHITECTURE.md:103` carries the correction. **The launch documents were never corrected:**

- `docs/LAUNCH.md:107` — "…observe requests, you don't cancel them. **\"Our Firefox build is strictly more capable\" is a true and**" (the correction is mid-sentence in the source; the surrounding paragraph still recommends the framing)
- `docs/LAUNCH.md:927` — "**\"The Firefox version blocks things the Chrome version structurally cannot, because Google removed the API\" is true**, interesting, on-beat for r/firefox, r/degoogle and privacy YouTube, and costs nothing."
- `site/LAUNCH-KIT.md:36` — "Firefox AMO first (friendlier review, **our build is more capable there**)."

`LAUNCH.md:927` is staged *press-pitch copy*. `webRequestBlocking` is requested on neither platform
(verified by `ext/src/manifest.test.js`, RUN as part of the 310), so the Firefox build **does not**
block anything the Chrome build does not. Shipping that sentence to r/firefox or a journalist is a
false public claim from a project whose entire pitch is that it does not make those.

**Fix:** rewrite all three to the true version — *Firefox gives us better tracker attribution in a
packed build because `webRequest` observation survives there; blocking behaviour is identical on
both because every block is a DNR rule.*

---

### B6 — "the algorithmic-pricing disclosure NY/MD/CT law **now** requires" is false for two of the three states

**Evidence (READ).** `research/ALGORITHMIC-PRICING-COMPLIANCE-BRIEF.md:52-54`, the project's own
primary-source table:

| State | Effective |
|---|---|
| NY (GBL § 349-a) | enforced **2025-11-10** |
| MD (Com. Law §§ 13-321, 13-322) | **2026-10-01** |
| CT (P.A. 26-130 § 11) | **2027-07-01** |

Today is 2026-09-19. Maryland is 12 days away; Connecticut is 21 months away. `README.md:32` says
"**now** requires". Only New York is in force. `site/blog-….md:59` gets this right ("New York law
now requires") — the README does not.

This compounds B1: the feature that would detect the disclosure does not exist, and the legal
predicate for two of the three named states has not arrived.

**Fix:** delete with B1, or if the feature is ever built, state "New York requires today; Maryland
from 1 Oct 2026; Connecticut from 1 Jul 2027."

---

### B7 — `web-ext lint` fails: 3 errors, and there is no packaging step at all

**Evidence (RUN).** `npx web-ext@8 lint` against a scratch copy of `ext/` with the Firefox manifest
in place:

```
summary {"errors":3,"notices":0,"warnings":2}
ERROR  JS_SYNTAX_ERROR  rules/gen-ua.mjs         L55
ERROR  JS_SYNTAX_ERROR  rules/validate.mjs       L31
ERROR  JS_SYNTAX_ERROR  tools/gen-suffix-mirror.mjs L12
WARN   UNSAFE_VAR_ASSIGNMENT  src/gpc.test.js      L199  (dynamic import)
WARN   DANGEROUS_EVAL         src/personas.test.js L847  (Function constructor is eval)
```

All five come from files that have no business in a shipped package. Cause: the three `.mjs`
generators begin with a `#!/usr/bin/env node` shebang, which AMO's parser rejects.

**Root cause (RUN).** `find ext -type f | wc -l` → **56 files**, of which **21** are tests,
generators, `package.json`, or markdown:

```
ext/PERMISSIONS.md            ext/README.md                 ext/package.json
ext/rules/README.md           ext/rules/gen-ua.mjs          ext/rules/validate.mjs
ext/rules/ua.test.js          ext/tools/gen-suffix-mirror.mjs
ext/src/{background,claim-verification-2026-09-17,gpc,handshake-integration,
         heuristics,layout-early-out,linkage,manifest,native-shape,personas,
         protocol,review-2026-09-16,shim-handshake}.test.js
```

**There is no packaging script anywhere.** No `zip`/`web-ext build` target, no `.github/workflows/`
(only `FUNDING.yml` and two issue templates), and `docs/RELEASE-CHECKLIST.md` — which is explicitly
"the queue" — does not mention packaging at any point. `ext/package.json` has only `validate` and
`test`. So today the only way to submit is to zip `ext/` whole, which ships all 21 files and fails
AMO validation.

**Policy.** AMO blocks submission on linter errors. Chrome does not lint this way, but its MV3
requirement — **"the full functionality of an extension must be easily discernible from its
submitted code"** — is made harder by shipping 13 test files, and `DANGEROUS_EVAL` in a
`<all_urls>` privacy extension is exactly the kind of thing that converts a fast review into
extended scrutiny (Chrome's own review-process page names "dangerous permission requests" and "broad
host patterns" as extended-scrutiny triggers; `docs/LAUNCH.md:812` already records that we are all
five triggers).

**Fix:** add a packaging step that produces the store zip from an allowlist (`manifest.json`,
`icons/`, `src/*.js` minus `*.test.js`, `popup/`, `options/`, `rules/*.json`) and a parallel
`manifest.firefox.json` variant, and add "package + re-lint" to `RELEASE-CHECKLIST.md`. Re-run
`web-ext lint` on the *package*, not the tree, and require 0 errors.

**Bonus, verified by the same fact:** `harness/vendor/*` (FingerprintJS MIT, ClientJS Apache-2.0,
CreepJS MIT) sits outside `ext/` and therefore **cannot** end up in an `ext/`-rooted package. That
answers the licensing question in §3 — but it is true by directory accident, not by a rule, and an
allowlist packaging step is what makes it a rule.

---

## 2. SHOULD-FIX

### S1 — `README.md:3` uses a near-banned phrase

> "**A browser extension that blocks trackers, defends against fingerprinting, and collects nothing about you**"

`docs/THREAT-MODEL.md:48-51` bans *"protects you from fingerprinting"*, *"prevents fingerprinting"*,
*"blocks fingerprinting"*. "Defends against fingerprinting" is the same claim in a synonym, and it is
the **first line of the repo** — the sentence GitHub shows in search results and social cards.
Proposed: "blocks trackers, shows each site a different device profile, and collects nothing about you."

Everything else in the banned-phrase sweep is clean: "anonymous" and "invisible" appear only in
negation (`docs/STORE-LISTING.md:34`, `site/blog-….md:31,43`, `site/prove-it/index.html:120`), which
is what the threat model wants. No instance of "undetectable", "untraceable", or "can't be tracked"
anywhere in user-facing copy. (RUN.)

### S2 — "258 tests" is stale in three places; the real number is 310

**RUN:** `cd ext && npm test` → `# tests 310 / # pass 310 / # fail 0`.
Stale at `README.md:6`, `README.md:69`, `README.md:89`, `docs/RELEASE-CHECKLIST.md:6`,
`docs/RELEASE-READINESS-2026-09-16.md:15`. Understating is not a §5 problem, but this repo's whole
credibility argument is *"every number is a measurement"*, and a reader who runs `npm test` gets a
different number than the README promises on line 6.

### S3 — The repo is MIT; `docs/LAUNCH.md` tells Jason to ship it GPL-3.0

`LICENSE` = MIT © 2026 Jason Luker. `README.md:110` and `README.md:156` = MIT. But:

- `docs/LAUNCH.md:945` — "**Ship the full source under GPL-3.0 on GitHub before launch**, with reproducible builds."
- `docs/LAUNCH.md:1005` — "**The license.** GPL-3.0 over MIT — copyleft forces a cloner shipping modifications to publish…"
- `docs/LAUNCH.md:1265` — "Publish the GitHub repo, **GPL-3.0**, reproducible…"

`LAUNCH.md:1007` marks it `[judgment call]`, and `LAUNCH.md:978/982` then documents that GPLv3 did
nothing in the uBlock and CrashFix cases — i.e. the document argues against its own recommendation.
The repo is already public under MIT and `README.md:110-125` builds the trust argument on MIT
("You may fork it, rename it, and ship it — that's deliberate"). **Relicensing after publication is
a one-way door and the decision is Jason's, not a reviewer's.** The fix here is only to stop the
repo from containing two answers: either strike the GPL lines from `LAUNCH.md` as superseded, or
record a dated decision in `docs/DECISIONS.md` that MIT won.

### S4 — MIT copyright holder is a legal name; every public identity is a handle

`LICENSE:3` — "Copyright (c) 2026 **Jason Luker**". Every public pointer is **ZJHeepfixer**:
`.github/FUNDING.yml:1`, `site/prove-it/index.html:80`, `site/prove-it/index.html` footer link,
`README.md` clone instructions.

This is a real choice with consequences, and I am **not** picking one:
- The legal name is what makes the copyright grant enforceable without first proving handle→person.
- The legal name on a privacy tool's LICENSE is permanently public, and `docs/LAUNCH.md:861` notes
  the Chrome Web Store **EU trader declaration** *"is posted publicly on your listings"* for traders
  (legal name, SMS phone, address) — so store publication may force the disclosure anyway, or force
  the Core Capital LLC's registered-agent address into public view instead.

**Flagged for Jason's decision.** Whichever he picks, `LICENSE`, the store listing's publisher name,
and the trader declaration should agree — a mismatch between them is what a reviewer notices.

### S5 — GPC's legal effect is stated bare in the README and the store listing while the in-product copy qualifies it correctly

`ext/options/options.html:186-193` is the model — it names California and Colorado, cites the Sephora
settlement, and then says *"Coverage is real but partial: a 2025 study found only about a third of
sites that appear to sell or share data implement any opt-out signal, and only 44% of those honoured
all of them."* That is accurate and appropriately hedged.

The outward-facing copy drops the hedge:
- `README.md:30` — "**Global Privacy Control** — legally enforceable in California and several other states."
- `docs/STORE-LISTING.md:32-33` — "the do-not-sell/share signal **that's legally enforceable** in California and several other states."

"Legally enforceable" is true of the *obligation on covered businesses*; it is not a promise that
sending the header produces an outcome, which is how a consumer reads it. `docs/PRIVACY-POLICY.md:12`
gets it right with "**legally-recognized**". **Proposed:** use "legally recognised as a do-not-sell
request in California, Colorado and several other states — though a 2025 study found only about a
third of sites that appear to sell data implement any opt-out signal."

### S6 — The privacy policy says storage is `chrome.storage.local` only; `drop.js` has a `localStorage` fallback

`docs/PRIVACY-POLICY.md:47` — "Everything Nullecho stores lives **only** in `chrome.storage.local`"
and `:51-52` — "Grepping every `storage.local.set` call in the source gives this exact list".

`ext/options/drop.js:83-105` (READ):

```js
/* ── Storage: chrome.storage.local, with a localStorage fallback so the page … */
backend: hasExt ? 'chrome.storage.local' : 'localStorage',
```

In a packed install `chrome.storage.local` always exists, so the fallback is unreachable in
production — but the policy's claim is phrased as an exhaustive grep result, and the grep does not
support it. A reviewer who greps `localStorage` finds a contradiction in the document that opens by
saying *"Every claim below was checked against the source … not asserted from memory"*.
**Fix:** one clause — "(`ext/options/drop.js` falls back to `localStorage` only when the DROP page is
opened outside the extension, e.g. in local development; that path is unreachable in an installed build)."

### S7 — Single-purpose exposure is real, is already diagnosed, and the store listing does not act on the diagnosis

**Policy.** Chrome *Quality Guidelines*: **"An extension must have a single purpose that is narrow
and easy to understand. Don't create an extension that requires users to accept bundles of unrelated
functionality."** And: **"If two pieces of functionality are clearly separate, they should be put
into two different extensions, and users should have the ability to install and uninstall them
separately."**

`docs/LAUNCH.md:838` already scores this **"Highest risk"** and gives the mitigation: *"Frame the
single purpose as 'prevent cross-site tracking' and keep DROP as an options subpage — **do not put
it in the listing title or first line.**"*

`docs/STORE-LISTING.md` does not follow its own advice: `:65-69` ("What's new in 0.1") enumerates
five features including the Checkout Report and DROP, and `:122` puts the Checkout Report in the
screenshot set. Blocking + shim + GPC + a cross-site linkage graph + a California deletion
walkthrough + a pricing-disclosure detector reads as six products to a reviewer.

**Proposed single-purpose declaration for the dashboard field:**

> Nullecho's single purpose is to prevent cross-site tracking. Every feature serves it: blocking
> known tracker requests stops collection at the source; the Global Privacy Control header is the
> legally recognised do-not-sell request for data already collected; and the per-origin device
> profile prevents the same user being re-identified across unrelated sites by hardware
> fingerprint. The extension has no other function, no account, and no network endpoint.

DROP stays an options subpage, unnamed in the title, the summary, and the first paragraph.

### S8 — Listing assets: icons are complete, screenshots and the promo tile are absent

**Policy (Chrome Web Store images page, fetched):**

| Asset | Requirement | State |
|---|---|---|
| Store icon | **128×128 PNG, required** (96×96 artwork + 16px transparent padding per side) | ✅ `ext/icons/icon-128.png` exists; padding convention **not verified** — I did not open the PNG |
| Screenshots | **1280×800 or 640×400**, *"at least 1—and preferably the maximum allowed 5"* | ❌ none in the repo |
| Small promo tile | **440×280, required** — *"Extensions that don't have a small promotional image will be shown after extensions that do"* | ❌ none |
| Marquee | 1400×560, optional | ❌ none |

Manifest icons (16/32/48/128) are wired into both manifests and exist. `docs/STORE-LISTING.md:107-128`
has the shot-list; `docs/RELEASE-READINESS-2026-09-16.md:102` already records the gap. Note that
shot-list item 5 cannot be captured (B1) and item 2's caption — "Each site sees a different,
internally consistent device — **never your real one**" — needs the B3 qualification.

### S9 — The drafted listing tells the Chrome Web Store the product is not ready

`docs/STORE-LISTING.md:69-72`:

> "**Pre-release:** loads and runs in Chrome, but breakage testing against real sites is incomplete
> — see the project's own `docs/RELEASE-READINESS-2026-09-16.md` for the current list of open items
> before this is represented as stable."

Honest, and I do not want that instinct edited out. But a "What's new" field that points a reviewer
at a document listing five open review findings (A8, B3, B6, B9, C1) and a hardware release blocker
is volunteering a rejection under *Minimum Functionality* / *Quality Guidelines*. The honest-and-safe
version is to **not submit until the gate passes**, rather than to submit with a disclaimer. If a
beta channel is wanted before then, AMO's unlisted self-distribution (`docs/LAUNCH.md:918`) is the
right venue and carries no store-listing copy at all.

### S10 — AMO source-code submission: we probably owe one, and the build README we owe does not exist in the required shape

**Policy (AMO source code submission page, fetched).** Source is required when you use *"code
minifiers"*, *"tools that generate a single file from other files"*, *"template engines"*, or
**"any other custom tool that takes files, applies pre-processing, and generates file(s)"**.

Nullecho ships **no** minifier, bundler, template engine or TypeScript — the store package would be
the same unbundled, unminified source an auditor reads, which is the strongest possible posture. But
two custom generators produce files that ship:

- `ext/rules/gen-ua.mjs` → `rules/ua-{win,mac,linux}.json` (6 rules)
- `ext/tools/gen-suffix-mirror.mjs` → the `BEGIN/END GENERATED SUFFIX MIRROR` block at
  `ext/src/shim.js:746-770`, and the pool at `:399-641` is a `GENERATED MIRROR` of `src/personas.js`
  (READ via `git show HEAD:ext/src/shim.js`)

That is a literal match for *"any other custom tool that takes files … and generates file(s)."*

**Do we have reproducible build instructions?** Partly, and better than most: `ext/README.md:73-79`
gives both commands, both generators are idempotent, and `npm run validate` **fails** if the
generated files differ from what the generator would emit (RUN — validate passes today). That is
exactly the diff-to-zero property AMO wants: *"the reviewer runs the instructions you provided and
then uses a diff tool to compare the generated sources to those in the extension. **There must be no
differences.**"*

**What is missing** against the required README contents:
- *"operating system and environment requirements"* — not stated
- *"details, including required version and installation instructions, of any tools"* — Node version
  is never pinned anywhere (no `engines` field in `ext/package.json`, no `.nvmrc`)
- *"the version lockfile for any package management tools"* — **no `package-lock.json` exists**
  (RUN). Defensible — there are zero dependencies — but it needs saying explicitly rather than
  being absent.

**Fix:** a 15-line `BUILD.md` stating: Node ≥ X on macOS/Linux, zero npm dependencies (hence no
lockfile), `node rules/gen-ua.mjs && node tools/gen-suffix-mirror.mjs && npm run validate && npm test`,
then the packaging allowlist from B7. Submitting it unprompted costs nothing and removes the most
common avoidable AMO delay.

### S11 — Apache-2.0 attribution for ClientJS is thin (but no NOTICE file is owed)

**Verified (RUN).** GitHub contents API on `jackspirou/clientjs`: **no `NOTICE` file** at the repo
root. Apache-2.0 §4(d) — *"If the Work includes a 'NOTICE' text file as part of its distribution…"*
— is therefore not triggered. **We do not owe a NOTICE file.** That answers the question directly.

§4(a) (*give recipients a copy of the License*) is satisfied by
`harness/vendor/clientjs-0.2.1.LICENSE.txt`, which is the unmodified Apache-2.0 text (201 lines,
appendix placeholders intact — as upstream ships it).

The thin part: `harness/vendor/clientjs-0.2.1.base.min.js` carries **no attribution header at all**
(RUN — the file begins `!function(e,i){…`). Compare FingerprintJS, which carries its own banner
(`/** FingerprintJS v5.2.0 - Copyright (c) FingerprintJS, Inc, 2026 … */`). The vendor README
(`harness/vendor/README.md:13-22`) names upstream, version, licence and SHA-256 for all three, and
all three SHA-256s **verify byte-for-byte** (RUN). That is adequate; it is also one hop away from
the file. **Suggested:** a `THIRD-PARTY-NOTICES.md` at the repo root that repeats the three-row
table, so the notice is discoverable without opening `harness/vendor/`. Low effort, removes the
question.

Also verified: CreepJS `LICENSE.txt` is MIT © 2021 abrahamjuliot; FingerprintJS `LICENSE.txt` is
MIT © 2025 FingerprintJS, Inc — both match the upstream headers embedded in the code. Nothing was
substituted for something weaker.

### S12 — `webRequest` on Chrome MV3 is the permission a reviewer will question, and the answer must be in the form

**Policy.** *Use of Permissions*: **"Request access to the narrowest permissions necessary to
implement your Product's features or services. If more than one permission could be used to
implement a feature, you must request those with the least access to data or functionality. Don't
attempt to 'future proof' your Product by requesting a permission that might benefit services or
features that have not yet been implemented."**

`ext/PERMISSIONS.md` is the best permission document I have seen in this category and it already
answers every question — including the one it volunteers against itself (`:66-70`): *"this is the
one permission that lets Nullecho see request URLs it did not block."* But `PERMISSIONS.md` is not
submitted to the store; the dashboard's per-permission field is. `docs/STORE-LISTING.md:74-105` has
four of the five paragraphs. **§4 of this document supplies paste-ready text for all five.**

One substantive note: `declarativeNetRequestFeedback` is a *warning*-carrying permission and is
requested for a UI count. `PERMISSIONS.md:42-44` is honest that on a **packed** store build,
`onRuleMatchedDebug` does not fire and the popup falls back to `getMatchedRules()`. Under the
"narrowest permission" rule, a reviewer may reasonably ask why a permission is requested whose main
benefit only exists in dev. The answer — `getMatchedRules()` itself requires it, and the alternative
is an invented number — is good, and it needs to be in the form, not just in the repo.

### S13 — Three Chrome program prerequisites are nowhere in the release queue

- **2-Step Verification.** It is its own section of the Developer Program Policies (§7, *Technical
  Requirements → 2-Step Verification*) and is a precondition for publishing. Nothing in
  `RELEASE-CHECKLIST.md` or `RELEASE-READINESS-2026-09-16.md` mentions it.
  `RELEASE-READINESS-2026-09-16.md:92-93` records only that neither developer account exists yet.
- **CWS verified uploads** (`docs/LAUNCH.md:854-858`) — opt-in RSA-signed uploads, the direct
  countermeasure to the Cyberhaven-style takeover the README's trust section is written about. It is
  argued for in `LAUNCH.md` and never lands in the queue.
- **EU trader declaration** (`docs/LAUNCH.md:859-864`) — mandatory, publicly posted, and interacts
  with S4. Also not in the queue.

**Fix:** add all three to `docs/RELEASE-CHECKLIST.md` §4. This is bookkeeping, but each one is a
hard gate on the submit button.

### S14 — The no-sale commitment and the zero-collection commitment live only in the README

`README.md:116-125` is the strongest trust artifact the project has:

> "**This project will not be sold or transferred to a new owner.** The most common way a trusted
> extension turns malicious is an acquisition followed by a quiet update."

It appears **nowhere else** (RUN — `grep -rni "not be sold|never be sold|acquisition"`). Not in
`SECURITY.md`, not in `docs/PRIVACY-POLICY.md`, not in `docs/STORE-LISTING.md`.
`docs/LAUNCH.md:1002` and `:1266` both call it a launch deliverable ("Publish a no-sale succession
policy"), and it is half-published.

The people who need it are: (a) the store reviewer weighing a `<all_urls>` privacy extension from a
new developer, (b) the r/degoogle and HN readers `LAUNCH.md:338` says will ask exactly this, and (c)
anyone reading the privacy policy. **Fix:** one paragraph in `SECURITY.md` and one line in the store
listing's full description, both linking the README section.

---

## 3. NICE

**N1 — GitHub Pages server logs.** `site/` is not deployed (no `CNAME`, no workflow, no Pages
config — RUN). The moment `site/prove-it/` or the privacy policy is hosted on GitHub Pages, GitHub
logs visitor IPs and user agents as a processor. The pages themselves are clean — `site/prove-it`
line 93-96 correctly says *"There is no analytics script on this page"* and the footer repeats it,
and I found no third-party script or font on either page. But "no analytics" ≠ "no logs", and a
privacy tool's own site is the last place to leave that unstated. One line in the policy:
*"The website is hosted on GitHub Pages. GitHub records standard server logs (IP address, user
agent, requested URL) for the pages it serves; we neither receive nor request access to them."*

**N2 — GDPR: a one-liner, and here is why it is only a one-liner.** GDPR Art. 13(1) is triggered
**"Where personal data relating to a data subject are collected from the data subject, the
controller shall, at the time when personal data are obtained, provide the data subject with all of
the following information."** The trigger is *collection by a controller*. Nullecho's developer never
obtains the data: everything stays in `chrome.storage.local` on the user's own device, under the
user's own control, deleted by the browser on uninstall (`docs/PRIVACY-POLICY.md:93-95`). With no
controller-side processing, Art. 13's obligations do not attach; Art. 13(4) (**"Paragraphs 1, 2 and
3 shall not apply where and insofar as the data subject already has the information"**) would
independently cover the residue. Recommended single line for the policy, which is a statement of
position rather than a compliance artifact:

> **EU/UK users.** Nullecho's developer is not a controller or processor of your personal data,
> because no personal data is ever obtained by us — it is created, stored and deleted on your own
> device, and there is no endpoint for it to reach us through. There is therefore no processing to
> disclose under GDPR Art. 13, no lawful basis to declare, and no data-subject request we could
> act on, because we hold nothing to access, rectify, or erase. Uninstalling the extension deletes
> everything it stored.

I am not qualified to give a legal opinion and this is not one; it is the position the code
supports, and it should be reviewed by counsel before it is published as a policy.

**N3 — `manifest.firefox.json` ships inside the Chrome package.** Harmless (Chrome ignores it) but a
second manifest in a submitted package invites a question. The B7 allowlist removes it.

**N4 — `ext/package.json` ships.** `"private": true` with a description that says it exists to mark
`ext/src` as ES modules for Node tooling. Nothing sensitive; it is dev metadata in a user-facing
package. The B7 allowlist removes it.

**N5 — Broker count drifts across surfaces.** `site/drop/index.html:6` says "**603** data brokers";
`README.md:33` and `ext/options/options.html:283` say "**600+**"; `ext/options/drop.html:350` cites
CalPrivacy's own "over 600 registered data brokers". All defensible, none wrong — but
`THREAT-MODEL.md:177` says *"If a number is an estimate, label it an estimate."* Pin one number with
an as-of date, or use "600+" everywhere.

**N6 — `.github/ISSUE_TEMPLATE/detection.md:12`** carries the stale 2/10 (counted in B2). It is worth
a separate mention because it is the template a security researcher reads *before* filing — telling
them the known-gap list includes "2/10 adversarial detectors" will cause duplicate reports for
things CreepJS already found.

**N7 — `SECURITY.md` has a working channel but no timeline.** "Please open a GitHub issue" is a real,
working contact (the repo is public), and it correctly frames detectability and persona
inconsistency as security bugs. It lacks an acknowledgement window and says nothing about
coordinated disclosure for a finding that would harm users before a fix ships. One sentence.

**N8 — `docs/STORE-LISTING.md:22-25` `[VERIFY]` on the category.** "Privacy & Security" still exists
as a Chrome Web Store category; I did not confirm the exact taxonomy string against a live
submission form (no store account exists), so the `[VERIFY]` is correctly placed and should stay
until someone is in the dashboard.

---

## 4. Paste-ready permission justifications for the Chrome dashboard

One per field, written to the *Use of Permissions* standard ("narrowest permissions necessary"),
drawn from `ext/PERMISSIONS.md` and trimmed to reviewer length. Verified against `ext/manifest.json`
(RUN) — the permission set is `declarativeNetRequest`, `declarativeNetRequestFeedback`, `storage`,
`alarms`, `webRequest`, plus `host_permissions: ["<all_urls>"]`. Note: `scripting` is **not**
requested (`PERMISSIONS.md:79-92` — all three content scripts are statically declared, so the
extension cannot inject code at runtime at all); say this unprompted, it is a strong signal.

**`declarativeNetRequest`** — Runs Nullecho's five static tracker-blocking rulesets (advertising,
analytics, social widgets, known fingerprinting vendors, and the Global Privacy Control header), the
per-OS-family User-Agent/Client-Hint header rules, and the per-site allowlist. This is the narrower
of the two options: the browser evaluates the rules, so the extension never sees the URL of a
request it did not act on. `webRequestBlocking` is not requested on any platform.

**`declarativeNetRequestFeedback`** — Lets the toolbar popup report how many requests were actually
blocked on the current page, via `getMatchedRules()`. Without it the popup would have to display an
invented number, which we will not do. It grants no additional access to page content.

**`storage`** — `chrome.storage.local` only, for: a random salt that selects which device profile
each site is shown, the user's category toggles, the user's per-site allowlist, and per-site blocked
counters. `chrome.storage.sync` is deliberately never used, so none of this reaches a Google
account. There is no server and no account; nothing stored is transmitted anywhere.

**`alarms`** — Wakes the service worker on a schedule to rotate the persona salt. This is an
optional feature that is **off by default**; an MV3 service worker cannot wake itself to do it
without this permission.

**`webRequest` (observation only — `webRequestBlocking` is not requested)** — A passive,
Privacy-Badger-style observer registers only `onBeforeSendHeaders` and `onHeadersReceived`, to see
which third-party domains set cookies across unrelated sites. After three cross-site appearances it
writes a `declarativeNetRequest` rule; the blocking itself always happens in DNR, so a bug in the
observer can never hang a request. Only aggregate per-domain strike counts are kept — never a
request log — and nothing observed is transmitted, because the extension has no network endpoint.

**`host_permissions: ["<all_urls>"]`** — Required on every site for three reasons that do not scope
down. (1) The `Sec-GPC: 1` do-not-sell header is only meaningful if sent everywhere — a signal sent
to a curated subset is not a signal — and the same is true of the persona's User-Agent/Client-Hint
headers, which must agree with the JavaScript persona on every site or they create the exact
contradiction they exist to remove. (2) The fingerprint-defense content script must run on every
page, because the site a user forgot to add to a list is exactly the site that fingerprints them.
(3) The popup needs the active tab's URL to attribute blocked requests to the page that made them.
Nullecho does not request `tabs`, `cookies`, `history`, `bookmarks`, `downloads`, `management`,
`identity`, `unlimitedStorage`, `userScripts`, or any remote host.

**Remote code (MV3 declaration)** — All code is in the package. There is no `<script src>` to any
remote resource, no `eval()`, no `new Function()`, no `importScripts()`, and no interpreter for
remotely fetched commands. The only two `fetch()` calls in the shipped source read a JSON file
bundled inside the extension via `chrome.runtime.getURL(...)`
(`ext/src/background.js:97`, `ext/src/gpc.js:349`) — verified by an automated test that fails the
build if any other network API appears or if a `fetch()` argument is not a bundled-file URL.
Filter lists are static rulesets in the package and are never fetched at runtime.

> **Remote-code verification (RUN).** `grep` across `ext/` for `fetch(`, `XMLHttpRequest`,
> `sendBeacon`, `WebSocket`, `EventSource`, `importScripts`, `eval(`, `new Function`,
> `storage.sync` returns exactly the two `chrome.runtime.getURL` fetches above and nothing else in
> shipped source. `new Function` appears once, in `ext/src/personas.test.js:847` — a **test** file
> that must not ship (B7). This satisfies the MV3 requirement quoted in §1/B7: *"the full
> functionality of an extension must be easily discernible from its submitted code"*, and the
> specific prohibitions on *"a `<script>` tag that points to a resource that is not within the
> extension's package"*, *"JavaScript's `eval()` method or other mechanisms to execute a string
> fetched from a remote source"*, and *"building an interpreter to run complex commands fetched
> from a remote source."*

---

## 5. Questions the task asked, answered directly

**Does header/UA rewriting or persona spoofing fall under a prohibited Chrome category?**
**No — I found no policy text prohibiting it**, and I looked specifically for the "removed for
modifying network requests" pattern. The relevant policies are:

- *Misleading or Unexpected Behavior*: **"We do not allow products that deceive or mislead users,
  including in the content, title, description, or screenshots"** and **"Any changes to device
  settings must be made with the user's knowledge and consent and be easily reversible by the
  user."** Nullecho's rewriting is the extension's *disclosed primary function*, is user-toggleable
  per category and per site (`ext/options/options.html:172-247`), and is fully reversed by
  uninstalling. That is the consent-and-reversibility test, and it passes.
- *Use of Permissions*: the rewriting is done through the sanctioned `declarativeNetRequest`
  `modifyHeaders` action with host permission — the documented API for it, not a workaround.
- The removals the question alludes to are, on the public record, removals for **undisclosed**
  request modification (injected affiliate parameters, silent redirects, search hijacking) — the
  *Ads* policy's clause that **"Ads associated with products may not interfere with third-party
  website ads"** is about ads the product itself serves, not about blocking. Nullecho serves no ads,
  injects no affiliate codes, and `docs/DECISIONS.md` D1 records that decoy ad-clicking was cut on
  the merits. **The real exposure is not the mechanism; it is B1/B2/B3 — the description.**

**Do the 2024+ ads / affiliate-ads rules apply?** **No.** *Ads* governs ads a product displays
("Ads are considered part of your Product for purposes of content review"); Nullecho displays none.
*Affiliate Ads* governs affiliate codes/links injected into pages; Nullecho injects none, has no
monetisation of any kind (`README.md:100-106`), and `docs/RELEASE-CHECKLIST.md:98-99` records
"no premium tier, no affiliate VPN, no data sales" as a standing decision. Confirmed N/A, with the
caveat that this is *because* the monetisation levers were removed — it would stop being N/A the
day one returns.

**Does `manifest.firefox.json` validate?** **It parses and loads as a valid MV3 Firefox manifest**
— `web-ext lint` reported **zero manifest-level errors** (RUN). All 3 errors and both warnings are
in files that should not be in the package (B7). Manifest-specific facts verified: `gecko.id`
present, `strict_min_version: "140.0"` (correct — below 140 the `data_collection_permissions` key is
not honoured and AMO requires a separate consent experience),
`data_collection_permissions: {required: ["none"]}` present, `background.scripts` (event page, not
service worker), `match_about_blank` in place of Chrome's `match_origin_as_fallback`, and identical
permission lists to the Chrome manifest. `ext/src/manifest.test.js` enforces all of this as part of
the 310 (RUN).

**Is there a working security contact?** Yes and no. `SECURITY.md:5` — "Please open a GitHub issue"
— is a real, working channel on a public repo, and the two issue templates are well-designed for it.
But it is the only one: there is **no email address anywhere in the repo** (RUN), and both the Chrome
Web Store listing and AMO ask for a support contact. See B4.

**Is the 2FA + no-sale commitment reflected anywhere public?** No-sale: partially — `README.md:116-125`
only (S14). 2FA: nowhere; it is a Chrome program requirement that has not entered the release queue
(S13).

---

## 6. What I could not verify

Stated plainly, because an unverified item asserted as checked is the failure mode this repo's
standing rules are written against.

1. **Anything requiring a live store dashboard.** No Chrome Web Store or AMO developer account
   exists (`RELEASE-READINESS-2026-09-16.md:92-93`), so I could not confirm the exact category
   taxonomy string (N8), the current per-permission form layout, the Limited Use certification
   wording as it appears in the form, or the trader-declaration fields.
2. **Whether the Chrome Web Store would in fact accept this extension.** Nothing in a policy read
   predicts a reviewer. `docs/LAUNCH.md:812` correctly notes Nullecho hits all five extended-scrutiny
   triggers (new developer, new extension, dangerous permissions, significant code, `<all_urls>`).
3. **The 128×128 icon's 96×96-artwork-plus-padding convention.** I confirmed the file exists; I did
   not open the PNG to measure the transparent margin.
4. **Whether `site/prove-it/index.html` and `site/drop/index.html` render as read.** I read the
   source. Per this project's own standing rule — *verify by rendering, not by grepping* — the copy
   findings in B2/B3 should be re-checked against the rendered pages before they are called closed.
5. **Upstream licence-file equivalence beyond ClientJS.** I verified all three vendored SHA-256s
   match `harness/vendor/README.md`, confirmed the FingerprintJS and CreepJS `LICENSE.txt` contents
   match the copyright lines embedded in their own bundles, and queried the ClientJS repo for a
   NOTICE file. I did **not** byte-diff the FingerprintJS and CreepJS `LICENSE.txt` files against
   their upstream repositories.
6. **`ext/src/shim.js`.** Read-only via `git show HEAD:` while another lane edits it. The
   `GENERATED MIRROR` blocks are at `:399-641` (persona pool) and `:746-770` (suffix mirror); both
   generators are idempotent and `npm run validate` gates drift (RUN). If that lane changes the
   mirror boundaries, S10's build-instruction text needs re-checking.
7. **Legal conclusions.** §2 S5 (GPC's enforceability), N2 (GDPR Art. 13), B6 (state effective
   dates), and S4 (copyright-holder enforceability) are research positions read off primary sources
   and this repo's own brief, not legal advice. `research/ALGORITHMIC-PRICING-COMPLIANCE-BRIEF.md:9`
   makes the same disclaimer about itself and it applies here too.

---

## 7. The shortest path out of BLOCKER

In dependency order, because three of the seven are the same edit:

1. **One find-and-replace pass over six files** closes B2 (stale detector count) — `README.md:42`,
   `SECURITY.md:19`, `site/prove-it/index.html:140`, `site/LAUNCH-KIT.md:63`,
   `site/blog-….md:66`, `.github/ISSUE_TEMPLATE/detection.md:12`.
2. **One pass over eight strings** closes B3 (unqualified join) — two of them in `ext/` and so
   coordinated with the shim lane.
3. **Delete the Checkout Report** from four documents (B1) and B6 goes with it.
4. **Correct three launch sentences** (B5) — `docs/LAUNCH.md:107`, `:927`, `site/LAUNCH-KIT.md:36`.
5. **Register a mailbox and host the policy** (B4). This one costs money and a decision, not an edit.
6. **Write a packaging allowlist and re-lint the package** (B7). Half a day, and it is the only
   blocker that is code.

Items 1–4 are copy edits to documents no other lane owns, and together they remove four of the seven
blockers.
