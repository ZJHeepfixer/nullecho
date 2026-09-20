# Nullecho — launch kit

Companion to `docs/LAUNCH.md` (the research). This is the *do-this* version.

⚠️ **GATE: nothing here fires until (1) blocked-count confirmed, (2) Tier A breakage passes,
(3) Linux release blockers fixed or Linux personas dropped.** Build the kit now; launch after the gate.

⚠️ **You rewrite every forum post in your own voice before posting.** These are scaffolds, not copy.
AI-written launch copy is a *removable offense* on r/degoogle and forbidden on HN "not even a tiny bit."
I literally cannot post these for you (your accounts, your name) — and I shouldn't. Blog post: AI-assist
is fine if disclosed. Forum comment: must be yours.

---

## The sequencing (order matters)

**Phase 0 — before any post exists (do now, pre-gate):**
- Open-source the repo. A privacy tool nobody can audit is distrusted on sight.
- Publish the blog post on your own site (after you rewrite it).
- Stand up the "prove it yourself" page — the measurement harness as a public demo. This is the hook.
- Register `getnullecho.com` + `nullecho.app`.

**Phase 1 — get 10–20 real testers, quietly:**
- People who'll actually run it a week and report breakage. Not reach — *signal*.
- Best source: the r/degoogle Showcase `[DEV]` thread (below), and anyone technical you know.
- Goal of Phase 1: catch the site-breakage you and I can't, on machines that aren't a Mac.

**Phase 2 — the essay, not the launch:**
- Lead with the blog post / a technical write-up, NOT "check out my extension."
- Data point: a fingerprinting blog post scored 756 on HN; a comparable extension launch scored 20.
  "extension" in a Show HN title correlates with 1/3 the baseline score.
- The write-up that fits this audience: the *design* story (internally-consistent personas, why naive
  randomization backfires) or the *findings* story (the surveillance-pricing / DROP research).

**Phase 3 — the stores:**
- Firefox AMO first (friendlier review, 24-hour turnaround when clean). ⛔ Do **not** say the
  Firefox build is more capable — `webRequestBlocking` is requested on neither platform, so both
  builds block identically through DNR. The true line: Firefox keeps `webRequest` observation in a
  packed release, so tracker *attribution* survives there where Chrome only has it in development.
- Chrome Web Store second.
- GitHub release as the always-available fallback.

---

## Where the testers are (and aren't)

| Channel | Verdict | How |
|---|---|---|
| **r/degoogle** | ✅ via Showcase | Weekly `[DEV]`-tagged Showcase thread. Open source + public repo required (we have it). Lead with the **Firefox/AMO + repo** links — Rule 5 blocks first-party Google (Chrome Store) links. Fill the "AI Involvement" field honestly. |
| **Mastodon** | ✅ | `#privacy #FOSS #surveillance #browser #degoogle`, max ~5 tags. Post **Public**, never Unlisted (Unlisted can't be boosted). Real alt-text on screenshots. Set up `rel=me` verification first. |
| **Lobsters** | ⏳ 70-day wait | Invite-only; new users can't submit for 70 days. Long game: participate first, then submit an *article* (80–193 pts) not a product page (1–15 pts). |
| **Hacker News** | ✅ but essay-led | Show HN scores low for extensions. Post the essay as a story; let people find the tool in it. HN forbids AI-written text. |
| **r/privacy** | ❌ closed | Rule 3 bans self-promo with immediate ban; Rule 13 extends it to open source. 8 of 8 open-source launches removed in 2026. Don't. |

---

## Forum post SCAFFOLDS (rewrite these — do not post verbatim)

### r/degoogle Showcase comment (scaffold)

> **[DEV]** Nullecho — anti-fingerprinting + tracker blocking for Chrome/Firefox
> - **Replaces:** the Google/ad-tech fingerprint profile that follows you across sites
> - **Repo/site:** [AMO link] · [GitHub]
> - **What it does:** shows each site a different but internally-consistent device profile (not naive
>   randomization — that backfires), blocks trackers, sends GPC, and for CA users routes into DROP.
> - **What it doesn't:** it's detectable by design (CreepJS, a third-party library, records 2 lying
>   APIs against it — both of them its own canvas/audio noise), the join it breaks is the one
>   FingerprintJS-style trackers make and *not* the one a lie-aware library makes, it does nothing
>   about your IP, and Firefox RFP / Brave are stronger below the JS layer. Chrome is its niche.
> - **AI involvement:** [state it honestly — code and this post drafted with AI assistance, reviewed
>   and edited by me]
> Built it because I was tired of privacy tools asking me to trust a green shield. This one ships a
> button that measures your own fingerprint off vs on so you can check it yourself.

*(Rewrite in your voice. The honesty about limitations is doing the heavy lifting — keep it.)*

### HN — the essay angle (title options, NOT "Show HN")

- "Naive fingerprint randomization makes you more trackable, not less"
- "I built a privacy extension that can't tell if it's working, on purpose"
- "What a shopping page actually reads about you before quoting a price"

The essay IS the blog post. Post the blog, not the extension. Let the tool be the footnote.

---

## The one-line pitch (the synthesis)

> **It collects nothing — which is exactly why it has to prove itself to you instead of asking you to
> trust it.**

Answers "don't feel tracked" and "does it actually work" in one sentence. No incumbent can copy it
without rebuilding around zero data collection.

## The trap to never fall into

Never claim it lowers prices, never claim invisibility, never imply it beats state surveillance. Every
overclaim is an hour-one falsification by an audience that installs and checks. "We checked, here's
exactly what it does and doesn't do" is the thing that earns this crowd.
