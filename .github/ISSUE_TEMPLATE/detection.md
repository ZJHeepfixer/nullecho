---
name: Detection / leak
about: A way to tell Nullecho is installed, or a fingerprint surface it misses
labels: detection
---

This project treats **detectability** and **fingerprint inconsistency** as security bugs.

**What you found:**
**How to reproduce it:** (code snippet if possible)
**Is it already documented?** Check `docs/THREAT-MODEL.md` — we list known gaps there
(CSS `@media` display leak, WASM fingerprinting, IP/TLS, Web Workers, the HTML-parser child realm).
Nullecho is **detectable by design**: CreepJS, a third-party library, records 2 lying APIs against
our build, and both of them are our own canvas and audio noise. Those two are the defense, not a
bug — please don't file them. Anything CreepJS already reports is worth checking against a fresh
run before filing.

**Browser + OS + persona:**
