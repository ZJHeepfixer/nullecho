# Nullecho — extension

Manifest V3. Chrome and Firefox from one source tree, two manifests.

Design rationale lives in `../docs/ARCHITECTURE.md` and `../docs/DECISIONS.md`;
what Nullecho does and does not defend against is `../docs/THREAT-MODEL.md`, and every
user-facing string in `popup/` and `options/` was written against its copy rules.
Permission-by-permission justification is in `PERMISSIONS.md`.

---

## Component status

| Path | Owner | Status |
|---|---|---|
| `manifest.json`, `manifest.firefox.json` | shell/UI | ✅ valid JSON, both variants, every referenced file present |
| `PERMISSIONS.md` | shell/UI | ✅ |
| `src/protocol.js` | shell/UI | ✅ shared message/event constants |
| `src/background.js` | shell/UI **+ blocking lane** | ✅ **merged file** — see §1/§2 markers in its header |
| `src/shim-loader.js` | shell/UI | ✅ ISOLATED-world bridge, race handling, fail-loud |
| `popup/` | shell/UI | ✅ **render-verified**, light + dark |
| `options/` | shell/UI | ✅ **render-verified**, light + dark |
| `icons/` | shell/UI | ✅ generated 16/32/48/128 |
| `src/personas.js`, `src/personas.test.js` | personas | ✅ unmodified by this lane |
| `src/shim.js` | shim lane | ✅ present, implements the handshake contract below |
| `src/gpc.js` | GPC lane | ✅ present; dual-role — SW module *and* statically declared MAIN-world content script |
| `rules/*.json` (5) + `rules/validate.mjs` | rules lane | ✅ 176 rules, ids 1000–5000, validator passes |
| `src/heuristics.js` | heuristics lane | ✅ present **and wired** into `background.js` |
| `src/allowlist.js`, `src/linkage.js` | blocking lane | ✅ present; not referenced by the shell |
| `src/persona-validator.js` | validator lane | ✅ present; test-time only, not manifest-referenced |
| `options/drop.html` | DROP lane | ✅ present; linked from the options page |

Everything the manifests name now exists, on both platforms. `node --test` passes
42/42 and `node rules/validate.mjs` reports all rulesets valid with unique ids.

### Note on `src/background.js` and `manifest.json`

Both are **shared between lanes** and were written concurrently from two
directions. `background.js` carries explicit `§1` (blocking + GPC) and `§2`
(identity, personas, UI state) section markers; keep additions inside the right
one. Two invariants the merge depends on:

- **One `chrome.runtime.onMessage` listener**, registered synchronously at module
  top level. A second `addListener` call is fine, but a listener added inside a
  promise callback is silently missed when Chrome respawns the worker.
- **`gpc.js` owns the `gpc` ruleset.** `applyRulesets()` deliberately does not
  touch it; the GPC toggle routes through `NullechoGPC.setEnabled()`. Two owners of
  one ruleset produces a setting that silently reverts.

---

## Loading it

### Chrome / Edge / Brave

1. `chrome://extensions`
2. Turn on **Developer mode** (top right).
3. **Load unpacked** → select this `ext/` directory.
4. Pin Nullecho to the toolbar so the popup is one click away.

Reload the extension from that page after any change to `src/background.js`,
`manifest.json`, or a rules file. Popup and options changes just need the popup
reopened / the page refreshed.

Debugging: the **service worker** link on the extension card opens its console —
that is where `[nullecho]` background logs land. Content-script and shim logs go to
the *page's* console, not that one.

> Run unpacked for development on purpose: `declarativeNetRequest.onRuleMatchedDebug`
> only fires for unpacked extensions, so the popup's blocked-**domain** list is
> only fully populated in a dev load. A packed build falls back to a per-category
> count and labels itself as doing so.

### Firefox

Firefox reads `manifest.json`, so the variant has to be swapped in:

```bash
cd ext
cp manifest.json manifest.chrome.json      # keep the Chrome one
cp manifest.firefox.json manifest.json
```

Then:

1. `about:debugging#/runtime/this-firefox`
2. **Load Temporary Add-on…** → pick any file inside `ext/` (e.g. `manifest.json`).
3. Firefox MV3 treats `host_permissions` as opt-in: open **Add-ons → Nullecho →
   Permissions** and grant "Access your data for all websites", or blocking and
   GPC stay off.

