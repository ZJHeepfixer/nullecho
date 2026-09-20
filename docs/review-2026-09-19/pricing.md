> ## ⛔ ERRATUM (Director, 2026-09-19, before this report was read by anyone)
>
> **§ "Maryland — FULLY VERIFIED … every claim correct" (line ~471) is WRONG, and BLOCKER 2 / FN1 / the "12 days"
> urgency built on it are void.** This report "verified" Maryland by `pdftotext` on the chapter-law PDF. `pdftotext`
> drops strikethrough. The entire proposed **§ 13-322** — the all-merchant disclosure, the string
> `THIS PRICE WAS SET BY AN ALGORITHM OR BY USING YOUR PERSONAL DATA`, the 45-day cure, the § 13-408/13-411
> cross-references to it — was **struck by amendment before passage** (this report's own quote at line 484,
> *"Section 13–321 and 13–322"*, is the struck "and 13–322" read as live text). What Maryland enacted is
> **§ 13-321 only**: a dynamic-pricing ban for food retailers ≥15,000 sq ft and third-party delivery, AG-only,
> no disclosure string, PRA expressly barred. Proof, reproduced independently by the Director with a positive control:
> `mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcl&section=13-321` returns statute text;
> `…section=13-322` returns **"File Not Found"**. **Second independent proof (Director, same day):** the codified
> §13-408(a) and §13-411(a) on that endpoint each read *"This section does not apply to a violation of § 13-321 of
> this title"* — no "or § 13-322". The text-extraction sub-audits that quote *"§ 13–321 OR § 13–322"* are reading the
> struck words. Three agents disagreed on this; the two that said "enacted" both used `pdftotext`. This is settled. Full evidence: this review's own Maryland sub-audit (rendered
> PDF pages via `pdftoppm`; conforming amendments reference only § 13-321).
>
> **§ "New Jersey" is also incomplete:** the sub-audit found the short title is "Fair Price Protection Act" (no
> "New Jersey"), the chapter is **P.L.2026, c.55** (not c.65), "ban-only" is too flat (safe harbors REQUIRE
> disclosure, no prescribed wording), § 4 ESL moratorium effective 2027-02-01 and § 5 immediate, and the
> "first-in-the-nation private right of action" in law-firm alerts is NOT in the enacted text.
>
> **Consequences:** mandated strings today = **NY (in force) + CT (2027-07-01). Two states.** The detector's
> Maryland branch must NOT exist. The brief and pitch must drop § 13-322 entirely. **Method rule going forward:
> never verify a chapter law by text extraction — render the pages, or query the state's codified-statute
> endpoint with a positive control.** Everything else in this report (Checkout Report absent; Spec B's anchor
> false-positives; the Instacart finding; NY § 349-h renumbering) stands.

# Pricing-disclosure lane — read-only review, 2026-09-19

Scope: the **Checkout Report** feature (the algorithmic/surveillance-pricing disclosure detector)
and the research it rests on — `research/ALGORITHMIC-PRICING-COMPLIANCE-BRIEF.md`,
`research/BRIEF-PITCH.md`, `research/NY-349A-COMPLIANCE-SWEEP.md`, and the user-facing copy in
`README.md`, `docs/PRIVACY-POLICY.md`, `docs/STORE-LISTING.md`, `docs/DECISIONS.md` (D16).

Nothing under `ext/` or any pre-existing file was modified — this document is the only thing this
review added. (`git status` shows `ext/src/shim.js`, `ext/src/same-tick-realm.test.js` and
`harness/performance.html` as changed; those are another session's work, not mine. `shim.js` was
read at `HEAD` via `git show`, never opened for edit.)

Reproducing tests — 19, all passing, each one reproducing a behaviour described below:

```
/private/tmp/claude-501/-Users-jasonluker-bodybuilding/34ba4a93-7eb0-43fc-b799-d50713ec5bf5/scratchpad/pricing/detector-spec.test.mjs
node --test detector-spec.test.mjs
```

Statute PDFs fetched and text-extracted alongside it in that directory: `ct130.pdf` (Conn. P.A.
26-130), `md154.pdf` (Md. Ch. 154), `nj4085.pdf` (N.J. ACS A.4085 3R), `nyag.pdf` (N.Y. AG letter
to Instacart).

**Counts: 3 BLOCKER · 7 SHOULD-FIX · 8 NICE.**

**In one line:** the extension does not implement the feature three shipping documents promise; the
two written specs for it would both ship defects if built; but the underlying legal research is
sound — I verified all four state statutes against their enacted text and every mandated string,
date, scope and penalty in the brief is correct.

---

## P0 — The feature does not exist

### BLOCKER 1 — The Checkout Report is advertised in three user-facing documents and implemented in zero lines of code

This was the first question asked and the answer is unambiguous.

**Search performed** (whole `ext/` tree, case-insensitive, all file types):

```
grep -rniE '349-a|349a|set by an algorithm|increased using your personal data|
            checkout report|algorithmic pric|surveillance pric|personalized pric|
            disclosure|dynamic pric|price' ext/
```

Five hits, **none of them a pricing feature**:

| Hit | What it actually is |
|---|---|
| `ext/popup/popup.css:397` | A CSS comment, `/* ── disclosure lists ── */`, styling the `<details>/<summary>` tracker list |
| `ext/src/linkage.js:21` | A design comment about Blacklight's *disclosure cost* |
| `ext/src/protocol.js:98`, `shim-handshake.test.js:326`, `handshake-integration.test.js:268` | The handshake **nonce** disclosure — unrelated |

Corroborating checks, all negative:

- `git show HEAD:ext/src/shim.js | grep -niE 'price|pricing|checkout|disclosure|algorithm'` →
  one hit, line 700, the word "algorithm" describing the persona-selection pool.
- `git log --all -S'Checkout Report' -- ext/` → **no commit has ever touched `ext/` for this
  feature.** It was not built and then removed — it was never built at all.
- `heuristics.js`, `background.js`, `popup/`, `options/` — no pricing/disclosure logic under any
  name. There is no content script that reads rendered page text at all (see BLOCKER 3).
- `docs/RELEASE-READINESS-2026-09-16.md`, `docs/RELEASE-CHECKLIST.md`, `docs/LAUNCH.md` — the
  unbuilt feature is tracked as an open item in **none** of them. The release-readiness audit,
  whose entire purpose is separating claims from proof, does not know this claim exists.

**Every user-facing sentence that promises it, verbatim:**

> `README.md:31-32` — under the heading **"What it does"**:
> **"- **Checkout Report** — what a shopping page contacted before it quoted you a price, and whether it
> carried the algorithmic-pricing disclosure NY/MD/CT law now requires."**

> `docs/PRIVACY-POLICY.md:14-15` — the document submitted to the Chrome Web Store as the extension's
> privacy policy:
> **"…shows each site a different but internally-consistent device profile so sites can't join your
> activity together by fingerprint, and offers a Checkout Report plus a guided link to California's
> data-broker deletion platform (DROP)."**

> `docs/STORE-LISTING.md:67-69` — under **"What's new in 0.1"**:
> **"First release. Tracker blocking across four categories, Global Privacy Control, per-origin
> device personas, a Checkout Report, and a guided link to California's DROP data-broker deletion
> platform."**

