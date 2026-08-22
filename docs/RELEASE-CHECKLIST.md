# Nullecho — what is actually left before launch

One ordered list. `BREAKAGE-TESTING.md` is the *protocol*; this is the *queue*.
Last revised 2026-08-21.

**Where things stand:** 196/196 tests, 176 DNR rules valid, ~16k lines, loads clean in real
Chrome 151, open-sourced and public but **announced nowhere**. The code is in good shape. Nearly
everything below needs a human in front of a browser, which is the actual bottleneck — so the work
this pass went into making each item *small*, not into writing more code.

---

## 1. Decide the Linux question — blocks release, needs no hardware

**The problem:** the `ubuntu-22` personas' WebGL renderer strings were reconstructed from documented
driver formats and **never read off a real Ubuntu machine**. A renderer string no real driver emits
makes every Nullecho-on-Linux user *uniquely* identifiable — the precise failure the project exists
to prevent. Blast radius is exactly "Chrome on Linux hosts", because D12 selects within the host's
own OS family.

Three options. **Recommendation: C.**

| | What it means | Cost |
|---|---|---|
| **A. Verify on real Ubuntu** | Read the strings off a real Ubuntu + Chrome install and correct the pool | Correct, but needs hardware or a VM nobody has stood up. Blocks indefinitely |
| **B. Drop the Linux family** | Ship win + mac only | ⚠️ **Does not do what it says.** `personasForFamily()` falls back to `DEFAULT_FAMILY` ('win'), so Linux users would silently get **Windows** personas — reintroducing exactly the cross-OS contradiction D12 was created to remove, for Linux users only. Also fails `validatePool()`, which requires every family stocked |
| **C. Carry the Linux GPU, don't apply it** | On Linux hosts, pass the **real** WebGL renderer through unspoofed; keep spoofing fonts, canvas, audio, cores, memory | Follows this project's own precedent — D11 reverted the entire display layer on exactly this reasoning, and `screenUnapplied` is the pattern already in `shim.js`. No hardware. Linux users keep most protection and leak one true string instead of one impossible one |

**C is a real tradeoff, not a free win:** a true GPU string is a genuine fingerprinting surface. The
argument for it is D11's — *a consistent honest leak beats an inconsistent fake* — plus the fact
that an impossible string is strictly worse than a true one, because it is both identifying **and**
unique to us.

**This is a D-level product call and needs Jason's yes.** If C: implement `gpuUnapplied` mirroring
`screenUnapplied`, gate on `hostFamily() === 'linux'`, add a test, record as D19.

## 2. Two remaining hard blockers — decisions, not work

Both are anonymity-set questions from `BREAKAGE-TESTING.md`, and both need a recorded answer
rather than a code change:

- **`uaData.platformVersion` is one constant per family** (`mac 14.6.0 / win 15.0.0 / linux 6.8.0`)
  across the whole user base — a population-level tell of the same shape as "everyone reports 8 GB".
  Vary within realistic bounds, or accept and record why.
- **The OS majors are two versions stale** (personas say macOS 14 / Windows "15.0.0"; this host
  reports `26.6.0`). Confirm those are still high-population, or refresh the pool.

---

## 3. Real-browser gate — Jason, one sitting, ~30 minutes

Do these in the Chrome profile that already has Nullecho loaded unpacked.
Already cleared on 8/21: reCAPTCHA v2, Google SSO, shim breakage battery.

1. **Blocking proof** — open `harness/blocking-proof.html`, click Run.
   Need: **BLOCKING PROVEN** (6/6 trackers cancelled, 3/3 controls loaded). *~1 min.*
2. **Popup counter agrees** — same page still open, open the popup. Need a **non-zero** blocked
   count. Disagreement either way is a real bug and this is the only place it shows. *~1 min.*
3. **GPC mechanism** (D17, replaces the old fifty-site sweep) — on `open.spotify.com` console,
   `navigator.globalPrivacyControl` must be `undefined`, and the page must still get a persona.
   On any other site it must be `true`. *~3 min.*
4. **Stripe test checkout** through to confirmation, including 3-D Secure. *~10 min.*
5. **A bank login** — sign in, view a balance. The fraud-vendor rules are off by default and that
   was verified at the rule level (allow@100 beats block@1), but the live flow is still owed.
   *~5 min.*
6. **Amazon** — add to basket, proceed to checkout, **stop before paying**. *~5 min.*

Any S0 gets a per-origin exception, not a shrug. Record the persona in any bug report — "it broke"
is not a report, "it broke under `win11-chrome-rtx3060`" is.

---

## 4. Launch — after the gate, not before

Ordered by dependency. Everything here is gated on §3 passing.

- **Register `getnullecho.com` + `nullecho.app`** (~$25, still unregistered).
- **Rewrite the blog post in Jason's own voice** — `site/blog-i-built-a-privacy-tool-that-cant-see-you.md`
  is a draft written by Claude and **must not ship as-is**: r/degoogle removes AI-written copy and
  HN forbids it outright. This is not optional polish.
- **Lead with the technical essay, not a launch announcement.** A fingerprinting writeup scored 756
  points where a comparable extension launch scored 20; "extension" in a Show HN title runs about a
  third of baseline. r/privacy is effectively closed (8 of 8 open-source launches removed in 2026).
- **Every claim must be true at default settings.** People install and check within the hour, and
  overclaiming gets dismantled in public.
- Full channel research: `docs/LAUNCH.md`, kit at `site/LAUNCH-KIT.md`.

---

## What is deliberately NOT on this list

- **Decoy ad-clicking.** Cut on the merits (D1): Google counts phantom clicks and bills advertisers,
  so the cost lands on small businesses. Not a risk call — a targeting one.
- **Monetization.** No premium tier, no affiliate VPN, no data sales. The telemetry and account
  hooks were removed on purpose and are not coming back.
- **Anything implying we beat a determined adversary, or touch your IP.** The honest claim is fixed:
  *shows each site a different, internally consistent device profile, which breaks the cross-site
  device-fingerprint join. It is detectable, it does not defeat a determined adversary, and it does
  nothing about your IP.* Firefox RFP and Brave are genuinely stronger; we say so in-product. Our
  niche is Chrome, where neither exists.
