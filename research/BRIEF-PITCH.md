# Outreach note for the algorithmic-pricing compliance brief

Drafted 2026-08-21; legislative facts refreshed 2026-09-16 (Connecticut's section was repealed and
re-enacted twice in June; California AB 2564 died on concurrence — see the brief's "Legislative
changes since first draft" note). Companion to `research/ALGORITHMIC-PRICING-COMPLIANCE-BRIEF.md`.

**Rules for this pitch, and they are the whole point.** The findings are strong stated plainly and
weaker stated loudly. No "exclusive," no "bombshell," no implied scoop we cannot defend. Every
number offered is one we can put a primary source behind within a minute. Where we are inferring,
the pitch says so — a reporter who finds an unmarked inference will never open a second email.

---

## The pitch (email body)

> **Subject:** Three states mandate different algorithmic-pricing disclosures; a fourth bans the
> practice outright. We checked who's actually showing them.
>
> Hi [name],
>
> I've been tracking the state algorithmic-pricing laws and put together something I haven't seen
> anywhere else: the four enacted regimes side by side, read from the enacted statutory text rather
> than from summaries. Offering it to you before I do anything else with it.
>
> Three things in it that I think are genuinely news:
>
> **1. Three states mandate a disclosure, and all three strings are different.**
>
> - New York: `THIS PRICE WAS SET BY AN ALGORITHM USING YOUR PERSONAL DATA`
> - Maryland: `THIS PRICE WAS SET BY AN ALGORITHM OR BY USING YOUR PERSONAL DATA`
> - Connecticut: `THIS PRICE WAS INCREASED USING YOUR PERSONAL DATA` — or "a substantially
>   similar disclosure," the only one of the three that isn't fixed
>
> Maryland's takes effect **October 1, 2026**. Connecticut's is now **July 1, 2027**: the
> legislature enacted the section on May 27, then repealed and replaced it twice in the first week
> of June (P.A. 26-64 → 26-100 → 26-130), and the operative string dropped the "price setting
> device" wording that most client alerts still quote. A national retailer can't satisfy all three
> with one banner. Connecticut's doesn't just reword the others — it asserts the price was
> *increased*, and it names no mechanism at all, only the use of personal data.
>
> **2. Most of the coverage calls these "disclosure laws." Three of the four aren't.** Maryland,
> Connecticut and New Jersey each contain outright *bans* alongside or instead of disclosure —
> Maryland for large food retailers and food delivery, Connecticut for retail sellers of tangible
> goods, New Jersey for groceries. In those sectors adding the disclosure isn't compliance; it's
> evidence. New Jersey has no disclosure path at all.
>
> **3. We looked for the New York disclosure in the wild and found one industry doing it.**
> Nine-plus months after enforcement began, the string appears on subscription publishers — WSJ,
> Wired, The New Yorker, Albany Times Union, NJ.com — mostly in renewal *emails*. Instacart tried
> and the NY AG ruled the attempt inadequate in a January 8 letter. General retail, travel and
> ticketing: no hits. There is also **no compliance-vendor ecosystem** — no OneTrust equivalent,
> no shared script, no widget. Every implementation we found is hand-written legal copy.
>
> I want to be straight about the limits of that last one, because it's the part that could be
> overstated. Bot walls blocked the highest-value targets (Amazon, Walmart, Expedia, Booking,
> DoorDash), and we could not reach a logged-in, New-York-geolocated checkout — which is exactly
> where a personalized price would render. So "we didn't find it" is not "it isn't there." The
> likeliest explanation is actually the boring one, and it's arguably the story: compliance counsel
> is broadly advising retailers to *avoid triggering* these laws by pricing on non-personal data
> rather than to disclose. If that's what's happening, near-zero disclosure means near-zero
> personalized pricing in general retail — the laws working, not failing.
>
> **4. California is enforcing without a pricing law, and the reason is on the record.** The AG's
> January 27 sweep of retail, grocery and hotel businesses runs on the CCPA's *purpose limitation*
> principle — not its non-discrimination provision, which is the section everyone assumes applies.
> The reason that section can't do the work is stated in an official legislative document: in the
> Assembly Privacy Committee's March 25 analysis of AB 2564, the coalition *supporting* the bill
> says "no existing federal or state law prohibits companies from using the data they collect to
> charge consumers individually different prices." That's the pro-regulation side conceding the
> gap, which is much better than any lawyer's opinion on it. (The bill itself later passed both
> houses and died on Assembly concurrence at the August 31 deadline — it never reached the
> Governor. The committee record stands regardless.)
>
> One footnote on that I haven't seen anyone write up: on **Data Privacy Day 2022** the same office
> ran a nearly identical sweep — retail, home improvement, travel, food services — hooked on the
> non-discrimination section's notice-of-financial-incentive requirement. Same office, same annual
> news peg, four years later, different hook. I'd present that as an observed contrast rather than
> as proof of anything, but it's checkable and as far as I can tell nobody has connected the two.
>
> (One thing to be careful with, and I'd rather flag it than have you find it: **no source anywhere
> says how many companies got California letters, and no recipient has ever been named.** Instacart,
> Albertsons, Costco, Kroger, Safeway, Sprouts and Target show up in this story as subjects of the
> Consumer Reports study, *not* as letter recipients. Easy conflation to make and I've kept them
> separate in the brief.)
>
> **5. The FTC is litigating a price-discrimination case and just wrote about personalized pricing
> without mentioning it.** Everyone assumes Robinson-Patman is the federal hook for "different
> prices for different people." The FTC's own conduct says otherwise: it has a live Robinson-Patman
> suit against Southern Glazer's (No. 8:24-cv-02684, C.D. Cal., stayed for settlement through
> September 4), and its August 19 personalized-pricing statement contains **zero** occurrences of
> "Robinson," "Patman," "Clayton," or "commodity." Its footnote listing the other laws the same
> conduct might violate names ROSCA and the Fees Rule — not the price-discrimination statute the
> agency is simultaneously litigating. Same agency, same month, deliberately different statute.
>
> Two more things sitting on top of this:
>
> - **New York's One Fair Price Act passed both houses June 4 and has not been signed.** I checked
>   the Assembly and Senate records today: no delivery, no chapter number. If Hochul signs it, New
>   York's disclosure regime is *replaced* by a flat ban and the mandated string is deleted from the
>   statute — which would strand every business that just built to it.
> - **The FTC's August 19 proposed policy statement asks for more than any state string provides.**
>   It says an adequate disclosure includes the fact of personalization, *the basis for it, and the
>   types of data used*. None of the three state strings does the last two. So a business fully
>   compliant with New York is, on the face of that document, still exposed under Section 5. (That
>   comparison is my read of the two texts, not something either regulator has said.)
>
> The brief runs about 16,000 words, sourced to the enacted chapter laws and the FTC PDF, with a section
> separating what I read in the original from what rests on secondary reporting and what's
> inference. It also says on its face that it hasn't been reviewed by counsel.
>
> Happy to send it over, walk you through the sourcing, or just hand you the four statutes with the
> relevant sections marked and let you take it from there. No conditions and nothing to sell —
> I built this while researching a browser-extension feature and it turned out to be more
> interesting than the feature.
>
> [signature]