> `docs/STORE-LISTING.md:122-124` — screenshot shot-list item 5, an instruction to photograph a
> feature that cannot be photographed:
> **"5. **The Checkout Report on a real checkout page** (a demo/staging cart is fine — no real
> purchase). Caption: "See what a shopping page contacted before it quoted you a price.""**

> `docs/STORE-LISTING.md:49-52` — the "what it does not do" list, which still implies the capability:
> **"It will not get you lower prices. … Nullecho makes no claim about prices; it can show you what a
> shopping page contacted before it quoted you one."**

**Why this is a BLOCKER and not a docs nit.**

1. Each of these documents asserts on its own face that it was verified against the source, and
   each is wrong about this feature:
   - `PRIVACY-POLICY.md:5-7`: *"Every claim below was checked against the source in `ext/` on
     2026-09-16, not asserted from memory — see the grep citations."* The Checkout Report sentence
     is nine lines later and is not in `ext/`.
   - `STORE-LISTING.md:3-6`: *"Every sentence here was checked against `docs/THREAT-MODEL.md`'s
     canonical claim… Do not add a superlative, guarantee, or **capability this repo's tests don't
     prove**."*
   - `README.md:141-144`: *"Every claim in these docs is traceable to a cited primary source or a
     measurement actually run and recorded."* and `README.md:152-153`: *"If you find a claim in this
     repo that isn't backed by a source or a measurement, that's a bug — open an issue."*
2. The privacy policy is a **compliance document**, not marketing copy. Chrome Web Store review
   compares listing claims against shipped functionality; a listed feature with no code is a
   listing-accuracy rejection risk, and a privacy policy describing a non-existent data flow is a
   false statement in the one document reviewers treat as binding.
3. The shot-list makes it self-detecting: Jason cannot capture screenshot 5. The first person to
   try to ship this will discover the gap at submission time.

**How it happened — the audit trail is clean, which is the useful part.** D16 (2026-08-21) set a
gate: *"If retailers show the disclosure → build the detector."* The sweep
(`NY-349A-COMPLIANCE-SWEEP.md`, same day) ran the gate and returned **"Build the detector — yes.
The gate passes"** (§5, line 99). The docs were then written as if the gate's *verdict* were the
*implementation*. Four weeks later the code still does not exist and three shipping documents
describe it in the present tense. Note that the adjacent DROP feature went the other way and is
genuinely built (`ext/options/drop.html`, `drop.js`, reachable from both the popup and options page)
— so four of the five README "What it does" bullets are real and exactly one is not.

**Fix — pick one, today:**

- **(a) Cut the claim.** Delete the bullet from `README.md`, the clause from `PRIVACY-POLICY.md`,
  and both the "What's new" mention and shot-list item 5 from `STORE-LISTING.md`. Move the feature
  to a "not built yet" line in `RELEASE-READINESS`. This is ~15 minutes and unblocks the store
  submission immediately.
- **(b) Build it** to the corrected spec in this document (see BLOCKER 2 and §"And then some"),
  then re-word the claim to what a text detector can actually support.

Do not ship (a) *and* leave D16 implying the feature is imminent — D16 is the design record and
should record that the gate passed and the build did not happen.

---

### BLOCKER 2 — Both written specs for the detector are wrong, in opposite directions

There is no code to review, so I reviewed the two places that tell an implementer what to build.
Both are wrong, and an implementer following either would ship a defect.

- **Spec A** — `research/NY-349A-COMPLIANCE-SWEEP.md` §5, "Exact detection approach", step 1:
  `/set by an algorithm using your personal data/i`, plus `/personalized algorithmic pricing/i` and
  `/NEW YORK RESIDENTS:.*required to inform you/i`.
- **Spec B** — `docs/DECISIONS.md` D16, "Substring list as of 2026-09-16":
  `set by an algorithm` (NY + MD) and `using your personal data` (NY + MD + CT). Echoed in the
  brief at §6 "A note on detection".

Both were implemented verbatim and tested. **`scratchpad/pricing/detector-spec.test.mjs` — 19
tests, all passing**, i.e. every defect below reproduces exactly as described.

| # | Defect | Spec | Test |
|---|---|---|---|
| FN1 | **Spec A misses Maryland entirely.** MD's string inserts `OR BY` — `SET BY AN ALGORITHM **OR BY** USING YOUR PERSONAL DATA` — which breaks Spec A's contiguous anchor. MD takes effect **2026-10-01, twelve days from today**, and is the broadest of the three duties (every "merchant", no size threshold). | A | `FN1` |
| FN2 | **Spec A misses Connecticut entirely.** CT says `INCREASED`, not `SET BY AN ALGORITHM`. | A | `FN2` |
| FN3 | **CT's "or a substantially similar disclosure" is unmatchable by both specs.** A compliant CT notice need contain neither anchor. CT compliance is structurally undetectable by text matching — the brief says this; neither spec's accuracy claim accounts for it. | A+B | `FN3` |
| FN4 | **The string split across inline elements defeats Spec A.** `<b>THIS PRICE WAS SET BY AN</b><span>ALGORITHM USING…</span>` renders with a newline; neither spec normalizes whitespace. Spec B returns `true` but **only via the `using your personal data` half** — the anchor that also fires on every privacy policy — so it is right by accident and cannot name the state. | A+B | `FN4` |
| FN5 | **Non-breaking spaces defeat both.** `&nbsp;`-joined legal boilerplate is common and neither spec normalizes `      ​`. | A+B | `FN5` |
| FP1 | **A news article fires the detector.** Measured, not assumed: Nieman Lab's actual headline *"This price was set by an algorithm"* does **not** fire Spec A (it stops short of the second half) but **does** fire Spec B, whose NY/MD anchor is the bare phrase. The article *body*, quoting the statute, fires Spec A too. | A+B | `FP1` |
| FP2 | **A law-firm client alert fires it.** Same mechanism: no price-proximity requirement. | A | `FP2` |
| FP3 | **This repository's own docs fire it.** Publish the brief to a web page and Nullecho reports it as a merchant carrying a pricing disclosure. | A | `FP3` |
| FP4 | **Spec B's `using your personal data` fires on ordinary privacy-policy prose.** All four of these are classified as pricing disclosures: *"…protecting your privacy when using your personal data"*, *"withdraw consent to our using your personal data"*, *"the lawful bases for using your personal data"*, *"we stop using your personal data when you close your account."* D16 calls this *"the one substring that survives all three strings"*. It also survives every GDPR/CCPA privacy policy on the web — i.e. the **site footer of nearly every commercial page the extension will ever see.** | B | `FP4` |
| FP5 | **`personalized algorithmic pricing` fires on pages denying the practice.** *"Our pricing team does not use personalized algorithmic pricing"* → reported as carrying the disclosure. This is a defined statutory **term**, not a mandated string, and does not belong in a detector. | A | `FP5` |
| FP6 | **The NY-preamble regex is unbounded.** `/NEW YORK RESIDENTS:.*required to inform you/i` joins two unrelated sentences on one flattened line — e.g. a state-notices link followed by a CCPA rights sentence. | A | `FP6` |

