# Nullecho — privacy policy

**Effective date:** 2026-09-19

Nullecho is a browser extension. This policy describes what it does, what data it
touches, and where that data goes. It also covers the project's **website**, which
is a separate thing with a separate answer — see "The website" below. Every claim
about the extension was checked against the source in `ext/` on 2026-09-19, not
asserted from memory — see the grep citations.

## What Nullecho does

Nullecho blocks trackers (ads, analytics, social pixels, known fingerprinting
vendors), sends the Global Privacy Control signal, shows each site a different but
internally-consistent device profile, and offers a guided link to California's
data-broker deletion platform (DROP).

Two qualifications belong here rather than in a footnote:

- **The device profile breaks the fingerprint join for trackers that hash the
  signals Nullecho covers** — verified 2026-09-17 against FingerprintJS 5.2.0 and
  ClientJS, which gave four personas four distinct visitor IDs. It does **not**
  break it for a lie-aware library: CreepJS discards values it catches being
  spoofed, keys on what is left, and re-joins the personas into one identity.
  Nullecho is detectable by design and does nothing about your IP address.
- **Global Privacy Control is a legal do-not-sell request if *you* live in a state
  that recognises it** (California, Colorado and several others). The duty attaches
  to your residency, not to where the site is, and whether a given business is
  covered — and whether it complied — happens on their servers where a browser
  cannot see it. The signal covers **this browser profile only**: your phone and
  your other browsers each need their own.

Full detail on what this does and does not protect against:
[`THREAT-MODEL.md`](THREAT-MODEL.md).

## Data collected: none

Nullecho has no server, no account, no sign-in, no telemetry, no analytics, and
no crash reporting — it does not send a single byte about you or your browsing
to anyone, ever.

**How we know this, not just claim it:** grepping the shipped extension source
(`ext/src/`, `ext/popup/`, `ext/options/`) for every way a web page or extension
can reach the network finds exactly two `fetch()` calls in the whole codebase:

```
ext/src/background.js   fetch(chrome.runtime.getURL('rules/fingerprinting.json'))
ext/src/gpc.js          fetch(chrome.runtime.getURL(RULESET_PATH))
```

(Deliberately cited by file and expression rather than by line number — line numbers
in a published policy rot silently. At commit `33dfefa` they are `background.js:97`
and `gpc.js:349`; the test below is what actually holds the claim.)

Both read a JSON file bundled *inside* the extension package — `chrome.runtime.getURL(...)`
resolves to `chrome-extension://…`, never a remote host. There is no other `fetch`,
`XMLHttpRequest`, `navigator.sendBeacon`, `WebSocket`, `EventSource`, or
`importScripts` anywhere in the shipped source — enforced by an automated test
(`ext/src/manifest.test.js`) that fails the build if any of those appear, or if a
`fetch()` argument is not a bundled-file `chrome.runtime.getURL(...)`.

"Analytics" and "telemetry" do appear in the source — as the *category label for
third-party trackers Nullecho blocks* (Google Analytics, Mixpanel, etc.) and in a
lookup table (`ext/src/linkage.js`) that names which company a blocked domain
belongs to, shown only to you, locally. None of that data leaves your device.

## Data stored locally

Everything Nullecho stores in an installed build lives only in
`chrome.storage.local` — a private, per-browser-profile store on your own machine
that Chrome and Firefox delete automatically when you uninstall the extension.
(One honest footnote, because this list is presented as a grep result and a grep
for `localStorage` finds something: `ext/options/drop.js:83-105` falls back to
`localStorage` when the DROP page is opened *outside* the extension — local
development only. In a packed install `chrome.storage.local` always exists, so
that path never runs.) Nothing is synced to your Google
or Firefox account (`chrome.storage.sync` is never used — enforced by the same
build-failing test above). Grepping every `storage.local.set` call in the source
gives this exact list:

| Key | What it holds |
|---|---|
| `identity` | A random session salt (seeds which device persona each site sees) and when it was last rotated. Never leaves this key. |
| `settings` | Which tracker categories you block, whether GPC is on, salt auto-rotation interval, loud-failure logging |
| `allowlist` | Sites where you've turned Nullecho off |
| `stats` | Per-site counters — blocked count, fingerprint-read attempts by API, categories seen, last visit, persona shown, last shim status. Capped at 500 sites / 60 tracker entries per site. |
| `nullecho:heuristics:v1` | Per-domain "strike" counts the passive tracker-detection observer has built (3 cross-site appearances → learned tracker) |
| `nullecho:gpc:v1` | Sites where you've manually excepted the GPC signal because it broke something |
| `nullecho.drop.residency`, `nullecho.drop.submittedAt` | Your California-residency answer and a date you typed, only if you use the DROP guide. Deliberately excludes name, birthdate, ZIP, or the state's deletion-request ID — those live only on California's own site, which Nullecho links to (`ext/options/drop.js`). |

