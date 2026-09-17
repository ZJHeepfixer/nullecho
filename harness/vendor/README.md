# Vendored third-party fingerprinting libraries

These are **not ours**. They are here so `harness/claim-verification.html` can point
real, commercial-grade fingerprinting code at `ext/src/shim.js` instead of pointing our
own probes at it — every verification before 2026-09-17 used our probes and our
detectors, which is circular.

**Nothing is hotlinked.** A CDN reference would make the harness (a) useless offline,
(b) unreproducible the moment the CDN ships a new build, and (c) a privacy leak in a
privacy tool's own test rig. Every byte is committed here, with the exact fetch command
and a SHA-256 so drift is visible.

| File | Upstream | Version | Licence | SHA-256 |
|---|---|---|---|---|
| `fingerprintjs-5.2.0.umd.min.js` | [fingerprintjs/fingerprintjs](https://github.com/fingerprintjs/fingerprintjs) | 5.2.0 | MIT | `a8de5ead580c42d2e2b01a5752aa08da510852230971aa18554d67cd5de5775b` |
| `clientjs-0.2.1.base.min.js` | [jackspirou/clientjs](https://github.com/jackspirou/clientjs) | 0.2.1 | Apache-2.0 | `4372c83fdb3fc2a44b777c05b005ee4a075a2ee99e41691a33631bc79a0a8acb` |
| `creepjs-2026-06-11.js` | [abrahamjuliot/creepjs](https://github.com/abrahamjuliot/creepjs) | `master` @ 2026-06-11 | MIT | `80f43f364bd973bc03cb5b82de033ce28b2bbb145cb04237632a46ef040a92be` |

Each library's licence text sits beside it as `<name>.LICENSE.txt`. All three permit
vendoring; MIT and Apache-2.0 both require the licence and copyright notice to travel
with the copy, which is what those files are for. **Nothing was substituted for
something weaker**: all three libraries the task asked for are here.

## How to re-fetch

```sh
# FingerprintJS — the open-source agent, not the paid Pro SDK
curl -sSL https://registry.npmjs.org/@fingerprintjs/fingerprintjs/-/fingerprintjs-5.2.0.tgz | tar xz -O package/dist/fp.umd.min.js > fingerprintjs-5.2.0.umd.min.js

# ClientJS — the "base" build (no Flash/Java detection, both long dead)
curl -sSL https://registry.npmjs.org/clientjs/-/clientjs-0.2.1.tgz | tar xz -O package/dist/client.base.min.js > clientjs-0.2.1.base.min.js

# CreepJS — no npm package; this is the built bundle the project serves from docs/
curl -sSL https://raw.githubusercontent.com/abrahamjuliot/creepjs/master/docs/creep.js > creepjs-2026-06-11.js
```

## Notes that change the reading, per library

### FingerprintJS 5.2.0 — the primary input

This is the one that matters: it computes a real `visitorId` the same way the
open-source agent does on any site that embeds it.

**⚠ `monitoring` defaults to `true`.** `FingerprintJS.load()` with no options fires a
`GET https://m1.openfpcdn.io/fingerprintjs/v<version>/npm-monitoring` on load. The
harness passes `{ monitoring: false }`. Without that the page is neither offline nor
reproducible, and a privacy tool's test rig would be phoning a fingerprinting vendor.
Verified as the only outbound request in the bundle.

The open-source agent is explicitly *weaker* than the paid Fingerprint Pro service
(upstream says so). It is still the correct instrument here: it is what a site that does
not pay gets, it is the most-embedded fingerprinting implementation in existence, and it
is auditable. A pass against it is not a pass against Pro, and this harness does not
claim one.

### ClientJS 0.2.1 — the independent second opinion

Present so one library's quirks cannot become the finding. It is an older, simpler
design: it collects a fixed list of signals and murmurhashes them into a 32-bit integer.
The `base` build is used because the full build probes Flash and Java, which no longer
exist and only add noise. Being older is a feature here — it leans harder on
`navigator`, plugins, screen and fonts, which is exactly the surface the shim claims.

### CreepJS (master, 2026-06-11) — the detectability oracle

Vendored because it is the one library built specifically to catch *lying*, which makes
it the outside test of our "it is detectable" clause. It reports a lie count, a "trash
bin" of impossible values, and a `resistance` block that tries to **name** the privacy
extension it thinks is running.

Practical notes, all verified by reading the bundle:

- It is **MIT** and it is a self-contained IIFE — vendorable, no build step.
- Its only `fetch()` is of **its own script URL**, to measure the script's size. That is
  same-origin here and works offline.
- It exposes `window.Fingerprint` and `window.Creep` when it finishes. It does **not**
  expose its own hash, so the harness reports a SHA-256 of `window.Creep` computed
  locally. That number is comparable run-to-run *within this harness* and is **not** the
  id creepjs.com would display.
- It patches a handful of DOM ids (`fingerprint-data`, `status-info`, …). Its `patch()`
  returns `null` for a missing element, so it cannot crash on their absence; the harness
  supplies them anyway, off-screen, so it takes its normal path.
- It assigns `window.OfflineAudioContext` and opens a WebRTC connection, so the harness
  always runs it **last**. Nothing should be measured after CreepJS in the same realm.
- 550 KB. That is the price of it being the only library that answers the detectability
  question, and it loads from disk.

## What is deliberately *not* here

- **Fingerprint Pro / any paid or key-gated SDK.** Not auditable, not offline, and
  running it would send this machine's fingerprint to a vendor.
- **`fpjs.js` from a CDN, `unpkg`, or `esm.sh`.** See above.