**The claim that fails.** The sweep (§4, §5) and the brief (§6) both assert text matching gives
**"near-zero false positives"** because the strings are "statutorily fixed and distinctive". That is
true of the *full NY string*. It is **not true of the anchors those same documents recommend**, and
the anchors are what an implementer would build. The sweep's own §3 is the evidence against it: it
reports that reverse-searching the string across the web index surfaced *"only the publishers,
Instacart, and law-firm explainers."* Explainers are a large share of the string's total web
presence — so on the open web a large share of the detector's hits are pages that are **not price
displays at all**.

**The corrected spec** is written as a passing test (`STATE2`): match each state's full string
separately, whitespace- and Unicode-normalized, and return *which* regime matched rather than a
boolean.

```js
const REGIMES = [
  { state: 'NY', effective: '2025-11-10', re: /this\s+price\s+was\s+set\s+by\s+an\s+algorithm\s+using\s+your\s+personal\s+data/i },
  { state: 'MD', effective: '2026-10-01', re: /this\s+price\s+was\s+set\s+by\s+an\s+algorithm\s+or\s+by\s+using\s+your\s+personal\s+data/i },
  { state: 'CT', effective: '2027-07-01', re: /this\s+price\s+was\s+increased\s+using\s+your\s+personal\s+data/i },
];
const which = (text) => {
  const t = text.replace(/[   ​]/g, ' ').replace(/\s+/g, ' ');
  return REGIMES.filter((r) => r.re.test(t)).map((r) => r.state);
};
```

Verified in `STATE2`: MD resolves to `['MD']` alone (NY's string is **not** a prefix of MD's —
`OR BY` breaks it, so there is no ambiguity to resolve), CT to `['CT']`, NY to `['NY']`; FN4 and
FN5 are fixed; FP4's privacy-policy prose returns `[]`.

---

### BLOCKER 3 — "Whether it carried the disclosure" is a claim the design cannot support, and the repo's own primary source says so

Two independent problems with the sentence in `README.md:31-32`.

**(a) Presence of the string is not compliance — and the only enforcement action in the record says
exactly that.** I fetched the NY AG's 2026-01-08 letter to Maplebear/Instacart directly. It is worth
quoting at length, because it is the single best piece of evidence in this lane and it is a primary
source:

> **"Based on our observations, the Instacart platform provides the following disclosure on a page
> linked to certain retail stores' front pages, accessed by clicking fine print text: "New York law
> requires the following disclosure because certain prices and/or fees may vary based on randomized
> tests, we use personal information (such as delivery address) to calculate fees, and we offer
> certain personalized incentives: this price was set by an algorithm using your personal data."
> **This form of disclosure does not appear to comply with, among other things, the "clear and
> conspicuous" requirements of the Act.** Moreover, there was no disclosure on category pages
> listing product prices (e.g., Meat & Seafood) or on individual product pages displaying price,
> though a disclosure is required for all displays of price covered by the Act."**
> — Office of the Attorney General of the State of New York, letter to Maplebear Inc. d/b/a
> Instacart, January 8, 2026, p.3

That page **contains the exact mandated string** and the AG ruled it non-compliant. Both specs
return `true` on it (test `PROX1`). Neither spec requires the string to be anywhere near a price —
a page with the string and **no price at all** is reported identically to a compliant price display
(`PROX2`). Note also that Rakoff's opinion records there is **no font or format requirement**
("may be in any font or format, so long as it is easily visible"), so styling cannot be used as a
proxy for conspicuousness either. The brief states the rule in its own words at §6:

> **"The lesson for compliance teams: having the string somewhere is not compliance."**

The README says the extension reports "whether it carried the … disclosure … law requires". The
brief says that question cannot be answered by finding the string. These are the same repository.

**(b) "NY/MD/CT law now requires" is false for two of the three states, today.**

| State | Operative from | True on 2026-09-19? |
|---|---|---|
| NY | 2025-11-10 | ✅ yes |
| MD | **2026-10-01** | ❌ **no — 12 days away** |
| CT | **2027-07-01** | ❌ **no — 21 months away** |

The repo knows this: the brief's §1 action table is correctly organised as *"Before 2026-10-01 —
Maryland bites, **and only Maryland**"*. The README's present tense overstates it. A privacy tool
whose stated discipline is not overclaiming should not describe two future statutes as current law
in the sentence that sells the feature.

**(c) The location problem the task raised is real but is already solved elsewhere in this
codebase.** Nullecho has no geolocation by design — I confirmed there is no region, timezone-to-
location, or locale inference anywhere in `background.js`, `options.js` or `popup.js`. So the
extension cannot know which state's law binds *this user*. **But `siteReport()` already has the
right pattern:** `ctx.isCalifornian` is a **user-declared setting** (`s.settings?.isCalifornian`,
`popup.js:161`, `options.js:195`) — not inferred. A state picker for the Checkout Report should
reuse that exact precedent.

> ⚠️ Adjacent finding, outside my lane but same failure mode: `isCalifornian` is **read in three
> places and written in none.** `grep -rn isCalifornian ext/src/background.js ext/options/drop.js`
> returns nothing, and there is no control for it in `options.html`. It is therefore always falsy
> in a real install, which means the DROP remedy gated on it at `linkage.js:742,795,807` never
> fires. Worth a separate look by whoever owns the DROP lane.

**Wording that is supportable** (replaces the README bullet and the store-listing clause):

> **Checkout Report** — which companies a shopping page contacted before it quoted you a price,
> which fingerprinting surfaces it read, and whether the page displays one of the algorithmic-pricing
> disclosures required by New York (in force), Maryland (from 2026-10-01) or Connecticut (from
> 2027-07-01). It reports what is on the page. It cannot tell you whether a business is complying —
> that depends on where you live and where the notice sits relative to the price.

---

## P1 — Research integrity

The two documents going to law firms and reporters in Jason's name are, on the whole, **unusually
disciplined**. §8 of the brief separates read-in-the-original from secondary from inference from
could-not-verify, and pre-emptively flags most of what I would otherwise have raised — including
the Robinson-Patman cites it deliberately omits, the NJ chapter number resting on secondary
sources, and the unread ABA article. `BRIEF-PITCH.md`'s "What not to claim" section is the right
instinct. The findings below are what survived that filter.

### Verified against primary sources this session

| Claim | Verdict | Evidence |
|---|---|---|
| The three mandated strings are internally consistent everywhere in the repo | ✅ **CONFIRMED** | Extracted every `THIS PRICE WAS …` occurrence across all `.md` files; 25 hits, zero contradictions. The only "wrong" versions appear inside explicit *do-not-cite* warnings (brief §2.3 "Correction to circulating summaries"). |
| AB 2564 committee analysis, the brief's single most load-bearing quote (§5.2) | ✅ **CONFIRMED verbatim** | Fetched `apcp.assembly.ca.gov/system/files/2026-03/ab-2654-ward-apcp-analysis.pdf` and read the PDF. Header: **"AB 2564 / Date of Hearing: March 25, 2026 / ASSEMBLY COMMITTEE ON PRIVACY AND CONSUMER PROTECTION / Rebecca Bauer-Kahan, Chair / AB 2564 (Ward) – As Amended March 23, 2026"**. Line 604: *"In addition, a large coalition of advocacy organizations notes:"* followed at 606-608 by the quoted sentence **word for word**. It sits under **ARGUMENTS IN SUPPORT**, as the brief states. Preparer line 739: **"Analysis Prepared by: Julie Salley / P. & C.P."** — the attribution is right. |
| The second AB 2564 quote, *"protection from discrimination for exercising these rights"* | ✅ **CONFIRMED verbatim** | Same PDF, lines 49-50, in the EXISTING LAW section describing the CCPA. |
| `8:24-cv-02684` and "Judge Fred W. Slaughter" are internally consistent | ✅ consistent | The `FWS` in the full docket `8:24-cv-02684-FWS-ADS` is Slaughter; the brief names the judge at §4.2 and uses the short docket form elsewhere. |

