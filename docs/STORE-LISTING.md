# Nullecho — Chrome Web Store listing draft

Draft only. Every sentence here was checked against `docs/THREAT-MODEL.md`'s
canonical claim and banned-phrase list before being written — the store listing
is user-facing copy and that document governs it. Do not add a superlative,
guarantee, or capability this repo's tests don't prove.

---

## Name

**Nullecho**

## One-line summary (≤132 chars)

> Blocks trackers, sends Global Privacy Control, and shows each site a different device profile so they can't link you.

(118 characters.)

## Category

`[VERIFY: propose "Privacy & Security" — Nullecho's primary function is tracker
blocking and anti-fingerprinting, which is what that category is for on the
current Chrome Web Store — but confirm the exact taxonomy option still exists
under that name at submission time, since store categories change.]`

## Full description

Nullecho blocks the ad networks, analytics scripts, social-media pixels, and
known fingerprinting vendors that follow you across sites (182 static rules
sourced from DuckDuckGo Tracker Radar, EasyPrivacy, and AdGuard — not invented).
It sends Global Privacy Control, the do-not-sell/share signal that's legally
enforceable in California and several other states. And instead of trying to
make you invisible, it gives each site you visit a different but internally
consistent device profile — drawn from a pool of real, common hardware
configurations — so sites can't join your visits together by fingerprint.

**What Nullecho does not do, stated plainly, because a privacy tool that
oversells is worse than none:**

- **It is detectable.** It does not hide that it's installed, and it doesn't
  claim to.
- **It does not defeat a determined, targeted adversary.** It raises the cost of
  mass, automated, commercial profiling — that is a different thing from
  anonymity.
- **It does nothing about your IP address or TLS fingerprint.** Those sit below
  any layer a browser extension can reach. If that's your threat model, you want
  a VPN or Tor, not an extension.
- **It will not get you lower prices.** The best controlled study on this found
  that clearing your tracks produced the *worse* price more often than the
  better one. Nullecho makes no claim about prices; it can show you what a
  shopping page contacted before it quoted you one.
- **It does nothing against state surveillance.** That's a different threat
  model, addressed by encryption, Tor, and legal/political action — not by
  degrading ad-tech profiles.
- **Firefox's `resistFingerprinting`/`fingerprintingProtection`, and Brave's
  built-in protections, are genuinely stronger** than Nullecho or any other
  extension — they operate below the JavaScript layer, where an extension can't
  reach. Nullecho exists for Chrome, where neither option is available.

Nullecho collects nothing about you: no account, no telemetry, no analytics, no
crash reporting, nothing synced. Full detail: `docs/PRIVACY-POLICY.md` in the
source repository.

## What's new in 0.1

First release. Tracker blocking across four categories, Global Privacy Control,
per-origin device personas, a Checkout Report, and a guided link to California's
DROP data-broker deletion platform. Pre-release: loads and runs in Chrome, but
breakage testing against real sites is incomplete — see the project's own
`docs/RELEASE-READINESS-2026-09-16.md` for the current list of open items before
this is represented as stable.

## Permissions justification (for the store's permissions-review form)

One paragraph per requested permission, drawn from `ext/PERMISSIONS.md`:

**declarativeNetRequest / declarativeNetRequestFeedback.** Runs Nullecho's
static tracker-blocking rulesets (ads, analytics, social widgets, fingerprinting
vendors) and the per-site allowlist, and reports which rules matched so the
popup can show an accurate blocked-request count instead of an invented one.
This is the narrow form: the browser evaluates the rules, and the extension
never sees the URL of a request it did not act on.

**storage.** Holds Nullecho's local settings only — the random persona salt,
your category toggles, your per-site allowlist, and per-site counters — all in
`chrome.storage.local`, never synced.

**alarms.** Lets the background service worker wake on a schedule to rotate
your persona salt, an optional feature that is off by default. Without this
permission an MV3 service worker cannot wake itself to do that at all.

**webRequest (observation only — `webRequestBlocking` is not requested).**
Lets a passive, Privacy-Badger-style observer watch which third-party domains a
page loads, so it can learn trackers not already on the static lists after
they've appeared on several unrelated sites. It only watches; every block it
decides on is still written as a declarativeNetRequest rule, so a bug in the
observer cannot hang a request.

**host_permissions: `<all_urls>`.** Needed on every site for three reasons that
don't scope down: the Global Privacy Control header and the device-persona
header rewrite are only meaningful if sent everywhere; the fingerprint-defense
script has to run on every page, because the one site you forgot to add is
exactly the site that will fingerprint you; and the popup needs the active
tab's URL to show per-site counts.

## Screenshot shot-list (Jason to capture; 5 screenshots)

1. **Popup, an ordinary news or shopping site, protection on.** Shows the live
   blocked-request count and the category breakdown. Caption: "See what's
   blocked on every page, in real numbers — not a score."
2. **Popup, persona card expanded.** Shows the device profile the current site
   is seeing (platform, browser version, etc.), captioned so it's clear this is
   *a* profile, not your real one. Caption: "Each site sees a different,
   internally consistent device — never your real one."
3. **Options page, blocking + GPC toggles, light mode.** Caption: "Turn any
   category off, per site or everywhere. Global Privacy Control sent
   automatically."
4. **Options page, the allowlist with one site added, showing the "why you
   might need this" note.** Caption: "One click to stand down on a site that
   breaks — reversible any time."
5. **The Checkout Report on a real checkout page** (a demo/staging cart is
   fine — no real purchase). Caption: "See what a shopping page contacted
   before it quoted you a price."

Each screenshot must be captured from a real, loaded, unpacked install per
`docs/RELEASE-READINESS-2026-09-16.md` §3 — none of this can be verified or
produced from this environment.
