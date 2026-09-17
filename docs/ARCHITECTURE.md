# Nullecho — architecture

Status: design locked for v0.1, 2026-08-20.
Baseline measurements: `research/BASELINE.md`. Harness: `harness/`.

---

## The core problem

Two defenses exist against fingerprinting, and they pull in opposite directions:

- **Uniformity** (Tor): make everyone identical. Provably works — Tor Browser sits under 5%
  uniqueness vs ~83% for stock Chrome. Costs: breaks sites, requires a custom browser build,
  and you are visibly "a Tor user."
- **Randomization** (Brave-style farbling): make each read different. Ships in a normal browser,
  doesn't announce itself. But done naively it makes things *worse*.

Naive randomization fails three ways, all documented:

1. **Cross-field contradiction.** A Chrome/Windows UA next to an Apple GPU string next to
   `hardwareConcurrency: 3` is not a real machine. Fraud-detection vendors already cross-reference
   5–6 signal layers and flag the mismatch. You've traded "identifiable" for "identifiable *and*
   flagged as evasive."
2. **Instability as signal.** If values change on every page load, the *pattern of variance*
   becomes the fingerprint. You are now the only visitor whose GPU changes every refresh.
3. **Averaging attacks.** Per-read noise is recoverable: sample the canvas 50 times, average,
   the noise cancels and the true value surfaces. Demonstrated against Brave in 2025.

## The design: per-origin stable personas

Nullecho's answer is a middle path — randomize, but at the granularity of a **persona**, not a field.

```
seed = HMAC(session_salt, eTLD+1)
persona = pick_from_pool(seed)      # a whole coherent machine, not loose values
noise   = derive_noise(seed, digest(content))   # canvas/audio/webgl jitter, deterministic per content (D22)
```

Three properties fall out of that one line:

| Property | Why it matters |
|---|---|
| **Different per origin** | site A and site B see different machines → cross-site linking broken. This is the actual threat. |
| **Stable within origin + session** | no instability signal, no averaging attack, no site breakage from values shifting mid-visit. |
| **Rotates with `session_salt`** | user-controlled reset (and periodic auto-rotate) breaks long-term linkage at a site. |

The realization worth stating plainly: **you do not need to be unlinkable to a site you are
actively using.** That site can set a cookie. The goal is to break linkage *between* sites — so
per-origin stability costs nothing and buys enormous compatibility.

## Personas are drawn from a population, not generated randomly

This is where uniformity and randomization reconcile.

A randomly generated machine is unique — and therefore useless. Nullecho instead ships a curated pool
of **high-population, internally consistent real-world configurations**:

```jsonc
{
  "id": "win11-chrome-rtx3060",
  "platform": "Win32",
  "ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) …Chrome/151.0.0.0…",
  "uaData": { "platform": "Windows", "platformVersion": "15.0.0", "architecture": "x86", "bitness": "64" },
  "gpu": { "vendor": "Google Inc. (NVIDIA)",
           "renderer": "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)" },
  "cores": 8, "memory": 8,
  "screen": { "w": 1920, "h": 1080, "dpr": 1, "colorDepth": 24 },
  "fonts": "windows-11-default",
  "timing": { "resolutionUs": 100 }
}
```

Every field is consistent with every other field, because they were copied from a real class of
machine that millions of people own. The goal is not "unique fake" — it is **"indistinguishable
from a large crowd."** Tor's insight, delivered without Tor's compatibility cost.

Pool invariants, enforced by test:
- GPU vendor must match platform (no Apple renderer on Win32).
- `cores`/`memory` must be a pair that ships together in real hardware.
- Font set must be the OS default set for the claimed platform.
- Client Hints must agree with the UA string, field by field.
- `colorDepth: 30` (HDR) is deliberately **excluded** — too rare, it re-identifies.

## Layers

```
┌─ 1. Network blocking ────────────────────────────────────────┐
│  BOTH:    declarativeNetRequest static + dynamic rulesets    │
│  + passive heuristic observer (Privacy-Badger-style 3-strike)│
│    — non-blocking webRequest, both platforms                 │
└──────────────────────────────────────────────────────────────┘
┌─ 2. Fingerprint defense (MAIN world, document_start) ────────┐
│  persona shim:  navigator / screen / Intl / userAgentData    │
│  noise shim:    canvas / webgl / webgpu / audio / fonts      │
│  guard:         read-counter + rate limiter per origin       │
└──────────────────────────────────────────────────────────────┘
┌─ 3. Profile hygiene (opt-in) ────────────────────────────────┐
│  GPC signal, storage-partition hygiene, tracker-ID rotation  │
│  ── decoy-click injection: NOT SHIPPED, see DECISIONS.md ──  │
└──────────────────────────────────────────────────────────────┘
```