> ℹ️ **Do not "fix" the AB 2564 URL.** The filename reads `ab-2654` — digits transposed — but that
> is **California's own typo in the published slug**, not the brief's. The URL resolves; a reader
> who corrects it to `ab-2564` gets a 404. Worth a parenthetical in §8.1 so nobody helpfully breaks it.

### SHOULD-FIX 1 — `BRIEF-PITCH.md` states a perishable litigation fact that expired 15 days ago

`BRIEF-PITCH.md:89-90` presents the Southern Glazer's posture as current:

> **"…it has a live Robinson-Patman suit against Southern Glazer's (No. 8:24-cv-02684, C.D. Cal.,
> stayed for settlement through September 4)…"**

The brief itself flags this at §8.4: *"The Southern Glazer's stay expires **2026-09-04**, so this is
perishable — re-check before citing."* Today is **2026-09-19**. The pitch is aimed at Bloomberg Law,
whose in-house-counsel readership will check the docket, and `BRIEF-PITCH.md:160-161` specifically
warns *"they will want the case posture exactly right."* Re-check before the next send and either
update the parenthetical or drop it — the argument (the FTC litigating Robinson-Patman while writing
about personalized pricing without mentioning it) does not depend on the stay's status.

### SHOULD-FIX 2 — The brief's §1 contains a relative date that is now four weeks stale

`ALGORITHMIC-PRICING-COMPLIANCE-BRIEF.md:118-120`:

> **"The strongest evidence is that the FTC is currently litigating a Robinson-Patman case and, **two
> days ago**, addressed personalized pricing in a policy statement that never mentions the Act."**

"Two days ago" was true relative to the 2026-08-21 draft date. The document now carries a
2026-09-16 refresh banner and is being sent out in September. Replace with the absolute date
(2026-08-19). Relative dates in a document that gets refreshed are a recurring hazard — worth one
pass for others.

### SHOULD-FIX 3 — The docket number is cited without the judge initials in all four places

All four occurrences (`brief:498, 660, 1199`, `BRIEF-PITCH:89`) read `8:24-cv-02684`. The full
docket is `8:24-cv-02684-FWS-ADS`. The short form is a legitimate cite and the brief names Judge
Slaughter separately at §4.2, so this is **not an error** — but a legal-outlet reader who searches
the bare number gets a weaker result than one who searches the full one, and §8.1 says the number
was *"confirmed against the FTC's own hosted complaint PDF"*, which would carry the initials. Use
the full form at least once, at first mention.

### SHOULD-FIX 4 — The sweep recommends telemetry that the build gate forbids and the privacy policy rules out

`NY-349A-COMPLIANCE-SWEEP.md:117-118`, under "Exact detection approach":

> **"4. **Falsifiable bonus intact:** opt-in aggregate telemetry of where the string appears would be
> the first field data on §349-a compliance — and it reveals *retailers*, not users."**

This cannot be built. `ext/src/manifest.test.js` **fails the build** if any `fetch`,
`XMLHttpRequest`, `sendBeacon`, `WebSocket`, `EventSource` or `importScripts` appears, or if a
`fetch()` argument is not a bundled `chrome.runtime.getURL(...)` — documented at
`PRIVACY-POLICY.md:24-38`. `README.md:18-20` makes the absolute claim: *"Nullecho collects nothing —
no telemetry, no phone-home, no account, no analytics. That's verified and enforced by a test that
fails the build if a network call is ever added."* The "opt-in" qualifier does not rescue it: the
gate is mechanical and unconditional, and the no-telemetry property is the project's central trust
claim. Strike the bullet, or reframe it as *"a thing another project could do; we deliberately
cannot"* — which is a better story anyway and fits the D16 house style.

### SHOULD-FIX 5 — The sweep's headline recommendation is now the source of a shipped false claim

`NY-349A-COMPLIANCE-SWEEP.md:5-13` and §5 return **"Build the detector — yes. The gate passes."**
That verdict is sound on its own terms. But it is dated 2026-08-21, it is the document the docs
were written against, and it carries no build-state marker. Add a dated status line at the top —
*"Gate passed 2026-08-21. **Not implemented as of 2026-09-19.** Nothing in `ext/` detects this."* —
so the next reader cannot mistake the verdict for the feature. This is the specific mechanism that
produced BLOCKER 1.

### NICE (downgraded from SHOULD-FIX) — D16's NY date shorthand is ambiguous; the brief itself is *correct*

> ✏️ **I had this wrong on the first pass and am correcting it.** I initially flagged a conflict
> between D16 and the brief. Primary-source verification shows **the brief is right, and is more
> precise than the enforcing agency's own letter.** There are three genuinely distinct NY dates:
> **enacted 2025-05-09** (L. 2025 ch. 58 pt. X), **effective 2025-07-08** (the 60th day — Part X §4:
> *"This act shall take effect on the sixtieth day after it shall have become a law"*), and
> **enforcement began 2025-11-10** (the AG's voluntary stay lapsing). The brief's §1 table
> ("Enacted May 2025") and §2.1 ("Law took effect 2025-07-08; enforcement began 2025-11-10") are
> **both correct**. Most law-firm alerts say the law "took effect November 10" — and so does the NY
> AG's own 2026-01-08 letter (*"which took effect on November 10, 2025"*). The brief is more
> accurate than its own primary source on this point. That is worth knowing, not fixing.

What remains is small: `docs/DECISIONS.md:256` writes **"NY GBL §349-a (law 2025-07-08, *enforced
2025-11-10*…)"**. "law 2025-07-08" reads as the enactment date to someone who has not read the
brief. D16 is the design record a future implementer opens first; one word — "effective
2025-07-08" — removes the ambiguity. **NICE, not SHOULD-FIX.**

### NICE — Two small additions that would strengthen the brief

Both discovered during verification; neither is an error in the brief.

1. **`NRF v. James` was dismissed *with prejudice*.** The brief §2.1 says Rakoff *"granted the
   motion to dismiss 2025-10-08"*. The opinion at p.28 says: *"plaintiff's claims are **DISMISSED
   with prejudice**."* Adding two words strengthens the posture description at no cost.
2. **The § 349-a slot was previously occupied** — see the New York verification table. A reader
   checking a pre-2025 codification of "GBL § 349-a" gets the Observant Consumer Protection Law,
   which was renumbered to § 349-h to make room. One sentence inoculates a legal reader against a
   confusing dead end.

### SHOULD-FIX 6 — The brief's §6 detection advice propagates the FP4 defect into the client-facing document

