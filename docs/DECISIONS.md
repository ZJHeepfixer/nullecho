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

> **⛔ Corrected 2026-09-20 (legal review 2026-09-19, `docs/review-2026-09-19/pricing.md` + its erratum).**
> Three things below are no longer true and are left in place as history:
> 1. **The Checkout Report was never built** — `git log --all -S'Checkout Report' -- ext/` is empty. It was
>    nonetheless promised in README, STORE-LISTING, PRIVACY-POLICY and the blog; those promises were removed
>    in `44be2dd`. The replacement is an observation-only **Price Disclosure Notice** (next build lane).
> 2. **"Four states have now enacted" the disclosure is wrong — it is TWO.** Maryland's proposed § 13-322
>    (the `OR BY` string) was **struck before passage**; Maryland enacted only § 13-321, a food-retailer
>    ban with no wording (state statute endpoint: 13-321 = text, 13-322 = "File Not Found"; codified
>    §§ 13-408(a)/13-411(a) name only 13-321). New Jersey is a grocery ban with no string. Mandated strings:
>    **NY (in force) and CT (2027-07-01, "or substantially similar")**. The MD bullet below is dead text.
> 3. **Presence of the string is not compliance** — the NY AG's Instacart letter ruled a page non-compliant
>    with the exact sentence on it. The detector may report *"this page carries the disclosure"*, never a
>    compliance verdict. Both written specs (sweep §5 "Spec A", the substring list here "Spec B") have
>    reproduced defects: Spec B's `using your personal data` anchor fires on ordinary privacy-policy prose.

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

