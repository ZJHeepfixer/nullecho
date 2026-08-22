# Nullecho

**A browser extension that blocks trackers, defends against fingerprinting, and collects nothing
about you — which is exactly why it ships a button that lets you measure whether it's working.**

> ⚠️ **Pre-release.** Loads and runs in Chrome 151, 196 tests passing, but breakage testing is
> incomplete and there are open release blockers (see [Status](#status)). Not yet published to any
> store. Don't rely on it as your only protection yet.

---

## Why this exists

Every privacy tool shows you a green shield and a number, and asks you to believe it. The one
category of software whose entire job is *not trusting things* is also the one that asks for the most
blind trust.

Nullecho collects nothing — no telemetry, no phone-home, no account, no analytics. That's verified
and enforced by a test that fails the build if a network call is ever added. The consequence is that
**we cannot tell you whether it's working, so the tool measures itself on your machine instead.**
Run your real fingerprint with protection off and on, side by side, on the page you're looking at.
We can't see the result either.

## What it does

- **Blocks trackers** — ads, analytics, social pixels, and commercial fingerprinting vendors
  (176 rules, sourced from DuckDuckGo Tracker Radar / EasyPrivacy / AdGuard, not invented).
- **Per-origin device personas** — each site sees a *different but internally consistent* machine
  drawn from a pool of real, high-population configurations. Site A and Site B can't join you.
- **Global Privacy Control** — legally enforceable in California and several other states.
- **Checkout Report** — what a shopping page contacted before it quoted you a price, and whether it
  carried the algorithmic-pricing disclosure NY/MD/CT law now requires.
- **DROP onboarding** (California) — walks you into the state platform that forces 600+ registered
  data brokers to delete you. The only feature here that *removes* data rather than obstructing
  collection.

## What it does NOT do

Stated up front, because a privacy tool that oversells is worse than none — you make real decisions
based on what it implies.

- **It is detectable.** 2 of 10 adversarial detection methods still fire against our own build.
- **Nothing about your IP address or TLS fingerprint.** Those are below the layer any extension can
  reach. If that's your threat model, you want a VPN or Tor.
- **Firefox's `resistFingerprinting` and Brave are genuinely stronger** at anti-fingerprinting —
  they operate below the JavaScript layer. Nullecho's honest niche is **Chrome**, where neither exists.
- **It will not get you lower prices.** The best controlled study found clearing your tracks yields
  the *worse* price more often than the better one. See [`research/SURVEILLANCE-PRICING.md`](research/SURVEILLANCE-PRICING.md).
- **It does nothing against state surveillance.** Different threat model entirely.

## The design idea: personas, not randomization

Naive randomization makes you **more** trackable. Randomize each signal independently and you produce
a machine that doesn't exist — a Chrome/Windows UA next to an Apple GPU next to 3 CPU cores. Fraud
vendors already cross-reference 5–6 signals and flag the contradiction. And a fingerprint that
changes every reload makes the *pattern of change* your identifier.

Nullecho picks **one internally consistent real-world machine per origin**, stable within a session,
matched to your host OS family (so engine-level signals don't contradict the claim). Different sites
see different ordinary machines. The join breaks; nothing looks anomalous.

Full reasoning: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`docs/DECISIONS.md`](docs/DECISIONS.md)
· [`docs/THREAT-MODEL.md`](docs/THREAT-MODEL.md)

## Install (development)

```bash
git clone <repo> && cd nullecho/ext
npm test          # 196 tests
```

Chrome: `chrome://extensions` → Developer mode → **Load unpacked** → select `ext/`.
Firefox: `about:debugging` → This Firefox → Load Temporary Add-on → select `ext/manifest.firefox.json`.

## Measure it yourself

```bash
cd nullecho && python3 -m http.server 4886
```

- `http://localhost:4886/harness/index.html` — your real fingerprint, unprotected
- `http://localhost:4886/harness/shim-test.html` — with protection, plus 10 adversarial detectors
- `http://localhost:4886/harness/breakage-battery.html` — does the shim break real workloads

## Status

| | |
|---|---|
| Tests | 196 passing |
| Loads in Chrome 151 | ✅ verified |
| reCAPTCHA / Google SSO | ✅ verified unbroken |
| Shim breakage battery | ✅ 0 failures |
| Full Tier A breakage suite | ⏳ incomplete |
| **Linux personas** | 🚫 **GPU renderer strings unverified on real hardware — release blocker** |
| Published to stores | ❌ not yet |

Open blockers: [`docs/BREAKAGE-TESTING.md`](docs/BREAKAGE-TESTING.md)

## Supporting this

Nullecho is free, MIT licensed, and collects nothing — including no revenue. There is no premium
tier, no account, no affiliate VPN deal, and no anonymized-data sale. Those are the obvious ways to
monetize a privacy tool and every one of them would undermine the reason to trust it.

If it's useful to you, GitHub Sponsors is the only channel. If it isn't, use it anyway.

## On copying, and on trust

This is MIT licensed. You may fork it, rename it, and ship it — that's deliberate. A privacy tool
nobody can audit gets distrusted on sight, and being auditable matters more here than being
exclusive.

**But note what actually goes wrong in this category.** Every documented browser-extension hijack —
Nano Adblocker, The Great Suspender, Cyberhaven — took the **name, the store listing, or the
developer account**. None of them were harmed by someone reading their source. So:

- **This project will not be sold or transferred to a new owner.** The most common way a trusted
  extension turns malicious is an acquisition followed by a quiet update. If you ever see "Nullecho"
  published by someone else, or this repo transferred, treat it as compromised and check the git
  history — provenance is public and timestamped.
- **The only official sources** are this repository and store listings linked from it. A build from
  anywhere else is not ours.
- **If you fork it, please rename it.** Not for our benefit — so that users can tell whose judgment
  they're trusting. The code is the easy part; the decisions in `docs/DECISIONS.md` are the product.

## Contributing

Try to break it. If you find a fingerprinting method it misses, a site it breaks, or a way to detect
it we haven't documented — open an issue. This category improves by people breaking each other's
tools in public.

Note: parts of this codebase were developed with AI assistance, reviewed and tested by a human.
Every claim in these docs is traceable to a cited source or a measurement we actually ran; where
something is unverified, it says so.

## License

MIT — see [`LICENSE`](LICENSE).