Brief §6, "A note on detection", lists **`using your personal data`** as a *"practical anchor"* and
concludes text matching *"is sufficient"*. Per test `FP4` that anchor fires on ordinary privacy-
policy prose. This paragraph is in the document being offered to law firms and to IAPP as a
compliance matrix — an audience that may act on it to build their own monitoring. Either qualify it
(*"as an anchor for further matching, never standalone — it appears in most privacy policies"*) or
replace the list with the per-regime full-string approach in BLOCKER 2. The rest of that paragraph
— the dead `price setting device` anchor, CT's unmatchable "substantially similar" — is correct and
useful.

### SHOULD-FIX 7 — Unresolved: whether New York's One Fair Price Act was delivered to the Governor

The brief (§8.1, §8.4) and `BRIEF-PITCH.md:97-99, 227-228` state on the authority of the official
Assembly and Senate action histories that A.9349-B passed both houses 2026-06-04 and was **not
delivered**, and instruct the reader not to repeat the contrary ICSC claim. An independent research
pass this session reports the opposite — delivered and unsigned, with a 2026-12-31 deadline — but
sources that to **secondary reporting**, not the official pages. **Unresolved.** The brief's
position is the better-sourced one, and `BRIEF-PITCH.md` already names this as the most perishable
fact in the pitch. Resolve it against the official bill pages before any send: if the bill *was*
delivered, the pitch's bullet 1 framing and the brief's §8.4 both need rewriting, and the
"official pages contradict ICSC" line has to come out.

### The headline on research integrity

**All four state statutes were verified directly against their enacted text this session — every
mandated string, effective date, scope, penalty and private-right provision the brief asserts is
correct.** See §"Statute verification". For a 16,000-word document assembled without counsel, that
is a strong result, and it is worth saying plainly because the P0 findings above are harsh about the
*product* and should not be read as doubt about the *research*. The research is the better half of
this repo.

Three things improved on it: the § 349-a renumbering landmine, "with prejudice", and the one
unresolved conflict below.

### Could not verify in this pass

- **🔴 The One Fair Price Act's delivery status** — an open conflict between the brief's official-
  record position and a secondary report. See the New York verification table. This is the most
  consequential open item, and `BRIEF-PITCH.md` already requires it be re-checked on the morning of
  sending. Do that.
- **Whether the Second Circuit has ruled in *NRF v. James* since 2026-09-16.** High confidence it
  has not — CourtListener's CA2 opinion database is current through at least 2026-08-05 and
  contains no NRF opinion, and the docket shows `dateArgued: null`/`dateTerminated: null`. But the
  docket itself was last refreshed 2026-05-15, so this is not certified. PACER or ACMS would
  settle it. The brief's careful wording holds either way.
- **The other-states sweep, the FTC statement, CA AB 2564, and the full Southern Glazer's docket** —
  passes still running at time of writing. These bear on SHOULD-FIX 1 and 3 only.
- **The NJ chapter number `P.L. 2026, c. 65`** — the Third Reprint carries no chapter number, so
  this remains exactly as secondary as the brief already says it is (§8.2).
- **The two earlier links in the Connecticut repeal chain** (P.A. 26-64 § 11; P.A. 26-100 § 66).
  § 19 of the operative act confirms the second repeal on its face, and every fact the detector
  depends on is settled by 26-130 itself, so I did not fetch the other two PDFs.
- Everything the brief lists in §8.4. I did not attempt to close those; they are honestly flagged
  and that section is a model of how to do it.

---

## Statute verification

### Connecticut — ✅ FULLY VERIFIED against the primary source, every claim correct

This was the item flagged as *"corrected once already and load-bearing for the compliance brief."*
I fetched the enacted act directly — `cga.ct.gov/2026/ACT/PA/PDF/2026PA-00130-R00HB-05563-PA.PDF`,
32 pages, the exact file the brief cites at §8.1 — and extracted the text. **Every Connecticut
claim in `DECISIONS.md` D16, the brief §2.3 and `BRIEF-PITCH.md` checks out verbatim.**

> ⚠️ `cga.ct.gov` serves an incomplete TLS chain — `WebFetch` fails with *"unable to verify the
> first certificate."* `curl -L` works. Worth noting for anyone re-verifying: the failure is the
> server's cert chain, not a dead link.

| Claim | Verdict | Verbatim, from the act |
|---|---|---|
| Mandated string is `THIS PRICE WAS INCREASED USING YOUR PERSONAL DATA` | ✅ **CONFIRMED** | p.24-25: *"…shall include in such online advertisement, promotion, label, statement, display, image, offer or announcement the following disclosure, or a substantially similar disclosure: **"THIS PRICE WAS INCREASED USING YOUR PERSONAL DATA"**."* |
| "or a substantially similar disclosure" — CT's wording is not fixed | ✅ **CONFIRMED** | Same sentence, above. This is why CT is undetectable by exact match (BLOCKER 2, `FN3`). |
| Effective **2027-07-01** | ✅ **CONFIRMED** | Line 841: *"**Sec. 11. (NEW) (Effective July 1, 2027)** (a) As used in this section:"* |
| § 19 repeals P.A. 26-100 § 44 | ✅ **CONFIRMED** | *"**Sec. 19. Section 44 of public act 26-100 is repealed.** (Effective from passage)"* |
| Approved **2026-06-04** | ✅ **CONFIRMED** | *"Governor's Action: **Approved June 4, 2026**"* |
| **"price setting device" appears nowhere** in live CT law | ✅ **CONFIRMED** | Zero occurrences in the 32-page act. The brief's central Connecticut correction is right. |
| Placement standard is "readily visible to the average consumer" | ✅ **CONFIRMED** | § 11(b)(2): *"The disclosure required under subdivision (1) of this subsection shall be **readily visible to the average consumer**."* |
| § 42-518 companion rights-disclosure duty | ✅ **CONFIRMED** | *"Any person doing business in this state who is required to include such disclosure shall disclose to consumers their rights under section 42-518 of the general statutes."* |
| Bona-fide-market-price exception to the disclosure | ✅ **CONFIRMED** | *"No disclosure shall be required under this subdivision if the advertised, promoted, labeled or published price is the bona fide market price."* |
| § 11 strikes "in-person" from "retail seller", restoring the ban to online retail (brief §2.3 item 8) | ✅ **CONFIRMED** | § 11(a)(8): *"means a retailer, as defined in section 12-407 … **to the extent such retailer is engaged in making sales, at retail, of tangible personal property**, and (B) includes, but is not limited to, a retail food establishment"*. **"in-person" appears zero times in the entire act.** |
| "Surveillance pricing" drives both duties; tech-collected personal data, directly or via a third party | ✅ **CONFIRMED** | § 11(a)(9), quoted in full in the act at lines 878-887 — matches the brief's §2.3 table description word for word, including the biometric/camera/device-tracking/sensor list and the "directly or indirectly by gathering, purchasing or otherwise acquiring" clause. |
| Ban binds "retail seller or third-party delivery service" | ✅ **CONFIRMED** | § 11(c)(1): *"no retail seller or third-party delivery service doing business in the state shall engage in surveillance pricing"* |
| "Personal data" / "consumer" take their meaning from Conn. Gen. Stat. § 42-515 | ✅ **CONFIRMED** | § 11(a), cross-reference to "section 42-515 of the general statutes" |

**Not independently re-checked by me:** the two earlier links in the repeal chain (P.A. 26-64 § 11
and P.A. 26-100 § 66), since § 19 of the operative act confirms the second repeal on its face and
the string/effective-date/definition questions that matter for the detector are all settled by
26-130 itself.