---

## Where to send it

Pitch **one at a time**, not a blast. These are different audiences and the framing that lands at
one is the framing that gets ignored at another.

### 1. Colin Lecher — The Markup / CalMatters

The closest fit on the beat: algorithmic accountability, consumer-facing automated systems, and the
"we tested it ourselves" methodology this brief was built with. The Markup's house style is exactly
our discipline — publish the method, publish the limits, publish the null result.

- **Lead with:** the measurement, not the statutes. "We searched for the disclosure and found one
  industry doing it, in emails."
- **Expect:** questions about method before questions about findings. Have the coverage limits
  ready first, not last — that is what earns the second email here.
- ⚠️ **Verify current affiliation and contact before sending.** The Markup and CalMatters combined
  operations, and beat assignments move. Do not send to a stale address with a stale outlet name in
  the greeting.

### 2. IAPP (Privacy Advisor / Daily Dashboard)

The natural home for the four-state matrix itself. IAPP's readership is privacy and compliance
professionals who need the table more than they need the narrative, and IAPP has already covered
the FTC statement.

- **Lead with:** the conflicting mandated strings and the Maryland October 1 deadline — plus the
  fact that Connecticut's string changed after most of the client alerts went out. This audience
  has a job to do by then, and some of it is currently building to repealed text.
- **Offer:** the matrix as a contributed piece under Jason's byline, or as source material for
  their own staff write-up. Either is fine; say so.
- **Do not** lead with the compliance sweep. This audience will read "near-zero compliance" as an
  accusation against their own members and get defensive.

### 3. Bloomberg Law (privacy & data security / antitrust)

Best fit for the litigation and doctrinal angle: *NRF v. James* pending in the Second Circuit
undecided, the compelled-speech question, the New Jersey private right of action being the first in
the nation, and the FTC's non-binding statement asking for more than the binding state statutes do.

- **Lead with:** New Jersey's private right of action and the pending Second Circuit appeal. That
  is a risk story for in-house counsel, which is who reads it.
- **Expect:** they will want the case posture exactly right. Have the docket number (2d Cir. No.
  25-2818), the district court date (2025-10-08), and the appellate posture in these words: fully
  briefed since February 24, 2026; no ruling and no recorded argument as of September 16. Do not
  say "not calendared" — that asserts something the public indexes don't show.

### Secondary channels, lower effort, still worth it

- **Law-firm client-alert authors** who have already published on one of these statutes — Proskauer,
  Skadden, Duane Morris, Norton Rose, Hunton, Morgan Lewis, Crowell. They are actively writing on
  this and none of them has published the four-state comparison. A short note offering the matrix
  as a cross-check costs nothing and builds a real contact list.