> *Superseded 2026-09-17/19:* "N of 10" was our own detector set and understated detectability. The
> published number is now measured with a third-party library (CreepJS): 199 lie records and a bot
> verdict before D32–D35, **2** after (both the canvas/audio noise itself). See `THREAT-MODEL.md`.

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
   🔴 **Amended 2026-09-16 (review-2, R2-2): the list was finite and `for…of` was not on it.**
   `for…of` *is* a prototype call — it reads `Symbol.iterator` off the iterated object, which for
   an array literal is this realm's `Array.prototype`. Four of them survived the lint, and three
   sat inside `installInto()`'s `safe('webgpu.adapterInfo')`. `installInto` is `document_start`
   for the top window but the **first `contentWindow` read** for a child realm — so two lines of
   page script (`Array.prototype[Symbol.iterator] = () => ({ next: () => ({ done: true }) })`,
   then read `iframe.contentWindow`) made those loops iterate nothing and left that child's
   `GPUAdapterInfo` **unpatched**: the real GPU `vendor` and `architecture` while the parent
   answered with the persona's. A pristine child realm, reached on purpose — B3/D31's own failure
   mode, through this lint's blind spot. The fourth was the `values()` fallback in
   `safe('webgpu.features')`, which could only ever make the view smaller, and is now an
   iterator-free intersection against the allow list via the captured native `has`. Fixed by index
   loops; the boot-only one in `gpc.js` was converted too, leaving exactly **one** permitted
   `for…of` — `for (const p of HOST_POOL)` in `personaFor`, which is boot-only and which
   `personas.test.js` pins verbatim as the D12 constraint. The widened lint (`R2-2 GUARD`) also
   covers `Symbol.iterator`, `.startsWith(` / `.includes(` / `.at(` / `.find(` / `.sort(` /
   `.fill(` / `.subarray(` / `.next(` / `.catch(` and the bare coercions `Number(` / `String(` /
   `parseInt(` / `Boolean(` / `Date` / `Function` / `Proxy` / `Intl` / `BigInt`, and carries its
   own positive and negative controls. The exemption is a one-entry `Set` of the iterated
   expression, not a commented-out rule: an exemption nobody can audit is how this one survived.
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

  🔴 **That last sentence was false when it was written. Amended 2026-09-16 (review-2, R2-1).**
  The measurement was re-taken on *every* boot event, and a boot event carries no token by
  construction — so a page script dispatching a second `{phase:'boot', channel:'shim'}` at any
  moment after the genuine one set `bootLate = true` (page script has obviously run by then), and
  the shim's next genuine tokened report — the upgrade status, milliseconds later — flushed it
  through `onAuthenticated()` as a sticky `nonce-exposed`, plus the "Nullecho most likely lost the
  fingerprint race on this page" console warning. The token gate was working: the page never got a
  *report* believed. It did not have to. It steered a measurement the loader takes on the page's
  behalf, and `nonceExposedAt` is sticky in the service worker's per-site stats, so the popup goes
  on telling the user Nullecho lost a race it won. Same class as C1 itself — the watched site
  writing the watcher's display — reached from the one message D30 deliberately left
  unauthenticated. **Fix:** `bootSeen[channel]` — the FIRST boot event on a channel is the only one
  that may publish that channel's nonce or move the R3b measurement; every later one is inert
  whatever it carries. And the measurement is taken from the **shim channel only**, because
  `gpc.js` is `exclude_matches`-ed off ~50 hosts where its channel never announces at all, so a
  forged gpc boot event there would be genuinely first and `bootSeen` could not protect it. A page
  cannot be first on the shim channel without winning the `document_start` race — which is the
  condition this warning exists to report. Nothing genuine is lost: a shim that booted with no
  CSPRNG publishes no nonce, gets no second chance, is never delivered to, and `shim-never-booted`
  says so — which is the answer D30 had already chosen for that case. Guards `R2-1 GUARD` ×2 in
  `review-2026-09-16.test.js` (the second is the negative control: a *genuinely* late boot still
  raises the alarm and still prints the console line, so the fix is not the alarm switched off).
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
5. **Past exhaustion, the detect reports become page-visible.** OPEN, severity low, found by
   review-2 (`R2-3 REPRO`). Residual 2 says exhaustion costs the page its read counter. It costs one
   more thing it did not name: `report()` still `emit()`s when the tokens are gone, the loader
   refuses an untokened report, and a refused message is deliberately **not** swallowed (D21 — eating
   a page's own event would be a free "Nullecho is here" probe). So past exhaustion every detect the
   shim makes propagates to a page listener instead of dying at the loader. What it carries is
   `{api, count}` and nothing else — no persona field, no noise key, no token — i.e. the page's own
   read count for an API it has just hammered a few thousand times, on a page it has already proved
   is shimmed. Left open on the merits: going silent at N would replace this with a *cleaner* oracle,
   and swallowing untokened reports would hand back the probe D21 closed. Pinned by `R2-3 REPRO`,
   which also asserts what a leaked detect may contain, so a future change cannot widen it quietly.

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

⚠ **Corrected 2026-09-16 (review-2, R2-4).** That sandboxed-iframe sentence is only true when
`sender.url` is *also* scheme-less. A frame sandboxed without `allow-same-origin` but loading a real
`https://` document has an opaque origin **and** an ordinary `sender.url`, and the URL is consulted
first — so it gets that host's key. Which is the right answer: it is that host's own document, and
the shim's `fallbackSiteKey()` in that frame keys on `location.hostname` and lands on the same
value, so the fallback and the upgrade agree there instead of contradicting each other. The `'null'`
path is for frames with **no host of their own** — a sandboxed `about:blank`, a `data:` frame —
which stay on the un-inherited fallback, as B3a already asserts. `R2-4 GUARD` now pins the whole
table (19 sender shapes, including "a real http(s) URL beats a foreign `origin`" and "for an
inherited-origin scheme the *origin* decides, not the host spelled inside the URL"), so the next
widening of this boundary has to argue with a test rather than with a sentence.

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
6. 🔴 **CLOSED 2026-09-16 (review-2, R2-2), and it was not a residual — it was a hole.** Residual 5
   above says a page can pre-own its child realm's *constructors*. It could do worse than that
   without touching the child at all: `installInto()` ran three `for (const k of [...])` loops in
   its WebGPU adapter-info patch, and those read `Symbol.iterator` off the **shim's own** realm —
   the page's realm — at the moment of the `contentWindow` read, long after the page owns it.
   Replace the array iterator, read `iframe.contentWindow`, put it back: that child's
   `GPUAdapterInfo.vendor` / `.architecture` stay unpatched forever and report the real GPU while
   the parent reports the persona. Fixed with index loops; see D21's amendment for the lint hole
   that let it through. `R2-2 GUARD`, with an unhooked control realm so a green guard cannot be
   the rig failing to reach the leak.
7. **Attacked and held, so it is written down rather than re-derived:** a poisoned
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

## D32 — Every function the shim installs has a native's SHAPE: no own `prototype`, not a constructor. 2026-09-17.

**Decision:** the shim never installs a plain `function () {}`. `replaceGetter` builds its getter by getter
shorthand, `replaceMethod` installs a method-shorthand wrapper (`shaped(name, fn)`) around the factory's
implementation, `patchFunctionToString` defines its replacement by method shorthand, and the one direct
install site (the WebGPU feature set's `[Symbol.iterator]`) goes through `shaped()` too. Everything
else — `markNative`'s `name`/`length`, the RESTORES ledger, descriptor flags, the delegated brand check —
is unchanged. The fix is in the helpers, not the 43 call sites, so a future patch written as a plain
function still lands shaped.

**What §3b was.** `docs/CLAIM-VERIFICATION-2026-09-17.md` pointed vendored CreepJS at the shim for the
first time. A plain function has an own `prototype` and is constructible; a native WebIDL accessor or
method has exactly `length` and `name`, and `new f()` / `class X extends f {}` both throw. CreepJS runs
those probes on every API it audits, so each of the 31 shim-installed functions it reached failed eight
structural checks at once. Measured in real Chrome 151 (`Chrome/151.0.0.0`, no Electron), same host,
same persona, one hour apart, shim on both times:

| CreepJS lie type | before (`f7ee7b3`) | after |
|---|---|---|
| `failed "prototype" in function` · `own property names` · `own keys names` · `own property` · `descriptor` · `descriptor keys` · `class extends error` · `at instanceof check error` | 31 each (248) | **0** |
| `failed new instance` · `call interface` · `apply interface` error | 2 each (6) | **0** |
| `failed toString` | 197 | 197 |
| `pixel data modified` · `sample noise detected` (the noise we publish) | 1 each | 1 each |
| **lie records** | **453** | **199** |
| `invariants.nativeShapePatched` | `[length,name,prototype] extends→no-throw` | `[length,name] extends→TypeError` (= control) |

**What it did NOT close, and why — a correction to the write-up.** §3a/§3b attributed the 197-API
`failed toString` cascade, `stealth.hasToStringProxy` and the `headless.webDriverIsOn` bot verdict to the
toString replacement's shape. The measurement says otherwise: with the shape fixed, all three are
unchanged. CreepJS evaluates `failed toString` through `scope.Function.prototype.toString`, and `scope`
(`PHANTOM_DARKNESS`) is built by `getPhantomIframe()` as `self[self.length]` in the SAME synchronous
block as the insertion — the pristine-realm path §3c already records as unreachable from an
extension — and then nested once more through that pristine realm's own, unhooked `contentWindow`. A
pristine `toString` reads the shim's real source for every patched function and for the page's patched
`Function.prototype.toString` itself, so every API fails, patched or not, and `Navigator.webdriver`
"lying" is what flips the bot flag. Verified in the same page: a child reached through `contentWindow`
(the `getBehemothIframe` shape), its grandchild, and a plain appended iframe are all patched (persona
cores, `[native code]` for the userAgent getter and for `Function.prototype.toString`); only `window[n]`
read in the inserting tick is not. The remaining 197 records, `hasToStringProxy` and the bot verdict are
therefore §3c's, and closing them means synchronous insertion hooks (`appendChild` / `append` /
`innerHTML` / …) — a separate decision with its own breakage surface, not taken here.

**FingerprintJS unaffected:** `visitorId` still differs between `localhost` and `127.0.0.1` and is
identical on two loads of each (four runs).

**Guards:** `ext/src/native-shape.test.js` — the probes on a patched accessor, a patched method and the
toString replacement; an unpatched control (`Navigator.webdriver`) and a negative control (a page's own
plain function fails the probe); a sweep of every function the shim changed in the realm, so an install
site that bypasses the helpers cannot regress it silently; and keep-guards for the delegated brand check
(ARKENFOX (f)), descriptor flags, and toString / `name` / `length`. Both D21 lints pass on the new
syntax (rest parameters build an own-indexed array; nothing touches the iterator protocol).

## D33 — The shim never writes to the page's console; a brand-check throw is the original's answer, not a patch failure. 2026-09-17.

**Decision:** two rules, one mechanism.

1. **The original speaks first.** Every method wrapper in `shim.js` either delegates to the native
   original before doing anything else, or reads a captured native accessor on the receiver, *outside*
   any `try` whose catch reaches `fail()`. The original's verdict on the receiver and the arguments —
   `TypeError: Illegal invocation`, "1 argument required", a tainted-canvas `SecurityError` — therefore
   reaches the caller exactly as it would unpatched: unlogged, uncounted by `touch()`, not a failure.
   Anything that still throws inside the try is the shim's own.
2. **`shim.js` calls `console` nowhere.** A genuine failure — a patch group that could not install, a
   noise path that broke at run time — is recorded on the dev surface (with its stack) and reported
   through the D30 reverse channel as a `failures` list of LABELS on the next authenticated status:
   install-time failures ride the upgrade status for free; after the handshake a failure gets a status
   of its own restating the current health, at most twice per page (`FAILURE_STATUS_MAX`) so a page
   cannot spend the token list on making the shim talk. `shim-loader.js` prints the list from the
   ISOLATED world, where a page cannot hook the console, and forwards it; `background.js` keeps it in
   a sticky, de-duplicated `patchFailures` per site and the popup shows it. The forged-handshake line
   moved the same way (printed by the loader on `forged-handshake-rejected`); the no-CSPRNG line was
   already covered by the loader's `shim-never-booted` text; the persona-mirror drift line is a build
   defect pinned by `personas.test.js` and needs no run-time voice.

**What §3d was.** CreepJS calls every patched method with an illegal receiver (`fn.call({})`, `new fn()`).
Five wrappers — `toDataURL`, `toBlob`, `convertToBlob`, `copyFromChannel`, `measureText` — ran shim work
before delegating, so the ORIGINAL's `Illegal invocation` landed in the wrapper's own catch and was logged
to the PAGE console as `[Nullecho] shim could NOT patch "…". That API is UNPROTECTED on this page…`.
The message was false (the API was patched and working, and `touch()` had even counted a read that never
happened), and a page-installed `console.error` hook read the product name straight back — a nominative
detector in three lines, a worse category than any farbling tell. Writing the test found a second false
alarm the write-up had not named: `measureText()` with no argument, on a font the persona claims, hit
the same catch with the native "1 argument required" error.

**Why not classify the error.** Matching `err.message === 'Illegal invocation'` in the catch would have
silenced the exact historical bug this file records at `convertToBlob` — the on-screen originals applied
to an Offscreen context threw `Illegal invocation` from INSIDE the shim and fell open to the un-noised
native call. That was a genuine failure wearing the brand check's message. Structure, not string-matching:
if the original has already accepted the receiver and the arguments, a later throw is ours.

**Why the reverse channel and not a quieter page console.** Any text the shim writes to a console the
page can reach is readable by the page, whatever it says; the only console a page cannot hook is the
isolated world's, and D30 already provides an authenticated path there. Labels only, never `err.stack`:
`shim.js` is a MAIN-world content-script file, so a stack names `chrome-extension://<id>/…`, and a
status is a DOM event a page can see before the handshake or past token exhaustion (D30 residual 5).
The labels array is given a null prototype before it is attached: `emit()` null-prototypes only the
top-level object, and `JSON.stringify` looks `toJSON` up the chain of every nested object too — the D30
guard in `shim-handshake.test.js` caught the list being handed to a page's `Object.prototype.toJSON`
on the first green run.

**Measured, real Chrome 151 on macOS (`Chrome/151.0.0.0`, `typeof process === 'undefined'`),
`harness/claim-verification.html`, a fresh `?cb=` per run, positive control on the console reader:**

| | control (`shim=off`) | shim on, before (`f7ee7b3`) | shim on, after |
|---|---|---|---|
| page `console.error` hook, one illegal `measureText` call | 0 messages | 1 per call, names "Nullecho": **true** | **0, false** |
| 12 probes (6 methods × `call({})` / `new`), hook on all six console methods | — | — | **0 captured**; native errors verbatim; `__nullechoDev.failures` `[]`; reads +4 = the four legitimate reads only |
| full CreepJS run, tab console lines matching `Nullecho` | — | 35 (§3d) | **0** (reader's positive control captured); `failed call/new/apply interface` lies **0**; `errorData` mentions of `Illegal invocation` **0** |

`measureText still functional: true` on every run; `copyFromChannel` (now delegate-then-copy-again) agrees
sample-for-sample with `getChannelData` and is still noised; an out-of-range channel throws the native
`IndexSizeError`. `lieCount` stayed at D32's 199 — the console leak was never a CreepJS lie, which is
what made it worse.

**A second false alarm in the same area, folded in (docs/PERFORMANCE-2026-09-17.md).** The boot sequence
read `nonceBox.value` *after* `emit()`ing the boot event to decide whether to print "no CSPRNG". `emit()`
dispatches synchronously and the genuine handshake consumes the box (`= null`), so a loader that replied
inside the boot dispatch — every standalone harness page — got "no CSPRNG / protection degraded" printed
about a clean, authenticated upgrade. Production was masked only by the real loader's async round trip.
The console line is gone with rule 2, and the condition is fixed at its source: `HAS_CSPRNG` is decided
once at mint and is the only thing ever asked "did this realm have a CSPRNG" (the forged-handshake reason
used to ask the box too). Guarded by a synchronous-reply repro and a no-CSPRNG realm test.

**Residuals.** (1) The loader-side print and the service-worker record are exercised against the real
`shim-loader.js` / `background.js` in `node:vm` only; the extension has still never been loaded unpacked
in a real browser (the standing ship gate). (2) `requestAdapter` still calls `touch()` before delegating —
an illegal call there counts a read it did not make; nothing is logged, so it was left alone. (3) A status
emitted untokened (pre-handshake, or past exhaustion) may now carry failure labels a page listener can
read; the event name already named the product on that path, and labels are API names, not identity.

**Guards:** `ext/src/claim-verification-2026-09-17.test.js` — the rig's canvas, context, offscreen and
audio members are PROTOTYPE accessors that brand-check like WebIDL (an own-property rig lets the captured
getter fall back to a read that cannot throw, and would pass against the defect); the twelve illegal probes
and the zero-argument `measureText`; nothing the page can provoke reaches the page console; a source lint
that `shim.js` contains no `console.`; a genuine install failure and a genuine run-time failure both reach
the loader stand-in tokened, capped, labels only; and the real loader prints from its own world, forwards,
and ignores an unauthenticated failure list; `background.test.js` — the sticky, de-duplicated, capped `patchFailures` record; a synchronous-reply boot and a no-CSPRNG realm. 297/297 (277 + 8 from D32 + 12).

---

## D34 — The font path early-outs when the machine does not have the dropped family. 2026-09-17.

**The problem, measured.** `docs/PERFORMANCE-2026-09-17.md` §2 found that the font-consistency
shim forces two synchronous re-layouts on *every text-bearing leaf element on every page* — not
on fingerprinting pages, on all of them. Measured paired in real Chrome 151 on an M2 Max:
**+25.8 µs per `offsetWidth` (39×), +52.5 µs per `getBoundingClientRect` (40×), and +15.5 ms on a
300-row measuring sweep (44×)** — a sweep that goes from 0.33 ms to 15.8 ms, which is most of a
60 fps frame. The trigger is not exotic. The ordinary modern stack

```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
```

names `"Segoe UI"` and `Roboto`, neither of which a macOS or Linux persona has, so `planFamilies()`
sets `dropped` and `fontMetric()` goes to `measureWithFamily()` twice: set `font-family` `!important`,
read the metric back, restore the property. Virtualised lists, data grids, tooltip positioners,
truncation logic and chart label layout all do this in loops.

**The rule.** Removing a family from a stack can only change what is painted if the MACHINE
actually has that family. If the host lacks it too, the browser's own font matching already
skipped it, at *every* codepoint — a family with no installed faces supplies no glyph — so the
shim's removal is a no-op and the real measurement already **is** the shimmed measurement. The two
forced layouts are pure waste. Symmetrically, the family the persona *claims* needs no synthetic
presence when the machine genuinely has it, **provided it is not the first family the page named**
(see the `claimedFirst` clause below). When neither condition has work to do, `fontMetric()` and
the `measureText` wrapper return the native answer and touch no layout.

**The proposal that was NOT exactly correct, and why.** The performance report suggested a
different pre-check: *is there a family earlier in the list than the first dropped family that
actually renders on this machine?* That is not sound, because CSS font matching is **per glyph,
not per element**. An earlier family that resolves can still lack a codepoint, and the browser then
falls through to later families — including the one we are about to drop. So "an earlier family
renders" proves only that the dropped family is unused *for the glyphs the earlier family covers*,
which is not the same statement and is not decidable without knowing the text. The host-presence
rule needs no such assumption: it is a statement about the machine, and it holds for every string.

**`claimedFirst` — the clause that keeps the defense whole.** "The machine has the family" does not
imply "a probe of this element can read the family off it." macOS ships `Symbol`, but `Symbol` has
no Latin glyphs, so `"Symbol", monospace` measures exactly the monospace baseline on a real Mac.
Under a host-presence test alone, a Windows persona (which claims `Symbol`) would stop synthesising
its presence and a probe would read "absent" — one family flipping, measured, on a cross-OS
configuration. So the claimed branch also requires that **a generic family precedes the claimed one
in the surviving stack**. A fingerprinter's probe puts the family under test FIRST, so every probe
shape stays on the old measuring path, byte for byte. What is dropped is only the case where the
claimed family sits behind a generic that resolves (`-apple-system` on a Mac) and therefore cannot
render and cannot be probed — where the old code was adding a ±1–6 px delta to an ordinary page's
layout for no defensive gain.

**The probe, and why it is not a layout.** Host presence is decided by a canvas width comparison —
`72px "F", <generic>` against `72px <generic>` — over three generics and five scripts (Latin, CJK,
Cyrillic+Greek, Arabic, emoji), so a family installed for one script only still registers. It runs
through `CanvasRenderingContext2D.prototype.measureText` and `TextMetrics.width` **captured at boot**
(D21), never through the live prototypes, on a detached 8×8 canvas that is never inserted into the
document: no forced layout, nothing a `MutationObserver` can see, and no re-entry into our own
wrapper. The answer is memoised per family name per realm, and the family universe is bounded by
`KNOWN_SYSTEM_FONTS`. Anything undecidable — no canvas, a font shorthand the engine refused, a
throw — reads as **present**, which keeps the slow path and therefore keeps the defense. The plan
itself (`parseFamilyList` + `planFamilies` + the two CSS strings) is also memoised by computed
`font-family` string, generational on the web-font set, because a later `@font-face` can make a
family untouchable that was not before.

**Measured result** (real Chrome 151.0.7922.174, macOS 26.6.0, M2 Max, persona `macos-chrome-m1-pro`,
paired ABBA instrument, in-page null control 1.00× on both runs):

| Cell (added cost) | Before | After | |
|---|---|---|---|
| `offsetWidth` on a leaf | +25.8 µs (39.0×) | **+5.0 µs (7.9×)** | 5× cheaper |
| `getBoundingClientRect` on a leaf | +52.5 µs (40.3×) | **+12.7 µs (11.2×)** | 4× cheaper |
| sweep 300 leaf rows | +15.50 ms (43.9×) | **+3.25 ms (11.0×)** | 4.8× cheaper |
| `measureText` in a chart loop | +72.4 µs (54.9×) | **+3.4 µs (3.2×)** | 21× cheaper |

The 300-row sweep goes from **15.8 ms to 3.55 ms**, back inside a 16.7 ms frame with room to spare.

**The attack pass — what was tried, and what happened.** Every row below was run in real Chrome
against the live shim, comparing the shimmed value to the pristine native getter captured before
`shim.js` loaded.

| Attack | Result |
|---|---|
| Per-glyph fallback: the ordinary stack with emoji, CJK, Arabic, Devanagari and symbol text | shim == native exactly, `offsetWidth` **and** the fractional rect. The drop is a no-op for every script, as the rule predicts. |
| `font-family: "Segoe UI Emoji"` alone, emoji text — only the dropped family could supply the glyph | 72 == 72. The host lacks it, so the browser had already fallen through. |
| A stack of **only** dropped families (`"Segoe UI", Roboto`) | 312 == 312, no forced layout. |
| Generic-only stacks (`sans-serif`, `system-ui`) | never reach the font path; unchanged. |
| The probed family listed **SECOND**, behind a host-absent unknown family | 564, identical to before the change. |
| A dropped family the host **really has** — `Hiragino Sans`, `PingFang SC`, `Apple Color Emoji`, and every Mac-only family under a Windows persona | still on the slow path, still removed. `Hiragino Sans` 288 → 289; under the Windows persona `Helvetica` 648 → 564, `Avenir` 665 → 564, `Geneva` 694 → 564. 0 leaks. |
| Full sweep: 57 probe families × `"F", monospace`, macOS persona | 0 families the persona lacks reported present; 0 families the persona claims reported absent. Identical to the pre-change shim. |
| Cross-OS sweep: Windows persona on a macOS host, all 57 claimed families | 0 hidden — identical to the pre-change shim. This is the sweep that caught the `Symbol` flip and forced the `claimedFirst` clause; D12 means the shipped extension never produces this pairing, but it is the sharpest available test of the claim path. |
| An independent host-presence oracle (`new FontFace(…, 'local("F")')`, which the shim does not patch) over the whole known-font universe | 7 families are installed here and absent from the persona; 126 probes (7 × 3 generics × 6 scripts) and **0 leaks** — the canvas probe agreed with `local()` on every one. |

**The one behavioural difference, stated rather than buried.** On a stack where a generic resolves
before the claimed family, the shim no longer applies the ±1–6 px presence delta. Measured: the
ordinary stack on a Mac went from **474 to 479 px**, and 479 is what the un-shimmed browser
reports. The old number was a fabrication with no defensive content — no probe can read Helvetica's
presence off an element whose stack resolves at `-apple-system` — and it made the machine
self-contradictory in the D11/D2 sense: it reported `Helvetica` and `sans-serif` as different
widths on a Mac where they are literally the same font. Removing it is a fidelity gain, not a
weakening. Stacks that name a system family first (`Helvetica, Arial, sans-serif` → 503, not 508)
keep the delta and the slow path, unchanged.

**Guards:** `ext/src/layout-early-out.test.js` — a `node:vm` realm whose layout is a deterministic
function of a simulated host font set, so "did the shim change the number?" and "did the shim force
a layout?" are both exactly observable (`style.setProperty('font-family', …)` is counted; only
`measureWithFamily` calls it). Pins the fast path on the ordinary stack for `offsetWidth`,
`getBoundingClientRect` and `measureText`; the slow path for a host-present dropped family, for a
claimed family listed first, and for the `Symbol` shape (installed, but no glyph for the text);
byte-identical probe output on hosts that have and lack the family; and that the host probe is
memoised rather than run per element. 310/310 (297 + 13).

## D35 — A child realm is installed from INSIDE the insertion call, not one microtask later. 2026-09-19.

**The defect, measured.** `docs/CLAIM-VERIFICATION-2026-09-17.md` §3c: a page that inserts an
`<iframe>` and reads `self[self.length]` in the SAME synchronous block gets a **pristine realm** —
the real machine, and a pristine `Function.prototype.toString` that prints the shim's actual source
for every function patched in the parent. The shim had two doors into a child realm and both were
late or optional: `HTMLIFrameElement.prototype.contentWindow` (only fires if the page reads it) and a
`MutationObserver` (fires at the next microtask checkpoint, which is after the inserting block).
`window[n]` is a live indexed property on a WindowProxy and cannot be hooked at all.

CreepJS does exactly this. `harness/vendor/creepjs-2026-06-11.js:1026`, `getPhantomIframe()`:

```js
const numberOfIframes = self.length;
const frag = new DocumentFragment(); const div = document.createElement('div');
frag.appendChild(div); div.innerHTML = `<div style="${GHOST}"><iframe></iframe></div>`;
document.body.appendChild(frag);
const iframeWindow = self[numberOfIframes];        // ← PHANTOM_DARKNESS, pristine
```

Everything CreepJS measures it measures in `PHANTOM_DARKNESS`. That is why D32 (the function *shape*
fix) took lie records from 453 to 199 and left `hasToStringProxy: true` and a `webDriverIsOn: true`
**bot verdict** standing: those come from the pristine realm's toString, not from the shape.

**The rule.** *A child browsing context is created synchronously inside the native insertion call, so
the shim installs into it inside that same call, before the original's result is returned.* Every DOM
entry point that can connect an `<iframe>` to the document is wrapped; after delegating, the wrapper
walks this realm's frame list and installs into anything not yet installed. The MutationObserver
stays as the backstop for paths no DOM call goes through — above all the HTML parser.

**The table is in the code, and a lint holds it.** `INSERTION_SITES` in `shim.js` lists 30 rows
(`Node.appendChild/insertBefore/replaceChild`; `Element.append/prepend/after/before/replaceWith/
replaceChildren/insertAdjacentElement/insertAdjacentHTML/setHTMLUnsafe` + the `innerHTML` and
`outerHTML` setters; `CharacterData.after/before/replaceWith`; `ShadowRoot.innerHTML/setHTMLUnsafe`;
`Document.write/writeln/append/prepend/replaceChildren`; `DocumentFragment.append/prepend/
replaceChildren`; `Range.insertNode/surroundContents`; `Window.open`).
`ext/src/same-tick-realm.test.js` parses that literal out of the source and fails if a row is not
really wrapped, if a wrapped function does not have a native's shape (D32) or masked source, or if a
known entry point has lost its row. Three kinds: `method` and `setter` sweep after delegating;
`opener` installs into the window `window.open()` RETURNS, because an auxiliary browsing context is a
realm of its own and `length` never counted it.

**Four designs considered and rejected, with the reason:**

| Rejected | Why |
|---|---|
| Hook the indexed WindowProxy properties (`window[0]`) | Not interceptable. They are not ordinary properties of the global object; this is the whole reason the hole exists. |
| Hook the `window.length` getter and sweep on read | Sound but insufficient, and measured against the actual adversary: CreepJS reads `self.length` **before** it inserts, then indexes without reading it again. It would close nothing here. |
| A `length` delta — sweep only when the count GREW | **Unsound.** Moving an already-connected `<iframe>` destroys its browsing context and creates a new one: the count is unchanged and the realm behind `window[0]` is brand new and pristine. Verified in real Chrome — after `document.head.appendChild(f)` the WindowProxy identity itself changes. A two-line bypass. |
| A subtree scan (`querySelectorAll('iframe')`) on the insertion path | The cost. `appendChild` is one of the hottest calls on the web; the frame walk below is O(child frames), which is 0 on most pages. |

**The one-microsecond lesson: do not CALL `installInto` to find out it has nothing to do.**
`installInto` declares several hundred locals (every captured native in the realm), so its
interpreter frame is large and *merely entering it* costs about a microsecond even when it returns on
line 1. The first build called it per frame per insertion and cost **+3.4 µs per `appendChild` on a
page with 5 child frames**. Hoisting its own first line — the `INSTALLED` WeakSet check — into the
sweep loop took the same page to **+0.62 µs**. Same WeakSet, same semantics, one function call less.
A faithful hand-built twin of the sweep measured +0.10 µs, which is what pointed at the call itself.

**Measured cost** (real Chrome 151.0.7922.174, macOS 26.6.0, M2 Max, paired ABBA, in-page null
control `Element.clientWidth` at **1.014×**, shim=off null calibration for these four cells
**1.027 / 1.00 / 0.98 / 1.00**):

| Cell | Native | Shimmed | **Added** |
|---|---|---|---|
| `appendChild` a plain div, **0 child frames** | 3.10 µs | 3.59 µs | **+0.49 µs** (1.09×) |
| `insertBefore` a plain div, 0 child frames | 3.81 µs | 4.54 µs | **+0.73 µs** (1.20×) |
| `innerHTML` = 50-node string, 0 child frames | 0.169 ms | 0.167 ms | **below the noise floor** (1.00×) |
| `appendChild`, **3 child frames** | 3.61 µs | 5.71 µs | **+2.10 µs** (1.61×) |

On a quiet page (no other harness work) the same probe reads **+0.15 µs at 0 frames, +0.22 at 1,
+0.43 at 3, +0.62 at 5, +1.28 at 10, +2.34 at 20** — linear at **≈0.11 µs per existing child frame**,
plus a fixed ≈0.15 µs. **The target was <1 µs added per `appendChild`; a page with no frames pays
0.15–0.49 µs and a page with three pays 0.43–2.10 µs.** The spread between the two columns is the
page itself: the harness's own row was taken after a full canvas/WebGL/layout run, where the native
`appendChild` is also 4× slower. Both numbers are in `docs/PERFORMANCE-2026-09-17.md`.

**What CreepJS reads now** (`harness/claim-verification.html`, real Chrome 151, fresh `?cb=`, both
origins, control run in the same browser):

| CreepJS signal | Control (no shim) | Before D35 | **After D35** |
|---|---|---|---|
| lie records | 0 | 199 | **2** |
| APIs flagged as lying | 0 | 198 | **2** |
| `stealth.hasToStringProxy` | false | **true** | **false** |
| `headless.webDriverIsOn` | false | **true** | **false** — the bot verdict is gone |
| `resistance.extensionHashPattern` | `{}` | ~30 entries | **`{}`** |
| child-realm `hardwareConcurrency` | 12 (host) | 12 (host) | **8 (the persona)** |
| pristine `toString(userAgent getter)` says `[native code]`? | true | **false** | **true** |
| pristine `toString(Function.prototype.toString)`? | true | **false** | **true** |
| trash | 2 | 2 | 3 |
| captured errors | 4 | 4 | 4 |

The **two** remaining lies are the defense working, not a tell we can remove: `AudioBuffer: sample
noise detected` and `CanvasRenderingContext2D.getImageData: pixel data modified` — our own farbling,
which also supplies the third trash entry (`suspicious pixel data`). Reproduced on
`127.0.0.1:4886` and `localhost:4886`, which still get different FingerprintJS visitorIds, so the
per-site split is unchanged.

**The attack pass.** Every row was run in real Chrome against the live shim, comparing the child
realm's `hardwareConcurrency` to the persona's (8) and to the host's (12).

| Attack | Result |
|---|---|
| CreepJS's exact `getPhantomIframe` shape (fragment → `innerHTML` → `appendChild` → `self[n]`) | **patched** in the same tick |
| `Range.createContextualFragment` + `Range.insertNode` | patched |
| `DOMParser` + `document.adoptNode` + `appendChild` | patched |
| `DOMParser` + `document.importNode` + `appendChild` | patched |
| `<template>`, `content.cloneNode(true)`, then inserted | patched — and template content created **no** browsing context while detached, as the spec says |
| `src` set **before** insertion | patched. Blink reuses the initial empty document's Window for the queued same-origin navigation, so it stays the realm we installed into |
| `srcdoc` set before insertion | patched |
| `window.frames[name]` — named access, never an index | patched |
| an `<iframe>` created in a CHILD document, `adoptNode`d into this one, then appended | patched |
| a **grandchild** created by the child realm's own `appendChild` | patched |
| a **great-grandchild** — exactly how deep CreepJS's `getBehemothIframe` goes | patched |
| **moving** a connected `<iframe>` (`length` unchanged, WindowProxy identity changed) | patched — this is the row the rejected delta design fails |
| `<iframe>` inserted into a **shadow root** | `window.length` **0 → 0**: a shadow-tree navigable is not a *document-tree* child navigable, so `window[n]` cannot reach it either. `contentWindow` reaches it and it is patched |
| `document.implementation.createHTMLDocument` | no browsing context at all: `defaultView === null`, `iframe.contentWindow === null`. Nothing to reach |
| `window.open(url, name, 'noopener')` | returns `null` — no handle for us, and none for the page |
| the **HTML parser** (inline `<script>` in the same parse as the `<iframe>`) | 🔴 **LEAKS.** Measured inside an installed child realm: during the parse the inline script read `self[0].navigator.hardwareConcurrency` = **12**; after the `document.write` call returned, the same frame read **8**. |
| an `<iframe>` inserted as `about:blank` and **navigated later** by assigning `src` | 🔴 **LEAKS.** After load the realm reads **12** and its `userAgent` getter is unpatched. `INSTALLED` is keyed on the **WindowProxy**, which survives navigation, so every door — the sweep, `contentWindow`, the observer — says "already installed" about a realm that no longer exists. **Pre-existing, not introduced here**, and not same-tick (a navigation is a separate task). |

**The two leaks, stated plainly.** Neither is reachable by the §3c bypass this entry closes, and
CreepJS uses neither.

1. **The parser.** An `<iframe>` in static markup, or written during parsing, is connected by the
   parser itself — no DOM method is called, so there is nothing to wrap. Only code running *in the
   same parse* sees the pristine realm; the MutationObserver closes it one microtask later. In a real
   install Chrome's `match_about_blank` injection should give that frame its own copy of the shim
   (D31) — that half is **assumed, not verified** (CLAIM-VERIFICATION §5).
2. **Realm identity across navigation.** The fix is to key `INSTALLED` on the realm's `document`
   (a `[LegacyUnforgeable]` own property of the global, so the page cannot spoof it) rather than on
   the WindowProxy, with a second set for realms that throw on `document` so a cross-origin frame is
   still attempted once rather than once per sweep. That is a change to `installInto`'s contract with
   its own cost to measure, so it is **not** in this commit; it is the next decision. In production a
   navigated same-origin frame gets its own content-script injection, which is why this has not shown
   up before — and that, too, is assumed rather than verified here.

**Other residuals:** a `[Replaceable]` `window.length` the page has overwritten with a data property
(the sweep then reads the page's number — it has broken its own frame list, and `contentWindow` still
works); any insertion API Chrome adds after this table was written; and a realm that is neither
indexed by `length` nor reachable through `contentWindow`.

**Guards:** `ext/src/same-tick-realm.test.js` — 18 tests in real `node:vm` realms whose fake DOM
creates a browsing context synchronously on connection and a **brand-new** one on a move, and whose
`MutationObserver` **never fires**, so every green assertion is a statement about the same tick.
Covers CreepJS's exact path, `innerHTML`, `document.write`/`writeln`, `insertBefore`, `replaceChild`,
`window.open`, the whole ChildNode/ParentNode family, `Range`, the move, a cross-origin child that
must not break the page's own insertion call, idempotency (three more doors into an installed realm
change no function identity), the grandchild, the shadow root, the table lint, and the descriptor /
`name` / `length` / brand-check / console guards. `window.length` sits on `Window.prototype` in the
rig to force the owner walk; in real Chrome 151 it is an **own** property of `window`, and
`ownerOf()` handles both. 328/328 (310 + 18).

## D36 — A per-site GPC exception is TWO DNR rules, because one `condition` is ANDed. 2026-09-19.

**Decision:** `syncExceptionRules()` emits two `modifyHeaders`/`remove` rules per excepted host —
one keyed on `requestDomains` alone, one on `initiatorDomains` alone — at ids
`1100000 + i*2` and `+1`, capping the list at 500 hosts inside the reserved 1000-id range. Never
both fields in one condition.

**What G1 was.** The rule carried `requestDomains: [host]` **and** `initiatorDomains: [host]` in a
single condition. DNR **ANDs** the fields inside a condition, so the rule matched only a request that
was both *to* the host and *from* it. A top-level navigation typed, bookmarked, opened in a new tab
or followed from another site has **no initiator at all**, so the document request — the one the user
complained about — never matched, and the site received `Sec-GPC: 1` while `linkage.js` printed
"Global Privacy Control was **not** sent to this site". The exclusion lists on rule 5000
(`excludedRequestDomains` / `excludedInitiatorDomains`) are ORed, which is why the shipped 50-host
breakage list was correct and only the user-facing exception was broken.

✅ **Chrome for Testing 147.0.7727.15**, `chrome.declarativeNetRequest.testMatchOutcome` asked from
the live service worker after `setSiteException('a.test', true)` — `1100000`/`1100001` are the
exception, `5000` is the Sec-GPC rule:

| request | before | after |
|---|---|---|
| top-level nav to a.test, **no initiator** | `[5000]` — **exception missed** | `[1100000, 5000]` |
| top-level nav to a.test, initiator a.test | `[1100000, 5000]` | `[1100001, 1100000, 5000]` |
| a.test subresource → a.test | `[1100000, 5000]` | `[1100001, 1100000, 5000]` |
| a.test page → third.test (3P) | `[5000]` — **missed** | `[1100001, 5000]` |
| b.test page → a.test subresource | `[5000]` — **missed** | `[1100000, 5000]` |

✅ **And the header capture agreed**, same run, same probe page (18 requests, `a.test` excepted):
**before 3 of 18 carried `Sec-GPC: 1`** — including `main_frame a.test /`, the document request —
**after 1 of 18.**

**The one that still leaks, named rather than hidden:** a `fetch()` issued from *inside* a
cross-origin iframe on the excepted page. Its initiator is the iframe's own origin, so neither rule
covers it. That is **G8**, it is a property of DNR having no "top-level context is X" condition, and
it is **not fixed here**. The cross-origin iframe's *document* request is now suppressed (its
initiator is the excepted page); only what that frame fetches for itself is not.