**Correction, 2026-08-21.** This diagram used to read *"Firefox: blocking webRequest
(retained; strictly better)"*, and `ext/README.md` carried the same implication. Firefox
did retain blocking `webRequest` — but **Nullecho does not request `webRequestBlocking` on
either platform and does not use it**, so the claim was true of Firefox and false of the
artifact. Blocking behaviour is identical on both builds: every block is a DNR rule the
browser evaluates, which is also why a bug in the heuristic observer cannot hang a request.
The reasoning is in `ext/PERMISSIONS.md`, which was already correct; the diagram was not.
`ext/src/manifest.test.js` now fails if either manifest requests the permission or if
`heuristics.js` registers a `['blocking']` listener, so the two cannot drift apart again.
If the capability is ever taken up, `PERMISSIONS.md` requires saying in the UI that the
Firefox build blocks something the Chrome build does not.

### Layer 2 mechanics

MV3 killed easy inline injection but **not** page-context patching. The route is a
`content_scripts` entry (or `chrome.scripting.registerContentScripts`) with `"world": "MAIN"` and
`"run_at": "document_start"`. The isolated content-script world cannot touch page `window`, so
MAIN world is mandatory here.

**Known hazard:** Chrome has an open timing bug where MAIN-world injection can land after
`DOMContentLoaded`, losing the race against scripts that fingerprint on load. Mitigations, in order:
1. Static `content_scripts` manifest declaration (earliest available hook) rather than dynamic
   `executeScript`.
2. Ship a test that fingerprints in an inline `<script>` in `<head>` and asserts the shim won.
3. If the race is lost, **fail loud in dev** — a silently-unpatched API is the worst outcome,
   since the user believes they are protected. (This is the "grep proves source, rendering proves
   reality" rule applied to shims.)

**Guard sub-layer.** Every shimmed read increments a per-origin counter. A page that reads the
canvas 40 times in 200 ms is running an averaging attack, not rendering a UI. Response: keep
returning the *same* noised value (which we do anyway) and surface the event in the UI as a
detected fingerprinting attempt. Detection is also a feature — users want to see who tried.

## Compatibility posture

Anti-fingerprinting that breaks sites gets uninstalled, and an uninstalled extension protects
no one. Firefox's own `resistFingerprinting` is shipped as advanced-users-only for this reason.

- Per-origin allowlist, one click from the toolbar.
- Never spoof `deviceMemory`/`cores` to values that break WASM thread-pool sizing — clamp to
  plausible-and-safe (4/8, never 1).
- Canvas noise must be **sub-perceptual**: ±1-2 LSB on R/G/B (never alpha — it compounds across
  draws and hit-testing reads it), never on geometry. A visibly corrupted canvas breaks charts and
  games. And it must be **keyed on the content** it perturbs, or a page learns the pattern from a
  uniform fill and subtracts it from the real canvas (D22).
- Site-breakage triage doc before public release.

## Explicit non-goals

Stated up front so the marketing copy can never overclaim:

- **TLS/JA3 fingerprinting** — unreachable from any WebExtension. Generated before page JS exists.
- **IP-address correlation** — needs a VPN/proxy, not an extension.
- **WASM-based fingerprinting** — a 2025 result ("The WASM Cloak") shows fingerprinting logic
  compiled to WASM can re-derive signals without touching the JS APIs we patch. Partial gap for
  every shim-based defense, ours included. Document it; don't pretend otherwise.
- **Defeating state-level surveillance** — different threat model entirely. Nullecho degrades
  *commercial* ad-tech profiling. It does nothing against bulk metadata collection, and the
  product copy must say so plainly rather than implying otherwise.

## Build order

1. `harness/` — done, baseline captured.
2. Persona pool + consistency validator (tests first — invariants are the whole product).
3. MAIN-world shim layer + injection-race test.
4. DNR blocking rulesets.
5. Heuristic observer.
6. UI: what was blocked, who tried to fingerprint you, persona reset.
7. Firefox build (fuller capability), then Chrome.
