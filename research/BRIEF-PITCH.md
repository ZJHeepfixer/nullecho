# Outreach note for the algorithmic-pricing compliance brief

Drafted 2026-08-21; legislative facts refreshed 2026-09-16 (Connecticut's section was repealed and
re-enacted twice in June; California AB 2564 died on concurrence); **Maryland and New Jersey
re-verified 2026-09-19 against the enacted and codified text, which changed the pitch** — see the
brief's correction of record. Companion to `research/ALGORITHMIC-PRICING-COMPLIANCE-BRIEF.md`.

> ⛔ **Read this before reusing an older version of this note.** Earlier drafts led on "three states
> mandate a disclosure." **It is two** — New York and Connecticut. Maryland's all-merchant
> disclosure section was struck by amendment before passage, and the brief now says so with three
> reproducible proofs. That correction is not a footnote to the pitch; **it is the pitch.**

**Rules for this pitch, and they are the whole point.** The findings are strong stated plainly and
weaker stated loudly. No "exclusive," no "bombshell," no implied scoop we cannot defend. Every
number offered is one we can put a primary source behind within a minute. Where we are inferring,
the pitch says so — a reporter who finds an unmarked inference will never open a second email.

---

## The pitch (email body)

> **Subject:** Maryland's algorithmic-pricing disclosure was struck before passage — the law takes
> effect in 12 days and the summaries have it wrong
>
> *(⚠️ "12 days" is written for a September 19 send. **Recompute it against October 1 on the day you
> send**, or use "on October 1." A stale countdown in the subject line is a small error that makes
> a reader discount a big finding.)*
>
> Hi [name],
>
> I've been tracking the state algorithmic-pricing laws and put together the four enacted regimes
> side by side, read from the enacted statutory text rather than from summaries. Doing that turned
> up something I did not expect, and it's the reason I'm writing to you now rather than later.
>
> **1. Maryland's all-merchant disclosure duty does not exist. The section was struck by
> amendment before the bill passed.**
>
> Maryland HB 895 (Ch. 154) is described almost everywhere as enacting two things: a dynamic-pricing
> ban for large grocers, and a second section — Com. Law § 13-322 — requiring *every merchant* that
> prices on personal data to display `THIS PRICE WAS SET BY AN ALGORITHM OR BY USING YOUR PERSONAL
> DATA`, effective **October 1, 2026**. That description is in summaries from firms and
> organisations practitioners rely on.
>
> **§ 13-322 was struck by amendment before passage.** Maryland enacted § 13-321 only — the narrow
> food-retail ban — and it mandates no wording at all. Three proofs, each of which takes about a
> minute in a browser:
>
> - Maryland's own codified-statute endpoint returns **"File Not Found"** for
>   `…StatuteText?article=gcl&section=13-322`, and returns statute text for `section=13-321`. (The
>   positive control is the part that makes the negative mean anything.)
> - The codified § 13-408(a) and § 13-411(a) — the conforming amendments — each read *"This section
>   does not apply to a violation of § 13-321 of this title."* No "or § 13-322." A conforming
>   amendment can't cross-reference a section that doesn't exist.
> - In the chapter print, the enacting clause "BY adding to … Section 13-321 ~~and 13-322~~" carries
>   "and 13-322" struck through.
>
> I know how the error spreads, because I made it myself in an earlier draft. Chapter laws print
> deletions as strike-through; `pdftotext` and every extractor like it **drop the strike-through**
> and hand back deleted language as if it were enacted. It reads perfectly and it's wrong in
> exactly the places the legislature changed its mind. The brief now verifies chapter laws by
> rendering the pages and by querying the state's codified-statute endpoint with a control, and it
> says so in a method section. I'd rather hand you the method than ask you to take the finding.
>
> The practical consequence for a compliance reader: a business standing up an all-merchant
> Maryland banner for October 1 is building to a statute that was never enacted — and in Maryland's
> *food* sector, where conduct really is banned on October 1, a banner is an admission rather than
> a cure.
>
> **2. So it's two mandated strings, not three or four — and they're different from each other.**
>
> - New York: `THIS PRICE WAS SET BY AN ALGORITHM USING YOUR PERSONAL DATA` — in force now
> - Connecticut: `THIS PRICE WAS INCREASED USING YOUR PERSONAL DATA` — or "a substantially
>   similar disclosure," so it isn't fixed — from **July 1, 2027**
>
> Maryland and New Jersey mandate no wording. Connecticut's date moved twice: the legislature
> enacted the section on May 27, then repealed and replaced it twice in the first week of June
> (P.A. 26-64 → 26-100 → 26-130), and the operative string dropped the "price setting device"
> wording that most client alerts still quote. Connecticut's doesn't just reword New York's — it
> asserts the price was *increased*, and it names no mechanism at all, only the use of personal
> data. One banner can't satisfy both.
>
> **3. Most of the coverage calls these "disclosure laws." Only two of the four mandate a
> disclosure at all.** Maryland, Connecticut and New Jersey each contain outright *bans* —
> Maryland for food retailers over 15,000 square feet and food delivery, Connecticut for retail
> sellers of tangible goods (alongside its disclosure), New Jersey for groceries. In those sectors
> adding a disclosure isn't compliance; it's evidence. New Jersey has no disclosure path at all —
> though its safe harbours do require disclosure, with no wording specified, as a condition of
> relying on them.
>
> **4. We looked for the New York disclosure in the wild and found one industry doing it.**
> When we ran the sweep in August — nine months after enforcement began — the string appeared on
> subscription publishers: WSJ, Wired, The New Yorker, Albany Times Union, NJ.com, mostly in
> renewal *emails*. Instacart tried
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
> **5. California is enforcing without a pricing law, and the reason is on the record.** The AG's
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
> **6. The FTC is litigating a price-discrimination case and just wrote about personalized pricing
> without mentioning it.** Everyone assumes Robinson-Patman is the federal hook for "different
> prices for different people." The FTC's own conduct says otherwise: it brought a Robinson-Patman
> suit against Southern Glazer's (No. 8:24-cv-02684-FWS-ADS, C.D. Cal., filed December 2024, motion
> to dismiss denied April 2025, stayed for settlement in June 2026, and on August 28 the parties
> told the court they had signed a memorandum of understanding to resolve all claims, pending a
> Commission vote — it is settling, not lost), and its August 19
> personalized-pricing statement contains **zero** occurrences of "Robinson," "Patman," "Clayton,"
> or "commodity." Its footnote listing the other laws the same conduct might violate names ROSCA
> and the Fees Rule — not the price-discrimination statute the agency is simultaneously litigating.
> Same agency, same month, deliberately different statute.
>
> Two more things sitting on top of this:
>
> - **New York's One Fair Price Act passed both houses June 4 and has not been signed.** I checked
>   the Assembly and Senate records today: no delivery, no chapter number. If Hochul signs it, New
>   York's disclosure regime is *replaced* by a flat ban and the mandated string is deleted from the
>   statute — which would strand every business that just built to it.
> - **The FTC's August 19 proposed policy statement asks for more than either state string
>   provides.** It says an adequate disclosure includes the fact of personalization, *the basis for
>   it, and the types of data used*. Neither New York's nor Connecticut's string does the last two.
>   So a business fully compliant with New York is, on the face of that document, still exposed
>   under Section 5. (That comparison is my read of the two texts, not something either regulator
>   has said.)
>
> The brief runs about 16,000 words, sourced to the enacted chapter laws and the FTC PDF, with a
> section separating what I read in the original from what rests on secondary reporting and what's
> inference, and a method section explaining how the chapter laws were checked and why an earlier
> draft of my own got Maryland wrong. It also says on its face that it hasn't been reviewed by
> counsel.
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

