# Nullecho — privacy policy

**Effective date:** 2026-10-14 (Nullecho 0.9.2)

Nullecho is a browser extension for **Chrome, Microsoft Edge and Firefox** — the
same code runs in all three, and this policy covers all three. It describes what
the extension does, what data it touches, and where that data goes. It also covers
the project's **website**, which is a separate thing with a separate answer — see
"The website" below. Every claim about the extension was checked against the
source in `ext/` on 2026-10-14, not asserted from memory — see the grep citations.

## What Nullecho does

Nullecho blocks trackers (ads, analytics, social pixels, known fingerprinting
vendors), sends the Global Privacy Control signal, shows each site a different but
internally-consistent device profile, points out when a shopping page has
displayed one of the algorithmic-pricing sentences a U.S. state mandates, and
offers a guided link to California's data-broker deletion platform (DROP).

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
ext/src/background.js   fetch(chrome.runtime.getURL(`rules/${id}.json`))
ext/src/gpc.js          fetch(chrome.runtime.getURL(RULESET_PATH))
```

(Deliberately cited by file and expression rather than by line number — line numbers
in a published policy rot silently. At commit `33dfefa` they are `background.js:97`
and `gpc.js:349`; the test below is what actually holds the claim.)

Both read a JSON file bundled *inside* the extension package — `chrome.runtime.getURL(...)`
resolves to `chrome-extension://…` (in Firefox, `moz-extension://…`), never a remote host. There is no other `fetch`,
`XMLHttpRequest`, `navigator.sendBeacon`, `WebSocket`, `EventSource`, or
`importScripts` anywhere in the shipped source — enforced by an automated test
(`ext/src/manifest.test.js`) that fails the build if any of those appear, or if a
`fetch()` argument is not a bundled-file `chrome.runtime.getURL(...)`.

"Analytics" and "telemetry" do appear in the source — as the *category label for
third-party trackers Nullecho blocks* (Google Analytics, Mixpanel, etc.) and in a
lookup table (`ext/src/linkage.js`) that names which company a blocked domain
belongs to, shown only to you, locally. None of that data leaves your device.

## Data stored locally

Nullecho keeps what it stores in three places, all inside your browser profile on
your own machine, and Chrome, Microsoft Edge and Firefox delete all three
automatically when you uninstall the extension. Nothing is synced to your Google,
Microsoft or Mozilla account: `storage.sync` is never used, and the same
build-failing test above fails the build if `storage.sync` appears in any shipped
file. (One honest footnote, because the list below is presented as a grep result
and a grep for `localStorage` finds something: `ext/options/drop.js:83-105` falls
back to `localStorage` when the DROP page is opened *outside* the extension — local
development only. In a packed install `chrome.storage.local` always exists, so
that path never runs.)

**1. `chrome.storage.local`** (in Firefox, the same store under
`browser.storage.local`). Grepping every `storage.local.set` call in the source
gives this exact list:

| Key | What it holds |
|---|---|
| `identity` | A random salt — it decides which device profile each site sees — and when it was last rotated. The salt itself is never shown or sent anywhere; the popup and settings page show only a six-character tag derived from it (`publicIdentity()`). |
| `settings` | Which tracker categories you block, whether GPC is on, whether you said you live in California (it only decides whether the DROP step is suggested), the salt auto-rotation interval, and loud-failure logging (`DEFAULT_SETTINGS` in `ext/src/protocol.js`) |
| `allowlist` | Sites where you've turned Nullecho off |
| `stats` | One entry per site whose pages — or frames embedded in a page — you load, by site name (e.g. `example.com`), never a page address: when it was last seen, how many fingerprinting reads were seen and of which kind, which device profile the site was shown, whether the page-world script started properly, and how many requests were blocked and to which tracker domains (in a store install, taken from the browser's own report that an extension cancelled a request, and counted only when one of Nullecho's own rules covers it). Requests that went through with their cookies removed are counted only in unpacked developer builds of Chrome and Edge, the one place the browser reports them. (`ext/src/block-counter.js`, DECISIONS.md D55) At most 500 sites (when the list is full, the least recently visited tenth is dropped) and 60 tracker domains per site (`MAX_SITES`, `MAX_TRACKERS_PER_SITE`). |
| `nullecho:heuristics:v1` | The tracker learner. For each third-party domain seen setting or sending an identifying cookie: the names of the sites it was seen on, whether it has been learned as a tracker (three different sites), and when it was first and last seen. It keeps domain names, never a cookie's value. |
| `nullecho:gpc:v1` | Sites where you've manually excepted the GPC signal because it broke something |
| `nullecho.drop.residency`, `nullecho.drop.submittedAt` | Your California-residency answer and a date you typed, only if you use the DROP guide. Deliberately excludes name, birthdate, ZIP, or the state's deletion-request ID — those live only on California's own site, which Nullecho links to (`ext/options/drop.js`). |
| `pricingObservations` | Pages that displayed one of the two algorithmic-pricing sentences a U.S. state mandates **and** published a machine-readable price. Per entry: the site, the page address **with its query string removed**, the time, which state's wording it was, the price and currency the page published, and up to 200 characters of the page's own text around the sentence. Capped at 200 entries, oldest dropped first. Written only by the block marked `§3` at the end of `ext/src/background.js`, which is the one writer of this key. |

