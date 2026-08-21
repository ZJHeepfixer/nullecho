# NY GBL §349-a compliance sweep — is anyone actually showing the disclosure?

Empirical gate for the Checkout Report §349-a detector. 2026-08-21.

**Bottom line: the disclosure is real and appearing in the wild — but the complying category is
digital-subscription publishers, not general retail, and its main habitat is renewal *emails*, which
a content script can't see.** The mandated string is machine-detectable with near-zero false
positives. **Build the detector** — it is genuinely novel and the string demonstrably fires on named
companies — but scope it honestly: it will catch subscription/account/renewal *web* pages and
Instacart-style pricing-policy pages, and it will find near-zero compliance on Amazon/Walmart-type
product pages. There is **no compliance-vendor ecosystem** (no OneTrust equivalent); every
implementation found is bespoke, so **text matching is the only viable detection method, and it is
sufficient.**

## 1. Statutory text — nailed (not the paraphrase)

Triangulated across FindLaw (codified), NY Senate codified laws, and the AG's own Jan-2026 letter,
which quotes the section verbatim.

- **Exact mandated string (no period in statute, quoted in caps):**
  **THIS PRICE WAS SET BY AN ALGORITHM USING YOUR PERSONAL DATA**
- **Only one form.** No official short/long variant. "Clear and conspicuous" governs *placement and
  legibility*, not the words.
- **"Personalized algorithmic pricing"** = "dynamic pricing set by an algorithm that uses personal
  data." **"Dynamic pricing"** = "pricing that fluctuates dependent on conditions." **"Personal
  data"** = "any data that identifies or could reasonably be linked, directly or indirectly, with a
  specific consumer or device." §349-A(1)(a),(d),(e),(f).
- **Applies to:** any entity domiciled or doing business in NY that sets a price with personalized
  algorithmic pricing **and** advertises/promotes/labels/publishes that price to a NY consumer using
  that consumer's personal data. The disclosure must be "on, at, or near and contemporaneous with"
  *every* price display. §349-A(2).
- **Exemptions:** insurance-regulated entities; GLBA/Title-V financial institutions; NY Financial
  Services Law §801(f) institutions; for-hire-vehicle location data used solely for mileage/duration
  fare; subscription prices *lower* than the customer's contract price. No numeric threshold.
- **Penalty:** ≤ $1,000/violation, AG-only (no private right), cease-and-desist + cure first.
  Effective **2025-11-10**.
- ⚠️ **Do not confuse with A9349** (2025–26 session): a *separate, more aggressive proposed bill*
  that would *prohibit* personalized pricing and change the wording. It is **not enacted**; the
  codified §349-a string above is unchanged.

## 2. The detection-critical nuance: formatting varies

The statute prints the string in caps, but real implementations embed it, re-case it, and wrap it.
Observed forms:

- **Standalone caps** (Wall Street Journal renewal email): `THIS PRICE WAS SET BY AN ALGORITHM USING YOUR PERSONAL DATA.`
- **Caps with a NY-resident preamble** (Wired, The New Yorker, Albany Times Union renewals):
  `NEW YORK RESIDENTS: PLEASE NOTE THAT WE ARE REQUIRED TO INFORM YOU THAT THIS PRICE WAS SET BY AN ALGORITHM USING YOUR PERSONAL DATA.`
- **Lowercase, buried in a longer sentence** (Instacart pricing-policy page, quoted by the AG):
  `...we offer certain personalized incentives: this price was set by an algorithm using your personal data.`

**Implication:** a detector that requires the exact standalone all-caps string would miss two of the
three real implementations. Match the core substring **case-insensitively**:
`set by an algorithm using your personal data`.

## 3. Who is actually complying (observation)

**Confirmed showing it (digital subscriptions):** Wall Street Journal, Wired, The New Yorker, Albany
Times Union, NJ.com — documented in Nieman Journalism Lab, 2026-07-22, "This price was set by an
algorithm," with the verbatim renewal-notice wording above. Renewal/win-back pricing keyed to your
account is textbook personalized pricing; publishers append the line to the renewal email (and,
inferred but not individually verified, the web renewal page). **This is the strongest signal: a
whole category is complying.**

**Attempted, ruled inadequate (observation, primary source):** Instacart. NY AG's 2026-01-08 letter
to Maplebear/Instacart (read in full) quotes Instacart's live fine-print-linked disclosure carrying
the mandated string, but the AG says it fails "clear and conspicuous" and is **absent on category and
product pages**. Link labels were "View pricing policy" (Stop & Shop), "Higher than in-store prices"
(Wegmans), "Pricing & fees" (Costco). Instacart ended item price tests 2025-12-22, so this instance
may since be gone (inference).