### Maryland — ✅ FULLY VERIFIED against the primary source, every claim correct

Fetched `mgaleg.maryland.gov/2026RS/Chapters_noln/CH_154_hb0895e.pdf` — the chapter law the brief
cites at §8.1 — and extracted the text. **Maryland bites on 2026-10-01, twelve days from today, and
every claim about it in the brief and D16 is right.**

| Claim | Verdict | Verbatim, from the chapter law |
|---|---|---|
| **The string contains `OR BY`** — this is what breaks Spec A (BLOCKER 2, `FN1`) | ✅ **CONFIRMED** | § 13-322(C): *"…A CLEAR AND CONSPICUOUS DISCLOSURE WITH THE FOLLOWING STATEMENT: **"THIS PRICE WAS SET BY AN ALGORITHM OR BY USING YOUR PERSONAL DATA"**."* |
| Binds any **"merchant"**, no sector or size threshold | ✅ **CONFIRMED** | § 13-322(C): *"**A MERCHANT** MAY NOT SET THE PRICE OF A CONSUMER GOOD OR SERVICE…"* |
| Trigger is disjunctive — **dynamic pricing *or* personal data** | ✅ **CONFIRMED** | *"…USING **DYNAMIC PRICING OR PERSONAL DATA** AND DIRECTLY OR INDIRECTLY ADVERTISE OR PROMOTE, INCLUDE ON A LABEL, OR PUBLISH ANY OTHER COMMUNICATION CONTAINING THE PRICE…"* |
| Effective **2026-10-01** (not 2025) | ✅ **CONFIRMED** | § 2: *"…shall take effect ~~from the date it is enacted~~ **shall take effect October 1, 2026**."* |
| Approved **2026-04-28** by the Governor | ✅ **CONFIRMED** | *"Approved by the Governor, **April 28, 2026**."* |
| Codified at Com. Law **§§ 13-321 and 13-322** | ✅ **CONFIRMED** | Enacting clause: *"Section 13–321 and 13–322"* |
| **45-day mandatory cure** before enforcement, in both sections | ✅ **CONFIRMED** | § 13-321(D)(2) and § 13-322(D)(2), identical: *"THE DIVISION SHALL PROVIDE THE ALLEGED VIOLATOR **45 DAYS** AFTER THE NOTICE OF VIOLATION IS RECEIVED TO CURE THE VIOLATION."* |
| **Express bar on a private right of action** at § 13-321(e) | ✅ **CONFIRMED word for word** | § 13-321(E): *"**THIS SECTION MAY NOT BE CONSTRUED TO AUTHORIZE A PRIVATE RIGHT OF ACTION UNDER THIS SECTION OR ANY OTHER LAW.**"* |
| The § 13-408 amendment removes §§ 13-321/13-322 from the MCPA's general private action | ✅ **CONFIRMED** | § 13-408(a), newly added: *"THIS SECTION DOES NOT APPLY TO A VIOLATION OF § 13–321 OR § 13–322 OF THIS TITLE."* |
| § 13-321 ban limited to food retailers **≥ 15,000 sq ft** + third-party food delivery | ✅ **CONFIRMED** | *""FOOD RETAILER" MEANS A MERCHANT THAT OPERATES A BUSINESS ESTABLISHMENT THAT: (I) **HAS A MINIMUM OF 15,000 SQUARE FEET**; AND (II) SELLS FOOD THAT IS EXEMPT FROM THE SALES AND USE [TAX]…"* |
| Brief §2.2's "drafting artifact" note — the bill began as an **emergency measure** and ended with an Oct 1 date | ✅ **CONFIRMED, and visible in the text** | The strike-through survives into the chapter PDF exactly as the brief describes: *"this Act is an emergency measure … and shall take effect ~~from the date it is enacted~~ shall take effect October 1, 2026."* A reader quoting the struck clause would get the effective date wrong — the brief's warning to read the strike-through carefully is well founded. |

**Net effect on BLOCKER 2:** `FN1` is not hypothetical. In twelve days the broadest disclosure duty
of the three goes live, its string is materially different from New York's, and the detector spec in
`NY-349A-COMPLIANCE-SWEEP.md` §5 would not match it.

### New York — ✅ VERIFIED, and the brief is *more* accurate than the AG's own letter

Verified against Judge Rakoff's opinion (ECF 44), the enacted bill text (Ex. A to the complaint),
the AG's stay letter (ECF 16), the CourtListener dockets, and the AG's 2026-01-08 Instacart letter,
which I fetched and read directly (`ag.ny.gov/sites/default/files/letters/letter-to-instacart-on-pricing-practices-letters-2026.pdf`).

> ⚠️ `nysenate.gov` is behind a Cloudflare interstitial — `curl` with a browser UA returns *"Just a
> moment… Enable JavaScript and cookies to continue."* This **confirms the brief's own §8.2 note**
> that the Senate site could not be fetched directly. The workaround is Rakoff's opinion, which
> quotes § 349-a(2) in full.

| Claim | Verdict | Evidence |
|---|---|---|
| Mandated string `THIS PRICE WAS SET BY AN ALGORITHM USING YOUR PERSONAL DATA` | ✅ **CONFIRMED twice over** | AG letter p.3 quotes § 349-a(2): *"…a clear and conspicuous disclosure that states: **"THIS PRICE WAS SET BY AN ALGORITHM USING YOUR PERSONAL DATA"**."* Same in the opinion. |
| Codified at **GBL § 349-a**, added by **Part X** of Ch. 58 of the Laws of 2025 | ✅ **CONFIRMED** | AG letter: *"New York's Algorithmic Pricing Disclosure Act, G.B.L § 349-A"*. Enacted as L. 2025, ch. 58, pt. X, § 1 (S.3008-C). |
| Penalty ≤ $1,000/violation, AG-only, cease-and-desist prerequisite, no private right | ✅ **CONFIRMED** | § 349-a(4): *"the court may impose a civil penalty of not more than one thousand dollars for each violation."* Rakoff: *"The Act is enforceable only by the New York State Attorney General."* |
| Placement: same medium, "on, at, or near and contemporaneous with every" price | ✅ **CONFIRMED** | § 349-a(1)(b), quoted in the opinion. |
| *NRF v. James*, No. 1:25-cv-05500 (S.D.N.Y.), MTD granted **2025-10-08** under *Zauderer* | ✅ **CONFIRMED** — and **with prejudice** | Opinion p.28: *"defendant's motion to dismiss … is GRANTED and plaintiff's claims are **DISMISSED with prejudice**. The motion for a preliminary injunction … is DISMISSED as moot."* The brief omits "with prejudice"; worth adding, it strengthens the posture. |
| Appeal 2d Cir. **No. 25-2818**, docketed 2025-11-05, fully briefed since **2026-02-24**, no ruling | ✅ **CONFIRMED** (high confidence) | CA2 docket: `dateArgued: null`, `dateTerminated: null`; last entry #65 is NRF's 2026-02-24 reply brief. Caveat: that docket was last refreshed 2026-05-15, but CourtListener's CA2 **opinion** database is current through at least 2026-08-05 and contains no NRF opinion. The brief's careful *"fully briefed since 2026-02-24; no ruling and no recorded argument"* — and its refusal to say "not calendared" — **holds up**. |
| **§ 349-a is enforceable today** | ✅ **CONFIRMED** | Never enjoined; PI denied as moot; no stay pending appeal. |
| "Enforced 2025-11-10" — what happened that day | ✅ **CONFIRMED, and the mechanism matters** | Not a court injunction lapsing. The **AG voluntarily agreed** (ECF 16, 2025-07-14) to *"a general stay of enforcement … until thirty days after this Court's final order"* on the PI motion, and not to enforce retroactively. Ruling 2025-10-08/09 + 30 days = **2025-11-10**. |

