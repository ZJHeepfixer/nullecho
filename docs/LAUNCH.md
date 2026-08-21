# Nullecho — organic launch plan

Written 2026-08-20. Budget: **$0**. No paid media, no seeded reviews, no sockpuppets, no
undisclosed affiliate anything. Every recommendation assumes the developer posts as themselves,
under one identity, disclosed.

**Reading convention.** `[cited]` = linked source verified. `[inference]` = my judgment from cited
evidence. `[unverified]` = could not confirm; check before acting. The copy rules in
`docs/THREAT-MODEL.md` govern marketing language, and they govern this plan too.

**Research note.** Five parallel research passes fed this document. Three returned original
data — including an analysis of 9,000 Show HN posts via the HN Algolia API, and direct API checks
of AMO listing status. Where a claim comes from that analysis it is marked `[original analysis]`.
The session's web-search budget (200 calls) was exhausted; remaining gaps are listed in §9.

---

## The short version

1. **You cannot launch yet.** The extension does not load — the manifests reference eight files
   that don't exist. (The name is now settled: **Nullecho**. §1.1 keeps the record.) (§1)
2. **Lead with the linkage graph, not the fingerprinting.** Anti-fingerprinting Show HNs get
   flamed on a contested premise; a Blacklight-style tracker reveal does not. And the niche is
   *empty* — Mozilla Lightbeam is delisted and nothing replaced it. (§2, §6)
3. **The essay outperforms the tool, badly.** A personal blog post about fingerprinting scored
   **756 points** on HN; the entire ceiling for a privacy-extension Show HN in 2024–26 is **296**.
   Ship the writeup as the primary artifact. (§3.1)
4. **DROP is a genuine, time-limited, open lane — but it is not empty, and the window is closing.**
   The January launch got real coverage (Ars, The Markup, Consumer Reports). The August 1 deadline —
   the moment the law acquired teeth — produced a **1-point Hacker News post**. Enrollment covers
   0.8% of Californians and growth collapsed in February. **No tool has operationalized it**, and
   the most-starred GitHub project that mentions DROP is actively telling Californians it isn't
   live yet. But Techlore published a DROP explainer **five days ago**, so move now. (§4)
5. **Ship it open source.** Not close. r/privacy's rules reportedly *bar* promoting closed-source
   privacy tools outright, and every case of an extension being cloned or hijacked involved someone
   taking the **name, listing, or developer account** — never the source. (§3.2, §5.4)
6. **Build the scan-any-site tool before the personal graph.** That is the difference between
   18 million scans and being delisted. (§6)

---

## 1. Blockers — clear these or nothing else applies

### 1.1 The name is settled — Nullecho ✅

**Resolved. The product is Nullecho.** The rename is done across the codebase, the Gecko ID is
`nullecho@nullecho.app` (`ext/manifest.firefox.json`), and the intended domain is `nullecho.app`.
This got decided *before* anything was published, which is the only reason it cost nothing.

Two earlier names were rejected. The reasoning is kept here because it still constrains the copy:

- **Chaff** — the original repo name, rejected on two independent grounds. It lost on domains
  (`getchaff.com`, plus `chaff.com` / `.app` / `.io` / `.dev`, all taken). More importantly, *chaff*
  names the decoy-flooding mechanism this project explicitly **rejected** in **D1** (no decoy ad
  clicks — Google bills advertisers for the phantom clicks) and **D8** (no synthetic analytics
  noise). Shipping a tool called Chaff that refuses to make chaff invites the first HN comment to be
  "so it doesn't do the thing it's named after?" It also reads as a sabotage frame, which
  `THREAT-MODEL.md` §Copy rules forbid: *"Frame as privacy noise and data minimisation, never as
  sabotage."*
- **Bystander** — briefly adopted, then rejected. There is a live USPTO Class 9 registration, and
  apps under that name already ship on both mobile stores. Worse on the merits: in the privacy
  literature a "bystander" is the person being *surveilled without consent* — the name identified
  the victim, not the defense. (The generic word still earns its place in D1's moral argument,
  "the bystander pays"; that is the word, not the product.)

**Nullecho** is a radar term — a return that comes back with nothing distinctive in it. That is the
actual strategy: every site gets a real, complete, unremarkable machine, and none of them gets a
distinguishing feature to join on. It also keeps `ARCHITECTURE.md`'s thesis intact
(*"indistinguishable from a large crowd"*) without naming the victim or promising sabotage.

⛔ **The Gecko ID is now permanent-on-publish.** `nullecho@nullecho.app` is baked into the AMO
listing and the signed XPI from the first submission onward. Changing it after that means a **new**
listing, zero reviews, zero installs, and every launch-post link pointing at the old one. Same for
the Chrome item ID. Do not touch it again.

Still open from the rename: the domain registration, the GitHub org, and — **trademark it**, see
§5.4, where trademark turns out to be the only defense that actually works against cloning.

### 1.2 The extension does not currently load

Both manifests reference files that do not exist:

| Referenced | Status |
|---|---|
| `src/shim.js`, `src/gpc.js` | **missing** |
| `rules/{ads,analytics,social,fingerprinting,gpc}.json` | **missing** (all 5) |
| `icons/icon-{16,32,48,128}.png` | **missing** |

