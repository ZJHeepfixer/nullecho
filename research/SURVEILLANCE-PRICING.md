# Surveillance pricing — can a browser extension get you a lower price?

Research file. 2026-08-21.

**Short answer: no, and we should say so.** Surveillance pricing is real as a *market* and
newly real as a *legal* category — the FTC issued a proposed enforcement policy statement on
**2026-08-19**, two days ago. But the measurement literature does not support the claim that
blocking trackers, clearing cookies, using incognito, or changing your fingerprint gets a
consumer a lower price. The best-controlled test that exists points the *other* way, and the
one signal with strong evidence behind it — IP geolocation — is the one signal a WebExtension
cannot reach (`docs/THREAT-MODEL.md`, "Known gaps").

There is still an honest feature here. It is not a savings feature. See §7.

### Confidence in each claim, up front

| Claim | Confidence | Basis |
|---|---|---|
| A market for personalized-pricing tooling exists and is sizeable | **High** | FTC 6(b), compelled documents from 6 named firms, ≥250 client businesses |
| Individual consumers are demonstrably shown different prices *because of their personal data* | **Low** | Every FTC example is hypothetical; the FTC itself says prevalence "is not well understood" |
| Geography (IP/ZIP) changes prices | **High** | Replicated 2012–2025 across independent studies |
| Being logged in changes prices — usually *downward* | **Moderate–High** | Hannak et al. measured $12 cheaper for members |
| Device fingerprint changes prices | **Very low / null result** | Two purpose-built studies found nothing systematic |
| Blocking trackers or clearing cookies lowers prices | **No supporting evidence; one controlled test points the other way** | CR 2016 |
| Looking anomalous can get you worse treatment | **Moderate** | Measured for Tor; inferred for extensions at checkout |
| Consumers may lawfully do this | **High** | FTC's own 2026 statement names VPN/private browsing as legitimate avoidance |

---

## 0. The four things that get conflated

Almost every "surveillance pricing" story collapses on inspection into one of the bottom three.
Keep them apart or the whole analysis rots.

| | Category | What varies the price | Reachable by an extension? |
|---|---|---|---|
| **(a)** | **Personalized pricing** — the actual thing | *This individual's* data: their purchase history, inferred willingness to pay, profile | Partly, in principle. Barely, in practice. |
| **(b)** | **Geographic / ZIP variation** | Where the request comes from (IP, ZIP, store) | **No.** IP is invisible to a WebExtension. |
| **(c)** | **Dynamic pricing** | Market-wide supply and demand, time, inventory | No — nothing about you is an input. |
| **(d)** | **A/B price testing** | A random bucket assignment | No — and a new identity just re-rolls the dice. |

The FTC's August 2026 policy statement draws the same line, and explicitly puts (b) and (c)
outside the concern: "Prices will vary based on changes in supply and demand that affect
everyone participating in the same market… Prices may vary based on regional differences in
taxes, regulations, and market conditions."

**Scorecard for the four cases everyone cites.** Three of the four are not (a):

- **Amazon, 2000** — category **(d)**. A five-day random test on 68 DVDs, discounts randomized
  20–40%. Bezos: *"What we did was a random price test, and even that was a mistake."* He also
  said, on the record, *"We've never tested and we never will test prices based on customer
  demographics."* Amazon refunded 6,896 customers about $3.10 each.
- **Orbitz / Mac users, 2012** — **steering, not pricing.** Orbitz found Mac users spent up to
  30% more per night and were 40% more likely to book 4–5 star hotels, so it reordered
  *recommendations*. Orbitz told the WSJ it was **not showing the same room to different users
  at different prices**, and users could sort by price to defeat it. Orbitz discontinued the
  algorithm after about a month (per Hannak et al. 2014, citing contemporaneous reporting).
- **Staples, 2012** — category **(b)**. Prices keyed to distance from a rival store, derived
  from IP/ZIP. The famous perverse result: *lower* prices went to higher-income areas.
- **Delta / AI pricing, 2025** — **contested and denied.** Delta's president said AI would price
  ~20% of fares by year-end; three senators wrote to the CEO; Delta then told lawmakers *"There
  is no fare product Delta has ever used, is testing or plans to use that targets customers with
  individualized prices based on personal data,"* and that it shares no personal information
  with its vendor Fetcherr. Sen. Gallego's rejoinder — that Delta tells investors one thing and
  the public another — is a fair suspicion, not evidence.

The one recent case that *is* different-price-to-different-people at the same store at the same
time is **Instacart (Dec 2025)** — and even there the mechanism is disputed. See §1.

---

## 1. Is personalized pricing real and documented in 2026?