**🔍 New finding the repo does not have — and it is a citation landmine.**
**The § 349-a slot was already occupied.** Part X, § 1 of Ch. 58 reads:

> **"Section 349-a of the general business law is renumbered 349-h and a new section 349-a is added
> to read as follows: § 349-a. Pricing."**

The pre-existing § 349-a (the Observant Consumer Protection Law) now sits at **§ 349-h**. The brief's
cite is correct, but **any source predating May 2025 that says "GBL § 349-a" means something else
entirely**, and a reader checking an old codification will get the wrong statute. The precise cite
worth adopting: *N.Y. Gen. Bus. Law § 349-a ("Pricing"), added by L. 2025, ch. 58, pt. X, § 1
(S.3008-C), eff. July 8, 2025.* One sentence in §2.1 or §8.2 would inoculate a legal reader against
this, and it is the kind of detail that earns a second email from a Bloomberg Law reporter.

**⚠️ Related trap for anyone re-verifying:** the bill exhibit on the docket is the **S.3008-B**
print, which differs materially from the enacted **C** print — B used "consumer data"/"person" and
framed a violation as a deceptive act under § 349, which **would have imported a private right of
action**. The enacted version dropped that, which is exactly why there is no PRA today. Do not
quote the B print as law.

**🔴 UNRESOLVED CONFLICT — the One Fair Price Act's delivery status.** The brief (§8.1, §8.4) and
`BRIEF-PITCH.md:97-99, 227-228` state that A.9349-B passed both houses 2026-06-04 and was **not
delivered to the Governor**, and explicitly instruct the reader not to repeat the ICSC claim that it
was. The research pass reports the opposite — that it **is** delivered and unsigned, with a
2026-12-31 deadline — but flags that as resting on **secondary reporting**, not the official pages.
**I could not resolve this.** The brief's position is the better-sourced one (official Assembly and
Senate action histories beat trade-press summaries), and `BRIEF-PITCH.md` already names this as
the most perishable fact in the pitch and requires re-verification on the morning of sending. Treat
it as genuinely open, resolve it against the official bill pages before any send, and note that the
two candidate answers lead to opposite pitch framings.

### New Jersey — ✅ VERIFIED against the Third Reprint, every claim correct

Fetched `pub.njleg.gov/bills/2026/A4500/4085_R3.PDF` — the exact file the brief cites at §8.1.
New Jersey's reprint notation makes the amendment history readable on its face: `1[…]1` is struck
by the First Reprint, `2[…]2` by the Second, `3[…]3` by the Third, and unbracketed superscripted
text was added at that reprint.

| Claim | Verdict | Verbatim |
|---|---|---|
| **Ban only — no mandated disclosure string anywhere in the act** | ✅ **CONFIRMED** | Zero occurrences of "THIS PRICE WAS" (or any mandated-string construction) in the 7-page act. NJ is correctly excluded from the detector. |
| **The $50,000 minimum was struck before enactment** | ✅ **CONFIRMED, and visible in the text** | § 7(c): *"obtain for each ¹negligent or greater¹ violation, in addition to any other penalty provided by law, actual monetary damages incurred from the violation **³[or $50,000, whichever is greater]³**"* — the `3[…]3` brackets are the Third Reprint deletion. The brief's warning not to repeat the widely-reported $50,000 figure is **correct**. |
| "Groceries and other foodstuffs" reaches **paper products, household cleaning items, health and beauty products, pet foods and supplies** | ✅ **CONFIRMED word for word** | *""Groceries and other foodstuffs" means dairy products, meat and delicatessen products, produce products, seafood products, carbonated beverages, coffee and other beverages, snack foods, candy products, baked products, **paper products, household cleaning items, health and beauty products**, frozen foods, **pet foods and supplies**, and any other edible product not previously listed, except for any food or beverages prepared for immediate consumption on or off the premises of a food service establishment."* |
| § 3(c) purpose limitation | ✅ **CONFIRMED** | *"To the extent a person employs personal data to offer a difference in price on groceries and other foodstuffs pursuant to subsection b. of this section, **that personal data shall not be used for any other purpose ³without the consumer's consent³**."* The consent proviso was **added** at the Third Reprint — worth noting, since the pre-reprint version was an absolute bar. |
| Effective **2027-08-01** (13th month), ESL moratorium **2027-02-01** (7th month), § 5 study immediate | ✅ **CONFIRMED** | § 9: *"This act shall take effect on the first day of the ¹[seventh] **13th**¹ month next following the date of enactment, except that: the provisions of **section 4 shall take effect on the first day of the seventh month** next following the date of enactment; the provisions of **section 5 shall take effect immediately**…"* With enactment 2026-07-23, those resolve to 2027-08-01 and 2027-02-01 exactly as the brief states. |
| Source is the ACS for A.4085/A.4523, Third Reprint | ✅ **CONFIRMED** | Footer: *"[3R] ACS for A4085 ONYEMA, QUIJANO"* |
| Chapter designation **P.L. 2026, c. 65** | ⚠️ **still secondary** | The reprint carries no chapter number — as the brief already concedes at §8.2. Unchanged by this pass. |

### Other states, FTC, CA AB 2564, Southern Glazer's docket — verification in progress

The enacted-only 50-state sweep, the FTC Proposed Enforcement Policy Statement (P034101), the
California AB 2564 death-on-concurrence check, and the full Southern Glazer's docket
(`8:24-cv-02684-FWS-ADS`) had not returned when this document was written. **Nothing in the P0
findings depends on them.** Two of them bear on SHOULD-FIX items 1 and 3 only.

