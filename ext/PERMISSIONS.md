# Nullecho — permissions, and why each one is there

`manifest.json` has no comments, because it has to stay valid JSON for tooling.
This file is the comment.

The rule applied to every entry: **if the feature could ship without the
permission, the permission does not go in.** Over-requesting is a Chrome Web Store
review risk, but the bigger problem is that a privacy tool asking for more access
than it can account for has already lost the argument it exists to make.

---

## Requested

### `declarativeNetRequest`
Runs the five static blocking rulesets (`rules/ads.json`, `analytics`, `social`,
`fingerprinting`, `gpc`) and the dynamic per-site allowlist rules.

This is the *narrow* form on purpose. Nullecho does not request `webRequest` +
`webRequestBlocking` on Chrome: DNR rules are evaluated by the browser, so the
extension never sees the URL of a request it did not block. Less capability, less
data reaching us, and nothing lost — the blocklists are static rules.

### `declarativeNetRequestFeedback`
The only way to know *what* was blocked so the popup can say "47 requests blocked
on this site" instead of asserting a number it did not measure.

Honest note about what this actually buys, per browser:

| Build | What we can report |
|---|---|
| Chrome, **unpacked** (dev) | `onRuleMatchedDebug` fires with the request URL → real per-domain list. |
| Chrome, **packed** (store) | `onRuleMatchedDebug` does not fire. The popup falls back to `getMatchedRules()` — counts and category, no URLs — and **says so in the UI** rather than implying it has the domain list. |
| Firefox | `webRequest` (observation only, see below) gives precise attribution. |

### `storage`
`chrome.storage.local` holds: the session salt, the per-site allowlist, category
settings, and per-site counters. All of it local. Nullecho has no server, no account,
and no sync — `chrome.storage.sync` is deliberately not used, because syncing the
salt would push the master secret through a Google account.

### `alarms`
Optional automatic salt rotation (off by default). An hourly alarm checks whether
the configured interval has elapsed. Without `alarms` an MV3 service worker cannot
wake up to do this at all.

### `webRequest`
**Observation only. `webRequestBlocking` is not requested, and on Chrome it does
not exist any more.**

`src/heuristics.js` needs it. The Privacy-Badger-style three-strike observer has to
*watch* third-party requests to decide which domains are tracking across sites —
counting strikes is a judgement DNR cannot express, because a static rule has no
memory of the other sites a domain was seen on. Once the observer reaches a verdict
it writes a dynamic DNR rule; the blocking itself still happens in DNR.

Cost, stated plainly: this is the one permission that lets Nullecho see request URLs
it did not block. Nothing is transmitted — there is no network endpoint — but the
capability is real, and it is the reason `src/heuristics.js` keeps only aggregate
per-domain strike counts rather than a request log.

### Not `scripting`
Worth recording, because an earlier draft of this file requested it.

`src/gpc.js` briefly registered its MAIN-world content script with
`chrome.scripting.registerContentScripts`, so that `excludeMatches` could be
changed at runtime — per-site exceptions are the recovery path when
`navigator.globalPrivacyControl` breaks a site, and roughly 50 hosts (USAA among
them) are known to misbehave. It now ships that exception list statically in
`exclude_matches` instead, and the permission is gone.

All three MAIN/ISOLATED content scripts are therefore **statically declared**, and
Nullecho cannot inject code into a page at runtime at all. Runtime-toggled per-site
GPC exceptions are handled by the DNR side and by the script standing down, not by
re-registration.

### `host_permissions: ["<all_urls>"]`
The one large ask. Three things need it and none of them can be scoped down:

1. **GPC header injection.** DNR `modifyHeaders` rules require host permission for
   the request being modified. `Sec-GPC: 1` is only meaningful if it is sent
   everywhere — a do-not-sell signal you send to a curated subset of sites is not
   a signal.
2. **The fingerprint shim** has to run on every site, because "the site I forgot to
   add to the list" is exactly the site that fingerprints you.
3. **Per-site reporting.** Reading the active tab's URL in the popup, and matching
   blocked requests to the page that made them.

The content-script `matches: ["<all_urls>"]` already triggers Chrome's "read and
change all your data on all websites" warning, so this does not widen what the user
is shown — but it does widen what we are accountable for, which is why it is
listed here rather than buried.

---

## Deliberately NOT requested

| Not requested | Why we can do without it |
|---|---|
| `tabs` | The popup uses `tabs.query` for the active tab only, which `host_permissions` already covers. Background code learns a frame's origin from `sender.url` — the browser's own account of where a content script is running — and never from anything a page claims. |
| `webRequestBlocking` | Gone from Chrome MV3 anyway, but not requested on Firefox either. The heuristics observer only needs to *watch*; the blocking it decides on is written as a DNR rule. Keeping the blocking path in DNR means a bug in the observer cannot hang a request. |
| `cookies` | Nullecho does not read, write, or clear cookies. Blocking happens at the request layer. |
| `history`, `bookmarks`, `downloads`, `management` | No feature needs them. |
| `unlimitedStorage` | Counter tables are bounded (`MAX_SITES`, `MAX_TRACKERS_PER_SITE` in `src/protocol.js`). |
| `identity`, any remote host | Nullecho has no backend. Nothing leaves the machine. |
| `chrome.userScripts` | Would let us register a MAIN-world script with the persona baked in ahead of navigation, fully closing the injection race — but it requires the user to enable developer mode or flip a per-extension "Allow User Scripts" toggle. Not acceptable as a default for a tool aimed at ordinary users. Kept on file as a power-user opt-in for v0.2. |

