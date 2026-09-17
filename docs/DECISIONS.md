# Nullecho — decisions log

2026-08-20. Each entry: what was decided, why, and what would change it.

---

## D1 — No decoy ad-clicking. Rejected on merits, not just risk.

**Decision:** Nullecho will not auto-click, auto-fetch, or fire synthetic beacons at live ad endpoints.

**Why.** The intuition — "click everything so my profile is garbage" — assumes the cost lands on
the surveillance platform. It doesn't. MIT Technology Review tested AdNauseam in 2021 and found
Google's systems counted many phantom clicks as legitimate and **billed advertisers for them**.
So the money flows *from advertisers (often small businesses) to Google*. The platform is made
whole; the bystander pays. The protest hits the wrong target.

Secondary, and less important: Google delisted AdNauseam in Jan 2017 and flagged it as malware to
kill the sideload path. Civil liability turned out to be near-zero (≈10 years, no lawsuits found),
so this is a *distribution* risk rather than a legal one — but "we'd get away with it" is not a
reason to do a thing whose mechanism misfires.

**Would change this:** a documented mechanism that imposes cost on the profiler without generating
a billable event for a third party. None found so far.

## D2 — Randomize by persona, not by attribute.

**Decision:** one internally-consistent fake machine per origin, seeded
`HMAC(session_salt, eTLD+1)`, stable within origin+session, rotated on user reset.

**Why.** Independent per-field randomization is worse than nothing: cross-field contradictions
(Chrome UA + Apple GPU + 3 cores) are already flagged by fraud vendors, and per-load instability
becomes its own fingerprint. Per-origin stability also kills the averaging attack that broke
Brave's canvas farbling in 2025, and avoids site breakage.

**Key realization:** unlinkability *to a site you're actively using* is not the goal — that site
can just set a cookie. The goal is breaking linkage *between* sites. Per-origin stability therefore
costs nothing and buys large compatibility gains.

## D3 — Personas drawn from a high-population pool, never generated randomly.

**Decision:** curated pool of real-world common configurations; every field mutually consistent;
rare values (e.g. `colorDepth: 30` HDR) excluded.

**Why.** A randomly generated machine is unique, and unique is the thing we're fighting. Target
is "indistinguishable from a large crowd" — Tor's uniformity insight, applied inside a normal
browser.

## D4 — Topics API dilution: cut. The API is dead.

**Decision:** removed from scope entirely.

**Why.** Google retired most of Privacy Sandbox on 2025-10-17 — Topics, Protected Audience,
Attribution Reporting and more — citing low adoption (Topics peaked at ~4.9% of page loads).
Deprecation began Chrome 144 (Jan 2026); removal landed by Chrome 150 (Jul 2026). Third-party
cookies remain in Chrome indefinitely. There is nothing left to dilute.

**Consequence:** the tracking landscape reverted to plain third-party cookies + fingerprinting.
That makes blocking and fingerprint defense *more* central, not less.

## D5 — Vendor opt-out surfaces: escort, never automate.

**Decision:** detect the setting state, deep-link the user to the exact control, walk them through
it. No DOM automation of Google/Meta account pages.

**Why.** Ethically it's the vendor's own opt-out surface — but Google's ToS bars automated access,
and scripted clicking will trip bot detection and risk the user's *account*. The privacy outcome
of escorting is identical. Also note Bashir et al. (NDSS 2019) found ad-preference dashboards show
a curated subset of the real profile, so deletions there are not proof of erasure — don't overclaim.

**Also:** Meta retired "Your activity off Meta technologies" (announced 2026-06-09, US rollout
July 2026). Businesses still transmit via Pixel/CAPI regardless of the user's setting. The
highest-value Meta lever is gone — blocking the Pixel at the network layer now matters far more
than anything inside the account UI.

## D6 — Ship GPC. Low effort, real statutory teeth.

**Decision:** `Sec-GPC: 1` via DNR `modifyHeaders` + `navigator.globalPrivacyControl`.

**Why.** Trivial to implement and legally enforceable — California's Sephora settlement ($1.2M)
was partly for ignoring GPC. Caveat for honest copy: a USENIX Security 2025 study found only about
a third of sites that appear to sell/share data implement any opt-out string, and only 44% of
those honored all of them. Real, partial, worth shipping.

**Watch:** California AB 566 requires browsers to ship a built-in opt-out signal from 2027-01-01,
which may commoditize this feature. Don't build the product around it.

## D7 — DROP onboarding is the sleeper feature. Highest real-world benefit.

**Decision:** build a guided flow that gets California users into the state's Delete Request and
Opt-Out Platform.

**Why.** This is the one avenue that *actually deletes data* instead of adding noise. California's
DELETE Act platform (DROP) opened to consumers 2026-01-01, and since **2026-08-01 — three weeks
ago** — all registered data brokers must check DROP every 45 days, delete matching data including
**inferences**, and report status. Penalty: $200 per request per day of non-compliance.

One submission reaches every registered broker. Almost nobody knows it exists yet.

**Limits, to state plainly in-product:** California residents only; Nullecho cannot submit on the
user's behalf (identity verification is required); it covers *registered* data brokers, not every
company holding your data.

### ⚠️ D7 correction, same day — "almost nobody knows it exists" was FALSE

I originally justified this feature partly as a time-limited earned-media hook, on the claim that
DROP coverage was thin. **That claim did not survive checking, and I should have checked before
building a launch sequence on it.**

DROP has been covered continuously since January 2026: The Markup/CalMatters (Colin Lecher — *five*
pieces in 2026, including a step-by-step consumer how-to on Jan 8), EFF Deeplinks, Consumer Reports,
KQED, Ars Technica, the LA Times, SFGATE (twice), Lifehacker, the Washington Post, Bloomberg Law,
IAPP and StateScoop. SFGATE reported **150,000 signups by 2026-01-26**.

**What is actually newsworthy is the failure, not the tool** — Bloomberg Law (2026-07-31): *"Data
Brokers Deny a Million Pleas to Delete Personal Information"*; Stanford (2026-08-11): only **9%** of
data brokers comply. And The Markup is *already* crowdsourcing that story (2026-06-30 piece recruits
readers to file and report back post-Aug-1).

**Consequence:** the DROP flow stays — it is accurate and genuinely useful to a California user, and
it is the only part of the product that *deletes* rather than obstructs. But it is a **resource, not
a wedge**. Do not pitch it as news, do not claim novelty, and do not build launch sequencing around
being first. The extension must earn attention on the persona architecture and on being the only
tool in the category that lets a user *measure* whether it works.

**Process lesson:** I repeated a sub-agent's unverified characterisation ("coverage is thin") as
established fact and reasoned forward from it. Research findings need the same "verify before you
build on it" discipline as measurements do — a plausible claim from a trusted source is still a
claim.

## D8 — Reject synthetic first-party analytics noise.

**Decision:** no fake events into site analytics.

**Why.** Identical flaw to D1 — corrupts publishers' own first-party data while leaving the ad
giants untouched. Inconsistent with the reasoning that rejected decoy clicks.

## D10 — The linkage graph is private evidence. The SENTENCE is the artifact.

**Decision:** the shareable output is a card of **numbers and company names only** — never site
identities. The graph stays local, as the thing that convinces *you*. And nothing in the product
terminates on a revelation; every reveal ends in a named action.

**Why — two findings, both of which contradict my original plan.**

**1. Revelation alone can backfire.** Farke et al. (USENIX Security 2021, n=153) exposed users to
Google's My Activity dashboard. Afterwards they were *significantly less* concerned about data
collection and viewed it *more* favourably; only 25% changed any setting or behaviour. The authors'
own reading is that transparency tools "garner trust… without necessarily changing users'
behaviors." A linkage graph that ends at the graph risks *reducing* the concern it exists to raise.

Mozilla reached the same conclusion about its own product before abandoning it — the Lightbeam
roadmap states the UI "may be too complex" and that the graph showed historical connections without
saying which were active or what to do about them. They never shipped the fix.

**2. Disclosure cost decides what spreads.** Panopticlick reveals your *configuration* — sharing
"18.1 bits, 1 in 286,777" costs nothing, so people post it. It reached the HN front page in 2010,
2013 (×2), 2015 and 2019, mostly on resubmissions of the same URL, and it is still maintained in
2026. Lightbeam reveals your *browsing history* — sharing it is a confession. It spiked twice and
its AMO page is now a **404**, silently voiding every link ever shared to it.

**Consequences, concrete:**
- Share card carries counts and company names. Site identities never leave the device.
- Give the number a denominator and a **rank** ("worse than 78% of people who ran this"). A fact
  becomes a score; scores get posted.
- Make it **re-runnable** so there is a second, better number after protection is on. Diagnose →
  fix → re-test is one loop that generates a fresh shareable each turn. Lightbeam had no second
  number, which is exactly why nobody resubmitted it.
- Default view is the ranked list, not the graph. Force-directed layouts become unreadable well
  before 40 sites — precisely where the finding gets impressive. Aesthetic payoff and comprehension
  move in opposite directions.
- **Every failing verdict ends in a named remedy.** EFF appends a specific install to each failure
  string in `main.py`; that single line of code is probably worth more than the visualisation.
- **The result URL must never 404.** `panopticlick.eff.org` still redirects to a working tool
  sixteen years on. Pick a permanent URL and keep it resolving even if the product changes.

## D15 — Synthetic signals must never be able to incriminate the user. 2026-08-21.

**Decision:** Nullecho generates **no synthetic content of any kind**, and if that ever changes, no
generated signal may touch criminal, extremist, exploitative, or self-harm subject matter. This is a
hard constraint, not a style preference.

**Current state, verified 2026-08-21:** we generate zero content. Personas carry hardware and OS
fields only — `platform, ua, uaData, gpu, cores, memory, screen, fonts`. No interests, no queries,
no topics, no page visits. Every `fetch()` reads a bundled extension file (already enforced by a
test in `manifest.test.js`). D1 and D8 cut decoy clicking and synthetic analytics noise, so there is
nothing to poison with today. This entry exists so that stays true by decision rather than by
accident of scope.

**Why it matters, concretely.** The tempting next feature is TrackMeNot-style noise — emit plausible
decoy searches or page visits so the real ones do not stand out. The failure mode is that **a
synthetic signal is indistinguishable from a real one to everyone downstream.** It does not arrive
labelled. It can surface in:

- a subpoena or civil discovery, where "why did you search for this" has no good answer;
- employer or school network monitoring;
- an ISP or platform abuse review;
- a border-crossing device inspection;
- an automated watchlist or risk score the user never sees and cannot appeal.

**The asymmetry is the point: we would generate the signal, and the user would carry the
consequence.** They installed a privacy tool. Handing them a plausible-looking interest in weapons,
drugs, extremist material, or anything involving minors would be a catastrophic betrayal of exactly
the trust that made them install it — and it would be *our* text in *their* record.

**If synthetic content is ever added, it must:**
1. Be drawn from a **fixed, human-reviewed, shipped-in-the-repo allowlist** — never model-generated
   at runtime, never assembled from fragments, never seeded from the user's real history.
2. Stay inside mundane commercial categories only (weather, recipes, sports scores, consumer
   electronics). If a term would be unremarkable printed in a newspaper, it qualifies; otherwise it
   does not.
3. Categorically exclude: anything criminal or violent; weapons; drugs; extremism or terrorism;
   anything sexual, and **absolutely anything involving minors**; self-harm or suicide; stalking or
   surveillance of a person; fraud and hacking topics; and named real individuals.
4. Ship with a **test that fails the build** if a banned term enters the corpus, so the constraint is
   enforced mechanically rather than remembered.
5. Be **off by default and disclosed at enable-time**, stating plainly that generated activity is
   indistinguishable from real activity to anyone reviewing the user's records.

**Would change this:** nothing. There is no privacy gain that justifies putting a criminal-looking
signal into a real person's record. If noise only works by being alarming, it does not work.

*(Credit where due: Jason raised this unprompted before any such feature existed. That is the right
time to raise it.)*

## D16 — "Lower prices" is not a claim we can make. The Checkout Report shows the mechanism instead. 2026-08-21.

**Decision:** Nullecho will **not** claim to lower prices, and will not ship a "clean shopping
session" mode. It may ship a **Checkout Report** — a view over `siteReport()` — that shows what a
shopping page did *before* it quoted a price. Full research: `research/SURVEILLANCE-PRICING.md`.

**Why "lower prices" is out — the evidence is one-sided:**
- Consumer Reports 2016 (372 simultaneous searches, cookies-rich vs scrubbed): 88% identical, and of
  the pairs that differed, **59% had the HIGHER fare on the *scrubbed* browser.** Clearing tracks
  raised prices more often than it lowered them.
