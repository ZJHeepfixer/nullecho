# Comment on the Proposed Enforcement Policy Statement Regarding Personalized Pricing

**File No. P034101 · Docket FTC-2026-1057 · Comment deadline September 25, 2026**

**Submitted by:** Jason Luker, Ridgecrest, California  
**Capacity:** individual; developer of Nullecho, a free, open-source browser extension (MIT license, github.com/ZJHeepfixer/nullecho)  
**Date:** September 20, 2026

---

## 1. Who I am and why I am commenting

I build a free browser extension that blocks trackers, sends the Global Privacy Control signal, and shows
each website a different, internally consistent device profile so that the fingerprint one site records
cannot be joined to the fingerprint another site records. It collects no data and has no accounts. I have
no commercial relationship with any retailer, pricing vendor, or data broker, and I am not a lawyer. I am
commenting because the Statement describes, accurately, the position my users are in, and because in the
course of building the tool I had to read the state disclosure laws closely enough to find that several
widely circulated summaries of them are wrong.

## 2. The Statement's premise is right, and the tools it mentions have limits worth stating

The Statement observes that consumers "may not be able to avoid paying the higher personalized price if
they lack the information or tools necessary to" change their behavior, dispute the data, or avoid its
collection, and it names "a virtual private network or private browsing functionality" among the steps a
consumer could take if they knew. I agree with both sentences, and I want to be precise about the second.

Browser-level tools can remove some of the signals a retailer uses to recognize a returning visitor —
tracking scripts, cookies, and the device fingerprint. They cannot hide a consumer's IP address, and they
do nothing about what a retailer knows once the consumer is signed in. The strongest inputs to a
personalized price are exactly the ones a consumer cannot switch off. That is the reason disclosure
matters: a tool can lower the odds of being recognized, but only a disclosure tells the consumer that the
price in front of them was set using their data. The Statement's emphasis on concealment as the source of
unavoidability is, in my experience building the tool, correct.

## 3. The state landscape is narrower than it is usually described — and the strings differ

Commentary on this topic often describes three or four states as mandating an algorithmic-pricing
disclosure. On the enacted text, as of the date of this comment, **two** do:

- **New York**, Gen. Bus. Law § 349-a, in force, enforced since November 10, 2025: the exact sentence
  "THIS PRICE WAS SET BY AN ALGORITHM USING YOUR PERSONAL DATA." A First Amendment challenge was
  dismissed in the district court (*National Retail Federation v. James*, No. 1:25-cv-05500, S.D.N.Y.,
  Oct. 8, 2025); the appeal (2d Cir. No. 25-2818) is briefed and undecided.
- **Connecticut**, Public Act 26-130 § 11, effective July 1, 2027: "THIS PRICE WAS INCREASED USING YOUR
  PERSONAL DATA," *or a substantially similar disclosure.* Two earlier versions of this provision (P.A.
  26-64 § 11 and P.A. 26-100 § 44) were repealed before taking effect; summaries quoting a "price setting
  device" are quoting repealed text.

Two more states chose bans rather than disclosure:

- **Maryland**, Chapter 154 of 2026 (HB 895), effective October 1, 2026, enacted Com. Law § 13-321, a
  ban on personalized pricing of tax-exempt food by large food retailers and third-party delivery
  providers. The bill as introduced also carried a proposed § 13-322 that would have required every
  merchant to display "THIS PRICE WAS SET BY AN ALGORITHM OR BY USING YOUR PERSONAL DATA." **That section
  was struck by amendment before passage and is not law.** At least one published law-firm client alert describes it as enacted, and so do the AI-generated
  answers of major search engines; most firm alerts I read got it right. The error is easy to make: the chapter law prints the struck section in strikethrough, and
  text extraction from the PDF silently drops the strikethrough. The State's own codified-statute service
  returns text for § 13-321 and "File Not Found" for § 13-322, and the codified §§ 13-408(a) and 13-411(a)
  reference only § 13-321.
- **New Jersey**, P.L. 2026, c. 55 (the Fair Price Protection Act), effective August 1, 2027: a ban on
  using personal data to set the price of groceries, with no mandated wording.