**As a market and a capability: yes, and well documented.**
**As a measured harm to identifiable consumers: still thin, by the FTC's own admission.**

### The FTC 6(b) study — what it actually found

`ftc.gov` press release 2025-01-17, plus the staff perspective
`p246202_surveillancepricing6bstudy_researchsummaries_redacted.pdf`.

What it establishes, on documents compelled from **Mastercard, Accenture, PROS, Bloomreach,
Revionics and McKinsey & Co.**:

- These intermediaries collectively serve **at least 250 clients** — grocery, apparel, health
  and beauty, home goods, convenience, hardware, general merchandise, plus financial services,
  travel, card issuers, car rental, lease-to-own marketplaces, online casinos and sportsbooks.
- The data inputs named include: geolocation, IP address, device type, browser, language
  settings, purchase history, return history, customer-service history, browsing behaviour,
  demographics, cart-adds and abandonment, scroll depth, video watch percentage, mouse
  highlighting, and **cursor movement toward the tab-close button**.
- Respondents claimed **revenue growth of 2–5%** and **margin increases of 1–4%**.
- Tools split into (1) price targeting, (2) consumer segmentation/profiling, (3) search and
  product ranking.

**What it does not establish, and says so.** Three caveats that matter more than the headline:

1. **Every consumer-facing example in the document is hypothetical.** The FTC's own press
   release: *"the staff perspective only includes hypothetical examples of surveillance
   pricing."* The new-parent thermometer, the reluctant gambler, the flood-zone stress
   supplements, the first-time car buyer — all illustrative constructions, not observed
   incidents.
2. **On effects, the study punts.** Final line of §5: *"In terms of broader, more definitive
   impacts to prices or market participants, this area of study is still underway."*
3. **Several respondents objected to the framing** — they "objected to the characterization
   that the tools they offered were designed or used to set individualized prices."

It also went out **3–2**, over a dissent from Ferguson and Holyoak arguing that releasing staff
early impressions "degrades the Commission's Section 6(b) process." Ferguson then became Chair
and **closed the public comment docket about two months early**. The full 6(b) study has never
been completed or published. That is a real fact about the strength of the evidence base and we
should not launder it.

### The 2026 turn — this got legally live two days ago

**FTC Proposed Enforcement Policy Statement Regarding Personalized Pricing, dated 2026-08-19**,
released for comment 2026-08-21, Commission vote 2–0
(`p034101-ftc-enforcement-policy-statement-re-personalized-pricing-proposed-for-public-comment.pdf`).

Its logic, which is directly useful to us:

- Congress has **not** given the FTC power to ban personalized pricing. The theory is
  **disclosure**: where consumers reasonably expect a posted price not to vary by their personal
  data, failing to *clearly and conspicuously* disclose that a price is personalized, **the basis
  for the personalization, and the types of data used**, "is likely to constitute an unfair or
  deceptive act or practice in violation of Section 5."
- **The FTC's own statement of the harm is the absence of consumer tooling.** Two passages,
  quoted because they are the single best external validation of an educational feature:

  > "consumers who are unaware of personalized pricing cannot take steps to avoid the higher
  > prices that may result from it, such as **using a virtual private network or private
  > browsing functionality**, choosing a different retailer whose prices are static or widely
  > offered, rather than personalized, or simply declining to complete the transaction."

  > "consumers may not be able to avoid paying the higher personalized price if they lack the
  > **information or tools** necessary to, among other things, modify their behavior to avoid
  > triggering higher prices, dispute or correct inaccurate information collected about them
  > that is leading to higher prices, or **avoid the collection of that data in the first
  > place**."

- And, crucially for our honesty rules, the FTC concedes the empirical position: **"The extent
  to which businesses currently use personalized pricing is not well understood, and the effects
  of personalized pricing on consumers are unclear."**

That last sentence is the FTC, in 2026, saying what §3 of this document says. Cite it whenever
someone accuses us of underselling the problem.

**Skeptical read of the 2026 statement**: a proposed policy statement is not a rule and not an
enforcement action. It is 30 days of comment on a document that says the agency intends to
enforce existing law. The American Prospect ran a piece the same day titled *"FTC Says It Will
Enforce Surveillance Pricing. It Won't."* (2026-08-21) — I could not fetch it (403) and have
**not verified its argument**; flagging it so we don't cite what we haven't read.

### Legislation

