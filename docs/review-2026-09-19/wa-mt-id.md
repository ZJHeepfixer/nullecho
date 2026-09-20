# Washington · Montana · Idaho — what a Nullecho user in each state actually has

Read-only legal research, **2026-09-19**. Primary sources only. Nothing in the repo was modified
except this file.

The question asked was: *"Is there anything SPECIAL we can do in Washington, Montana and Idaho?"* —
meaning (a) what legal leverage a resident of each state has that Nullecho can activate or explain,
and (b) any unusual state-specific mechanism worth a feature or a page.

**Short answer: yes, twice, and a third that is a feature only if we are honest about it.**
Montana has a criminal-procedure statute that forbids its own government to *buy* the exact
categories of commercial data Nullecho blocks, and a constitutional privacy clause behind it.
Washington has the only US consumer-health-privacy statute a resident can sue under personally,
and its definition of "consumer health data" is broad enough to reach a fitness app. Idaho has
essentially nothing, and saying so plainly is the most distinctive thing we could publish about it.

---

## 0. Verdicts

| | **Montana** | **Washington** | **Idaho** |
|---|---|---|---|
| Comprehensive consumer privacy law | ✅ **MTCDPA**, MCA Title 30 ch. 14 pt. 28, eff. 10/1/2024, amended 2025 | 🔴 **NONE.** Not one, ever | 🔴 **NONE.** Not one, ever |
| **GPC / universal opt-out has legal force** | ✅ **YES — MANDATORY since 1/1/2025**, MCA §30-14-2809(3)(b) | 🔴 **NO.** Zero hits for the concept in all 52,761 RCW sections | 🔴 **NO.** Zero hits in the Idaho Code |
| Right to delete held by a private company | ✅ MCA §30-14-2808(1)(c) — 45 days (+45) | ✅ **RCW 19.373.040(1)(c)** — health data, 45 days (+45), **and it propagates to affiliates, processors and third parties** | 🔴 none |
| Who enforces | AG **only** — §30-14-2817(5) expressly bars a private action | **AG *and* the consumer** — RCW 19.373.090 → RCW 19.86.090 | AG, and a private action gated on a purchase |
| Private right of action for a tracking harm | 🔴 no (but see mental-health apps, §2.6) | 🟡 **yes in form** (CPA, fees + trebling), untested for a bare privacy injury | 🔴 effectively no — §48-608 requires you bought something |
| Constitutional privacy clause | ✅ **Art. II §10**, applied to *informational* privacy | 🔴 no explicit clause | 🔴 no explicit clause |
| Data-broker registry / deletion platform | 🔴 none | 🔴 none (2026 bill died in Appropriations) | 🔴 none |
| Government purchase of your data restricted | ✅ **MCA §46-5-603** (state + local, not federal) | 🟡 ALPR only, ch. 10.130 RCW (2026) | 🟡 digital-ID only, § 67-2364 (2026) |
| Genetic / neural data | ✅ **§30-23-101 et seq.**, amended 2025 to cover **neurotechnology data** | 🟡 inside MHMDA's "consumer health data" | 🔴 employment-only genetic act |

Legend: ✅ real and usable · 🟡 real but narrow · 🔴 absent.

### The top three "special" items (detail in §6)

1. **Turn `isCalifornian` into a user-declared *state*** — the architecture for this already shipped
   today under D40, and it is the only change that makes any of the rest reachable inside the
   product. ~6 h.
2. **A Washington consumer-health-data page** — the strongest single consumer lever in the three
   states, and it lands on exactly the trackers Nullecho blocks. It also carries a compliance
   warning Jason needs for his own apps. ~4 h.
3. **A Montana research note on the data-broker purchase ban** — publish it as writing, *not* as an
   extension surface, because D9 says Nullecho does not defeat state surveillance and a feature
   would imply it does. ~3 h.

---

## 1. Method, and one correction to the brief

Every statutory quote below was fetched from a state legislature's own host on 2026-09-19 and is
reproduced verbatim. Where a proposition is my reading rather than the statute's words, it is
labelled **Analysis**.

**Correction to the brief's premise.** The brief said Washington's position could be taken from
"the 15-state sub-audit summary in `gpc.md` if present." **It is not present.** `gpc.md` §2.7 item 9
says the opposite, verbatim:

> "**Nine states not reached at all: Washington (My Health My Data), Nevada, Oklahoma, Vermont,
> Maine, Michigan, Wisconsin, New York, and Indiana.** **No claim is made about any of them**"

So Washington was researched here from zero. The result happens to agree with the brief's guess
(no comprehensive law; MHMDA is consent-based with no signal duty) — but it was not previously
verified, and `gpc.md` should not be cited for it. **This document is now the source for
Washington.**

**Montana's UOOM row in `gpc.md` §2.1 is confirmed and can be upgraded.** `gpc.md` flagged the
Act's own effective date as unverified. It is now verified: see §2.3.

**Hosts.** `mca.legmt.gov`, `api.legmt.gov` and `docs.legmt.gov` (Montana), `legislature.idaho.gov`
and `adminrules.idaho.gov` (Idaho), and `lawfilesext.leg.wa.gov` + `wslwebservices.leg.wa.gov`
(Washington) all served. **`app.leg.wa.gov`, `apps.leg.wa.gov`, `leg.wa.gov` and
`search.leg.wa.gov` were down all session** — curl exit 28, 0 bytes, at 25 s, 60 s, 90 s and 120 s
timeouts, and WebFetch timed out at 60 s. The Washington quotes come from the Code Reviser's own
file server, which serves the same codified RCW; two of them were re-fetched independently as a
spot-check after the research was complete, and matched.

**PDFs.** No claim below rests on `pdftotext` output from a chapter law where strikethrough could
change the meaning. Montana's enrolled bills were used only for (a) bill titles and (b) brand-new
sections carrying no struck text; every amended section was read from the **codified MCA** instead.
Washington's My Health My Data Act was read twice — once from the enrolled session law
(`1155-S.SL.pdf`, all twelve operative sections are `NEW SECTION`, so nothing is struck) and once
from the codified RCW — and the two agree.

---

## 2. MONTANA

### 2.1 The data-broker purchase ban — **MCA §46-5-603**, and it is real

The brief guessed SB 282 (2025). **Correct.** Now verified end-to-end:

- **Bill → chapter.** `POST https://api.legmt.gov/bills/v1/bills/search` with `{"sessionIds":[2],
  "billNumbers":["282"],"billTypes":["SB"]}` returns
  `SB 282 | session 2 | sessionLawChapterNumber 382 | "Limit state government use of personal
  electronic data"`, with the status trail `(S) Signed by Governor 2025-05-05` →
  `Chapter Number Assigned 2025-05-08`. **SB 282 = Ch. 382, Laws of 2025.**
- **Sponsor correction.** The brief associated the bill with Zolnikov. The enrolled bill
  (`SB0282_X.pdf`, doc id 279876) reads: *"INTRODUCED BY D. EMRICH, J. FULLER, G. HUNTER, D. LOGE,
  E. KERR-CARPENTER, T. MCGILLVRAY, J. TREBAS, K. BOGNER"*. No Zolnikov.

