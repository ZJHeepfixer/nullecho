# DROP lane — read-only review, 2026-09-19

Scope: `site/drop/index.html` (live at <https://zjheepfixer.github.io/nullecho/drop/>) and every
extension surface that references DROP — `ext/options/drop.html`, `ext/options/drop.js`,
`ext/options/options.html`, `ext/popup/popup.js`, `ext/src/linkage.js`, `README.md`,
`docs/STORE-LISTING.md`, `docs/PRIVACY-POLICY.md`.

Nothing was modified. `ext/src/shim.js` was not read (another agent holds it) and is out of lane.

**Counts: 3 BLOCKER · 9 SHOULD-FIX · 8 NICE · 7 could-not-verify.**

Every claim below is checked against a source fetched today. Where our page and CalPrivacy disagree,
both sentences are quoted. The statute is Cal. Civ. Code § 1798.99.80 et seq. (Delete Act, SB 362),
fetched from leginfo and parsed locally.

Primary sources fetched 2026-09-19:

| Source | Result |
|---|---|
| `privacy.ca.gov/drop/` | 200 |
| `privacy.ca.gov/drop/how-drop-works/` | 200 |
| `privacy.ca.gov/drop/help-with-drop/` | 200 |
| `privacy.ca.gov/drop/personal-information-and-data-brokers/` | 200 |
| `privacy.ca.gov/drop/unique-identifiers/` | 200 |
| `privacy.ca.gov/drop/about-drop-and-the-delete-act/` | 200 |
| `leginfo…lawCode=CIV&title=1.81.48` (the Delete Act) | 200, parsed |
| `cppa.ca.gov/data_broker_registry/registry.csv` | 200, **603 rows parsed today** |
| Vermont Act 138 (2026) as enacted | 200, PDF parsed |
| `oregon.public.law/statutes/ors_646a.574` | 200 |
| `texas.public.law/…section_541.051` | 200 |

---

## 0. What already verifies — do not touch these

The page is better sourced than most of what is published about DROP. These held up against primary
sources and should survive any edit:

1. **603.** I parsed the live registry CSV today: exactly **603 data-broker rows, 603 unique names**.
   The page's Aug 20 snapshot is still exact a month later.
2. **Portal + status URLs.** `consumer.drop.privacy.ca.gov` and `/dropstatus` both 200 and both match
   CalPrivacy's own links.
3. **Jan 1 2026 launch.** CalPrivacy timeline: *"January 1, 2026 — DROP launches. Californians can
   start submitting requests."* Statute § 1798.99.86(a): *"By January 1, 2026…"*
4. **Aug 1 2026 + 45 days.** CalPrivacy: *"Starting August 1, 2026, data brokers must access DROP at
   least once every 45 days to begin processing deletion requests."* Statute § 1798.99.86(c)(1).
5. **The $200 citation is correct.** § 1798.99.82: *"An administrative fine of two hundred dollars
   ($200) for each deletion request for each day the data broker fails to delete information as
   required by Section 1798.99.86."* Both our pages cite § 1798.99.82 — right section.
6. **Required fields.** CalPrivacy verbatim: *"You only need to provide your name, date of birth, and
   ZIP code to submit a request."*
7. **Free.** *"Free — we will never charge you to use DROP"* + § 1798.99.86(b)(5).
8. **No renewal.** *"DROP is ongoing – not a one-time action."* + § 1798.99.86(d)(1). The extension
   page's "Why there's no 'renew' reminder" note is correct and well reasoned.
9. **Residency/domicile test** matches CalPrivacy word for word.
10. **Non-Californians cannot use it.** *"To be eligible to submit a deletion request in DROP, you
    must be a California resident."*
11. **No spam promise.** The page never claims you will stop getting spam. Notably CalPrivacy *does*
    make that claim (*"Reduced spam and scams"*) — our page is more conservative than the state's.
12. **Deploy is clean.** The live page is **byte-identical** to `site/drop/index.html` (`diff` empty).
13. **Not storing the DROP ID** (`ext/options/drop.html`) is the right call and correctly documented.

---

## BLOCKERS

### B1. The page promises deletion; the statute promises delete **or** suppress **or** exempt

Our page, hero lede:

> "They have to delete what they hold on you — **including the inferences they made about you** — and
> they have to keep doing it, every 45 days, indefinitely."

CalPrivacy, *How DROP works*, on the `Opted-out` status:

> "**Opted-out** — The data broker couldn't make an exact match based on the information you provided.
> For now, these data brokers **still have your data**, but they can no longer sell or share it."

Statute § 1798.99.86(c)(1)(B):

> "In cases where a data broker denies a consumer request to delete under this title because the
> request cannot be verified, **process the request as an opt-out of the sale or sharing** of the
> consumer's personal information…"

And on `Exempted` — CalPrivacy, *Personal information and data brokers*:

> "**Exempted** — These data brokers have data about you but haven't deleted it because it's exempt
> under the law. Examples include: **Public records, like vehicle or real estate ownership or voting
> records**…"

Statute § 1798.99.86(c)(2) is the authority for that.

CalPrivacy also lists, under **"What won't be deleted"**: first-party data, *"Exempted data"*, and
*"Publicly available data"*.

**Why this is a blocker.** The words "opted-out", "exempted" and "publicly available" appear nowhere
on `site/drop/index.html`. Publicly available data is the core inventory of people-search brokers —
the exact companies a reader has in mind. A user who files, waits, and then sees a screen full of
`Opted-out` and `Exempted` will conclude the page lied to them. The five-row "What this does not do"
table is the natural home and currently contains none of it.

**This is not a research gap — we already got it right elsewhere.** `ext/options/drop.html` covers
both outcomes plainly: *"Some brokers may lawfully keep data under statutory exemptions — you'll see
those as 'Exempted'"* and *"'Opted-out' is **not** deletion."* The public page is the one that
overstates. Port the extension's two bullets across.

### B2. The 45-day update lockout is undisclosed, while the page actively encourages deferring fields

Our page, step 2:

> "Email, phone, former/maiden names, mobile ad ID, connected-TV ID and VIN are all *optional* — each
> one you add widens the net brokers can match you against… **That trade-off is yours to make.**"

CalPrivacy, *Help with DROP*:

> "**Updates are allowed once every 45 days.**"

Statute § 1798.99.86(a)(4):

> "Allows a consumer to make a request to alter a previous request made under this subdivision
> **after at least 45 days have passed** since the consumer last made a request under this
> subdivision."

**Why this is a blocker.** "That trade-off is yours to make" reads as a choice you can revisit
whenever. It is not: submit with the bare minimum and you are locked out of adding your email address
for 45 days, during which brokers are processing against an under-specified profile. This is the one
place on the page where following our instruction as written produces a worse outcome than the
alternative. The fix is one clause — *gather everything before you submit, because you can only
update once every 45 days.*

`ext/options/drop.html` has the same gap in softer form: *"The last three take a minute to look up —
find them first **or add them later**."* Same correction applies.

### B3. "Collects nothing" is true of the page and false of the delivery

Our page, footer:

> "This guide is free and **collects nothing**. There's no analytics on this page, no tracker, no
> email capture, and no affiliate link. It would be absurd to track you here."

The page itself is clean — I verified this directly and it is genuinely impressive (see §2). But the
host is not. GitHub's own documentation, verbatim:

> "When a GitHub Pages site is visited, **the visitor's IP address is logged and stored for security
> purposes**, regardless of whether the visitor has signed into GitHub or not."

Response headers today confirm the hosting chain — `server: GitHub.com`, `via: 1.1 varnish`,
`x-served-by: cache-bur-kbur8200125-BUR` — so **GitHub and Fastly both see the visitor IP**.

`docs/PRIVACY-POLICY.md` does not close this. Its scope line is *"Nullecho is a browser extension"*
and it documents only extension behaviour; the words "website", "GitHub Pages", "hosting" and "IP"
appear nowhere in it. There is currently **no document anywhere in the repo that discloses this.**

**Why this is a blocker.** The entire product thesis is "collects nothing", and this is a privacy tool
being reviewed by people who check. An undisclosed host-side IP log under an absolute claim is the
first thing a hostile reviewer leads with, and it is cheap to fix: one sentence in the footer ("the
page itself collects nothing; GitHub, which hosts it, logs visitor IPs for security — we never see
them") plus a short "the website" section in `PRIVACY-POLICY.md`. Fixing it *strengthens* the claim,
because it shows the standard is being applied honestly rather than rhetorically.

---

## SHOULD-FIX

### S1. The popup's DROP nudge is gated to nobody — it works only in the demo fixture

Direct answer to "should the popup link to `/drop/` at all": **it doesn't, and that is correct** —
`ext/popup/popup.js:295` opens `api.runtime.getURL('options/drop.html')`, the bundled page. No network
request, no referrer, no host log. Keep that.

But the gating is broken. All three DROP nudges require `state.isCalifornian`:

- `ext/src/linkage.js:742` — `if (state.isCalifornian && !state.dropFiled)`
- `ext/src/linkage.js:795` — same
- `ext/src/linkage.js:807` — same

`isCalifornian` is **absent from `DEFAULT_SETTINGS`** (`ext/src/protocol.js:244`), and a grep across
all of `ext/` finds it in exactly six places — five reads and **one assignment**:

```
ext/popup/popup.js:600:  settings: { gpc: true, isCalifornian: true, dropFiled: false },
```

which is inside `const DEMO = {…}`, used only when `LIVE` is false. Nothing ever writes it in a real
build: no checkbox in `options.html`, no handler in `options.js`, no `SET_SETTINGS` patch anywhere.
So `!!s.settings?.isCalifornian` is permanently `false` and **all three nudges are unreachable in the
shipped extension**. No test covers it (`grep 'open-drop\|isCalifornian' **/*.test.js` → no hits).

This is the demo-renders-fine/dead-in-the-real-app trap. The design intent — don't push a
California-only feature at everyone — is right; it is currently gated to zero users. Either ship a
residency question or make the nudge state-neutral ("if you're in California…").

Mitigation: the options-page DROP card (`ext/options/options.html:273`) is always visible and is not
gated, so DROP remains discoverable. That is why this is SHOULD-FIX and not a blocker — but if the
popup nudge counts as a shipped feature, treat it as one.

### S2. "Information is not retained by DROP" is ambiguous, and the natural reading is wrong

Our page, step 3:

> "Residency is verified through the California Identity Gateway, and CalPrivacy states that
> **information is not retained by DROP**."

CalPrivacy's own main page says exactly that — *"You do not need to create a California Identity
Gateway account, and your information is not retained by DROP"* — so we are quoting fairly. But the
same page also says:

> "**The personal information you give to DROP is protected and stored** in a secure format."

And *Help with DROP* resolves the tension:

> "**The information you enter to verify your status as a California resident** is not shared with
> DROP." / "Information shared with the California Identity Gateway is only used to verify
> individuals' identities and data attributes, and is not stored thereafter."

Non-retention applies **only to the identity-verification data**. The deletion profile is stored. Our
sentence sits immediately after "You'll get an 8-digit DROP ID", so a reader maps "that information"
onto the name/DOB/ZIP they just typed. Same wording in `ext/options/drop.html`. Say "the residency
check doesn't keep what you enter; your deletion profile is stored, hashed."

### S3. Hashing is never mentioned — which makes our own caution box scarier than reality

Our page, "One caution":

> "You are handing identifying details to a state system in order to have data about you deleted…
> That's the trade; it's a reasonable one, but you should make it knowingly."

CalPrivacy, *Personal information and data brokers*:

> "DROP uses **hashing** so data brokers can match your data without exposing the original
> information. Once the data has been hashed, it's almost impossible to turn back into the original
> data."

with a worked example — what you enter `emailaddress@email.com`, what data brokers see
`IokUeTFtxXZQdmjolr4Kn//apUY5a6J8sVdHyiWqqUk=`.

We raise the objection and then withhold the best answer to it. Brokers never receive the plaintext.
For a page whose audience is privacy-motivated, this is the most load-bearing omission on it.

### S4. "You can add multiples of all data except your date of birth" is missing

CalPrivacy, *How DROP works*, verbatim:

> "It's your choice what information you provide. The more information you enter, the more likely your
> data will be deleted. **You can add multiples of all data except your date of birth.**"

`site/drop/index.html` never says this. Most people have three to five email addresses and two or
more phone numbers, and matching is the entire mechanism — this is among the highest-value single
sentences we could add. `ext/options/drop.html` already has it (*"You can enter multiples of
everything except date of birth"*); the public page does not.

### S5. Authorized agents — we say we couldn't confirm it, but the statute we cite answers it

Our page, "What this does not do":

> "Whether a commercial or professional agent may file on your behalf is *not* something we could
> confirm from CalPrivacy's guidance, so we're not claiming it either way."

`ext/options/drop.html` goes further: *"the approved regulations are published only as PDFs which we
did not parse."*

The answer is in the codified statute we already link as a source — § 1798.99.86(b)(8):

> "The accessible deletion mechanism **shall support the ability of a consumer's authorized agents to
> aid in the deletion request**."

and § 1798.99.86(b)(9):

> "The accessible deletion mechanism shall allow **the consumer, or their authorized agent**, to
> verify the status of the consumer's deletion request."

The hedge was honest but is now unnecessary, and it is in the wrong direction: the law *mandates*
authorized-agent support. What remains genuinely unverified is how the deployed UI exposes it — say
that instead.

### S6. "File once. It keeps working." omits every reason to come back

Our page, step 4 heading and body:

> "**File once. It keeps working.** … There's nothing to renew."

Correct on renewal. But CalPrivacy, *How DROP works*:

> "**Update your request and submit more data** — You can come back to edit your request or submit
> more data through your DROP profile. You may want to do so if you: **Change your name; Get a new
> phone number, email address, device (MAID), or car (VIN)**…"

A user who changes phone numbers has an unmatched identifier forever. `ext/options/drop.html` gets
this exactly right (*"check-ins, not renewals"*); the public page says nothing.

### S7. Light-theme contrast fails WCAG AA — measured, not estimated

Computed in-page from `getComputedStyle` on the live site:

| Element | Size/weight | Light | Dark |
|---|---|---|---|
| CTA button ("Open California's DROP portal") | 16px / 700 | **3.74:1 FAIL** | 11.45:1 |
| `.cta-sub` (portal caption) | 13px | **2.50:1 FAIL** | 4.01:1 |
| Footer text | 13.5px | **2.50:1 FAIL** | 4.01:1 |
| Table headers | 12px / 650 | **2.50:1 FAIL** | 4.01:1 |
| **"603 is a live count… August 20, 2026"** | 13px | **2.50:1 FAIL** | 4.01:1 |
| Body paragraphs | 16px | 17.38:1 OK | 16.33:1 OK |

AA needs 4.5:1 at these sizes (the CTA at 16px/700 is below the 18.66px large-text threshold, so 4.5:1
applies to it too). The `--faint` token (`#94a3b8` on `#fbfcfd`) is the culprit and is used for four
distinct things. Dark mode is marginal at 4.01:1; **light mode is the failure** — the recurring
pattern.

Worst instance: the provenance line that tells a reader *how old the 603 figure is* is the least
readable text on the page, at 2.50:1.

### S8. The "Not in California?" section sends most readers away with nothing to do

Three generic bullets (turn on GPC, check your state, block trackers) — no link to any state
registry, no directory, no named statute. Non-Californians are the majority of readers.
`ext/options/drop.html`'s non-CA path is substantially better (four sections, IAPP tracker, Privacy
Rights Clearinghouse). Port it. Verified, usable material is in §5 below.

### S9. Absolute claims that need one qualifying clause each

- *"covers the inferences they made about you"* (meta description + "The part people miss" box).
  CalPrivacy: *"This **could** include sensitive information as well as inferences"*, and: *"These
  inferences are also considered personal information subject to deletion by data brokers **who match
  your information in their records**."* Add "non-exempt" and the match condition.
- *"they have to keep doing it, every 45 days, **indefinitely**"*. § 1798.99.86(d)(1) conditions the
  ongoing duty on the broker having deleted under the section, and adds *"unless the consumer requests
  otherwise or the deletion is not required pursuant to paragraph (2) of subdivision (c)."*
- *"$200 Penalty per request, per day"*. Accurate, but it is an **administrative fine payable to the
  state**; the Delete Act gives no private right of action. A reader can easily infer they collect it.
- *"Other states may have their own deletion rights — they're generally **weaker** and filed
  per-company."* The *mechanism* is weaker; the *scope* is not obviously so — Oregon's delete right
  expressly reaches *"personal data the controller obtained from another source and derived data"*
  (ORS 646A.574). Drop "weaker", keep "filed per-company".
- *"it's been enforced — a company was fined for ignoring it"* (GPC bullet). Unsourced on the page and
  **not verified in this pass**. Either cite it or soften. The extension page handles GPC better, with
  a quantified 2025 USENIX finding.

---

## NICE

- **N1. The 90-day reporting window is missing** from the public page. CalPrivacy: *"Data brokers have
  up to 90 days to report how they processed your request."* Our *"silence isn't failure"* is right in
  spirit but sets no expectation for someone who checks on day 3 and sees 603 × `Pending`.
  `ext/options/drop.js:45` already carries the constant.
- **N2. Residency examples are ours, not CalPrivacy's.** We write *"so students, people on long work
  assignments, and snowbirds may still qualify"* in CalPrivacy's voice. CalPrivacy gives only factors:
  *"Location of your primary residence / Which state issued your driver's license or ID / Where you're
  registered to vote."* Reasonable reading — just attribute it to us.
- **N3. Login.gov is not mentioned** on the public page. CalPrivacy: *"You have the option to enter
  your information directly or to sign in using Login.gov. We suggest using the Login.gov option only
  if you already have an existing Login.gov account."* The extension page has this; the site page
  doesn't.
- **N4. You can narrow the request.** CalPrivacy: *"All current and future data brokers who are active
  in DROP are included in your deletion request **unless you narrow your request**"*, and you may
  uncheck brokers in the Delete data column. Statute § 1798.99.86(a)(3). Matters to anyone who wants a
  broker to keep a record they rely on.
- **N5. DROP requires JavaScript and cookies.** CalPrivacy, *Technical requirements*: *"Enable cookies
  and JavaScript."* Our audience disproportionately browses with JS restricted, and will hit a wall we
  never warned them about. (Our own page needs neither — see §2.)
- **N6. "Partial deletions" is conflated with "not a broker."** We write that companies you deal with
  directly *"are not brokers and aren't covered."* CalPrivacy: *"Some data brokers **also** collect
  information directly from you… Through DROP, they must delete information they got from other
  sources, but not information you provided directly."* Different thing.
- **N7. `603` is hardcoded in `<title>` and `<meta name="description">`.** Right today, verified. It
  will rot silently, and the two places least likely to be re-read are the two that carry it.
- **N8. Outbound links.** All seven resolve (200). But every one uses `rel="noopener"` with **no
  `target="_blank"`**, which makes `noopener` inert and navigates the user away from the walkthrough
  in the same tab, mid-task. The extension page correctly uses `target="_blank" rel="noopener
  noreferrer"`. Also: no `rel="noreferrer"` and no referrer policy, so Chrome's default
  `strict-origin-when-cross-origin` sends `https://zjheepfixer.github.io` as `Referer` to the state
  portal — origin only, not the path. Small, but nonzero for a "collects nothing" product.

---

## 2. Render results — the page is genuinely clean

Loaded the **live** URL in the Browser pane.

- **No deploy drift.** Live bytes `diff` clean against `site/drop/index.html`.
- **Exactly one network request: the document.** Nothing else. No Google Font, no CDN, no analytics,
  no image, no iframe, no favicon fetch. `document.querySelectorAll('link').length === 0`.
- **No console output at all** (not even a warning).
- **Zero JavaScript**: `document.scripts.length === 0`, zero inline `on*` handlers. The page therefore
  works with JS disabled by construction. It makes no JS-free claim, so there is no mismatch — but the
  claim would be safe to make.
- **Zero attack surface for data entry**: 0 `<form>`, 0 `<input>/<textarea>/<select>`.
- **Storage clean**: `localStorage.length === 0`, `sessionStorage.length === 0`, `document.cookie`
  empty after load.
- **Mobile 375px**: `scrollWidth === innerWidth === 375`, no horizontal overflow, no element wider
  than the viewport.
- **Both themes render**; light and dark palettes are both fully defined. Contrast is the only theme
  defect (S7).

Link check, all fetched:

| Link | Status |
|---|---|
| `consumer.drop.privacy.ca.gov` (×3 on page) | 200 |
| `consumer.drop.privacy.ca.gov/dropstatus` | 200 |
| `privacy.ca.gov/drop/` | 200 |
| `cppa.ca.gov/data_broker_registry/registry.csv` | 200, 603 rows |
| `cppa.ca.gov/regulations/drop.html` | 200 (is the DROP rulemaking repository — our "DROP system requirements" label is fair) |

---

## 3. Privacy of the page itself

- **Stores nothing.** Verified directly: no localStorage, no sessionStorage, no cookies.
- **Asks for nothing.** No form, no input of any kind.
- **No "copy this text" helper exists**, so there is no path by which user data could be embedded in
  one. (The extension page's only writes are `nullecho.drop.residency` and
  `nullecho.drop.submittedAt` — a residency answer and a date — both documented in
  `PRIVACY-POLICY.md`, which explicitly notes the exclusion of name, birthdate, ZIP and DROP ID. That
  is the right design and it is correctly described.)
- **GitHub Pages IP logging is not disclosed anywhere** — see **B3**. `PRIVACY-POLICY.md` is
  extension-scoped and has no website section. It also still carries two open `[VERIFY]` blocks (no
  contact address; no permanent hosting URL), which the same edit could close.

---

## 4. Legal framing — claim ratings

| Claim on the page | Statute / CPPA | Rating |
|---|---|---|
| "forces data brokers to delete you" (H1) | § 1798.99.86(c)(1)(A) + § 1798.99.82 fine | OK as a headline; undercut by B1 |
| "They have to delete what they hold on you" | § 1798.99.86(c)(1)(B), (c)(2) — may suppress or exempt | **Overstated → B1** |
| "including the inferences they made about you" | CPPA: "could include… inferences… who match your information" | Needs qualifier → S9 |
| "every 45 days, indefinitely" | § 1798.99.86(d)(1), conditioned | Needs qualifier → S9 |
| "$200 … per request, per day" | § 1798.99.82 — verbatim match | **Accurate**; add "payable to the state" → S9 |
| "free" | § 1798.99.86(b)(5); "we will never charge you" | **Accurate** |
| "no account needed" | "You do not need to create a… account" | **Accurate** |
| "nothing to renew" | "DROP is ongoing – not a one-time action" | **Accurate**; incomplete → S6 |
| "information is not retained by DROP" | Applies only to the residency check | Ambiguous → S2 |
| "a request filed now also catches data they acquire later" | "they must still hold on to your request. You don't have to resubmit" | **Accurate** |
| "failing to register is itself a violation" | § 1798.99.82, $200/day | **Accurate** |
| "a company was fined for ignoring [GPC]" | not sourced on page | **Unverified** → S9 |
| No "you'll stop getting spam" claim | CPPA itself claims "Reduced spam and scams" | **Better than the state's own page** |

---

## 5. "And then some" — verified mechanisms for non-Californians

Only mechanisms a reader can use **today**, each with a fetched source.

**Registries are a list, not a button.** CalPrivacy confirms the set: *"one of four states (also
Oregon, Texas, and Vermont) who require data broker registration."*

- **Vermont — no deletion right, and Act 138 did not create one.** Our extension page says *"Vermont
  has no companion law granting deletion rights."* **That survives verification.** I parsed Act 138
  (2026) as enacted: Sec. 1 adds to the registration statement *"the URL of a page on the data
  broker's website that: (i) **if the data broker permits deletion**, allows a consumer to request
  that a data broker delete…"* — conditional, not a mandate — effective **January 1, 2027**. Sec. 2 is
  titled *"STUDY OF ACCESSIBLE DELETION MECHANISM; REPORT"*, effective July 1, 2026. The codified
  9 V.S.A. § 2446 remains registration + opt-out disclosure only. Worth adding forward-looking: from
  1/1/2027 the Vermont registry will carry per-broker deletion-page URLs where they exist.
- **Oregon — registry at ORS 646A.593 (DCBS); the deletion right is OCPA.** ORS 646A.574 gives the
  right to *"Require a controller to delete personal data about the consumer, including personal data
  the consumer provided to the controller, **personal data the controller obtained from another source
  and derived data**"* (operative July 1, 2024). "Obtained from another source and derived data" is
  precisely broker-held data plus inferences — the single most quotable non-California line available.
- **Texas — registry is Ch. 509 (SoS); the deletion right is TDPSA § 541.051(b)(3)**, the right to
  *"delete personal data provided by or obtained about the consumer."* Filed per-controller.
- **Authorized agents do not travel.** For Californians, § 1798.99.86(b)(8) *requires* DROP to support
  them. Texas's general authorized-agent provision (§ 541.055) appears limited to **opt-out**, not
  deletion — so "have an agent do it" is a California advantage, not a national one.
- **Privacy Rights Clearinghouse** (`privacyrights.org/data-brokers`, 200) is non-commercial and is the
  only one of these that puts a non-Californian in front of an actual opt-out form today. The
  extension page links it; **the public page does not.** Highest-value single addition to §"Not in
  California?".

---

## 6. Could not verify

1. **What the California Identity Gateway actually asks for** (ID document? phone? SSN?). CalPrivacy
   says only *"basic information"*. Determining this would require submitting on the state portal,
   which I did not do. Our page's silence here is correct.
2. **Whether a DROP profile ever expires.** Statute silent; all six CalPrivacy consumer pages silent.
   The approved regulations text (`cppa.ca.gov/regulations/pdf/…_text.pdf`, `drop_ftr.pdf`) was not
   parsed. The extension page's stated open question is still open.
3. **How the deployed DROP UI exposes authorized-agent submission.** The statute mandates support
   (S5); the UI was not exercised.
4. **Texas Ch. 509 primary text.** `statutes.capitol.texas.gov` serves a JavaScript shell at both its
   `.htm` and `.pdf` URLs (the "PDF" downloads as HTML). Texas registry claims above rest on
   `texas.public.law` and secondary reporting, not the primary text.
5. **Texas § 541.055 authorized-agent scope** — search-level only, not fetched primary.
6. **The GPC enforcement claim** on our page ("a company was fined for ignoring it") — not
   investigated in this pass.
7. **`login.ca.gov`** — no CalPrivacy page references that domain. CalPrivacy names the *"California
   Identity Gateway"* and *Login.gov*. I could not confirm `login.ca.gov` is involved, and our pages
   do not claim it is.

---

## Suggested order of work

1. **B1** — port the extension's `Opted-out` / `Exempted` / publicly-available language into the
   public page's limits table. Largest accuracy gap, smallest edit.
2. **B2** — one clause about the 45-day update lockout, on both pages.
3. **B3** — footer sentence + a "the website" section in `PRIVACY-POLICY.md` (closes two existing
   `[VERIFY]` blocks at the same time).
4. **S1** — decide whether `isCalifornian` gets a control or the nudge goes state-neutral; today it is
   dead code that only lights up in the demo fixture.
5. **S2–S6** — all one- or two-sentence edits, all with the quote already in hand above.
6. **S7** — retune `--faint` for light mode; one token, four call sites.
7. **S8** — port the extension's non-California path, adding the Oregon ORS 646A.574 line and the
   Privacy Rights Clearinghouse link.