- **New York, GBL § 349-a — in force.** Any entity using "personalized algorithmic pricing"
  must display, clearly and conspicuously: **"THIS PRICE WAS SET BY AN ALGORITHM USING YOUR
  PERSONAL DATA"**. Civil penalty up to $1,000 per violation, AG-enforced, cease-and-desist and
  cure period first. Exemptions for insurance, GLBA-regulated financial institutions, and
  subscription contracts priced below standard terms. Enacted in the FY2026 budget in May 2025
  with an original effective date of 2025-07-08; the NRF sued on First Amendment compelled-speech
  grounds, **Judge Rakoff (S.D.N.Y.) granted the motion to dismiss on 2025-10-08** — holding the
  mandated statement "factual and uncontroversial" — and denied the injunction as moot.
  **Enforcement began 2025-11-10.**
- **California AB 446 (2025) — failed.** Narrowed under industry pressure, did not pass.
- **California AB 2564 (2026) — live right now.** The "End Surveillance Pricing Act." Passed the
  Assembly 2026-05-27; second reading, ordered to third reading as of **2026-08-18**. Not
  signed. Co-sponsored by Consumer Reports.
- Colorado HB 1264 (2025) covered surveillance pricing *and* surveillance wages. CR counted
  **13 state bills** on surveillance pricing introduced in 2025.

### The strongest recent case, and why it still isn't clean

**Instacart, December 2025.** Consumer Reports with Groundwork Collaborative and More Perfect
Union: ~400 consumers shopped the same basket at the same time; **~75% of grocery items were
offered at different prices** to different customers buying from the same store at the same
time, variation up to **23%**, extrapolated to >$1,200/year for a family. Instacart ended the
program on 2025-12-22, saying the tests "missed the mark," while **disputing the framing and
stating it does not use customers' personal information, including demographic or behavioral
data, to set prices**. House Oversight opened an investigation.

So: real price variation between real people, confirmed, at scale — but characterized by the
operator as **retailer-run A/B price testing**, i.e. category (d). If that characterization is
right, a privacy tool does nothing about it; you'd just be re-rolling a random bucket. Nobody
has published a mechanism finding either way. **This is the most important open question in the
whole area and it is unresolved.**

---

## 2. What signals actually drive price differences — ranked by evidence

Ranked by strength of *published measurement*, not by how often the signal gets mentioned.

| Rank | Signal | Evidence | Extension reach |
|---|---|---|---|
| **1** | **IP / geolocation** | **Strong, repeatedly replicated.** Mikians 2012 (Amazon Kindle ≥21% and up to 166%; Steam 20% of titles; Staples up to 11% within one state across 200 ZIPs). Princeton Review 2015: 32,989 ZIPs queried, three price tiers, $2,760 / $3,000 / $3,240 for the identical online SAT package. Iordanou 2017 found cross-border PD. SFGate 2025 reported $200–$511/night hotel swings on IP change. | **None.** Unreachable from a WebExtension. |
| **2** | **Logged-in account / loyalty ID** | **Strong — and it usually makes prices LOWER.** Hannak 2014: Cheaptickets and Orbitz gave logged-in members hotels **$12 cheaper on average** ("Members Only" prices). FTC 6(b) names purchase history and loyalty as core inputs. Kroger builds 62-page profiles of loyalty members (CR, May 2025) but denies personalizing *prices*. | **None**, by design. `THREAT-MODEL.md`: "A logged-in account… you are identified by the login." |
| **3** | **Referrer / arrival path** | **Moderate, one solid finding.** Mikians 2012: arriving at shoplet.com via the nextag.com aggregator produced **23% lower** prices than arriving direct, because the aggregator sets a cookie mid-redirect. This is the only browser-side lever with a measured downward effect — and it works by **adding** a commercial signal, not removing one. | Technically yes. **We should not.** See §7. |
| **4** | **Device type / OS** | **Weak and directionally confusing.** Hannak 2014: Travelocity gave **iOS users lower** prices (no visual cue); Home Depot's Android delta averaged **$0.41**. Travelocity told the researchers the discount was for all mobile, not iOS. Orbitz never varied the price of the same room by OS. Hupperich et al. found UA changes moved prices in **0.10–0.95%** of cases. | Yes — and the evidence says it buys ~nothing, or points the wrong way. |
| **5** | **Language / locale** | **Weak.** Hupperich et al.: language settings were, with UA, "the most influential of all features" — but in **8.88%** of cases at best, usually far under 1%, and non-systematic. Confounded with currency conversion. | Yes. Also a breakage and consistency risk (D2). |
| **6** | **Cookies / third-party profile data** | **Weak to null, and this is the crux — see §3.** | Yes — this is Nullecho layer 1. |
| **7** | **Browser fingerprint** | **Null.** Mikians 2012, 8 system/browser setups, 600 products, 20,000 measurements: *"The measurement did not reveal any price differences between the end systems."* Hupperich et al. 2018, purpose-built fingerprint-spoofing scanner: *"we could not prove the existence of such a system for the examined providers."* Screen resolution / vendor / plugins moved prices ~0.06%. | Yes — this is Nullecho's whole shim. **It is the signal with the strongest null result.** |
| **8** | **Cart abandonment, dwell time, mouse movement** | **Asserted by vendors, never independently measured.** The FTC's cursor-toward-the-close-button example is a *hypothetical* built from vendor documents. | Partly (blocking session-replay vendors). Unmeasurable outcome. |
| **9** | **Time of day** | Real for dynamic pricing, category (c). Not about you. | No. |