**The operative text, codified**
([mca.legmt.gov](https://mca.legmt.gov/bills/mca/title_0460/chapter_0050/part_0060/section_0030/0460-0050-0060-0030.html)):

> **46-5-603. Governmental entities may not purchase data.** Except as provided in Title 46,
> chapter 4, part 3, or Title 46, chapter 5, part 2, pursuant to a search warrant or investigative
> subpoena issued by a court, **a governmental entity may not purchase the following:**
> (1) electronic communications;
> (2) contents of electronic communications;
> (3) contents of a communication made through a tone-only paging device;
> (4) contents of a communication from a tracking device, including an electronic or mechanical
> device that permits the tracking of the movement of a person or object;
> (5) electronic funds transfer information stored by a financial institution …;
> (6) customer proprietary network information as defined in 47 U.S.C. 222(h)(1) … inclusive of
> subscriber list information …;
> **(7) precise geolocation data as defined in 30-14-2802;**
> **(8) pseudonymous data as defined in 30-14-2802; or**
> **(9) sensitive data as defined in 30-14-2802.**
>
> History: En. Sec. 1, Ch. 382, L. 2025.

**Who it binds.** "Governmental entity" is defined for the whole part at
[MCA §46-5-601(4)](https://mca.legmt.gov/bills/mca/title_0460/chapter_0050/part_0060/section_0010/0460-0050-0060-0010.html):

> "(4) 'Governmental entity' means **a state or local agency**, including but not limited to a law
> enforcement entity or any other investigative entity, agency, department, division, bureau,
> board, or commission, or an individual acting or purporting to act for or on behalf of a state or
> local agency."

**So: all Montana state and local agencies, not just police — and NOT federal agencies.** A federal
agency buying the same records from the same broker is untouched. Montana's own legislature tried to
close that gap: **SB 453 (2025), "Prohibit sale of electronic data to the federal government,"
was introduced and NOT enacted** (no `sessionLawChapterNumber`; from the full 2025 bill pull, §2.5).
Any copy we write must not let a reader think this stops ICE or the FBI.

**What data.** Subsections (7)–(9) do something unusual and worth noticing: a *criminal-procedure*
statute borrows its definitions straight from the *consumer-privacy* act. From
[MCA §30-14-2802](https://mca.legmt.gov/bills/mca/title_0300/chapter_0140/part_0280/section_0020/0300-0140-0280-0020.html):

> "(20)(a) **'Precise geolocation data'** means information derived from technology … that directly
> identifies the specific location of an individual with precision and accuracy **within a radius of
> 1,750 feet.**"
> "(25) **'Pseudonymous data'** means personal data that cannot be attributed to a specific
> individual without the use of additional information …"
> "(28) **'Sensitive data'** means personal data that includes: (a) data revealing racial or ethnic
> origin, religious beliefs, a mental or physical health condition or diagnosis, information about a
> person's sex life, sexual orientation, or citizenship or immigration status; (b) the processing of
> genetic or biometric data for the purpose of uniquely identifying an individual; (c) personal data
> collected from a known child; or (d) precise geolocation data."

**Analysis — and this is the hook.** "Pseudonymous data" is the ad-tech product. A cookie ID, a
mobile advertising ID, or a device fingerprint with a profile hung off it is personal data that
"cannot be attributed to a specific individual without the use of additional information." Montana
has told its own agencies they may not buy it. The commercial pipeline that creates it is the thing
Nullecho degrades. That is a genuinely interesting sentence, and it is true.

**Effective date: 1 October 2025.** The enrolled SB 282 has four sections and ends at `- END -`
after a codification instruction; there is **no effective-date section** and the bill title does not
mention one (*"…AND AMENDING SECTIONS 46-5-112 AND 46-5-602, MCA."*). The default therefore applies
— [MCA §1-2-201(1)(a)](https://mca.legmt.gov/bills/mca/title_0010/chapter_0020/part_0020/section_0010/0010-0020-0020-0010.html):

> "(1)(a) … every statute adopted after January 1, 1981, **takes effect on the first day of October
> following its passage and approval** unless a different time is prescribed in the enacting
> legislation."

Approved 5 May 2025 → **in force 1 October 2025.**

**The exceptions, and how weak one of them is.** The ban yields to "a search warrant or
investigative subpoena issued by a court." Warrants need probable cause. Investigative subpoenas
usually do **not** —
[MCA §46-4-301](https://mca.legmt.gov/bills/mca/title_0460/chapter_0040/part_0030/section_0010/0460-0040-0030-0010.html):

> "(2) Except as provided in subsection (3), a subpoena may be issued only when it appears upon the
> affidavit of the prosecutor that **the administration of justice requires it** to be issued.
> **(3) In the case of constitutionally protected material, such as but not limited to medical
> records or information, a subpoena may be issued only when it appears … that a compelling state
> interest requires it** … the prosecutor shall state facts and circumstances sufficient to support
> **probable cause** …"

That §46-4-301(3) carve-out is the statutory footprint of *State v. Nelson* (§2.2). Whether precise
geolocation is "constitutionally protected material" under it has not been decided by any court I
found.

**What a violation gets you: suppression, not damages.** SB 282 §4 codified §46-5-603 "as an
integral part of Title 46, chapter 5, part 6," so part 6's remedies apply —
[MCA §46-5-607](https://mca.legmt.gov/bills/mca/title_0460/chapter_0050/part_0060/section_0070/0460-0050-0060-0070.html):

> "(1) Except as proof of a violation of this part, **evidence obtained in violation of this part is
> not admissible** in a civil, criminal, or administrative proceeding … (2) **The attorney general
> may apply for an injunction** or commence a civil action against any governmental entity to compel
> compliance …"

and SB 282 also amended [MCA §46-5-112(3)](https://mca.legmt.gov/bills/mca/title_0460/chapter_0050/part_0010/section_0120/0460-0050-0010-0120.html)
so it now reads *"Any evidence obtained in violation of this section **or 46-5-603** is not
admissible…"*. **There is no private damages remedy.** Do not write "you can sue."

**Is Montana the first or the only state?** The Electronic Frontier Foundation says first —
["Montana Becomes First State to Close the Law Enforcement Data Broker Loophole"](https://www.eff.org/deeplinks/2025/05/montana-becomes-first-state-close-law-enforcement-data-broker-loophole),
and press coverage followed. **I did not verify the 50-state negative and this report does not
assert it.** If we publish, attribute it ("EFF called it the first") rather than claiming it.
Attempting to check the nearest analogue, Utah Code §77-23c-102, failed: `le.utah.gov` serves a SPA
shell to curl and WebFetch got only the page chrome.

### 2.2 Montana Constitution Art. II §10 — and it reaches informational privacy

[Verbatim, from the MCA's own constitution pages](https://mca.legmt.gov/bills/mca/title_0000/article_0020/part_0010/section_0100/0000-0020-0010-0100.html):

> **Section 10. Right of privacy.** The right of individual privacy is essential to the well-being
> of a free society and shall not be infringed without the showing of a compelling state interest.

**The case: *State v. Nelson*, 283 Mont. 231, 941 P.2d 441 (1997)** (opinion PDF, Montana Supreme
Court, docket 96-181, decided 1997-06-24; retrieved via CourtListener's copy of the court's own
file, `storage.courtlistener.com/pdf/1997/06/24/state_v._nelson.pdf`; the court's own
`searchcourts.mt.gov` host no longer resolves). Three passages, verbatim:

> "We agree with the California court that **informational privacy is a core value furthered by
> state constitutional guarantees of privacy** and that the zone of privacy created by those
> provisions extends to the details of a patient's medical and psychiatric history."

> "Although medical records have not been historically protected by the Fourth Amendment's
> prohibition against unreasonable searches and seizures … **Montana's separate constitutional
> guarantee of privacy expands the breadth of privacy beyond traditional search and seizure
> principles derived from the Fourth Amendment** and Article II, Section 11 of the Montana
> Constitution."

> "We reiterate our holding as follows: **Medical records and medical information are protected
> under Article II, Section 10's guarantee of privacy.** When an investigative subpoena seeks
> discovery of medical records, the subpoena can issue only upon a showing of a compelling state
> interest. In order to establish the existence of a compelling state interest … the State must
> demonstrate 'probable cause' …"

The two-part test *Nelson* applies (subjective expectation + society willing to recognise it) comes
from *State ex rel. Great Falls Tribune Co. v. Eighth Judicial District Court*, 238 Mont. 310, 777
P.2d 345 (1989), quoted in *Nelson*. That is the second and last case cite in this report.

**Analysis — the limit that must be stated.** *Nelson* is about the **State**: an investigative
subpoena, a prosecutor, suppression. Every Art. II §10 application surveyed here runs against
government actors. **I found no Montana authority holding that Art. II §10 gives a consumer a cause
of action against a private advertising company, and this report does not claim it does.** Any
Montana page we publish must not imply otherwise.

### 2.3 The MTCDPA after SB 297 (2025) — and the UOOM duty is untouched

- **Bill → chapter, verified the same way:** `SB 297 | session 2 | chapter 567 | "Generally revise
  privacy laws"`, `(S) Signed by Governor 2025-05-08`, `Chapter Number Assigned 2025-05-13`.
  **SB 297 = Ch. 567, Laws of 2025.**
- **Effective date: 1 October 2025.** The enrolled SB 297 title names no effective date
  (*"…AMENDING SECTIONS 20-7-1324, 30-14-2802, 30-14-2803, 30-14-2804, 30-14-2808, 30-14-2812,
  30-14-2816, AND 30-14-2817, MCA; AND REPEALING SECTION 15, CHAPTER 681, LAWS OF 2023."*), so
  MCA §1-2-201(1)(a) applies. Corroborated inside the codified text itself —
  [§30-14-2819(1)](https://mca.legmt.gov/bills/mca/title_0300/chapter_0140/part_0280/section_0190/0300-0140-0280-0190.html):
  *"A controller that, **on or after October 1, 2025**, offers an online service, product, or feature
  to a consumer whom the controller actually knows or willfully disregards is a minor shall conduct a
  data protection assessment…"*, and (7) *"Data protection assessment requirements apply to
  processing activities created or generated after October 1, 2025, and are not retroactive."*

**Thresholds — lowered.**
[MCA §30-14-2803](https://mca.legmt.gov/bills/mca/title_0300/chapter_0140/part_0280/section_0030/0300-0140-0280-0030.html)
(History: *En. Sec. 3, Ch. 681, L. 2023; amd. Sec. 3, Ch. 567, L. 2025*):

> "(1) The provisions of this part, **excluding 30-14-2811, 30-14-2818, and 30-14-2819**, apply to
> persons that conduct business in this state or persons that produce products or services that are
> targeted to residents of this state and:
> (a) control or process the personal data of **not less than 25,000 consumers**, excluding personal
> data controlled or processed solely for the purpose of completing a payment transaction; or
> (b) control or process the personal data of **not less than 15,000 consumers** and derive more than
> 25% of gross revenue from the sale of personal data.
> **(2) Sections 30-14-2811, 30-14-2818, and 30-14-2819 apply to persons that conduct business in
> this state or deliver commercial products or services that are intentionally targeted to residents
> of this state.**"

Two things there. The volume gate dropped (Montana's original 2023 numbers were 50,000 / 25,000).
And **§30-14-2803(2) has no threshold at all** — the three minors sections bind anyone targeting
Montanans, including a one-person app developer.

**Minors.** New §§30-14-2811, -2818, -2819 (all *En. … Ch. 567, L. 2025*). §30-14-2811 imposes a
duty of *"reasonable care to avoid a heightened risk of harm to minors"*, and bars, without consent:
targeted advertising, sale, and profiling of a minor's data; processing beyond the disclosed
purpose; processing *"for longer than is reasonably necessary"*; using *"a system design feature to
significantly increase, sustain, or extend a minor's use"*; and collecting a minor's precise
geolocation unless necessary, time-limited, **and** signalled to the minor for the whole duration.
"Minor" is under 18; "child" is under 13.

**The UOOM duty stands, word for word.**
[MCA §30-14-2809](https://mca.legmt.gov/bills/mca/title_0300/chapter_0140/part_0280/section_0090/0300-0140-0280-0090.html)
carries the history note **"En. Sec. 6, Ch. 681, L. 2023."** — and nothing else. **SB 297 did not
touch it.** The operative text is unchanged:

> "(3) Opt-out methods must: … (b) **by no later than January 1, 2025, allow a consumer to opt out of
> any processing of the consumer's personal data for the purposes of targeted advertising, or any
> sale of such personal data through an opt-out preference signal** sent with the consumer's consent,
> to the controller by a platform, technology, or mechanism that: (i) may not unfairly disadvantage
> another controller; **(ii) may not make use of a default setting**, but require the consumer to make
> an affirmative, freely given and unambiguous choice …; (iii) must be consumer-friendly and easy to
> use by the average consumer; (iv) must be consistent with any federal or state law or regulation;
> and (v) must allow the controller to accurately determine whether the consumer is a resident of the
> state …"

And §30-14-2809(1) names the mechanism explicitly:

> "The consumer may designate an authorized agent by way of a technology, including but not limited
> to an internet link or **a browser setting, browser extension, or global device setting** indicating
> a customer's intent to opt out of such processing."

**`gpc.md` §2.1's Montana row is therefore confirmed and its "date unverified" caveat can be
removed.** Note that (3)(b)(ii) is the no-default clause — the same one `gpc.md` §2.4 already
analysed. Nothing here changes that analysis.

**Enforcement: AG only, and the statute says so.**
[MCA §30-14-2817](https://mca.legmt.gov/bills/mca/title_0300/chapter_0140/part_0280/section_0170/0300-0140-0280-0170.html):

> "(1) **The attorney general has exclusive authority** … to enforce violations pursuant to this
> part. (2) The attorney general **shall post** on the attorney general's website … (b) an online
> mechanism through which a consumer may submit a complaint … **(5) Nothing in this part may be
> construed as providing the basis for or be subject to a private right of action** for violations of
> this part or any other law."

New penalty section [§30-14-2820](https://mca.legmt.gov/bills/mca/title_0300/chapter_0140/part_0280/section_0200/0300-0140-0280-0200.html)
(*En. Sec. 12, Ch. 567, L. 2025*): a violation is a violation of Title 30 ch. 14 pts. 1–2; up to
**$7,500 per violation**; AG may recover fees.

> ⚠️ **Observed drafting artifact, not chased.** §30-14-2820(2) makes a violator liable "following
> **the 30-day period described in 30-14-2817(3)**", but the codified §30-14-2817(3) describes a
> civil investigative demand and contains no 30-day period. §30-14-2816 has no cure period either.
> SB 297's title says it repeals "SECTION 15, CHAPTER 681, LAWS OF 2023," which is plausibly the old
> cure-period sunset. Resolving this would require rendering the enrolled SB 297's amended
> §30-14-2817 page by page; I did not. **Do not state in copy that Montana has, or lacks, a cure
> period.**

**The consumer's actual rights** —
[§30-14-2808](https://mca.legmt.gov/bills/mca/title_0300/chapter_0140/part_0280/section_0080/0300-0140-0280-0080.html):
confirm/access, correct, **delete**, portability, and opt out of targeted advertising / sale /
profiling; a controller must respond *"without undue delay, but not later than **45 days**"*, once
extendable by **45** more; appeal answered within **60 days**, and on denial the controller must
hand the consumer a route to the AG.

### 2.4 Genetic Information Privacy Act — and Montana quietly added **neural data** in 2025

MCA Title 30, ch. 23. Originally Ch. 768, L. 2023; **amended by SB 163 = Ch. 345, L. 2025**
(`SB 163 | session 2 | chapter 345 | "Generally revise privacy laws related to biometric, genetic,
and neural data"`). Effective 1 October 2025 on the same §1-2-201 default (the enrolled title names
no effective date).

Consumer-actionable content, in one paragraph. An "entity" — defined at
[§30-23-102(4)](https://mca.legmt.gov/bills/mca/title_0300/chapter_0230/part_0010/section_0020/0300-0230-0010-0020.html)
as any organisation that *"(a) offers consumer genetic testing products or services directly to a
consumer; or (b) collects, uses, or analyzes genetic data"* — must, under
[§30-23-104](https://mca.legmt.gov/bills/mca/title_0300/chapter_0230/part_0010/section_0040/0300-0230-0010-0040.html),
publish a plain-language privacy overview *and* a full privacy notice; obtain **initial express
consent**; obtain **separate express consent** for third-party transfer, for use beyond the primary
purpose, and for retaining your biological sample; obtain **express consent** for marketing based on
your data and for **any sale**; and — the part that matters to a person — *"(6) provide a process for
a consumer to: (a) access the consumer's genetic or neurotechnology data; (b) **delete** the
consumer's genetic or neurotechnology data; (c) **revoke any consent** provided by the consumer; and
(d) request and obtain **the destruction of the consumer's biological sample.**"* §30-23-104(10)
additionally bars storing Montanans' genetic/neurotechnology data in OFAC-sanctioned or "foreign
adversary" countries and bars any transfer or storage outside the US without the resident's consent.
**Enforcement is AG-only** —
[§30-23-106](https://mca.legmt.gov/bills/mca/title_0300/chapter_0230/part_0010/section_0060/0300-0230-0010-0060.html):
*"(1) The attorney general has the sole authority to enforce this part"*, recovering actual damages
to the consumer, costs, fees, and **$2,500 for each violation of 30-23-104**.

The 2025 novelty is the scope. §30-23-102 now defines:

> "(9) **'Neurotechnology'** means devices capable of recording, interpreting, or altering the
> response of an individual's central or peripheral nervous system … and includes mental
> augmentation …
> (10)(a) **'Neurotechnology data'** means information that is captured by neurotechnologies, is
> generated by measuring the activity of an individual's central or peripheral nervous systems, or is
> data associated with neural activity …"

and SB 163 pushed the same term into the warrant statute —
[MCA §44-6-104](https://mca.legmt.gov/bills/mca/title_0440/chapter_0060/part_0010/section_0040/0440-0060-0010-0040.html),
*"Consumer DNA or neurotechnology database searches — familial … searches — warrant required"*:

> "(1) **A government entity may not obtain DNA or neurotechnology search results from a consumer DNA
> or neurotechnology database: (a) without a search warrant or investigative subpoena issued by a
> court on a finding of probable cause**; or (b) unless the consumer whose information is sought
> previously waived the consumer's right to privacy in the information."

**Analysis.** Out of Nullecho's lane as a feature — no browser extension touches an EEG headset. It
is a strong supporting fact in a Montana write-up: Montana is not dabbling, it has been building a
coherent privacy statute-set for three sessions.

### 2.5 Everything else Montana enacted, and the one that surprised me

**Method for this section.** Montana's legislature meets in odd years only —
[Const. Art. V §6](https://mca.legmt.gov/bills/mca/title_0000/article_0050/part_0010/section_0060/0000-0050-0010-0060.html):
*"The legislature shall meet each odd-numbered year in regular session of not more than 90
legislative days."* So **there is no 2026 Montana session and nothing was enacted in 2026** absent a
special session. For 2025 I pulled the Legislature's own complete record —
`POST https://api.legmt.gov/bills/v1/bills/search?includeCounts=false&limit=9999&offset=0` with
`{"sessionIds":[2]}`, 4,495 records / ~1,700 introduced bills — and keyword-swept every short title
for *privacy, data, broker, biometric, genetic, neural, surveillance, personal information, tracking,
geolocation, artificial intelligence*. 28 bills matched. `sessionLawChapterNumber` is the enactment
test.

🔴 **Not enacted, and each is a gap worth knowing:** **SB 453** *"Prohibit sale of electronic data to
the federal government"* · **HB 662** *"Revise the Montana driver privacy protection act"* ·
**HB 255** / **SB 118** (student data privacy) · **HJ 72** *"Interim study of personal data sharing by
DOT"* · **HB 697** (government employee privacy).

✅ **Enacted and consumer-relevant:**

**a) MCA §50-16-546 — mental-health apps, with a PRIVATE remedy.** HB 397 = **Ch. 273, L. 2025**.
Full codified text
([mca.legmt.gov](https://mca.legmt.gov/bills/mca/title_0500/chapter_0160/part_0050/section_0460/0500-0160-0050-0460.html)):

> "**50-16-546. Digital health care information — confidentiality — penalties — additional
> requirements — definition.** (1) **A mental health digital service is subject to the disclosure and
> confidentiality provisions of Title 50, chapter 16, part 5**, when handling health care information
> as defined in 50-16-504 on behalf of an individual.
> (2) A violation of this section may be enforced as provided in 50-16-552, and **a person whose
> information is disclosed in violation of Title 50, chapter 16, part 5, may pursue the remedies
> allowed in 50-16-553.**
> (3) '**Mental health digital service**' means a mobile-based application or internet website that:
> (a) collects, obtains, uses, possesses, or accesses information related to an individual's inferred
> or diagnosed mental health or substance use disorder; **and** (b) markets itself as facilitating
> mental health or substance use disorder services to an individual; **and** (c) uses the information
> provided to facilitate mental health services …"

And the remedy it points at,
[§50-16-553](https://mca.legmt.gov/bills/mca/title_0500/chapter_0160/part_0050/section_0530/0500-0160-0050-0530.html):

> "(1) **A person aggrieved by a violation of this part may maintain an action for relief** … (6) If
> the court determines that there is a violation of this part, the aggrieved person is entitled to
> recover **damages for pecuniary losses** sustained as a result of the violation and, in addition, if
> the violation results from **willful or grossly negligent conduct**, the aggrieved person may
> recover **not in excess of $5,000**, exclusive of any pecuniary loss. (7) If a plaintiff prevails,
> the court **may assess reasonable attorney fees** … (8) An action … is barred unless … commenced
> within **3 years**."

**Analysis.** This is the only private privacy remedy against a private app in any of the three
states' *comprehensive-adjacent* laws — Montana's own MTCDPA forbids one, but this side door exists.
The definition's three prongs are conjunctive ("and"), so it is narrow: a therapy or sobriety app is
in; a general fitness app is out because it does not market itself as facilitating mental-health or
substance-use services. **That also answers the exposure question for Jason's own apps in Montana:
Built, Shaped, IronOracle and Owner's Hour are not "mental health digital services" on this text.**
(They could still hit the MTCDPA if they ever control or process 25,000 Montanans' data — not a
current risk — and note MTCDPA "sensitive data" includes *"a mental or physical health condition or
diagnosis"*, which under §30-14-2812(2)(b) needs consent.)

**b) MCA §46-5-114 — a digital driver's licence is not consent to search your phone.** SB 124 =
Ch. 177, L. 2025 (redesignated from §61-5-310 and amended). Full text
([mca.legmt.gov](https://mca.legmt.gov/bills/mca/title_0460/chapter_0050/part_0010/section_0140/0460-0050-0010-0140.html)):

> "Displaying an electronic license on an electronic device or handing an electronic device
> displaying an electronic license to a peace officer **does not constitute consent to a search or
> seizure of the electronic device**."

**c) No data-broker registry, no broker deletion right, no ban on selling location data.**
Structural proof: the
[Title 30 chapter index](https://mca.legmt.gov/bills/mca/title_0300/chapters_index.html) (chapters 1–25)
and the [Title 30 ch. 14 part index](https://mca.legmt.gov/bills/mca/title_0300/chapter_0140/parts_index.html)
(parts 1–29) contain no data-broker chapter or part, and the 2025 bill sweep above found no such bill
introduced. **Montana has nothing resembling California's DROP.**

**d) Already on the books, pre-2024, and worth one line:** the **Montana Driver Privacy Protection
Act**, [MCA Title 61 ch. 11 pt. 5](https://mca.legmt.gov/bills/mca/title_0610/chapter_0110/part_0050/sections_index.html)
(§§61-11-501 to -515), Montana's DPPA analogue. Not read in detail; the 2025 attempt to revise it
(HB 662) failed.

### 2.6 What a Nullecho user in Montana actually gains

**(a) GPC has legal force — yes, and unambiguously.** MCA §30-14-2809(3)(b) has required covered
controllers to honour an opt-out preference signal since **1 January 2025**, for **targeted
advertising and sale**, and §30-14-2809(1) names a *"browser setting, browser extension, or global
device setting"* as the way a consumer designates the agent. Montana is one of the eleven verified
UOOM states in `gpc.md` §2.1. Caveats that belong in any copy: the duty reaches only controllers over
the §30-14-2803(1) thresholds, and §30-14-2817(5) means the consumer cannot enforce it — the AG can,
and §30-14-2817(2)(b) requires the AG to run a complaint form.

**(b) Deletion / opt-out mechanism — yes, but you file it with each company.** §30-14-2808(1)(c)
delete, (1)(e) opt out; 45 days (+45); 60-day appeal. No central platform. Nothing like DROP.

**(c) Purely technical.** Everything upstream of the threshold: a controller under 25,000 Montanans
owes the consumer nothing at all under the MTCDPA, and blocking is the only thing that touches it.
Fingerprint randomisation is *entirely* extra-legal in Montana — no statute addresses it. And the
constitutional clause, strong as it is, runs against the state, not against an ad network.

---

## 3. WASHINGTON

### 3.1 No comprehensive law, and no GPC — proved, not assumed

**No comprehensive consumer privacy statute has ever been enacted in Washington.** The Code
Reviser's own 2026 RCW archive (`https://lawfilesext.leg.wa.gov/Law/RCWArchive/2026/`) yields 115
chapters in Title 19; the complete privacy-adjacent set is 19.373 (health data), 19.375 (biometric
identifiers), 19.215 (disposal of personal information), 19.255 (breach notification), 19.250
(wireless numbers), 19.270 (spyware), 19.182 (fair credit reporting), 19.385 (open internet access).
No consumer-data-privacy chapter; no data-broker chapter.

**No Washington statute gives the GPC, a universal opt-out, or a browser setting any legal effect.**
This negative was proved by corpus, not by absence of memory: every codified RCW section served by
the Code Reviser — 101 titles → 2,792 chapters → **52,761 section files**, 0 fetch failures — was
downloaded and grepped.

| term | hits in the entire RCW | | positive control | hits |
|---|---|---|---|---|
| `opt-out preference signal` | **0** | | `consumer health data` | 60 |
| `universal opt-out` | **0** | | `geofence` | 4 |
| `global privacy control` | **0** | | `biometric identifier` | 46 |
| `browser setting` | **0** | | `privacy` | 398 |
| `do not track` | **0** | | `treble` | 30 |
| `preference signal` / `opt-out signal` | **0** | | `cookie ID` | 1 |

The controls are what make the zeros mean something. Within ch. 19.373 alone, `signal`, `browser`,
`opt out` and `universal` are all zero, and the one `opt-in` hit is in the consent definition.

**Analysis — and this is the important framing.** MHMDA is **opt-in**. There is no opt-out
architecture for a signal to plug into, because the statutory baseline is already "no": collection
and sharing of consumer health data are *prohibited* until the consumer consents. A GPC signal is
legally inert in Washington — and Washington residents are, for health data, better off than an
opt-out state. Nullecho should say both halves.

### 3.2 My Health My Data Act — ch. 19.373 RCW

**Enacted ESHB 1155 → 2023 c 191, effective 7/23/2023. Never amended** — every section's history note
is `[ 2023 c 191 s N.]` and the chapter appears zero times in the Code Reviser's "RCW SECTIONS
AFFECTED BY 2025 STATUTES" and "…BY 2026 STATUTES" tables. I read the act twice, independently:
from the enrolled session law
([`1155-S.SL.pdf`](https://lawfilesext.leg.wa.gov/biennium/2023-24/Pdf/Bills/Session%20Laws/House/1155-S.SL.pdf),
whose sections 1–12 are all `NEW SECTION`, so nothing is struck) and from the codified RCW. They
agree.

**"Consumer health data" — RCW 19.373.010(8).** Does it reach fitness and bodybuilding data?

> "(8)(a) 'Consumer health data' means personal information that is linked or reasonably linkable to
> a consumer and that **identifies the consumer's past, present, or future physical or mental health
> status**.
> (b) For the purposes of this definition, physical or mental health status includes, but is not
> limited to: (i) Individual health conditions, treatment, diseases, or diagnosis; **(ii) Social,
> psychological, behavioral, and medical interventions**; … **(v) Bodily functions, vital signs,
> symptoms, or measurements of the information described in this subsection (8)(b)**; … (ix)
> Biometric data; (x) Genetic data; **(xi) Precise location information that could reasonably
> indicate a consumer's attempt to acquire or receive health services or supplies; (xii) Data that
> identifies a consumer seeking health care services; or (xiii) Any information that a regulated
> entity or a small business, or their respective processor, processes to associate or identify a
> consumer with the data described in (b)(i) through (xii) … that is derived or extrapolated from
> nonhealth information** (such as proxy, derivative, inferred, or emergent data by any means,
> including algorithms or machine learning)."

And RCW 19.373.010(15):

> "(15) '**Health care services**' means **any service provided to a person to assess, measure,
> improve, or learn about a person's mental or physical health**, including but not limited to: …
> (e) Bodily functions, vital signs, symptoms, or measurements …"

**Analysis — flagged as analysis.** The words *fitness*, *exercise*, *weight*, *diet* and *nutrition*
appear nowhere in the chapter. They get in four ways: the chapeau's "physical … health status";
(8)(b)(v)'s "bodily functions, vital signs, symptoms, or **measurements**"; (8)(b)(xiii)'s
inferred-from-nonhealth catch-all; and (15)'s definition of "health care services" as *any* service
that assesses, measures, improves or teaches about physical health — which describes a training or
nutrition app on its face, making its users people "seeking health care services" under (8)(b)(xii).
**Treat a bodybuilding / fitness / nutrition app's data as in scope.** On the brief's specific
phrase: *"efforts to research or obtain"* is in the statute, but only inside the gender-affirming-care
definition (11)(b) and the reproductive/sexual-health definition (24)(b), which flow into (8)(b)(vii)
and (viii). There is no general "efforts to research any health service" hook.

**Who is bound — RCW 19.373.010(23), and there is no size floor:**

> "(23) '**Regulated entity**' means any legal entity that: (a) **Conducts business in Washington, or
> produces or provides products or services that are targeted to consumers in Washington**; and (b)
> alone or jointly with others, determines the purpose and means of collecting, processing, sharing,
> or selling of consumer health data."

**"Small business" is a delay, not an exemption — RCW 19.373.010(28):**

> "(28) '**Small business**' means **a regulated entity** that satisfies one or both of the following
> thresholds: (a) Collects, processes, sells, or shares consumer health data of **fewer than 100,000
> consumers** during a calendar year; or (b) Derives **less than 50 percent of gross revenue** from
> the collection, processing, selling, or sharing of consumer health data, **and** controls,
> processes, sells, or shares consumer health data of **fewer than 25,000 consumers**."

**Who is protected — RCW 19.373.010(7):** *"'Consumer' means (a) a natural person who is a Washington
resident; **or (b) a natural person whose consumer health data is collected in Washington**. … 'Consumer'
does not include an individual acting in an employment context."*

**Consumer rights — RCW 19.373.040.** Verbatim on the three the brief asked about:

> "(1)(a) … beginning March 31, 2024, **a consumer has the right to confirm** whether a regulated
> entity or a small business is collecting, sharing, or selling consumer health data concerning the
> consumer and to access such data, **including a list of all third parties and affiliates** with whom
> [it] has shared or sold the consumer health data **and an active email address or other online
> mechanism that the consumer may use to contact these third parties**.
> (b) **A consumer has the right to withdraw consent** from the regulated entity's or the small
> business's collection and sharing of consumer health data …
> (c) **A consumer has the right to have consumer health data concerning the consumer deleted** …
> (i) A regulated entity or a small business that receives a consumer's request to delete … shall:
> (A) **Delete the consumer health data from its records, including from all parts of the … network,
> including archived or backup systems** …; and (B) **Notify all affiliates, processors, contractors,
> and other third parties with whom [it] has shared consumer health data of the deletion request.**
> (ii) **All affiliates, processors, contractors, and other third parties that receive notice of a
> consumer's deletion request shall honor the consumer's deletion request** and delete the consumer
> health data from its records …
> (iii) If [the data] is stored on archived or backup systems, then the request … may be delayed …
> and such delay may not exceed **six months** from authenticating the deletion request."

**Timelines — correction to the brief.** There is **no 30-day figure anywhere in chapter 19.373.**
RCW 19.373.040(1)(g): *"shall comply … without undue delay, but in all cases **within 45 days** of
receipt … The response period may be **extended once by 45 additional days** when reasonably
necessary … so long as [it] informs the consumer of any such extension within the initial 45-day
response period, together with the reason."* The appeal in (1)(h) is also **45 days**, not 30 — and
*"If the appeal is denied, [it] shall also provide the consumer with an online mechanism, if
available, or other method through which the consumer may contact the attorney general to submit a
complaint."* (1)(f) makes responses free *"up to twice annually per consumer."* The 30-day figures
the brief was remembering are Washington's **breach-notification** deadlines, RCW 19.255.010(7)–(8)
and RCW 42.56.590(7)–(8).

**Geofence ban — RCW 19.373.080, in full:**

> "**Geofence restrictions.** It is unlawful for **any person** to implement a geofence around an
> entity that provides in-person health care services where such geofence is used to: (1) Identify or
> track consumers seeking health care services; (2) collect consumer health data from consumers; or
> (3) send notifications, messages, or advertisements to consumers related to their consumer health
> data or health care services. [ 2023 c 191 s 10.]"

"Geofence" is defined at RCW 19.373.010(14) as *"a virtual boundary that is **2,000 feet or less**
from the perimeter of the physical location."* Two structural notes: .080 binds **any person**, not
just regulated entities, and unlike .020–.070 it carries **no delayed compliance date** — it has been
in force since 7/23/2023.

**Enforcement — RCW 19.373.090, in full:**

> "**Application of consumer protection act.** The legislature finds that the practices covered by
> this chapter are matters vitally affecting the public interest for the purpose of applying the
> consumer protection act, chapter 19.86 RCW. **A violation of this chapter is not reasonable in
> relation to the development and preservation of business, and is an unfair or deceptive act in trade
> or commerce and an unfair method of competition for the purpose of applying the consumer protection
> act, chapter 19.86 RCW.** [ 2023 c 191 s 11.]"

*(Re-fetched independently as a spot-check at
`https://lawfilesext.leg.wa.gov/Law/RCW/RCW%20%2019%20%20TITLE/RCW%20%2019%20.373%20%20CHAPTER/RCW%20%2019%20.373%20.090.htm`
— byte-for-byte the same as the session law's §11.)*

**Is there a private right of action? There is no express grant — and, decisively, no exclusivity
clause.** The argument is a contrast *inside the RCW*:

- **RCW 19.375.030** (biometric identifiers) has the **identical** first sentence and then adds:
  *"**(2) This chapter may be enforced solely by the attorney general** under the consumer protection
  act, chapter 19.86 RCW."* (Verified twice: from the 2017 enrolled session law
  [`1493-S.SL.pdf`](https://lawfilesext.leg.wa.gov/biennium/2017-18/Pdf/Bills/Session%20Laws/House/1493-S.SL.pdf)
  §4, and from the codified RCW.)
- **RCW 19.255.040(2)** (breach notification) adds: *"An action to enforce this chapter **may not be
  brought under RCW 19.86.090**."*
- **RCW 19.373 contains neither.** `"attorney general"` appears exactly once in the whole chapter, in
  §19.373.040(1)(h)'s complaint route.

The Legislature knew how to switch private enforcement off, did so twice in neighbouring chapters,
and did not do so here.

**The vehicle — RCW 19.86.090**, quoted by the Washington Court of Appeals in *Thorley v. Nowlin*,
No. 39450-6-III (Div. III, 23 Jan. 2024), at
[courts.wa.gov/opinions/pdf/394506_pub.pdf](https://www.courts.wa.gov/opinions/pdf/394506_pub.pdf):

> "Any person who is **injured in his or her business or property** by a violation of [an unfair and
> deceptive acts and practice] … may bring a civil action in superior court to enjoin further
> violations, to recover the actual damages sustained by him or her, or both, together with **the
> costs of the suit, including a reasonable attorney's fee**. In addition, the court may, in its
> discretion, **increase the award of damages up to an amount not to exceed three times the actual
> damages sustained: PROVIDED, That such increased damage award for violation of RCW 19.86.020 may
> not exceed twenty-five thousand dollars.**"

**The limit that must go in any copy.** RCW 19.373.090 supplies two of the five *Hangman Ridge*
elements (unfair/deceptive act; public interest). It does **not** supply the other three. As the
Washington Supreme Court restated them in *Schiff v. Liberty Mutual Fire Ins. Co.*, No. 101576-3
(15 Feb. 2024), [courts.wa.gov/opinions/pdf/1015763.pdf](https://www.courts.wa.gov/opinions/pdf/1015763.pdf):
*"(1) an unfair or deceptive act or practice (2) in trade or commerce, (3) which affects the public
interest, **(4) an injury to plaintiff's business or property**, and (5) a causal link …"*. A privacy
violation that produced no pecuniary loss has to clear element (4), and Washington courts have
treated emotional distress as outside "business or property."

**No Washington appellate decision has tested it.** A CourtListener search of `wash` and `washctapp`
for `"My Health My Data"` and for `"19.373"` returns **exactly one case** — *Nunley v. Chelan-Douglas
Health District*, No. 39571-5-III (31 Oct. 2024) — and there it is a passing citation in a list of
statutes, not a holding. So: **the route is not foreclosed; it has not been shown to succeed.** Copy
must say it that way.

### 3.3 Compliance exposure for a non-Washington app developer — concrete, not alarmist

This matters twice: it is what a Nullecho user in Washington can invoke, and it is what Jason's own
apps owe. Stated flatly:

1. **You are a "regulated entity" the moment your app is available to Washington consumers.** RCW
   19.373.010(23) has no revenue or volume floor. Incorporation in Wyoming and residence in Idaho are
   irrelevant — the test is *"produces or provides products or services that are targeted to consumers
   in Washington."*
2. **You are almost certainly a "small business" — which bought you a later date, not an exemption.**
   Under RCW 19.373.010(28)(a), fewer than 100,000 Washingtonians' consumer health data in a calendar
   year is the threshold. **Regulated entities: 31 March 2024. Small businesses: 30 June 2024. Both
   are two years past.** (The date appears in the closing subsection of each of RCW 19.373.020, .030,
   .040, .050, .060 and .070(6).)
3. **HIPAA does not save you.** RCW 19.373.100(1)(a)(i) exempts *information* that is HIPAA protected
   health information, held by a covered entity or business associate. A coaching app is neither. The
   Legislature said so itself in RCW 19.373.005(2): *"HIPAA only covers health data collected by
   specific health care entities … Health data collected by noncovered entities, **including certain
   apps and websites**, are not afforded the same protections."*
4. **Two documents, not one.** RCW 19.373.020(1)(a) requires a **standalone consumer health data
   privacy policy** disclosing the categories collected and why, the categories of sources, the
   categories shared, *"a list of the categories of third parties and **specific affiliates**"*, and
   how to exercise RCW 19.373.040 rights. RCW 19.373.030(1)(c) separately requires a **consent
   request** that discloses categories, purpose, recipients and how to withdraw. A single combined
   "Privacy Policy" does not discharge both, and RCW 19.373.010(6)(b)(i) expressly says consent
   cannot come from accepting a general terms-of-use document.
5. **The link goes in two places.** RCW 19.373.020(1)(b) requires the policy linked *"prominently …
   on its homepage"*, and RCW 19.373.010(16) defines homepage for an app as *"the application's
   platform page or download page, **and a link within the application**, such as from the application
   configuration, 'about,' 'information,' or settings page."* **That means the App Store / Play
   listing *and* inside the app.**
6. **Three consents, escalating.** Collect (RCW 19.373.030(1)(a)); share, which must be *"separate and
   distinct from the consent obtained to collect"* (RCW 19.373.030(1)(b)(i)); and **sell**, which is
   not consent at all but a signed valid authorization under RCW 19.373.070 that expires one year from
   signature and must be retained six years.
7. **The deletion duty is the operationally expensive one.** RCW 19.373.040(1)(c)(i)(B) requires
   notifying every affiliate, processor, contractor and third party you shared with; 45 days, one
   45-day extension; backups get up to six months.

**Analysis — proportionate reading.** Enforcement risk today is low: no MHMDA appellate decision
exists, the AG has announced nothing public that this research found, and the private route has an
unproved injury element. But items 4 and 5 are *documents and links* — a weekend of work — and they
are also the two most visible signs of non-compliance to a plaintiff's lawyer running a scan. **The
cheap half is worth doing; the expensive half (deletion propagation) is worth designing before the
user base includes 100,000 Washingtonians.** This is a note for the Built/Shaped lane, not for the
Nullecho lane; flagged here because the research turned it up.

### 3.4 Washington 2026 session, data brokers, location data

**The comprehensive bill died.** HB 1671 / SHB 1671, from the Legislature's own
`GetLegislation` service (`biennium=2025-26&billNumber=1671`):

> `ShortDescription: Personal data privacy` · `LongDescription: Protecting personal data privacy.` ·
> `LegalTitle: AN ACT Relating to personal data privacy;` · `Sponsor: (Kloba)` ·
> `IntroducedDate: 2025-01-28` · `Companions: (empty)` ·
> `CurrentStatus: HistoryLine "By resolution, reintroduced and retained in present status." ·
> ActionDate 2026-01-12 · Status "H Approps"`

Two corrections to the brief. **It died in House Appropriations, not at the Rules cutoff** — the only
two 2026 status changes on the bill are the 12 January reintroductions; it took no other action all
session. And **there is no Senate companion** (`<Companions />` is empty, and a sweep of all 3,111
unique 2026 bill numbers found none). Also: **HB 1671 is not officially the "People's Privacy Act"** —
the strings `people`, `short title`, `may be known` and `known and cited` return zero in both
[`1671.pdf`](https://lawfilesext.leg.wa.gov/biennium/2025-26/Pdf/Bills/House%20Bills/1671.pdf) and
`1671-S.htm`. That name is an advocacy nickname; do not cite it as a bill title.

For the record, the failed bill *would* have created a UOOM duty: SHB 1671 contains *"…an **opt-out
preference signal** that is sent, with the consumer's consent, by a platform, technology, or mechanism
to the controller and that indicates the consumer's intent to opt out of any processing or sale."*
The concept exists in Olympia; it does not exist in the code.

**Sine die: Thursday 12 March 2026 — confirmed.** Not from a page saying "sine die" (that host is
down) but by convergence: (i) the Legislature's own status-change API shows 44 × *"By resolution,
returned to House Rules Committee for third reading"* plus 25 returns-to-Rules, 128 deliveries to the
Governor and 69+49 signings **on 2026-03-12, and no legislative action of any kind after it**;
(ii) [Const. art. II §12](https://lawfilesext.leg.wa.gov/Law/Constitution/Articles/Article%20%202/Article%20%202.12.htm)
— *"During each even-numbered year, the regular session shall not be more than **sixty** consecutive
days"*; (iii) RCW 44.04.010 — sessions commence *"on the second Monday of January"* = 12 Jan 2026;
day 60 = 12 March 2026. The same method validates against 2023 (mass returns on 2023-04-23; acts
effective 7/23/2023 = 90 days later).

**Data brokers: nothing enacted.** `"data broker"` returns **0** hits across all 52,761 RCW sections.
Two bills died: **SHB 2483** *"AN ACT Relating to creating a data broker registry"* got a committee
do-pass on 2026-02-04 and was then *"Referred to Appropriations"* and never moved; **HB 1887**
(registry + severance tax) never left committee. Independent cross-check: the Code Reviser's
["RCW SECTIONS AFFECTED BY 2026 STATUTES"](https://lawfilesext.leg.wa.gov/Biennium/2025-26/Htm/Reports/Reports/RCW%20SL%20SECTIONS%20AFFECTED%202026.htm)
table lists only four new Title 19 chapters for 2026 — 19.445 (grocery/pharmacy), 19.450 (transaction
rounding), 19.435 and 19.440 (artificial intelligence). None is a broker or privacy law. Also dead:
**HB 2481 / SB 6312**, surveillance-based price discrimination and surge pricing — which is the
nearest thing to `pricing.md`'s subject matter that any of these three states considered.

**Location data: one 2026 enactment, and it is not commercial.** ESSB 6002 → **2026 c 239**,
**ch. 10.130 RCW** (automated licence plate readers), effective immediately on **30 March 2026**:
RCW 10.130.030(1) *"it is unlawful for any agency to access, operate, or use an automated license
plate reader system or its associated automated license plate reader data"*, with a real private
remedy at RCW 10.130.110 (*"A person injured by a violation of this chapter may bring a civil
action…"*, costs and fees) and a CPA hook at RCW 10.130.090 that **"applies only to persons … who
enter into contract with state and local government agencies"**. It binds government and its ALPR
vendors. **It does not regulate ad tech, app SDKs or commercial location brokers.** For those, the
only Washington hooks remain MHMDA's (8)(b)(xi) precise-location-and-health prong and the .080
geofence ban.

**Biometric — RCW 19.375, and it is the weak one.** RCW 19.375.020(1): *"A person may not enroll a
biometric identifier in a database for a commercial purpose, without first **providing notice,
obtaining consent, or providing a mechanism to prevent** the subsequent use…"* — disjunctive, far
weaker than Illinois BIPA, and *"The exact notice and type of consent … is **context-dependent**."*
RCW 19.375.010(1) excludes *"a physical or digital photograph, video or audio recording or data
generated therefrom"*, and (4) limits "commercial purpose" to marketing *"unrelated to the initial
transaction."* Enforcement is AG-only (RCW 19.375.030(2), quoted above). **Nullecho's fingerprint
spoofing is out of scope here — "biometric identifier" means biological characteristics, not device
characteristics.** Practically, biometric data is better protected as *consumer health data* under
RCW 19.373.010(8)(b)(ix), which carries the private route.

**Other enacted hooks a Washington resident can use.** Breach notification: RCW 19.255.010(7)–(8)
(AG notice within 30 days above 500 residents; consumer notice within 30 calendar days), and
**RCW 19.255.040(3)(a): *"Any consumer injured by a violation of this chapter may institute a civil
action to recover damages"*** — a private action, though (2) bars using RCW 19.86.090 for it, and (1)
makes any waiver *"contrary to public policy, and … void and unenforceable."* Voter data:
**RCW 29A.08.740** makes commercial use of the registered-voter list a class C felony and gives the
recipient of an unlawful solicitation *"five dollars for each item"*, expressly as a class action with
fees. Vehicle owner data: RCW 46.12.635(1) bars release of an owner's name or address except on a
signed request with a no-unsolicited-contact agreement.

### 3.5 What a Nullecho user in Washington actually gains

**(a) GPC has legal force — no.** Proved by corpus in §3.1. Nullecho should not imply otherwise to a
Washington user, and under D40's residency framing it currently does not: the copy says *"if you live
in … one of the several other states that recognise it."* A Washingtonian reading that correctly
concludes nothing. **Leaving GPC on is still right** — Colorado Rule 5.03(C) (see `gpc.md` §2.5) says
a provider is not obliged to authenticate residency, the user may travel, and sites honouring GPC
voluntarily are common.

**(b) Deletion / opt-out — yes, and it is the strongest in the three states.** RCW 19.373.040 gives a
Washington resident, for consumer health data: confirm-and-access **including the list of every third
party and affiliate it went to, with contact details**; withdraw consent; and delete, **with the
deletion propagating** to affiliates, processors, contractors and third parties who *"shall honor"*
it. 45 days, one 45-day extension. And **the consumer can enforce it personally** via
RCW 19.373.090 → RCW 19.86.090, with mandatory fees and up to $25,000 of trebling — subject to the
unproved *Hangman Ridge* element 4.

**(c) Purely technical.** Everything that is not health-adjacent. Washington gives a resident no
opt-out right against ordinary behavioural advertising, no data-broker deletion, no right to correct,
no portability, and no signal duty. For a Washington user, **Nullecho's blocking layer is not a
convenience — it is the only thing standing between them and general-purpose profiling**, and its
fingerprint randomisation attacks exactly the element that makes data "consumer health data" in the
first place: RCW 19.373.010(8)(a) requires the information be *"linked or reasonably linkable to a
consumer"*, and RCW 19.373.010(18)(a) says personal information *"includes … data associated with a
persistent unique identifier, such as a cookie ID, an IP address, a **device identifier**, or any
other form of persistent unique identifier."* **Breaking the linkage is upstream of the statute.**
That is the cleanest legal-to-technical sentence this research produced, and it is honest.

---

## 4. IDAHO

### 4.1 The negative, with the searches that prove it

**Idaho has no comprehensive consumer privacy act, no data-broker law, no consumer health data act,
no consumer biometric act, no consumer genetic privacy act, no universal-opt-out provision, and no
constitutional privacy clause.** Idaho Statutes are current through the 2026 session (the site states
*"Idaho Statutes are updated to the website July 1 following the legislative session"*; the 2026
session convened 12 Jan 2026 and adjourned **2 April 2026**, per
[legislature.idaho.gov session dates](https://legislature.idaho.gov/sessioninfo/sessiondates/?yr=2026);
2025 ran 6 Jan – 4 April 2025).

**Structural proof, not just search results.** The
[Title 48 chapter list](https://legislature.idaho.gov/statutesrules/idstat/Title48/) has 22 chapters
— competition, price discrimination, patient act, trademarks, **consumer protection**, shoplifting,
trade secrets, vehicle warranties, telephone solicitation, pay-per-call, charitable solicitation,
music licensing, assistive technology, hospital sales, cash discount cards, patent assertions, solar
disclosure, charitable assets, unfair service agreements, **addictive social media**, **conversational
AI** — and none is a data privacy act. [Title 28](https://legislature.idaho.gov/statutesrules/idstat/Title28/)
runs 1–53 and ends with ch. 51 Identity Theft, ch. 52 Credit Report Protection, ch. 53 Digital Assets.
**Title 41 (Insurance) has zero privacy-captioned chapters.**

**Search audit (official Idaho Statutes search,
`legislature.search.idaho.gov/search?IW_FIELD_TEXT=<q>&IW_DATABASE=idaho statutes`).** A zero renders
as *"Your search for 'X' found 0 hits in 0 documents."*

| query | result | | query | result |
|---|---|---|---|---|
| `consumer data` | **0** | | `opt-out preference signal` | **0** |
| `data privacy` | **0** | | `universal opt-out` | **0** |
| `data broker` | **0** | | `global privacy control` | **0** |
| `consumer health data` | **0** | | `targeted advertising` | **0** |
| `genetic privacy` | **0** | | `browsing history` | **0** |
| `right to delete` | **0** | | `precise geolocation` | **0** |
| `device identifier` | **0** | | `sale of personal information` | **0** |
| `dark pattern` | **0** | | `facial recognition` | **0** |
| `biometric` | 4 docs — §§ 33-133, 54-1418, 54-1419, 54-2321 (student records; professional licensing) |

> ⚠️ **A defect in that search engine, found and controlled for.** Several recent Title 48 chapters
> are **not in the index**: `"addictive social media"`, `"covered social media platform"`,
> `"conversational AI"` and `"digital identification"` all return 0 hits **even though those statutes
> exist and render on the official site**. A zero on that engine is therefore *not by itself* proof of
> absence. Every negative above is backed by a second, structural method — chapter-by-chapter
> enumeration of the Idaho Code plus full bill-title sweeps of the 2024, 2025 and 2026 legislation
> indexes (4,567 / 6,268 / 6,436 rows). **If this engine is reused for another state or question, run
> a positive control first.**

**Bills that tried and failed.** **H0744 (2026)** — *"BIOMETRIC IDENTIFIERS – Adds to existing law to
establish provisions regarding the capture or use of biometric identifiers"*, Reps. Skaug and
Manwaring, Idaho's closest approach to a BIPA. Its statement of purpose: *"Informed consent is
required before a person or entity collects a biometric identifier for a commercial purpose."* Last
action 02/23/2026: *"Reported Printed and Referred to Environment, Energy & Technology."* **It never
got a hearing.** ([status](https://legislature.idaho.gov/sessioninfo/2026/legislation/H0744/)) Also
dead: S1111aa (2025, digital advertising truth — passed the Senate 19-16, died in House Business),
S1066a (breach/credit monitoring), H0117 (insurance data security), S1158/S1168 (children's devices).

### 4.2 What Idaho *does* have, and why it mostly does not help

**Idaho Consumer Protection Act, Idaho Code § 48-601 et seq. — the fallback, with a hard gate.**
§ 48-603 declares unlawful a list of practices *"where a person knows, or in the exercise of due care
should know"*, closing with the residual **"(17) Engaging in any act or practice that is otherwise
misleading, false, or deceptive to the consumer."* That covers a false privacy policy.

But the private action is purchase-gated. **§ 48-608**, whose heading is itself the answer —
*"Loss from purchase or lease — Actual and punitive damages"*
([legislature.idaho.gov](https://legislature.idaho.gov/statutesrules/idstat/Title48/T48CH6/SECT48-608/),
verified independently):

> "(1) **Any person who purchases or leases goods or services and thereby suffers any ascertainable
> loss of money or property** … as a result of the use or employment by another person of a method,
> act or practice declared unlawful by this chapter, may treat any agreement incident thereto as
> voidable or, in the alternative, may bring an action to recover **actual damages or one thousand
> dollars ($1,000), whichever is the greater**; provided, however, that **in the case of a class
> action, the class may bring an action for actual damages or a total for the class that may not
> exceed one thousand dollars ($1,000)**, whichever is the greater."

**Analysis.** Two independent killers for a tracking claim. Standing requires that you **purchased or
leased** goods or services *and* suffered an **ascertainable loss of money or property** from it — the
ordinary tracked visitor to a free ad-supported site is outside the class on the face of the statute.
And the class-action cap is **$1,000 for the entire class**, not per member, which forecloses
aggregate privacy litigation in Idaho as a practical matter. (§ 48-608(5) does make fees mandatory to
a prevailing plaintiff.) **Whether Idaho courts have ever allowed a non-purchaser to sue was not
researched and is the load-bearing open question — see §7.**

**AG rules: none on privacy.** IDAPA 04.02.01, the AG's Rules of Consumer Protection, was downloaded
in full ([adminrules.idaho.gov](https://adminrules.idaho.gov/rules/current/04/040201.pdf), 1,944
lines). A grep for `privacy|internet|online|website|data|personal information|track|cookie|digital`
returns **one** hit — the word "electronic" inside a definition of a tangible document. The
subchapters are comparative pricing, "free" claims, promotional games, going-out-of-business sales,
estimates, repairs, lay-away, door-to-door, pyramid schemes, automobile advertising. There is no
online-privacy rule.

**Breach notification — Idaho Code §§ 28-51-104 to -107, and a correction to the brief.** The duty is
in **-105**, not -104; enforcement and penalties are in **-107**, not -105.
[§ 28-51-105(1)](https://legislature.idaho.gov/statutesrules/idstat/Title28/T28CH51/SECT28-51-105/):

> "… **If the investigation determines that the misuse of information about an Idaho resident has
> occurred or is reasonably likely to occur**, the agency, individual or the commercial entity shall
> give notice as soon as possible to the affected Idaho resident. **Notice must be made in the most
> expedient time possible and without unreasonable delay** …"

The brief's recalled phrase is exact. But note the **harm trigger** — the breached entity decides
whether misuse is "reasonably likely." And the definition of "personal information" at § 28-51-104(5)
is name + SSN, driver's licence/ID number, or financial account number with access code, **unencrypted
— nothing else**. **Browsing history, device identifiers, advertising IDs, geolocation, biometric and
health data are not "personal information" under Idaho's breach law.** A tracking-data breach triggers
no Idaho notice at all. Enforcement (§ 28-51-107) belongs to the "primary regulator" — the AG for
everyone not otherwise regulated — with a fine *"not more than twenty-five thousand dollars ($25,000)
**per breach**"* and only for an **intentional** failure. **No private right of action.** The 24-hour
AG-notification duty in -105 binds only *"an agency"*; private companies owe the Idaho AG nothing.

**Genetic Testing Privacy Act — exists, but it is an employment statute.** Idaho Code Title 39 ch. 83.
§ 39-8303(1) binds only an *"employer"* (5+ employees) and only *"in connection with a hiring,
promotion, retention or other related decision."* **A consumer DNA company, a data broker or an
advertiser is not covered**, and nothing in the chapter restricts a genetic-testing company's
collection, retention, sale or law-enforcement sharing. AG-only enforcement, up to $25,000 per
violation. § 39-8305 (2024) bans state-funded facilities from using sequencers from "foreign
adversary" countries — procurement, not privacy. **And there is no Idaho genetic non-discrimination
provision in the insurance code**: a statute-wide search for `genetic` returns 21 documents, **zero in
Title 41**. Idahoans rely on federal GINA and the ACA.

**Idaho Constitution: no privacy clause.** Art. I has exactly 23 sections, enumerated at
[legislature.idaho.gov/statutesrules/idconst/ArtI/](https://legislature.idaho.gov/statutesrules/idconst/ArtI/);
none mentions privacy. The nearest is
[Art. I § 17](https://legislature.idaho.gov/statutesrules/idconst/ArtI/Sect17/) (verified
independently):

> "**Section 17. Unreasonable searches and seizures prohibited.** The right of the people to be secure
> in their persons, houses, papers and effects against unreasonable searches and seizures shall not be
> violated; and no warrant shall issue without probable cause shown by affidavit …"

A standard Fourth Amendment analogue, binding government only, with no informational-privacy language.
**Idaho has nothing comparable to Montana Const. Art. II § 10.** Given that the owner is moving from a
state whose neighbour has the strongest state privacy clause in the country, that contrast is worth
knowing.

### 4.3 The few Idaho things a resident *can* use

- **DMV records: Idaho is opt-IN, so there is no opt-out to file — and that is better.**
  [Idaho Code § 49-203(1)](https://legislature.idaho.gov/statutesrules/idstat/Title49/T49CH2/SECT49-203/):
  *"the department … **shall not knowingly disclose to any person or entity personal information about
  any individual when such information was obtained from a motor vehicle or driver record**."* The
  marketing carve-out at (4)(j) is consent-gated: *"For bulk distribution for surveys, marketing, or
  solicitations **if the department has obtained the written consent** of the person to whom such
  personal information pertains."* Photograph, digitised signature, SSN and medical/disability info
  need written consent under (6). **Idaho did not adopt the federal DPPA's opt-out model; it adopted
  the stricter consent model.** A resident need do nothing. Idaho's own enforcement is criminal
  (§ 49-204, perjury); **the civil remedy is federal** — 18 U.S.C. § 2724(a), *"actual damages, but
  not less than liquidated damages in the amount of $2,500"*, punitive damages and fees. **That is the
  single strongest privacy cause of action available to an Idaho resident, and it is not Idaho law.**
- **Voter data: public, sellable, and politically unrestricted.** Idaho Code § 34-437(1) requires the
  county clerk to supply the registered-elector list to *"any individual"*; (2) bars using it for
  commercial advertising or solicitation **"Provided however, that any such list and label may be used
  for any political purpose."** § 34-437A(3) applies the same to the statewide list. **There is no
  address-suppression program for ordinary residents** — Idaho's only address confidentiality chapters
  are Title 19 ch. 58 (law enforcement officers) and ch. 62 (judicial officers).
- **Do Not Call:** Idaho Code § 48-1003A folds Idaho into the FTC national registry; penalties
  ($500/$2,500/$5,000) go to the state. The consumer remedy at § 48-1007(1) is gated on the same
  purchase requirement as § 48-608. For robocalls where you bought nothing, the real remedy is the
  federal TCPA.
- **Credit Report Protection Act, Title 28 ch. 52 — genuinely usable.** Free first security freeze
  and first temporary lift per 12 months (§ 28-52-106(1)); free entirely for an identity-theft victim
  with a report (2). **§ 28-52-109(1)** gives a consumer a private action against a credit reporting
  agency that **willfully** fails to comply: actual damages *"or damages of not less than one hundred
  dollars ($100) and not more than one thousand dollars ($1,000)"*, punitive damages, costs and fees;
  (3) adds actual damages plus fees for negligent failures.
- **Two 2026 enactments with private remedies, neither reaching commercial trackers.**
  **Idaho Code § 67-2364** (2026 ch. 250, eff. 7/1/2026): *"(4)(b) **A public entity shall not track
  individuals, retain identity data beyond a transaction, or use digital identification as a universal
  or shared credential across agencies**"*; *"(3)(b) **Presentation of digital identification shall not
  constitute consent to search or access any other contents of a device**"*; *"(6) **Any person
  aggrieved by a violation of this section may bring an action in district court for declaratory or
  injunctive relief**"* plus fees — **but relief is declaratory/injunctive only, no damages, and it
  binds public entities.** (Note this is the same idea as Montana's MCA § 46-5-114, §2.5(b).) And the
  **Stop Harms from Addictive Social Media Act**, §§ 48-2101–48-2106 (2026 ch. 268): § 48-2105(2)(a)
  gives *"**a child or parent … a private right of action** for declaratory or injunctive relief,
  damages, including harm to mental health and emotional distress, court costs and reasonable
  attorney's fees"*, and (b) **$10,000 statutory damages** for a reckless or knowing violation; § 48-2104
  requires a child's account to have *"all privacy settings set by default at the most private levels"*
  and bars *"profile-based paid commercial advertising"* in a child's feed. **Applies only to children's
  accounts on covered social media platforms.**
- **§ 26-31-211A — mortgage trigger leads (2025 ch. 87)** is the one place Idaho law regulates a data
  broker's downstream use of purchased personal information: it forbids soliciting on a trigger lead
  without disclosing that *"the solicitation is based on personal information about the consumer that
  was purchased, directly or indirectly, from a consumer reporting agency without the knowledge or
  permission of the lender"*, and § 26-31-211A(3) makes a violation *"a violation of the Idaho consumer
  protection act."* Narrow, but real — and a mortgage applicant has made a purchase, so the § 48-608
  gate is satisfied.
- **Conversational AI Safety Act, §§ 48-2201–48-2205 (2026 ch. 249): enacted but NOT in force until
  1 July 2027**, and § 48-2205(2) says *"**Nothing in this chapter shall be construed as creating a
  private right of action**."*

### 4.4 What a Nullecho user in Idaho actually gains

**(a) GPC has legal force — no.** Zero hits for every formulation in the Idaho Code, by the audited
searches in §4.1 plus structural enumeration. An Idaho resident's GPC signal creates no duty for
anyone. It is still worth sending — some sites honour it voluntarily, and the user may browse a site
that treats all US visitors as Californians.

**(b) Deletion / opt-out mechanism — none. There is nothing to file.** No access right, no deletion
right, no opt-out right, no correction right, no portability, no broker registry, no central platform.
The one thing an Idahoan can *do* about data already held is a **security freeze** under Title 28
ch. 52 — which is about credit, not tracking — and a **federal** DPPA suit if their motor-vehicle
record is misused.

**(c) Purely technical — everything.** In Idaho, **100% of what Nullecho delivers is technical**.
There is no statute for the tool to invoke, no regulator to complain to that has jurisdiction over
tracking, and no private claim unless the user bought something and can show an ascertainable
monetary loss. This is the cleanest case in the country for the argument the project already makes:
that a tool which works without asking anyone's permission is worth building. **It is also the one
place where overclaiming would be most obviously false**, so the Idaho copy has to be the most
restrained copy we write.

---

## 5. Cross-cutting summary — the one-paragraph answers

| | **GPC legal force** | **Deletion / opt-out available** | **Purely technical (state gives nothing)** |
|---|---|---|---|
| **Montana** | **YES**, mandatory since 1/1/2025 for targeted ads + sale, MCA §30-14-2809(3)(b), and the statute names a browser extension. AG-enforced only. | Yes — per-company: delete, correct, access, portability, opt out; 45 d (+45); 60-d appeal; AG complaint form. No central platform, no broker deletion. | Anything from a controller under 25,000 Montanans; all fingerprinting; anything a private company does that the AG does not pursue. |
| **Washington** | **NO.** Zero hits in 52,761 RCW sections. MHMDA is opt-**in**, so there is no opt-out for a signal to attach to. | Yes, and the best of the three — but only for *consumer health data*: RCW 19.373.040 confirm/access (with the third-party list), withdraw consent, and **delete with propagation** to affiliates, processors and third parties; 45 d (+45); and the consumer can sue under RCW 19.86.090. | Everything non-health: ordinary behavioural advertising, correction, portability, brokers. Blocking is the whole defence; and fingerprint randomisation attacks the "linked or reasonably linkable" element that makes data regulated at all. |
| **Idaho** | **NO.** Zero hits, by audited search plus structural enumeration. | **None.** No consumer data rights of any kind. Only a credit freeze (Title 28 ch. 52) and a federal DPPA claim. | **Everything.** |

---

## 6. "Special" ideas — ranked, with effort and a sober case for each

Ranked by (value to a user) × (defensibility) ÷ (effort). Each is measured against `DECISIONS.md`
**D9** (state the non-goals in the product), **D40** (residency framing, no state counts, disclose the
mechanism's limits) and `gpc.md` §4.8 (which already recommended against a per-state "legally required
to honor this" line as phrased).

### ⭐ 1 — Make `isCalifornian` a user-declared **state**. ~6 hours. **DO THIS FIRST.**

Everything else on this list is unreachable inside the product without it. D40 shipped the hard part
today: a residency setting that is **user-declared, never inferred**, written through `patchSettings`,
read by `remedyFor` in `linkage.js:752/822/834`, with a control at `ext/options/options.html:295-301`
and a guard in `review-2026-09-19.test.js`. Replace the boolean with a `residentState` string
(`''` = not stated, default), keep `isCalifornian` as a derived read so the DROP path and its tests do
not move, and add rows only for states this repo has verified.

**Why it is right and not scope creep.** D40's own reasoning: *"Every statute in `gpc.md` §2.1 scopes
its duty to that state's own consumers: a California resident's signal creates a duty … a Wyoming
resident's identical signal creates none, on the same site, in the same second."* The product already
concedes that residency is the operative fact and already asks the user for it once. Asking once for
*which* state, instead of once for *one* state, is strictly more honest.

**The guardrails, non-negotiable.** (i) Ship a row only for a state this repo has verified — the
eleven UOOM states in `gpc.md` §2.1 plus MT/WA/ID from this file — and say so on the page: *"states we
have checked"*, never *"states that have a law."* (ii) The `\b(\d+|two|…|twelve)\s+(US\s+)?states\b`
guard from D40 must keep passing; a dropdown is not a count. (iii) No geolocation, ever —
Colorado Rule 5.03(C) says the provider is not obliged to authenticate residency, and Nullecho has no
location by design. (iv) A state with no row gets an explicit *"we have not checked your state"*, not
silence that reads as "nothing there."

### ⭐ 2 — A Washington consumer-health-data page. ~4 hours (writing, not code).

Lives at `site/health-data/` alongside `site/drop/` and `site/prove-it/`, linked from the extension
only via the state row from item 1. It is the only page in this set that ends in an action the reader
can take today.

**What it says.** Washington defines "consumer health data" so broadly that a fitness, nutrition or
symptom app is almost certainly holding it (quote RCW 19.373.010(8)(b)(v) and (15)); collecting or
sharing it without your separate opt-in consent has been unlawful since **31 March 2024** for
companies and **30 June 2024** for small ones; you have a **delete** right that the company must push
out to every affiliate, processor and third party it shared with (RCW 19.373.040(1)(c)(i)(B)–(ii)),
answered in 45 days; and, uniquely, **you can enforce it yourself** — RCW 19.373.090 makes a violation
a per-se CPA violation and RCW 19.86.090 gives you actual damages, mandatory attorney's fees and up to
$25,000 of discretionary trebling.

**And what it must also say**, or it overclaims: the CPA still requires **injury to your business or
property** (*Hangman Ridge* element 4, restated in *Schiff*, 2024), emotional distress is not that,
**no Washington appellate court has yet sustained an MHMDA private claim** — the only case that
mentions the act, *Nunley* (2024), cites it in passing — and none of this reaches non-health tracking.

**Why it belongs to Nullecho and not to a law blog.** Because of the linkage sentence in §3.5(c):
MHMDA regulates data that is *"linked or reasonably linkable"* to you, and expressly names a device
identifier as the link. The tool's two layers map exactly onto the statute's two halves — blocking
stops the sharing the statute makes unlawful, fingerprint randomisation attacks the linkability the
statute's definition depends on. **That is a real mechanism claim, not a marketing one.**

**Bonus, and the reason to do it before item 3:** writing this page forces the Built/Shaped compliance
question in §3.3 to get answered. Jason ships four apps that collect exercise, weight and nutrition
data to Washington residents. Two of the seven duties (standalone health-data privacy policy;
homepage + in-app + store-listing link) are a weekend of work and are the two a scanner would catch.

### ⭐ 3 — A Montana research note on the data-broker purchase ban. ~3 hours. **Publish as writing, not as a feature.**

`site/` or the blog, alongside `blog-i-built-a-privacy-tool-that-cant-see-you.md`. The story writes
itself and every fact in it is in §2 above: Montana told its own agencies they may not **buy**
electronic communications, precise geolocation, pseudonymous data or sensitive data
(MCA §46-5-603) — and for three of those nine categories it borrowed the definitions straight out of
its **consumer privacy act**, §30-14-2802. The commercial pipeline that manufactures "pseudonymous
data" is the thing this extension degrades. Behind it sits Art. II §10 and *State v. Nelson*'s holding
that *"informational privacy is a core value furthered by state constitutional guarantees of
privacy."*

**Why writing and not a card in the extension.** **D9 is explicit**: *"Nullecho degrades commercial
ad-tech profiling. It does not defeat state surveillance — different threat model."* A Montana card
inside the product would read as a claim that the tool does something about government data purchases.
It does not. In an essay, the relationship can be stated accurately: *the state cannot buy what was
never collected, and that is the only connection the tool has to this law.* MEMORY's standing note
that reputation is the highest-value asset points the same way — this is a piece of writing that a
privacy reporter would actually read.

**What it must not say:** not "Montana is the only state" (unverified — attribute EFF); not "you can
sue" (§46-5-607 gives suppression and an AG injunction, nothing else); not "this stops the federal
government" (§46-5-601(4) is state and local only, and SB 453 which would have reached the feds
**failed**); not that Art. II §10 gives you a claim against an advertiser (no authority found).

### 4 — An Idaho "you have no statutory rights, here is what the tool does anyway" page. ~2 hours.

**Recommended, with one condition.** It is distinctive precisely because nobody writes the negative,
it matches the project's documented voice (D9, D11 "narrow the claim"), and it is the honest answer
for the state the owner is about to live in. Content: Idaho has no privacy act, no broker law, no
health-data law, no biometric act, no constitutional privacy clause; the Consumer Protection Act's
private action requires that you **purchased or leased** something and lost money (§ 48-608), and caps
a whole class at **$1,000**; the breach law does not count browsing data, device IDs, geolocation or
health data as "personal information" at all and has no private action; the two 2026 laws with real
remedies (digital ID, addictive social media) reach government and children's accounts, not trackers;
and the strongest privacy claim an Idahoan has is **federal** (18 U.S.C. § 2724, DPPA, $2,500
liquidated). Then: here is what the extension does regardless, and here is the harness that proves it
(`site/prove-it/`).

**The condition.** Keep it factual and non-political. The failed bills (H0744 biometric, S1111
advertising) are facts and can be listed with their status lines; "Idaho doesn't care about your
privacy" is an editorial the project does not need. Also date-stamp it — Idaho's 2027 session convenes
in January and H0744's sponsors may refile.

### 5 — Add Montana to the DROP-style "what you can file" list. ~1 hour, low value.

Montana's §30-14-2808 rights are per-company, so the honest version is a short "here is the right,
here is the AG's complaint form (§30-14-2817(2)(b) requires one)" note, not a walkthrough. **Do it
only as a row inside item 1's state card**, not as its own page — and note that it is D5-compatible
(escort to the controller's own surface, never automate).

### ⛔ Recommend against

- **A per-state badge saying "this site is legally required to honor your signal."** `gpc.md` §4.8
  already recommended against this as phrased, and the Montana text is why it stays wrong: the duty
  attaches only to controllers over the §30-14-2803(1) thresholds, and the extension cannot know
  whether the site in front of it clears 25,000 Montanans. A truthful badge would have to say "if this
  company is large enough," which is not a badge.
- **Any Montana "sue them" or "file a lawsuit" affordance.** MCA §30-14-2817(5) forecloses it in
  terms. The one Montana private remedy — §50-16-546 → §50-16-553 for mental-health apps — is real but
  so narrow (three conjunctive prongs, and it requires the app to market itself as facilitating
  mental-health services) that an in-product prompt would mostly fire wrong. Mention it in the Montana
  essay; do not build a button.
- **A Washington "sue them" CTA.** The route exists but element 4 is unproved and no appellate court
  has sustained it. A page may explain it; a button telling a user they can recover $25,000 would be
  the kind of sentence D9 exists to prevent.
- **Any per-state legal database inside the extension.** The dropdown in item 1 should carry one
  sentence per state and link out. The moment it grows a table of statutes it stops being a privacy
  tool and starts being a liability.
- **Geolocating the user to pick the state.** Named here only to close the door: D40 already settled
  it, Colorado Rule 5.03(C) removes the excuse, and Nullecho has no location by design.
- **Citing `gpc.md` for Washington.** §2.7 item 9 says no claim is made. Cite this file.

---

## 7. Could not verify

Carried forward so nobody reads a gap as a negative.

1. **Whether Montana is genuinely the first or only state** with a government-data-purchase ban. The
   EFF says first; I did not run a 50-state sweep, and the nearest counter-candidate (Utah Code
   § 77-23c-102) could not be read — `le.utah.gov` serves a SPA shell to both curl and WebFetch.
   **Attribute the claim; do not assert it.**
2. **Whether the MTCDPA still has a right to cure.** §30-14-2820(2) points at "the 30-day period
   described in 30-14-2817(3)", and the codified §30-14-2817(3) has no such period. SB 297's title
   repeals "SECTION 15, CHAPTER 681, LAWS OF 2023." Resolving it needs a page-by-page **render** of the
   enrolled SB 297's amended §30-14-2817 (text extraction would silently drop strikethrough — the
   error caught earlier today). Not done. **Say nothing about a Montana cure period.**
3. **Whether Montana Const. Art. II §10 ever reaches a private defendant.** Every application surveyed
   was against the state. *Nelson* quotes *Cutter* (a California case) saying such a right *"may be
   protected from infringement by either the state or by any individual"* — but that is California law
   quoted as persuasive authority, not a Montana holding. **Unresearched. No claim made.**
4. **Whether a Washington court has ever sustained a private CPA claim predicated on RCW 19.373.090,
   and how "injury to business or property" is applied to a bare privacy violation.** A CourtListener
   search of `wash` + `washctapp` for `"My Health My Data"` and `"19.373"` returned one case,
   *Nunley* (2024), and it is a passing citation. Federal district courts (`wawd`, `waed`) returned
   nothing on those terms. **The route is not foreclosed; it has not been shown to succeed.**
5. **The canonical `app.leg.wa.gov` rendering of any RCW section.** That host, `apps.leg.wa.gov`,
   `leg.wa.gov` and `search.leg.wa.gov` were all down for the whole session (curl exit 28, 0 bytes, at
   25/60/90/120 s; WebFetch timed out at 60 s). Every Washington quote here is from
   `lawfilesext.leg.wa.gov` (the Code Reviser's own file server, serving the same codified RCW) or
   `wslwebservices.leg.wa.gov`, and the two most load-bearing sections were independently re-fetched
   as a spot-check. If a citation URL is ever needed for a filing, the canonical form is
   `https://app.leg.wa.gov/RCW/default.aspx?cite=19.373.090`, and it could not be rendered today.
6. **A leg.wa.gov page saying the words "sine die" for 2026.** 12 March 2026 rests on three converging
   primary sources (§3.4), not on a page that says it.
7. **The Washington Administrative Code was not searched.** Mitigated structurally: ch. 19.373 contains
   no rulemaking grant (`rulemaking`, `rule-making`, `adopt rules` each return 0 in the chapter), so
   there is no MHMDA implementing regulation for a signal requirement to hide in.
8. **Washington's 2026 bill sweep was at description level.** All 3,111 unique 2026 bill numbers were
   queried through the Legislature's own API and their `ShortDescription` / `LongDescription` /
   `LegalTitle` keyword-swept; the full text of all 3,111 was not downloaded. Largely closed by the
   Code Reviser's "RCW SECTIONS AFFECTED BY 2026 STATUTES" cross-check, which accounts for every new
   Title 19 chapter added in 2026.
9. **Idaho case law construing § 48-608's "purchases or leases" gate.** Quoted from the statute only.
   Whether an Idaho court has ever let a non-purchaser sue, and how strictly "ascertainable loss" is
   read for intangible harms, was not researched. **This is the load-bearing question for any Idaho
   privacy claim.**
10. **Other IDAPA 04 chapters.** 04.02.01 was verified in full from the official PDF;
    `adminrules.idaho.gov`'s chapter listing was down ("a temporary technical issue affecting document
    search and listings"), so the full set of AG rule chapters was not enumerated.
11. **Montana's Driver Privacy Protection Act (MCA Title 61 ch. 11 pt. 5) was not read in detail** —
    only its existence and section list, plus the fact that HB 662's 2025 attempt to revise it failed.
12. **Municipal and county ordinances** in all three states — out of scope, not searched.

---

## 8. Corrections to the brief's premises, collected

So they do not propagate.

| Premise | Correction |
|---|---|
| "see the 15-state sub-audit summary in gpc.md" for Washington | **No such summary exists.** `gpc.md` §2.7 item 9 names Washington as one of nine states *never reached* and makes no claim. |
| Montana SB 282 was Zolnikov's | The enrolled bill lists **D. Emrich** as lead, with seven co-sponsors. No Zolnikov. |
| MHMDA has "30/45-day timelines" | **No 30-day figure exists anywhere in ch. 19.373.** It is 45 days, one 45-day extension, 45 days for an appeal, six months for backups. The 30-day figures are Washington's *breach* statutes, RCW 19.255.010(7)–(8) and 42.56.590(7)–(8). |
| "RCW 19.373.100 or wherever the effective dates live" | **RCW 19.373.100 is the exemptions section.** There is no effective-date section; the dates live inside each substantive section. Act: 7/23/2023. Regulated entities: 3/31/2024. Small businesses: 6/30/2024. §§ .080 and .090 had no delayed date at all. |
| WA 2026 privacy bills "died at sine die … returned to Rules" | HB 1671 **died in House Appropriations**; its only 2026 action was the 12 January reintroduction. It had **no Senate companion**, and **"People's Privacy Act" is not its title** — that string does not appear in the bill. |
| Idaho breach penalties are in § 28-51-105 | **-105 is the duty; -107 is enforcement and penalties.** |
| Idaho might have genetic non-discrimination in the insurance title | **Zero `genetic` hits in Title 41.** The Genetic Testing Privacy Act (Title 39 ch. 83) is employment-only. |
| Idaho DMV might have a consumer opt-out | **Idaho is opt-IN** (§ 49-203(4)(j)) — stricter than the federal DPPA, so there is nothing to opt out of. |

---

*Compiled 2026-09-19. Montana: `mca.legmt.gov`, `api.legmt.gov`, `docs.legmt.gov`, CourtListener's
copy of the Montana Supreme Court's own opinion PDF. Washington: `lawfilesext.leg.wa.gov`,
`wslwebservices.leg.wa.gov`, `courts.wa.gov`. Idaho: `legislature.idaho.gov`,
`legislature.search.idaho.gov`, `adminrules.idaho.gov`. Nothing here is from a law-firm summary or a
privacy tracker.*