- Two fingerprint-spoofing studies (Mikians; Hupperich et al.) returned **null results** — one built
  a purpose-made scanner and "could not prove the existence of such a system."
- Every measured price effect **favours the *less* private state** (logged-in members paid $12 less
  — loyalty pricing). 3 of the 4 famous "personalized pricing" cases aren't: Amazon = random A/B
  test, Orbitz = *steering* (different hotels, not different prices for the same room), Staples = ZIP
  geography. The strong signals (IP, logged-in account) are **unreachable by an extension anyway.**
- A "clean shopping session" also **contradicts D2/THREAT-MODEL** (per-origin *stable* personas; we
  explicitly do not try to be unrecognisable to a site you're actively using), and r/privacy would
  falsify a "saves money" claim within the hour.

**The opposite risk is better-evidenced than the benefit:** privacy-looking traffic gets *worse*
treatment (Tor blocking measured on 3.67% of Alexa top-1000; our own shim trips detectors). A
feature that quietly raised prices would be worse than useless.

**What IS defensible (feature (b), narrowly):** a Checkout Report showing which companies the page
contacted, which fingerprinting surfaces it read, and — the novel part — whether the page carried
the algorithmic-pricing disclosure that **four states have now enacted** (verified from primary
statute text 2026-08-21; Connecticut re-verified 2026-09-16 after two repeal-and-replace acts — see
the CT bullet). **The detector must match a FAMILY of strings case-insensitively, not one
literal** — and real implementations bury/re-case them (WSJ all-caps standalone; Instacart lowercase
mid-sentence):
- **NY GBL §349-a** (law 2025-07-08, *enforced 2025-11-10* after the NRF dismissal): `THIS PRICE WAS
  SET BY AN ALGORITHM USING YOUR PERSONAL DATA`
- **MD Com. Law §13-322** (eff. 2026-10-01): `THIS PRICE WAS SET BY AN ALGORITHM OR BY USING YOUR
  PERSONAL DATA`
- **CT P.A. 26-130 §11** (H.B. 5563, approved 2026-06-04, **eff. 2027-07-01**): `THIS PRICE WAS
  INCREASED USING YOUR PERSONAL DATA` — or "a substantially similar disclosure", so CT is still the
  **only** state whose string is not fixed and an exact-string matcher will miss compliant CT
  notices.
  ⚠️ **Corrected 2026-09-16.** This bullet originally cited P.A. 26-64 §11(b) (S.B. 4, approved
  2026-05-27, eff. 2026-10-01) and its string `…INCREASED BY A PRICE SETTING DEVICE USING…`. That
  section was **repealed** by P.A. 26-100 §66 (H.B. 5222, approved 2026-06-02; replacement §44,
  eff. 2027-02-01), and §44 was in turn **repealed** by P.A. 26-130 §19 (approved 2026-06-04) and
  replaced by §11. Three enactments in nine days; the first two are dead law, and **"price setting
  device" no longer exists anywhere in Connecticut statute.** That is itself a finding: a detector
  built to the June text would have matched *nothing compliant* in CT, and the client alerts that
  still quote it are quoting repealed text. Cite `2026PA-00130-R00HB-05563-PA.PDF`, not 26-64.
- **NJ Fair Price Protection Act** (P.L. 2026, c. 65; eff. 2027-08-01): groceries-only *ban*, not a
  disclosure string.

Match on the stable core substrings case-insensitively — statutorily fixed → near-zero false
positives. **Substring list as of 2026-09-16:** `set by an algorithm` (NY + MD) and `using your
personal data` (NY + MD + CT — the one substring that survives all three strings, including
Connecticut's re-enacted one). **`price setting device` is now a dead substring**: it matches no
live statute. Keeping it in the list is harmless (nobody renders repealed text by accident) but it
must not be the *only* CT anchor; `increased using your personal data` is the CT-specific anchor if
one is wanted. **No compliance SaaS exists** (unlike cookie banners); every instance is hand-written, so text matching is the only
method and it's sufficient. Observed compliers: subscription publishers (WSJ, Wired, New Yorker) +
Instacart; general retail/travel = **zero** — counsel advises *avoiding* the trigger. Habitat is
renewal **emails** (a content script can't read those) + account/pricing pages, NOT general checkout.
Timing is live: the **FTC issued a
Proposed Enforcement Policy Statement on Personalized Pricing 2026-08-19** whose theory of harm is
that consumers "lack the information or tools" and which names private browsing as legitimate
avoidance — a regulator describing this feature.

**Defensible claim (exact wording):** *"Nullecho shows you which companies a shopping page contacted
before it showed you a price, which fingerprinting surfaces it read, and whether the page carried the
personalized-pricing disclosure New York law requires. It does not lower prices — and we found no
credible evidence that any browser extension can."* The last clause is the pitch: in a category of
overclaimers, "we checked and it doesn't work" is what earns trust.

**⚠️ Corrections from the compliance brief (2026-08-21), verified against enacted statute text:**
- NJ's widely-reported **$50,000 penalty was STRUCK before enactment** — do not cite it.
- NJ "groceries" includes **paper goods, cleaning products, health & beauty, and pet supplies**, and
  §3(c) carries a **purpose-limitation clause** most pricing teams will miss.
- The Robinson-Patman "applies only to purchasers for resale" framing is **wrong**: §2(a) reaches
  goods sold "for use, consumption, or resale." The real barrier to consumer claims is the
  **competitive-injury** element, not the purchaser type.
- ~~⏰ California AB 2564 faces an 2026-08-31 floor deadline — would be a 5th state / 4th ban.~~
  **Resolved 2026-09-16: AB 2564 is dead for the 2025–26 session.** The Senate passed it 2026-08-31
  (22–14, as amended); the Assembly never voted on concurrence in the Senate amendments; never
  enrolled, never reached the Governor, no chapter. Leginfo's "Active" label is an artefact of
  *sine die* being 2026-11-30. **Not a fifth state.** Reframe as a data point — a retail *ban*
  cleared both chambers and still died on a procedural step — not as a live regime. Author says he
  will carry it into 2027.

**📌 Scope note (Jason, 2026-08-21):** California pricing legislation is **deprioritized** — he will
handle that with counsel. It imposes nothing on Nullecho either way: these statutes bind *businesses
that set prices*, not browser extensions. The only contact point is the Checkout Report's detector
string list, which is a maintenance item. **Update 2026-09-16:** moot for now — AB 2564 died on
concurrence, so California has no pricing statute and no mandated string to detect. The CCPA
purpose-limitation sweep (brief §5) is the only California angle and it produces no on-page text.
Nothing to add to the detector list.

⚖️ For whoever picks this up: do not assume these laws will be struck down. NRF's First Amendment
challenge to NY §349-a was **dismissed** (Judge Rakoff, Oct 2025) under *Zauderer* — the mandated
string was held "factual and uncontroversial," which draws lenient review, not strict scrutiny.
On appeal to the 2d Cir. (No. 25-2818): **fully briefed since 2026-02-24; no ruling and no recorded
argument as of 2026-09-16** (per the court's own opinion and argument-audio indexes — say that, not
"not calendared"). Treat the outcome as open.

**Gate before building:** a sweep for real §349-a compliance is running
(`research/NY-349A-COMPLIANCE-SWEEP.md`). If retailers show the disclosure → build the detector. If
**nobody** does → "9 months in force, zero compliance found" is a better story than the feature.
Either branch is honest; both are worth having.

**Legal line, for the record:** removing a signal about yourself is *shopping* (clearly legal — the
FTC's own 2026 statement blesses it). Asserting a false fact — fake student/military/senior status,
coupon fraud — is *fraud* and is out. No case found of a merchant acting against a shopper for
cleared cookies.

## D9 — Honest scope. State the non-goals in the product, not just the docs.

Nullecho degrades **commercial ad-tech profiling**. It does not defeat state surveillance — different
threat model, and clicking fake ads was never going to touch bulk metadata collection. It also
cannot reach TLS/JA3 fingerprinting or IP correlation from inside a browser extension, and
WASM-compiled fingerprinting can partially bypass any JS-shim defense ("The WASM Cloak", 2025).

Marketing copy gets reviewed against this list. Overclaiming a privacy tool is its own harm — users
make real exposure decisions based on what we imply.

## D13 — The ISOLATED→MAIN handshake is authenticated by a nonce. 2026-08-21.

**Decision:** each MAIN-world script mints 128 bits from `crypto.getRandomValues` at
`document_start`, publishes it in its `{ phase: 'boot' }` status event, and refuses any persona
payload that does not echo it back. Exactly one handshake is ever accepted; a rejected one does not
consume that slot.

**Why.** The channel was a DOM `CustomEvent`, which is the page's own machinery, and the payload
included `enabled:false` — the allowlist stand-down. So three lines of page script made the shim
restore every original descriptor and hand over the true machine:

```js
document.dispatchEvent(new CustomEvent('nullecho:persona', {
  detail: JSON.stringify({ ok: true, enabled: false })
}));
```

Any tracker that had heard of Nullecho could switch it off, on precisely the sites where it matters.
The previously-documented risk (`shim-loader.js` R3) said a forger "can pick which persona it is
shown", and treated that as tolerable. It missed that the same channel carried the off switch.

**Three things this decision turned on, none of them the nonce itself:**

1. **A nonce alone would not have worked.** The shim listened on `document`. An event dispatched on
   `document` propagates window → document, so a page's `window.addEventListener(…, true)` fires
   *first* — early enough to read the nonce out of the loader's delivery and `stopPropagation()` it
   away. The shim now listens on `window` in the capture phase, registered at `document_start`, so it
   is ahead of any page listener in registration order. There is a test that fails without this.
2. **The primitives had to be captured.** A page can redefine `CustomEvent.prototype.detail` or
   `JSON.parse` and swap the payload *after* the loader built it, learning the nonce on the way
   through. Both are captured before anything is dispatched. Also tested.
3. **Rejection must not consume the one-shot.** If a bad nonce burned it, "shout first" would become
   a downgrade attack pinning every visitor to the un-rotated fallback persona.

**`gpc.js` got the same treatment.** It is a second consumer of the same event and it can take
`navigator.globalPrivacyControl` back down — so an unauthenticated channel let a site delete its own
do-not-sell signal. GPC is the part of Nullecho with statutory teeth (D6); the party the signal is
aimed at is the party running script on the page.

**`data-nullecho-boot` was deleted, not kept as a fallback.** Its purpose was "the shim booted after
the loader dispatched", which the nonce makes impossible — the loader has nothing to send until it
has heard the boot event. All it would still do is publish the nonce into the DOM for any later
script to read. A channel whose only remaining function is leaking the secret that protects the other
channel is not a fallback. `protocol.test.js` fails if the string reappears.

**What this does NOT fix, stated because "looks secure" is worse than "documented gap":** the nonce
is unobservable only if the MAIN-world script wins the `document_start` race. If it loses — the
Chrome MAIN-world injection bug already in the threat model — the page owns the realm first and can
hook every primitive before we capture them. Nothing inside the page can recover from that, and the
same race already decides whether the shim protects anything at all. So it is *measured* rather than
assumed: `shim-loader.js` checks, from the ISOLATED world the page cannot touch, whether any page
script had executed when the boot event arrived, and reports `nonce-exposed` when one had. Asking the
possibly-compromised realm to self-report would have been the fake version of this check.

**Would change this:** `chrome.userScripts.register()` (already on file in PERMISSIONS.md as a
v0.2 power-user opt-in) registers ahead of navigation and would close the race itself, at the cost of
a developer-mode toggle.

## D14 — The Firefox "more capable" claim was corrected, not made true. 2026-08-21.

**Decision:** `webRequestBlocking` stays un-requested on both platforms. The docs that implied the
Firefox build blocks more were fixed instead — `ARCHITECTURE.md`'s layer-1 diagram, `ext/README.md` —
and a test now fails if either manifest requests the permission or if `heuristics.js` registers a
`['blocking']` listener.

**Why.** Firefox did retain blocking `webRequest`; the claim was true of Firefox and false of the
artifact, which is the worst combination — technically defensible and materially misleading.
`ext/PERMISSIONS.md` had already made the decision correctly and given the reason (keeping the
blocking path in DNR means a bug in the heuristics observer cannot hang a request); the other
documents had simply drifted from it.

Making the claim true was the stated preference and was rejected on evidence: requesting a permission
we do not use breaks this project's own rule for permissions and hands an AMO reviewer an unjustified
capability, and *actually* using blocking mode is not small — `heuristics.js` decides from
asynchronously-loaded, storage-backed strike state, while a blocking `onBeforeRequest` must answer
synchronously or delay every matching request. It would also split blocking behaviour across
platforms, which PERMISSIONS.md says obliges a UI claim, and there is no Firefox in this toolchain to
verify it in. "We shipped it untested" is not an improvement on "we described it wrong".

**Would change this:** a blocking rule that genuinely cannot be expressed in DNR. None exists yet.

## D11 — Narrow the claim, and prefer a consistent leak to an inconsistent fake.

**Decision.** Two things, adopted together on 2026-08-20 after measuring `ext/src/shim.js`
against the Arkenfox "DON'T BOTHER — anti-fingerprinting extensions" critique
(`docs/ARKENFOX-RESPONSE.md`):

1. **The canonical claim is narrowed** to the wording now fixed in `docs/THREAT-MODEL.md`.
   Nullecho breaks the cross-site fingerprint join; it does not prevent fingerprinting, it is
   detectable, and it does not defeat a determined adversary. **"Protects you from
   fingerprinting" is a banned phrase.** The product also states in-product that Firefox RFP and
   Brave are stronger, because they operate below the JS layer.
2. **Where a spoof cannot be made self-consistent, the spoof is removed** rather than shipped
   half-applied. A detectable-but-consistent persona is acceptable. A self-contradicting one is
   not — it is both identifying *and* flags the user as evasive, which is the D2 failure mode.

**Why.** Arkenfox is right about more than it is wrong about, and we could measure exactly how
much. Of their six claims, four land cleanly on what we built: it is impossible at the engine
level, extensions are detectable, fonts have too many measurement methods, and the tool adds an
"is running an anti-fingerprinting tool" bit. Only their "spoofing X is the same as being X"
argument fails against us, and only because our spoof is per-origin rather than global — the
thing being defeated is correlation, not identification.

Applying rule 2 to the three self-contradictions the adversarial suite found:

| Split-brain | Resolution | Result |
|---|---|---|
| CSS `@media` vs `matchMedia` | **Reverted** — and not just `matchMedia`. The whole display layer (screen geometry, DPR, colour depth) went with it, because CSS mirrors all of it below JS and cross-origin stylesheets cannot even be read. | Contradiction gone. `screen` and `css` now leak truthfully — the largest protection reduction in the shim. |
| `offsetWidth` vs `getBoundingClientRect` | **Fixed** — both measure through one font plan and share one presence delta, in both the claim and the removal direction. | Detector closed. `getClientRects`/SVG remain, documented. |
| WebGL extension list vs claimed GPU | **Fixed** — filtered to what the claimed GPU class exposes, with `getExtension()` filtered by the same list so the two APIs cannot disagree. | Detector closed. An RTX 3060 no longer advertises PVRTC. |

Adversarial detectors firing went **5 → 2** (canvas farbling, which is inherent to any noise
scheme; and a same-tick pristine child realm, which is unreachable). Note the cost of the display
revert is *not* visible in that count — it shows up as raw entropy leaked, with `screen` and `css`
moving from "changed" to "unchanged" in the before/after table.

**What would change this.** For the display layer: nothing reachable from a WebExtension. A
browser-level implementation spoofs the style engine and JS together, which is exactly why the
in-product copy points at Firefox and Brave. For the claim: if the shim ever reached parity below
the JS layer, the wording could widen — but it would need new measurements, not new confidence.

## D12 — The persona always names the host's own OS. 2026-08-21.

**Decision (2026-08-21).** `personaFor(salt, origin)` selects only from personas whose OS family
matches the **host's** OS family, detected from the real `navigator` before the shim patches it. A
Mac is never shown a Windows persona again. This closes ARKENFOX-RESPONSE.md open follow-up #5.

Three things move together, and the second and third are not optional:

1. **Selection is constrained.** `detectHostFamily()` reads `userAgentData.platform` → 
   `navigator.platform` → the UA string, in that order. The service worker runs it against its own
   never-patched navigator; `shim.js` runs the mirrored copy at module-evaluation time, *before*
   `installInto()`, so it reads the machine rather than the persona.
2. **The pool grew from 8 personas to 16**, because the constraint turns each family into
   somebody's entire pool. It was 5 Windows / 2 macOS / 1 Linux — which would have handed Mac users
   a coin flip and Linux users *no protection at all* (one persona means every origin sees the same
   machine). It is now 5 / 6 / 5, weights renormalised so each family sums to 100.
3. **The validator learned the family invariants**, because "the pool is fine" now has to mean
   "every family is fine": ≥4 personas per family, weights summing to 100 per family, no persona
   above 50% of its family, ≥3 deviceMemory buckets per family with none above 60%, and a cap on
   the same-persona collision probability Σ(wᵢ/W)² — the direct measure of how often two unrelated
   origins are shown the same device.

**Why.** Every contradiction that survived the D11 pass exists *because* the persona named a
foreign OS: the font rasterizer, the WebGL extension set, and above all the display layer we
surrendered in D11. That layer is now truthful *and* below the JS layer — which means it is a
free, unpatchable description of the real machine sitting next to a persona that claimed a
different one. On this Mac a page needed five lines to notice: `dpr 2` + `color-gamut: p3` +
`dynamic-range: high` + `colorDepth 30` + a 1512×982 logical panel, under a `Win32` persona. That
is the D2 failure mode — identifying *and* evasive — reached by a different road.

**The cost is not unlinkability, and that claim was checked rather than assumed.** The cross-site
join is broken by the personas being *different* per origin, not by their being *foreign*. What we
give up is hiding which OS you run, which (a) was never claimed, (b) never worked — the engine
leaks it four ways (ARKENFOX-RESPONSE claim (a)) — and (c) is not the threat model: THREAT-MODEL.md
and D9 are explicit that the goal is breaking the join between sites, not anonymity.

### Measured, real Chrome 151 on macOS 26.6.0 / Apple M2 Max — not the Electron pane

Host as the page sees it: `MacIntel`, 12 cores, 32 GB, 1512×982 @2x, colorDepth **30**.

| Configuration | Detectors firing | Composite |
|---|---|---|
| Shim off | **0 of 10** | `0bb22a6a224eed` |
| Windows persona, i.e. the pre-D12 behaviour | **3 of 10** | `1d74600c9420f0` |
| macOS persona `macos-chrome-m1-pro` (host-matched) | **2 of 10** | `022e2b68c014e7` |
| macOS persona `macos-chrome-m1` (a second origin) | **2 of 10** | `02cae21b7f5fe7` |

**Read the count carefully.** The suite is now ten detectors, not nine, and the child-realm probe
is stricter than it was. So the honest comparison is **3 → 2 on the new suite**, not 2 → 2 on the
old one. Both changes were made *before* the host-matched run, and both were made because the old
versions would have reported a false improvement:

- **New detector: "Host OS vs claimed OS."** Compares the truthful display layer against the
  persona's platform. Fires on the Windows persona, clean on the macOS one. It exists because D11
  created it — the moment we stopped spoofing the display, the display became evidence.
- **Strengthened: the child-realm detectors** compared `navigator.platform` alone. Under D12
  `platform` agrees by construction, so a platform-only probe would have reported "clean" about a
  realm that still leaks everything else. They now compare `{platform, cores, memory}`. The
  same-tick realm therefore **still fires** — but what it leaks narrowed from three fields
  (`MacIntel` ≠ Win32, 12 ≠ 8, 32 ≠ 16) to one (12 cores ≠ 10).

The two survivors are the two that were already known to be unclosable from an extension: canvas
farbling, which is what noise *is*, and the same-tick pristine child realm.

**What did not change, which is the point.** 8 of 14 hashed signals move against the shim-off
baseline — the same 8, for the Windows persona and the macOS persona alike. Constraining the OS
did not cost protection against the composite join. 39/39 correctness assertions pass, re-running
in one session drifts 0 of 15 signals, and 50 consecutive canvas reads still return 1 hash.

**What it did cost, measured.** Two macOS personas differ on **5 of 14** signals (canvas,
canvasPixels, webgl, audio, navigator) where a macOS and a Windows persona differed on 8. Inside a
family, `fonts`, `clientHints` and `webgpu` are constant — same stock font set, same UA and Client
Hints, same GPU vendor class. Per-origin separation now rests on the GPU string, cores, memory and
the noise keys. Same-persona collision probability per family is 0.223 (win) / 0.183 (mac) / 0.206
(linux), against 0.153 for the old unconstrained pool: slightly worse, same order, and the reason
the families had to be stocked to 5–6 before this shipped rather than after.

**A shim bug this measurement found, and fixed.** `shim.js` registers its persona listener before
publishing its boot nonce, so a loader that replies *synchronously* is served before stage 1 runs —
and stage 1 then overwrote the delivered persona with the fallback while `{upgraded: true}` had
already gone out. The shim presented the fallback and reported that it had rotated. The real loader
replies asynchronously (a service-worker round trip) so production never hit it; the harness replies
synchronously and hit it on the first run. Stage 1 is now guarded on `!state.persona &&
!state.standingDown`. Two lines, plus the same guard on the allowlist stand-down path.

**Unknown host → the largest family (Windows), not a failure.** Failing closed would mean no
persona, i.e. the real machine on display — strictly worse than a consistent persona naming the
wrong OS, which is the state every Mac user was in until today. Failing to a *random* family would
break the determinism the whole design rests on (D2). ChromeOS maps to `linux` deliberately: it is
the only other platform that runs this extension, it already reports `Linux x86_64`, and it shares
the fontconfig/FreeType and Mesa surfaces that motivate the constraint. That is an approximation,
and it is written down as one.

**Would change this:** a way to reach below the JS layer from a WebExtension, which would make the
foreign-OS persona survivable again. There is none. Failing that, the only revisit worth making is
the *size* of each family — if Linux's share of Chrome users made a 5-persona family look thin,
that is an argument for more entries, not for lifting the constraint.

**⚠ Owed before public release.** The four new Linux renderer strings are reconstructed from the
documented Mesa/NVIDIA formats, not read off a real Ubuntu machine — this lane has no Linux host.
A renderer string no driver emits is a fingerprint of Nullecho itself. `uaData.platformVersion` on
Linux carries the same doubt (Chrome may report an empty string there; the pool has claimed
`6.8.0` since before this change). Both are flagged in `personas.js` and neither is reachable from
this Mac, but a Linux user gets them.

---

## D17 — Prove the GPC exception *mechanism*, not all fifty *hosts*. 2026-08-21.

**Decision:** Tier C.15 of the ship gate no longer requires visiting the ~50 shipped GPC exception
hosts. It requires proving the mechanism on **one excepted host and one control host**, on top of
the static three-way coherence proof the validator already enforces on every build.

**Why the original framing was wrong.** "Visit fifty sites and check" treats the fifty entries as
fifty independent behaviours. They are not. They are **one mechanism applied fifty times**:

- `rules/gpc.json` rule 5000 suppresses the `Sec-GPC` **header** via `excludedRequestDomains` +
  `excludedInitiatorDomains`.
- Both manifests suppress the **JS property** by excluding the `src/gpc.js` content script via
  `exclude_matches`, one `*://*.<domain>/*` pattern per entry.
- `ext/rules/validate.mjs` fails the build if any entry appears in one place and not the others —
  in **both** directions, and across **both** manifests. Verified 2026-08-21: 50 / 50 / 50, zero
  drift, and `excludedRequestDomains` ≡ `excludedInitiatorDomains`.

So the fifty hosts do not differ in *code path*. They differ only in *list membership*, and list
membership is inherited from EasyPrivacy's GPC section — a list maintained continuously by more
people than we have. Re-deriving someone else's blocklist by hand is not a use of the one scarce
resource this project has, which is human attention.

**What the two-site check actually buys.** The failure modes worth catching are mechanism failures,
and each shows up on a single site:

| Failure | Caught by |
|---|---|
| `exclude_matches` silently not applied → property present on an excepted host | the excepted host reading `true` instead of `undefined` |
| GPC never installed at all → the feature is dead everywhere | the control host reading `undefined` instead of `true` |
| Content script excluded but the loader stalls waiting for its boot nonce → **fingerprint protection silently dies on all fifty** | the excepted host still getting a persona |

That third row is the one that would actually have hurt, and it is a *mechanism* bug by
construction — it cannot be host-specific. (Checked 2026-08-21: `maybeDeliver()` gates on the shim
nonce only and treats the GPC nonce as optional, with a comment saying why. Correct already.)

**What this does NOT license.** It does not license trusting the list's *contents*. If a user
reports GPC breakage on a host not in the list, that is a real bug and the fix is a new entry — the
recovery path (`setSiteException`) exists precisely because the shipped list will be incomplete.
And it does not license skipping the render: reading the JSON is not the check. **Two real page
loads in real Chrome, or it did not happen.**

**Chosen host:** `open.spotify.com` — in the shipped list, publicly reachable, needs no account,
and is not a bank or a checkout, so a tester can run it without risking anything that matters.

---

## D18 — The blocking layer needs a POSITIVE proof, and it is a harness, not a counter. 2026-08-21.

**Decision:** `harness/blocking-proof.html` is the artifact that closes "does blocking actually
happen." It requests six real tracker library URLs and three allowlisted control URLs and reports
which were cancelled.

**Why the popup counter was not enough.** The counter was the only evidence, and it is the weakest
possible kind: a number our own code computes about our own behaviour. Two ways it lies —

1. **It can read zero while blocking works.** In a *packed* build Chrome withholds
   `onRuleMatchedDebug` (unpacked-only), so the listener never registers and the popup falls back
   to `getMatchedRules()`. Dev-mode testing exercises the path real users never get.
2. **It can read non-zero while blocking does nothing.** Both DNR feedback APIs report every rule
   that *acted* on a request, not just blocking ones — `gpc.json` rule 5000 touches nearly every
   request, and allowlist `allowAllRequests` rules fire exactly where we blocked nothing.
   `classifyMatchedRule()` exists to sort that out, and a bug in it is invisible from inside.

The harness is independent of both: it observes the *network*, not our bookkeeping. A cancelled
request is cancelled whatever our counters believe.

**The two are now a cross-check, not redundant.** Harness says blocked + popup says zero → the
counting path is broken. Harness says loaded + popup says blocked → `classifyMatchedRule()` is
miscounting non-blocking matches. Neither reading alone would have surfaced either bug.

**Design constraints honoured.** Every probe URL is a static library asset (`analytics.js`,
`fbevents.js`, `gpt.js`), never an event beacon (`/collect`, `/tr?`) — running the test must not
record a page view or a conversion for anyone, least of all from a privacy tool. The page discloses
that it contacts these hosts when the extension is off, and requires a click.

**It refuses to score a pass in the wrong browser.** The page detects Electron / non-Chrome and
downgrades any verdict to `NOT AUTHORITATIVE`. This project has twice built conclusions on a
measurement taken in the in-app Electron pane and labelled Chrome; that lesson is now in code
rather than in a comment someone has to remember to read.

**Calibrated 2026-08-21** in the Electron pane as a deliberate negative control: 0/6 trackers
blocked, 3/3 controls loaded, `globalPrivacyControl` undefined — i.e. all nine URLs are live and
reachable, so under a real install any "blocked" row is attributable to Nullecho and not to a dead
URL. Verified readable in light and dark.

## D19 — Request headers follow the persona at OS-family level, from static, generated DNR rules. 2026-09-16.

**The defect (REVIEW-2026-09-16 B2).** The shim pins `navigator.userAgent` / `userAgentData` to
the persona — Chrome/151, the persona's platform, architecture, platform version — while the
browser kept sending its **real** `User-Agent` and `Sec-CH-UA-*` headers on every request. A
server comparing the two (the standard spoof check the big fingerprinting vendors run) saw a
contradiction on every page; it was already true for `Sec-CH-UA-Arch` on the Intel-Mac persona
and `Sec-CH-UA-Platform-Version` on macOS 26 hosts, and after any Chrome update it would have
been true for everyone. That is the D11 failure mode — identifying *and* flagged as evasive.

**Decision.** Three static `declarativeNetRequest` `modifyHeaders` rulesets, one per host OS
family (`rules/ua-win.json`, `ua-mac.json`, `ua-linux.json`), each rewriting `User-Agent` on
every request and `Sec-CH-UA`, `-Mobile`, `-Platform`, `-Full-Version-List`, `-Full-Version`,
`-Platform-Version`, `-Arch`, `-Bitness`, `-Model`, `-WoW64` on secure requests, to the
family's persona values. All three ship `"enabled": false`; `background.js` enables exactly the
host family's one (`applyUaRuleset()`) at every worker start. The files are **generated**
(`rules/gen-ua.mjs`) from `src/personas.js` and the shim's GREASE constant, and `validate.mjs`
fails if they drift from the generator — a hand-edited header is the defect itself.

**The two options, evaluated against D2 ("detectable-but-consistent is acceptable;
self-contradicting is not") and the timing race.**

| | (1) per-origin session/dynamic rules, written when a site's persona is assigned | (2) one static ruleset per host family — chosen |
|---|---|---|
| First request to a site (`main_frame`) | **Loses.** The persona is derived in the worker *after* the frame's handshake; the navigation has already gone out with the real headers. Every first impression — the moment fingerprinting scripts fire — is a contradiction. | Right from the first byte. D12 already pins every persona this host can be shown, the pre-handshake fallback included, to one family; the family's `ua`/`uaData` are known before any request exists. |
| Head-of-document requests during the handshake window | Real headers (rule not yet written). | Persona headers. |
| Exactness | Exact persona per origin — *after* the race. | Family-level: exact for every field on every persona except one (below). |
| Rule budget / lifetime | One `modifyHeaders` rule per visited site, in the scarce "unsafe" dynamic/session budget; session rules die with the browser and re-race at every startup; dynamic rules persist but have to be reconciled like the heuristics rules. | Six static rules; enablement persists across sessions and resets only on extension update, where `init()` re-enables it within the first worker start. |
| Allowlisted sites (shim stands down, `navigator` real) | Needs explicit removal, or the header lies where the JS is honest. | Free: `allowAllRequests` at priority 100000 suppresses every lower-priority `modifyHeaders` rule, so the real headers go out exactly where the real navigator does. |

(1) fails D2 on precisely the request that matters most, and no amount of engineering moves
the persona derivation ahead of the navigation that triggers it. (2) is consistent everywhere
the JS persona runs, at the cost of one field on one persona. Chosen: (2).

**What remains contradictory afterward — precisely.**

1. **`macos-chrome-intel-iris`**: JS `getHighEntropyValues().architecture === "x86"`, header
   `Sec-CH-UA-Arch: "arm"` (the family's weight-majority: the other five macOS personas, 92% of
   the family, say `arm`). Only visible to a server that reads the hint. The clean fix is one
   deletion in `src/personas.js` — retire the persona and re-weight to 100; the family still
   clears `MIN_PERSONAS_PER_FAMILY`. Not done here (that file is outside this change).
   `rules/ua.test.js` pins the residual list to exactly this entry; the B2 guard in
   `src/review-2026-09-16.test.js` boots the real shim for all 16 personas and asserts this is
   the *only* mismatch across 176 persona×header pairs.
2. **High-entropy hints are sent unsolicited.** DNR `set` adds a header that is absent, and
   Chrome sends `Sec-CH-UA-Arch` / `-Bitness` / `-Model` / `-Platform-Version` /
   `-Full-Version(-List)` / `-WoW64` only after a server asked via `Accept-CH`. Under these
   rules they go out on every secure request. That is a behavioural tell — "this client
   volunteers hints" — not a contradiction: the values agree with the JS. It was weighed
   against `remove` (never send them, even when asked), which yields "a Chrome 151 that ignores
   `Accept-CH`"; both are anomalies, but unsolicited hints are common in the wild (Permissions-
   Policy delegation hands third parties hints they never requested) and `remove` gives the
   vendor's comparison nothing consistent to see. `set` was chosen; if a real-browser capture
   shows a vendor flagging it, `remove` is a one-word change per header in `gen-ua.mjs`.
3. **Worker scope (A8).** No shim runs in Workers, so a worker's `navigator` is the real
   machine (Chrome/152, real arch) while its `fetch()`es now carry the persona header. Before
   this change workers *agreed* with the headers and the main thread did not; now the main
   thread agrees and workers do not. Net fewer contradictions (the main thread is where the
   checks run), but the worker gap is now also a header gap. The fix is A8's worker shim.
4. **Contexts with no content script but real network requests** (Web Store and AMO are
   excluded; `chrome://`-initiated fetches, `file://` without file access, the PDF viewer,
   other extensions' requests are not): the persona header goes out with no JS to contradict
   it. Harmless, listed for completeness.
5. **Firefox.** The personas already claim Chrome on Firefox; the headers now claim Chrome and
   carry Client Hints Firefox never sends. Consistent at the HTTP+JS layer; the engine (TLS
   ClientHello, HTTP/2 SETTINGS, default `Accept`) still says Firefox. Pre-existing persona
   design, not widened by this change.
6. **The version itself.** The pool pins Chrome 151 and the host is 152 (or later); features
   that shipped after 151 exist under a "151" UA. Pre-existing and growing with every Chrome
   release; the headers now track the *persona*, so bumping `personas.js` and regenerating
   keeps them consistent, but the pool has to be bumped. The reviewer's alternative — read the
   real major from the unpatched UA at boot and substitute it into the persona — would make
   the host the source of truth for the version and remove the need for a version in these
   rules entirely (`User-Agent` and the brand lists would then need no rewriting, only the
   platform hints). Recorded as the follow-up that supersedes the version half of this
   decision; it needs `shim.js`/`personas.js` changes.
7. **Install/update window.** Enablement resets on extension update; until `init()` runs on
   the first worker start after install/update, real headers go out — identical to the state
   before D19, for milliseconds.
8. **Not rewritten:** `Accept-Language` (B1, a separate decision), `Sec-CH-UA-Form-Factors`
   (real value `"Desktop"` already equals the persona's).

**Verified, and what is not.** The rule bytes are proven against the real shim's `navigator`
in Node (`bootRealm` per persona). The DNR semantics this rests on — `modifyHeaders` applies
only above matching `allow` rules; enablement persists across sessions and resets on update —
are from Chrome's documentation. **Not yet captured in a real browser:** the actual header
bytes on the wire and that `set` adds absent hints the way MV3 UA-switcher extensions rely on.
Until `harness/` captures a request in real Chrome, the review's "`Sec-CH-UA-*` headers"
line stays in its *unconfirmed* section, and this decision's claim is "the rules are correct",
not "the headers were observed". Add that capture to the breakage-testing gate.

**Permissions.** `declarativeNetRequest` + `host_permissions: <all_urls>` already cover
`modifyHeaders`; `declarativeNetRequestWithHostAccess` is not needed. Nothing changed on either
manifest's permission list (`PERMISSIONS.md`).

## D20 — A strike is something the third party did. URL-derived and page-reported strikes are retired. 2026-09-16.

**The defect (REVIEW-2026-09-16 A5).** The heuristic layer's `ID_PARAM` strike was derived
from the request URL alone. The embedding page writes the URL, so three attacker-controlled
first parties (three free GitHub Pages sites qualify) each loading
`victim.example/x.png?gclid=<random>` earned `victim.example` three strikes → a persistent
dynamic `block` rule for that user, everywhere the domain appears as a third party. A page
must never be able to get a third party blocked.

**Decision.**

1. **`ID_PARAM` is retired, not tightened.** Every way of keeping a URL-derived strike was
   examined and each is still under the attacker's control: *require the value to be reflected
   by the third party* (any canonicalising redirect — `http→https`, trailing slash — reflects
   the whole query string in `Location`); *require a second signal class on the same tracker*
   (the attacker forges two of three strikes, and any site with a session cookie supplies the
   third — see 2); *discount free-hosting suffixes* (three `.xyz` domains cost three dollars);
   *remember identifier values to match a cookie the tracker set against a later parameter* (a
   log of identifiers, which `PERMISSIONS.md` promises the observer does not keep). The honest
   conclusion: the network layer sees the initiator origin and the URL, never which script
   built the URL, so it cannot distinguish a parameter the third party originated from one the
   first party pasted in. Privacy Badger's equivalent (first-party cookie value appearing in a
   third-party URL) has the same forgeability; Badger accepts it, this threat model does not.
2. **`SET_COOKIE` counts only a cookie the browser would actually keep cross-site**:
   `SameSite=None` and not `Partitioned`. Chrome (80+) drops any other cookie from a cross-site
   response before it could identify anyone, so a PHP session cookie on an image was never
   tracking — and counting it was a second strike source an attacker could drive by embedding
   any such site on three pages. Trackers that work in Chrome already set `SameSite=None`;
   Firefox partitions third-party cookies regardless. Coverage cost: none measurable.
3. **`CANVAS` / `SUPERCOOKIE` are removed (REVIEW C3).** `handleContentReport()` waited for a
   `{type:'nullecho:signal', signal, scriptUrl}` message that no file has ever sent; the shim
   reports `nullecho:fp-detected` as `{api, count}` with no script attribution. Wiring it would
   mean blaming an unattributed canvas read on whichever third party is on the page — A5 through
   a different door. The function stays exported as a closed gate (`return false`) so the
   review's C3 reproduction keeps running; `background.js` no longer calls it. The gap is real:
   the learner cannot see fingerprinting, only cookies. If the shim ever attributes a read to a
   script origin obtained from the browser rather than the page, that gate is where it lands.
4. **Bit hygiene.** The retired bits (4, 8, 16) are reserved, never reassigned;
   `recordSignal()` masks its input to live bits so no caller can resurrect a source by number;
   `ready()` scrubs retired bits out of persisted state and forgets sites whose only evidence
   was retired. A record already `blocked` is *not* demoted — a user-written block is
   indistinguishable in storage from a learner-written one, and nothing had shipped.
5. **Unchanged:** EFF's three-strike rule, the `NEVER_BLOCK` guard, the yellowlist, the
   dynamic-rule budgets, reconciliation.

**What the learner can still be pushed into, and why that is accepted.** A third party that
deliberately sets `SameSite=None` identifying cookies in third-party contexts, embedded by an
attacker on three pages, still earns three strikes. That *is* cross-site tracking behaviour by
the EFF definition the layer implements — the attacker did not forge the evidence, the third
party produced it — and it is the same exposure Privacy Badger carries. What the attacker can no
longer do is manufacture evidence.

**Cost.** Cookieless link-decoration trackers are no longer learned; the static lists cover
the known ones (the `gclid`/`fbclid`/`msclkid` consumers are Google, Meta and Microsoft, all
listed). The observer also dropped its `onBeforeRequest` listener entirely — one fewer
per-request callback in the service worker.

---

## D21 — The shim never calls a prototype at run time; every builtin is captured at boot. 2026-09-16.

**Decision:** `src/shim.js` and the page half of `src/gpc.js` capture *every* builtin they will ever
invoke — constructors, statics, prototype methods and accessors — into local constants at
`document_start`, and invoke them only through a boot-captured `Reflect.apply`. No `fn.call(…)`,
no `fn.apply(…)`, no `Math.imul`, no `str.charCodeAt(i)`, no `new Set(list)`, no `arr.filter(…)`
anywhere after the capture block. A lint in `review-2026-09-16.test.js` fails the suite on any
bare builtin use after the `END CAPTURED BUILTINS` marker in either file.

**What A2 was.** Section 0a captured four primitives — `JSON.parse`, `CustomEvent.prototype.detail`,
`addEventListener`/`dispatchEvent`, `crypto.getRandomValues` — and its comment claimed that made
"the ONLY way to beat the handshake winning the document_start race." The review (A2a–A2f, C2)
showed that claim was false against a page script of a few lines running at any *later* moment:

| Page hook, installed after the shim booted | What the shim did with it |
|---|---|
| `String.prototype.charCodeAt = () => 0` | `nonceMatches()` compared 32 zeros to 32 zeros → any 32-char nonce authenticated → a forged `{enabled:false}` was obeyed → `restoreAll()`, real machine — and the popup was told `allowlisted`. Same hook, same effect in `gpc.js` (`navigator.globalPrivacyControl` deleted by the site it is aimed at). |
| `Function.prototype.call` / `.apply` hook | every `spoofGetter` did `origGet.call(this)` for the brand check, every `replaceMethod` wrapper did `orig.apply(this, arguments)` — the hook received the **native** getter/method as `this`: real `userAgent`, `hardwareConcurrency`, `deviceMemory`, `getParameter` (real GPU), `toDataURL` (un-noised canvas). |
| `%TypedArray%.prototype.length` → 0 for one read | the ink scan in `noiseRGBA`/`readPixels` saw an empty buffer → returned the real pixels. |
| `Math.imul = () => 0` | `prf`/`fin32`/`keyMix` collapsed → noise identical on every site, persona-independent. |
| `WeakMap.prototype.get` hook | the patched `Function.prototype.toString` consulted `NATIVE_SRC` through it → the hook received the map → `has()` became an exact, enumerable oracle of every function the shim replaced (C2). |

**Why "beating the handshake requires beating the race" was false.** The race argument is about
*capture time*: whatever we capture before the page runs, the page cannot later swap. It says
nothing about what we *fail* to capture. Every prototype method the shim resolved at call time —
`.call`, `.charCodeAt`, `Math.imul`, `.length`, `.get`, `.filter`, `Set.prototype.has`, `new Set(...)`
(which calls `add` through the prototype), `Promise.resolve`, `Object.freeze`, `Array.isArray`,
`ArrayBuffer.isView`, the DOM accessors the noise path reads (`canvas.width`, `ImageData.data`,
`ctx.canvas`, `getContext`, `createElement`) — was a lookup on an object the page owns, performed
after the page owns it. Winning the race bought exactly the four captured primitives and nothing
else. The handshake was authenticated by a comparison the page controlled.

**The rule.** *The shim never calls a prototype at run time; every builtin is captured at boot.*
Concretely:

- One primitive routes everything: `const apply = Reflect.apply`. `uncurry(fn)` turns a prototype
  method into a receiver-first function; the rest parameter builds a fresh array, so no iterator
  protocol is involved. `apply(fn, thisArg, arguments)` reads only own properties of `arguments`.
- Constructors and statics are held as locals (`RawSet`, `RawWeakMap`, `RawString`, `objFreeze`,
  `mathImul`, `arrayIsArray`, `arrayBufferIsView`, …). A page can reassign `window.Set`; it cannot
  reassign a `const` in our closure.
- Sets are built with `setOf(list)` — `new RawSet()` then captured `setAdd` in a loop — never with
  the constructor's iterable path. Deny lists and feature sets are built once at boot; `derive()`
  (which runs at handshake time, after page scripts) only points at them.
- Our own arrays are appended with `pushOwn` (`Object.defineProperty` at index `length`), never
  `push`, because `[[Set]]` on an index consults the prototype chain and a page can define an
  index setter on `Array.prototype`. Native arrays that carry real values (the WebGL extension
  list) are walked by index and copied the same way — never `.filter`, whose species lookup hands
  the real array to the page.
- `%TypedArray%.prototype.length`/`byteLength` getters are captured and used for every buffer
  length; "8-bit view" is decided from `byteLength === length`, not `BYTES_PER_ELEMENT` (a plain
  data property on the page's prototype).
- Per-realm DOM natives are captured at `installInto()` time — for the main window that is
  `document_start`, for a child realm the first `contentWindow` read, before the page has touched
  it — through `propReader`/`propWriter`/`methodCaller`, which fall back to a plain property read
  only when the realm has no such accessor (test rigs; every real browser has them).
- Regexes are tested with a captured `RegExp.prototype.exec` (`reTest`), never `.test`, which
  looks `exec` up on the way. Runtime `.replace`/`.split` were rewritten as loops.
- The brand-check delegation ("always invoke the original first", ARKENFOX-RESPONSE (f)) is kept —
  it is right — but goes through `apply(origGet, this, [])`.

**Exemptions, named so nobody widens them silently:** the generated persona mirror (G7) and
`registrableDomain` + its suffix table. Both are boot-only, and `review-2026-09-16.test.js` (A4c,
A4d) lifts the latter out of the file by regex and runs it in a bare context, so it must stay
byte-identical. `personas.test.js` also pins the `for (const p of HOST_POOL)` loop in `personaFor`
(boot-only) as the D12 constraint.

**A3 rides on the same fix — and the delivery order it forced.** The loader's `nullecho:persona`
event carried the whole persona (noise keys, seed) and nothing stopped it, so a page listener on
`window` (capture) registered after us read it and could compute our exact perturbation for any
canvas without drawing a probe. Now the shim, once *its* nonce authenticates a delivery, calls the
captured `Event.prototype.stopImmediatePropagation` — we are the first listener on the first node
of the path, so nothing after us runs. The trap the reviewer flagged: `gpc.js` consumes the same
event and registers after us, so it would never hear its config. Decision: the loader still sends
one event; the shim re-dispatches a stripped `{ ok, enabled, gpc, gpcNonce }` on the same channel,
which `gpc.js` authenticates with its own nonce (D13) and stops in turn. The relay is skipped when
the loader had no gpc nonce (gpc.js is `exclude_matches`-ed off ~50 hosts), so on those pages
nothing at all reaches a page listener. Order: shim authenticates → shim swallows → shim relays →
gpc authenticates → gpc swallows. A second event name was rejected because it would have changed
the protocol and every consumer for no gain over the relay. An unauthenticated event is *not*
swallowed — it is the page's own, and eating it would be a free "Nullecho present" probe.
`shim-handshake.test.js`'s fake dispatcher now models immediate-stop and its "page window-capture
listener" test asserts the page learns nothing, where it used to assert the leak and call it
harmless. `seed` is still sent by the worker; with propagation stopped it no longer reaches the
page, and dropping it from the payload is a `background.js` change for a later pass.

**Found while auditing, fixed in passing:** `OffscreenCanvas.convertToBlob` noised through
`CanvasRenderingContext2D.prototype.getImageData` on an *Offscreen* context — Illegal invocation
in Chrome, caught, and the call fell open to the native, un-noised blob. It now uses the Offscreen
interface's own captured methods. The wider pattern (noise failure → fall open to the native
call) is unchanged and is a residual: every DOM accessor on the noise path is now captured, so a
page can no longer *cause* that failure from a prototype, but a genuine exception still yields the
real bytes rather than none.

**Test-enforced invariant** (`review-2026-09-16.test.js`, all flipped from reproductions into
guards; 256/256 at the time of writing):

1. `A2a`/`A2b` — with `Function.prototype.call`/`apply` hooked, the shim routes **zero** functions
   through them during spoofed reads and no native getter/method can be harvested.
2. `A2c`/`A2d` — with `String.prototype.charCodeAt` hooked to 0, a forged 32-char nonce is rejected
   in both scripts, and the genuine nonce is still accepted *while the hook is live*.
3. `A2e`/`A2f` — with `%TypedArray%.prototype.length` or `Math.imul` hooked, the noised bytes are
   byte-identical to the unhooked read, and two sites still differ.
4. `A2-timing` — a dozen builtins hooked (hostile where possible) *before* the genuine handshake
   lands and kept live through it: the upgrade authenticates, every spoofed value holds, canvas is
   noised, `getHighEntropyValues` resolves, and the harvest of everything routed through the
   observing hooks yields no native, no raw canvas and no `NATIVE_SRC` oracle. Unhooking changes
   no byte.
5. `A2-lint` — no bare builtin global, constructor or prototype-method call after the capture
   block in `shim.js` or the page half of `gpc.js` (comments and strings stripped; positive and
   negative controls were run against the regexes before trusting them).
6. `A3` — a page listener on window-capture and document sees neither the delivery nor the relay;
   `gpc.js` still receives `{gpc:false}`; with gpc.js absent nothing is relayed and an
   unauthenticated event propagates normally.
7. `C2` — a `WeakMap.prototype.get` hook is never invoked by the patched `toString`, which still
   reports `[native code]` for a patched getter while the hook is live.

Verified in the harness (`/harness/shim-test.html?salt=nullecho-shim-test-0003`, served fresh —
`shim.js` 200, not cache): SHIM ON, 39/39, 0 patch failures, 50-read self-test stable, and a live
`call`/`apply` hook during spoofed reads routes nothing. The Browser pane is Chromium-in-Electron,
not a Chrome install; the JS semantics this decision rests on are the engine's, but a real-Chrome
render of the harness is still owed before any ship claim (BASELINE rule).

**What this does NOT change:** if the page owns the realm *before* the shim runs (the MAIN-world
injection race, THREAT-MODEL.md), it can pre-hook what we capture. That was always outside the
page's power to fix and is still measured by the loader (`nonce-exposed`). D21 makes the race the
*only* way in, which is what section 0a claimed and did not deliver.

## D22 — Noise is keyed on the content it perturbs; silence is never noised; one digest per read. 2026-09-16.

**Decision:** every noise value the shim produces — canvas `getImageData`/`toDataURL`/`toBlob`/
`convertToBlob`, WebGL `readPixels`, `AudioBuffer` channel data, `AnalyserNode` spectra — is now a
function of `(persona noise key, geometry, digest(real content), position)`. The digest is FNV-1a
over every byte (bit-exact over float samples via a `Uint32Array` view), finalised and mixed into
the key with `keyMix`. For a 2D canvas the digest and the ink gate are computed over the **whole
canvas once per read** and the returned rectangle is sliced from that. A buffer with no content —
no ink, all-zero samples, an all-`-Infinity` dB spectrum, an all-zero byte spectrum — is returned
untouched, and for `AudioBuffer` is *not* remembered as noised, so a later fill gets noised on the
next read. Zero bins inside a live byte spectrum are also left alone.

**What A1 was.** The kernel's own docstring said it: the perturbation for a pixel depended only on
`(persona key, canvas w×h, absolute coordinate)` — never on the pixel. So the pattern for a given
canvas size was a *constant*, and a page could learn it from any input it chose: draw a uniform
grey, read it back, subtract 128 — that is the pattern; subtract the pattern from the real
fingerprint canvas — that is the real machine, byte-exact (review A1a). Two sites with two personas
gave two patterns and two noised outputs, and the same recovered bytes: the cross-site join we exist
to break, restored in twenty lines (A1b). Audio was worse: a never-written `AudioBuffer` read back
as the noise vector itself, so the "probe" did not even need content (A1c, B4). The docs published
the uniform-fill detector `{126,127,128,129,130}` as "what canvas noise is" — the first half of the
attack, in our own README.

**Why content keying closes it.** A pattern is now specific to the exact bytes it was computed for.
The attacker's probe yields the pattern for *the probe*; the fingerprint canvas has a different
digest, hence an unrelated key, hence an unrelated pattern; subtraction leaves the noise in place
(A1a guard: recovered ≠ truth, and a fill one LSB away yields a different pattern). Two sites still
differ after subtraction and neither recovers the truth (A1b guard). The averaging defence is
unchanged: same content → same digest → same key → the same bytes on every read, on every path
(`toDataURL` encodes exactly what `getImageData` returns; the shim's 50-read self-test still
reports one hash).

**B5 rode along, and it forced the whole-canvas rule.** With the ink gate evaluated on the *returned
rect*, a transparent corner read alone came back as zeros while the same corner inside a full read
was noised — two reads of one region disagreed, contradicting the kernel's own promise. Keying on
the digest of the returned rect would have kept that disagreement (different rect, different
digest). So a partial `getImageData` now performs one extra native full-canvas read to compute the
gate and the digest, then noises only the requested rectangle at absolute coordinates. Cost: one
extra copy per *partial* read; whole-canvas reads (what fingerprinters do) pay nothing extra. Not
done for WebGL `readPixels`, where the read region is all we have — it is keyed on the region's
bytes, so sub-rectangle and full reads of one framebuffer disagree there as they did before
(different `w×h` already gave different keys). Recorded, not hidden.

**What this does not do.** Bounded, sparse, additive noise is inherently vulnerable to a
*dictionary* attack: a page holding a library of known real renderings can test each candidate by
checking whether `noised − candidate` looks like our kernel (values in {0, ±1, ±2}, ~1 in 8 pixels).
No keying defeats that; only noise indistinguishable from real rendering variance would, and that
would be a different product. The honest claim (D9/D11) already says "detectable, does not defeat a
determined adversary"; this decision narrows what a page can do *without* such a library from
"recover the real bytes with one probe" to "nothing".

**Implementation notes, so nobody re-opens it.** `scanBytes`/`scanF32` write into one shared
`facts` record (no per-read allocation) and read lengths through the captured
`%TypedArray%.prototype.length` (D21 — the A2e hook). The float digest needs three new captures
(`Uint32Array`, `buffer`, `byteOffset`); Float32 views are 4-byte aligned by construction so the
view never throws. `patchGetImageData` now takes the width/height readers for the context's *own*
canvas type — the `HTMLCanvasElement` getters applied to an `OffscreenCanvas` throw, which
previously routed every offscreen partial read to `fail()` un-noised. `noiseRGBA` no longer gates;
callers gate on the whole canvas. Regression guards: A1a, A1b, A1c, B4, B5 in
`review-2026-09-16.test.js`, each the inverse of the reproduction it replaced.

**Measured in real Chrome (2026-09-16, `harness/shim-test.html` on 127.0.0.1, this Mac):** 50
consecutive reads → 1 `toDataURL` hash and 1 `getImageData` hash; 10× stability → 1 value; 39/39
consistency assertions. The A1a attack itself, run live against a `?shim=off` capture of the same
64×32 text drawing: the noised read differs from the truth on 261 of 2048 pixels (≈1 in 8, as
designed); subtracting the pattern learned from a 128-grey fill leaves **482** pixels wrong — it
adds error instead of removing it; fills of 128 and 129 yield different patterns (750 vs 708
non-zero deltas, disjoint). Before D22 the same subtraction was byte-exact.

## D23 — One public-suffix table, generated into the shim, pinned by value. 2026-09-16.

**Decision:** `src/suffixes.js` is the only multi-label suffix table and the only
`registrableDomain()`. The service worker imports it (`heuristics.js` re-exports it, so
`background.js siteKeyFor` is unchanged). `shim.js` — which MV3 forbids from importing — carries a
GENERATED SUFFIX MIRROR block written by `tools/gen-suffix-mirror.mjs` from the module's array and
the function's own source; `review-2026-09-16.test.js` A4d fails on any drift and runs the shim's
copy, the worker's export and the module against a corpus built from the table itself. The table is
the sorted union of the two old lists: 104 entries, all in the real PSL.

**What A4 was.** Two hand-typed tables, 41 entries apart, with a comment on one saying it "mirrors"
the other. The worker's lacked the platform suffixes, so `acme-store.myshopify.com` and
`other-store.myshopify.com` were ONE site: one salted persona across every Shopify storefront (zero
cross-site separation across ~5M of them), and allowlisting one store wrote a dynamic DNR
`allowAllRequests` rule for `myshopify.com`, which DNR matches on every subdomain — blocking off and
the shim standing down on every store the user never touched (A4a, A4b). The shim's lacked
`co.il`, `co.id`, `co.th`, `com.ua`, `com.pl`, `com.ru`, `com.es`, … so `ynet.co.il` and
`walla.co.il` got the same *fallback* persona — the persona every page that fingerprints before the
handshake lands is locked to (A4c). Two layers keying one site two ways also means the "upgrade"
from fallback to salted persona could be a different machine, not the same one re-salted.

**Why generate rather than hand-copy.** The persona pool already had this exact failure (G7: "keep
it in sync" drifted twice) and the fix that held was a generated mirror plus a value-level pin
(`personas.test.js`). Same medicine: the generator is idempotent, the test compares evaluated values
rather than text, and the corpus check catches a divergence in the *function*, not just the list.
Shipping the real PSL (~60 KB gzipped for ICANN + private) was considered and deferred: the subset
covers what appears in tracking, and a wrong entry over- or under-merges two domains, which the
three-site rule already bounds.

**Trap for the next editor.** The function in `suffixes.js` must stay plain JS — no captured
builtins — because its source is copied verbatim into the shim's boot-only region that the D21 lint
exempts by regex (`const MULTI_LABEL_SUFFIXES … function registrableDomain(hostname) {…}`). Rename
either identifier and the lint stops exempting it; change the `new Set((…).split('|'))` shape and
A4c/A4d stop finding it.

## D24 — The Intel-Mac persona is retired; the pool carries no header/JS contradiction. 2026-09-16.

**Decision:** `macos-chrome-intel-iris` is removed from `src/personas.js` and the shim's mirror. The
macOS family is five personas; its 8 points of weight went to the two 16 GB entries (`m2-air` 22→26,
`m3-4k` 16→20) so the family's memory spread is unchanged (8 GB 40% · 16 GB 46% · 32 GB 14%), no
persona exceeds 26% of its family, and the same-persona collision probability is 0.210 (cap 0.25).
`rules/ua.test.js` and the B2 guard now pin the residual list to **empty**; `gen-ua.mjs` emits no
residual and the generated `ua-*.json` bytes did not change (the weight-majority values were already
`arm`/`14.6.0`).

**Why retire rather than host-gate.** D19 rewrites request headers per OS *family* from a static
ruleset, because the main-frame navigation fires before any content script exists and per-origin
rules cannot cover it. So the macOS ruleset says `Sec-CH-UA-Arch: "arm"` on every Mac host — Apple
silicon or Intel — and the one `x86` persona contradicted it on *every* host, not just the arm ones
the review measured. The alternative was two macOS rulesets selected by host architecture, which
would have required ≥4 `x86` macOS personas so an Intel-Mac user did not get one machine for every
origin (the D12 failure mode) — four personas for a shrinking install base, to preserve one. An
Intel-Mac host is now disguised as an Apple-silicon Mac; nothing below the JS layer that the shim
leaves truthful (display geometry, colour gamut, dynamic range — D11/D12) names the CPU.

**What the family constraint still holds.** ≥4 personas per family (5), weights sum to 100 per
family, ≥3 memory buckets with none above 60%, collision below the cap; the validator checks all of
it and `personas.test.js` pins the shim mirror to the pool value-for-value. The options page's
sample data no longer names the retired persona, and ARKENFOX-RESPONSE.md carries a dated note
where it counted 16.

## D25 — The locale is left real; `navigator.language`/`languages` are not spoofed. 2026-09-16.

**Decision:** `src/shim.js` stops patching `navigator.language` and `navigator.languages`. They were
pinned to `'en-US'` and `['en-US','en']`; they now report whatever the host reports, exactly as the
display layer does since D11.

**Why.** The locale is *one* browser preference, and Chrome mirrors it in three places the shim
cannot reach:

| Surface | Under the pin, on a German host |
|---|---|
| `Intl.DateTimeFormat().resolvedOptions().locale` | `de-DE` |
| `(1234.5).toLocaleString()` / `toLocaleDateString()` | `1.234,5` / `16.9.2026` |
| the `Accept-Language` request header (no DNR rule touches it) | `de-DE,de;q=0.9` |
| `navigator.language` | **`en-US`** |

Review B1 measured that in a child process under `LANG=de_DE.UTF-8`. Two lines of page script
flagged every non-`en-US` user, and a server saw German on the wire next to American JS — the D2
failure mode, identifying *and* evasive, reached the same way D12's foreign-OS personas reached it.

**What the pin bought: nothing.** `personas.js` has no locale field and never had one — the pin was
not persona-derived, so no pool data goes unused by this removal and the persona mirror is
untouched. The only defensible alternative was to spoof `Intl` (`DateTimeFormat`, `NumberFormat`,
`Collator`, `RelativeTimeFormat`, `PluralRules`, `ListFormat`, `DisplayNames`, `Segmenter`, plus
every `toLocaleX` on `Date`/`Number`/`String`/`Array`/`BigInt`, and `resolvedOptions()` on each)
*and* rewrite `Accept-Language` from a static DNR ruleset the way D19 rewrites the UA headers — a
project, to hide a field that is not what the cross-site join is built on. D11: prefer a consistent
leak to an inconsistent fake.

**Cost, stated plainly.** Locale is real entropy — a rare language is more identifying than a common
one — and we now leak it. It was already leaking through `Intl` and the header; the pin only added
a second, contradicting copy. THREAT-MODEL.md's "unchanged" column is where locale belongs, beside
timezone and the display layer, for the same reason: the engine describes it below JS.

**Guards.** `B1 GUARD` in `review-2026-09-16.test.js` boots the real shim in a `LANG=de_DE.UTF-8`
child and requires `navigator.language === Intl…locale`, `languages === ['de-DE','de']`, **and** that
the `Navigator.prototype` descriptors are the identical getter objects that existed before the shim
ran — so a future "harmless" re-patch fails even if it happened to return the right string.
Two expectations were updated rather than weakened: the `A2-timing GUARD`'s `languages` line now
pins the host's real list (its captured-`Object.freeze` coverage lives on in the `brands` assertion,
which still runs while the page's `Object.freeze` throws), and `harness/shim-test.html` checks
`language` against `Intl` instead of against `en-US`.

## D26 — `maxTouchPoints` is left real; the touch surface is not spoofed. 2026-09-16.

**Decision:** `src/shim.js` stops pinning `navigator.maxTouchPoints` to 0. It reports the host's
real value, and the touch-event surface stays real as it always did.

**Why.** The pin's stated reason was "the pool is entirely desktop machines". Touch-screen desktops
and 2-in-1 laptops are not a rare configuration, and on one of them everything *around* the pin kept
telling the truth:

- `'ontouchstart' in window` → `true`
- `typeof TouchEvent === 'function'`, plus `Touch` / `TouchList` and the `ontouch*` handler slots
- `matchMedia('(any-pointer: coarse)')` → `true` — a **CSS media feature**, evaluated in the style
  engine below JS, unreachable from a content script, exactly like the display layer of D11

So the pin did not hide a touch screen; it announced that something was lying about one. Making it
consistent would mean deleting `ontouchstart`, three constructors and every `ontouch*` slot from the
window — visible to feature detection, breaking to real touch handling, and *still* contradicted by
the media query, which we cannot touch at all.

**What it costs.** One bit, on the machines that have a touch screen. `maxTouchPoints` is not a
persona field — `personas.js` does not carry it, so, as with D25, nothing in the pool goes unused.
The cross-site join is broken by the personas differing per origin; a bit that is identical for
every origin on this host was never part of that.

**Guards.** `B8 GUARD` boots the realm with a live touch surface (`ontouchstart`, `TouchEvent`),
upgrades to a persona, and requires `maxTouchPoints` to equal the host's real 10, to be non-zero
beside that live surface, and the `Navigator.prototype` descriptor to be the identical getter from
before the shim ran. `harness/shim-test.html` now checks agreement with `ontouchstart` rather than
a pinned 0.

## D28 — C3 formally closed: the dead CANVAS/SUPERCOOKIE report path is now a regression guard. 2026-09-16.

*(Renumbered from D27 to D28 after a concurrent-edit collision: two lanes independently computed
D27 as the next free number and both committed. This entry lost the race in commit order, so it
moves; the B7 entry keeps D27. No content below changed.)*

**Decision:** `review-2026-09-16.test.js`'s C3 reproduction — "`handleContentReport()` waits for a
`nullecho:signal` message no file sends" — is flipped from a REPRO to `C3 GUARD`. The code fix was
already made in `ea0400b` alongside A5 (D20 point 3: `handleContentReport()` is a closed gate that
always returns `false`, `background.js` never calls it, and no file sends `nullecho:signal`), but
that commit's own log only lists A2a-f/A3/C2/A5/B2 as flipped to guards — C3 was left as a REPRO
even though the underlying defect was gone, so the file's own header rule ("a green run … is the
review still being true") was violated for this one finding.

**What the guard checks, beyond the old repro.** (1) no file — `heuristics.js`'s own explanatory
comment excepted — references `nullecho:signal`; (2) `handleContentReport()` returns `false` for
no arguments, for the real `nullecho:fp-detected` shape, and for a forged `nullecho:signal` message,
so the gate is closed to every input shape, not just the one the finding quoted; (3) `H.SIGNAL`
(the promoting bits) contains only `COOKIE`/`SET_COOKIE` — `CANVAS`/`SUPERCOOKIE` never re-enter as
strike sources, they stay in `RETIRED_SIGNAL_BITS` per D20 point 4's bit-hygiene rule; (4)
`ARCHITECTURE.md` contains neither `nullecho:signal` nor a `CANVAS / SUPERCOOKIE` description —
true already, nothing to edit there.

**Cost.** None — no behaviour changed, only the test's classification and the decisions log. This
entry exists so the next reviewer does not have to re-derive, from a REPRO-labelled test, that a
finding whose fix already shipped is actually closed.

## D27 — `userAgentData.brands` is a FRESH frozen array per read, because that is what Chrome does. 2026-09-16.

*(REWRITTEN in place, the same day, after a measurement. The first version of this entry — and the
commit `d7a055c` it described — cached the array, on the review's word that Chrome caches it. The
measurement below says Chrome does not. The old text is not preserved here on purpose: a decisions
log that keeps a disproved claim alongside the true one invites the next reader to re-derive which
is which. What is preserved is **why** it was wrong, immediately below, because that is the part
that generalises.)*

**Decision:** the `brands` getter builds a new array on every read — `copyBrands` into a plain
array, frozen with the captured `objFreeze`, entries left as ordinary writable objects. Nothing is
cached on the derived persona. `toJSON()` and `getHighEntropyValues()` are unchanged: a fresh,
unfrozen array per call. `navigator.languages` is not patched at all (D25), so the engine's own
cached FrozenArray comes through.

**The measurement.** Jason's real Chrome **151.0.0.0 on macOS**, Nullecho **off**, typed into that
browser's own console — *not* the Electron Browser pane this project's harness runs in, which is the
environment caveat D21 already carries and the one that burned this repo on 2026-08-20:

| Probe | Result |
|---|---|
| `navigator.userAgentData.brands === navigator.userAgentData.brands` | **`false`** — a new array per read |
| `Object.isFrozen(navigator.userAgentData.brands)` | `true` |
| `Object.isFrozen(brands[0])`, and `brands[0].brand = 'x'` | `false`, and the write sticks on the array you hold |
| `navigator.languages === navigator.languages`, `Object.isFrozen(...)` | `true`, `true` |
| `await getHighEntropyValues(['fullVersionList'])`, twice | a fresh array each call |

The `languages` row is what makes the `brands` row trustworthy rather than a measuring artefact: the
same engine, the same session, one attribute cached and the other not. Whatever the IDL says about
"create a frozen array", Chrome 151 builds `brands` per get.

**Why the first fix was wrong, in one line:** it was reasoned from the WebIDL algorithm and from the
review's summary of it, and neither was run. The old entry even flagged its own entry-freezing
paragraph "⚠️ Reasoned from the WebIDL algorithm, not measured in Chrome" — the warning was in the
right place and the conclusion above it was not. **A review finding is a claim too** (the repo's own
standing lesson): B7 named a real detector — the shim's array was *unfrozen*, which Chrome's never is
— and got the direction of the identity half backwards. The fix that followed the claim instead of
the browser installed the mirror-image detector: `brands === brands` returning `true` is now exactly
as loud as `false` was, because the population it separates you from is everyone running Chrome.

**What stays true from B7.** Freezing. Chrome's array is frozen and the pre-B7 shim's was not; that
half of the finding is real, is fixed, and stays fixed. Only the caching is reverted.

**Guards.** Two `B7 GUARD`s, both asserting the measurement: a fresh array per read with identical
contents, the array frozen, a page unable to truncate the array it holds, entries unfrozen and
writable with the write gone on the next read, `toJSON().brands !== brands`, the Illegal-invocation
brand check surviving, and `getHighEntropyValues(['fullVersionList'])` fresh per call. The fake
`NavigatorUAData` in `review-2026-09-16.test.js` was changed to match the measurement too, and the
control assertion in the first guard pins the *contrast* — fake `languages` cached, fake `brands` not
— so the rig cannot drift back to modelling a browser that does not exist.

**Known residual — the array's REALM, in child frames.** Closed by D31; see there. The array is
created in the shim's own realm, so when the parent's `installInto(childWindow)` is the outermost
wrapper on an iframe, that frame's `brands` used to be a *parent-realm* array and
`frames[0].navigator.userAgentData.brands instanceof frames[0].Array` was `false` where Chrome says
`true`. `installInto` now carries a per-realm `Array`/`freeze` capture and builds the array in the
realm being patched.

## D29 — Every handshake field is read as an OWN property; nothing is inherited. 2026-09-16.

*(Renumbered from D28 to D29: the C3 lane had already claimed D28 in the same hour. The commit that
introduced this entry says D28; this heading is the number that stands.)*

**Decision:** `src/shim.js` reads every field of the persona payload through `ownField(obj, key)` —
the captured `Object.prototype.hasOwnProperty`, then an ordinary read — and never as `payload.x`.
That covers `nonce`, `ok`, `reason`, `dev`, `enabled`, `persona`, `persona.id`, the fields
`validPersona()` checks, and the four the shim relays to `gpc.js`. The relay also substitutes an
explicit `null` for any field the loader omitted.

**What B9 was.** `if (payload.dev === true) installDevSurface()`. `background.js` never sends `dev`,
so that read consulted `Object.prototype` on **every genuine handshake**. A page that ran
`Object.prototype.dev = true` before the worker answered was handed `window.__nullechoDev` by the
authenticated delivery itself: version string, persona id, `upgraded` / `standingDown` /
`forged` / `reads` counters, the per-API tallies, and `failures` — whose stack traces name the
extension's URL, i.e. the extension ID. A certain detector *and* an internals leak, reached without
touching the nonce.

**The nonce was never the wrong defence; it just answers a different question.** Authentication
proves the message came from the loader. It says nothing about the fields the loader left **out** —
and an absent own property is exactly when `[[Get]]` walks to an object the page owns. So the audit
was every field, not just `dev`:

| Field | Omitted by the genuine loader when… | Was it reachable? |
|---|---|---|
| `dev` | always — nothing ever sends it | **yes, on every handshake** — the finding |
| `enabled`, `gpc`, `site`, `persona` | the service worker is unreachable (`{ok:false, reason, …}`) | **yes**, via the gpc relay |
| `reason` | the call succeeded | only on a path that does not read it |
| `nonce`, `gpcNonce`, `ok` | never | no — an own property shadows the chain |

**The second hole was one step later, in the relay.** `emit()` goes through `JSON.stringify`, which
**drops** an `undefined` member — so relaying `{gpc: undefined}` produced `{}` and `gpc.js` read the
missing key off its *own* polluted prototype. Its rule is `cfg.gpc !== false && cfg.enabled !== false`,
so `Object.prototype.gpc = false` suppressed the user's Global Privacy Control signal on every page
where the worker was unreachable — a privacy regression a page could trigger, not merely a detector.
Relaying explicit `null` keeps the default ON and cannot be shadowed.

**~~Known residual~~ — ✅ CLOSED the same day: `gpc.js` reads its config as own properties too.**
`gpc.js` did `cfg.gpcNonce`, `cfg.gpc` and `cfg.enabled`. On the normal path that was already safe,
because the shim swallows the loader's event and relays explicit values for all three. But if the
shim never boots — an exception in `installInto`, or `shim.js` failing to load at all — `gpc.js`
reads the loader's raw payload directly, and a failure payload omits `gpc` and `enabled`, so the
page's prototype was consulted again: `Object.prototype.gpc = false` suppressed the user's
do-not-sell signal on exactly the pages where the extension was already degraded. `gpc.js` now
captures `Object.prototype.hasOwnProperty` in its own boot block and reads all three fields through
an `ownField` of its own. Guarded by a fourth `B9 GUARD`, which boots a realm with **gpc.js and no
shim** (a `shim: false` option added to the rig's `bootRealm` for this), pollutes `Object.prototype`
and sends the loader's raw failure payload — plus a positive control, a genuine `{gpc:false}` in the
same shape, so the guard is own-property discipline and not a dead branch. `gpcNonce` is read the
same way for consistency; a prototype-supplied nonce could never have matched a 128-bit value the
page has not seen, so that one is discipline rather than a hole, and it is not asserted — a test
that cannot fail is not a guard.

**Residual, stated rather than hidden.** `derive()` still reads the accepted persona's optional
sub-fields plainly (`cores`, `memory`, `seed`, `uaData`, `noise.audio`/`webgl`, `gpu.*`, `screen.*`).
Reaching those needs a payload that carries the boot nonce *and* a truncated persona — the worker
builds personas from `personas.js`, so it never produces one, and `validPersona()` now requires
`ua`, `platform`, `gpu`, `screen`, `fontList`, `noise` and `noise.canvas` to be **own** before any of
it runs. It is defence in depth that is not yet built, not a live path.

**Guards.** Three `B9 GUARD`s: the dev surface stays absent while the genuine upgrade still lands; a
page owning eight `Object.prototype` fields at once (`dev`, `enabled`, `ok`, `persona`, `nonce`,
`gpcNonce`, `site`, `reason`) cannot stand the shim down, swap the persona or install anything; and
`Object.prototype.gpc = false` cannot switch GPC off on a genuine failure payload. `objHasOwn` is
captured in the boot block, so the `A2-lint GUARD` (D21) still passes.

## D30 — The reverse channel is authenticated by ONE-TIME tokens, and an accepted report is swallowed. 2026-09-16.

**Decision:** `shim-loader.js` mints a list of 32 one-time 64-bit tokens at `document_start` and
delivers it as `reportTokens` inside the persona payload the boot nonce already authenticates and
the shim already swallows (D13, D21/A3). Every `nullecho:status` and `nullecho:detect` the shim
sends afterwards spends the next token in order. The loader accepts a report only if it carries the
token at the head of its queue — read as an OWN property — and then `stopImmediatePropagation()`s
it, so nothing downstream sees a live token. The loader also moved its listeners to **`window` in
the capture phase**, registered before the MAIN-world scripts run.

**What C1 was.** `nullecho:status` and `nullecho:detect` carried no authentication at all. Three
lines of page script, needing no nonce and no race:

```js
dispatchEvent(new CustomEvent('nullecho:status', { detail: '{"phase":"boot","channel":"gpc"}' }));  // sticky "nonce-exposed"
dispatchEvent(new CustomEvent('nullecho:status', { detail: '{"upgraded":true}' }));                 // hides a real lockedToFallback
dispatchEvent(new CustomEvent('nullecho:detect', { detail: '{"api":"canvas","count":1e6}' }));      // +1,000,000 reads
```

Integrity of what the user is told, not of what the page can read — but a privacy tool whose own
status display is writable by the site it is watching has nothing to show.

**Why the review's own fix does not work, and this is the interesting part.** The review said: mint
a second nonce, deliver it in the persona payload, require it on every later report. A single shared
token fails against a page that is *watching*, and watching is free: the reports are DOM events on
`document`, so the page can listen for them. The first tokened report — the upgrade status, which
goes out within milliseconds — hands the token to any page listener, and from then on the page can
mint as many reports as it likes. That closes the attack against a page that does not bother and
leaves it wide open against one that does.

So the token is not one secret but **32 one-time ones**. A token a page has observed is a token the
loader has already spent. Harvest-and-replay buys nothing, reusing a spent token for a nicer claim
buys nothing, and skipping ahead is refused because only the head of the queue is ever accepted.

**And the ordering argument, run in reverse.** D13 established that `window` capture, registered at
`document_start`, is ahead of any page listener: `window` is the first node in the propagation path
of an event dispatched on `document`, same-phase listeners fire in registration order, and this
loader is the first content script at `document_start`. That argument works for the reverse channel
too, so the loader now listens there — and swallows what it accepts, which means a page never sees a
live token at all, only the absence of an event.

⚠️ **The swallow property rests on Blink keeping one registration-ordered listener list per target
across isolated worlds.** Asserted from the engine's shape, not measured in a real browser here
(D21's BASELINE caveat). If it is wrong, the one-time tokens still hold on their own; what degrades
is that a watching page could substitute content for a report the shim really sent, in lockstep, one
for one — see the residual below.

**Boot events are unauthenticated by necessity, so they now change almost nothing.** A boot event is
what the tokens are minted in reply to, so it cannot carry one. It is allowed to set exactly two
things: that something announced itself on a channel, and that channel's nonce (first announcement
wins). Two reports moved off it:

- **`nonce-exposed`** is still *measured* when the boot event lands — it is a statement about that
  instant, from the ISOLATED world — but only *reported* once a token proves the thing that booted
  is our shim. A page forging a boot event can raise no warning.
- **`shim-never-booted`** now turns on an authenticated reverse message rather than on the boot
  event. `applyAuthenticated()` emits exactly one status on every branch, so a genuine shim that
  received any delivery has answered by the time the check runs. Basing it on the boot event let a
  page *silence* the loudest thing the popup can say. The check also waits for `bootstrap()` to
  finish as well as the timer, because a slow service worker plus retries can outlast
  `BOOT_CHECK_MS` and "never booted" would then be a false alarm.

**One alarm, not two: `no-boot-nonce` is retired.** It said "booted, but published no nonce, so it
is on the un-rotated fallback" — quieter than `shim-never-booted`, and distinguishable from it only
by the forgeable boot event, i.e. a page could downgrade *"you are NOT patched"* to *"you are
patched but not rotated"*. The genuine case it described (a realm with no `crypto.getRandomValues`)
now gets the loud alarm plus a console line naming the cause. A quieter claim derived from
unauthenticated evidence is not worth the hole. Nothing consumed the string; `popup.js` only ever
branched on `shim-never-booted`.

**Two chain reads found while wiring this, both one layer below D29.** Attaching the token with
`obj.token = t` would have walked the prototype chain for a property the object does not own — a
setter on `Object.prototype.token` would have been handed every token. And `JSON.stringify` looks
`toJSON` up the chain, so `Object.prototype.toJSON` would have received every message the shim
emits, *including the boot nonce*, as `this`. `report()` now uses `objDefineProperty`, and `emit()`
serialises a null-prototype copy of the payload. Guarded in `shim-handshake.test.js`.

**Pre-handshake reports.** Before the delivery there are no tokens, so those reports (a forgery
attempt, a failed fallback derivation) go out untokened — the loader drops them — and are kept in a
bounded backlog of 8, re-sent with tokens the moment the delivery lands. They are still emitted
untokened as well, because this file's contract with the page and with `harness/shim-test.html` is
to say things out loud; the loader simply does not believe them yet.

**Residuals, stated rather than hidden.**

1. **Lockstep substitution.** A page whose listener runs before the loader's — which requires the
   cross-world ordering claim above to be wrong, or the page to have won the `document_start` race —
   could read a token in flight and synchronously dispatch its own event carrying it, one forgery
   per genuine report. It can never invent a report the shim did not make, or make more of them.
   This is not closable on a transport the page owns: suppression and one-for-one substitution are
   what "the page owns the transport" means.
2. **Exhaustion, and the reserve it forced.** After 32 reports the shim goes quiet rather than
   sending anything unauthenticated. Attacking this afterwards turned up the part that mattered: a
   page controls how many DETECT reports the shim makes (`touch()` fires at read 1, 10, 50 and then
   every 250 per API), so a few thousand `getImageData` calls would have spent the list and the shim
   could no longer have reported a later stand-down or a locked fallback — the half of this channel
   that has to be right. The last **four** tokens are now reserved for statuses. What a page can
   still cost itself is the read COUNTER, and only after the popup has already been shown several
   thousand reads on that page, which is the alarm anyway. Guarded (`C1 GUARD`, confirmed to fail
   against a build with the reserve removed).
3. **The standalone harness's protocol log goes quiet for tokened reports** if the real extension is
   also active on that page: `harness/shim-test.html` listens on `document`, and the loader now
   swallows accepted reports at `window` capture before they get there. The harness is normally run
   without the extension (it loads `ext/src/shim.js` itself, so there is no loader and nothing
   swallows), and its boot-event check is unaffected — but anyone running it *with* Nullecho
   installed will see a short log and should not read that as a broken shim.
4. **`src/protocol.js` still documents the reverse channel as `{ upgraded, lockedToFallback, reason }`
   with no token, and its `CONTENT_SCRIPT_LITERALS` registry does not know about `reportTokens`.
   That file belongs to another lane in this session and was deliberately not touched; it is a docs
   drift of exactly the kind review finding C3 was about, and it should be the next edit there.

**Guards.** Five `C1 GUARD`s in `review-2026-09-16.test.js`, driving the real `shim-loader.js`: a
page forges nothing (no status, no count) and the loader's own tokens still work; a spent token
authenticates nothing, in replay, in reuse, or out of order; an accepted report is swallowed and a
refused one is not; a forged boot event cannot silence `shim-never-booted`; and, in the shim's own
realm, a page listener on `window` capture and on `document` for all three event names harvests no
live token. Two more in `shim-handshake.test.js`: every post-handshake report spends a fresh token
in order, and `Object.prototype.token` / `Object.prototype.toJSON` inside the shim's realm harvest
nothing. The rig in `review-2026-09-16.test.js` was changed to model the loader properly —
`window`-capture registration before the MAIN-world scripts, and swallowing what carries a token —
because the old document-only listener would have let the page win by construction.

## D31 — A child realm inherits its parent's site key, its persona, and its own realm's Array. 2026-09-16.

**Decision:** a same-origin `about:blank` / `srcdoc` / `blob:` / `data:` child is the same machine as
the document that created it, at every stage:

1. **The shim's fallback key.** When `location.hostname` is empty, the key is
   `registrableDomain(hostOfOrigin(location.origin))` — the eTLD+1 of the origin the child
   *inherited* — before falling back to the raw origin string.
2. **The worker's answer.** `senderSiteKey(sender)` uses `sender.url` when it names an http(s)
   document and falls back to `sender.origin` when the URL's scheme is one that has no host of its
   own (`about:`, `blob:`, `data:`, `filesystem:`). `siteKeyFor` itself is unchanged.
3. **Values handed into the realm.** `installInto()` now captures that realm's `Array`, `Object` and
   `Object.freeze` alongside the DOM natives it already captured, and builds the arrays and
   dictionaries it hands back with them.

**What B3 was.** The shim keyed its fallback on `registrableDomain(location.hostname) ||
location.origin`. In a blank child `hostname` is `''`, so the key became the origin **URL string**
(`'https://www.news.example'`) rather than the eTLD+1 (`'news.example'`) — a different seed, hence
for roughly 80% of sites a different persona. And the child could never correct it: `sender.url` for
such a frame is the literal `'about:blank'`, `siteKeyFor` refused it, and because the old code read
`sender?.url || sender?.origin` — and `'about:blank'` is truthy — the inherited origin was never
consulted. So the worker answered `unsupported scheme` and the child stayed on the wrong fallback
while its parent ran the salted persona. `iframe.contentWindow.navigator.hardwareConcurrency !==
window.navigator.hardwareConcurrency` is a one-line pristine-child-realm detector, on the path the
docs called *clean*.

**Inheritance was already half-built, and that is why this is the right shape.** When the parent
reaches a child through `contentWindow`, `installInto(childWindow)` patches it with getters that read
the parent's `state.derived` through the shared closure — so that path always presented the parent's
machine. The gap was the child's OWN copy of the shim (Chrome injects it into blank frames via
`match_about_blank` / `match_origin_as_fallback`) and the worker's refusal to upgrade it. Fixing the
key and the sender lookup makes both paths agree instead of adding a third.

**The realm half — D27's named residual, closed here.** Everything the shim builds it builds in its
own closure, which for a child frame is the *parent's* realm. So
`frames[0].navigator.userAgentData.brands instanceof frames[0].Array` was `false` where Chrome says
`true`: the same "this realm was patched from outside" tell as B3, one level down. `installInto` now
holds `RealmArray` / `realmObjectCtor` / `realmFreeze` / `realmObjProto` per realm and builds
`brands`, the `toJSON()` and `getHighEntropyValues()` dictionaries and their `fullVersionList` /
`formFactors`, and the filtered WebGL extension list with them. Those objects are also **defined**
rather than assigned (`put()`), so no setter on that realm's `Object.prototype` can intercept a
field — the D29 lesson, applied to what we hand out rather than to what we read.

**What it is keyed on, and why that is safe.** `sender.origin` is the browser's account of the
frame's origin, not the content script's claim, so the salt-containment rule in `background.js` §2
still holds: a renderer cannot ask "what persona does bank.example see?". A sandboxed iframe's
origin is the string `'null'`, which `siteKeyFor` refuses — an opaque origin genuinely is not a site
— and a scheme that does not inherit an origin (`chrome://`, `file:`) is refused as before, so
nothing can borrow a site key it was not given.

**Is inheriting right, rather than giving the child its own persona?** Yes, and not only for
consistency: a parent document is same-origin with its blank child and can reach into that realm
directly, before, during and after any of our code runs (docs/THREAT-MODEL.md says so). There is no
boundary there to protect, so a *different* persona buys nothing and costs the contradiction.

**Residuals.**

1. **The `window[0]` micro-window is unchanged.** A script that appends an iframe and reads
   `window[0]` in the same synchronous block still reaches the realm before the MutationObserver
   callback runs. That is the honest limit already stated in `installInto`, not something this
   decision changes — though the child's own shim, where Chrome injects one, now at least derives
   the parent's key.
2. **Not every array handed out is realm-local yet.** `brands`, the two dictionaries, their
   `fullVersionList` / `formFactors`, and the WebGL extension list are. The WebGPU feature views
   (built once per `GPUSupportedFeatures` object and cached in a WeakMap) and the font-path arrays
   are still built in the shim's realm. Same class, smaller surface, and the WebGPU one needs a
   per-realm cache before it can move.
3. **Wrapper ordering is still untested.** When both the parent's `installInto` and the child's own
   content script patch a blank frame, which wrapper ends up outermost depends on Chrome's injection
   order. Both now present the same persona, which is the point — but the review's caveat about
   ordering stands and the rig does not model it.
4. **The rig's child realm is a second `vm` context**, not a browser frame: it shares nothing with
   the parent but the `contentWindow` reference. That is enough to measure realm identity of the
   values handed across, and not enough to say anything about injection timing. Noted in the test
   file's fidelity header.
5. **A parent page can pre-own its own child realm's constructors.** `installInto` captures
   `win.Array` / `win.Object.freeze` at the first `contentWindow` read, which for the top window is
   `document_start` — but a *child* realm is same-origin with the page, so the page can reach into
   it and replace those first. Then `new RealmArray()` is the page's constructor and `realmFreeze`
   may be a no-op. This is the D21 race, one realm over, and it is not closable from inside the
   page: a realm the page owned before we touched it was never ours. It costs the page only its own
   detector, and the persona values themselves still come from `state.derived`. Stated, not guarded.
6. **Attacked and held, so it is written down rather than re-derived:** a poisoned
   `Object.prototype.token` setter or `Object.prototype.toJSON` in the CHILD realm harvests nothing
   either — `report()` defines rather than assigns and `emit()` serialises a null-prototype copy, and
   both are realm-independent. Guarded (`C1 GUARD`, parent and child poisoned at once).

**Guards.** `B3a GUARD` (a blank child, a srcdoc child, a child of an origin with a port, and one
with a bracketed IPv6 authority all derive the parent's fallback machine; an opaque `'null'` origin
still gets a coherent persona but no inheritance), `B3b GUARD` (the worker answers `about:blank`,
`about:srcdoc`, `blob:` and `data:` senders with the parent's site key and the SAME salted persona
id the parent gets; `'null'` and `chrome://` are still refused), and `B3c GUARD` (a child realm
reached through `contentWindow` presents the parent's persona and its `brands`, entries, `toJSON()`
dictionary and WebGL extension list are all the CHILD realm's objects, while the parent's stay the
parent's). The `instanceof` half was confirmed to fail against a deliberately re-broken build before
being kept.