**The shape of this table is the finding.** Evidence strength runs almost exactly *inverse* to
extension reach. Everything we can touch has weak or null evidence; everything with strong
evidence is out of reach.

### What our own blocklists actually reach — measured, 2026-08-21

I grepped `ext/rules/*.json` (176 rules total: ads 81, social 41, analytics 35, fingerprinting
18, gpc 1) against the vendors this area actually involves.

**Pricing intermediaries: zero coverage, and that is correct.** No rule matches Bloomreach,
Revionics, PROS, Mastercard, Dynamic Yield, Monetate, RichRelevance, Certona or Qubit. **This is
not a gap to fix.** The FTC's 6(b) respondents sell *server-side* B2B pricing engines. The
retailer calls them from its own backend; nothing loads in the browser; there is no request for
`declarativeNetRequest` to block. **An extension cannot block a pricing decision — only some of
its inputs.**

**Behavioural inputs: good coverage, and this is the real overlap.** The FTC named mouse
movement, scroll depth, video watch percentage, text highlighting and cursor-toward-close as
inputs. Those are collected by session-replay vendors, and we block 13 of 14 checked: Hotjar,
FullStory, Quantum Metric, Contentsquare, Mouseflow, Microsoft Clarity, Glassbox, Smartlook,
LogRocket, Inspectlet, Crazy Egg, Lucky Orange, SessionCam (Decibel: not covered).

So the honest mechanism statement is: **Nullecho cuts off some third-party behavioural telemetry
that the FTC identified as an input to these systems. It cannot observe or affect what the
retailer does with its own first-party data, and it cannot reach the pricing engine at all.**
That is a real, describable, testable effect on *collection*. It is not an effect on *price*, and
we have no way to measure one.

---

## 3. The crux: does blocking/clearing/incognito actually get a lower price?

**No credible evidence says yes. The best-controlled test says the opposite.**

### The controlled tests

**Consumer Reports, 2016 (William J. McGee).** The best-designed public test I could find.
**372 simultaneous searches**, nine ticketing sites, four sets of searches on different days and
times, **two browsers — one with a rich cookie history, one scrubbed clean**. Results:

- Prices identical in **~88%** of pairs.
- **42 pairs differed.** Of those, **59% showed the HIGHER fare on the scrubbed browser.**
- Secondary aggregate widely reported: incognito cheaper 7%, more expensive 5%.
- McGee's own hedge: *"This is a very opaque industry"* — he could not attribute the differences
  to browser history, and CR's advice was to search multiple times on multiple browsers, not to
  clear cookies.

*Caveat: I verified the 372/nine-sites/59% figures via Time's contemporaneous write-up of the CR
study and CR's own airfare guidance page. I could not open the original CR article (paywall).
The frequently-repeated "$84 cheaper at the extremes" detail traces only to SEO blogs — do not
use it.*

**Vissers, Nikiforakis, Bielova & Joosen, "Crying Wolf? On the Price Discrimination of Online
Airline Tickets," HotPETs 2014.** Three weeks, 25 airlines, **66 user profiles**, two
geographies, **>130,000 automated queries**. *"Despite presenting the companies with multiple
opportunities for discriminating us, and contrary to our expectations, we do not find any
evidence for systematic price discrimination."* They attribute observed variation to volatility
and regional tax.

**Iordanou, Soriente, Sirivianos & Laoutaris, "Who is Fiddling with Prices?", SIGCOMM 2017** —
the Price $heriff. Deployed for months with ~1,000 real users, tunnelling price checks through
peers' browsers. Found **cross-border** PD. Within borders they found retailers returning
different prices to different users and concluded the differences were **A/B testing, not
personal-data-induced discrimination.** The conference live-blog records the slide bullet: *"No
price variation based on personal data can be observed."*

