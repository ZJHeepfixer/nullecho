# Security Policy

## Reporting

Found a way to defeat Nullecho's protections, detect it, or make it leak? Please open a GitHub issue.

This project treats **detectability** and **fingerprint inconsistency** as security bugs, not feature
requests. A persona that contradicts itself is worse than no protection at all — it trades
"identifiable" for "identifiable *and* flagged as evasive."

Especially wanted:
- A fingerprinting surface we don't cover
- A way to tell Nullecho is installed that isn't already in `docs/THREAT-MODEL.md`
- A cross-field contradiction in a persona (e.g. a claimed GPU impossible on the claimed OS)
- A site Nullecho breaks

## Known limitations (not bugs — documented)

See `docs/THREAT-MODEL.md`. In brief: it is detectable (2/10 adversarial detectors fire), it cannot
reach your IP or TLS fingerprint, CSS `@media` display features leak the real display (cross-origin
`cssRules` throws, so it is unreachable), and WASM-compiled fingerprinting can bypass JS-layer shims.

## Data collection

None. No telemetry, no phone-home, no account, no analytics. Enforced by a test that fails the build
if `fetch`/`XMLHttpRequest`/`sendBeacon`/`WebSocket` is added against a remote URL. The Firefox
manifest declares `data_collection_permissions: none`, which is a statement to AMO we intend to keep true.