I raise this for two reasons. First, if the Commission's analysis or later guidance assumes that a
uniform state disclosure regime exists, it does not; the two mandated sentences are different, only one
is in force, and one state's law accepts "substantially similar" wording that no exact-match rule can
recognize. Second, a merchant relying on a circulating summary may be building a disclosure to a Maryland
section that does not exist while missing the New York section that does. A federal statement that
describes what an adequate disclosure *is*, independent of any one state's sentence, would be useful to
merchants and consumers alike.

## 4. Presence of a disclosure is not adequacy of a disclosure

The New York Attorney General's letter to Maplebear Inc. (Instacart), dated January 8, 2026, addressed a
page that **contained the exact statutory sentence** and concluded that the disclosure nonetheless failed
to be clear and conspicuous, because of where and how it appeared. I think that letter is the most
instructive document in this area. A rule that is satisfied by the presence of a string is satisfied by a
string in six-point grey text below the fold; the consumer the Statement describes is no better informed.

I would respectfully ask that the Statement's deception and materiality analysis say explicitly that the
adequacy of a disclosure turns on its prominence and placement relative to the price — the same standard
the Commission has long applied to other disclosures — so that the presence of a sentence is not mistaken
for compliance by merchants, and cannot be offered as a defense to concealment.

## 5. A modest, practical request: disclosures a consumer's own software can recognize

My extension now recognizes New York's sentence on a page that also carries a machine-readable price, and
lets the consumer keep a local record — the page, the time, the price shown, and the sentence as displayed
— as a plain-text receipt. It draws no legal conclusion; it records what the page displayed. Building it
taught me how easily a disclosure can be made technically present and practically invisible: rendered as
an image, placed inside a collapsed element, or split across markup so that the sentence never appears as
text.

If the Commission offers guidance on adequate disclosure, I would ask that it favor disclosures rendered
as ordinary visible text, adjacent to the price, and not hidden behind a click. That costs a merchant
nothing, it is what a consumer can actually read, and it is what a consumer's own tools can help them
notice and remember.

## 6. Closing

I support the Statement. I have tried to limit this comment to what I can show from primary sources and
from building a tool that ordinary people use. I am glad to provide the underlying research, including
the verification steps for the Maryland finding, to Commission staff on request.

Respectfully submitted,

Jason Luker
(contact details provided in the regulations.gov submission form)

---

### Sources

- FTC, Proposed Enforcement Policy Statement Regarding Personalized Pricing, File No. P034101 (Aug. 19,
  2026), ftc.gov; Docket FTC-2026-1057, regulations.gov.
- N.Y. Gen. Bus. Law § 349-a, nysenate.gov/legislation/laws/GBS/349-A.
- *National Retail Federation v. James*, No. 1:25-cv-05500 (S.D.N.Y. Oct. 8, 2025) (Rakoff, J.); appeal
  No. 25-2818 (2d Cir.).
- Conn. Public Act 26-130, §§ 11 and 19 (H.B. 5563, approved June 4, 2026),
  cga.ct.gov/2026/ACT/PA/PDF/2026PA-00130-R00HB-05563-PA.PDF; P.A. 26-100 § 66 and P.A. 26-130 § 19
  (repealers).
- Md. Chapter 154, Laws of 2026 (H.B. 895), mgaleg.maryland.gov/2026RS/Chapters_noln/CH_154_hb0895e.pdf
  (read as rendered pages); Md. Code, Com. Law § 13-321, and §§ 13-408(a), 13-411(a), as codified at
  mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcl&section=13-321&enactments=true (and
  section=13-322, returning "File Not Found").
- N.J. P.L. 2026, c. 55, Assembly Committee Substitute for A.4085/A.4523, Third Reprint,
  pub.njleg.state.nj.us/Bills/2026/A4500/4085_R3.PDF; bill history,
  njleg.state.nj.us/api/billDetail/billHistory/A4085/2026.
- N.Y. Attorney General, letter to Maplebear Inc. (Instacart), Jan. 8, 2026.
- Nullecho source and research: github.com/ZJHeepfixer/nullecho (MIT).
