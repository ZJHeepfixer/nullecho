# Nullecho — Chrome Web Store listing, ready to paste

Every field below is written to be pasted directly into the Chrome Web Store Developer Dashboard,
field by field. Every sentence was checked against `docs/THREAT-MODEL.md`'s canonical claim and
banned-phrase list, and against the code as it stands on `main` at the commit this file was written
against. It does not contradict `docs/review-2026-09-19/store-compliance.md`; where that review found
a gap, this file either reflects the fix already made or names the gap that remains (see "Status
this listing depends on" at the bottom).

Character counts below are computed against the exact text in this file, not estimated.

---

## Store name

> **Nullecho**

No subtitle field exists in the Chrome Web Store dashboard (that's an App Store Connect concept).
Keep the name alone — do not append a tagline to it ("Nullecho — Privacy" etc.); the tagline belongs
in the summary field below, not the name.

---

## Summary (≤132 characters)

> Blocks trackers, sends Global Privacy Control, and shows each site a different device profile so most trackers can't link you.

**126 characters.** "most trackers" is load-bearing, not filler — `docs/THREAT-MODEL.md` records that
the cross-site join breaks against FingerprintJS and ClientJS and does **not** break against a
lie-aware library like CreepJS, and says the claim may never be stated unqualified. This is the
shortest true form of it that fits the field.

---

## Detailed description (≤16,000 characters; aim was 1,200–2,000)

> Nullecho blocks the ad networks, analytics scripts, social pixels, and known fingerprinting vendors
> that follow you across sites, using 182 static rules from DuckDuckGo Tracker Radar, EasyPrivacy, and
> AdGuard, evaluated by the browser's own declarativeNetRequest engine. It sends Global Privacy
> Control, a do-not-sell/share signal legally recognized in California, Colorado, and several other
> states if you live there — the duty attaches to your residency, not the site's location.
>
> Instead of trying to make you invisible, Nullecho gives each site a different, internally
> consistent device profile, drawn from a pool of real, common hardware/software configurations and
> held stable per site. This breaks the cross-site fingerprint join for trackers that hash the signals
> Nullecho covers, verified against the FingerprintJS and ClientJS libraries. It does not break the
> join against a library that detects spoofed values, discards them, and keys on what's left; CreepJS
> does exactly that.
>
> On pages that display a price, Nullecho watches for the exact disclosure sentence New York law now
> requires when a price was set by an algorithm using your personal data. When it finds one, it tells
> you and lets you keep a local, on-device copy of what the page displayed — the words on the page,
> never a compliance judgment.
>
> Nullecho collects nothing about you: no telemetry, no accounts, no analytics, no crash reporting,
> nothing synced. A build-failing test enforces this against any network call to anywhere but the
> extension's own bundled files.
>
> What it does not do, stated plainly: it does not hide that it's installed — it is detectable, by
> design. It does nothing about your IP address or TLS fingerprint; both sit below any layer an
> extension can reach. It will not get you a lower price. It does nothing against state or government
> surveillance. Firefox's resistFingerprinting/fingerprintingProtection and Brave's built-in
> protections are genuinely stronger, because they work below the JavaScript layer; Nullecho's niche
> is Chrome, where neither exists.
>
> Known limits: the device profile does not cover Web Workers, and screen size, pixel density, and
> color depth are reported honestly rather than spoofed, since a contradiction is worse than a leak. A
> page that wins the loading race before Nullecho's script runs can, in narrow cases, read the real
> machine through a constructed frame.
>
> Open source, MIT licensed: github.com/ZJHeepfixer/nullecho. Every claim above is a measurement
> recorded in the repository — run the same measurement yourself, on your own browser, at
> nullecho.org.

**2,588 characters** — over the 1,200–2,000 target, under the 16,000 hard limit. The overage is
deliberate: the brief requires four "what it does" items, the full "what it collects" statement, the
threat-model's "what it does NOT do" enumeration verbatim in substance, a mandatory "Known limits"
paragraph, and the open-source/measurable-yourself close, all in plain short paragraphs with no
marketing language to pad or compress against. Cutting further meant cutting a required disclosure,
not cutting fluff, so the length was allowed to run rather than trading accuracy for the target.

No emoji, no superlatives, no "military-grade"/"100%"/"completely anonymous"/"undetectable"/
"guaranteed" — checked by hand against `docs/THREAT-MODEL.md`'s banned-phrase list. No price,
discount, or "save money" language, consistent with `docs/DECISIONS.md` D16 (lower prices is not a
claim this project can make; the controlled evidence runs the other way).

---

## Category

> **Privacy & Security**

Confirmed live on the Chrome Web Store as of 2026-09-22
(`chromewebstore.google.com/category/extensions/make_chrome_yours/privacy`, displayed to users as
"Privacy & Security"). This is the closest fit to Nullecho's actual function — tracker blocking and
anti-fingerprinting — over the alternative, Productivity, which does not describe what the extension
does. **Still confirm the exact picker option at submission time**: a public category-browse URL is
evidence the label exists, not proof the dashboard's own taxonomy string is spelled identically or
still offered — store taxonomies change without notice, and no developer account has driven the
dashboard yet to check directly.

---

## Language

> **English (United States)**

All shipped copy (`ext/popup/`, `ext/options/`, this listing, the website) is US English. No other
locale is packaged (`manifest.json` has no `default_locale` or `_locales/` directory), so this is the
only listing language available regardless.

---

## Single purpose description

> Nullecho's single purpose is to prevent cross-site tracking. Every feature serves it: blocking known
> tracker requests stops collection at the source; the Global Privacy Control header is the legally
> recognized do-not-sell request for data already collected; and the per-origin device profile
> prevents the same user being re-identified across unrelated sites by hardware fingerprint. The
> price-disclosure notice is the same subject read from the other end — telling a user when a page has
> said out loud that a price was set from their data. The extension has no other function, no account,
> and no network endpoint.

This is the exact text already vetted in `docs/STORE-LISTING.md` and cross-checked against Chrome's
*Quality Guidelines* single-purpose clause. The California DROP walkthrough and the price-disclosure
notice both stay **options-page / popup features, never named in the store name, the summary, or the
first paragraph of the description** — a state-specific workflow named up front reads as a second
product to a reviewer, and `docs/LAUNCH.md:838` already scores this the single highest rejection risk
Nullecho carries.

---

## Permission justifications

One paragraph per permission, drawn from `ext/PERMISSIONS.md` (the project's own permissions
document) and verified directly against `ext/manifest.json` and `ext/src/background.js` while writing
this file — not copied from memory.

**`declarativeNetRequest`**
> Runs Nullecho's five static tracker-blocking rulesets (advertising, analytics, social widgets, known
> fingerprinting vendors, and the Global Privacy Control header), the per-OS-family User-Agent/
> Client-Hint header rules, and the per-site allowlist rules. The browser evaluates these rules
> itself, so the extension never sees the URL of a request it did not act on. `webRequestBlocking` is
> not requested on any platform.

**`declarativeNetRequestFeedback`**
> Lets the toolbar popup report how many requests were actually blocked on the current page, via
> `getMatchedRules()`, instead of displaying an invented number. In an unpacked development build,
> `onRuleMatchedDebug` additionally fires with per-request detail; in the packed store build it does
> not, so the popup falls back to `getMatchedRules()` — counts and category only, no URLs — and the
> code path itself still requires this permission either way.

**`storage`**
> `chrome.storage.local` only, holding: the random salt that selects which device profile each site is
> shown, the user's tracker-category toggles, the user's per-site allowlist, and per-site blocked
> counters. `chrome.storage.sync` is never used, so none of this reaches a Google account. There is no
> server and no account; nothing stored is transmitted anywhere.

**`alarms`**
> Wakes the background service worker on a schedule to rotate the persona salt. This is an optional
> feature, off by default; an MV3 service worker has no way to wake itself on a timer without this
> permission.

**`webRequest`** (observation only — `webRequestBlocking` is not requested, and does not exist on
Chrome MV3)
> Used only to observe request and response headers — never to block. A passive, three-strike
> observer reads `onBeforeSendHeaders` and `onHeadersReceived` to identify which third-party domains
> set cookies across unrelated sites; once a domain crosses the threshold, the extension writes a
> `declarativeNetRequest` rule and the blocking itself happens there, so a bug in the observer can
> never hang a request. Only aggregate per-domain strike counts are kept — never a request log or
> request bodies — and nothing observed is ever transmitted anywhere.

**`host_permissions`: `<all_urls>`**
> Required on every site for three reasons that do not scope down. First, the `Sec-GPC: 1`
> do-not-sell header and the persona's User-Agent/Client-Hint headers are only meaningful sent
> everywhere — a signal or a persona header reaching a curated subset of sites is not a signal, and
> would contradict the JavaScript persona on every other site. Second, the fingerprint-defense content
> script has to run at `document_start` on every page, before any page script, because the one site a
> user forgot to add to a list is exactly the site that fingerprints them. Third, the popup needs the
> active tab's URL to attribute blocked requests to the page that made them. Nullecho does not request
> `scripting`, `tabs`, `cookies`, `history`, `bookmarks`, `downloads`, `management`, `identity`,
> `unlimitedStorage`, `userScripts`, or any remote host — worth stating unprompted, since it means all
> three content scripts are statically declared and the extension cannot inject code into a page at
> runtime at all.

---

## Remote code

> **No.**
>
> All code ships inside the extension package. There is no `<script src>` pointing at a remote
> resource, no `eval()`, no `new Function()`, no `importScripts()`, and nothing that interprets a
> command fetched from a server. The only two `fetch()` calls in the shipped source
> (`ext/src/background.js`, `ext/src/gpc.js`) read a JSON ruleset file bundled inside the extension via
> `chrome.runtime.getURL(...)` — resolving to `chrome-extension://…`, never a remote host. Tracker
> blocking lists are static rulesets in the package, not fetched at runtime. This is enforced by an
> automated test (`ext/src/manifest.test.js`) that fails the build if any other network API appears in
> shipped source, or if a `fetch()` argument is not a bundled-file URL.

---

## Data usage disclosures (Privacy practices tab)

Tick **nothing collected** — every data-type checkbox in the Chrome dashboard's data-collection
disclosure left unchecked. Nullecho reads request/response headers and page-displayed price text
locally to do its job, but nothing is collected in the dashboard's sense of leaving the device; there
is no server for it to reach.

**Certifications** (the dashboard's three mandatory checkboxes) — certify all three, truthfully:

- **I do not sell or transfer user data to third parties**, outside of the approved use cases — true;
  there is no third party and no transfer mechanism at all.
- **I do not use or transfer user data for purposes unrelated to the item's single purpose** — true;
  the only data handled (blocking counts, the persona salt, the allowlist) exists solely to run the
  features described above.
- **I do not use or transfer user data to determine creditworthiness or for lending purposes** — true;
  trivially, since nothing leaves the device to be used for anything.

Do not check any box implying analytics, personalization, or advertising use — none apply, and
`docs/DECISIONS.md` records that a premium tier, an affiliate deal, and any data sale were
deliberately cut as monetization options, not merely unbuilt.

---

## Privacy policy URL

> **https://nullecho.org/privacy/**

Required even though nothing is collected — Chrome's rule is that a posted privacy policy is owed by
any item that *handles* user data, and "handle" (not "transmit") is the trigger.
`ext/src/background.js` and `ext/src/gpc.js` write per-site counters and a persona salt to
`chrome.storage.local`, which is squarely inside that definition. The page at this URL (source:
`site/privacy/index.html`) covers both halves honestly: the extension collects nothing, and the
*website* is hosted on GitHub Pages, which logs visitor IPs and user agents as any host does — stated
explicitly rather than left for a reviewer to assume.

## Homepage

> **https://nullecho.org**

Wired into `ext/manifest.json`'s `homepage_url` field already (commit `ad8ca00`), so the extension
card's own "Visit website" link and this store field agree.

## Support

> **jason@nullecho.org** (recommended)

The alternative is the GitHub issues URL: `https://github.com/ZJHeepfixer/nullecho/issues`. Both are
real and already live — `jason@nullecho.org` appears throughout `research/outreach/` as a working
send address, and `SECURITY.md` already directs security reports to GitHub issues (public) or GitHub
security advisories (private). Recommend the email for the dashboard's **Support URL/email** field
because it is the lower-friction path for an ordinary user reporting a broken site, and note in the
email's auto-reply or a pinned issue that bugs and breakage reports are equally welcome as GitHub
issues — which is where `SECURITY.md` already sends security-specific reports.

---

## Publisher

The Chrome Web Store account this listing is filed under is Core Capital Investments LLC's Google
account.

**Publisher display name — recommend "Nullecho", not the LLC name.** Three reasons: (1) the product's
entire trust argument is that it is a single, accountable, non-commercial project — `README.md`'s "On
copying, and on trust" section makes the no-sale, no-transfer promise in Nullecho's own name, and a
storefront byline reading "Core Capital Investments LLC" would be the first thing a skeptical reader
(the exact audience this tool is written for) notices as inconsistent with "this will never be sold
to a company." (2) None of the project's public identity is the LLC — every pointer
(`.github/FUNDING.yml`, the site footer, clone instructions) is the handle `ZJHeepfixer` or the name
"Nullecho," never a company name. (3) Nothing about Nullecho is a Core Capital product line in any
user-facing copy today, so introducing the LLC name at the storefront would be new information with
no explanation attached to it.

**Recommend verifying `nullecho.org` as the publisher website** in the dashboard (Search Console DNS
TXT record) for the verified-publisher badge Chrome shows next to a listing — it costs one DNS TXT
record, nullecho.org is already the live homepage and privacy-policy host, and a "verified" badge is
the cheapest available trust signal for a first-time developer account publishing a `<all_urls>`
extension with broad permissions, which Chrome's own review docs flag as a scrutiny trigger regardless.

**The EU DSA trader/non-trader question.** Chrome requires every developer to declare Trader or
Non-Trader for EU users. A company account (Core Capital Investments LLC) answers **"Trader"** — this
is not a free choice; Google's guidance is that an account run for or by a business, even if the
product itself is free and non-commercial, is a trader for DSA purposes. Declaring Trader publicly
displays the legal name, an SMS-reachable phone number, and an address on the listing to EU visitors.
This interacts with `docs/DECISIONS.md` S4 (the `LICENSE` copyright holder is "Jason Luker," a legal
name, while every public identity is the handle "ZJHeepfixer") — whichever way that gets resolved,
`LICENSE`, the publisher display name above, and the trader declaration's legal name should all agree,
because a mismatch between them is exactly what a reviewer or a skeptical user notices. The registered
address that would display is Core Capital Investments LLC's Wyoming registered-agent address unless a
different one is entered.

---

## Version to submit

> **0.9.0**, packaged from `ext/` at whatever commit is current on `main` when the zip is built.

`ext/manifest.json` carries `"version": "0.9.0"` and
`"version_name": "0.9.0 · release candidate — every claim independently measured"` — Chrome shows the
`version_name` string to users if present, so that sentence is what actually displays. Per
`docs/RELEASE-CHECKLIST.md`'s own versioning rule, `1.0.0` may only be set once (1) the owner has
loaded the extension unpacked in their own stable Chrome and exercised popup/options/GPC/measure-it-
yourself, (2) the Tier A breakage pass is clean, and (3) a store submission has been filed with the
packaged zip — so **this store submission is itself gate 3 of 3 for 1.0**, not a step taken after 1.0.
Do not bump the manifest version before submitting; submit 0.9.0 and let the gate decide 1.0.

### Packaging — there is no `ext/tools/package.mjs` yet; it is a planned follow-up

`ext/tools/` today holds only `gen-suffix-mirror.mjs` (a generator, not a packager).
`docs/RELEASE-CHECKLIST.md` §3b already names the intended location —
`ext/tools/package.mjs` with an `npm run package` script in `ext/package.json`, taking a `--firefox`
flag to swap manifests — and says explicitly that lane's owner has not built it yet. **Do not zip `ext/`
whole**: `npx web-ext@8 lint --source-dir=ext` run directly against the tree on 2026-09-22 returns
**5 errors and 5 warnings**, every one of them from a file that has no business in a shipped package
(three `.mjs` generators with a `#!/usr/bin/env node` shebang the linter rejects; `Function`
constructor use and a dynamic `import` in test files). AMO would reject that zip outright; Chrome's
own MV3 rule that "the full functionality of an extension must be easily discernible from its
submitted code" is also harder to satisfy with 20+ test files sitting in the package a reviewer has to
read through.

**The zip must contain, and only contain:**

```
manifest.json
icons/icon-16.png
icons/icon-32.png
icons/icon-48.png
icons/icon-128.png
popup/popup.html
popup/popup.css
popup/popup.js
options/options.html
options/options.css
options/options.js
options/drop.html
options/drop.css
options/drop.js
rules/ads.json
rules/analytics.json
rules/social.json
rules/fingerprinting.json
rules/gpc.json
rules/ua-win.json
rules/ua-mac.json
rules/ua-linux.json
src/allowlist.js
src/background.js
src/gpc.js
src/heuristics.js
src/linkage.js
src/linux-ground-truth.js
src/personas.js
src/pricing.js
src/pricing-scan.js
src/protocol.js
src/shim-loader.js
src/shim.js
src/suffixes.js
```

**The zip must NOT contain:**

- `manifest.firefox.json` (the Firefox-only manifest — a second manifest in a Chrome submission
  invites a question it doesn't need to)
- `PERMISSIONS.md`, `README.md`, `package.json`, `rules/README.md`
- Every `*.test.js` file in `src/` and `rules/` (21 files as of this writing: `background`,
  `claim-verification-2026-09-17`, `firefox-boot-2026-09-19`, `gpc`, `gpc-one-mask-2026-09-20`,
  `handshake-integration`, `heuristics`, `layout-early-out`, `linkage`, `loader-frames-2026-09-20`,
  `manifest`, `native-shape`, `native-source-2026-09-19`, `offscreen-getimagedata-2026-09-20`,
  `personas`, `pricing`, `protocol`, `review-2026-09-16`, `review-2026-09-19`, `same-tick-realm`,
  `shim-handshake` in `src/`, plus `ua.test.js` in `rules/`)
- `src/persona-validator.js` and `src/test-realm-rig.js` — **caught while writing this file**: neither
  is `*.test.js` by name, so a naive "everything except `*.test.js`" allowlist ships both. Neither is
  imported by any manifest-referenced file at runtime; `persona-validator.js` is imported only by
  `personas.test.js`, and `test-realm-rig.js` only by three other test files. Both are
  development/test-only and fail the "not referenced by the manifest" rule.
- `rules/gen-ua.mjs`, `rules/validate.mjs`, `ext/tools/gen-suffix-mirror.mjs` (build-time generators,
  not runtime code; also the exact three files that trip the AMO linter's shebang check)
- `_metadata/` — Chrome writes this into an unpacked directory the moment it loads it for testing; it
  must never be zipped or committed (`harness/unpacked-chrome.mjs`'s own header calls this out as a
  trap that cost a round on 2026-09-19)

**The exact command, until `package.mjs` exists** (run from the repo root):

```bash
cd ext
rm -rf /tmp/nullecho-package && mkdir -p /tmp/nullecho-package
rsync -a \
  --include='manifest.json' \
  --include='icons/***' \
  --include='popup/***' \
  --include='options/***' \
  --include='rules/***.json' \
  --include='src/***.js' \
  --exclude='**/*.test.js' \
  --exclude='src/persona-validator.js' \
  --exclude='src/test-realm-rig.js' \
  --exclude='*' \
  ./ /tmp/nullecho-package/
cd /tmp/nullecho-package && zip -r ../nullecho-0.9.0-chrome.zip . -x '.*'
```

Then, before uploading: `npx web-ext@8 lint --source-dir=/tmp/nullecho-package` and require **0
errors** (warnings from AMO-specific checks like `UNSUPPORTED_API` for Chrome-only APIs are expected
and fine on a Chrome build; only real errors block). Also re-run `cd ext && npm test` and
`npm run validate` from the source tree first — both must be clean before a package is cut, per
`docs/RELEASE-CHECKLIST.md` §3b step 4. **Measured directly while writing this file (2026-09-22,
`main`): `npm test` → 477/477 passing, `npm run validate` → 182 rules, 182 unique ids, 0 errors.** Note
for the record: `README.md` and `docs/RELEASE-CHECKLIST.md` still say "328 passing" — that number is
now stale by 149 tests; worth a find-and-replace pass before or alongside this submission, the same
class of drift `docs/review-2026-09-19/store-compliance.md` S2 already flagged once.

**Reproducible-build facts to volunteer if AMO or a source-code request asks:** Node 20 or newer
(tested against Node v22.22.3 while writing this), macOS or Linux; zero npm dependencies and therefore
no `package-lock.json` (say so explicitly rather than leaving it looking like an omission); build with
`node rules/gen-ua.mjs && node tools/gen-suffix-mirror.mjs && npm run validate && npm test`, then the
packaging step above. `npm run validate` fails if a generated file differs from what its generator
would emit — the diff-to-zero property a source-code reviewer checks for.

---

## Review notes for the Chrome reviewer ("Notes to reviewer" box)

> Nullecho blocks trackers and shows a synthetic-but-consistent device profile per site. To see it
> work in under a minute: install the extension, open any ordinary news or shopping site, and click
> the toolbar icon — the popup shows a live blocked-request count for that page and the device profile
> (OS, GPU, CPU/RAM, display) the site is currently being shown, both computed on-device from the
> page you're already on. Then open https://nullecho.org in a new tab and run the fingerprint check on
> that page — it reads your browser's own APIs live and shows the same profile the popup just
> reported, so the extension's claim and the page's independent measurement can be compared side by
> side, with no account and no data leaving the browser either way.
>
> The extension has no login, no server, and no network endpoint beyond two `fetch()` calls that read
> bundled JSON files out of the package itself (`chrome.runtime.getURL(...)`) — there is nothing to
> configure or sign into to see it work. Source is public and MIT licensed at
> github.com/ZJHeepfixer/nullecho, including the test suite (477 tests) and the DNR rulesets the
> extension ships; nothing in the submitted package differs from what's in the repository at the
> corresponding commit. The privacy policy at nullecho.org/privacy/ documents, with file/line
> citations into the source, exactly what is stored locally and why; nothing described there is
> transmitted anywhere.

---

## Status this listing depends on

Written against `main`, commit at the top of `git log` when this file was produced (2026-09-22),
compared against `docs/review-2026-09-19/store-compliance.md`'s seven blockers:

| Review finding (2026-09-19) | Status as of this listing |
|---|---|
| B1 — Checkout Report promised, never built | **Fixed.** Deleted from every doc in `44be2dd`; replaced by the price-disclosure notice, which is real, shipped, and tested (`ext/src/pricing.js`, `pricing-scan.js`, `pricing.test.js`). |
| B2 — stale "2 of 10" detector count | **Fixed.** README/SECURITY.md/site now all say "2 lying API records" against CreepJS, with the 199→2 history stated. |
| B3 — unqualified "can't be linked/joined" claim | **Fixed** in the surfaces checked (`README.md`, `SECURITY.md`, `site/prove-it/`) — all now carry the "for trackers that hash the signals we cover... does not for a lie-aware library" qualifier, which this listing also carries. |
| B4 — no privacy-policy URL, no contact | **Fixed.** `jason@nullecho.org` is live and used throughout `research/outreach/`; `site/privacy/index.html` is a complete, hosted policy. |
| B5 — Firefox "strictly more capable" over-claim | Not re-checked line-by-line in `docs/LAUNCH.md` for this pass; `ext/PERMISSIONS.md`'s own current text is correct (identical blocking behavior, Firefox only gains dev-time attribution detail). This listing does not repeat the over-claim anywhere. |
| B6 — wrong state-law effective dates | **Fixed.** Current copy says "New York's is in force now" only, with Connecticut dated 2027-07-01 and Maryland/New Jersey correctly described as ban-only with no disclosure string — matches `docs/DECISIONS.md` D16's correction. |
| B7 — no packaging script, `web-ext lint` fails on the tree | **Still open.** Confirmed again while writing this file: 5 errors / 5 warnings against the raw tree. This is exactly why the packaging section above exists — the listing does not wait on the script, it supplies the equivalent zip command directly. |

**Not gated by this listing, but worth knowing before submitting:** `README.md`'s own Status table
still shows the Linux-persona GPU-string verification and the full Tier-A breakage pass (bank login,
checkout, SSO) as open. Chrome does not require either to accept a submission, but
`docs/RELEASE-CHECKLIST.md`'s own 1.0 gate does — this store submission is allowed to happen at 0.9.0
release-candidate status; it is what triggers 1.0 once the other two gates close, not a claim that
they already have.
