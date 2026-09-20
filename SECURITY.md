# Security Policy

## Reporting

Found a way to defeat Nullecho's protections, detect it, or make it leak?

- **Public, non-sensitive:** open an issue — <https://github.com/ZJHeepfixer/nullecho/issues>
- **Anything that would harm users before a fix ships:** report it privately —
  <https://github.com/ZJHeepfixer/nullecho/security/advisories/new>

We aim to acknowledge a report within 72 hours and to ship or publicly document a fix within 30
days. If the finding would expose users in the meantime, we will say so in the advisory rather than
sit on it until the fix is ready.

This project treats **detectability** and **fingerprint inconsistency** as security bugs, not feature
requests. A persona that contradicts itself is worse than no protection at all — it trades
"identifiable" for "identifiable *and* flagged as evasive."

Especially wanted:
- A fingerprinting surface we don't cover
- A way to tell Nullecho is installed that isn't already in `docs/THREAT-MODEL.md`
- A cross-field contradiction in a persona (e.g. a claimed GPU impossible on the claimed OS)
- A site Nullecho breaks

## Known limitations (not bugs — documented)

See `docs/THREAT-MODEL.md`. In brief:

- **It is detectable, by design.** Measured with CreepJS — a third-party library, not our own test
  suite — our build produces **2 lying API records**, and both are the canvas and audio noise that
  is the defense itself. The same library recorded 199 and a **bot** verdict before 2026-09-19.
- **The fingerprint join** breaks for trackers that hash the signals we cover — verified against
  FingerprintJS and ClientJS — and does **not** break for a lie-aware library that discards spoofed
  values and keys on what is left. CreepJS re-joins our personas into one identity.
- It cannot reach your IP or TLS fingerprint, CSS `@media` display features leak the real display
  (cross-origin `cssRules` throws, so it is unreachable), and WASM-compiled fingerprinting can
  bypass JS-layer shims.

## Data collection

None. No telemetry, no phone-home, no account, no analytics. Enforced by a test that fails the build
if `fetch`/`XMLHttpRequest`/`sendBeacon`/`WebSocket` is added against a remote URL. The Firefox
manifest declares `data_collection_permissions: none`, which is a statement to AMO we intend to keep true.

## Ownership

**This project will not be sold or transferred to a new owner.** Every documented
browser-extension hijack in this category — Nano Adblocker, The Great Suspender, Cyberhaven — took
the name, the store listing, or the developer account, not the source. If you ever see "Nullecho"
published by someone else, or this repository transferred, treat it as compromised and check the
git history; provenance is public and timestamped. The reasoning is in
[`README.md`](README.md#on-copying-and-on-trust).