**General retail / travel / ticketing — could not find it.** Reverse web-searching the mandated
string across the whole index surfaced *only* the publishers, Instacart, and law-firm explainers —
no Amazon/Walmart/airline/hotel/OTA/ticketing hit. Consistent with the compliance-counsel advice I
read (Proskauer, Skadden, Duane Morris): retailers are being told to **avoid triggering** the law by
pricing on non-personal/generalized data rather than to disclose. So "not found" here plausibly means
"not personalizing," a policy win and a product dead-zone at once.

**Direct page fetches (method note).** Bot protection made a 40–70-site product-page sweep
low-yield, so I combined ~14 representative fetches with reverse string-searches over the full web
index (a stronger sweep than individual fetches). Real page text retrieved, **string absent**:
Ticketmaster, Uber price-estimate (surge described, no disclosure), Kayak, StubHub, Instacart help.
**Could NOT verify** (CAPTCHA/403/429/500/timeout — honest gaps, mostly behind bot-walls or
login/geo): Amazon, Walmart, Best Buy, Expedia, Booking, DoorDash, SeatGeek, WSJ checkout. No
logged-in NY-geo checkout flow was reachable — the exact place a personalized price would render.

## 4. Technical signal / vendor question

**No compliance-SaaS signature exists (observation of absence).** Searches for a §349-a disclosure
widget/vendor, and for subscription platforms (Piano, Zuora, Recurly) shipping a disclosure feature,
returned nothing. Unlike cookie banners (OneTrust/TrustArc), there is **no shared script, aria-label,
data-attribute, or CSS-class convention** to fingerprint. Every instance is hand-written legal copy.
Therefore **detecting the disclosure = matching its text.** That is also good news: the phrase is
statutorily fixed and distinctive, so text matching gives near-zero false positives without needing a
vendor to standardize anything.

## 5. Recommendation

**Build the §349-a detector — yes.** The gate passes: the string is not hypothetical, it fires on
multiple named companies, and no other tool surfaces it. Pair the feature with the documented
finding — "nine-plus months in force; the only web complier we could confirm is subscription
publishing; general retail shows near-zero disclosure and the AG is actively enforcing (Instacart)."
Both the feature and the story survive.

**Exact detection approach:**
1. Content-script scan of rendered page text, case-insensitive, core anchor
   `/set by an algorithm using your personal data/i`; also flag `/personalized algorithmic pricing/i`
   and the `NEW YORK RESIDENTS:.*required to inform you/i` preamble. No DOM-vendor selectors — none
   exist; text is authoritative.
2. Report as **observed** ("this page carries the New York algorithmic-pricing disclosure"), never
   inferred outcome. Same honesty discipline as `siteReport()`.
3. **Scope caveats to ship with it** (so a reviewer can't falsify us): it runs on the page in front
   of the user — subscription/account/renewal and pricing-policy pages are where it will actually
   fire; it **cannot read renewal emails**, which is where most real disclosures currently live; and
   its absence on a retail product page is not proof of anything, because the price may be personalized
   server-side with no disclosure at all.
4. **Falsifiable bonus intact:** opt-in aggregate telemetry of where the string appears would be the
   first field data on §349-a compliance — and it reveals *retailers*, not users.

## Sources (fetched/searched this session)
- N.Y. Gen. Bus. Law §349-A — codes.findlaw.com/ny/general-business-law/gbs-sect-349-a/ ; nysenate.gov/legislation/laws/GBS/349-A
- NY AG letter to Instacart, 2026-01-08 — ag.ny.gov/sites/default/files/letters/letter-to-instacart-on-pricing-practices-letters-2026.pdf (read in full; quotes the live Instacart disclosure)
- Nieman Journalism Lab, 2026-07-22, "This price was set by an algorithm" — niemanlab.org (WSJ/Wired/New Yorker/Times Union/NJ.com renewal wording; 403 on direct fetch, quotes recovered via search index + beSpacific mirror)
- Data Protection Report (Norton Rose), 2025-12; Proskauer; Skadden; Duane Morris; Hunton — §349-a analysis + Instacart enforcement
- Pages fetched, string absent: ticketmaster.com, uber.com/price-estimate, kayak.com, stubhub.com, instacart.com help
- Pages unreachable (bot/auth, could-not-verify): amazon.com, walmart.com, bestbuy.com, expedia.com, booking.com, doordash.com, seatgeek.com, wsj.com
- Negative: no §349-a compliance-vendor/widget or Piano/Zuora/Recurly disclosure feature found
