# Nullecho — extension

Manifest V3. Chrome and Firefox from one source tree, two manifests. Design
rationale: `../docs/ARCHITECTURE.md` and `../docs/DECISIONS.md`. What Nullecho
does and does not defend against: `../docs/THREAT-MODEL.md` — every user-facing
string in `popup/` and `options/` is written against its copy rules.
Permission-by-permission justification: `PERMISSIONS.md`.

> Pre-release. Loads and runs in real Chrome 151 (verified — see
> `../docs/RELEASE-READINESS-2026-09-16.md`), but the breakage suite and
> several review findings are still open; check that file for ship-readiness.

---

## Layout

| Path | What's there |
|---|---|
| `manifest.json`, `manifest.firefox.json` | The two manifests — permission lists, ruleset registrations, content-script declarations identical in substance |
| `src/background.js` | Service worker: identity/salt, settings, allowlist, stats, wires `heuristics.js` and `gpc.js` |
| `src/shim-loader.js`, `src/shim.js` | The fingerprint-defense pair — ISOLATED-world bridge and MAIN-world patch, document_start |
| `src/gpc.js` | Global Privacy Control — dual role: SW module *and* a statically declared MAIN-world content script |
| `src/heuristics.js` | Passive three-strike tracker observer (`webRequest`, observation only) |
| `src/allowlist.js`, `src/linkage.js` | Per-site off-switch domain list; tracker-domain → company name lookup for the UI |
| `src/personas.js`, `src/persona-validator.js`, `src/suffixes.js` | The persona pool and its consistency invariants; public-suffix logic |
| `src/protocol.js` | Shared message/event constants and classification helpers, used by both the extension and its tests |
| `rules/*.json` | Static DNR rulesets — see `rules/README.md` for the id-range table |
| `rules/gen-ua.mjs` | Generator for the three per-OS-family UA/Client-Hint rulesets — **build artifact, not source of truth** |
| `tools/gen-suffix-mirror.mjs` | Generator that mirrors `src/suffixes.js` into a block inside `src/shim.js` |
| `popup/`, `options/` | The two UI surfaces; fall back to demo fixtures when there's no `chrome.runtime.id` (i.e. loaded standalone) |
| `icons/` | 16/32/48/128, wired into both manifests |

## Loading it unpacked

1. `chrome://extensions` → turn on **Developer mode**.
2. **Load unpacked** → select this `ext/` directory.
3. Pin Nullecho to the toolbar.

Reload from that page after any change to `src/background.js`, a manifest, or a
rules file. Popup/options changes just need the popup reopened / page
refreshed. The service-worker link on the extension card opens its console —
`[nullecho]` background logs land there; content-script/shim logs go to the
page's own console.

Debugging note: `declarativeNetRequest.onRuleMatchedDebug` only fires unpacked,
so the popup's per-domain blocked list is fully populated only in a dev load —
a packed build falls back to a per-category count and says so in the UI.

Firefox: swap in `manifest.firefox.json` as `manifest.json`, then
`about:debugging#/runtime/this-firefox` → **Load Temporary Add-on…**. Requires
Firefox 140+. Differences between the two builds are tabulated in
`PERMISSIONS.md` ("Chrome vs Firefox") — the permission lists are identical;
what differs is tracker-attribution precision (Firefox's `webRequest` gives
per-domain attribution even when packed).

## Tests, validation, generators

Run from `ext/`:

```bash
npm test         # node --test — must be all-green; the count moves with every guard added
npm run validate  # node rules/validate.mjs — 182 static rules, 182 unique ids, 0 errors
```

`npm run validate` also checks the GPC exclude-list stays identical across
`rules/gpc.json` and both manifests, and that the three `ua-*.json` files match
what `gen-ua.mjs` would currently emit — hand-editing them recreates the exact
defect they exist to close (a header that disagrees with the JS persona).

Two generators, both idempotent — running them with nothing to change prints a
confirmation rather than rewriting silently:

```bash
node rules/gen-ua.mjs             # rewrites ua-win/mac/linux.json from src/personas.js + src/shim.js
node tools/gen-suffix-mirror.mjs  # "shim.js suffix mirror already current (104 suffixes)" when clean
```

Ran both here on 2026-09-16: `gen-ua.mjs` reports 15 personas covered with no
working-tree diff after; `gen-suffix-mirror.mjs` reports already current.

## The harness

`../harness/` is the fingerprint-measurement tooling (your real fingerprint
unprotected, the shim under test plus adversarial detectors, a breakage
battery). **It must be served from the project root, not from `ext/` or from
`harness/` itself** — the pages load `../ext/src/shim.js` by relative path, and
a server rooted anywhere else 404s that file, which silently turns the shim
test into a no-op:

```bash
cd .. && python3 -m http.server 4886
# http://localhost:4886/harness/index.html
# http://localhost:4886/harness/shim-test.html
# http://localhost:4886/harness/breakage-battery.html
```

A separate static preview of just this directory (for rendering `popup/` and
`options/` standalone against their demo fixtures) is configured as
`nullecho-ext` in the shared `launch.json`, rooted at `ext/` — not
`ext/options/` — since `popup.js`/`options.js` import `../src/protocol.js`.

## Standing rules for editing the shim

**D21 — no bare builtins after the capture block.** `src/shim.js` and the page
half of `src/gpc.js` capture every builtin they will ever call — constructors,
statics, prototype methods — into local constants at `document_start`, and
invoke them only through a boot-captured `Reflect.apply`. No `fn.call(...)`,
`fn.apply(...)`, or other prototype-method call after the `END CAPTURED
BUILTINS` marker in either file; `src/review-2026-09-16.test.js` lints this and
fails the suite on a violation. Reasoning: a page can redefine any prototype
method *after* boot, so anything resolved at call time rather than capture
time is a lookup on an object the page controls. History: `../docs/DECISIONS.md` D21.

**The suffix mirror is generated, not hand-edited.** `src/suffixes.js` is the
source of truth for the public-suffix / multi-label-suffix logic used to derive
`registrableDomain()`. `src/shim.js` needs its own copy inline (content scripts
can't import ES modules), so edit `src/suffixes.js` or `src/personas.js`, then
run `node tools/gen-suffix-mirror.mjs` to regenerate the mirror in `shim.js`.
`review-2026-09-16.test.js` (A4d) fails on any drift between the two.
