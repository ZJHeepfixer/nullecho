# Nullecho — Chrome Web Store listing draft

Draft only. Every sentence here was checked against `docs/THREAT-MODEL.md`'s
canonical claim and banned-phrase list before being written — the store listing
is user-facing copy and that document governs it. Do not add a superlative,
guarantee, or capability this repo's tests don't prove.

> ⛔ **Do not submit this listing until `docs/RELEASE-CHECKLIST.md` §3 (the
> real-browser gate) passes.** An earlier draft handled the gap by putting a
> pre-release disclaimer in "What's new" — that is honest and it is also a
> volunteered rejection under *Minimum Functionality*. The honest-and-safe move is
> to not submit yet. If a beta channel is wanted before the gate, use AMO's
> unlisted self-distribution, which carries no store-listing copy at all.

---

## Name

**Nullecho**

## One-line summary (≤132 chars)

> Blocks trackers, sends Global Privacy Control, and shows each site a different device profile. Breaks the join most trackers use.

(129 characters. The qualifier is load-bearing: `docs/THREAT-MODEL.md` records
that the join breaks against FingerprintJS and ClientJS and does **not** break
against a lie-aware library like CreepJS, and says the clause may not be stated
unqualified. "most trackers" is the shortest true form that fits the field.)

## Category

`[VERIFY: propose "Privacy & Security" — Nullecho's primary function is tracker
blocking and anti-fingerprinting, which is what that category is for on the
current Chrome Web Store — but confirm the exact taxonomy option still exists
under that name at submission time, since store categories change.]`

## Full description

Nullecho blocks the ad networks, analytics scripts, social-media pixels, and
known fingerprinting vendors that follow you across sites (182 static rules
sourced from DuckDuckGo Tracker Radar, EasyPrivacy, and AdGuard — not invented).
It sends Global Privacy Control, a do-not-sell/share request that is legally
recognised if *you* live in a state that recognises it — California, Colorado and
several others; the duty attaches to your residency, not to where the site is.
And instead of trying to make you invisible, it gives each site you visit a
different but internally consistent device profile, drawn from a pool of real,
common hardware configurations.

That profile breaks the fingerprint join for trackers that hash the signals
Nullecho covers — verified against FingerprintJS and ClientJS, which give four
personas four distinct visitor IDs. It does not break it for a tracker that
detects spoofed values, discards them, and keys on what is left; the CreepJS
library does exactly that and re-joins the personas into one identity. Nullecho
is detectable by design.

**What Nullecho does not do, stated plainly, because a privacy tool that
oversells is worse than none:**

- **It is detectable, by design.** It does not hide that it's installed and does
  not claim to. Measured with CreepJS — a free third-party library, not our own
  test suite — our build produces 2 lying API records, and both of them are the
  canvas and audio noise that is the defense itself.
- **It does not defeat a determined, targeted adversary.** It raises the cost of
  mass, automated, commercial profiling — that is a different thing from
  anonymity.
- **It does nothing about your IP address or TLS fingerprint.** Those sit below
  any layer a browser extension can reach. If that's your threat model, you want
  a VPN or Tor, not an extension.
- **It will not get you lower prices.** The best controlled study on this found
  that clearing your tracks produced the *worse* price more often than the
  better one. Nullecho makes no claim about prices.
- **It does nothing against state surveillance.** That's a different threat
  model, addressed by encryption, Tor, and legal/political action — not by
  degrading ad-tech profiles.
- **Firefox's `resistFingerprinting`/`fingerprintingProtection`, and Brave's
  built-in protections, are genuinely stronger** than Nullecho or any other
  extension — they operate below the JavaScript layer, where an extension can't
  reach. Nullecho exists for Chrome, where neither option is available.

Global Privacy Control covers **this browser profile only** — your phone and your
other browsers each need their own — and whether a given business is covered by a
state's opt-out duty, or acted on the signal, happens on their servers where a
browser cannot see it.

Nullecho collects nothing about you: no account, no telemetry, no analytics, no
crash reporting, nothing synced. And it will not be sold or transferred to a new
owner — the most common way a trusted extension turns malicious is an acquisition
followed by a quiet update, so the commitment is written into the repository's
README rather than left implied.

Privacy policy: https://zjheepfixer.github.io/nullecho/privacy/
Source, issues and security advisories: https://github.com/ZJHeepfixer/nullecho

## Privacy policy URL (required field)

> https://zjheepfixer.github.io/nullecho/privacy/

Chrome requires a posted privacy policy for any item that *handles* user data,
and handling is the trigger, not transmitting — "extensions are required to
disclose how they handle user data, even when data is processed or stored locally
on a user's device." Nullecho stores per-site counters and a persona salt in
`chrome.storage.local`, so the requirement applies even though nothing is
collected. The page above renders `docs/PRIVACY-POLICY.md` and is served from the
repository's own GitHub Pages site with no script and no third-party request.

## Single purpose (required field)

> Nullecho's single purpose is to prevent cross-site tracking. Every feature
> serves it: blocking known tracker requests stops collection at the source; the
> Global Privacy Control header is the legally recognised do-not-sell request for
> data already collected; and the per-origin device profile prevents the same user
> being re-identified across unrelated sites by hardware fingerprint. The
> extension has no other function, no account, and no network endpoint.

