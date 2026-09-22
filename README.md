# Nullecho

**A browser extension that blocks trackers, shows each site a different device profile, and collects
nothing about you — which is exactly why it ships a button that lets you measure whether it's
working.**

> ⚠️ **Pre-release.** Loads and runs in Chrome 151, 477 tests passing, but breakage testing is
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
  (182 rules, sourced from DuckDuckGo Tracker Radar / EasyPrivacy / AdGuard, not invented).
- **Per-origin device personas** — each site sees a *different but internally consistent* machine
  drawn from a pool of real, high-population configurations. That breaks the fingerprint join for
  trackers that hash the signals we cover: verified 2026-09-17 against FingerprintJS 5.2.0 and
  ClientJS, which gave four personas four distinct visitor IDs. It does **not** break it for a
  lie-aware library — CreepJS discards values it catches being spoofed, keys on what's left, and
  re-joins all four into one identity.
- **Global Privacy Control** — a legal do-not-sell request if *you* live in one of the states that
  recognise it (California, Colorado and several others). The duty attaches to your residency, not
  to where the site is; whether a given business is covered, and whether it complied, happens on
  their servers and is not observable from a browser. The signal covers **this browser profile
  only** — your phone and your other browsers each need their own.
- **Price disclosure notice** — two U.S. states name an exact sentence a business has to show when
  it sets a price from an algorithm that used your personal data: New York's is in force now,
  Connecticut's arrives on 2027-07-01 and also accepts a substantially similar sentence. When a page
  displays one of those sentences *and* publishes a machine-readable price, Nullecho says so and
  offers you a local receipt of what the page showed. It reports the words on the page and nothing
  more: New York's Attorney General has already objected to a page that carried the exact sentence,
  so finding it is not a finding about the business — and Maryland and New Jersey legislated bans
  with no wording at all, so there is nothing to look for there.
- **DROP onboarding** (California) — walks you into the state platform that forces 600+ registered
  data brokers to delete, opt you out of sale, or record an exemption. The only feature here that
  *removes* data rather than obstructing collection.

## What it does NOT do

Stated up front, because a privacy tool that oversells is worse than none — you make real decisions
based on what it implies.

- **It is detectable, by design.** Measured with CreepJS — a free third-party library, not our own
  test suite — our build produces **2 lying API records**, and both of them are the canvas and audio
  noise that *is* the defense. Before 2026-09-19 the same library recorded 199 and returned a **bot**
  verdict. Two is the current measurement, not a floor: a site that looks can always tell Nullecho is
  installed.
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
npm test          # 477 tests
```

Chrome: `chrome://extensions` → Developer mode → **Load unpacked** → select `ext/`.
Firefox: `about:debugging` → This Firefox → Load Temporary Add-on → select `ext/manifest.firefox.json`.

## Measure it yourself

```bash
cd nullecho && python3 -m http.server 4886
```

- `http://localhost:4886/harness/index.html` — your real fingerprint, unprotected
- `http://localhost:4886/harness/shim-test.html` — with protection, plus our own 10-probe
  adversarial suite (our score on our own test — the number that matters is CreepJS's, below)
- `http://localhost:4886/harness/claim-verification.html` — the real measurement: FingerprintJS,
  ClientJS and CreepJS, vendored, run against your own browser
- `http://localhost:4886/harness/breakage-battery.html` — does the shim break real workloads

## Status

| | |
|---|---|
| Tests | 477 passing |
| Loads in Chrome 151 | ✅ verified |
| reCAPTCHA / Google SSO | ✅ verified unbroken |
| Shim breakage battery | ✅ 0 failures |
| Full Tier A breakage suite | ⏳ incomplete |
| **Linux personas** | 🚫 **GPU renderer strings unverified on real hardware — release blocker** |
| **Adversarial review (2026-09-16)** | 🟠 **Not yet shippable** — findings + one reproducing test each: [`docs/REVIEW-2026-09-16.md`](docs/REVIEW-2026-09-16.md). **Closed:** A1–A5, B1–B5, B7–B9, C1–C3 — each reproduction flipped into a regression guard (D19–D31; see `docs/DECISIONS.md`). **Still open:** A8 (Web Workers — no content script runs in a worker scope) and B6 (WebGPU architecture — needs hardware). Full status + effort estimates: [`docs/RELEASE-READINESS-2026-09-16.md`](docs/RELEASE-READINESS-2026-09-16.md). |
| **Third-party detectability (2026-09-19)** | Measured, not asserted. CreepJS: **2 lie records**, both our own canvas/audio noise; `hasToStringProxy` and `webDriverIsOn` back to the control's `false` (was 199 records and a bot verdict before D35). FingerprintJS + ClientJS: four personas, four distinct visitor IDs. CreepJS still re-joins them — see `docs/THREAT-MODEL.md`. |
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

## How this was built

Nullecho was built by one person working with AI assistance (Claude), and I'd rather say that plainly
than have you wonder. Practically: the AI did a large share of the implementation and research; every
design decision, every judgment call, and the accountability are mine.

What that means for you as a user or contributor:

- **Every claim in these docs is traceable** to a cited primary source or a measurement actually run
  and recorded — not to a model's recollection. Where something is unverified, it says so explicitly
  (see the release blockers in `docs/BREAKAGE-TESTING.md`, or the "unverified" flags on the Linux
  persona GPU strings).
- **The reasoning is written down**, including the parts we got wrong and corrected. `docs/DECISIONS.md`
  records why decoy ad-clicking was cut, why the claim was narrowed after Arkenfox's critique, and why
  the display-spoofing layer was reverted rather than half-fixed. If you disagree with a decision, the
  argument is there to attack.
- **Nothing here is asserted because it sounded right.** Measurements were re-taken when they looked
  wrong. The baseline was thrown out once because it had been captured in the wrong browser.

If you find a claim in this repo that isn't backed by a source or a measurement, that's a bug — open
an issue.

## License

MIT — see [`LICENSE`](LICENSE).