None of these keys contain your browsing history, page content, or anything
identifying beyond a random salt and domains you've explicitly interacted with.

## Data shared: none

Nullecho has no backend to share data with. The permissions it requests let it
watch and modify requests *inside your own browser* — see below — none of them
involve sending anything to Nullecho or to any third party.

## Permissions, and why each is needed

Full reasoning: [`../ext/PERMISSIONS.md`](../ext/PERMISSIONS.md). Summary:

- **`declarativeNetRequest` / `declarativeNetRequestFeedback`** — runs the static
  tracker-blocking rules and reports what was blocked for the popup's count. The
  browser evaluates these rules; Nullecho's own code never sees the URL of a
  request it didn't block.
- **`storage`** — the local-only data above. **`alarms`** — wakes the background
  service worker to rotate your salt if you've turned that optional feature on.
- **`webRequest`** (observation only, not `webRequestBlocking`) — lets the
  tracker-detection observer watch which domains a site loads to learn new
  trackers not already on the blocklists. It only reads request headers; it
  can't block anything itself, and nothing it sees is ever transmitted anywhere.
- **`host_permissions: ["<all_urls>"]`** — needed on every site so blocking, the
  GPC signal, and the persona shim all work everywhere, not just a list you'd
  have to remember to maintain.

## How to delete everything

- **Uninstall the extension.** Chrome and Firefox both delete an extension's
  `chrome.storage.local` data automatically on uninstall — there is nothing left
  behind, because there was never anywhere else for it to go.
- **Get a "new identity" without uninstalling.** The popup's "New identity"
  button generates a fresh random salt and writes it over the old one
  (`ext/src/background.js`, `newSalt()`). Every site then sees a brand-new,
  unrelated device persona going forward. This does not touch your blocking
  stats or allowlist — those are separate keys — but it breaks the link between
  your past and future persona at every site.

## The website

This policy covers two different things and they have two different answers.

**The extension collects nothing** — there is no endpoint for it to send anything
to, which is the section above.

**The website is hosted by someone else, and that is not nothing.** The pages at
`https://zjheepfixer.github.io/nullecho/` are served by GitHub Pages. They carry no
analytics script, no tracking pixel, no embedded font, no CDN asset, no iframe, and
no form — a page load fetches the HTML document and nothing else, which is
verifiable from your own browser's network panel. But GitHub, as the host, keeps
server logs. GitHub's own documentation says so:

> "When a GitHub Pages site is visited, the visitor's IP address is logged and
> stored for security purposes, regardless of whether the visitor has signed into
> GitHub or not."

GitHub's CDN provider sees the same requests. We neither receive, request, nor have
access to those logs, and there is no account through which we could. "The pages
collect nothing" is true of the pages; it is not true of the hosting, and saying
only the first half would be the kind of claim this project exists not to make.

## Chrome Web Store "Limited Use" disclosure

Google's Limited Use policy governs data obtained *through a Google API*. Nullecho
calls no Google API and requests no Google OAuth scope, so there is no such data to
disclose. The Chrome Web Store's Limited Use certification is a **required
dashboard checkbox set at submission time**, not prose written here — every item
must provide the data-collection disclosures and the Limited Use certification in
order to be published or updated. The certification we make there is the one this
document describes: nothing is collected and nothing is transmitted.

Chrome's Handling Requirements ask that user data be transmitted with modern
cryptography. Nullecho transmits no user data at all, so the requirement has
nothing to attach to.

## Contact

There is no support mailbox. Both channels are on the public repository, which is
the same place the source and the git history live:

- **Questions, bugs, site breakage:** <https://github.com/ZJHeepfixer/nullecho/issues>
- **Security or privacy findings that should not be public first:**
  <https://github.com/ZJHeepfixer/nullecho/security/advisories/new>

`[JASON: developer-account email — set in the Chrome Web Store / AMO dashboard, not
here. Both stores ask for a contact email on the developer account; that field is
the right home for it, and it does not need to be published in this document.]`

This policy is published at
<https://zjheepfixer.github.io/nullecho/privacy/>, which is the URL given as the
privacy-policy link on both store listings.