The California DROP walkthrough stays an **options subpage**. It is deliberately
not in the extension name, not in the summary, and not in the first paragraph of
the description — a state-specific deletion workflow named up front reads as a
second product, and *Quality Guidelines* says an extension must have one narrow
purpose and must not bundle unrelated functionality.

## What's new in 0.1

First release. Tracker blocking across four categories, Global Privacy Control,
and per-origin device personas. Californians also get a walkthrough, on the
options page, for the state's DROP data-broker deletion platform.

## Permissions justification (for the store's permissions-review form)

One paragraph per requested permission, drawn from `ext/PERMISSIONS.md`:

**declarativeNetRequest.** Runs Nullecho's five static tracker-blocking rulesets
(advertising, analytics, social widgets, known fingerprinting vendors, and the
Global Privacy Control header), the per-OS-family User-Agent/Client-Hint header
rules, and the per-site allowlist. This is the narrower of the two options: the
browser evaluates the rules, so the extension never sees the URL of a request it
did not act on. `webRequestBlocking` is not requested on any platform.

**declarativeNetRequestFeedback.** Lets the toolbar popup report how many requests
were actually blocked on the current page, via `getMatchedRules()`. Without it the
popup would have to display an invented number, which we will not do. It grants no
additional access to page content. Stated plainly because a reviewer will ask:
`onRuleMatchedDebug` does not fire in a packed store build, so the popup falls back
to `getMatchedRules()` — which itself requires this permission. The alternative is
a made-up count.

**storage.** `chrome.storage.local` only, for: a random salt that selects which
device profile each site is shown, the user's category toggles, the user's
per-site allowlist, and per-site blocked counters. `chrome.storage.sync` is
deliberately never used, so none of this reaches a Google account. There is no
server and no account; nothing stored is transmitted anywhere.

**alarms.** Wakes the service worker on a schedule to rotate the persona salt.
This is an optional feature that is **off by default**; an MV3 service worker
cannot wake itself to do it without this permission.

**webRequest (observation only — `webRequestBlocking` is not requested).** A
passive, Privacy-Badger-style observer registers only `onBeforeSendHeaders` and
`onHeadersReceived`, to see which third-party domains set cookies across unrelated
sites. After three cross-site appearances it writes a `declarativeNetRequest`
rule; the blocking itself always happens in DNR, so a bug in the observer can
never hang a request. Only aggregate per-domain strike counts are kept — never a
request log — and nothing observed is transmitted, because the extension has no
network endpoint.

**host_permissions: `<all_urls>`.** Required on every site for three reasons that
do not scope down. (1) The `Sec-GPC: 1` do-not-sell header is only meaningful if
sent everywhere — a signal sent to a curated subset is not a signal — and the same
is true of the persona's User-Agent/Client-Hint headers, which must agree with the
JavaScript persona on every site or they create the exact contradiction they exist
to remove. (2) The fingerprint-defense content script must run on every page,
because the site a user forgot to add to a list is exactly the site that
fingerprints them. (3) The popup needs the active tab's URL to attribute blocked
requests to the page that made them. Nullecho does not request `scripting`,
`tabs`, `cookies`, `history`, `bookmarks`, `downloads`, `management`, `identity`,
`unlimitedStorage`, `userScripts`, or any remote host. All three content scripts
are statically declared in the manifest, so the extension cannot inject code at
runtime at all.

**Remote code (MV3 declaration).** All code is in the package. There is no
`<script src>` to any remote resource, no `eval()`, no `new Function()`, no
`importScripts()`, and no interpreter for remotely fetched commands. The only two
`fetch()` calls in the shipped source read a JSON file bundled inside the
extension via `chrome.runtime.getURL(...)` (in `ext/src/background.js` and
`ext/src/gpc.js`) — verified by an automated test that fails the build if any
other network API appears or if a `fetch()` argument is not a bundled-file URL.
Filter lists are static rulesets in the package and are never fetched at runtime.

## Screenshot shot-list (Jason to capture; 5 screenshots)

1. **Popup, an ordinary news or shopping site, protection on.** Shows the live
   blocked-request count and the category breakdown. Caption: "See what's
   blocked on every page, in real numbers — not a score."
2. **Popup, persona card expanded.** Shows the device profile the current site
   is seeing (platform, browser version, etc.), captioned so it's clear this is
   *a* profile, not your real one. Caption: "Each site sees a different,
   internally consistent device — not your real one. That breaks the join most
   trackers use."
3. **Options page, blocking + GPC toggles, light mode.** Caption: "Turn any
   category off, per site or everywhere. Global Privacy Control sent
   automatically."
4. **Options page, the allowlist with one site added, showing the "why you
   might need this" note.** Caption: "One click to stand down on a site that
   breaks — reversible any time."
5. **Popup, the measure-it-yourself panel.** Caption: "It doesn't ask you to
   trust a green shield — it measures your own fingerprint, on your machine, with
   protection off and on."

Each screenshot must be captured from a real, loaded, unpacked install per
`docs/RELEASE-READINESS-2026-09-16.md` §3 — none of this can be verified or
produced from this environment.

**Still owed and not in this repo** (`docs/RELEASE-READINESS-2026-09-16.md` §4):
all five screenshots at 1280×800 or 640×400, and the **440×280 small promo tile**,
which is a required field — items without one are ranked below items that have
one. The 128×128 store icon exists at `ext/icons/icon-128.png`; its 96×96-artwork
-plus-16px-transparent-padding convention has not been measured.