**European Commission, "Consumer market study on online market segmentation through personalised
pricing/offers in the EU" (2018).** Mystery shopping across **160 e-commerce sites**, 8 member
states, 4 sectors (TVs, sport shoes, hotels, airline tickets). **Price differences in only 6% of
tests; median difference under 1.6%.** But **61% of sites personalised the *ranking* of offers**
based on access route or past behaviour. Same shape as Hannak: steering is common, price
personalization is rare and small.

**Hannak, Soeller, Lazer, Mislove & Wilson, IMC 2014** — the canonical paper, 16 sites, 300 real
AMT users' cookies and accounts plus controlled synthetic treatments. Personalization on 9 of 16
sites. But read the direction of every price finding: **logged-in members paid less; iOS users
paid less; Android differed by $0.41; Priceline reordered on click history without any price
effect; Expedia and Hotels.com were running A/B tests.** Not one finding says "a cleaner browser
paid less."

### The airline/incognito folk belief

Repeatedly tested, never supported. Kayak's own statement: partners "only see the search coming
from KAYAK itself, not from any specific individual… unaware of your device, search history,
location or any other personal details." FareCompare's Rick Seaney: prices change from
"inventory updates or glitches," not search history. The mechanism people believe in — *the site
saw you search twice so it raised the price* — has never been demonstrated in a controlled test.

### The state of the field, stated plainly

The serious measurement work is **2012–2018 and then it stops.** Mikians (2012/2013), Hannak
(2014), Vissers (2014), Princeton Review (2015), Iordanou (2017), Hupperich (2018), EC (2018). I
found no comparable large-scale field measurement after that. The 2019–2026 literature is
overwhelmingly *theoretical* (welfare models: Dubé & Misra JPE 2023, Rhodes & Zhou AER 2024,
Buchholz et al. Econometrica 2025) or *attitudinal* (fairness surveys). Even the FTC's 2026
statement cites theory, not field measurement, and concedes prevalence "is not well understood."

**So the honest position is not "personalized pricing isn't real." It is: the practice is
documented on the sell side and barely documented on the buy side, the last serious buy-side
measurement is eight years old, and no measurement of any vintage supports the claim that
browser-side privacy measures lower prices.**

---

## 4. The opposite risk — does looking "private" cost you?

**Yes — the evidence for a privacy penalty is stronger than the evidence for a privacy discount.**
That asymmetry is the single most decision-relevant fact in this document.

1. **The measured direction of every price finding in the literature favours the *less* private
   state.** Logged-in was $12 cheaper (Hannak). Scrubbed browser was more expensive in 59% of
   differing pairs (CR 2016). New-visitor discounts exist too, but nobody has measured which
   dominates. A tool that promises savings therefore has a real chance of costing the user money
   — and a real chance of a reviewer proving it in one afternoon.
2. **Anonymity-set inversion.** This is already in `docs/THREAT-MODEL.md` via the Arkenfox
   response (D11): an anti-fingerprinting extension adds an "is running an anti-fingerprinting
   tool" bit, and 2 of 9 adversarial detectors fire against our own shim. Whatever that costs a
   user, it is *added* by us, and it is real, not hypothetical.
3. **Differential treatment of anonymous users is measured.** Khattak et al., *"Do You See What
   I See? Differential Treatment of Anonymous Users,"* NDSS 2016: **3.67% of the Alexa top 1,000**
   blocked or degraded service for Tor users, ranging from outright rejection to CAPTCHA walls
   and feature restriction. That is a network-layer finding about Tor, not about extensions — do
   not overstate the transfer — but it establishes that the phenomenon is real and quantified.
4. **The checkout is the worst possible place to look anomalous.** Payment fraud scoring runs at
   exactly the moment a "clean shopping session" would be active. A declined order costs the
   user far more than a few dollars of hypothetical price delta.
   ⚠️ **This one is an inference, not a citation.** It is well known that fraud-scoring vendors
   use device fingerprints and treat inconsistency as signal, but I did not verify a specific
   vendor document stating that a privacy extension raises a risk score, and I found no measured
   rate of legitimate orders declined for this reason. Do not state it in product copy as fact.
   It is strong enough to justify *not* building (c); it is not strong enough to publish.

**Asymmetry of consequences.** The upside of a savings feature, if the literature is right, is
approximately zero. The downside is a declined transaction, a locked account, a CAPTCHA wall, or
a genuinely higher price. **A feature with a zero-ish upside and a non-zero downside is a
negative-expected-value feature even before you count the reputational cost of the claim.**

---

## 5. Legal and ethical status

**Clearly legal: changing your own browser.** The strongest available citation is the FTC's own
2026 policy statement, which names *"using a virtual private network or private browsing
functionality"* as a legitimate consumer step to avoid personalized prices — the agency's theory
of consumer harm is that people are *prevented* from doing this by non-disclosure. You cannot
ask for a better regulator endorsement than "the harm is that consumers can't do the thing."