Primary-source passes are still running (NY GBL § 349-a + *NRF v. James* Second Circuit posture;
MD Ch. 154 / HB 895 and the NJ Fair Price Protection Act; and the enacted-only sweep of other
states plus the FTC statement, CA AB 2564 and the Southern Glazer's docket). **Not yet confirmed —
do not treat the table in `docs/DECISIONS.md` D16 as independently verified for those states on the
strength of this review.**

The one item I would prioritise re-checking before anything ships: **Maryland's `OR BY`**. The
detector's Maryland behaviour (BLOCKER 2, `FN1`) turns entirely on whether the enacted string is
`SET BY AN ALGORITHM **OR BY** USING YOUR PERSONAL DATA` rather than New York's wording, and
Maryland takes effect in 12 days.

---

## And then some — what would make this feature worth shipping

The substrate is better than the feature. `siteReport()` (`ext/src/linkage.js:221`) already
produces, per site: named **owner companies** behind each blocked domain, **request counts**,
**cookie-carrying third parties**, the **fingerprinting surfaces actually read** with per-API counts
(`fpSurfaceLabel`), category meanings, and GPC send state — with a deliberate
`honored: null` because the extension can prove it *sent* the signal and not that anyone acted on
it. That `honored: null` discipline is exactly the right model for a pricing disclosure, and it is
already in the codebase.

**NICE 1 — Make the positive signal the headline, not the negative.** The sweep's most useful
finding is that a whole category *does* comply (WSJ, Wired, The New Yorker, Albany Times Union,
NJ.com). "This page tells you its price was personalized — here is the notice, and here is what
that means" is a genuinely novel thing no other extension surfaces, it is a true statement, and it
rewards the complier instead of accusing the silent. Ship the positive case first; it is the one
with no legal exposure.

**NICE 2 — A keepable receipt.** When the string is found, let the user save a local record:
normalized matched text, the state regime matched, the URL, a UTC timestamp, the nearest
price-shaped token and its distance in characters, and the containing element's text. JSON to
`chrome.storage.local`, or a clipboard copy — no network, so the build gate is untouched. This is
the artifact a consumer actually needs if they ever complain to an AG, and it costs nothing to
produce. It also makes the feature falsifiable by its own users.

**NICE 3 — A per-state explainer that never claims which law binds *this* user.** Reuse the
`ctx.isCalifornian` precedent: a user-declared, optional, default-off state selector. With nothing
selected, show all three regimes and their effective dates neutrally. Never infer location. The UI
sentence should name the *page*, not the *user*: "This page carries New York's mandated wording" —
not "you are entitled to…". Ship the effective dates in the UI so the MD/CT future-tense problem
(BLOCKER 3b) cannot recur as the dates pass.

**NICE 4 — Personalization signals without the accusation.** The riskiest idea in the task brief,
and it is workable only with strict wording discipline. Nullecho can already observe that a page
read N fingerprinting surfaces and contacted M named third parties before a price rendered. Report
**exactly that**, as an observation with a timestamp, and stop:

> "Before this page showed a price, it read your canvas, your fonts and your screen metrics, and
> contacted 7 companies. It did not display an algorithmic-pricing notice."

That is three verified facts and one verified absence. What it must **never** say, in any form:
that the merchant is personalizing, that the merchant is breaking a law, that a disclosure was
"missing" or "required here", or that the user was charged more. Absence of the string is
consistent with the merchant simply **not personalizing** — which the brief argues is the *most
likely* explanation (§6) — and naming a merchant alongside an implied violation is the one thing in
this lane with real defamation exposure. A hard-coded banned-phrase list for this surface, checked
by a test, is the right enforcement mechanism; the repo already does this for the threat-model copy
(`STORE-LISTING.md:3-6`).

**NICE 5 — Two implementation notes for whoever builds it.**
- **There is no content script that can read rendered text today.** All three entries in
  `manifest.json` run at `document_start` — `shim-loader.js` (ISOLATED), `shim.js` (MAIN) and
  `gpc.js` (MAIN). At `document_start` the DOM text does not exist. A detector needs either a
  fourth content script at `document_idle` or a `MutationObserver` in the ISOLATED world, plus a
  re-scan on SPA navigation — checkout flows are overwhelmingly client-routed and a one-shot scan
  will miss the price step. Budget for this; it is not a `siteReport()` field.
- **Scan cost.** A naive `document.body.innerText` on every mutation is a real performance
  regression on exactly the heavy commercial pages this targets. Scope to text nodes within
  elements containing a currency-shaped token, or debounce hard. The repo has a performance harness
  (`docs/PERFORMANCE-2026-09-17.md`) — measure before shipping, per the project's own standing
  lesson that only rendering proves what users see.

---

## Ranked summary

| # | Rank | Finding |
|---|---|---|
| 1 | 🔴 **BLOCKER** | The Checkout Report is advertised in `README.md`, `docs/PRIVACY-POLICY.md` and `docs/STORE-LISTING.md` and implemented in **zero lines** of `ext/`. Never in any commit. Tracked as an open item in no release doc. |
| 2 | 🔴 **BLOCKER** | Both written specs (sweep §5, D16 substring list) are wrong: Spec A misses **Maryland** (live in 12 days — `OR BY` verified in the chapter law) and Connecticut; Spec B's `using your personal data` anchor fires on ordinary privacy-policy prose. 11 defects, each with a reproducing test. |
| 3 | 🔴 **BLOCKER** | "Whether it carried the disclosure … law now requires" is unsupportable: presence ≠ compliance (the NY AG rejected a page containing the exact string — quoted verbatim from the letter), no price-proximity check exists, and "now requires" is false for MD and CT today. |
| 4 | 🟠 SHOULD-FIX | **Unresolved:** the One Fair Price Act's delivery status. The brief says not delivered (official pages); a secondary report says delivered and unsigned. Opposite pitch framings. Resolve before any send. |
| 5 | 🟠 SHOULD-FIX | `BRIEF-PITCH.md` states the Southern Glazer's stay as running "through September 4" — expired 15 days ago; the brief's own §8.4 flags it as perishable. |
| 6 | 🟠 SHOULD-FIX | Brief §1 says the FTC statement issued "two days ago" — a relative date, now four weeks stale in a refreshed document. |
| 7 | 🟠 SHOULD-FIX | Docket cited as `8:24-cv-02684` in all four places; use `8:24-cv-02684-FWS-ADS` at first mention. |
| 8 | 🟠 SHOULD-FIX | Sweep §5.4 recommends "opt-in aggregate telemetry" — forbidden by `manifest.test.js` and contradicted by the README's central no-telemetry claim. |
| 9 | 🟠 SHOULD-FIX | The sweep's "Build the detector — yes" verdict carries no build-state marker; this is the mechanism that produced BLOCKER 1. |
| 10 | 🟠 SHOULD-FIX | Brief §6 offers `using your personal data` as a "practical anchor" to a law-firm audience; per `FP4` it is not one standalone. |
| 11 | 🟢 NICE | Add the **§ 349-a renumbering** note — the old § 349-a became § 349-h to make room. A pre-2025 codification of that cite is a different statute. |
| 12 | 🟢 NICE | *NRF v. James* was dismissed **with prejudice**; two words strengthen brief §2.1. |
| 13 | 🟢 NICE | D16's "law 2025-07-08" → "effective 2025-07-08". (Downgraded from SHOULD-FIX: the brief itself is correct, and more precise than the NY AG's own letter.) |
| 14 | 🟢 NICE | Lead with the positive signal — the complying publishers — not the absence. |
| 15 | 🟢 NICE | A keepable local receipt of the disclosure (text, regime, URL, timestamp, price distance). No network. |
| 16 | 🟢 NICE | Per-state explainer reusing the user-declared `isCalifornian` precedent; never infer location. |
| 17 | 🟢 NICE | Report personalization signals as observation only, with a test-enforced banned-phrase list. |
| 18 | 🟢 NICE | No content script can read rendered text today (all run at `document_start`); budget a `document_idle`/MutationObserver pass and measure its cost. |

**Adjacent, outside this lane:** `settings.isCalifornian` is read in three places and written in
none, so the DROP remedy gated on it (`linkage.js:742,795,807`) never fires in a real install.

*Read-only review. Nothing under `ext/` or any pre-existing file was modified. Tests:
`scratchpad/pricing/detector-spec.test.mjs`.*