- **Lead with:** the method failure, then the measurement. "Every summary of Maryland's law
  describes a disclosure section that was struck before passage — here's how to check it in a
  browser in a minute." Then: "we searched for the New York disclosure and found one industry
  doing it, in emails."
- **Expect:** questions about method before questions about findings. Have the coverage limits
  ready first, not last — that is what earns the second email here. The strike-through/extraction
  story is *exactly* this outlet's material: a class of error that affects everyone who checked
  the same way, with a reproducible fix.
- ⚠️ **Verify current affiliation and contact before sending.** The Markup and CalMatters combined
  operations, and beat assignments move. Do not send to a stale address with a stale outlet name in
  the greeting.

### 2. IAPP (Privacy Advisor / Daily Dashboard)

The natural home for the four-state matrix itself. IAPP's readership is privacy and compliance
professionals who need the table more than they need the narrative, and IAPP has already covered
the FTC statement.

- **Lead with:** **the Maryland correction.** Maryland bites on October 1 and a large part of this
  readership is building to a section that was struck before passage. Then the two live strings and
  the fact that Connecticut's changed after most of the client alerts went out. This audience has a
  job to do by October 1, and some of it is currently building to text that is either repealed
  (Connecticut's) or never enacted (Maryland's).
- ⚠️ **Frame it as a shared checking problem, never as "firm X is wrong."** The accurate and
  defensible sentence is *"at least one widely read law-firm alert — and the AI answers of major search engines — describe
  § 13-322 as enacted, while most firm alerts got it right; the state's own codified-statute endpoint and the conforming amendments say otherwise, and I made
  the same error before I stopped using text extraction."* Do not name firms as wrong, do not say
  anyone was negligent, and lead with your own corrected draft. That framing is both fairer and
  far more likely to get a reply.