**California CCPA/CPRA § 1798.125** additionally bars a business from discriminating against a
consumer — including by charging different prices — for exercising privacy rights, with a carve-
out for genuine, opt-in financial-incentive and loyalty programs. Note the limit: it attaches to
*exercising a statutory right*, not to merely blocking cookies. **GPC is the bridge** — sending
`Sec-GPC: 1` is a recognised exercise of the CCPA opt-out right in California (D6), which is a
reason our GPC feature is more legally substantive than our fingerprint work.

**The sharp line — what is NOT ok, and we must never help with:**

| Not ok | Why |
|---|---|
| Claiming a student / military / senior / employee discount you don't qualify for | Misrepresentation of a material fact to obtain a price — fraud, plainly, regardless of technique |
| Reusing single-use or stolen promo codes; coupon fraud | Same |
| Spoofing geography to claim a regional price | Breach of contract at minimum; misrepresentation if an eligibility attestation is involved |
| Hidden-city / throwaway ticketing | Contractually prohibited by every major carrier; *actually litigated* — this is the one area where sellers do sue |
| Automating a merchant's or platform's account UI | Trips bot detection and risks the user's account (already our D5 reasoning for vendor opt-outs) |

The distinction to hold onto: **removing a signal about yourself is shopping. Asserting a false
fact about yourself is fraud.** Nullecho only ever does the first, and any pricing feature must
stay on that side of the line by construction, not by policy.

**On merchant terms of service.** Retailer and OTA terms routinely prohibit automated access,
scraping, and circumventing technical measures. Those clauses are aimed at bots and competitors.
I found **no case of a merchant taking action against an individual consumer for shopping with
cookies cleared, in private browsing, or with a privacy extension** — the litigation in this
space is against *scrapers* (hiQ, Skiplagged) and *resellers*, not shoppers. Two limits on that
finding, stated because absence of evidence is not proof: (1) most such disputes would resolve as
a silent account action, never a filing, so a search of case law would not see them; (2) after
*Van Buren v. United States* (2021), a plain terms-of-service violation is not by itself a CFAA
offence, but that case is about *authorised access to a computer*, not about price shopping, and
I would not represent it as controlling here.

The practical exposure is therefore contractual and account-level, not criminal — and for the
narrow acts Nullecho performs (blocking third-party requests, varying a fingerprint, sending
GPC), essentially nil. **Note that GPC runs the other way entirely: it is a signal the law
obliges some merchants to honour, not one they may penalise you for.**

---

## 6. Has anyone built this?

**Research tools, both essentially abandoned:**

- **Price $heriff / $heriff_v2** (Iordanou et al., Telefónica/UC3M/CUT). A Chrome and Firefox
  extension: you select a price on the page and it re-queries the URL through PlanetLab proxies
  and peer browsers with varied User-Agents and locations, then reports differences. The service
  host still answers HTTP (`sheriff-v2.dynu.net`) but loads jQuery over plain HTTP from a 2012-era
  CDN path — it is a research artifact, not a maintained product. **Its published conclusion was
  a null result for personal-data-driven pricing.**
- **Northeastern's price-discrimination extension** (Hannak's group, announced Dec 2016),
  supporting Amazon, Google Flights and Priceline Hotels, comparing your price against a
  server-side control. No evidence of ongoing maintenance.

**Consumer tools that touch this space but claim something else:** uBlock Origin, Privacy Badger
and the rest never claim price effects. Coupon extensions (Honey, Capital One Shopping) *do*
change prices, by applying codes and by rewriting affiliate attribution — the latter produced
the December 2024 "cookie stuffing" scandal and class actions from creators. **That is the
cautionary tale for any referrer-manipulation idea (signal 3 in §2): the mechanism that
demonstrably lowers a price is affiliate-cookie mechanics, and the tool that did it at scale is
now a byword for a scam.**

**Anything claiming to defeat personalized pricing by masking your identity:** I found no
established product making that claim. I saw a single syndicated press-release-grade mention of
"startups launching extensions that use AI to mask your digital footprint or simulate multiple
shoppers." **I could not verify that any such product exists** and it should not be treated as a
fact or as competitive evidence.

**Nobody has debunked such a tool, because nobody credible has shipped one.** That cuts both
ways: no incumbent to displace, and no prior art proving it can work.

---

## 7. Recommendation

**Ranked: (b) yes, narrowly scoped. (a) is the acceptable fallback. (c) is a trap — do not
build it. (d) has one component worth adding.**