Requires **Firefox 140+**. `"world": "MAIN"` on a statically declared content
script — which the whole shim strategy depends on — landed in Firefox 128, but the
floor is 140 because that is where `browser_specific_settings.gecko.
data_collection_permissions` is honoured. That key has been mandatory for new AMO
submissions since 2025-11-03, and on 139-and-earlier the same obligation has to be
met with a separate, "unmissable" post-install consent screen instead. Nullecho
declares `"required": ["none"]` — it collects and transmits nothing — so one
manifest key replaces a whole consent UI. Restore `manifest.json` from
`manifest.chrome.json` when you switch back.

Differences between the two builds are tabulated in `PERMISSIONS.md`
("Chrome vs Firefox"). The short version: **the permission lists are identical**,
and so is blocking behaviour — every block is a DNR rule on both platforms. What
differs is *reporting*: Firefox's `webRequest` observation gives precise per-domain
attribution, while a packed Chrome build gets counts only, because
`onRuleMatchedDebug` does not fire outside developer mode.

Firefox does still have *blocking* `webRequest`, which Chrome removed. **Nullecho
does not request `webRequestBlocking` and does not use it** — so "the Firefox build
is more capable" is a statement about Firefox, not about this artifact, and the docs
that used to imply otherwise were corrected on 2026-08-21. If it is ever taken up,
the UI has to say that the Firefox build blocks something the Chrome build does not.

---

## Integration points for the other lanes

### `src/shim.js` — MAIN world, document_start

This is the contract `shim-loader.js` is written against. The long rationale is at
the top of `src/shim-loader.js`; the requirements are:

1. **Patch synchronously, before any `await`.** Derive a *fallback* persona from
   `location` plus a public build-time constant and install every patch with it.
   There must be no moment in which a target API is unpatched — a page that
   fingerprints in an inline `<head>` script must still get a fake, coherent
   machine. `src/personas.js` has the derivation (`personaFor`); content scripts
   cannot be ES modules, so inline what you need.

2. **Announce the boot** as the first observable act:
   ```js
   document.dispatchEvent(new CustomEvent('nullecho:status', {
     detail: JSON.stringify({ phase: 'boot' })
   }));
   ```
   The loader waits 3 s for this. Silence means the MAIN-world script never
   injected, and the loader reports that so the popup can say the page is
   unprotected instead of implying it is covered.

3. **Accept exactly one upgrade.** Read the persona from either channel — the
   loader writes both, because it cannot know which of you ran first:
   ```js
   const raw = document.documentElement.getAttribute('data-nullecho-boot'); // may be null
   document.addEventListener('nullecho:persona', onPersona, { once: true, capture: true });
   ```
   `detail` and the attribute are both a JSON **string**:
   ```jsonc
   { "ok": true, "enabled": true, "gpc": true, "site": "example.com", "persona": { … } }
   { "ok": false, "reason": "timeout" }          // fail loud, keep the fallback
   ```
   `persona` is the full object `personaFor()` returns, including `fontList` and
   the `noise` keys.

4. **Gate the upgrade on the read counter.** If any shimmed API has already been
   read, refuse the swap and stay on the fallback for the life of the document.
   Swapping mid-page would mix fields from two machines, which is the
   cross-field contradiction `DECISIONS.md` D2 identifies as *worse than no
   defense*. Then report it:
   ```js
   document.dispatchEvent(new CustomEvent('nullecho:status', { detail: JSON.stringify({
     upgraded: false, lockedToFallback: true, reason: 'read-before-handshake'
   })}));
   ```
   The popup surfaces this as "Profile not rotated on this load".

5. **`enabled: false` means stand down.** Restore the originals captured in step 1.
   Best-effort by construction — see "The allowlist gap" below.

6. **Report detections** for the guard sub-layer:
   ```js
   document.dispatchEvent(new CustomEvent('nullecho:detect', {
     detail: JSON.stringify({ api: 'canvas', count: 1 })
   }));
   ```
   `api` is a short key. The popup already has friendly labels for `canvas`,
   `webgl`, `webgpu`, `audio`, `fonts`, `screen`, `navigator`, `timing`,
   `storage`; anything else is displayed raw. Batch these — one event per read on
   an averaging attack is a lot of traffic.

The salt is **never** sent to the page. Only the persona for the origin the page
already sees crosses this boundary. Do not add a channel that carries the salt.

