# Pre-launch hardening — Nullecho 0.9.x → 1.0 (written 2026-09-28)

Owner's instruction: fine-tune and test Nullecho before it is in front of the world. The Chrome Web Store
submission (item `ngolhoibjdchbbidglcfpljnabjfkfbn`, 0.9.0, **pending review, auto-publish OFF**) contains the
reCAPTCHA defect below, so it must be replaced before anything is published.

## The lesson that shapes this plan

The reCAPTCHA break (D49) was **invisible to every automated check we had**: 481 unit tests, the claim gate, the
14-site smoke in Chrome for Testing, and curl with the exact headers all passed. It appears only in **branded Chrome
with a real, signed-in profile**, because Google sees signals there (X-Client-Data, account cookies) that no test
browser carries. So the ship gate is **real-Chrome, real-profile testing with an OFF control on every failure** —
the automated suites are necessary, not sufficient.

## Step 1 — confirm D49 in the owner's Chrome (blocking) — ✅ DONE 2026-09-28, but the cause was D50

D49 was live and reCAPTCHA still failed. The real cause was a learned `google.com` block (D50, BREAKAGE-TESTING
2026-09-28); fixed and verified in the owner's Chrome with Nullecho ON (patrickhlauke + ascendpartner render the box).
The bisect below was not needed. Kept for the record.

## Step 1b — the persona's Chrome version is hardcoded and goes stale (blocking; D51) — ✅ DONE 2026-09-28 (D51)

Fixed on branch `d51-real-browser-version`: the shim leaves `userAgent` / `appVersion` / `vendor` / `brands` / `toJSON`
to the browser and delegates `getHighEntropyValues()` for everything but the five persona hints; personas carry no
`ua`; the `ua-*` rules only remove the seven hints (now on http too — Chrome sends them to `http://localhost`); the popup
names the real browser. Firefox had it worse (a Chrome UA, vendor and Client Hints on a Gecko engine) and is fixed by
the same change. New automated gate: `harness/unpacked-chrome.mjs smoke|claim` and `harness/site-smoke.mjs` fail when
the page describes a different browser than the one running (it fails on the pre-D51 build: page 151, worker 149).
Still owed: the same check in the owner's branded Chrome 153 (step 3, row 10 — `browserleaks.com/client-hints`).

Found during step 1: the owner's Chrome is **153**; every persona, the shim's brand list and the static UA rules say
**151** with a fixed GREASE brand (`Not;A=Brand`/99 — real 153 sends `Not_A Brand`/8, in a different order). Chrome
auto-updates every four weeks, so every install drifts into a claim the browser contradicts (TLS, features, Google's
X-Client-Data). Within an OS family every persona's User-Agent and low-entropy hints are identical to the real reduced
UA except for that version, so the rewrite hides nothing and only adds the stale claim. Fix: the shim reports the
browser's real `userAgent`, `brands`, and full version; the static rules stop rewriting User-Agent / Sec-CH-UA /
-Mobile / -Platform (the hint removal stays, D49).

- Owner: chrome://extensions → Nullecho card → reload arrow (loads commit `6a49d06` rules), then
  `https://patrickhlauke.github.io/recaptcha/` with Nullecho ON. Box renders ⇒ D49 confirmed. Also re-check
  `https://www.ascendpartner.com/affiliate/registration?usertype=2`.
- If still missing: bisect in the owner's Chrome by editing `ext/` and reloading the card each round:
  (a) drop the Sec-CH-UA/-Mobile/-Platform rewrite, (b) drop the User-Agent rewrite, (c) drop Sec-GPC,
  (d) the heuristics' learned dynamic rules. Record each result here.

**Owner's-Chrome verification of D50 + D51 (2026-09-28, Chrome 153.0.8010.54, macOS arm, signed in, `41f4b69`):**
page `navigator.userAgent`, `userAgentData.brands` and `uaFullVersion` identical to an unpatched Worker's (Chrome/153.0.0.0,
153.0.8010.54); on the wire `User-Agent` Chrome/153, `Sec-CH-UA` v=153/8/153, zero high-entropy hints, `Sec-GPC: 1`;
persona still applied (`architecture` arm, `hardwareConcurrency` 8 on the page vs 12 in a Worker — the known A8 gap, now the
largest remaining detectability tell); reCAPTCHA anchor 304×78 on patrickhlauke + ascendpartner; extension card shows no
Errors after the reload.

## Step 2 — replace the pending store submission (owner clicks; director guides)

1. Bump `ext/manifest.json` + `manifest.firefox.json` to **0.9.1**; `npm test`; `node ext/tools/package.mjs`;
   copy the zip to `~/Desktop/Nullecho store upload/`.
2. Developer dashboard → the item → **Cancel review** (or "Withdraw") → Package → Upload new package → confirm the
   listing is intact → Submit for review with **"Publish automatically" unchecked**.
3. Tag the commit `v0.9.1-cws-submitted`; update `RELEASE-CHECKLIST.md`.

## Step 3 — real-Chrome battery (owner's everyday profile; director drives where possible)

Every row: ON result; on any failure, the owner flips Nullecho off **for that site** (popup switch) and retests —
the OFF control. Tabs must be visible (`document.visibilityState === 'visible'`) or the result is void.