### Why (c), the "clean shopping session," must not ship

Five independent reasons, any one of which is sufficient:

1. **It promises the exact mechanism the evidence refutes.** The only controlled test of a
   scrubbed browser found it *more expensive* in 59% of differing pairs.
2. **It cannot touch the one signal that works.** Every strong finding is IP/geography. We
   cannot reach IP. A "clean session" that leaves your IP untouched has removed signal #7 and
   left signal #1 intact.
3. **It contradicts our own architecture.** D2 makes personas per-origin *stable*, and
   `THREAT-MODEL.md` states as an explicit non-goal that Nullecho does not try to make you
   unrecognisable to a site you're actively using. A "fresh identity at checkout" mode is that
   non-goal, shipped. Our salt rotation is global — rotating for one shopping trip re-rolls
   every site's persona.
4. **It aims the anomaly at the checkout**, which is where fraud scoring lives and where the
   downside is a declined order, not a lost dollar.
5. **It is trivially falsifiable by the audience.** r/privacy will A/B it against a control
   browser within the hour, find 88% identical prices, and the *whole product's* honesty
   position — which is its actual differentiator — dies with the claim.

### What to build: the Checkout Report (option b), plus one novel element

This is not a new subsystem. `ext/src/linkage.js` already produces `siteReport()` — "what THIS
site does to whoever visits it" — and its module docs already enforce the exact honesty
discipline this feature needs: it reports *capability* (`couldLink`, `present`, `attempted`) and
never *outcome* (`they know`, `tracked you across`), with tests enforcing it. A pricing surface
is a **view** over that, triggered on commerce pages.

Report, for the page in front of the user:

1. **Which named companies the page contacted** before showing a price, and which were blocked.
   Counts and company names only (D10 — site identities never leave the device).
2. **Which fingerprinting surfaces the page read** — canvas, WebGL, fonts, audio — as *attempted
   reads*, not as "they identified you."
3. **Whether GPC was sent** to this origin. This is the one lever with statutory teeth (D6).
4. **NOVEL, and the reason this feature is worth shipping: detect New York GBL § 349-a.** The
   statute mandates a fixed string — **"THIS PRICE WAS SET BY AN ALGORITHM USING YOUR PERSONAL
   DATA"**. That is machine-detectable in a content script with near-zero false positives. No
   other tool does this. It converts a legal fact into a user-visible one, and it works
   nationwide as a *detector* even though the mandate is New York's.
5. **Every finding ends in a named remedy** (D10) — and where the remedy is outside our reach,
   say so and name what does reach it (VPN for IP; a different retailer; comparison shopping).

**Why this is defensible where a savings claim is not:** every element is something we
*observed*, on the user's own machine, and can prove with a screenshot. None of it requires a
counterfactual price we cannot obtain.

**The falsifiable bonus.** §3 established that the field has no post-2018 buy-side measurement.
If we instrument §349-a detection across users who opt in, we can publish the first data on
whether the disclosure ever appears in the wild. That is a real research contribution, it is
shareable under D10's rules (it reveals *retailers*, not users), and **a null result is still a
publishable result** — which is the only kind of claim this project should be making bets on.

### Exact wording we can defend

Product one-liner:

> **Nullecho shows you which companies a shopping page contacted before it showed you a price,
> which fingerprinting surfaces it read, and whether the page carried the personalized-pricing
> disclosure New York law requires. It does not lower prices — and we found no credible evidence
> that any browser extension can.**

The explainer paragraph, for the options page / FAQ / store listing:

> Retailers do use personal data to set prices — the FTC's 2025 study found intermediaries
> selling these tools to at least 250 businesses, and the FTC proposed an enforcement policy on
> it in August 2026. But the strongest documented price signals are your IP address and your
> logged-in account, and a browser extension can reach neither. In the one controlled test we
> could find, a browser with cookies cleared got the *higher* fare 59% of the time when fares
> differed at all. So Nullecho will not tell you it saves you money. It tells you what the page
> did, and leaves the conclusion to you.

Add to the banned-phrases list in `docs/THREAT-MODEL.md`:

> Never ship: **"saves you money"**, "get a lower price", "beat surveillance pricing", "stops
> retailers from raising your price", "shop anonymously", or any before/after price figure we
> did not measure under control. If a price claim cannot be reproduced by a stranger with a
> second browser, it does not ship.

### The gate to run before building any of this

Everything novel in the proposal rests on one unverified empirical assumption: **that the New
York disclosure string actually appears somewhere.** The law has been enforceable since
2025-11-10, but I have not confirmed a single live page carrying it, and it is entirely possible
that retailers responded by *not personalizing* rather than by disclosing — which would be a
policy success and a product dead end simultaneously.

