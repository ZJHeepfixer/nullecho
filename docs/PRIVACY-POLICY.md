# Nullecho — privacy policy

**Effective date:** 2026-09-16

Nullecho is a browser extension. This policy describes what it does, what data it
touches, and where that data goes. Every claim below was checked against the
source in `ext/` on 2026-09-16, not asserted from memory — see the grep citations.

## What Nullecho does

Nullecho blocks trackers (ads, analytics, social pixels, known fingerprinting
vendors), sends the legally-recognized Global Privacy Control signal, shows each
site a different but internally-consistent device profile so sites can't join
your activity together by fingerprint, and offers a Checkout Report plus a
guided link to California's data-broker deletion platform (DROP). Full detail on
what this does and does not protect against: [`THREAT-MODEL.md`](THREAT-MODEL.md).

## Data collected: none

Nullecho has no server, no account, no sign-in, no telemetry, no analytics, and
no crash reporting — it does not send a single byte about you or your browsing
to anyone, ever.

**How we know this, not just claim it:** grepping the shipped extension source
(`ext/src/`, `ext/popup/`, `ext/options/`) for every way a web page or extension
can reach the network finds exactly two `fetch()` calls in the whole codebase:

```
ext/src/background.js:97   fetch(chrome.runtime.getURL('rules/fingerprinting.json'))
ext/src/gpc.js:322         fetch(chrome.runtime.getURL(RULESET_PATH))
```

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

Everything Nullecho stores lives only in `chrome.storage.local` — a private,
per-browser-profile store on your own machine that Chrome and Firefox delete
automatically when you uninstall the extension. Nothing is synced to your Google
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

## Chrome Web Store "Limited Use" disclosure

Google's Limited Use policy governs data obtained *through a Google API*.
Nullecho does not call any Google API and does not request any Google OAuth
scope, so there is no such data to disclose. `[VERIFY: confirm with the current
Chrome Web Store submission form whether a Limited Use statement is still
required to be shown even when not applicable, and if so, add the store's exact
required wording here rather than paraphrasing it.]`

## Contact

`[VERIFY: no support email or contact address exists yet anywhere in this repo —
add one before submitting to any store; Chrome Web Store requires a working
contact method on the listing. This policy also needs a stable, permanent URL to
link from the listing — getnullecho.com / nullecho.app are unregistered per
docs/RELEASE-READINESS-2026-09-16.md §4, so host this file there, or at a GitHub
Pages / raw-GitHub URL, before submission.]`