| # | Flow | Why it matters | Who |
|---|---|---|---|
| 1 | reCAPTCHA v2 checkbox on 3 unrelated third-party sites | the D49 failure class | director drives, owner confirms box |
| 2 | reCAPTCHA v3 (invisible) — a site that scores silently (e.g. a login form that uses it) | a low score fails with no visible box | owner |
| 3 | hCaptcha and Cloudflare Turnstile on third-party sites (not their own demo pages) | same third-party pattern as D49 | director drives |
| 4 | Cloudflare "checking your browser" interstitial on a protected site | bot scoring on headers + fingerprint | director drives |
| 5 | Google sign-in on a third-party site (popup) | cross-origin popup + Google's own risk engine | owner |
| 6 | Gmail, YouTube playback, Google Docs edit, Google Maps pan/zoom — signed in | Google sends Accept-CH; D49 now removes hints it asked for | owner + director |
| 7 | A real checkout to the payment page: Amazon, Stripe-hosted, PayPal popup | fraud vendors score the device | owner |
| 8 | Bank login (done 9/26 on the old rules — redo on 0.9.1) | fraud-vendor tier, off by default | owner |
| 9 | Akamai-fronted retail (Best Buy, Dell) and PerimeterX (Walmart) | these walled the device-price probe | director drives |
| 10 | Header check: `browserleaks.com/client-hints` and `httpbin.org/headers` | confirm the 4 always-sent headers are the browser's own (153, real brands — D51), 7 hints absent, Sec-GPC present | director |
| 11 | CreepJS in the owner's Chrome | detectability did not regress with D49 | director |

## Step 4 — automated gates (director; must stay green on every change)

**New gate from D50 — BUILT 2026-09-28: `npm run smoke:seeded` (from `ext/`; `harness/site-smoke.mjs --seeded`).**
Every automated run before it started from a profile with no learned state, and the learner is the one layer that
changes behaviour with use. The seeded smoke, in every ON browser and before any site: writes the learner's own
storage record (status `blocked`, three sites, `source: 'learned'`, ids from the heuristic block range) for google.com,
youtube.com, facebook.com, microsoft.com, live.com, microsoftonline.com, apple.com, cloudflare.com, amazon.com,
twitter.com, x.com, linkedin.com; reloads the extension the way an update does, so the SHIPPED `reconcile()` writes the
rules; then reads `getDynamicRules()` back and **aborts (exit 3) unless every seeded domain has a live learned rule
and a probe fetch proves the rules are enforced and the match recorder sees them**. It runs the 14 sites plus 14
learned-state rows (reCAPTCHA v2 on patrickhlauke + ascendpartner, reCAPTCHA Enterprise on reddit login, Turnstile on
peet.ws, hCaptcha on democaptcha, Google Sign-In on reddit + pinterest login, YouTube / Maps ×2 / Calendar / Facebook
Page plugin / embedded X post embeds, and microsoft.com's own silent sign-in hand-off from login.live.com) OFF and ON,
attributes every learned-rule match to its row, and
fails any row where a learned rule BLOCKED a NEVER_BLOCK / COOKIE_BLOCK_ONLY host — the D50 invariant over all traffic,
not just what each check looks at. **Green = exit 0**: no FAIL, no VOID (hidden tab), no `[nullecho]` warning in the
worker console during the reload, no seeded rule lost mid-run.

- **Negative control, proven 2026-09-28** (`--learner-from 'b42beb4^'`: the same zip with the pre-D50 learner swapped in,
  temp dir only): every reCAPTCHA / Turnstile / Google Sign-In / Google-embed row FAILS, each attributed to the learned
  rule that blocked it, and the worker console shows the D50 reload race. On the current code every one PASSES and the
  invariant finds zero protected-host blocks. Run logs: `docs/breakage-runs/2026-09-28-seeded-learned-state.md`.
- **What it surfaced, resolved by D52 (2026-09-28):** a learned `facebook.com` / `twitter.com` block removed Facebook
  plugins and embedded X posts from every third-party site, and a learned `microsoft.com` block stopped microsoft.com's
  own silent sign-in (login.live.com posting back). D52 cookie-strips the social platforms and gives every learned rule
  its company's other domains as `excludedInitiatorDomains`; rows 26–28 now gate. Proven both ways: they PASS on
  `f5a906d`+ and FAIL on the 73b511b learner (`--learner-from 73b511b --only tp-facebook-sdk-plugin,tp-x-embedded-post,
  tp-msft-signin-handoff`), each attributed to its learned rule. Latest green run: `2026-09-28-site-smoke-seeded-956882e.md`
  (27 PASS + nytimes BLOCKED, exit 0).

`npm test` (506+), `node rules/validate.mjs`, `node ext/tools/package.mjs`, `npm run smoke` (14 sites, packaged
zip, ON/OFF, browser identity ON = OFF), **`npm run smoke:seeded` (exit 0)**, `harness/unpacked-chrome.mjs claim`
(lieCount 2, no toString proxy, two FingerprintJS ids, D51 version gate: page = Worker = `browser.version()`),
`web-ext lint` on the Firefox package (0/0/0).

## Step 5 — soak, then go/no-go

A week of the owner's normal browsing on 0.9.1 with Nullecho on; any "this site acted weird" goes through the
OFF control. **Go** = zero S0 across steps 1–4, every S1 fixed or documented as a shipped exception, Google approval
received. Then the owner presses Publish, the version becomes 1.0.0 per `RELEASE-CHECKLIST.md`, and the Firefox
package goes to AMO.

## Step 6 — distribution: not one gatekeeper (owner's instruction, 2026-09-28)

Google owns the Chrome Web Store and can reject or pull the listing; the code is open source by design, so the risk is
the store, not the code. Before or at 1.0: the Firefox package to AMO (built, `web-ext lint` 0/0/0), the same Chrome
package to Microsoft Edge Add-ons (free, Chromium MV3), and a signed release zip on GitHub for manual install. Keep the
Chrome listing strictly accurate so a policy reviewer has nothing to act on.