**What that adds up to, plainly.** `stats` and the tracker learner are, between
them, a list of the sites you have loaded — by site name, with when each was last
seen — and `pricingObservations` holds a page address and a short excerpt of page
text for each of the (rare) pages it describes. All of it stays in this browser
profile on this machine.

**One key holds page text, so it gets its own paragraph.** `pricingObservations`
stores a short excerpt of what a shopping page displayed — deliberately, because
the point of the feature is to hand you a record you could give to a state
Attorney General's office if you ever wanted to.

- **What is stored, and when.** Nothing, on almost every page. A page is recorded
  only if it shows one of the two sentences — New York's *"this price was set by an
  algorithm using your personal data"* or Connecticut's *"this price was increased
  using your personal data"* — **and** publishes a price in structured product data
  (`pricing-scan.js` returns before storing anything otherwise). The check runs on
  the top-level page in Chrome, Edge and Firefox alike, once when the page has
  loaded and once about three seconds later. Query strings are stripped before
  anything is written (`urlWithoutQuery()`), because that is where carts, sessions
  and referral tokens live.
- **How long it is kept.** There is no time limit. An entry stays until there are
  more than 200 (`RECEIPT_CAP`), when the oldest is dropped, or until you uninstall
  the extension. Seeing the same page, wording and price again replaces the earlier
  entry instead of adding one (`pushReceipt()`). The settings page's **"Clear saved
  price notices"** button deletes them all (`onPricingForget`) and shows how many
  there were and how many are left (`onPricingCount`); uninstalling removes them too.
- **Whether it leaves your device.** It does not. There is no code in the shipped
  tree that could send it anywhere, and the build-failing test cited earlier is what
  holds that. The popup shows the latest entry for the site you are on and renders
  the exact receipt text before you copy it; "Copy receipt" is the only thing that
  ever moves one off the device's storage — into your own clipboard, by your own
  click.

**2. The browser's own rule list** (`declarativeNetRequest` dynamic rules).
Blocking and header changes are rules the browser itself applies, and three kinds
of rule that Nullecho adds hold domain names: the sites you turned Nullecho off on
(`syncAllowlistRules()`), the sites you turned GPC off on (`gpc.js`), and the tracker
domains the learner promoted (`heuristics.js`).

**3. `storage.session`** — memory only, never written to disk and never synced. One
key, `nullecho:tab-blocked`: for each open tab, how many requests Nullecho blocked on
the page in it, by category — numbers, no addresses. It is how the popup's "blocked on
this page" survives the background script being put to sleep. A tab's entry is
dropped when it loads a new page or closes, and all of it when the browser closes
(`background.js`, `TAB_TALLY_KEY`).

## Data shared: none

Nullecho has no backend to share data with. The permissions it requests let it
watch and modify requests *inside your own browser* — see below — none of them
involve sending anything to Nullecho or to any third party.

## Permissions, and why each is needed

Full reasoning: [`../ext/PERMISSIONS.md`](../ext/PERMISSIONS.md). Summary:

- **`declarativeNetRequest` / `declarativeNetRequestFeedback`** — the rules that
  block trackers, add the GPC header, strip cookies from some requests and remove
  some client-hint headers. The browser applies them itself. In Chrome and Edge the
  popup's per-tab count asks the browser which rules acted in the current tab
  (`getMatchedRules()`); in a store-installed build the browser answers with rule
  numbers, not request addresses. Firefox offers no such report (neither
  `getMatchedRules` nor `onRuleMatchedDebug` exists there as of Firefox 156); there
  the count comes from the `webRequest` report described next.
- **`storage`** — the local-only data above. **`alarms`** — wakes the background
  script to rotate your salt if you've turned that optional feature on.
- **`webRequest`** (observation only, not `webRequestBlocking`) — lets the tracker
  learner look at the requests your pages make: each request's address, the page
  that made it, the `Cookie` header sent and any `Set-Cookie` header returned. It
  ignores page loads themselves and first-party requests, it can't block anything
  itself, it keeps only what the learner's row above describes, and nothing it sees
  is ever transmitted anywhere. The same permission delivers the browser's report
  that an extension cancelled a request (`onErrorOccurred`) — Nullecho counts it as
  blocked only when one of its own rules covers it, keeping the site name and
  tracker domain shown in `stats` — and the start of each new page in a tab
  (`onSendHeaders`, top-level documents only), which resets that tab's count.
- **`host_permissions: ["<all_urls>"]`** — needed on every site so blocking, the
  GPC signal, the device-profile script and the price-disclosure check all work
  everywhere, not just a list you'd have to remember to maintain.

## How to delete everything

- **Uninstall the extension.** Chrome, Microsoft Edge and Firefox all delete an
  extension's `storage.local` data and the rules it added automatically on
  uninstall — there is nothing left behind, because there was never anywhere else
  for it to go.
- **Clear the site list without uninstalling.** "Clear site history" on the
  settings page empties `stats`. It does not touch the tracker learner or the
  price-disclosure observations.
- **Clear the price-disclosure observations.** "Clear saved price notices" on the
  settings page deletes every entry in `pricingObservations`.
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
`https://nullecho.org/` are served by GitHub Pages. They carry no
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
<https://nullecho.org/privacy/>, which is the privacy-policy link Nullecho gives
on its store listings.