- **Offer:** the matrix as a contributed piece under Jason's byline, or as source material for
  their own staff write-up. Either is fine; say so.
- **Do not** lead with the compliance sweep. This audience will read "near-zero compliance" as an
  accusation against their own members and get defensive.

### 3. Bloomberg Law (privacy & data security / antitrust)

Best fit for the litigation and doctrinal angle: *NRF v. James* pending in the Second Circuit
undecided, the compelled-speech question, New Jersey's private-plaintiff exposure, and the FTC's
non-binding statement asking for more than the binding state statutes do.

- **Lead with:** the Maryland correction — a legal outlet's readers act on statutory summaries, and
  this one is wrong in the alerts — then New Jersey's private-plaintiff exposure and the pending
  Second Circuit appeal. That is a risk story for in-house counsel, which is who reads it.
- ⚠️ **Get New Jersey's private right exactly right with this audience, because they will check.**
  The Act creates **no express private right of action**; the introduced A.4523's $3,000/treble
  consumer suit did not survive into the Committee Substitute. The exposure is derivative: § 3(a)
  makes a violation an "unlawful practice" under the Consumer Fraud Act, and the CFA's own private
  action with treble damages and fee-shifting attaches by operation of law. **Several alerts call
  it "first-in-the-nation express" — say "derivative of the CFA," not "express."**
- ⚠️ **Cite the chapter as P.L. 2026, c. 55 — not c. 65.** The Legislature's own bill history for
  A.4085 reads "Approved P.L.2026, c.55"; the chapter-law document is not yet posted. A wrong
  chapter number to this outlet is the kind of thing that ends the conversation.