### `src/gpc.js` — dual role
One file, two contexts, guarded internally by a `typeof chrome` check:

- **Service-worker module.** `background.js` does `import './gpc.js'`, which
  defines `globalThis.NullechoGPC`. It owns the `gpc` ruleset (`Sec-GPC: 1`, rule id
  5000) and its per-site exception rules (dynamic ids 1 100 000+). Nothing else
  should enable or disable that ruleset.
- **MAIN-world content script**, its own third `content_scripts` entry, declared
  after `shim.js`. It sets `navigator.globalPrivacyControl`, with a shipped
  `exclude_matches` list of ~50 hosts the property is known to break.

That exclusion list is duplicated across `rules/gpc.json` (header) and both
manifests (JS property). There is no build step, but there *is* a check:
`node rules/validate.mjs` fails on any drift between the three, per manifest and
per host. Half a GPC signal is what breaks USAA, so the drift is worth catching
mechanically rather than by review.

### `rules/*.json`
Five static rulesets, ids `ads`, `analytics`, `social`, `fingerprinting`, `gpc`,
matching `declarative_net_request.rule_resources` in both manifests. Constraints
from the shell side:

- **Keep static rule ids below 900000.** Currently 1000–5000, comfortably clear.
- The allowlist uses `allowAllRequests` at priority `100000`. Any blocking rule at
  a higher priority would defeat the user's off switch.
- `rulesetId` is **not** enough to categorise a match. `onRuleMatchedDebug` and
  `getMatchedRules()` report every rule that acted on a request — blocks, `allow`
  exceptions and `modifyHeaders` alike — and never say which it was, and every
  runtime rule arrives under one synthetic id (`_dynamic`) whoever wrote it. So
  `classifyMatchedRule()` in `src/protocol.js` decides blocked / stripped /
  ignored from the rule **id**, and only blocking rulesets become user-visible
  category strings via `CATEGORY_LABELS`. `gpc` is not one of them: rule 5000
  sets a header on nearly every request, so counting it would report the page's
  whole request log as blocked.

Dynamic rule-id ranges, all disjoint and each owned by exactly one writer:

| Range | Owner |
|---|---|
| 1 000 – 5 000 | static rulesets |
| 900 000 – 900 999 | per-site allowlist (`ALLOW_RULE_ID_BASE`, `background.js`) |
| 1 000 000 – 1 049 999 | heuristics block rules |
| 1 050 000 – 1 099 999 | heuristics cookie-block rules |
| 1 100 000 – 1 100 999 | GPC per-site exceptions |

Each writer removes only ids inside its own range, so concurrent
`updateDynamicRules()` calls from different layers cannot clobber each other.

### `src/heuristics.js` — wired
`background.js` calls `heuristics.install()` synchronously at module top level and
`heuristics.reconcile()` from `onInstalled`, and routes its four
`nullecho:heuristics:*` messages. It also supplies the shared `registrableDomain()`,
so the persona boundary and the tracker-attribution boundary are the same function
— two different notions of "site" in one extension would be a bug waiting to happen.

Still open: heuristic verdicts do **not** yet feed the popup's "requests blocked"
counter. `recordBlocked({ site, trackerDomain, category })` in `background.js` is
the hook; calling it when the observer decides to block would make the popup count
heuristic blocks alongside static-rule blocks.

### `options/drop.html`
The options page links to it with `chrome.runtime.getURL('options/drop.html')`
(and a relative `drop.html` fallback for static preview). If the DROP flow ends up
at `ext/drop/index.html` instead, change the one `href`/`getURL` pair in
`options/options.js` and `options/options.html`.

---

## Two things that are not fully solved

### The injection race
`ARCHITECTURE.md` and `THREAT-MODEL.md` both flag the Chrome bug where MAIN-world
injection can land after `DOMContentLoaded`. The mitigation here is static manifest
declaration (earliest reliable hook, and the reason `chrome.scripting` is not in the
permission list) plus the two-stage persona above: **there is no unpatched window**,
only a window in which the persona is the un-rotated fallback. That case is
detected, reported to the service worker, and shown in the popup. It never fails
silently.

Residual risks R1–R4 are enumerated in the header comment of `src/shim-loader.js`.
The one that still wants a test is R1: a page that fingerprints from an inline
`<script>` in `<head>`, asserting the shim won. That test is the shim lane's item 2
in `ARCHITECTURE.md`'s build order and has not been written.