**Cheap test, do it first:** fetch the checkout and product pages of 50–100 large US retailers
and grep for the mandated string (and near-variants). Half a day of work.

- **Found on a meaningful number of sites** → build the detector, it is genuinely novel.
- **Found on none** → that is itself a publishable finding ("New York's pricing-disclosure law
  has been in force for nine months and we could not find a single site complying"), and it is a
  better story than the feature would have been. Ship the finding, not the feature.

Either branch produces something honest. That is the test of a good gate.

### What (a) — do nothing — would cost

Only the New York disclosure detector. Everything else in the Checkout Report is a re-skin of
`siteReport()`. If the detector turns out to fire on zero sites in testing, ship nothing here and
lose nothing.

---

## Appendix: source list

**Primary — government**
- FTC, *Proposed Enforcement Policy Statement Regarding Personalized Pricing*, 2026-08-19 (comment sought 2026-08-21, vote 2–0) — `ftc.gov/system/files/ftc_gov/pdf/p034101-ftc-enforcement-policy-statement-re-personalized-pricing-proposed-for-public-comment.pdf`
- FTC, *Surveillance Pricing 6(b) Study: Research Summaries — A Staff Perspective*, Jan 2025 — `ftc.gov/system/files/ftc_gov/pdf/p246202_surveillancepricing6bstudy_researchsummaries_redacted.pdf`
- FTC press release, 2025-01-17, *"…Wide Range of Personal Data Used to Set Individualized Consumer Prices"* (vote 3–2; Ferguson & Holyoak dissent)
- FTC staff, *Issue Spotlight: The Rise of Surveillance Pricing* — `ftc.gov/system/files/ftc_gov/pdf/sp6b-issue-spotlight.pdf` (staff list includes Alan Mislove, co-author of Hannak et al. 2014)
- N.Y. Gen. Bus. Law § 349-a; *NRF v. James*, S.D.N.Y., motion to dismiss granted 2025-10-08
- Cal. AB 446 (2025, failed); Cal. AB 2564 (2026, in Senate); Colo. HB 1264 (2025)
- Cal. Civ. Code § 1798.125

**Primary — measurement**
- Mikians, Gyarmati, Erramilli & Laoutaris, *Detecting price and search discrimination on the Internet*, HotNets 2012
- Hannak, Soeller, Lazer, Mislove & Wilson, *Measuring Price Discrimination and Steering on E-commerce Web Sites*, IMC 2014
- Vissers, Nikiforakis, Bielova & Joosen, *Crying Wolf? On the Price Discrimination of Online Airline Tickets*, HotPETs 2014
- Vafa, Haigh, Leung & Yonack, *Price Discrimination in The Princeton Review's Online SAT Tutoring Service*, Technology Science, 2015-08-31
- Iordanou, Soriente, Sirivianos & Laoutaris, *Who is Fiddling with Prices?*, SIGCOMM 2017
- Hupperich, Tatang, Wilkop & Holz, *An Empirical Study on Price Differentiation Based on System Fingerprints*, arXiv:1712.03031
- European Commission / LE Europe, *Consumer market study on online market segmentation through personalised pricing/offers in the EU*, 2018
- Khattak, Fifield, Afroz et al., *Do You See What I See? Differential Treatment of Anonymous Users*, NDSS 2016
- Consumer Reports (McGee), 372-search cookies-vs-scrubbed airfare test, 2016

**Secondary / journalism**
- Mattioli, *On Orbitz, Mac Users Steered to Pricier Hotels*, WSJ 2012-08-23 (and AllThingsD 2012-06-26)
- Valentino-DeVries, Singer-Vine & Soltani, Staples ZIP-code pricing, WSJ 2012-12-24
- Amazon random price test, Sept 2000 (CNN/Reuters; Amazon press statement)
- Consumer Reports, *Inside Kroger's Secret Shopper Profiles*, 2025-05-21
- Consumer Reports / Groundwork / More Perfect Union, Instacart pricing investigation, Dec 2025; Instacart response 2025-12-22
- Delta / Fetcherr: senators' letter July 2025; Delta's denial to lawmakers (NBC News)
- Consumer Reports, *Surveillance Pricing: The Problem for Consumers*, Aug 2025

**Explicitly NOT relied on**
- The dozens of SEO travel blogs on "incognito flights." They recycle the Consumer Reports 2016
  numbers with drift and invented details.
- The American Prospect, 2026-08-21 (403, unread).
- Any claim that startups ship "AI footprint masking" shopping extensions — unverified.