- **EPIC and Consumer Reports advocacy.** Both are already in this fight — EPIC filed an amicus in
  the Second Circuit, CR co-sponsored California's bill and ran the Instacart study. The compliance
  sweep is the kind of field data they don't have and can't easily produce.
- **A privacy newsletter** with a practitioner audience, as a fallback if the three above pass.

---

## What not to claim

Written down because these are the specific ways this pitch could go wrong.

- **Do not say retailers are "hiding" personalized pricing.** We did not find personalized pricing.
  We found an absence of disclosures, which is consistent with there being nothing to disclose.
- **Do not present the sweep as a survey or quote a compliance percentage.** It was a targeted
  search with named bot-wall failures. There is no denominator.
- **Do not say the New York law "isn't working."** The evidence points the other way if counsel's
  avoid-the-trigger advice is being followed.
- **Do not describe the FTC statement as a rule, a requirement, or an enforcement action.** It is
  proposed, out for comment, and says on its own face that it does not bind anyone.
- **Do not say the One Fair Price Act "will" be signed** or predict the Second Circuit. Both are
  open. "Passed both houses, not signed, not delivered, no chapter number as of [date]" is the whole
  claim. Do not repeat the ICSC line that the bill "went to the Governor" — the official Assembly
  and Senate pages show no delivery.
- **Do not call California a fifth state, and do not say AB 2564 "failed in the Senate."** The
  Senate passed it August 31 (22–14, as amended); it died because the Assembly never took up
  concurrence in the Senate amendments before the deadline. Never enrolled, never reached the
  Governor, no chapter. Leginfo still shows "Active" only because sine die is November 30. The
  accurate sentence is "passed both houses in different forms, died on concurrence." Its use in
  the pitch is as a data point about how contested a *ban* is, not as a live regime.
- **Do not cite Connecticut P.A. 26-64 or quote "price setting device."** Both were repealed in
  June. The operative act is P.A. 26-130 § 11 (H.B. 5563), effective July 1, 2027, and the string
  is "THIS PRICE WAS INCREASED USING YOUR PERSONAL DATA." A stale Connecticut cite sent to a legal
  outlet is the kind of error that ends the conversation.
- **Do not say the California AG "invoked § 1798.100(c)" or "cited 11 CCR § 7002."** He did not
  cite anything. He named a principle; law firms supplied the section numbers afterward. Getting
  this wrong in a pitch to a legal outlet would end the conversation.
- **Do not present the 2022/2026 sweep contrast as proof that § 1798.125 failed.** The two sweeps
  addressed different conduct. It is an observed contrast, offered because it is checkable and
  unremarked — not a finding about the AG's reasoning.
- **Do not say a court has held Robinson-Patman inapplicable to consumer pricing.** None has; the
  point appears never to have been litigated. The claim is that the FTC's own filings and omissions
  point one way and the statutory elements point the same way. Say it that way.
- **Do not cite a case you have not confirmed.** Several Robinson-Patman "commodities" citations in
  circulation could not be verified against an opinion and are deliberately absent from the brief.
  If a reporter asks for authority on that element, say it needs a paid-database pull rather than
  handing over a cite from a secondary source.
- **Do not present the brief as legal analysis.** It is compliance research with a lawyer-review
  disclaimer on its face. Say that in the pitch before a reporter has to ask.
- **Do not attach the brief to the first email.** Offer it. An unsolicited attachment from an
  unknown sender is a spam filter's favourite meal.

## Before sending

1. Re-verify the One Fair Price Act's status **the morning you send** — it is the most perishable
   fact in the pitch, and being wrong about it is the fastest way to lose the contact. As of
   September 16 the official Assembly and Senate pages show passage on June 4 and **no delivery to
   the Governor**; the ICSC claim that it was sent to her is contradicted by the record.
2. **California AB 2564 is settled for this session** — it died on Assembly concurrence at the
   August 31 deadline (see "What not to claim"). It is not a fifth state and it does not lead the
   pitch. If it appears at all it is the one-line data point that a ban cleared both chambers and
   still did not reach the Governor. Re-check only if a 2027 reintroduction surfaces.
3. Re-verify that the Second Circuit still has not ruled. As of September 16: fully briefed since
   February 24, 2026; the court's opinion and argument-audio indexes show neither a ruling nor a
   recorded argument.
4. Re-verify the Connecticut cite — it has already changed twice this year. The current act is
   **P.A. 26-130 § 11 (H.B. 5563), effective July 1, 2027**. If the 2027 session touches it again,
   the string in point 1 changes with it.
5. Confirm the recipient's current outlet and address.
6. Have the four statute PDFs ready to send in one follow-up: MD Ch. 154, **CT P.A. 26-130** (not
   26-64 — that PDF is repealed law), NJ A.4085 Third Reprint, FTC P034101 — plus the NY A.9349-B
   strike-through, which is the single clearest artifact for showing what New York would lose if
   the bill is signed.