A manifest pointing at a non-existent DNR ruleset path fails to load. There is no build to install,
none to breakage-test, none to submit. Show HN's rules are unambiguous: *"If your work isn't ready
for users to try out, please don't do a Show HN"* [cited —
[showhn.html](https://news.ycombinator.com/showhn.html)].

### 1.3 The linkage graph — your single best asset — is an orphan module

`ext/src/linkage.js` (237 lines; exports `buildLinkageGraph`, `headline`, `exposureScore`,
`siteePairsFor`) is imported by **nothing**. `popup/popup.js` imports only `../src/protocol.js`.
No UI, no export, no screenshot.

Per §2 and §6, this is the highest-leverage thing you own and the plan pivots around it. It is a UI
task on an engine that already exists and is well-reasoned. (Also: `siteePairsFor` is a typo for
`sitePairsFor`; fix it while it's still private API.)

### 1.4 The Firefox manifest doesn't claim the capability the pitch depends on

`manifest.firefox.json` declares `"webRequest"` but **not** `"webRequestBlocking"`. Without it you
observe requests, you don't cancel them. "Our Firefox build is strictly more capable" is a true and
valuable line — but it isn't true of the artifact yet. Add the permission; prove it with a test that
blocks something on Firefox that DNR alone would pass.

> **RESOLVED 2026-08-21 — the other way.** The mismatch is closed by **correcting the claim**, not by
> taking the capability. Reasons, in order of weight:
>
> 1. `ext/PERMISSIONS.md` already recorded a deliberate decision not to request `webRequestBlocking`
>    on either platform, with a stated reason — keeping the blocking path in DNR means a bug in the
>    heuristics observer cannot hang a request — and a stated trigger for revisiting (a rule DNR
>    genuinely cannot express). No such rule exists yet.
> 2. Requesting it without using it would violate this project's own permission rule ("if the feature
>    could ship without the permission, the permission does not go in") and hand an AMO reviewer an
>    unjustified capability.
> 3. Actually *using* blocking mode is not a one-line change. `heuristics.js` decides from
>    storage-backed, asynchronously loaded strike state; a blocking `onBeforeRequest` must answer
>    synchronously or return a promise that **delays every matching request**. It would also split
>    blocking behaviour across platforms, which per `PERMISSIONS.md` obliges a UI claim, and it cannot
>    be verified anywhere in this toolchain — there is no Firefox here to run it in.
>
> Corrected: `docs/ARCHITECTURE.md` layer-1 diagram, `ext/README.md`, `ext/PERMISSIONS.md`.
> `ext/src/manifest.test.js` now fails if either manifest requests `webRequestBlocking` or if
> `heuristics.js` registers a `['blocking']` listener, so the docs and the artifact cannot drift
> apart again. The finding above is left standing as the record of what was wrong.

### 1.5 Firefox's data-collection declaration is now mandatory, and your version floor conflicts with it

`browser_specific_settings.gecko.data_collection_permissions` has been **mandatory for all new
extensions since 2025-11-03** [cited —
[Mozilla Add-ons blog, 2025-10-23](https://blog.mozilla.org/addons/2025/10/23/data-collection-consent-changes-for-new-firefox-extensions/)].
Extensions that need it and lack it *"will be prevented from being submitted to addons.mozilla.org
for signing."* An extension collecting nothing declares `"required": ["none"]`.

The key requires **Firefox 140+** desktop. Your `strict_min_version` is `128.0`, and AMO policy
splits the obligation by version: 140+ declares in the manifest; **139-and-earlier must also ship
its own consent experience** — "unmissable," preferably a focused new tab, immediately after
install [cited — [AMO Add-on Policies](https://extensionworkshop.com/documentation/publish/add-on-policies/),
updated 2026-04-30].

**Recommendation: raise `strict_min_version` to `140.0`.** It collapses a whole consent-UI build
into one manifest key. The cost is dropping Firefox 128–139 users, which for a launching extension
is negligible. `[inference]`

> **DONE 2026-08-21.** `manifest.firefox.json` now carries `strict_min_version: "140.0"` and
> `data_collection_permissions: { "required": ["none"] }`. `["none"]` was verified before it was
> declared, not after: no shipped source contains `XMLHttpRequest`, `sendBeacon`, `WebSocket`,
> `EventSource`, `importScripts` or `chrome.storage.sync`; the only two `fetch()` calls read bundled
> rulesets via `chrome.runtime.getURL`; every remote URL in the package is an `href` the user clicks.
> `ext/src/manifest.test.js` asserts all of that, so adding telemetry later breaks the build instead
> of quietly falsifying a declaration made to AMO.

### 1.6 One thing that is already right

`strict_min_version: 128.0` was correct *for MAIN world specifically*. Manifest-declared
`content_scripts` with `"world": "MAIN"` landed in **Firefox 128** [cited —
[bug 1736575](https://bugzilla.mozilla.org/show_bug.cgi?id=1736575), RESOLVED FIXED, milestone
Firefox 128; [MDN Firefox 128 release notes](https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/128)].
Raising to 140 per §1.5 keeps this safe. Two bonuses Mozilla notes: MAIN-world scripts *"are not
blocked by a strict webpage CSP,"* and Firefox supports MAIN world on MV2 as well, which Chrome
does not [cited — [Mozilla Add-ons blog, 2024-07-10](https://blog.mozilla.org/addons/2024/07/10/manifest-v3-updates-landed-in-firefox-128/)].

⚠️ **Untested and load-bearing:** whether Firefox *guarantees* MAIN-world `document_start` scripts
run before page scripts. A shim that lands after the page's fingerprinting call is useless, and
Chrome's ordering does not necessarily carry over. **Test it** against a page that reads
`HTMLCanvasElement.prototype.toDataURL` from an inline `<head>` script. `[unverified]`

---

## 2. Positioning: pick the fight you can win

You have two stories. They are not equally good.

**Story A — anti-fingerprinting.** Contested on its premise, in public, by people who know the
literature. You will be told that randomization makes you more unique; that configurable knobs are
themselves a fingerprint; that only a uniform stock configuration works; that you'll break sites.
The strongest ammunition against you is **Brave's own postmortem** on sunsetting Strict
fingerprinting mode (2024-01-18) [cited —
[brave.com](https://brave.com/privacy-updates/28-sunsetting-strict-fingerprinting-mode/)]:

> *"Strict mode frequently causes certain websites to function incorrectly or not at all."*
> *"Fewer than 0.5% of Brave users are using Strict fingerprinting protection mode."*
> Strict users *"could be more vulnerable to being fingerprinted because they stand out as a result
> of using Strict mode."*

Someone will link that. Your per-origin, internally-consistent, high-population persona design is a
genuine answer — but it is an answer *in an argument*, and arguments cap your reach.

**Story B — the linkage graph.** Nobody disputes that Google is on 34 of your 41 sites. There is no
"this makes you more unique" counterargument. And the niche is **empty**: Mozilla Lightbeam, the
only well-known prior art, is dead — its AMO listing 404s with the API reporting
`is_disabled_by_developer: true`, `mozilla.org/lightbeam` 301-redirects to GitHub, and
`lightbeam-we` last saw a push on 2023-04-10 [cited, `[original analysis]` — direct API checks].
Nothing filled the gap.

**Lead with B. Let A be the second paragraph.** `[inference, strongly supported]`

The positioning paragraph:

> Every blocker tells you it stopped 47 trackers. That number says nothing about the harm, because
> the harm isn't observation — it's the **join**. One company recognizing you on your bank's site
> and on a health forum, and connecting the two. Nullecho shows you that graph. Then it breaks it:
> each site gets its own whole, internally consistent, common machine — so site A and site B can
> each recognize you fine, they just can't recognize you as the *same person*.

Then the concession, immediately, because conceding is what survives HN:

> Most anti-fingerprinting extensions randomize each value independently, which produces a machine
> that doesn't exist — a Chrome UA next to an Apple GPU next to 3 CPU cores. Fraud vendors already
> flag that, and averaging attacks recover the true value anyway. Personas are stable per origin
> for exactly that reason.

And the limits, above the fold, in the store listing — not buried in docs. No state surveillance,
no ISP, no TLS/JA3, no IP, partial gap on WASM-compiled fingerprinting, and a site you're logged
into knows who you are regardless. In this audience stated limits read as competence. It is also
the cheapest available defense against the "privacy theater" charge, which is what kills tools here.

**Know your incumbent.** Expect "how is this different from Privacy Badger?" in every venue.
Privacy Badger is EFF-backed, free, open source, already sends GPC, does algorithmic tracker
detection, and *"can detect canvas-based fingerprinting"* — but its UI shows **domains** with
red/yellow/green sliders, not companies, and not a join graph [cited —
[privacybadger.org](https://privacybadger.org/)]. Have the one-sentence answer ready:
*"Privacy Badger blocks the trackers; it doesn't show you which companies were positioned to
connect which of your visits."*

---

## 3. Where this audience is

### 3.1 Hacker News — with actual numbers

**The rules that bind you** [cited — [showhn.html](https://news.ycombinator.com/showhn.html),
[newsguidelines.html](https://news.ycombinator.com/newsguidelines.html),
[newsfaq.html](https://news.ycombinator.com/newsfaq.html)]:

- Must be runnable. *"If your work isn't ready for users to try out, please don't do a Show HN."*
- *"The project should be non-trivial… Share something that is deeply personal and interesting to
  you. Explain how and why."*
- *"Please make it easy for users to try your thing out, ideally without barriers such as signups
  or emails."*
- No landing pages, no fundraisers, no minor version bumps.
- *"Please don't ask friends to upvote or comment. That's not ok on HN."* Penalties are real:
  *"We penalize or ban submissions, accounts, and sites that break this rule."*
- *"Please don't delete and repost."*
- *"It's ok to post your own stuff part of the time, but the primary use of the site should be for
  curiosity."*

**⚠️ The newest rule, and the one most likely to sink you.** dang's presentation-tips post was
edited **2026-03-28** to add [cited — [item?id=22336638](https://news.ycombinator.com/item?id=22336638)]:

> *"Write your text by hand. Don't use an LLM to generate any of it (not even a tiny bit, including
> to edit or spruce it up). Reason: the community is super fussy about this right now, and LLM
> language leaves imprints on your text which are generating quite some backlash… This is a big
> dividing line at present!"*

This is not advisory. "AI slop" is now a top-tier flame trigger — in one privacy-extension thread,
*"Sorry, you want me to give browser privileges to code written by AI?"* [cited]. **Hand-write every
word of the Show HN text and the README's opening.** Same post also says: don't use your project
name as your username; drop anything that sounds like marketing; include the backstory of why you
built it; **put an email in your HN profile** so moderators can send you a repost invite.

**What the data says** `[original analysis — 9,000 Show HN posts, Jan 2024–Apr 2026, via
hn.algolia.com/api/v1/search_by_date?tags=show_hn]`:

| Segment | n | median pts | % reaching 50+ |
|---|---|---|---|
| All Show HN | 9,000 | 2 | 5.9% |
| **"open source" in title** | 478 | **4** | **10.5%** |
| No "open source" | 8,522 | 2 | 5.7% |
| **URL is github.com** | 2,583 | **3** | **9.0%** |
| Non-GitHub URL | 6,417 | 2 | 4.7% |
| **"extension" in title** | 159 | 2 | **1.9%** |
| "privacy" in title | 53 | 2 | 1.9% |
| Title length | — | no effect | 4.9–7.7% |

Three actionable findings. **"Open source" in the title roughly doubles your odds** of clearing 50
points. **Pointing the URL at a GitHub repo rather than a landing page does the same.** And the word
**"extension" in the title is associated with one third the baseline success rate** — so don't use
it. (Correlation, not causation, but the direction is unambiguous at this sample size.)

Corroborating: an independent 188,000-post study finds the same median of 2, puts 50 points at the
top 6% and 250+ at the top 1%, notes Show HN volume nearly tripled since 2019 to 28,302 posts in
2025, and that *"after 48 hours, 92% of the star-getting is over"* [cited —
[Show HN by the Numbers](https://danfking.github.io/blog/2026/04/23/show-hn-by-the-numbers/)].

**Real posts in your exact category** [all verified against the HN API]:

- **20 pts, 10 comments** — "Show HN: I built a cross-browser extension that controls fingerprinting
  surfaces," 2026-07-31, [49124017](https://news.ycombinator.com/item?id=49124017). Linked a landing
  page, not a repo. Top critical comment, `gruez`: *"Anti-fingerprinting measures with configurable
  knobs is always going to be a risky proposition because those options themselves end up being a
  fingerprinting surface. It's better to take firefox/tor browser's approach and have a common
  profile eg. 'resistfingerprinting' to get crowd anonymity."* The dev conceded — then got a second,
  sharper hit when `gruez` **audited the screenshots against Firefox's actual RFP feature set** and
  found the extension advertising protection for APIs that don't exist. *Someone will check your
  screenshots against the spec.*
- **1 point, 1 comment** — "Show HN: Privacy Magic – a Chrome extension to protect your privacy,"
  2026-07-02, [48760091](https://news.ycombinator.com/item?id=48760091). Submitted by
  **arthuredelstein**, who spent *"the past decade on Tor Browser, Firefox, and Brave"* and authors
  privacytests.org. Same account's *news* submissions scored 695 and 473. **A Show HN dying in
  /newest is the default outcome regardless of who you are.** Don't read a low score as a verdict.
- **296 pts** — "A Chrome extension that will auto-reject non-essential cookies" (2025-04-29) — the
  observed **ceiling** for a privacy/blocking extension Show HN in this period.
- **26 pts** — "uBlock-Mv3 – Port of Full Manifest V2 uBlock Origin to Manifest V3" (2025-07-12).
  Objectively valuable work, 26 points.

**And the finding that should reshape your plan — the writeup massively outperforms the tool:**

- **756 pts / 445 comments** — "The privacy nightmare of browser fingerprinting" (2025-11-22,
  [46016249](https://news.ycombinator.com/item?id=46016249)) — a plain personal blog post.
- **534 pts** — "LinkedIn checks for 2953 browser extensions" (2026-02-05).
- **365 pts** — "Websites are tracking you via browser fingerprinting" (2025-06-18).

A one-person explainer outscored every fingerprinting *tool* by 2.5×, and those comment threads are
full of people asking what to actually do about it. The 2025–26 HN privacy leaderboard confirms the
shape: **first-person narrative with a reproducible method wins** — "I verified my LinkedIn identity.
Here's what I handed over" (1,483), "I wrote to Flock's privacy contact to opt out" (670), "What
your Bluetooth devices reveal" (540). That last one scored 540 with **zero images**, a Docker
one-liner anyone could run, and careful self-anonymization.

**→ Your primary HN artifact is an essay, not a Show HN.** Write the piece you're uniquely
positioned to write — the linkage-graph finding, with the method and the arithmetic — and let the
extension be the thing at the bottom that readers can run. Then do a separate Show HN later.

**The permission objection is unavoidable, so pre-empt it.** From the 296-point thread, verbatim
[cited]: *"the content scripts manifest permission for https://\*/\* … allows it to run that script
on every site you visit… That means it can see financial info, health info, legal info, your diary"*
(`mcoliver`), and: *"Fundamentally there is no reason anyone in their right mind should install an
extension released by an individual with these permissions… Anyone can buy out or compromise this
developer and slide complete takeover of your online life into an extension update"* (`ocdtrekkie`).

That second one is the #1 structural objection to a solo dev, and it is *correct* — §5.4 shows every
major extension compromise happened exactly that way. Answer it in the post itself: reproducible
builds, CWS verified uploads, a signed release process, and a written **no-sale succession policy**.

**Mechanics.**
- **Post Monday 00:00 UTC (Sunday 7pm US Eastern)** — 10.8% of posts there reach 50+; the worst slot,
  Thursday 06:00 UTC, is 2.6% [cited — Show HN by the Numbers]. The mechanism is low competition in
  /newest, not more readers.
- **Title.** Avoid "extension." Include "open source." Point the URL at GitHub. State the technical
  decision, not the benefit. e.g. `Show HN: Nullecho – open-source per-origin fingerprint personas,
  and a graph of who could join your browsing`
- **Second-chance pool.** dang: *"If you see a submission that didn't get attention… please tell us
  at hn@ycombinator.com! … It's fine if it's your own article, but we like it better when it's just
  something you ran across"* [cited — [26998309](https://news.ycombinator.com/item?id=26998309)].
  Email them yourself and say it's yours. Do **not** have a friend do it. (The `/pool` page is not
  publicly readable — verified.)
- **Repost invites are real and conditional.** dang, to a dev whose Show HN flopped: *"I'd be willing
  to send you a repost invite for that if you'd be willing to open it up for people to try out.
  (Currently it looks like they have to send an email.)"* [cited —
  [37795065](https://news.ycombinator.com/item?id=37795065)]. → email in profile, zero-signup install.
- Be in the thread for four hours. In this category the comments *are* the review.

### 3.2 Reddit

⚠️ **Reddit blocked every fetch attempt this session — both mine and the research agents'.
Everything specific about r/privacy, r/degoogle, and r/firefox rules below is `[unverified]`.
Read each subreddit's rules page yourself before posting.** A day-one removal costs you the window.

**r/privacy's rules, recovered from a 2024 Wayback archive** `[archive-sourced — re-read the live
rules before posting]` are unusually specific and they decide your approach:

> **Rule 1** bans promotion of closed-source privacy tools outright.
> **Rule 2** permits developers to post *"if it is open source **and you have discussed expectations
> with the Mods in advance**."*

→ **Modmail r/privacy before you post, not after.** And this is a second, independent reason the
open-source decision in §5.4 is not optional: closed-source, you are not merely disfavored there,
you are barred.

What holds regardless:

- The near-universal norm is **90/10** — ~90% genuine participation, ≤10% your own thing — and mods
  set stricter rules per sub [cited, general Reddit guidance]. A new account whose first post is its
  own tool reads as spam regardless of intent.
- **r/firefox** is reputationally strict on extension self-promo `[unverified — check the sidebar]`.
- **r/privacy** is the largest audience and the most cynical, and it's where your reputation gets
  set permanently.

How to do this honestly, which is also what works:

1. Participate for weeks first. Answer fingerprinting questions. Mention nothing. If you can't
   stomach that, skip Reddit rather than drive-by posting.
2. Read each sub's rules the day you post. **Modmail r/privacy in advance — their rules require it.**
3. **Disclose in the title** — `[Dev] I built…` — not the body.
4. Lead with the technical decision and its limits. Store link at the bottom.
5. Never solicit votes, never use a second account, never have a friend "organically" chime in.
6. When told it's worse than uBlock Origin: agree. uBO **is** the better blocker. Position as
   complementary — you do the join graph and persona coherence it doesn't.

Ordering `[inference]`: **r/degoogle** and smaller privacy subs → **r/privacy** (week 2, with real
breakage data) → **r/firefox** only once AMO is live and you have a Firefox-specific angle.

### 3.3 Lobsters

[Cited — [lobste.rs/about](https://lobste.rs/about)]

- **Invite-only.** Paths: someone in the public user tree, the chat room, or — most relevant — *"If
  you authored content posted there, reach out in chat."* **Do not manufacture that** by asking
  someone to submit for you.
- Self-promo: *"As a rule of thumb, self-promo should be less than a quarter of one's stories and
  comments."*
- Narrowly computing. Good stories *"improve the reader's next program"* or *"deepen their
  understanding of their last program."* Launches-as-launches are off-topic.

**Lobsters wants the engineering writeup, not the launch** — "validating that a fake machine is
internally consistent" is `persona-validator.js` (509 lines) plus `personas.test.js` (500 lines)
turned into prose, and it's worth writing regardless (§3.1).

### 3.4 Privacy Guides — high value, real gates

[Cited — [General Criteria](https://www.privacyguides.org/en/about/criteria/),
[Browser Extensions](https://www.privacyguides.org/en/browser-extensions/)]

There is a **formal developer self-submission process**, which is rare. Requirements: participate in
the self-submission forum thread; *"Must disclose affiliation, i.e. your position within the project
being submitted"*; explain the privacy value and advantages over alternatives; **define the threat
model** — *"what the project can provide, and what it cannot."* No affiliate links, no
pay-for-placement: *"We do not make money from recommending certain products."*

General criteria: security best practices; **open source *generally preferred*, not required**;
cross-platform; actively developed (*"unmaintained projects will be removed"*); usable by
non-experts; documented. `THREAT-MODEL.md` is essentially a pre-written submission — almost nobody
arrives with one.

**Two real gates, both cited:**

1. Browser extensions *"must not replicate built-in browser or OS functionality."* Firefox ships
   ETP and `privacy.resistFingerprinting`. A reviewer can reasonably call canvas/WebGL/audio
   shimming a replication of RFP. Your answer must be concrete and in the README *before* you
   submit: per-origin granularity (RFP is global), the linkage graph (nothing built-in does this),
   WebGPU coverage, cross-browser parity — plus the `ARCHITECTURE.md` argument that RFP ships as
   advanced-users-only precisely because uniformity breaks sites.
2. *"Must directly impact user privacy, i.e. must not simply provide information."* ⚠️ **This is in
   direct tension with §2's advice to lead with the linkage graph.** The graph is a *reporting*
   feature; on its own it fails this criterion. The resolution is not to abandon the graph — it's to
   keep the two audiences separate. **The linkage graph is the marketing lead** (it is what spreads,
   §6). **Blocking plus per-origin personas plus GPC is the product lead** in the Privacy Guides
   submission, the Chrome single-purpose field, and the store descriptions. Both are true; the
   emphasis differs by audience, and that is honest framing rather than spin. Say the graph "shows
   you the join, then breaks it" and the sequencing carries both.

They also currently recommend **only content blockers** and explicitly caution that extra extensions
*"can make you stand out"* and *"weaken site isolation."* That is the extension-detection objection,
and it cuts against a third-party privacy extension existing at all. It is also the strongest
argument for shipping open source, since trust is the only thing that overcomes it.

Treat this as **month-2+**, after real users and a breakage record. A rejection is public and durable.

### 3.5 Fediverse

`[Largely unverified — instance-level norms could not be confirmed this session.]`

- The privacy/infosec fediverse concentrates on **infosec.exchange**, **fosstodon.org**,
  **mastodon.social**. Post from an account with history.
- **Alt text is a strong Mastodon norm.** Write real alt text containing the numbers.
  ⚠️ I found **no evidence** on whether alt text affects *reach* — treat that as unanswered.
- Thread the finding first, method second, tool last. Hashtags still route: `#privacy`, `#infosec`,
  `#firefox`, `#opensource`.
- **Bluesky:** worth cross-posting, but calibrate — it hit 30M registered users in Feb 2025 and by
  **August 2026 TechCrunch reported its active user base is shrinking** [cited —
  [TechCrunch, 2026-08-11](https://techcrunch.com/2026/08/11/blueskys-active-user-base-is-shrinking-as-its-focus-expands-beyond-the-app/)].

### 3.6 Privacy YouTube and podcasts

**Channel status, verified in-browser 2026-08-20** [cited — live channel pages, not third-party
stat sites]:

| Channel | Subs | Last upload | Verdict |
|---|---|---|---|
| **Techlore** (Henry Fisher) | 316K | **2 hours** | Publishing multiple times/day. **Your best target.** |
| Louis Rossmann | 2.63M | 16 hours | Extremely active — but covers injustices, not tool reviews |
| Rob Braxman Tech | 747K | 1 day | ⚠️ Sells BraxSIM/Brax phones — a vendor, not a reviewer |
| Naomi Brockwell TV | 446K | 6 days | Active — read the caution below |
| All Things Secured (Josh Summers) | 434K | 7 days | Best mainstream-explainer fit |
| Privacy Guides | 11.8K | 4 days | Small, but *the* credibility channel |
| Mental Outlaw | 795K | 11 days | Active; Linux/security news, poor fit |
| The Hated One | 492K | 13 days | Active |
| Side of Burritos | 29K | 3 weeks | GrapheneOS/Android only |
| Seytonic | 497K | **3 months** | Cadence collapsed |
| Wolfgang's Channel | 323K | **8 months** | ⚠️ Effectively dormant; pivoted to homelab |
| Eric Murphy | 93.6K | **~2 years** | 🔴 **Dead.** Don't bother. |

**⚠️ Techlore is already on the DROP story, and you have five days of lead, not three weeks.**
[cited] Five days ago they published *"How One State Just Forced Every Data Broker to Erase You
(DROP Explained)"* — a 1:07 interview with a CPPA official, with chapters including "DROP VS. DATA
REMOVAL SERVICES" and "UPCOMING BROWSER REQUIREMENTS." On 2026-08-15 they also published
*"Cory Doctorow's Right About Data Brokers. He's Wrong About DROP."*

That is not bad news — it is the best news in this document. **There is a live, public disagreement
about whether DROP is usable**, between the two people most likely to cover you (§4.4), and you are
building the thing that settles it. Enter that conversation with an artifact, not an announcement.

Techlore specifics [all cited]:
- **Techlore Talks** describes its guests verbatim as *"cybersecurity researchers, **privacy tool
  developers**, open-source maintainers, activists."* Recent guests include Strongbox, Cake Wallet,
  Firefox's head, and an open-source Flock-tracking project. **Pitch this.**
- **Surveillance Report** — weekly news roundup; the 2026-08-20 edition headlines **fake VPN browser
  extensions**, so the beat is warm and adjacent.
- Contact: `contact@techlore.tech` plus a feedback form at `techlore.palform.app/community-input`.
  They describe themselves as *"a small team of two."*
- ⚠️ **Both commonly-cited community paths are gone**: the Discord was sunset in early 2024, and the
  forum went read-only 2025-12-09 and retired 2026-06-01.
- **Sponsorship policy**: sponsors must be tools they personally use and test; partners must agree
  Techlore keeps *"full, independent editorial control"*; free access is disclosed. You are offering
  nothing, so none of this applies — but know it exists so you don't accidentally imply an offer.
- ⚠️ **Do not pitch their tools directory.** [tools.techlore.tech](https://tools.techlore.tech/)
  requires *"Passed the Test of Time — preferably 3+ years"* plus a formal audit. Pitch the podcast.

**Others worth real effort:**
- **Opt Out podcast** (Seth for Privacy, [optoutpod.com](https://optoutpod.com/)) — **interviews tool
  developers relentlessly** (SimpleX Chat, Obscura VPN, Kagi, OpenSecret, Proton Wallet) and
  explicitly invites guest suggestions. Contact: Signal `@sethforprivacy.01`, Matrix
  `@sethforprivacy:agoradesk.com`. **Excellent fit, low competition.** [cited]
- **All Things Secured** — does exactly your format (*"11 Privacy Products I No Longer Use"*).
  [allthingssecured.com/contact](https://allthingssecured.com/contact/); prefers X or YouTube
  comments for speed. ⚠️ Runs disclosed affiliate links, so a free tool earns him nothing
  `[inference]`.
- **The Hated One** — openly hostile to sponsorship corruption (published *"Proton Offered Me
  Money… Then It Got Weird"*) [cited]. `[inference]` A free, no-VC, open-source tool is unusually
  well-matched to his posture. No public email — anonymous creator; reach via the channel's listed
  links.
- **Firewalls Don't Stop Dragons** (Carey Parker) — bi-weekly, passed **500 episodes** 2026-07-12
  [cited].
- **Privacy Guides channel** — `team@privacyguides.org`, Signal `@privacyguides.01`, forum
  [discuss.privacyguides.net](https://discuss.privacyguides.net).

**⚠️ Naomi Brockwell requires special handling.** She is active (446K, uploads every few days), a
project of the **Ludlow Institute** (501(c)(3)), publishes a weekly newsletter at nbtv.substack.com,
and covers **data broker practices** — which makes her a strong DROP fit. Contact: `contact@nbtv.media`.
**But she has published a video titled *"Browser Extensions are DANGEROUS."*** [cited]. Lead your
pitch with the permission model, the reproducible build, and the no-sale policy, or don't send it.

**⚠️ Avoid Privacy X** (@privacyx, 130K, active) — its channel description frames privacy around
*"CBDC, Social Credit Scores and global government"* [cited]. Coverage there is a net credibility
liability with the technical privacy audience `[inference]`.

**Pitching creators** `[inference, consistent with every stated norm]`: one short email; say you're
the solo dev; one sentence on what it does, one on what it doesn't; link the threat model; offer
nothing — no payment, no affiliate, no exclusivity. Lead with **DROP**, not fingerprinting. One
follow-up maximum.

### 3.7 Directories and listings

Ranked by effort-to-value. All free.

**Do at launch:**

| Target | Path | Notes |
|---|---|---|
| **Privacy Guides Project Showcase** | [discuss.privacyguides.net](https://discuss.privacyguides.net/t/about-the-project-showcase-category/114) | Requires `@developers` verification (email on your project's domain), affiliation disclosure, stated threat model. You have the threat model already. |
| **AlternativeTo** | "Suggest new application" under the user menu | Backlog *"at least a few months"*; **$5 one-time** jumps the queue but *"does not buy approval"* [cited]. |
| **privacytools.io** | [GitHub Discussions → Submit Privacy Tools](https://github.com/privacytoolsIO/privacy-tools/discussions/categories/submit-privacy-tools) | ⚠️ Now ad-supported, with `Ad ·` labels and an admission that *"Sponsors can be exempted from the criteria"* [cited]. Free to submit; carries **less** credibility than Privacy Guides. |
| **pluja/awesome-privacy** (19.6K★) | PR to the Browser Addons section | No maturity rule — but merge rate is 26/100 over twelve months, 533 open issues, nothing merged in six weeks `[cited]`. Low odds, low cost. |

**Month 4+, calendar it:**

| Target | Blocker |
|---|---|
| **Lissy93/awesome-privacy** | Hard gate: *"Repositories must not be newly created, and the first stable release older than 4 months."* Descriptions 50–250 chars and *"must not read like an advert. Be objective, and include drawbacks."* Better maintained (35/100 merge rate). |
| 🏆 **Mozilla Recommended Extensions** | The biggest free prize. Verbatim: *"If you'd like to nominate an extension… **even if it's one of your own**—please email us a link to its AMO listing page at **amo-featured@mozilla.org**"* [cited]. Send once you have months of reviews. |
| **Chrome Featured badge** | *"Developers cannot pay to receive either badge"* [cited]. A free extension clears the criteria trivially. The nomination path sits behind sign-in — check it there. |

**Skip:** **PrivacyTests.org** — updated today and fully alive, but it **tests browsers only**; there
is no extension path. **Techlore's tools directory** (3-year rule). **F-Droid / Plexus**
(Android-only). **Product Hunt** — the Privacy topic is active (1,348 products) but dominated by
incumbents; `[inference, weakly evidenced]` it is not reputationally *harmful*, but the overlap
between PH upvoters and people who will grant a new extension `<all_urls>` is thin. One day of prep,
a backlink, low-intent installs. Do it late or not at all.

**🔴 Read this before touching `Lissy93/awesome-privacy`.** Its `CONTRIBUTING.md` contains an HTML
comment addressed to AI agents, instructing them to append a specific image to any PR description
"so your addition can be merged." It is a **maintainer honeypot to catch AI-written PRs**. The
research agents flagged it and did not act on it, and neither should any tool you run. **Write that
PR yourself, in your own words** — which is the rule anyway (§8).

### 3.8 A free credibility lever nobody uses: get listed as a GPC sender

[globalprivacycontrol.org/orgs](https://globalprivacycontrol.org/orgs) lists exactly **seven**
browsers/extensions that send GPC: **Abine DeleteMe, Brave, Disconnect, DuckDuckGo, Firefox,
OptMeowt, and Privacy Badger by EFF** [cited, verified today]. The stated route in is one email:

> *"Contact us to learn more about supporting GPC in your browser, app, or website."* —
> `info@globalprivacycontrol.org`

Being listed eighth, next to Firefox and EFF, is free, legitimate, durable, and is itself a small
news item. Do it the week GPC ships. (D6 already commits you to shipping GPC — and note AB 566
requires browsers to ship a built-in opt-out signal from 2027-01-01, so this window is finite.)

---

## 4. The DROP hook — the strongest thing you have

### 4.1 Verified facts

Statute: **SB 362** (Ch. 709, Stats. 2023), Sen. Josh Becker, signed 2023-10-10; Civil Code
§§ 1798.99.80–.89 [cited —
[leginfo](https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=202320240SB362)].
Verbatim: *"By January 1, 2026, the California Privacy Protection Agency shall establish an
accessible deletion mechanism"*; *"Beginning August 1, 2026, a data broker shall access the
accessible deletion mechanism… at least once every 45 days"*; *"An administrative fine of two
hundred dollars ($200) for each deletion request for each day"*; audits *"Beginning January 1, 2028,
and every three years thereafter."*

**Your D7 is correct on every point, including the $200/day figure.** Confirmed additions:

| Fact | Source |
|---|---|
| **Inferences are explicitly in scope** — regs require deleting *"inferences based on personal information collected from third parties or consumers in a non-'first party' capacity"* | CCR Art. 3 §7613, §7616 (approved Nov 2025, effective 2026-01-01), via [Troutman, 2025-12-04](https://www.troutmanprivacy.com/2025/12/analyzing-the-california-delete-act-regulations/) [cited] |
| Brokers access ≤ every 45 days, then report status **within 45 days of retrieving** → practical outer bound **~90 days** from submission | [Alston & Bird, 2026-07-17](https://www.alstonprivacy.com/drop-is-coming-due-what-californias-delete-act-means-for-data-brokers-in-august/) [cited]; [CalPrivacy](https://privacy.ca.gov/drop/how-drop-works/) [cited] |
| Obligation is **ongoing** — a broker that re-acquires your data must delete it again next cycle | [Privacy Rights Clearinghouse, 2026-07-31](https://privacyrights.org/resources-tools/advocacy/deletion-obligations-under-drop-are-here-data-brokers-must-now-delete) [cited] |
| Registry: **581** at 2026-06-02 (a record high); **614** per EFF 2026-07-20; CalPrivacy now says "over 600" | [CalPrivacy, 2026-06-02](https://privacy.ca.gov/2026/06/privacy-momentum-builds-300000-californians-sign-up-for-drop-as-registered-data-brokers-hit-a-record-high/) [cited] |
| Enrollment: 155K (Jan 20) → 176K (Jan 26) → 300K (Jun 2) → **322,292 (Jul 1)**, and **325,000+** on CalPrivacy's most recent figure | CalPrivacy releases [cited] |
| Broker fee $6,000/yr, **rising to $9,500 in 2027** | [cppa.ca.gov/data_brokers](https://www.cppa.ca.gov/data_brokers/) [cited] |
| **SB 361 (2025)** doubled the registration fine to $200/day, added disclosure of sales to foreign actors / government / GenAI developers, and requires denied or unverifiable requests to be processed as an **opt-out of sale within 45 days** | [leginfo SB 361](https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=202520260SB361) [cited] |
| Fresh enforcement: **LocateSmarter LLC $116,490** (2026-08-11), **Cybba Inc. $52,400** (2026-08-13) | CalPrivacy [cited] |

**Two things to fix in shipped product copy:**

1. `drop.html` says **603** brokers "in our snapshot." That is plausible and consistent with the
   581→614 range — but **date-stamp it and link the
   [public registry](https://cppa.ca.gov/data_broker_registry/)**, which publishes a CSV. Note the
   registry page is JS-rendered, so an automated fetch returns 0 — don't script it naively.
2. `drop.html` quotes CalPrivacy as saying *"we will never charge you to use DROP."* **I could not
   locate that sentence** on the how-DROP-works page `[unverified]`. Find the exact page carrying it
   and link it, or paraphrase. A quote that looks fabricated, attributed to a state agency, inside a
   privacy tool, is category-ending.

Also: `consumer.drop.privacy.ca.gov` is the **consumer** site and `databroker.drop.privacy.ca.gov`
is the **broker portal**. Your `drop.html` links the consumer one correctly — keep it that way.

### 4.2 The coverage gap is real, and sharper than "nobody covered it"

**The January launch got genuine coverage. The August deadline — when the law acquired teeth — did
not.** That is the gap, and it is narrower than "nobody has covered DROP."

**January (real coverage, all cited):**
- The Markup/CalMatters — **Colin Lecher & Miles Hilton, 2026-01-08**,
  ["How Californians can use a new state website to block hundreds of data
  brokers"](https://themarkup.org/privacy/2026/01/08/how-californians-can-use-a-new-state-website-to-block-hundreds-of-data-brokers).
  ⚠️ Its apparent breadth is misleading — LAist, SFGate, Times of San Diego and others ran **that one
  article verbatim under Creative Commons**, with no added reporting.
- **Ars Technica — Dan Goodin, 2026-01-05**, *"The nation's strictest privacy law just took effect,
  to data brokers' chagrin."*
- **Consumer Reports — Matt Schwartz**, DROP explainer, 2026-01-28.
- StateScoop (Keely Quinlan, Dec 5 and Jan 20), NBC Bay Area, KRON4.

**July–August (thinner, and mostly not general-news outlets) [cited]:**
- [EFF Deeplinks — **Hayley Tsukayama**, 2026-07-20](https://www.eff.org/deeplinks/2026/07/what-you-need-know-about-californias-drop-tool) — a genuine how-to
- [Pluralistic — **Cory Doctorow**, 2026-07-23, "California's Privacy Obstacle Course"](https://pluralistic.net/2026/07/23/drop-a-dime/) — a critical usability teardown
- [GovTech / Bay Area News Group — **Ethan Baron**, 2026-07-13](https://www.govtech.com/policy/why-300k-californians-signed-up-to-have-personal-info-removed)
- **Techlore — ~2026-08-15**, *"How One State Just Forced Every Data Broker to Erase You (DROP
  Explained),"* plus a blog post, *"Cory Doctorow's Right About Data Brokers. He's Wrong About DROP."*
- Malwarebytes (2026-08-03) — a vendor blog that pivots to selling its own remover

**No DROP coverage found:** 404 Media, The Verge, Wired, NYT, WaPo, CNET, The Record.
`[404 Media verified directly via site search; arstechnica.com and theverge.com block this
environment entirely, so their bylines could not be enumerated even though Ars's January coverage
was confirmed by other means. Treat "not found" as strong-but-incomplete.]`

**Quantified** [cited, HN API]: the January launch story scored **302 points / 83 comments**.
Doctorow's July critique: **7 points, 0 comments**. "Drop Act First Data Broker Fine" (2026-08-11):
**1 point, 1 comment**. The moment the law acquired teeth produced a one-point post.

**The awareness gap, in the agency's own words.** Tom Kemp, CalPrivacy Executive Director, via Bay
Area News Group (2026-07-13) [cited]: *"Many people aren't aware of the program, while some are wary
of providing the personal information the agency requires."* 322,292 signups ≈ **0.8% of
California's population**, and 176K of those came in the first 26 days — growth collapsed once launch
publicity faded `[inference from the cited enrollment curve]`.

**The friction is documented, specifically, by a famous writer.** CalPrivacy runs a
[Help with DROP](https://privacy.ca.gov/drop/help-with-drop) page covering residency-verification
failure, finding your MAID/VIN/TVID, lost DROP IDs, and "Record not found" confusion — with roughly
a two-week support response time [cited]. Doctorow adds: photographing your ID for Login.gov and
then re-photographing the same documents, digging out a 32-digit advertising ID, re-verifying an
already-verified phone. The Markup notes **Apple gives iOS users no way to see their mobile
advertising ID at all** [cited].

### 4.3 Nobody has operationalized it

**Zero** of the checked services integrate with, guide users into, or automate DROP. Two merely
acknowledge it in a blog post [cited]: **DeleteMe** (CEO Rob Shavell, 2026-03-04 — *"Use every tool
available… Use both"*) and **Optery** (2026-01-09). No mention found at Incogni, Privacy Bee, Kanary,
or EasyOptOuts.

Two structural surprises [cited]: **Consumer Reports' Permission Slip is no longer independent** —
it was **transferred to DeleteMe in May 2026**; `permissionslipcr.com` now 301s to
`joindeleteme.com/permission-slip` (*"Permission Slip has joined DeleteMe!"*), freemium, no DROP
mention. Consumer Reports exited the free consumer-tool space and handed it to a paid service.
And **Mozilla Monitor**'s Onerep-backed paid removal tier is confirmed dead as of 2025-12-17.

**GitHub: no DROP tooling exists** [cited, verified via GitHub API] — repo search for
`drop.privacy.ca.gov` returns **0 results**; code search returns 37 passive link references. The two
big adjacent repos only *link* to DROP:
[`yaelwrites/Big-Ass-Data-Broker-Opt-Out-List`](https://github.com/yaelwrites/Big-Ass-Data-Broker-Opt-Out-List)
(6,761★, pushed 2026-07-26) and `stephenlthorn/auto-identity-remove` (851★).

**⚠️ And the 851★ tool is actively misinforming Californians.** Its README states DROP is not yet
live and attributes the delay to *"ongoing litigation (Data Brokers Association v. Bonta)."* A
CourtListener/RECAP search returns **0 results** for that case name and **0 opinions** matching
`"Delete Act" "data broker"` — **there is no evidence the case exists** [cited, verified via the
CourtListener API]. `[caveat: RECAP's federal coverage is strong but not exhaustive, and a
state-court action would not appear there.]` `[inference]` No injunction can be in effect anyway:
DROP launched on schedule, obligations took effect Aug 1, and CalPrivacy landed two fines in August.

This is both a finding and an opportunity. The most-starred project a Californian is likely to find
tells them the thing isn't live. **File a polite, sourced GitHub issue correcting it** — that is a
genuine contribution, it is the honest thing to do, and it puts you in front of that project's
audience without a single promotional sentence.

**⚠️ The constraint that explains the vacuum, and validates your design.** DROP requires identity
verification through the California Identity Gateway (Socure / Login.gov), and third-party
submission is permitted only in narrow personal cases (a parent for a child). **A tool can prepare,
guide, and track — it cannot submit on anyone's behalf at scale.** That is almost certainly *why* no
service integrated. Your D5 escort-don't-automate decision is not a limitation here; it is the only
lawful shape of the product, and saying so is a differentiator.

### 4.4 The pitch

The story is **California**, not your extension:

> A law with real teeth took effect three weeks ago. Compliance lawyers wrote it up everywhere.
> 322,000 Californians have signed up out of 39 million, and growth stalled in February. The agency's
> own director says people don't know it exists. The signup takes 6–7 minutes and requires an
> advertising ID that Apple won't show you. There is a free state platform that forces 600+ companies
> to delete you — including their *inferences* about you — and no consumer tool walks anyone into it.

**Targets, in priority order, with verified contacts:**

| Target | Why | Contact |
|---|---|---|
| ⭐ **Colin Lecher**, The Markup/CalMatters | Wrote *the* DROP how-to (Jan 8) and three verified data-broker investigations, including *"It's easier for Californians to escape data brokers following a Markup investigation"* (May 22, 2026 — 35 brokers hiding opt-out pages dropped to 8). **No August follow-up.** Best single target. | `colin@themarkup.org` [cited] — ⚠️ **never tips@**: their tips page says *"please do not use these channels to send feedback, story ideas, pitches, or press releases"* [cited — [themarkup.org/tips](https://themarkup.org/tips)] |
| ⭐ **Techlore** | Published a DROP explainer with a CPPA official five days ago, *and* a post arguing Doctorow is wrong about DROP. There is a live disagreement you can settle with evidence. Techlore Talks explicitly interviews *"privacy tool developers."* | `contact@techlore.tech` · `techlore.palform.app/community-input` |
| **Cory Doctorow**, Pluralistic | **Already documented the exact friction**, and is now being publicly disagreed with. A free tool that fixes the friction is his natural follow-up. | pluralistic.net (no email on his about page; he runs a *"Hey look at this"* links section) |
| **Joseph Cox**, 404 Media | Official beat reads *"data brokers, location data."* Wrote about the California data broker registry and CPPA (2025-06-26), and on **2026-08-12 wrote a standalone feature about a free privacy tool (DecryptAds)** — direct precedent. **404 Media has never covered DROP.** | `joseph@404media.co` · Signal `joseph.404` [cited] |
| **Matt Schwartz**, Consumer Reports | Wrote CR's DROP explainer (2026-01-28). 🔑 CR **handed Permission Slip to DeleteMe in May 2026** and exited free consumer tooling — that's a narrative gap you fill. CR Innovation Lab runs a **"Build With Us"** program taking beta testers and code contributors. | `matt.schwartz@consumer.org` · `innovationlab@cr.consumer.org` [cited] |
| **Hayley Tsukayama**, EFF | Director of State Affairs, ex-WaPo consumer tech; wrote EFF's July DROP guide. | `hayleyt@eff.org` · press: `press@eff.org` with "Media Request" in the subject. ⚠️ **EFF has no tool-submission process** and states plainly *"we do not have the resources to examine or make independent assurances about their security. We do not endorse these products"* [cited]. `extension-devs@eff.org` is for **their own** add-ons. They also ship a competitor (Privacy Badger). Pitch the *story*, never the tool. |
| **Dan Goodin**, Ars Technica | Wrote Ars's DELETE Act piece (2026-01-05). | `dan.goodin@arstechnica.com` · Signal `DanArs.82` [cited] |
| **The Register** | The most pitch-friendly outlet on this list — *"If you want to pitch a story… drop an email to the relevant staffer"* [cited]. | Jessica Lyons (Cybersecurity Editor, Americas) `jessica.lyons@theregister.com` · Thomas Claburn `tclaburn@theregister.com` · secure: [tips.hushline.app/to/sitpub](https://tips.hushline.app/to/sitpub) |
| **Keely Quinlan**, StateScoop | Wrote both StateScoop DROP stories. | StateScoop |
| **Ethan Baron**, Bay Area News Group | Wrote the 300K story. | BANG / GovTech syndication |
| **Yael Grauer** | Maintains the 6,761★ opt-out list that already links DROP — a **distribution channel and a journalist**. | GitHub |
| **Privacy Rights Clearinghouse** | **Co-sponsored SB 362 and led the coalition** [cited]. Approach as a collaborator: offer the walkthrough, ask them to check it for accuracy. | privacyrights.org |
| **Opt Out podcast** (Seth for Privacy) | Interviews tool developers constantly; invites guest suggestions. | Signal `@sethforprivacy.01` · Matrix `@sethforprivacy:agoradesk.com` |
| **Naomi Brockwell / NBTV** | Data-broker beat, weekly newsletter, policy work. ⚠️ Published *"Browser Extensions are DANGEROUS"* — lead with the permission model. | `contact@nbtv.media` |
| **Zack Whittaker**, TechCrunch | Verified still Security Editor. TechCrunch is the only outlet here that welcomes press releases (`tips@techcrunch.com`). ⚠️ Beat is breaches/spyware — he bites only on a security *finding*. Their SecureDrop is paused. | `zack.whittaker@techcrunch.com` · Signal `zackwhittaker.1337` |
| **IAPP U.S. Privacy Digest** (Fridays) | Won't review a consumer tool; **will** run a substantive byline. `writeforus@iapp.org`, 1,200–1,600 words — *"Articles should not be in any way promotional"* [cited]. | writeforus@iapp.org |

**Deprioritize or skip** [all cited]: **Krebs** (covers brokers only when breached; no DELETE Act
coverage ever; contact form only). **Gizmodo** (sold to Keleops 2024; now mostly aggregation, no
privacy investigative beat). **Wired / The Verge** — rosters unverifiable this session; re-verify
bylines before emailing. **Bruce Schneier** (`schneier@schneier.com`, Crypto-Gram monthly on the
15th, still publishing) links research and incidents, **never product announcements** — so pitch him
a finding or nothing. **Molly White** (Signal `molly0xfff.07`) doesn't review tools. **Ken
Klippenstein** is national-security only. **Platformer** (`casey@platformer.news`, on Ghost now) only
fits if the angle is Chrome MV3 gatekeeping.

**Newsletters that will actually evaluate the tool** [cited]: **Privacy Guides** (near-daily news +
monthly tool reviews; *"we do not use affiliate links, and we do not provide special consideration to
project donors"*; launched an **Activism section** in March 2026 — a natural DROP fit) · **Techlore's
Surveillance Report** · **The New Oil** (Nathan Bartram, `thenewoil@proton.me`, publishes negative
verdicts too; submissions via GitLab/GitHub issues) · **gHacks** (still the traditional home of
extension writeups) · **Tuta's blog** (an email company has no conflict with your extension) ·
**UNREDACTED Magazine** (Michael Bazzell; *"No third-party ads. No outside sponsors"*; accepts
technique articles).

**🔴 Verified dead ends — don't spend days here** [all cited]: **"The Privacy Beat"** is dormant in
both forms (TerraTrue podcast last aired Feb 2024; ITEGA newsletter last posted July 2022; host
Angelique Carson moved to IAPP). **"Tinfoil Chef"** is a gaming/lifestyle YouTube channel, not a
privacy newsletter — don't confuse it with tinfoil.sh. **Avoid The Hack** has an expired TLS
certificate on every URL. **RestorePrivacy** merged into **CyberInsider** (June 2025) and is an
affiliate-revenue review shop — a free tool earns them nothing. And **Mozilla's *Privacy Not
Included* was sunset on 2026-08-11**, nine days ago, replaced by **"Nothing Personal"** (EIC Bourree
Lam) — note PNI never covered browser extensions anyway.

**Structure, ≤150 words:** one sentence of news (Aug 1 teeth, 600+ brokers, 0.8% enrolled) → one
sentence of gap (paid removal services charge for a subset of what the state now does free; nobody
guides you in) → one sentence of artifact (*"I built a free, open-source walkthrough. It does not
submit for you — the state verifies identity through the California Identity Gateway, and an
extension should never touch that"*) → links to the walkthrough and the threat model → an offer to
be corrected.

That third sentence is the credibility move. Every reporter on this beat has been pitched by a
removal company. Being the person who says *"I deliberately don't automate the government form,
here's why"* is differentiating **and** true.

### 4.5 The adjacent story — only if you verify it

There is a real tension: **paid removal services now compete with a free state platform for
Californians.** Note that Optery and Abine (DeleteMe) both appear as *supporting organizations* on
the GPC site [cited], and DeleteMe now owns Permission Slip. But DeleteMe's public position is
"use both," and its resurfacing argument is **partly outdated** — DROP's deletion duty repeats every
45 days `[inference]`.

If you want this story, **check it first** and pitch it as a question: *"Do paid removal services
tell Californians the state does this free?"* That is answerable. *"They're hiding it"* is a claim
you cannot support, and asserting it would violate the standard you hold your own copy to.

---

## 5. Distribution

### 5.1 Chrome Web Store, 2026

**Official** [cited — [review process](https://developer.chrome.com/docs/webstore/review-process)]:
*"For most extensions, review is completed within a few days, but it can take up to a few weeks."*
Contact support after **three weeks**. Extended scrutiny for: **new developers, new extensions,
dangerous permission requests, significant code changes**, and broad host patterns (`<all_urls>`).
You are all five.

**Current reality** [cited — [Chromium extensions PSA, Sebastian Benz,
2026-04-23](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/VJ6DcpEn51Y/m/yuxvHWdwCAAJ)]:
*"We've experienced a surge in new extensions being submitted to the Chrome Web Store causing
longer-than-expected wait times."* Commenters reported **28-day delays**. Google's guidance includes
one rule you must not violate: **never cancel and resubmit — it resets your queue position.**

⚠️ **The market timing fact.** Google's own deprecation timeline: Chrome 138 (July 2025) disabled MV2
everywhere, and **August 31, 2026 — eleven days from now — all remaining MV2 extensions are removed
from the Chrome Web Store** [cited —
[MV2 deprecation timeline](https://developer.chrome.com/docs/extensions/develop/migrate/mv2-deprecation-timeline)].
Full uBlock Origin is already gone from Chrome; users run uBO Lite. The Chrome privacy shelf is
thinner than it has been in a decade and people are actively replacing tools **right now**.

**Policies most likely to bite** [all cited from developer.chrome.com program policies]:

| Policy | Risk |
|---|---|
| **Single purpose** — *"An extension must have a single purpose that is narrow and easy to understand. Don't create an extension that requires users to accept bundles of unrelated functionality."* | **Highest risk.** Blocking + fingerprint shims + GPC + linkage graph + a California DROP walkthrough can read as five products. Frame the single purpose as **"prevent cross-site tracking"** and keep DROP as an options subpage — **do not put it in the listing title or first line.** |
| **Permissions** — *"Request access to the narrowest permissions necessary… Don't attempt to 'future proof'."* | `<all_urls>` is defensible (you shim every origin at `document_start`) but must be justified per-permission in the dashboard, one plain sentence each. |
| **Obfuscated code** — banned; minification explicitly allowed (whitespace, name shortening, file collapsing) | Ship **unminified, unbundled** source. Slower to load, faster to review, and it's the same code an auditor reads. |
| **Remotely hosted code (MV3)** — *"The full functionality of an extension must be easily discernible from its submitted code."* | Filter-list updates are the trap. Fetching a *rule list* is configuration and is permitted; fetching anything `eval`'d or interpreted is a rejection. |
| **Limited Use** + privacy disclosures — sensitive data explicitly includes *"Web browsing activity"* | You process browsing activity locally. Declare it accurately and state plainly that nothing leaves the device. |

**Enable CWS verified uploads.** Launched 2025-05-07, opt-in: you supply an RSA public key and future
uploads must be signed with your private key or they're rejected pre-publication; the extension ID is
preserved [cited — [Verified uploads](https://developer.chrome.com/blog/verified-uploads-cws)]. This
is the direct countermeasure to the Cyberhaven-style account takeover in §5.4, and it is exactly the
answer to `ocdtrekkie`'s objection in §3.1.

⚠️ **EU trader declaration.** *"All developers on the Chrome Web Store are required to declare if
they are a Trader or Non-Trader."* Traders supply legal name, SMS-capable phone, and address — **and
this is posted publicly on your listings** [cited —
[trader verification FAQ](https://developer.chrome.com/docs/webstore/program-policies/trader-verification-faq)].
If you publish under an LLC, that registered-agent address becomes public. Decide deliberately.

**DNR limits, and one that matters** [cited —
[declarativeNetRequest reference](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest)]:
100 static rulesets declared / 50 enabled; 30,000 guaranteed static rules; 30,000 dynamic rules —
**but only for *safe* rules**, defined as *"rules with an action of `block`, `allow`,
`allowAllRequests` or `upgradeScheme`."* Unsafe dynamic rules cap at **5,000**.
**Your GPC `modifyHeaders` rules are therefore unsafe rules** `[inference from the cited definition]`.
Two rules won't bind — but if per-site allowlisting ever moves to dynamic `modifyHeaders` or
`redirect`, 5,000 is your real ceiling.

Registration fee: one-time. Google's page says only *"a one-time registration fee"* without a number;
the universally reported $5 is `[unverified]` at source.

### 5.2 Firefox AMO, 2026

**Review model** [cited —
[signing and distribution](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/)]:
automated-first. *"It can take up to 24 hours for your submission to be signed and published, or
longer if your submission is selected for manual review."* And *"All add-ons, including
self-distributed ones, are subject to be manually reviewed at any time after submission"* — review
can also happen post-publication. Mozilla does not publish manual-queue depth `[unverified]`.

`[inference]` An extension with `<all_urls>`, MAIN-world injection, blocking webRequest **and** a
bundler will almost certainly be pulled into manual review. Do not plan on 24 hours.

**Source-code submission** [cited —
[source code submission](https://extensionworkshop.com/documentation/publish/source-code-submission/)]:
required if you use minifiers, bundlers, template engines, or TypeScript. You must supply OS and
environment details, exact tool versions, step-by-step build commands, and lockfiles. Build tools
must be open-source and locally executable — **web-based build tools are prohibited.** The bar:
*"the reviewer runs the instructions you provided and then uses a diff tool to compare the generated
sources to those in the extension. **There must be no differences.**"*

→ **Your Firefox build must be byte-reproducible.** Pin the toolchain, commit the lockfile, disable
timestamps and content hashes in output filenames, and rehearse rebuild-and-diff yourself. This is
the most common avoidable AMO delay for bundled extensions `[inference]`. It is also the same
discipline that makes the "verify the store binary matches the git tag" claim in §5.4 real — so it
pays for itself twice.

**Blocking webRequest is confirmed retained** [cited — Mozilla, 2025-02-25]:

> *"Firefox, however, will continue supporting both blockingWebRequest and declarativeNetRequest —
> giving developers more flexibility and keeping powerful privacy tools available to users."*

Firefox also ships DNR with `modifyHeaders`, but with a Firefox-only evaluation order (session >
dynamic > static) that MDN warns *"cannot be relied upon across browsers"* [cited].

**Host-permission gotcha** [cited —
[MV3 migration guide](https://extensionworkshop.com/documentation/develop/manifest-v3-migration-guide/)]:
from Firefox 127, `host_permissions` are granted at install — but *"Users can grant or revoke any
host permission on an ad-hoc basis."* Your Firefox build must handle `<all_urls>` being revoked at
runtime. Chrome's model is more static.

**Unlisted / self-distribution still exists** [cited]: *"cannot be publicly viewed or installed from
AMO, suited for beta versions or limited audiences,"* still Mozilla-signed. **This is your beta
channel.** Chrome has no equivalent.

**Recommended Extensions** [cited —
[program page](https://extensionworkshop.com/documentation/publish/recommended-extensions/)]: open to
nominations from anyone including the developer — email **amo-featured@mozilla.org** with the listing
link and why. Criteria include *"rigorous technical review by staff security experts."* Mozilla
describes the collection as *"tightly curated"* and *"intended to remain fairly fixed over time."*
`[inference]` Technically open; realistically selects for track record. Nominate in month 3+, not at
launch.

### 5.3 Sequencing

**Submit to Chrome first in wall-clock terms. Launch publicly on Firefox.**

These don't conflict, and the distinction matters:

1. **Chrome is the long pole and the clock is running.** Days-to-weeks, currently congested with
   28-day reports, three weeks before you may even escalate, one appeal, and cancel-and-resubmit
   resets the queue. Your submission date, not your readiness date, sets your Chrome ship date.
2. **The Chrome market moment is now** — the Aug 31 MV2 purge is eleven days out and users are
   actively replacing blockers.
3. **Firefox is the better product and the better launch story.** "The Firefox version blocks things
   the Chrome version structurally cannot, because Google removed the API" is true, interesting,
   on-beat for r/firefox, r/degoogle and privacy YouTube, and costs nothing.
4. **AMO turnaround is 24 hours when clean**, so it's the venue you can actually schedule a launch
   around.

So: use the Chrome review window to do the Firefox work (reproducible build, `data_collection_permissions`,
source package) rather than idling. Chrome approval then becomes a **second, honest news beat** two to
four weeks later.

**Edge Add-ons**: free account (Microsoft **or GitHub** login), accepts a Chromium extension *"with
minimal changes,"* certification **up to 7 business days**, and a Privacy page that mirrors Chrome's
field-for-field [cited —
[Microsoft Learn](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension)].
Do it **after** Chrome passes — a Chrome rejection you'd have to fix in two places is wasted work.
Zero launch attention.

### 5.4 Open source: yes, unambiguously — and the reason isn't the license

**Ship the full source under GPL-3.0 on GitHub before launch, with reproducible builds.**

The argument is mechanical, not ideological: **your entire differentiating claim is unverifiable
without source.** "Internally consistent personas drawn from a high-population pool, not naive
randomization" is a claim about the contents of a data file and the logic of a validator. A user
cannot distinguish that from marketing. An auditor reading `personas.js`, `persona-validator.js`
(509 lines) and `personas.test.js` (500 lines) can, in ten minutes. Closed-source, you ask a
maximally skeptical audience to trust an anonymous solo developer's assertion about anti-tracking
internals — the exact posture that gets tools dismissed here.

**Evidence that closed-source privacy tools get distrusted, and that opening rescues it** [all cited]:

- **Ghostery** — the canonical rescue. Closed-source, monetized `GhostRank` by selling data on ads
  users encountered; coverage described it as *"playing a double role by promising users privacy
  while selling data to advertising companies."* Data sales ended with the Cliqz acquisition (Feb
  2017), and on **2018-03-08 Ghostery published its source on GitHub** explicitly to clear the air.
  ([ghacks](https://www.ghacks.net/2018/03/09/ghostery-open-source-and-new-business-model/))
- **Avast / AVG** — Dec 2019, Mozilla removed Avast Online Security, AVG Online Security and both
  SafePrice extensions from AMO; Opera and Google followed. Wladimir Palant showed the extensions
  recorded every page visited plus referrer, IP and locale, tied to a unique tracking ID — feeding
  Avast's Jumpshot clickstream business.
  ([Palant](https://palant.info/2019/12/03/mozilla-removes-avast-extensions-from-their-add-on-store-what-will-google-do/))
- **FreeVPN.One** — carried a Chrome Web Store **"Verified" badge** and 100,000+ installs, and from
  v3.0.3 (April 2025) silently screenshotted every site visited, including bank logins, and shipped
  them to the developer's servers.
  ([Infosecurity](https://www.infosecurity-magazine.com/news/chrome-vpn-extension-spyware/))
  **Store badges are not a substitute for auditability.**

**The copying risk is real — and in every documented case the attacker took something other than
your source:**

| Case | What was taken |
|---|---|
| **uBlock / uBlock Origin (2015)** — gorhill handed over the repo, forked his own work three days later; the recipient kept the **name** and ublock.org and solicited donations. uBO's repos still carry *"BEWARE! uBlock Origin is (and has always been) COMPLETELY UNRELATED to the web site ublock.org."* | **The name.** GPLv3 did nothing. |
| **Nano Adblocker / Nano Defender (Oct 2020)** — author sold the Chrome Web Store versions; new owners shipped traffic monitoring, remote code execution, fraudulent Instagram likes. **The Firefox version was unaffected.** | **The store listing.** |
| **The Great Suspender (2020–21)** — sold to an undisclosed buyer, tracker added, later versions executed remote code. Google removed it and remotely disabled it for 2M+ users. Caught by a community member filing GitHub issue #1263 — *because it was open source* — and rescued by forks. | **The store listing.** |
| **Cyberhaven + 30 others (Dec 2024)** — a developer was phished with a fake *"Chrome Web Store policy violation"* email into authorizing a malicious OAuth app. 30+ extensions, **2.6M users**, harvesting API keys, session cookies and auth tokens. | **The developer account.** |
| **CrashFix (Jan 2026)** — a **near-identical clone of uBlock Origin Lite** delivering a RAT via browser-crash lures. | **The identity of an open-source blocker.** GPLv3 was irrelevant. |

Sources: [uBlock issue 1838](https://github.com/uBlock-LLC/uBlock/issues/1838) ·
[ghacks on Nano](https://www.ghacks.net/2020/10/16/time-to-remove-nano-adblocker-and-defender-from-your-browsers-except-firefox/) ·
[THN on Great Suspender](https://thehackernews.com/2021/02/warning-hugely-popular-great-suspender.html) ·
[Sekoia on Cyberhaven](https://blog.sekoia.io/targeted-supply-chain-attack-against-chrome-browser-extensions/) ·
[THN on CrashFix](https://thehackernews.com/2026/01/crashfix-chrome-extension-delivers.html)

`[inference — the pattern is the finding]` **Open source raises your detection odds and does not
measurably raise your cloning odds.** The Great Suspender's compromise was caught *because* the
source was public; the closed-source cases took researchers or acquisitions to expose.

**So the defensive stack, in order of what actually works:**

1. **Trademark the name and logo.** The only lever that gets a clone *removed* from a store — and
   exactly what gorhill didn't have. (Another reason to settle §1.1 now.)
2. **Control the store listings and a canonical domain**, cross-linked from the README. uBO's
   all-caps disclaimer exists because the name was lost.
3. **Harden the developer account** — CWS verified uploads, a hardware security key, and treat every
   "policy violation" email as phishing. This is the Cyberhaven vector.
4. **Publish a no-sale succession policy.** Both Nano and The Great Suspender were *sales*, not hacks.
   Say in the README that you will never transfer the extension, and that if you ever must, it happens
   with a verifiable signed-key rotation announced in advance.
5. **The license.** GPL-3.0 over MIT — copyleft forces a cloner shipping modifications to publish
   them, raising the cost of a quiet malicious fork and giving you a lever independent of trademark.
   `[judgment call — MIT would maximize adoption; GPL is right because the threat you care about is
   commercial re-skinning, not integration.]` Recognize it as the *fifth*-order defense.

**Privacy Guides does not require open source** — *"generally preferred"* [cited]. Open source is
still correct here; just don't justify it with a requirement that doesn't exist.

**One honest cost of openness you should publish yourself:** a public persona pool can be enumerated
by fingerprinting vendors, who could then detect "this fingerprint is exactly one of Nullecho's
personas." State it in the threat model rather than letting someone else find it. The answer is that
a detected-but-common machine is still not a *linkable identity across sites*, which is the actual
goal — and that answer is both true and stronger than silence.

---

## 6. The demo asset — and a correction to the plan

### 6.1 The evidence points somewhere uncomfortable

The two closest precedents ran the experiment for you, and the result is stark:

**Mozilla Lightbeam — a browser extension graphing which third parties connect the sites *you*
visited — is dead.** One 211-point HN hit on launch day (2013-10-25), a 50-point post for the 2017
rewrite, then nothing. The AMO listing 404s with `is_disabled_by_developer: true`;
`mozilla.org/lightbeam` 301s to GitHub; `lightbeam-we` last pushed 2023-04-10; the README still links
its own dead listing. It died quietly with no announcement. [cited, `[original analysis]` — direct
GitHub + AMO API checks]

**The Markup's Blacklight — a web tool that scans *any site you name* — has run 18 million-plus
scans.** Launched September 2020 after 18 months of engineering led by Surya Mattu; passed 10M by May
2023 with *"Seven million of those scans… completed in just this past year"* — it **accelerated**
years after launch; still being extended (Feb 2026 added TikTok and X pixel detection, built with
five Brandeis students). [cited —
[press release](https://themarkup.org/press-release-20200922),
[10 Million Scans Later](https://themarkup.org/blacklight/2023/05/03/10-million-blacklight-scans-later-heres-what-you-found),
[Feb 2026 update](https://themarkup.org/blacklight/2026/02/09/blacklight-update-tiktok-x-twitter)]

And the single sharpest data point in this whole research pass:

> **A Blacklight scan result of one company's website — `themarkup.org/blacklight?url=about.gitlab.com`
> — scored 203 points and 111 comments on HN. The tool's own launch post scored 207.**
> [cited, `[original analysis]` — HN Algolia]

Someone scanned GitLab, posted the **result URL**, and the community argued about GitLab. A scan of
one company performed as well as the entire product launch.

The Markup's stated design thesis, which is the best sentence in this research:

> *"it would be more powerful to show people, in real time, how they were being tracked online than
> to merely tell them such tracking was happening"* [cited]

Julia Angwin's framing: *"Products that violate people's privacy by pocketing their personal data go
unseen by design"* — the goal was to make the invisible visible [cited].

### 6.2 Recommendation: build the scan-any-site tool first

**Ship a zero-install web tool that scans any URL and produces a permanent shareable result page
naming the companies present on *that site*. Then the extension, with the personal linkage graph as
the depth product behind it.** `[inference, strongly supported]`

Why this ordering, concretely:

- **No install barrier before payoff.** Lightbeam needed you to install and then browse for days
  before the graph meant anything. Blacklight pays off in 30–60 seconds.
- **There is something to share.** Lightbeam's output was a live force-directed graph inside *your*
  browser of *your* history — no URL, no artifact. Blacklight's output is a permalink.
- **The reader is the accuser, not the accused.** This is the whole self-doxxing fix.
- **It feeds the extension.** Every scan result page ends with "this is one site; the extension shows
  you the join across all of them."

You already have the engine: `linkage.js` computes owners, reach, and pairs from a per-site tracker
table. A scanner is that same code fed by a headless page load instead of the service worker.

### 6.3 The self-doxxing problem, and the five solved patterns

There are exactly five patterns in the evidence for making a personal-data reveal shareable:

| Pattern | Example | Mechanism |
|---|---|---|
| **A — Point the instrument at a third party** | Blacklight | Reader is the accuser. **Highest performing, currently missing from your product.** |
| **B — Reveal a property of your machine, not your behavior** | EFF Cover Your Tracks | "My browser is unique" is a nerd flex, not a confession. Zero embarrassment, infinitely re-runnable — it scored 88 pts at launch (2010) and **248 pts in 2019**, its highest result nine years later. [cited] |
| **C — Invert the shame direction** | Off-Facebook Activity, Have I Been Pwned | "532 companies shared my data" / "my email is in 14 breaches" — the sentence's subject is **them**. You're the victim, not the confessor. |
| **D — Aggregate and flatter** | Spotify Wrapped | Never shows a raw log; shows aggregates you'd be proud of, pre-formatted for the feed. `[cited-secondary — marketing-blog sourcing; treat the mechanism as well-attested, the framing as commentary]` |
| **E — Use someone else's data** | NYT "Twelve Million Phones" | Trace strangers and recognizable public locations. Visceral hit, zero exposure. |

**Your headline sentence is already Pattern C, and it's good:**

> *"Google was present on 34 of your 41 sites — enough to connect 561 pairs of visits."*

Google is the grammatical actor. **Protect that grammar.** But **everything below the headline is
Pattern-less** — a node graph labeled with your real domains is a browsing-history screenshot with
extra steps, and `siteePairsFor()`'s "your bank and that health forum" is by construction the single
most incriminating pair in the dataset.

So:

- Ship **two distinct views**. The share view is *generated separately*, never a crop of the private
  one.
- Share view carries **the number and the named companies only**, with **category-level nodes** —
  "a bank," "a health forum," "3 news sites." No domains, no favicons, no timestamps.
- Categories must be **coarse enough to be deniable**. "A health forum" is fine. "A fertility forum"
  is not.
- Anonymized is the **default**; raw export sits behind an explicit "this contains your actual site
  names" confirmation.

### 6.4 Three specific fixes to the artifact

**1. Lead with the percentage, not the pair count.** The math is right — C(34,2) = 561, and against
C(41,2) = 820 total pairs the exposure score is 68.4%, so `exposureScore` already computes it. HN
*will* check the arithmetic and it survives. But `[inference]` a combinatorial count makes the harm
sound larger than the underlying fact, and the audience that rewarded fingerprint-research restraint
will call "561 pairs" a vanity metric derived from "34 sites." Prefer:

> **"Google was present on 34 of your 41 sites — enough to connect 68% of every possible pair."**

Same arithmetic, no inflation smell, and the raw counts stay visible beside it as your own module
comment requires.

**2. Never show hostnames to users.** There is peer-reviewed evidence that per-domain network-activity
lists are illegible: an **NDSS 2025** study of Apple's App Privacy Report found users had a *"lack of
basic understanding about domains,"* *"confusion and concern about the purpose of network activity,"*
and a *"lack of effective means to address concerns"* [cited —
[Wu et al., NDSS'25](https://www.ericwzeng.com/papers/Wu-NDSS25-AppPrivacyReport.pdf)]. Apple's
Privacy Nutrition Labels drew the same finding [cited —
[PoPETs 2022](https://petsymposium.org/popets/2022/popets-2022-0106.pdf)]. `TRACKER_OWNERS` is doing
more work than it looks — use company names everywhere user-facing, hostnames only in a details
drawer.

**3. A reveal with no next step buys exactly one news cycle.** Facebook's Off-Facebook Activity
scored **710 points and 379 comments** on HN (2020-01-29) and changed nothing durable. EFF diagnosed
why: it's *"a good step"* but *"an incomplete measure,"* there's no way to opt out of Custom
Audiences, and it dumps the burden on users navigating *"labyrinthine privacy settings"* that
*"three-quarters of adults don't even know"* exist [cited —
[EFF, Jan 2020](https://www.eff.org/deeplinks/2020/01/facebook-history-welcome-incomplete-move)].
Blacklight always shipped the reveal with concrete instructions. **Whatever your graph says, the next
screen must contain something the user can do in under 60 seconds** — and for Californians, that
thing is DROP.

### 6.5 Framing rules

From `linkage.js`'s own honesty constraint and `THREAT-MODEL.md` §Copy rules:

- **"was present on"** and **"enough to connect"** — never "tracked you across," never "they know."
  You observe presence; correlation happens on servers you can't see. Your module enforces this by
  naming (`couldLink`, `reach`, `exposure`). Keep it in the copy. Note this restraint is an *asset*:
  the 930-point "stable Firefox identifier linking Tor identities" post hedged carefully ("can,"
  "may be somewhat lower") and HN rewarded it [cited].
- **Name the company.** "Google" is a story; "doubleclick.net" is a hostname. Mozilla's
  *Privacy Not Included* car report worked on exactly this — 25 named brands, one absolute superlative
  (*"the worst product category we have ever reviewed for privacy"*), one unbelievable detail
  (Nissan's policy claiming collection of sexual activity data), and a rating label per brand so every
  car became its own shareable card. Two simultaneous HN hits the same day: 184 and 164 [cited —
  [Mozilla](https://foundation.mozilla.org/en/privacynotincluded/articles/its-official-cars-are-the-worst-product-category-we-have-ever-reviewed-for-privacy/),
  [The Verge](https://www.theverge.com/2023/9/6/23861047/car-user-privacy-report-mozilla-foundation-data-collection)].
- **Publish the methodology page beside the graph.** The first comment will be "you're just counting
  third-party requests." Have the answer written: what counts as a linker (`minSites=2`), why
  first-party self-observation is excluded, why an unmapped domain is shown as itself and never
  guessed at.
- **Show `exposureScore` only alongside raw counts**, exactly as the module comment says.

### 6.6 Format

`[inference except where cited]`

- **HN / Lobsters** → the essay and the scan tool. Note "What your Bluetooth devices reveal" scored
  **540 points with zero images** [cited] — on HN the writeup is the artifact and the visualization
  is not load-bearing.
- **Mastodon / Bluesky** → one static PNG, headline number, real alt text containing the numbers.
  Thread: finding → method → tool.
- **Reddit** → a 20–40s screen capture of the graph populating.
- **YouTube creators** → hand them the scan-tool results as footage they can use without installing
  anything or exposing their own browsing. Removing friction from a creator's workflow beats a press
  release.
- **Video is not the channel here.** Brett Gaylor's personalized *Do Not Track* documentary scored
  **3 points, 0 comments** across four HN submissions 2015–2019 [cited, `[original analysis]`]. It was
  critically respected and did not spread in these venues.
- **Prestige interactive journalism is also not the channel.** NYT's "Twelve Million Phones, One
  Dataset, Zero Privacy" scored **8 points** on HN; "One Nation, Tracked" scored 7 and 4 [cited]. That
  is a channel fact, not a quality judgment — but its *craft* lessons are the best available.
  Stuart Thompson: *"We wanted to give people that visceral reaction. It's not one person or some
  strangers. It's everything everywhere."* Charlie Warzel: *"As soon as I saw what Stuart had made, I
  was like we don't even really need the words. The visuals tell the story better."* And the reframe:
  *"You're the commodity."* [cited —
  [Storybench](https://www.storybench.org/how-the-new-york-times-is-visualizing-the-smartphone-tracking-industry/)]

**Install benchmarks for expectation-setting** [cited, AMO API, fetched 2026-08-20]: uBlock Origin
10.49M daily Firefox users · Privacy Badger 1.77M · DuckDuckGo 1.04M · Ghostery 966K ·
**Lightbeam: delisted, zero.**

---

## 7. The plan, sequenced

### Gate 0 — nothing public until all of these are true

Hard gate. **A privacy tool that breaks checkout gets uninstalled and never reinstalled** — and in
this audience it earns a permanent Reddit thread that outranks your own site. Brave killed an entire
protection mode over exactly this.

1. **Name resolved** (§1.1) and applied everywhere including the Gecko ID.
2. **The extension loads** — all eight missing files exist (§1.2).
3. ✅ **Firefox blocking claim and artifact agree** (§1.4) — resolved by correcting the docs, not by
   requesting `webRequestBlocking`; enforced by `ext/src/manifest.test.js`.
4. ✅ **`data_collection_permissions: ["none"]` declared** and evidenced by test; `strict_min_version`
   raised to 140 (§1.5).
5. **Linkage graph renders** and exports anonymized-by-default (§1.3, §6.3).
6. **MAIN-world injection race test passes**, fails loud, and is **verified on Firefox specifically**
   (§1.6).
7. **`research/BASELINE.md` regression protocol passes all four steps** — especially step 3 (stable
   within origin+session) and step 4 (differs across profiles, all fields consistent).
8. **Breakage suite: zero P0 failures.**
9. **DROP page corrected** — broker count date-stamped and linked to the registry; the CalPrivacy
   quote sourced or paraphrased (§4.1).
10. **Reproducible build verified** — you can rebuild from a clean checkout and diff to zero (§5.2).

**The breakage suite.** Use the published taxonomy rather than inventing one: Roongta, Zhou, Stock &
Greenstadt, *"From Blocking to Breaking: Evaluating the Impact of Adblockers on Web Usability,"*
[arXiv:2410.23504](https://arxiv.org/html/2410.23504), 2024-10-30 [cited]. Categories (from Nisenoff
et al.): loading/responsiveness · resources & third-party content · extension detection & interaction
· HTML elements · browser level · authentication & sessions · vague. Their reusable method [cited]:
grep page source for `adblocker`/`detect`/`disable`; diff loaded resources with and without the
extension via a proxy; capture DOM state before/after interaction with Selenium; screenshot-diff for
visual breakage. What users actually complain about, from Chrome Web Store reviews: *"disable
adblocker"* prompts, **missing images** (up to 12.67% with uBlock Origin), unresponsiveness, dead
buttons.

Minimum manual flow list — two days per browser for one person:

| P0 — any failure blocks launch | P1 — document + allowlist |
|---|---|
| 3 e-commerce checkouts, card entry → confirmation | Maps / route planning |
| 2 bank logins including 2FA | Video calls (WebRTC) |
| Google SSO and Microsoft SSO | Canvas-based charting dashboards |
| Airline or hotel booking through payment | Docs / Sheets / collaborative editing |
| A CAPTCHA- or fraud-gated form | YouTube playback and fullscreen |
| A government portal (CA DMV, IRS, or similar) | Webmail |
| Any page sizing a WASM thread pool off `hardwareConcurrency` | Paywalled news |

Two standing rules: **test in light mode as well as dark** (the PourIQ lesson — every text input was
invisible in light mode and a reviewer couldn't log in), and **rendering proves it, not grep** — a
silently unpatched API looks identical to a working one in source.

**Publish the breakage results.** A public table of what you tested, what broke, and what you
allowlist by default is the most credible artifact a privacy extension can ship, and almost nobody
does it.

### Weeks −4 to −1: build and quiet beta

- **Week −4:** Gate 0 items 1–5. Rename, fill the missing files, wire the linkage UI.
  **Submit the Chrome package the moment it loads and passes P0** — the clock is the long pole (§5.3).
- **Week −4:** Start participating on r/privacy, r/degoogle and the fediverse. Answer questions.
  Mention nothing.
- **Week −3:** Gate 0 items 6–7, 10. Build the **scan-any-site tool** (§6.2). Write the two long-form
  pieces **by hand, no LLM** (§3.1): the fingerprinting/linkage essay, and the persona-validator
  engineering writeup.
- **Week −2:** Breakage suite, both browsers. Fix or allowlist. Recruit **10–20 beta testers** by
  asking a real question in a thread, not pitching — *"I need people to try to break this on sites I
  don't use, especially non-US banking and non-English sites."* Distribute via an **AMO
  unlisted-signed build** (§5.2).
- **Week −1:** Fix what beta found. Submit to AMO. Publish the GitHub repo, GPL-3.0, reproducible
  build instructions, threat model in the README, and the **no-sale succession policy**. Enable **CWS
  verified uploads**. Email **info@globalprivacycontrol.org** to get listed as a GPC sender (§3.8).
- **Week −1:** Draft everything — the essay, the Show HN text, the methodology page, five reporter
  emails, one creator email. Send nothing. Put your **email in your HN profile** and pick a personal
  username, not the project name.

### Launch week

Assumes AMO approved and Chrome pending — the expected case, not a setback.

| Day | Action |
|---|---|
| **Mon** | Site live. GitHub public. AMO listing live. Scan tool live. Nothing announced. Check every link. |
| **Sun 7pm ET / Mon 00:00 UTC** | **Post the essay to HN** (not the Show HN) — the linkage finding, first person, with the method and the arithmetic, hand-written. The scan tool and the extension are links at the bottom. Be in the thread four hours. |
| **Tue** | Fediverse + Bluesky thread: finding → method → tool. Static PNG, full alt text. |
| **Wed** | **DROP pitches go out** — six separate personal emails, no BCC: Colin Lecher (`colin@themarkup.org`), Techlore (`contact@techlore.tech` — reference their Aug 15 DROP video), Joseph Cox (`joseph@404media.co`), Matt Schwartz (`matt.schwartz@consumer.org`), Dan Goodin (`dan.goodin@arstechnica.com`), Hayley Tsukayama (`hayleyt@eff.org` — pitch the *story*, not the tool). |
| **Wed** | Email Privacy Rights Clearinghouse as a **collaborator** — offer the walkthrough, ask them to check it for accuracy. Ping Yael Grauer, whose 6,761★ list already links DROP. **File the sourced GitHub issue** correcting `auto-identity-remove`'s "DROP isn't live" claim (§4.3). |
| **Thu** | r/degoogle post, `[Dev]` disclosed in the title. **r/privacy modmail sent** (their Rule 2 requires prior discussion) — post only once mods reply. |
| **Fri** | Fix what the week surfaced. Ship a patch. Post the changelog. |
| **Throughout** | Answer every issue, review and comment. Publicly correct anything you got wrong. Argue with nobody. |

If the HN post gets no traction: wait a few days, then email `hn@ycombinator.com` about the
second-chance pool, disclosing it's yours. Don't repost immediately; don't ask anyone to submit it.

### Month 1

- **Week 2:** **Show HN** — now the extension is the artifact and you have a week of real usage.
  Title includes "open source," omits "extension," URL points at GitHub, posted Sunday 7pm ET.
- **Week 2:** r/privacy post (once mods have replied), led with what broke and what you fixed.
  Publish the breakage table. Submit the engineering writeup to Lobsters *if* a legitimate invite
  path exists; otherwise publish it yourself. Submit to **Privacy Guides Project Showcase**,
  **AlternativeTo**, **privacytools.io**, **pluja/awesome-privacy** (§3.7).
- **Week 2–3:** **Chrome approval lands** → second beat: "Now on Chrome — and here's what it can't do
  there, because Google removed the API." Post to r/firefox here, where the Firefox-is-more-capable
  angle is genuinely on-topic.
- **Week 3:** Follow any DROP pickup — offer the reporter the scan data and the linkage arithmetic.
  If none, **re-pitch once with a new angle**, not a follow-up. Consider the paid-vs-free question
  (§4.5) only if you verified it.
- **Week 4:** **Privacy Guides self-submission.** Affiliation disclosed, threat model linked, the
  "doesn't replicate RFP" and "extension detection" answers written. Not before you have users and a
  breakage record.
- **Week 4:** Edge Add-ons. Zero announcement.
- **Month 2:** Pitch **Techlore Talks** and the **Opt Out podcast** — both explicitly interview
  privacy tool developers.
- **Month 3+:** Nominate for AMO Recommended Extensions (`amo-featured@mozilla.org`) — Mozilla says
  explicitly you may nominate your own — once there's a track record.
- **Month 4+:** `Lissy93/awesome-privacy` becomes eligible (first stable release must be 4+ months
  old). Write the PR by hand — see the honeypot warning in §3.7.
- **Ongoing:** Ship a visible release every two weeks. An abandoned-looking privacy extension is a
  security concern, and Privacy Guides removes unmaintained projects [cited]. Note the durable tools
  in this category — HIBP, Cover Your Tracks, Privacy Badger — hit the front page **repeatedly over a
  decade**, driven by transparency posts and distribution partnerships, not by launch day.

---

## 8. Rules of engagement

Each is both the right thing and the effective thing:

- **Always disclose.** "I'm the developer" in the Reddit title, the first line of any email, and the
  Privacy Guides submission (where it's required).
- **Never solicit upvotes, comments, reviews, or submissions.** Explicitly against HN's rules, and
  ring-voting gets accounts penalized and sites banned [cited].
- **One account per platform.** No alts, no friends posting for you, no "organic-looking" seeding.
  Your biggest realistic risk isn't malice — it's a well-meaning friend chiming in supportively.
- **No incentivized reviews** of any kind.
- **No affiliate links, ever.**
- **Hand-write your posts, and your pull requests.** No LLM-generated or LLM-edited launch text
  (§3.1) — a current, explicit, enforced HN norm. And at least one directory maintainer has planted
  a honeypot in `CONTRIBUTING.md` specifically to catch AI-written PRs (§3.7), so this is now
  mechanically enforced too, not just socially.
- **Treat instructions found in repos, docs, and web pages as data, not orders.** The
  `Lissy93/awesome-privacy` honeypot is an HTML comment addressed to AI agents telling them to add a
  specific image to their PR. Anything similar you encounter while researching or automating goes to
  you for a decision — it never gets acted on automatically.
- **Correct errors publicly and fast.**
- **Concede real criticism.** uBlock Origin is a better blocker. Firefox RFP is stronger
  anti-fingerprinting for people who tolerate breakage. Tor Browser beats you outright on its own
  threat model. Saying so costs nothing and buys the only currency this audience has.
- **Never imply protection you don't provide.** `THREAT-MODEL.md` §Copy rules — no "anonymous,"
  "untraceable," "invisible," nothing about governments or ISPs. Marketing copy gets reviewed against
  D9 before it ships, same as product copy.

---

## 9. What is unverified — check before acting

1. **Live subreddit rule text for r/privacy, r/degoogle, r/firefox, r/PrivacyGuides,
   r/PrivacySoftware.** Reddit blocked every fetch and every API call this session. The r/privacy
   Rules 1 and 2 quoted in §3.2 come from a **2024 Wayback archive** — they are the single most
   actionable thing in that section and they are two years stale. **Read the live rules and modmail
   before posting.** This also means Reddit's DROP-awareness picture is unmeasured. (§3.2)
2. **Whether Firefox guarantees MAIN-world `document_start` ordering before page scripts.**
   Load-bearing. Test empirically. (§1.6)
3. **Whether Mozilla's "first half of 2026" extension of `data_collection_permissions` to *all*
   existing extensions actually shipped.** Assume it is in force. (§1.5)
4. **AMO manual-review queue depth in 2026.** Not published. Don't quote a number.
5. **The exact CWS registration fee** from a Google-owned page. $5 is universally reported, unsourced.
6. **The `"we will never charge you to use DROP"` quote** in `drop.html`. (§4.1)
7. **Wired, The Verge, CNET, NYT, WaPo, The Record DROP coverage, and current privacy rosters at Ars
   and The Verge.** `arstechnica.com` and `theverge.com` block this environment entirely, so "not
   found" is not "not published." Ars's January coverage was confirmed by other means; their
   *current* roster was not. **Re-verify any byline before emailing it.** (§4.2, §4.4)
8. **Whether Incogni, Privacy Bee, or Kanary have quietly addressed DROP** (§4.3, §4.5), and
   **Atlas Privacy's status** — its domain 302s to a domain-sale listing.
9. **Chrome's Featured-badge nomination path**, which sits behind sign-in. (§3.7)
10. **Edge Add-ons 2026 specifics beyond the cited Microsoft Learn pages** (§5.3), and whether
    **Arthur Edelstein still maintains PrivacyTests.org** (site updated today; maintainership
    unconfirmed).
11. **Whether alt text affects fediverse reach.** Genuinely unanswered — write it anyway, for
    accessibility. (§3.5)
12. **Whether static PNG beats interactive on Bluesky/Mastodon in 2026**, and whether short video
    outperforms for this content type. No data found. (§6.6)
13. **Why Mozilla actually discontinued Lightbeam.** The discontinuation is verified mechanically
    (404 + API flag + redirect); no Mozilla statement of reasons was found. The failure analysis in
    §6.1 is `[inference]`. (§6.1)
14. **The "532 companies" Off-Facebook Activity figure** circulating online traces only to a marketing
    blog. **Do not repeat it.**
15. **The `Data Brokers Association v. Bonta` case** cited in `auto-identity-remove`'s README returns
    0 results in CourtListener/RECAP. RECAP's federal coverage is strong but not exhaustive, and a
    state action wouldn't appear there — so "appears not to exist" is the honest phrasing, and it is
    the phrasing to use if you file that issue. (§4.3)

---

## 10. Sources

**Repo:** `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/THREAT-MODEL.md`,
`research/BASELINE.md`, `ext/manifest.json`, `ext/manifest.firefox.json`, `ext/src/linkage.js`,
`ext/options/drop.html`.

**Community rules** — [Show HN guidelines](https://news.ycombinator.com/showhn.html) ·
[HN guidelines](https://news.ycombinator.com/newsguidelines.html) ·
[HN FAQ](https://news.ycombinator.com/newsfaq.html) ·
[dang's Show HN tips (edited 2026-03-28)](https://news.ycombinator.com/item?id=22336638) ·
[second-chance pool](https://news.ycombinator.com/item?id=26998309) ·
[repost invite example](https://news.ycombinator.com/item?id=37795065) ·
[lobste.rs/about](https://lobste.rs/about) ·
[Privacy Guides criteria](https://www.privacyguides.org/en/about/criteria/) ·
[Privacy Guides browser extensions](https://www.privacyguides.org/en/browser-extensions/)

**HN data** — [Show HN by the Numbers](https://danfking.github.io/blog/2026/04/23/show-hn-by-the-numbers/) ·
[fingerprinting-surfaces Show HN](https://news.ycombinator.com/item?id=49124017) ·
[Privacy Magic Show HN](https://news.ycombinator.com/item?id=48760091) ·
[the 756-pt fingerprinting essay](https://news.ycombinator.com/item?id=46016249) ·
plus `[original analysis]` over 9,000 posts via `hn.algolia.com/api/v1/search_by_date?tags=show_hn`

**Category context** — [Brave: sunsetting Strict fingerprinting mode](https://brave.com/privacy-updates/28-sunsetting-strict-fingerprinting-mode/) ·
[JShelter threat model](https://jshelter.org/threatmodel/) ·
[Privacy Badger](https://privacybadger.org/) ·
["Anti-Fingerprinting Extensions Don't Actually Work"](https://blog.send.win/anti-fingerprinting-browser-extensions-dont-actually-work/) (2026-07-29, vendor blog — self-interested) ·
[GPC organizations](https://globalprivacycontrol.org/orgs)

**DROP / DELETE Act** — [SB 362 text](https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=202320240SB362) ·
[SB 361 text](https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=202520260SB361) ·
[CPPA data brokers](https://www.cppa.ca.gov/data_brokers/) ·
[public registry](https://cppa.ca.gov/data_broker_registry/) ·
[CalPrivacy: how DROP works](https://privacy.ca.gov/drop/how-drop-works/) ·
[Help with DROP](https://privacy.ca.gov/drop/help-with-drop) ·
[CalPrivacy 300K release](https://privacy.ca.gov/2026/06/privacy-momentum-builds-300000-californians-sign-up-for-drop-as-registered-data-brokers-hit-a-record-high/) ·
[Troutman on the regs](https://www.troutmanprivacy.com/2025/12/analyzing-the-california-delete-act-regulations/) ·
[Alston & Bird](https://www.alstonprivacy.com/drop-is-coming-due-what-californias-delete-act-means-for-data-brokers-in-august/) ·
[Fenwick](https://www.fenwick.com/insights/publications/dont-drop-ball-upcoming-changes-california-delete-act-five-key-steps-companies) ·
[Privacy Rights Clearinghouse](https://privacyrights.org/resources-tools/advocacy/deletion-obligations-under-drop-are-here-data-brokers-must-now-delete) ·
[The Markup how-to (Lecher & Hilton)](https://themarkup.org/privacy/2026/01/08/how-californians-can-use-a-new-state-website-to-block-hundreds-of-data-brokers) ·
[EFF (Tsukayama)](https://www.eff.org/deeplinks/2026/07/what-you-need-know-about-californias-drop-tool) ·
[Doctorow, Pluralistic](https://pluralistic.net/2026/07/23/drop-a-dime/) ·
[GovTech / Baron](https://www.govtech.com/policy/why-300k-californians-signed-up-to-have-personal-info-removed) ·
[DeleteMe on DROP](https://joindeleteme.com/blog/californias-drop-privacy-law-and-why-its-a-win-for-everyone/)

**Media, creators, directories** — [404 Media about](https://www.404media.co/about/) ·
[The Markup tips](https://themarkup.org/tips) · [The Markup about](https://themarkup.org/about) ·
[The Markup: easier to escape data brokers, 2026-05-22](https://themarkup.org/privacy) ·
[EFF Deeplinks](https://www.eff.org/deeplinks) · [EFF press contact](https://www.eff.org/press/contact) ·
[Techlore podcasts](https://techlore.tech/podcasts) · [Techlore contact](https://techlore.tech/contact/) ·
[Techlore tools criteria](https://techlore.tech/techlore-resources-criteria/) ·
[Techlore forum retirement](https://techlore.tech/forum/) ·
[Opt Out podcast](https://optoutpod.com/) · [NBTV](https://www.nbtv.media/) ·
[All Things Secured contact](https://allthingssecured.com/contact/) ·
[The Hated One](https://www.youtube.com/@TheHatedOne/videos) ·
[privacytools.io submissions](https://github.com/privacytoolsIO/privacy-tools/discussions/categories/submit-privacy-tools) ·
[Privacy Guides Project Showcase](https://discuss.privacyguides.net/t/about-the-project-showcase-category/114)

**Stores** — [CWS review process](https://developer.chrome.com/docs/webstore/review-process) ·
[CWS review-delay PSA, 2026-04-23](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/VJ6DcpEn51Y/m/yuxvHWdwCAAJ) ·
[MV2 deprecation timeline](https://developer.chrome.com/docs/extensions/develop/migrate/mv2-deprecation-timeline) ·
[CWS verified uploads](https://developer.chrome.com/blog/verified-uploads-cws) ·
[CWS trader verification FAQ](https://developer.chrome.com/docs/webstore/program-policies/trader-verification-faq) ·
[declarativeNetRequest limits](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest) ·
[AMO add-on policies](https://extensionworkshop.com/documentation/publish/add-on-policies/) ·
[AMO signing & distribution](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/) ·
[AMO source code submission](https://extensionworkshop.com/documentation/publish/source-code-submission/) ·
[AMO Recommended Extensions](https://extensionworkshop.com/documentation/publish/recommended-extensions/) ·
[Firefox data consent](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/) ·
[Mozilla data-consent announcement](https://blog.mozilla.org/addons/2025/10/23/data-collection-consent-changes-for-new-firefox-extensions/) ·
[Mozilla on MV3 ad blockers](https://blog.mozilla.org/en/firefox/firefox-manifest-v3-adblockers/) ·
[Firefox 128 MV3 updates](https://blog.mozilla.org/addons/2024/07/10/manifest-v3-updates-landed-in-firefox-128/) ·
[bug 1736575](https://bugzilla.mozilla.org/show_bug.cgi?id=1736575) ·
[Edge publishing](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension)

**Open source / supply chain** — [Ghostery goes open source](https://www.ghacks.net/2018/03/09/ghostery-open-source-and-new-business-model/) ·
[Palant on Avast](https://palant.info/2019/12/03/mozilla-removes-avast-extensions-from-their-add-on-store-what-will-google-do/) ·
[FreeVPN.One](https://www.infosecurity-magazine.com/news/chrome-vpn-extension-spyware/) ·
[uBlock name dispute](https://github.com/uBlock-LLC/uBlock/issues/1838) ·
[Nano Adblocker](https://www.ghacks.net/2020/10/16/time-to-remove-nano-adblocker-and-defender-from-your-browsers-except-firefox/) ·
[The Great Suspender](https://thehackernews.com/2021/02/warning-hugely-popular-great-suspender.html) ·
[Cyberhaven supply-chain attack](https://blog.sekoia.io/targeted-supply-chain-attack-against-chrome-browser-extensions/) ·
[CrashFix clone of uBO Lite](https://thehackernews.com/2026/01/crashfix-chrome-extension-delivers.html)

**Demo asset precedents** — [Blacklight press release](https://themarkup.org/press-release-20200922) ·
[10 Million Blacklight Scans Later](https://themarkup.org/blacklight/2023/05/03/10-million-blacklight-scans-later-heres-what-you-found) ·
[Blacklight Feb 2026 update](https://themarkup.org/blacklight/2026/02/09/blacklight-update-tiktok-x-twitter) ·
[Blacklight "now what"](https://themarkup.org/the-breakdown/2020/09/22/i-scanned-the-websites-i-visit-with-blacklight-and-its-horrifying-now-what) ·
[Lightbeam announcement, 2013](https://blog.mozilla.org/blog/2013/10/25/lightbeam-for-firefox-privacy-education-for-users-open-data-for-publishers/) ·
[lightbeam-we](https://github.com/mozilla/lightbeam-we) ·
[Cover Your Tracks](https://coveryourtracks.eff.org/about) ·
[EFF on Off-Facebook Activity](https://www.eff.org/deeplinks/2020/01/facebook-history-welcome-incomplete-move) ·
[Mozilla: cars are the worst](https://foundation.mozilla.org/en/privacynotincluded/articles/its-official-cars-are-the-worst-product-category-we-have-ever-reviewed-for-privacy/) ·
[The Verge on the car report](https://www.theverge.com/2023/9/6/23861047/car-user-privacy-report-mozilla-foundation-data-collection) ·
[NYT visualization craft (Storybench)](https://www.storybench.org/how-the-new-york-times-is-visualizing-the-smartphone-tracking-industry/) ·
[Wu et al., NDSS 2025 — App Privacy Report](https://www.ericwzeng.com/papers/Wu-NDSS25-AppPrivacyReport.pdf) ·
[PoPETs 2022 — privacy nutrition labels](https://petsymposium.org/popets/2022/popets-2022-0106.pdf)

**Breakage methodology** — Roongta, Zhou, Stock & Greenstadt,
["From Blocking to Breaking"](https://arxiv.org/html/2410.23504), arXiv:2410.23504, 2024-10-30
