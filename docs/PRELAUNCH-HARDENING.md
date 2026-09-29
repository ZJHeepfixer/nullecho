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

## Step 1 — confirm D49 in the owner's Chrome (blocking)

- Owner: chrome://extensions → Nullecho card → reload arrow (loads commit `6a49d06` rules), then
  `https://patrickhlauke.github.io/recaptcha/` with Nullecho ON. Box renders ⇒ D49 confirmed. Also re-check
  `https://www.ascendpartner.com/affiliate/registration?usertype=2`.
- If still missing: bisect in the owner's Chrome by editing `ext/` and reloading the card each round:
  (a) drop the Sec-CH-UA/-Mobile/-Platform rewrite, (b) drop the User-Agent rewrite, (c) drop Sec-GPC,
  (d) the heuristics' learned dynamic rules. Record each result here.

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
| 10 | Header check: `browserleaks.com/client-hints` and `httpbin.org/headers` | confirm 4 headers rewritten, 7 hints absent, Sec-GPC present | director |
| 11 | CreepJS in the owner's Chrome | detectability did not regress with D49 | director |

## Step 4 — automated gates (director; must stay green on every change)

`npm test` (481+), `node rules/validate.mjs`, `node ext/tools/package.mjs`, `npm run smoke` (14 sites, packaged
zip, ON/OFF), `harness/unpacked-chrome.mjs claim` (lieCount 2, no toString proxy, two FingerprintJS ids),
`web-ext lint` on the Firefox package (0/0/0).

## Step 5 — soak, then go/no-go

A week of the owner's normal browsing on 0.9.1 with Nullecho on; any "this site acted weird" goes through the
OFF control. **Go** = zero S0 across steps 1–4, every S1 fixed or documented as a shipped exception, Google approval
received. Then the owner presses Publish, the version becomes 1.0.0 per `RELEASE-CHECKLIST.md`, and the Firefox
package goes to AMO.