### The allowlist gap
Turning Nullecho off for a site disables blocking **immediately** — the allowlist is
mirrored into dynamic `allowAllRequests` DNR rules. The fingerprint shim is a
different story: a statically declared content script cannot be un-declared at
runtime, so on an allowlisted site the shim loads, patches, and then restores the
originals a few milliseconds later when the handshake tells it to stand down.

For the usual reason someone allowlists a site — something broke, and breakage
happens after DOM ready — this works. For a site that fingerprints in `<head>` it
does not. The honest fix is `chrome.scripting.registerContentScripts` with
`excludeMatches`, re-registered on every allowlist change; that trades the
`scripting` permission (and the dynamic-injection timing bug) for closing this gap,
which is not obviously the right trade and has not been made.

---

## What has actually been verified

Verified by rendering, not by reading the source:

- `manifest.json` and `manifest.firefox.json` parse as valid JSON, and **every one
  of the 14 files each references exists on disk** (checked programmatically, both
  variants).
- All JS files pass a syntax check (`node --check`, module and classic as
  appropriate).
- The three protocol strings that couple `protocol.js`, `shim-loader.js` and
  `shim.js` (`nullecho:persona`, `nullecho:detect`, `nullecho:status`) plus `data-nullecho-boot`
  appear in all three files — the duplicated literals have not drifted.
- `node --test` passes 111/111; `node rules/validate.mjs` reports 176 rules with
  unique ids across five rulesets.
- `popup/popup.html` renders at 360 px in **dark and light**, with: live counters,
  the persona card, both disclosure lists, the two-step "New identity" button, the
  per-site switch, and the footer scope statement.
- The popup's three conditional states render: site **off** (persona dimmed, copy
  swaps to "Nullecho is off here"), **"Profile not rotated on this load"**, and
  **"The device shim did not start on this page"**.
- `options/options.html` renders in **dark and light** with all seven sections:
  totals, identity, blocking toggles, the sites table (including a dimmed
  allowlisted row), allowlist chips, the profile-pool table, the DROP card, and
  the limits grid.
- No console errors on either page.
- `personaFor()` returns different personas for different origins from one salt.

**Not verified** — and it cannot be, from here:

- **The extension has never been loaded in Chrome or Firefox.**
  `chrome://extensions` is not reachable from this environment. Every file the
  manifest names now exists, so a load is finally possible — nobody has done it.
- No message has been passed between a real content script and a real service
  worker. `src/background.js` and `src/shim-loader.js` are **unexercised at
  runtime** — syntax-checked, cross-checked against `shim.js`, and reviewed;
  nothing more.
- The ISOLATED-before-MAIN content-script ordering the loader relies on is
  documented behaviour, but has not been observed here. If it does not hold, the
  `data-nullecho-boot` attribute is the fallback path that saves it — also untested.
- No DNR rule has ever matched *in a browser*, so `onRuleMatchedDebug` and
  `getMatchedRules` are untested against a real page. What the counters do with a
  match is now covered: `src/background.test.js` drives the real listeners over
  stubbed DNR events, and `src/protocol.test.js` checks the classification
  against the shipped rulesets. Neither proves Chrome fires the events at all.
- Both UI pages were driven from their demo fixtures, not from live extension
  state. The fixtures mirror the message shapes `background.js` returns, but that
  correspondence is by inspection, not by test.
- `background.js` was assembled from two lanes' concurrent edits. The merge is
  reviewed but not executed; the `heuristics.install()` /
  `globalThis.NullechoGPC.init()` / `ready()` startup sequence in particular has never
  run.

**First thing to do next:** load it unpacked in Chrome, open the service-worker
console, and check that startup is clean. That single step converts most of this
list.

Per this project's own standing rule — grep proves source, only rendering proves
what users see — treat everything in the second list as unproven.

## Preview server

`nullecho-ext` in `~/bodybuilding/.claude/launch.json` serves this directory on
port 4884. It is rooted at `ext/`, **not** `ext/options/`, because `popup.js` and
`options.js` import `../src/protocol.js`.

```
http://localhost:4884/popup/popup.html
http://localhost:4884/options/options.html
```

Both fall back to demo fixtures when `chrome.runtime.id` is absent, so they render
standalone. That fallback is unreachable inside a packed extension.