- **Expect:** they will want the case posture exactly right. Have the full docket number (2d Cir.
  No. 25-2818; district *FTC v. Southern Glazer's* is 8:24-cv-02684-FWS-ADS), the district court
  date (2025-10-08, dismissed **with prejudice**), and the appellate posture in these words: fully
  briefed since February 24, 2026; no ruling and no recorded argument as of September 16. Do not
  say "not calendared" — that asserts something the public indexes don't show.

### Secondary channels, lower effort, still worth it

- **Law-firm client-alert authors** who have already published on one of these statutes — Proskauer,
  Skadden, Duane Morris, Norton Rose, Hunton, Morgan Lewis, Crowell. They are actively writing on
  this and none of them has published the four-state comparison. A short note offering the matrix
  as a cross-check costs nothing and builds a real contact list.
- **EPIC and Consumer Reports advocacy.** Both are already in this fight — EPIC filed an amicus in
  the Second Circuit, CR co-sponsored California's bill and ran the Instacart study. The compliance
  sweep is the kind of field data they don't have and can't easily produce. ⚠️ Note that both
  organisations' public summaries also carry the struck Maryland § 13-322 as enacted law, so the
  correction is useful to them rather than adversarial — offer it that way, privately and without
  a public callout.
- **A privacy newsletter** with a practitioner audience, as a fallback if the three above pass.

---

## What not to claim

Written down because these are the specific ways this pitch could go wrong.

- ⛔ **Do not say three or four states mandate a disclosure. It is two** — New York (in force) and
  Connecticut (July 1, 2027). Maryland and New Jersey mandate no wording. Earlier versions of this
  note said three; that was built on Maryland's struck § 13-322 and is the single biggest way this
  pitch could go wrong now.
- ⛔ **Do not quote `THIS PRICE WAS SET BY AN ALGORITHM OR BY USING YOUR PERSONAL DATA` as law
  anywhere.** It is the struck Maryland section. Quote it only as *the section that was struck* —
  and note that Md. **HB 1475**, a different bill carrying a similar string without the "OR BY",
  **died in committee**, so neither string is Maryland law.
- ⚠️ **Do not name any firm or organisation as "wrong."** The defensible formulation is *"at least one widely read law-firm alert, and the AI answers of major search engines, describe
  § 13-322 as enacted; most firm alerts I read got it right."* Say what the primary sources show,
  say that an earlier draft of the brief made the same error, and let the reporter do the naming if
  they choose to. Do not characterise anyone's work as negligent, and do not offer a list of who
  got it wrong even if asked to speculate — point at the endpoint and the conforming amendments.
- ⚠️ **Do not overclaim the strike-through story either.** What is established is *that* § 13-322
  was struck (three proofs) and *that* text extraction drops strike-through, which is a plausible
  and self-demonstrated mechanism. **Why** the legislature struck it is not established — no
  committee report or floor statement was located — and **how** any particular summary reached its
  conclusion is not knowable from outside. Say "the most likely explanation," not "they used
  pdftotext."
- **Do not say Maryland "has no algorithmic-pricing law."** It has a real one, and it bites on
  October 1: § 13-321 bans dynamic pricing on personal data by food retailers over 15,000 square
  feet and third-party food delivery. What it does not have is a *disclosure* duty.
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
- ⛔ **Do not call New Jersey's private right of action "express," and do not call it
  "first-in-the-nation express."** The enacted text creates none; the introduced A.4523's
  $3,000/treble consumer suit was dropped in the Committee Substitute. The exposure is derivative:
  a violation is a Consumer Fraud Act "unlawful practice," and the CFA's private action with treble
  damages attaches by operation of law. Some published alerts get this wrong; do not inherit it.
- ⛔ **Do not write "New Jersey Fair Price Protection Act" or "P.L. 2026, c. 65."** The short title
  is the **Fair Price Protection Act** and the chapter is **c. 55** (per the Legislature's own bill
  history for A.4085). The chapter-law document is not yet posted, so attribute the number to the
  bill history and the text to the Third Reprint.
- **Do not call New Jersey "ban only" without the qualifier.** It mandates no wording, but its
  § 3(b) safe harbours require disclosure — publicly and conspicuously disclosed discount criteria,
  clear and conspicuous loyalty disclosures of pricing benefits and data practices, production to
  Consumer Affairs within 14 days on request — with no prescribed text. "No mandated string, but
  real disclosure conditions" is the accurate phrase.
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

1. **Re-run the Maryland check yourself the morning you send, with the positive control** — it is
   the lead, and a reporter will run it while reading your email. Load
   `mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcl&section=13-322&enactments=true&archived=false`
   (expect **"File Not Found"**) and then the same URL with `section=13-321` (expect statute text).
   **The control is not optional** — without it a "File Not Found" is equally consistent with a
   typo or an outage, and offering an uncontrolled negative to a legal outlet is exactly the kind
   of thing that ends the conversation. Then spot-check codified § 13-408(a) and § 13-411(a) for
   "§ 13-321" with no "or § 13-322."
2. Re-verify the One Fair Price Act's status **the morning you send** — it is the most perishable
   fact in the pitch, and being wrong about it is the fastest way to lose the contact. As of
   September 16 the official Assembly and Senate pages show passage on June 4 and **no delivery to
   the Governor**; the ICSC claim that it was sent to her is contradicted by the record.
3. **California AB 2564 is settled for this session** — it died on Assembly concurrence at the
   August 31 deadline (see "What not to claim"). It is not a fifth state and it does not lead the
   pitch. If it appears at all it is the one-line data point that a ban cleared both chambers and
   still did not reach the Governor. Re-check only if a 2027 reintroduction surfaces.
4. Re-verify that the Second Circuit still has not ruled. As of September 16: fully briefed since
   February 24, 2026; the court's opinion and argument-audio indexes show neither a ruling nor a
   recorded argument.
5. Re-verify the Connecticut cite — it has already changed twice this year. The current act is
   **P.A. 26-130 § 11 (H.B. 5563), effective July 1, 2027**. If the 2027 session touches it again,
   Connecticut's string changes with it.
6. **Check whether P.L. 2026, c. 55 has posted.** The New Jersey chapter law was not yet published
   as of September 19 (Pamphlet Laws stop at c. 30, Advance Laws at c. 50). If it has posted,
   confirm the chapter number against it and say so; if not, attribute **c. 55** to the
   Legislature's bill history for A.4085 and the text to the Third Reprint.
7. **Check the Southern Glazer's docket** before repeating any posture language. Verified
   2026-09-19: MOU executed 2026-08-28 (Dkt 226), administratively closed 2026-09-01 (Dkt 228), next
   joint status report due 2026-09-25 — filed on time (Dkt 230, re-read 2026-09-26; contents PACER-only,
   so posture after it is unknown). Re-read the docket before citing posture; the
   argument — the FTC pursuing Robinson-Patman while writing about personalized pricing without
   mentioning it — does not depend on the posture, so drop the parenthetical rather than guess.
8. **Recompute the countdown in the subject line.** It is written for a September 19 send. If it is
   past October 1, drop the countdown entirely — the finding survives the deadline, the urgency
   framing does not, and "took effect October 1 and the summaries still have it wrong" is a
   perfectly good subject line.
9. Confirm the recipient's current outlet and address.
10. Have the statute sources ready to send in one follow-up: **MD Ch. 154 as rendered pages** (and
   the two `StatuteText` URLs, 13-321 and 13-322, which are more persuasive than the PDF),
   **CT P.A. 26-130** (not 26-64 — that PDF is repealed law), **NJ A.4085 Third Reprint**, FTC
   P034101 — plus the NY A.9349-B strike-through, which is the single clearest artifact for showing
   what New York would lose if the bill is signed.