---

## Chrome vs Firefox

Two manifests, because the two can't be reconciled in one file. Differences and
the reason for each:

| | `manifest.json` (Chrome) | `manifest.firefox.json` |
|---|---|---|
| Background | `service_worker` + `type: module` | `scripts: [...]` + `type: module` — Firefox MV3 uses event pages, not service workers |
| `browser_specific_settings` | — | required: extension id + `strict_min_version: 140` + `data_collection_permissions` (see below) |
| Data-collection declaration | not a Chrome concept | `data_collection_permissions: { required: ["none"] }` — mandatory for new AMO submissions since 2025-11-03 |
| about:blank / srcdoc frames | `match_origin_as_fallback: true` | `match_about_blank: true` — Firefox does not implement the former |
| Host permissions | granted at install | Firefox MV3 treats them as opt-in; the user grants them from the extensions panel. **The extension must keep working, degraded, if they decline.** |
| Permission list | identical | identical |
| `content_scripts` | 3 entries, same order | 3 entries, same order |

The permission lists are the same on both, which is the outcome we want: no user
gets a capability the other platform's users are not also giving up.

⚠️ **The two manifests duplicate `src/gpc.js`'s `exclude_matches` list** (~50 hosts
where setting `navigator.globalPrivacyControl` breaks the site). There is no build
step to derive one from the other, so a host added to `manifest.json` must be added
to `manifest.firefox.json` by hand. If that list grows much further it should move
to a generated manifest.

### `data_collection_permissions` — why `none`, and how that is checked

Firefox requires every new AMO submission to declare what it collects. Nullecho
declares `{ "required": ["none"] }`, the strongest available claim: nothing is
collected, nothing is transmitted.

That is a claim made to a regulator-adjacent reviewer, so it is not left as prose.
`src/manifest.test.js` fails the build if any shipped source contains
`XMLHttpRequest`, `sendBeacon`, `WebSocket`, `EventSource`, `importScripts` or
`chrome.storage.sync`; if any `fetch()` argument is not `chrome.runtime.getURL(...)`;
or if any shipped file *loads* a remote URL rather than linking to one. As of
2026-08-21 exactly two `fetch` calls exist — `background.js` and `gpc.js` reading
bundled rulesets out of the extension package — and the only remote URLs are `href`
targets on the DROP page plus the CalPrivacy CSV that the broker list was snapshotted
from at build time, embedded precisely so that browsing it makes no request.

The floor moved from `strict_min_version: 128` to `140` for this: below 140 the
manifest key is not honoured and AMO requires a separate post-install consent
experience instead. 128 was the right floor for `world: "MAIN"` alone; 140 keeps
that satisfied.

### The capability that differs in Firefox — and that we do not take

Firefox kept **blocking `webRequest`**. Chrome removed it. That means Firefox
*could* express blocking rules DNR cannot — request-body inspection, per-request
dynamic decisions — while Chrome is limited to what a static rule can match.

Nullecho v0.1 deliberately does **not** use that. `webRequestBlocking` is not
requested on either platform, so blocking behaviour is identical across the two and
every block is a DNR rule the browser evaluates. The `webRequest` permission that
*is* requested is observation-only, and is used the same way on both platforms: to
let `src/heuristics.js` count cross-site appearances before it decides a domain is
a tracker.

⚠️ **This is the one place the project has over-claimed.** `docs/ARCHITECTURE.md`
and `ext/README.md` used to say or imply the Firefox build was strictly more capable
*because* Firefox retained blocking webRequest. True of Firefox; false of the
artifact. Both were corrected on 2026-08-21, and `src/manifest.test.js` now fails if
either manifest requests `webRequestBlocking` or if `heuristics.js` registers a
`['blocking']` listener — so the claim and the code can no longer drift apart
silently in either direction.

If a future rule genuinely cannot be expressed in DNR, that is the moment to
revisit — and to say plainly in the UI that the Firefox build blocks something the
Chrome build does not.

---

## Data handling, in one paragraph

Everything Nullecho stores is on the user's own machine in `chrome.storage.local`:
one random salt, a list of allowlisted domains, four category booleans, and a
counter table keyed by registrable domain. There is no network endpoint, no
telemetry, no analytics, no crash reporting, no account. The salt is never
transmitted anywhere — not to a server, not to `storage.sync`, and not even to the
extension's own content scripts (see the "Salt containment" note at the top of
`src/background.js`).
