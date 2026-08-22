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
statute text 2026-08-21). **The detector must match a FAMILY of strings case-insensitively, not one
literal** — and real implementations bury/re-case them (WSJ all-caps standalone; Instacart lowercase
mid-sentence):
- **NY GBL §349-a** (law 2025-07-08, *enforced 2025-11-10* after the NRF dismissal): `THIS PRICE WAS
  SET BY AN ALGORITHM USING YOUR PERSONAL DATA`
- **MD Com. Law §13-322** (eff. 2026-10-01): `THIS PRICE WAS SET BY AN ALGORITHM OR BY USING YOUR
  PERSONAL DATA`
- **CT PA 26-64 §11(b)** (eff. 2026-10-01): `THIS PRICE WAS INCREASED BY A PRICE SETTING DEVICE USING
  YOUR PERSONAL DATA` — ⚠️ **note "PRICE SETTING DEVICE", NOT "an algorithm"** (widely misreported),
  and CT is the **only** state whose string is not fixed: the statute permits "a substantially
  similar disclosure", so an exact-string matcher will miss compliant CT notices.
- **NJ Fair Price Protection Act** (~2027): groceries-only *ban*, not a disclosure string.

Match on the stable core substrings (`set by an algorithm`, `price setting device`, `using your
personal data`) case-insensitively — statutorily fixed → near-zero false positives. **No compliance
SaaS exists** (unlike cookie banners); every instance is hand-written, so text matching is the only
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
- ⏰ **California AB 2564 faces an 2026-08-31 floor deadline** — would be a 5th state / 4th ban.

**📌 Scope note (Jason, 2026-08-21):** California pricing legislation is **deprioritized** — he will
handle that with counsel. It imposes nothing on Nullecho either way: these statutes bind *businesses
that set prices*, not browser extensions. The only contact point is the Checkout Report's detector
string list, which is a maintenance item.

⚖️ For whoever picks this up: do not assume these laws will be struck down. NRF's First Amendment
challenge to NY §349-a was **dismissed** (Judge Rakoff, Oct 2025) under *Zauderer* — the mandated
string was held "factual and uncontroversial," which draws lenient review, not strict scrutiny.
On appeal to the 2d Cir., **argument not yet held** as of 2026-08-21. Treat the outcome as open.

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
