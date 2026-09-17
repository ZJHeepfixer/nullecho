# Nullecho — what is actually left before launch

One ordered list. `BREAKAGE-TESTING.md` is the *protocol*; this is the *queue*.
Last revised 2026-08-21.

**Where things stand:** 258/258 tests, 182 DNR rules valid, ~16k lines, loads clean in real
Chrome 151, open-sourced and public but **announced nowhere**. The code is in good shape. Nearly
everything below needs a human in front of a browser, which is the actual bottleneck — so the work
this pass went into making each item *small*, not into writing more code.

---

## 1. Linux GPU strings — blocks release, needs hardware (scope TBD)

**The problem:** the `ubuntu-22` personas' WebGL renderer strings were reconstructed from documented
driver formats and **never read off a real Ubuntu machine**. A renderer string no real driver emits
makes every Nullecho-on-Linux user *uniquely* identifiable — the precise failure the project exists
to prevent. Blast radius is exactly "Chrome on Linux hosts", because D12 selects within the host's
own OS family.

**DECIDED 2026-08-21 (Jason): verify against real Linux.** The carry-don't-apply workaround
(pass the true renderer through on Linux hosts) was considered and **not taken** — we get the
strings right rather than routing around them.

**Full procedure + the constraint: `docs/LINUX-PERSONA-VERIFICATION.md`.** Read it before
sourcing hardware. The headline:

> The five Linux rows name **four distinct driver stacks**, and two of them pin driver, LLVM, DRM
> and kernel revisions. **A physical box verifies exactly the GPU it contains — one of five. A VM
> verifies zero**, because UTM/QEMU and non-GPU cloud instances report `llvmpipe` or `virgl`.

So this closes in one of three ways, and the first is a question for Jason, not a task:
1. **Reachable hardware determines the scope.** Whatever real Ubuntu machines exist verify their
   own rows; the pool narrows to those. Needs an answer to "what Linux hardware can you get to?"
2. **Format verification from primary sources** (ANGLE + Mesa source, plus a real-world corpus for
   population weights) — covers all five, no hardware, but is explicitly weaker evidence and must
   be labelled as such in `personas.js` and the release notes.
3. Ship narrowed to verified rows. ⚠️ Watch `MIN_PERSONAS_PER_FAMILY` (4) and `validatePool()`, and
   **never** drop the family outright — `personasForFamily()` falls back to `'win'`.

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