**Why `initiatorDomains` at all, rather than `requestDomains` alone.** Dropping it would make the
popup sentence exactly true and suppress strictly less. It would also leave every third party on a
site Nullecho ships GPC off for still receiving the signal — the G8 complaint, one level up. The
two-rule shape approximates the `gpcAtNavigation` scoping the spec actually names, which is what G8
asks for, and the popup copy says "not sent to this site" for a state where nothing on the page
carries the header.

**Guards:** `ext/src/review-2026-09-19.test.js` models DNR's documented AND/OR semantics and asserts
all five shapes plus subdomain coverage, id uniqueness, and the reserved range under 600 hosts.
`ext/src/gpc.test.js` pins the two-rule shape — and **replaces the comment that caused the bug**
("main_frame navigation matches on requestDomains; subresources on the page match on
initiatorDomains. Missing either leaks the header"), which is true of two rules and false of one, and
is why a reviewer reading that test concluded the rule was correct.

## D37 — GPC off reads `false`; Nullecho standing down gives the property back. 2026-09-19.

**Decision:** two different facts, two different outcomes, and `delete` is used for neither on a
browser that shipped the property.

- `gpc === false` (the signal is off globally or for this site) → the property reads **`false`**.
  W3C GPC: *"The value is `false` if no `Sec-GPC` header field would be sent; otherwise, the value is
  `true`"*, on a `readonly attribute boolean`. Where the browser's own accessor already answers
  `false`, its captured descriptor is restored instead of ours being installed — an untouched native
  accessor beats an identical-looking replacement.
- `enabled === false` (the user allowlisted this site, so Nullecho is off here) → the property goes
  back to **exactly what the browser had**: the captured native descriptor on Firefox, absent on
  Chrome. Standing down means being absent, which is what `shim.js`'s `restoreAll()` already means.

The descriptor and its value are captured at boot, before we overwrite anything (D21).

**What G2 was.** `setSignal(false)` did `delete RawNavigator.prototype.globalPrivacyControl` for both
cases. On Chrome that is merely non-conformant. On Firefox — which implements GPC natively — it
deleted **the browser's own property**.

✅ **Firefox 156.0**, real extension installed over WebDriver BiDi `webExtension.install`, GPC turned
off through the **real options-page checkbox**, then a fresh navigation:

| | `navigator.globalPrivacyControl` | `in Navigator.prototype` | descriptor | getter name |
|---|---|---|---|---|
| stock Firefox 156, no extension | `false` (boolean) | true | native | `get globalPrivacyControl` |
| **before** | **`undefined`** | **false** | **none** | — |
| **after** | **`false`** (boolean) | true | **the native one, restored** | `get globalPrivacyControl` |

The "before" row is a Firefox with no `globalPrivacyControl` at all — a state no stock Firefox can
produce, and a stronger identifier than the one the exception was meant to avoid.

✅ **Chrome for Testing 147**, per-site exception active on `a.test`: `windowProp` **`undefined` →
`false`**, `typeof` **`undefined` → `boolean`**, descriptor **absent → present**.

**⚠ What the Firefox measurement needed, and what that exposed.** On a stock Firefox the run above
does nothing, because **`background.js` never finishes evaluating on Firefox**:

```
JavaScript error: moz-extension://…/src/heuristics.js, line 588:
Error: Type error for parameter extraInfoSpec (Error processing 1: Invalid enumeration value
"extraHeaders") for webRequest.onBeforeSendHeaders.
```

`extraHeaders` is Chrome-only. The throw kills the background module, so `chrome.runtime.onMessage`
is never registered, every `GET_PERSONA` answers `{ok:false, enabled:null, gpc:null}` (captured from
an instrumented build), and the whole extension runs in permanent fallback on Firefox: the persona
never upgrades and **the GPC toggle cannot reach the page at all**. That is pre-existing, is not
fixed here, and is the single most important thing the Firefox half of this run turned up. The
measurements above were taken with `'extraHeaders'` removed from the two `heuristics.js` listener
registrations **in the throwaway rig copy only** — nothing in `ext/` was changed for it.

**Guards:** `review-2026-09-19.test.js` covers the four states (off → `false`; native-`false` browser
→ descriptor restored; native-`true` browser → untouched both ways; stand-down → original restored,
absent on Chrome). `gpc.test.js`, `handshake-integration.test.js`, `review-2026-09-16.test.js` A2d/A3
and B9 had all pinned `undefined`; every one of them now pins the conformant value, with the reason
in the comment.

## D38 — The GPC getter carries a native accessor's name and source. The key-order tell stays, and is documented. 2026-09-19.

**Decision:** the property is installed from a **getter shorthand named `globalPrivacyControl`**, once
per value (`true` and `false`, both built at boot), and its source is masked to whatever a *sibling
native accessor on the same interface* stringifies to, with the model's name substituted.
`gpc.js` layers one more `Function.prototype.toString` wrapper over the one `shim.js` owns, because a
separate classic content script has no way into the shim's `NATIVE_SRC` WeakMap; the wrapper answers
for **itself** with whatever the layer below said about itself, so its presence adds no delta.

**What G3 was.** The getter came from `{ get() { return true; } }`. Measured in **Chrome for Testing
147**: `desc.get.name === "get"` and `Function.prototype.toString.call(desc.get) === "get() { return
true; }"`, where every other accessor on `Navigator.prototype` reads `"get <attr>"` /
`function get <attr>() { [native code] }`. One property read, no list of expected values — just
"does this one match its neighbours".

✅ **Before → after, both engines, same probe:**

| | Chrome 147 before | Chrome 147 after | Firefox 156 before | Firefox 156 after | Firefox 156 **stock** |
|---|---|---|---|---|---|
| `get.name` | `get` | `get globalPrivacyControl` | `get` | `get globalPrivacyControl` | `get globalPrivacyControl` |
| `toString` | `get() { return true; }` | `function get globalPrivacyControl() { [native code] }` | `get() { return true; }` | `function globalPrivacyControl() {\n    [native code]\n}` | `function globalPrivacyControl() {\n    [native code]\n}` |
| A1 fires | **yes** | no | **yes** | no | no |
| A2 fires | **yes** | no | **yes** | no | no |
| shape probe | native | native | native | native | native |

On Firefox the "after" row is **byte-identical to the browser's own**, newlines included, because the
masked source is calibrated from `Navigator.prototype.onLine` rather than assumed: Chrome prints
`function get onLine() { [native code] }`, Firefox prints `function onLine() {\n    [native code]\n}`.
A fallback to `markNative`'s spelling covers a browser with no usable model.

**⚠ HONEST LIMIT, measured and not fixed:** on Chrome the property is still the **last own key** of
`Navigator.prototype` — index **36 of 37**, before and after — because it is appended at
`document_start` and a WebIDL member sits in declaration order. Nothing an in-page script can do
reorders an interface's own keys. The A3 check therefore still fires on Chrome, so the attack script's
verdict is still "SHIMMED". That costs nothing beyond the bit the feature already spends there —
Chrome ships no native GPC, so *any* `globalPrivacyControl` on Chrome is an extension. It costs
something on Firefox, where a native one exists, and **A3 does not fire on Firefox** (31 of 48 before
and after: `defineProperty` over an existing key keeps its slot). The comment in `gpc.js` that said
"no amount of `toString` masking can hide it" has been replaced: it conflated the signal's *presence*
(which must be visible, and is the feature) with its *implementation* (which need not be).

**Adjacent, observed, not fixed:** `Function.prototype.toString.call(Function.prototype.toString)`
reads `function toString() { [native code] }` on Firefox, where the engine's own spelling is
`function toString() {\n    [native code]\n}`. That is `shim.js`'s `markNative`, which always writes
the Chrome form, and it applies to every function the shim masks on Firefox. Unchanged by this
commit, and a D32-level decision of its own.

**Guards:** `review-2026-09-19.test.js` — the name, the D32 shape probes, both engines' source
spellings through a calibration model, the un-calibratable fallback, the OFF getter (an excepted site
must not get a louder tell than an on one), the masking layer masking itself with and without a shim
underneath, and the key-order tell pinned as a **known limit** rather than quietly passing.

## D39 — The per-site GPC exception has a control, and the remedy under it points at something that works. 2026-09-19.

**Decision:** the popup carries a per-site GPC switch, in three states with three sentences:
signal off globally (disabled, points at settings), shipped breakage host (disabled, says Nullecho
ships it off here), otherwise a live switch that sends `GPC_MSG.SET_SITE_EXCEPTION`. `GPC_MSG` is a
new export in `protocol.js` — deliberately not part of `MSG`, because `background.js` routes
everything in `MSG` to `handleShell`, which does not know these two.

**What G4 was.** `setSiteException` was implemented, persisted under `nullecho:gpc:v1`, rule-synced,
documented in `gpc.js` as "the recovery path for a site that misbehaves with GPC", and covered by
eight tests — and `grep -rn "gpc:setSiteException" ext/` returned exactly one hit: the handler.
Nothing in `popup/` or `options/` ever sent it. A user who hit GPC breakage outside the shipped 50
had one lever: switch GPC off **globally**, which is the outcome the feature exists to avoid. It is
also the only reason D36's bug was not already shipping harm, which is why the two go together.

**The report now says WHOSE exception it is.** `onGetSiteReport` adds `gpc.userExcepted`, because
"you turned it off here" and "Nullecho ships it off here" are different sentences with different
remedies and only one of them is a switch the user can flip back. The GPC finding's remedy used to
offer "Turn on Global Privacy Control" on a shipped-exception host — a button that sets a global
toggle which is **already on**, so it did nothing. Three branches now: `enable-gpc-site` for the
user's own exception, no action (and a sentence saying the signal still goes out everywhere else) for
a shipped one, `enable-gpc` only when the signal is actually off.

✅ **Rendered, not grepped** — Chrome for Testing 147, the real popup page driven against a real site
tab (`tabs.query` finds the site tab, so this is the popup's own code path):

| state | switch | note |
|---|---|---|
| `b.test`, signal on | checked, enabled | "If this site stops working … turn the signal off here rather than everywhere. This covers this browser profile only." |
| after clicking it | unchecked, enabled | "You turned the signal off for this site…" — and `getDynamicRules()` gained `1100002`/`1100003` for `b.test` |
| the finding's remedy, clicked | back to checked | dynamic rules back to `[]`; the finding returns to "was sent to this site" |
| `usaa.com` (shipped exception) | unchecked, **disabled**, label dimmed | "Nullecho ships the signal off on this site because it breaks when it sees it…" |

Light scheme checked as well as dark (`prefers-color-scheme: light`: label `rgb(22,28,35)` on panel
`rgb(246,248,250)`, off-track `rgb(140,150,161)`).

**⚠ A rig lesson worth keeping.** Read from a **background** tab, `getComputedStyle` on the switch
returned the *checked* colours (`rgb(86,195,164)`, thumb translated) while `input.checked` and
`input.matches(':checked')` were both `false`. Foregrounding the tab and re-reading gave the correct
off colours. A background tab defers style recalc; a screenshot-free "it renders correctly" taken
from one is not evidence. Same family as the hidden-pane rule already in the operator notes.

## D40 — The copy says where the duty comes from, discloses the mechanism's scope, and `isCalifornian` is a real setting. 2026-09-19.

**Decision:** three copy changes and one setting.

1. **Residency, not site.** Every "legally binding in California, Colorado and several other states"
   now reads as a property of **where the user lives**: *"If you live in California, Colorado or one
   of the several other states that recognise it, this is a legally binding opt-out"*, and the
   aggregate remedy is *"Send Global Privacy Control — a legal opt-out if you live in one of the
   states that recognise it."* Every statute in `docs/review-2026-09-19/gpc.md` §2.1 scopes its duty
   to that state's own consumers: a California resident's signal creates a duty for a covered
   business wherever that business sits; a Wyoming resident's identical signal creates none, on the
   same site, in the same second. The old phrasing was not false; it was the kind of true-sounding
   sentence a user reads as "this works where I am".
2. **No number of states, ever.** Eleven are verified in that document and **nine were never
   reached**. "12 states" circulates in vendor marketing and is not supported by anything we have.
   A test fails the build on `\b(\d+|two|…|twelve)\s+(US\s+)?states\b` in the user-facing copy.
3. **The disclosure Colorado asks of the PROVIDER, not of the sites.** 4 CCR 904-3 Rule 5.03(A)(3)(b)
   names "that the mechanism applies only to a single browser or device" as its own example of a
   limitation the provider must disclose. Every "this device" line in the extension was about where
   *data is stored*. `options.html` now says, in the GPC section: **"This covers this browser profile
   only."** — your phone, your other browsers and any other profile on this machine each need their
   own — and widens the purpose line with Rule 5.03(A)(4)(a)'s blessed, state-agnostic phrasing: the
   signal "exercises any and all opt-out rights available to you under state laws, which in most of
   them covers sale, sharing *and* targeted advertising". Nine of the eleven verified states scope
   the duty to targeted advertising as well as sale; New Jersey adds profiling. "Do-not-sell" alone
   under-sold the signal everywhere outside California.
4. **`isCalifornian` is a setting.** It was read at `linkage.js:742/795/807` and written in exactly
   one place in all of `ext/` — `popup.js`'s `DEMO` fixture. So all three DROP nudges rendered in
   design review and were **dead in the shipped extension**. It is now in `DEFAULT_SETTINGS` as
   `false`, with a checkbox in the options DROP card ("I live in California — show the DROP
   data-broker deletion step") that persists through `SET_SETTINGS`. **User-declared, never
   inferred**: Colorado Rule 5.03(C) says a mechanism's provider "is not obligated to authenticate
   that a user is a Resident of Colorado", Nullecho has no location by design, and a California-only
   step must not be shown to everyone. `dropFiled` is read the same way and still has no writer —
   named here so the next person does not rediscover it as a new bug.

**Guards:** `review-2026-09-19.test.js` — the scope sentence and the purpose phrasing in
`options.html`; every "legal" claim in `linkage.js`, `options.html` and `popup.js` must carry
"you live"/"your state" (comments stripped first, because those discuss the law at length and are not
what the user reads); no state count anywhere; `DEFAULT_SETTINGS.isCalifornian === false`; a shipped,
non-demo settings object turning the nudge on in both the aggregate and the per-site remedy; and the
options control existing and writing through `patchSettings`.

## D41 — `WorkerNavigator.globalPrivacyControl` stays unimplemented, and the mismatch is written down. 2026-09-19.

**Decision:** do **not** build worker-scope GPC now. Record the gap where someone writing UI copy or
a threat-model claim will trip over it — in `gpc.js`'s header, with the normative sentence quoted and
the measurements beside it — and leave **A8 open**.

**The requirement.** W3C GPC, Working Draft 17 September 2026, normative:
`WorkerNavigator includes GlobalPrivacyControl;`. Nullecho sets nothing in worker scope.

✅ **Measured 2026-09-19**, signal ON, header confirmed going out on every request:

| | window | classic Worker | `blob:` Worker | ServiceWorker |
|---|---|---|---|---|
| Chrome for Testing 147 + Nullecho | `true` | `undefined` | `undefined` | `undefined` |
| Firefox 156 + Nullecho | `true` | **`false`** | **`false`** | — |
| Firefox 156 stock (no extension) | `false` | `false` | `false` | — |

**The Firefox row is the cost.** Both native values come from one preference, so no stock Firefox can
answer `true` in the window and `false` in a worker. That pair is a cleaner detector than anything the
getter itself leaks now that D38 has closed the name and the source — and unlike the key-order tell it
is fixable in principle. It is not fixed here.

**Why not.** A MAIN-world content script cannot inject into a worker scope. Reaching it means
wrapping `Worker`/`SharedWorker` to prepend a `defineProperty` to the worker's script, which covers
same-origin and `blob:` classic workers only — module workers, cross-origin worker sources and
service workers stay out of reach — and the wrapper is itself a new detectable surface on two
constructors every page can see. That is a design with its own breakage budget, not a patch, and it
belongs with the general worker-shim question rather than being smuggled in under a GPC fix.

**What is NOT broken.** The header. DNR matches at the request level, so requests issued from inside
dedicated workers and service workers carry `Sec-GPC: 1` — 18 of 18 and 4 of 4 in the capture. The
gap is the JS property only, which is why "the worker gap breaks GPC" would be the wrong summary.

**Guard:** `review-2026-09-19.test.js` fails if the quoted normative line, or the sentence naming A8
as open, leaves `gpc.js` — and if worker scope is ever installed into, so that the comment is updated
in the same change rather than becoming a lie.

---

## D42 — Nothing on the service worker's top level may throw. Firefox was dead on arrival. 2026-09-19.

**Decision:** `webRequest`'s Chrome-only `extraHeaders` option is passed only when the browser's own
option enum advertises it; `heuristics.install()` is written so it cannot throw at all; and every
top-level side effect in `background.js` goes through a `bootStep()` that catches. A feature we
cannot wire up is a feature lost. It must never be the extension.

**What it was.** One line, `heuristics.js:588`:

```js
chrome.webRequest.onBeforeSendHeaders.addListener(
  onBeforeSendHeaders, filter, ['requestHeaders', 'extraHeaders'],
);
```

Firefox rejects the value — `Type error for parameter extraInfoSpec (Error processing 1: Invalid
enumeration value "extraHeaders") for webRequest.onBeforeSendHeaders.` — and `install()` is called
from `background.js`'s top level, **above** `chrome.runtime.onMessage.addListener`. One throw, and
the listener below it is never reached. The extension installs, the icon appears, the DNR rulesets
load, the popup opens — and there is no message surface at all. This has been true for as long as
`manifest.firefox.json` has existed, and no test could see it because every test stubs a `chrome`
that accepts anything.

✅ **Measured, Firefox 156.0, a throwaway profile per run, the extension installed over WebDriver
BiDi `webExtension.install` from a scratch copy (nothing under `ext/` was loaded):**

| | before | after |
|---|---|---|
| `runtime.sendMessage({type:'nullecho:get-persona'})` | `Could not establish connection. Receiving end does not exist.` | answered by the worker |
| `nullecho:get-overview` | same error | `{identity:{tag:"0E3E12",…}, sites:[…]}` |
| sites the worker served a persona for | — | `a.test` → `macos-chrome-m3-4k`, `third.test` → `macos-chrome-mini-m2` (the cross-origin iframe) |
| loader console per page | `[Nullecho] Could not reach the extension service worker` ×3–4 | only the `about:`/error sub-frames, which genuinely have no site key |
| JS errors in the browser console | the `extraInfoSpec` throw + 20 uncaught rejections | **none** |
| **two fresh profiles, same page** | **identical persona** (cores 8 / cores 8) — the fallback, un-salted | **different personas** (cores 8 / cores 10) |

That last row is the one that matters: a persona that is the same on two fresh profiles is the
domain-derived FALLBACK. Firefox was running the whole extension on it — no salt rotation, no
per-origin key, and "New identity" changing nothing. The per-origin split in the row above it
(`a.test` and `third.test` on the same page getting *different* personas) is the thing Nullecho is
for, and on Firefox it had never once happened.

**The feature detect was measured on both engines, not assumed.** The enum object exists on BOTH —
what differs is its contents, so `'OnBeforeSendHeadersOptions' in webRequest` would have been the
wrong test:

    Chrome 147   { BLOCKING, EXTRA_HEADERS: 'extraHeaders', REQUEST_HEADERS: 'requestHeaders' }
    Firefox 156  { BLOCKING, REQUESTHEADERS: 'requestHeaders' }          ← no underscore, no EXTRA_HEADERS

So the test is `optionsEnum?.EXTRA_HEADERS === 'extraHeaders'`. Chrome keeps the option, which it
needs: it hides `Cookie`/`Set-Cookie` from the ordinary header view without it, and the whole
heuristics layer reads those. Firefox does not hide them, so dropping it there costs nothing.

**Belt and braces, because the detect is still a guess about the future.** `addWebRequestListener()`
retries without the option if the spec is refused, gives up with a warning on the worker's own
console if that fails too, and returns; `install()` has no path that throws. `bootStep()` wraps
`heuristics.install()` and `NullechoGPC.init()` in `background.js` so that the next Chrome-only call
anyone adds up there costs its own feature and not the message surface.

**Audited in the same run, and NOT fixed — the other Chrome-only surfaces.** Read out of a real
Firefox 156 extension page:

| | Chrome 147 | Firefox 156 | consequence |
|---|---|---|---|
| `declarativeNetRequest.onRuleMatchedDebug` | object | **undefined** | guarded with `?.` — no throw |
| `declarativeNetRequest.getMatchedRules` | function | **undefined** | `matchedRulesForTab()` catches → `null` |
| `updateStaticRules` / `getDisabledRuleIds` | ✓ | ✓ (tier-B opt-in works; the 8 ids read back disabled) | — |
| `testMatchOutcome` | ✓ | ✓ | only used by the rigs |
| `chrome.storage.*` | promises | promises (`chrome` is a real alias, not callback-only) | — |
| `storage.session` | ✓ | ✓ | unused by design |

So on Firefox the popup's "requests blocked" has **no source at all** — both DNR reporting APIs are
missing, and the comment above `recordMatch()` that promises `getMatchedRules()` as the packed-build
fallback is Chrome-only advice. Nothing throws, nothing lies to the user (the counter stays at
zero), and `webRequest` — which this extension already holds — could supply it. Left open
deliberately: it is a counter, not a protection, and wiring it is a UI change with its own lane.

**Guards:** `firefox-boot-2026-09-19.test.js` — `background.js` imported under a webRequest stub that
throws on `extraHeaders` exactly as Firefox does, and with no option enum: `onMessage` IS registered,
both listeners land with the portable spec, and `GET_PERSONA` answers `ok:true` with a persona; a
Chrome-shaped stub still gets `extraHeaders` (the fix is a detect, not a removal); `install()` does
not throw when both registrations are refused, or when there is no `webRequest` at all; and a source
lint fails the build if `'extraHeaders'` ever appears outside the one constant.

---

## D43 — The spelling of `[native code]` is the engine's. `markNative` copies it; it never writes it. 2026-09-19.

**Decision:** `markNative` no longer composes a source string. It takes the one the engine itself
prints — **from the function being replaced**, when that function is native, which is every install
site in a real browser; from a pristine native **of the same kind** captured at boot, with the name
swapped, when it is not (a test rig, or another extension that patched first); and only if neither
is usable, the Chrome form this file always wrote. A native model's own `name` wins too, because
`length` already did and a replacement whose name and source disagree is a tell of its own.

**What it was.** One line: `'function ' + name + '() { [native code] }'`. A native function's source
is "an implementation-defined NativeFunction" and the two engines disagree about it. Measured
2026-09-19, same page, same probe, Chrome for Testing 147.0.7727.15 and Firefox 156.0:

| | Chrome 147 | Firefox 156 |
|---|---|---|
| `Navigator.prototype.userAgent` getter | `function get userAgent() { [native code] }` | `function userAgent() {\n    [native code]\n}` |
| `Element.prototype.innerHTML` setter | `function set innerHTML() { [native code] }` | `function innerHTML() {\n    [native code]\n}` |
| `HTMLCanvasElement.prototype.getContext` | `function getContext() { [native code] }` | `function getContext() {\n    [native code]\n}` |
| the getter's `.name`, both | `get userAgent` | `get userAgent` |

SpiderMonkey drops the accessor prefix from the SOURCE while keeping it in `.name`, and indents the
body. D38 found this for one getter and fixed that one by calibrating from `Navigator.prototype.onLine`;
its own "Adjacent, observed, not fixed" paragraph named the rest of the file. This is the rest of the
file.

✅ **Before → after, real Firefox 156, the shipped content scripts, one page load:**

| | before | after | the engine's own, same page |
|---|---|---|---|
| `Navigator.userAgent` getter | `function get userAgent() { [native code] }` 🔴 | `function userAgent() {\n    [native code]\n}` | `onLine`: `function onLine() {\n    [native code]\n}` |
| `HTMLCanvasElement.toDataURL` | `function toDataURL() { [native code] }` 🔴 | `function toDataURL() {\n    [native code]\n}` | `getContext`: `function getContext() {\n    [native code]\n}` |
| `Function.prototype.toString` | `function toString() { [native code] }` 🔴 | `function toString() {\n    [native code]\n}` | — |
| `navigator.globalPrivacyControl` getter | `function globalPrivacyControl() {\n    [native code]\n}` | unchanged | matches (D38 already calibrated it) |

Twelve shim-installed functions were checked; all twelve read Chrome's spelling before and the
engine's after. **The detector this closes is one compare, no list of expected values:** `toDataURL`
and `getContext` are both methods on `HTMLCanvasElement.prototype`, and on Firefox one was
single-line and the other was not. `Screen.prototype.width` — which the shim deliberately does not
patch (G5, the display layer) — read multi-line throughout and is the control that proves the probe
discriminates.

**Chrome is untouched: 12 of 12 masked functions byte-identical before and after**, verified against
the same probe in Chrome for Testing 147 with the same build. The fix cannot regress Chrome by
construction — on V8 the copied source *is* the string the old code composed.

**A second, smaller thing the copy fixes.** `GPUSupportedFeatures.prototype[Symbol.iterator]` is an
alias: its own `name` is `values` and both engines print `function values() { [native code] }` for
it (measured in Chrome 147). The old code wrote `[Symbol.iterator]` into both the name and the
source — a name no engine prints for it. Taking the model's own name and source fixes both. ⚠ That
one path is covered by the unit tests and by the native measurement, but was NOT re-verified in a
patched browser: `navigator.gpu` stopped being exposed in this Chrome for Testing session (no GPU
process), so the patched WebGPU objects could not be reached again.

**`gpc.js` needs no change and inherits the fix.** Its D38 calibration copies from `onLine`, which
the shim does not patch, so it was already correct on both engines; and its `selfSrc` echo — what
the layer below says about `Function.prototype.toString` — is now the engine's spelling on Firefox
too, because that layer is `shim.js`'s mask. Its remaining hard-coded Chrome-form strings are the
un-calibratable fallbacks, unreachable in any real browser, and a test pins them.

**Kept intact:** D21 (nothing calls a prototype at run time — the new code uses only boot-captured
`strIndexOf`/`strSlice`/`Object` intrinsics and the boot-captured `Function.prototype.toString`,
which is also why another extension's wrapper cannot feed us a source); D32 (the shape probes are
unchanged; this touches only the string); D33 (no console call is added, and the derivation cannot
throw out of `markNative`).

**Guards:** `native-source-2026-09-19.test.js` — a `node:vm` realm per engine, with a fake
`Function.prototype.toString` installed BEFORE the shim so the shim captures it, printing V8's
spelling or SpiderMonkey's and reporting `[native code]` for the realm's own natives the way a
browser does. On both: every masked function equals what that engine prints for a native of the
same name and kind; a masked member is byte-identical to an UNPATCHED neighbour on the same
interface with the name substituted (the attacker's compare); `Function.prototype.toString` reports
itself the engine's way; no shim source reaches the page; a non-native model falls back to the
template rather than to that extension's source; an engine that refuses to stringify anything still
yields `[native code]`; and D33's no-console rule is re-asserted around the new code.

---

## D44 — The price disclosure notice reports OBSERVATIONS. Two sentences, both in full, behind a price gate. 2026-09-20.

**Decision:** Nullecho ships a **price disclosure notice**: when a page displays one of the two
algorithmic-pricing sentences a U.S. state mandates **and** publishes a machine-readable price, the
popup says so and offers a local, copyable record. It never says whether a business is complying
with anything. New feature files: `ext/src/pricing.js` (pure), `ext/src/pricing-scan.js` (content
script, ISOLATED, `document_idle`, top frame only), `PRICING_MSG` + `PRICING_STORAGE_KEY` in
`protocol.js`, `priceNoticeCard()` in `linkage.js`, a popup panel, an options explainer, and a
§3 block at the end of `background.js`. 60 tests in `ext/src/pricing.test.js`.

This replaces the **Checkout Report**, which was promised in three shipping documents and existed in
zero lines of code — `git log --all -S'Checkout Report' -- ext/` was empty, so it was never built and
then removed; it was never built at all. The promises came out in `44be2dd`. D16 carries the
correction block.

### The two sentences, and why there are exactly two

| | Wording | Status | Matchable? |
|---|---|---|---|
| **New York** GBL § 349-a | `THIS PRICE WAS SET BY AN ALGORITHM USING YOUR PERSONAL DATA` | **In force.** Effective 2025-07-08; enforced from 2025-11-10, when the AG's voluntary stay lapsed 30 days after *NRF v. James* was dismissed with prejudice | **Yes, exactly.** Hard-coded by statute, no alternative wording. The only exact-matchable disclosure string in force in the U.S. |
| **Connecticut** P.A. 26-130 § 11 | `THIS PRICE WAS INCREASED USING YOUR PERSONAL DATA` | Effective **2027-07-01** | **Only the canonical form.** The statute adds *"or a substantially similar disclosure"*, so a compliant Connecticut page can use its own words. **A match means something; an absence means nothing.** |
| Maryland | — | Com. Law § 13-321, a food-retailer ban | **No string exists.** The proposed § 13-322 carrying `…SET BY AN ALGORITHM **OR BY** USING YOUR PERSONAL DATA` was **struck by amendment before passage.** |
| New Jersey | — | Fair Price Protection Act, a grocery ban | No prescribed wording. |

⛔ **There is no Maryland branch, and a test asserts the struck string matches nothing.** Two
independent passes "verified" § 13-322 as enacted, both by running `pdftotext` over the chapter-law
PDF — which silently drops strikethrough. The controls that settle it: the state's codified-statute
endpoint returns text for § 13-321 and **"File Not Found"** for § 13-322, and the codified
§§ 13-408(a) / 13-411(a) each read *"does not apply to a violation of § 13-321"* with no "or
§ 13-322". **Method rule: never verify a chapter law by text extraction — render the pages, or query
the state's codified endpoint with a positive control.**

### Why it reports observations and cannot report compliance

Because the only enforcement action on the record settles it. The New York Attorney General's
2026-01-08 letter to Maplebear/Instacart quotes a page carrying the mandated sentence **exactly as
the statute prints it** and concludes that form of disclosure *"does not appear to comply with, among
other things, the 'clear and conspicuous' requirements of the Act"* — it sat mid-sentence on a
fine-print-linked policy page, and was absent from the pages that display prices. A page can carry
the words and fail; a page with no words may simply not be personalizing, which the compliance
guidance in the brief argues is the *likely* explanation in general retail. So the feature reports
the words and stops.

**The banned-phrase list is a test, not a style note.** `pricing.test.js` reads the copy between
markers in `linkage.js`, `pricing.js`, `options.html` and `popup.html` and fails the build on
*compliant*, *non-compliant*, *violation*, *illegal*, *required*, *you are protected*, *failed to
disclose*, *missing disclosure*, *should have disclosed*, *breaking the law*, *unlawful* — and on any
"N states" count, which has been wrong twice. One distinction is deliberate: **"requires" is allowed
and "required" is not.** "New York law *requires* that sentence when a price was set by an algorithm
using your personal data" is a statement about the statute and is true. "A disclosure was *required*
here" is a statement about this merchant, and is the claim we cannot support.

### What the matcher does, and the two specs it replaces

Both written specs for this detector were defective, in opposite directions, and both were
reproduced as failing behaviour before anything was built (review 2026-09-19, BLOCKER 2, 19 tests):

- **Spec A** (`NY-349A-COMPLIANCE-SWEEP.md` §5) used a contiguous anchor plus
  `/personalized algorithmic pricing/i` and an unbounded `/NEW YORK RESIDENTS:.*required to inform
  you/i`. It fires on a page *denying* the practice, and the unbounded regex joins two unrelated
  sentences on one flattened line.
- **Spec B** (D16's substring list) used `using your personal data` — the one substring both live
  sentences share. It also appears in *"the lawful bases for using your personal data"* and
  *"withdraw consent to our using your personal data"*, i.e. the footer of nearly every commercial
  page the extension will ever see.

What shipped instead: **the FULL sentence, per regime, over normalized rendered text.** Normalization
folds case, drops invisible characters (soft hyphen, zero-width space/joiner, word joiner, BOM, bidi
marks), collapses every flavour of Unicode whitespace, and turns quotes/commas/brackets/dashes into
spaces — while keeping a **map back to the original**, so the receipt quotes the sentence as the page
displayed it rather than as we rewrote it.

The interesting part is the **two** separator classes. A single newline becomes a space, because
`innerText` puts exactly one between two `<div>`s and that is how a sentence split across elements
reaches us. Sentence-ending punctuation (`. ! ? ; :`) and a **paragraph break** (two or more newlines,
which is what `innerText` emits around a `<p>`) become a **barrier** the match may not cross. Without
the barrier, *"…was set by an algorithm. Using your personal data, we then…"* assembles into a false
match — and so does a headline reading *"This price was set by an algorithm"* above a paragraph
starting *"Using your personal data…"*, which is the real Nieman Lab article shape.

### The price gate, and why it is the guard rather than the matcher

No text matcher can distinguish a price display from a newspaper quoting the statute; both contain
the same sentence. What separates them is whether the page also publishes structured price data —
JSON-LD `Offer`/`priceSpecification`, microdata `itemprop="price"`, `og:price:amount` /
`product:price:amount`. The scan runs that check **first**, and the `innerText` read — the half that
forces layout — runs **only** behind it. A test asserts the ordering *and* the guard
(`price ? renderedText() : ''`), because ordering alone would let a refactor slip past it.

⚠ **The residual false positive, stated rather than hidden:** a *publisher* article about the law, on
a site whose article pages carry a subscription `Offer` in JSON-LD, would satisfy both halves. That
is narrow — news article schema does not normally carry `offers.price` — and it is the honest cost of
using structured price data as the gate. It is also the same category as the true positive: the
publishers are the one observed group that *does* carry the disclosure, on renewal pricing.

### Known misses, all deliberate

| Shape | Result | Why |
|---|---|---|
| Sentence inside a **closed `<details>`** | **no notice** | The scan reads `innerText` — what the page rendered. A reader did not see it, so neither did we. Verified in Chrome 147 on a fixture. |
| Sentence concatenated with **no whitespace** (`…SET BY ANALGORITHM…`, two inline elements) | **no notice** | That is not the mandated sentence as displayed. Inline elements introduce no space, so a reader sees `ANALGORITHM` too. |
| Sentence split across a **paragraph break** | **no notice** | The barrier above. Accepting it would re-open the Nieman Lab headline. |
| A **Connecticut** page using different-but-similar wording | **no notice** | Unmatchable by construction — the statute allows it. Said in the UI, not just here. |
| Renewal **emails**, where the sweep found most real disclosures live | **out of reach** | A content script cannot read mail. Stated in D16 and unchanged. |

### Measured cost

Chrome for Testing 147.0.7727.15, a **430-element** fixture page, paired ABBA timing in the style of
`harness/performance.html` (reps calibrated to clear the 0.1 ms clock clamp; per-round ratios, so the
error bars are the measurement's own). Medians, relative standard deviation ≤ 3.5% throughout:

| | median | p95 |
|---|---|---|
| Full scan, product page (price context present, clean layout) | **0.145 ms** | 0.151 ms |
| Full scan, product page, layout dirtied first (pessimistic) | **0.164 ms** | 0.169 ms |
| Page with **no** price context — the gate stops it | **0.033 ms** | 0.035 ms |
| The price-context check alone | 0.034 ms | 0.035 ms |
| `findDisclosure()` over 2,383 characters of rendered text | 0.089 ms | 0.094 ms |

The gate costs the same whether or not it finds a price (ratio 1.04), and it is **4.4–5.0× cheaper**
than a full scan — which is the whole point of running it first. Two passes per page load (idle, then
~3 s later for client-routed flows) put the worst case around **0.33 ms per page**, against a 2 ms
budget. A `MutationObserver` was rejected for exactly this reason: it would pay the scan per mutation
burst on the heaviest pages in the catalogue.

### Rendered, not asserted

Chrome for Testing 147, the extension loaded unpacked from a scratch copy, nine fixture origins, the
real popup read against a real site tab, **both colour schemes**, tab foregrounded before any
computed style was read (D39). What fired and what did not:

| Fixture | Notice |
|---|---|
| Product page, NY sentence **lower case, mid-sentence behind a colon** (Instacart's observed form) + JSON-LD `Offer` | **shown — NY** |
| Connecticut canonical sentence + `product:price:amount` meta | **shown — CT** |
| Sentence split across two `<div>`s, with `&nbsp;` and a **soft hyphen** inside "ALGORITHM" | **shown — NY** |
| News article quoting the statute in full caps, **no price context** | nothing |
| Privacy policy with all four FP4 anchors, **on a site with a price** | nothing |
| The **struck Maryland string**, with a price | nothing |
| Sentence inside a **closed `<details>`**, with a price | nothing |
| JSON-LD price **commented out** of the markup | nothing |
| Cookie banner naming personal data, with a price | nothing |

`chrome.storage.local` held exactly three observations after all nine — `shop.test`, `ct.test`,
`split.test` — and the full key list was `identity, pricingObservations, stats`.

### The receipt

One key, `pricingObservations`, capped at 200 entries, oldest dropped first, one writer. Per entry:
site, URL **with the query string removed**, timestamp, which wording, the price and currency the
page published, and ≤ 200 characters of the page's own text around the sentence. Re-observing the
same URL, wording and price **replaces** rather than appends, so the 3-second second pass does not
double the list; a *changed price* on the same URL is a new observation, which is the interesting
case. The popup renders the exact text it would copy, before it is copied — the same promise the
shareable site report makes. Nothing is ever sent anywhere; `manifest.test.js` fails the build if an
egress API appears in the shipped tree, and `pricing.test.js` repeats the check against these two
files specifically, because they are the ones that hold page text and a price at the same time.

**Would change this:** a Second Circuit ruling in *NRF v. James* (fully briefed since 2026-02-24, no
ruling as of 2026-09-19) striking § 349-a would make the New York branch dead text — treat the
outcome as open; Rakoff dismissed the First Amendment challenge **with prejudice** under *Zauderer*.
A third state mandating a fixed sentence adds a row to `SENTENCES` and a card to `NOTICE_COPY` and
nothing else. A vendor convention for these disclosures — there is none today, every observed
implementation is hand-written legal copy — would give a structural signal better than text.

## D45 — The scan is a fourth content script, at `document_idle`, top frame only, in the ISOLATED world. 2026-09-20.

**Decision:** `src/pricing.js` + `src/pricing-scan.js` are declared as one content-script entry in
both manifests, `run_at: "document_idle"`, `all_frames: false`, `world: "ISOLATED"`,
`matches: ["http://*/*", "https://*/*"]`, with no `match_origin_as_fallback` / `match_about_blank`.
Every one of those differs from the three handshake scripts, and each difference is load-bearing.

**`document_idle`, not `document_start`.** The other three run at `document_start` because the shim
has to win a race against page script. This one has the opposite requirement: at `document_start`
there is no rendered text to read. The manifest-order test in `protocol.test.js` now checks the
handshake trio **by name** rather than by iterating the whole array, so adding a script with
different timing cannot quietly relax the assertion that protects the handshake.

**Top frame only.** A price in an ad iframe is not this page's price, and a disclosure in someone
else's frame is not this page's disclosure. `all_frames: false`, plus a `globalThis.top !== globalThis`
guard in the script, because the manifest and the code should agree without either being the only
copy of the rule.

**ISOLATED, and no DOM event channel.** The reverse channel D30 exists to authenticate is a MAIN↔
ISOLATED bridge over DOM events, which a page can both forge and watch. This lane never enters the
page realm: it speaks to the service worker over `chrome.runtime`, which a page cannot reach. So
there is no token scheme here because there is nothing to authenticate — and the worker still takes
the site and the URL from `sender`, never from the message body, the same rule `onGetPersona` and
`onFpDetected` follow. A content script does not get to say which site it is.

**Two timed passes, not an observer.** One at idle, one at ~3 s. See D44's cost table for why.

**Silent.** No console call on any path in either file, asserted by a test (D33's rule, applied to a
lane that never enters the page realm anyway — the belt is cheap). A storage failure in the worker
goes to the worker's own `warn`, which no page can see, and it never carries the observed text or the
price: a log line about a price is a log line about a person.

**`pricing.js` has no `import`/`export`.** It is simultaneously a classic content script and an ES
module imported for its side effect by `background.js`, the popup and the tests — the same dual shape
`gpc.js` already uses, attaching one object to `globalThis`. The single literal `pricing-scan.js` has
to inline is registered in `CONTENT_SCRIPT_LITERALS`, so `protocol.test.js` fails the build if the
two spellings drift.

**The `background.js` §3 block is at the END of the file, and its `import`s are with it.** Import
declarations hoist, so they can sit inside the block rather than in a shared header — which keeps a
third lane's whole footprint in one readable piece in a file two other lanes already write to, and
means a concurrent edit to the header cannot collide with it. The block registers its **own**
`onMessage` listener, synchronously at top level per this file's MV3 rule, and returns `false` for
anything that is not one of its three message types; `handleShell` never sees them.

---

## D46 — One `Function.prototype.toString` mask per realm, and `shim.js` owns it. 2026-09-20.

**Decision:** `gpc.js` no longer installs its own `Function.prototype.toString` wrapper. The
`navigator.globalPrivacyControl` getter is installed by `shim.js` through `markNative` (D32 shape, D43
copied native source), taking the on/off value from the persona payload the ISOLATED loader already
delivers; `gpc.js` stays in the manifests only as the fallback for a realm the shim never reaches. D36–D41
semantics are unchanged (off reads `false`; a stand-down on Chrome DELETES the property the browser never
had — the `remove` flag now travels through the D47 ledger; per-site exceptions; the WorkerNavigator limit).

**The regression this closes — measured, not argued.** D38 (2026-09-19) gave `gpc.js` a second masking
wrapper because, as a separate classic script, it could not reach the shim's `NATIVE_SRC`. Every harness
run that day was in page-script mode, where `gpc.js` is never loaded, and read 2 lies. The first run of
`harness/unpacked-chrome.mjs claim` (D47's real-install gate; Chrome for Testing 149, `ext/` loaded
unpacked, both origins) read **lieCount 199, `hasToStringProxy` true, `extensionHashPattern` 30** — the
same numbers as before D32–D35. Mechanism: a child realm's pristine `Function.prototype.toString` applied
to the TOP realm's `Function.prototype.toString` printed `gpc.js`'s wrapper source; no shim closure knew
that function, so every other realm's mask delegated to its native and revealed it, and CreepJS turns one
revealed `toString` into a failed-toString lie on every API. The same build with `src/gpc.js` removed from
the manifest read 2 / false / 0. Rule: **one mask per realm**; a second owner of `toString` is a leak by
construction, whoever writes it.

**After, on the merged tree `7fd6964` (D46 + D47), real install, both origins (`localhost` and
`127.0.0.1`, 2026-09-20):** lieCount **2** (the canvas/audio noise), `hasToStringProxy` **false**,
`extensionHashPattern` **0**; FingerprintJS `3071cab4…` vs `d1ef751f…` and ClientJS `705808318` vs
`2556000097` (two site keys, two ids under the real service worker); CreepJS one id on both (§6.1 of
CLAIM-VERIFICATION stands — the join is not broken against a lie-discarding library). Same-tick child
realm: cores = persona, pristine `toString(userAgent getter)` → `[native code]`,
`toString(Function.prototype.toString)` → `[native code]`. `webDriverIsOn` reads true under the automation
and is the automation's (`unpacked-chrome.mjs` header, trap 3), not the shim's.

**What was not finished.** The agent that wrote the fix was stopped by the account's spend limit after
confirming before/after but before its adversarial pass; the director merged the WIP (`dab5572`) after
routing its two strong ledgers — the GPC restore entry and `GPC_REALMS`, a strong list of every realm's
`Navigator.prototype` — through D47's WeakRef pattern (the merge conflict and a red D47 retention test
caught both). Not re-run tonight: `unpacked-chrome.mjs timing` (post-navigation realm) and the Firefox
G2/G3 semantics against this exact build. Guards: `ext/src/gpc-one-mask-2026-09-20.test.js` (21 tests),
`review-2026-09-19.test.js`, `same-tick-realm.test.js`. Suite 467/467.

---

## D47 — Realm identity is the Document, not the WindowProxy; a navigated frame is re-installed on its `load`. 2026-09-19.

**The defect, measured.** D35's own attack pass found it and recorded it as the next decision. An
`<iframe>` inserted as `about:blank` is installed inside the insertion call (D35). Assign `src`
afterwards and the frame navigates in a later task: the WindowProxy at `window[n]` is the **same
object**, and the realm behind it is brand new. `INSTALLED` was a WeakSet keyed on that proxy, so
every door — the D35 sweep, `contentWindow`, the MutationObserver — said "already installed" about
a realm that no longer existed. Real Chrome 151, shim as a page script, persona `macos-chrome-mini-m2`
(8 cores) on a 12-core host, `harness/claim-verification.html` probe against the D35 build:

| Moment | Child `hardwareConcurrency` |
|---|---|
| inserted as `about:blank` | 8 (D35) |
| `src` assigned; navigation committed 24 ms later | **12** |
| `load` fired, +7 ms | **12** |
| `f.contentWindow` read | **12** |
| next `appendChild` anywhere on the page (the D35 sweep) | **12** |

And that realm's `Function.prototype.toString` was pristine, so it printed the shim's source for
every function patched in the parent — §3c's whole consequence, one navigation away.

**The rule.** *"Already installed" is a statement about a Document.* `installInto` keys `INSTALLED`
on `win.document` — a `[LegacyUnforgeable]` own property of the global that no page can redefine —
never on the WindowProxy the page hands us. A WindowProxy whose `document` throws (cross-origin) is
remembered in a second WeakSet, `OPAQUE`, keyed on the proxy, so the insertion sweep pays one
`SecurityError` per such frame ever rather than one per `appendChild`. And the parent gets a door
that fires when a navigation finishes: a **capture-phase `load` listener on the document**, which
runs before any listener the page put on the element, installs into `contentWindow` through the
captured getter, and bypasses `OPAQUE` — a load is the one moment a frame that was cross-origin can
have become same-origin.

**The door is on the document, not the window, and that was measured before it was known.** Per
the DOM spec, a Document's "get the parent" returns `null` for a `load` event, so a load's
propagation path stops at the Document: a capture listener on the **window** never hears an
iframe load. The first build registered on the window and, in real Chrome, the page's own load
handler still read 12 while `contentWindow` and the sweep (now document-keyed) read 8. The rig was
then corrected to stop a load's path at the document — which turned four green tests red — and the
listener moved to `doc`.

**The sweep's guard, rewritten.** D35 hoisted `installInto`'s first line into the loop because
merely *calling* `installInto` costs ≈1 µs. The hoisted guard now asks the right question:

```js
let w = null;
try { w = win[i]; } catch (_) { continue; }
if (!w || wsHas(OPAQUE, w)) continue;
let d = null;
try { d = w.document; } catch (_) { wsAdd(OPAQUE, w); continue; }
if (d && wsHas(INSTALLED, d)) continue;
try { installInto(w); } catch (_) {}
```

One WindowProxy property read more per same-origin child frame per insertion than D35 — the cost
measured below — and none for a cross-origin frame after its first throw.

**Re-installing found a second defect: the restore ledger retained every dead realm.** `RESTORES`
was a plain array of `{ target, prop, desc }`; `target` is the dead realm's prototype and `desc`
holds its native getters. Chrome for Testing 149, `--js-flags=--expose-gc`, page-script shim,
20 navigations of one same-origin child, WeakRefs to each dead realm's `Navigator.prototype` and
`document` checked after `gc()` and `HeapProfiler.collectGarbage`:

| Build | Dead realms still reachable | JS heap growth |
|---|---|---|
| D35 (never re-installs a navigated realm) | 2 of 20 | +0.89 MB |
| D47, first build | **20 of 20** | **+7.74 MB** (≈390 KB per navigation, forever) |
| D47 as shipped, weak ledger | **0 of 20** | −0.98 MB |

The ledger is now a WeakMap `target → [entry]` (an entry lives exactly as long as the object it
patches) plus an ordered array of `WeakRef<entry>` that `restoreAll()` dereferences and that is
pruned of dead refs whenever it crosses a multiple of 2048. `WeakRef` and `deref` are captured at
boot like everything else (D21).

**Rejected, with the reason:**

| Rejected | Why |
|---|---|
| Keep the sweep keyed on the proxy; key only the doors on the document | Cheaper by ≈0.3 µs per same-origin child frame per insertion, but blind to a navigation until its `load` — on a slow document that is the whole fetch, and the sweep is the only parent-side thing that can shorten it. Cost was measured and accepted instead. |
| A window-capture `load` door | Never fires for an iframe load (spec, and measured). |
| Hook `src` / `setAttribute('src')` / `srcdoc` / `location` | A navigation is asynchronous; the pristine realm does not exist when the setter runs, and `location.replace()` from the parent, form targets and link targets never touch the element. |
| A `pagehide` / `unload` listener in the realm being left | Fires before the new Window exists; there is nothing to install into yet. |
| Polling | No. |

**Measured, real Chrome 151.0.7922.174** (the running binary; `Chrome/151`, no Electron, tab hidden;
`harness/realm-timing.html`, shim as a page script, persona 8 cores, host 12), every reading taken
through `window[n]`:

| Reading | D35 | **D47** |
|---|---|---|
| inserted as `about:blank` | 8 | 8 |
| `src` assigned, navigation committed (6 ms), read **at commit** | 12 | **12** — residual 2 below |
| the page's OWN `load` listener on the element (+6 ms) | 12 | **8** |
| after `load` | 12 | **8** |
| that realm's `toString(userAgent getter)` says `[native code]` | false | **true** |
| navigated cross-origin, then back same-origin: at commit / in the page's load handler / after | — / 12 / 12 | 12 / **8** / **8** |
| `srcdoc` assigned after insertion: at commit / in handler / after | — | 12 / **8** / **8** |
| `frames[n].location.replace(url)` from the parent: in handler / after | — | **8** / **8** |
| `document.open()`+`write` on an installed child (modern Chrome keeps the Window) | — | same realm, **8** |
| **static markup** `<iframe>` read by the next parser-inserted `<script>` | — | **8** |
| `document.write('<iframe><script>…')` from a parser-inserted script of the same document, read inside the write | — | **8** |
| `child.document.write('<iframe></iframe><script>…')` from the parent, grandchild read **inside the write** | 12 | 🔴 **12** — residual 1 below |
| … the same grandchild once the write returned | 8 | 8 |

**What the installed extension does — measured, for the first time.** `ext/` was loaded unpacked
into **Chrome for Testing 149.0.7827.22** (new headless, `--load-extension`, a throwaway profile;
`Chrome/149`, no Electron) — the first time this repo's extension has run *as an extension* rather
than as a page script. The service worker booted and stored its `identity`; the MAIN-world shim ran
before the page's first inline script (`hardwareConcurrency` already 8 at stage 0); and on
`realm-timing.html?shim=off`, where the page loads no shim of its own, **every reading was the
persona**: the static-markup frame in the same parse, the `document.write` shapes including the
grandchild read inside the write, the navigated frame **at commit** (113–271 ms after `src`, the
headless fetch), in the handler and after load, and the cross-origin-then-back frame at commit.
Chrome's per-frame injection (`all_frames` + `match_origin_as_fallback`) covers both residuals in
an installed extension. That was assumed in D35 and CLAIM-VERIFICATION §5; it is now a measurement,
in Chrome for Testing, not yet in a user's own profile.

**CreepJS, re-run with a fresh `?cb=`** (real Chrome 151, both origins, `harness/claim-verification.html`,
shim as a page script):

| Signal | D35 | **D47** `localhost` | **D47** `127.0.0.1` |
|---|---|---|---|
| lie records | 2 | **2** | **2** |
| `stealth.hasToStringProxy` | false | **false** | **false** |
| `headless.webDriverIsOn` | false | **false** | **false** |
| `resistance.extensionHashPattern` | `{}` | **`{}`** | **`{}`** |
| same-tick child realm: cores / pristine `toString` says native | 8 / true | 8 / true | 8 / true |
| trash / captured errors | 3 / 4 | 3 / 4 | 3 / 4 |
| FingerprintJS `visitorId` | `e28d…` / `2396…` | `e28d…` | `2396…` |
| CreepJS id | `5e55ad8a…` on both | `5e55ad8a…` | `5e55ad8a…` |

D35's numbers hold; the per-site split holds; the CreepJS join is still not broken (§1, §6.1). The
same page in Chrome for Testing 149 reads lie records 2 and `hasToStringProxy` false on both
origins, and `webDriverIsOn` **true** — that is automation's genuine `navigator.webdriver`, not the
shim, and is why the bot verdict is reported from the user's Chrome only.

**Cost, real Chrome 151, hidden tab, same session, same instrument** — `harness/performance.html?only=none`
(nothing else runs) with a twin of its paired ABBA (`b` = the pristine `appendChild` captured at
`document_start`; 2 s budget, ≥ 12 rounds, medians), the D35 build served from the main checkout and
D47 from this one, then `?shim=off` as the null calibration:

| Same-origin child frames | D35 added | **D47 added** | shim=off (must be 0) |
|---|---|---|---|
| 0 | +0.92 µs | **+0.33 µs** | +0.03 |
| 1 | +0.48 | +1.68 | −0.04 |
| 3 | +2.49 | +2.04 | −0.10 |
| 5 | +4.28 | +3.86 | −0.03 |
| 10 | +5.01 | +6.96 | −0.02 |
| 20 | +9.42 | **+14.89** | −0.07 |

Slope: D35 ≈ 0.45 µs per frame, D47 ≈ 0.73 — **≈ +0.3 µs per same-origin child frame per
insertion**, the second WindowProxy read. With no child frames the two builds are within each
other's noise. The native `appendChild` reads ≈3.2–3.9 µs with *either* shim present and ≈1.2 µs
with none: the MutationObserver's mutation record is queued on both sides of the pair, and that is
not D47's. Five **cross-origin** child frames (`127.0.0.1`), paired the same way: D35 **+3.32 µs**,
D47 **+3.81 µs** — the same class, no throw per insertion; the indexed `win[i]` read is what a
cross-origin frame costs in either build and `OPAQUE` adds one WeakSet lookup to it. The standard
cells (`?only=paired&q=1`, D47): `appendChild` 0 frames +0.98 µs (1.36×; D35's table +0.49),
`insertBefore` +0.63 (+0.73), `innerHTML` below the floor (same), `appendChild` **3 frames +3.08 µs**
(2.07×; D35 +2.10) — the 3-frame cell is where the per-frame read shows. This session's instrument
is noisier than D35's: the shim=off cells read 1.000 / 1.000 / 1.004 / 0.955 and the in-page null
control 0.929 (D35: 1.014), so sub-microsecond differences at 0 frames are noise here; the slope is
the finding. Both builds sit well above D35's published quiet-page line (+0.15 fixed, +0.11 per
frame): that line was taken on a different day and the absolute level moved for both builds
together. `docs/PERFORMANCE-2026-09-17.md` has the tables.

**The attack pass**, all in real Chrome 151 against this build unless marked:

| Attack | Result |
|---|---|
| navigate after insertion, read in the page's own `load` handler | patched |
| read **at commit**, before `load` (poll with `MessageChannel`, unthrottled in a hidden tab) | 🔴 pristine for 5–11 ms on localhost; **patched under the installed extension** (CfT 149) |
| a second navigation of the same frame | patched |
| `srcdoc` assigned after insertion | patched in the handler; pristine at commit as above |
| `location.replace()` from the parent — `src` never touched | patched |
| `document.open()` + `write` on an installed child | same realm (Chrome keeps the Window), patched |
| navigate to a cross-origin document | `SecurityError` on `document`, marked `OPAQUE`, 25 later insertions read it 0 times (rig, counted) |
| cross-origin, then back same-origin | patched on that `load` — D35's HONEST LIMIT 3, closed |
| page replaces `HTMLIFrameElement.prototype.contentWindow` with a spy, then navigates | spy called 0 times; realm patched (rig) |
| page dispatches a synthetic `load` at an installed iframe, or at an `<img>` | no re-wrap, no throw (rig: function identity unchanged through three doors) |
| a window-capture door | blind (spec; measured on the first build) — that is why the door is on the document |
| page registers a document-capture `load` listener **before** ours and stops propagation | only by beating `document_start` — the injection race, THREAT-MODEL |
| 20 navigations of one child, then GC | 0 dead realms retained (CfT 149) |

**Residuals, stated plainly.** (1) `document.write` into a document whose parser is not the caller
— `child.document.write('<iframe></iframe><script>…')` from the parent — runs the written script
inside the write, before the wrapper's sweep: the grandchild reads the host. Narrower than D35
recorded: static markup and a write from inside the same parse already read the persona. (2) The
interval between a navigation committing and its `load`. Both are closed by the installed extension's
own per-frame injection, measured in Chrome for Testing and not yet in a user's profile. (3) A
page that beats `document_start` (unchanged). (4) The `RESTORES` WeakRef list grows by ≈150 entries
per installed realm between prunes — bounded, tiny, noted.

**Guards:** `ext/src/same-tick-realm.test.js`, whose rig now hands out a real WindowProxy — a
`Proxy` forwarding to whichever realm is current — with `__navigate(iframe)` swapping the realm
behind it and dispatching `load` along the spec's path (document → … → element, never the window).
Ten tests: the rig's own fidelity (same proxy, new Document, new intrinsics); re-install by the
sweep with no load; by `contentWindow`; the page's own load listener and `onload=`; the door reads
`contentWindow` through the captured getter; a cross-origin frame's document is read exactly once
across 25 insertions; cross-origin-then-back is installed on that load; three doors after a
navigation change no function identity; a load at a non-iframe is ignored; and a navigated-away
realm is not retained — the last one with `gc()` interleaved with event-loop turns, because Node
tears a vm context down in a second-pass weak callback that runs as a task (three back-to-back
collections in one job read 8 of 8 alive in the full file and 0 of 8 alone). `harness/realm-timing.html`
is the browser-side instrument for both residual paths, in page-script and installed-extension modes,
and `harness/unpacked-chrome.mjs` is what loads `ext/` unpacked into Chrome for Testing and drives it
(`smoke` / `timing` / `claim` / `retain`) — the extension-mode and retention numbers above came from
its scratch ancestors, and it reproduces them. 328 → **338**.

**Found with that driver, and NOT D47's — recorded here because this is where it was measured.**
With `ext/` unpacked, `unpacked-chrome.mjs claim` reads **199 lie records, `hasToStringProxy: true`
and a 30-entry `extensionHashPattern`** on both origins — the D32-era signature that page-script mode
reports as 2 / false / empty. `main` at `86a62b3` loaded the same way reads the same. A chain probe
names it: a same-tick child realm's `Function.prototype.toString` applied to the **top** realm's
`Function.prototype.toString` prints `toString() { if (this === getOn || this === getOff) return
NATIVE_SOURCE; …` — `gpc.js`'s own toString wrapper (D38, 2026-09-19). No shim closure knows that
function, so any other realm's mask delegates to its native and prints it, and CreepJS turns one
revealed toString into a `failed toString` lie on every API it audits. The parent's patched getters
stay masked through the parent-closure chain (`childTs_on_topUaGetter: true`); only the second
wrapper leaks. **Decisive:** the same extension with `src/gpc.js` dropped from the manifest reads
**2 / false / 0** on both origins. Not present at D47's base — the pre-D38 `gpc.js` installed no
toString wrapper. The fix belongs to D38's owner and the rule is one toString mask per realm:
install the GPC getters from `shim.js` through `markNative`, or give `gpc.js` a way into
`NATIVE_SRC`. `unpacked-chrome.mjs claim` expecting 2 / false / 0 on both origins is the gate.
