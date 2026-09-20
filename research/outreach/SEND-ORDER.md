# SEND-ORDER — algorithmic-pricing outreach

**Built 2026-09-20.** Companion to `TARGETS.md`, `../BRIEF-PITCH.md`, and the four drafts in this
folder. **Nothing here has been sent. Jason sends every one of these himself from
`jason@nullecho.org`.** No attachments on first contact — offer the brief, send it on a yes.

---

## The order

**One at a time. Wait for a reply or three business days before the next.** These are different
audiences and a simultaneous blast reads as a press release.

| # | Send | To | Draft | Gate before sending |
|---|---|---|---|---|
| 1 | **Ballard Spahr** | `maareca@` + `schusterj@`, cc `kaplinsky@` ballardspahr.com | `DRAFT-ballard-spahr.md` | Re-run the three Maryland checks **in a browser** (below). Re-open their post — if it has already been corrected, **do not send** |
| 2 | **Retail Dive** | `retail.dive.editors@industrydive.com` | `DRAFT-retail-dive.md` | Recompute the countdown; after Oct 1 switch to past tense |
| 3 | **IAPP** | `writeforus@iapp.org` | `DRAFT-iapp.md` | Use the **140-word short version** — IAPP asks for a 1–2 paragraph pitch first |
| 4 | **Law360** | `newsroom@law360.com` | `DRAFT-law360.md` | If he'd rather have a byline, `expertanalysis@law360.com` instead — not both |
| 5 | **Bloomberg Law** | ⚠️ **no address yet** | — (write from BRIEF-PITCH.md §3) | **Blocked.** Get a named reporter's address off the foot of a current Bloomberg Law privacy story first. ⛔ Never send this down the Signal/SecureDrop tips channel — that page says it is not for coverage requests |

**Why Ballard Spahr goes first:** it is the only target where one email to two named people can
actually fix something before October 1, and a firm that has quietly corrected a post is far more
likely to take a reporter's call later. It also costs nothing if it lands badly — it is private.

**Why Retail Dive goes before IAPP:** its readers are the general retailers who would build the
phantom banner, so the finding is operational for them rather than interesting. IAPP wants a
pitch-first dance that takes longer.

---

## 🔴 The gate: re-run the Maryland checks IN A BROWSER, the morning you send

**Verified working 2026-09-20. Verify again — it is the lead, and the recipient will check it while
reading the email.**

1. Open `mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcl&section=13-321&enactments=true&archived=false`
   → **expect the full § 13–321 statute text.** This is the positive control and it is not optional.
2. Same URL with `section=13-322` → **expect "File Not Found."**
3. Same URL with `section=13-408` → **expect (a) to read "a violation of § 13–321 of this title,"
   with no "or § 13-322."**

⛔ **Do this in a real browser, and tell recipients to do the same.** The statute body is rendered
client-side: `curl` returns "File not Found" for **every** section, the control included. A
recipient who checks with a script will conclude the control is broken and discount the whole
finding. Every draft in this folder already says "in a browser" — keep it that way.

---

## Countdown language — recompute on the day you send

Maryland Ch. 154 takes effect **2026-10-01**. The drafts carry `[N]` placeholders; fill them in on
the send date, don't inherit a number from this file.

| If sending on | Subject-line phrasing |
|---|---|
| Sept 20 | "takes effect in 11 days" |
| Sept 22 | "takes effect in 9 days" |
| Sept 24 | "takes effect in 7 days" |
| Sept 26 | "takes effect in 5 days" |
| Sept 29 | "takes effect in 2 days" |
| Sept 30 | "takes effect tomorrow" |
| **Oct 1 or later** | ⛔ **Drop the countdown entirely.** Use "took effect October 1 and the summaries still have it wrong." The finding survives the deadline; the urgency framing does not, and a stale countdown makes a reader discount a real finding |

Arithmetic, so it can be redone without this table: days remaining = `Oct 1 − send date`. A subject
line that says "12 days" on a day that is 9 days out is a small error that costs a big finding.

---

## ⚠️ Perishable facts — re-check before the send they appear in

- **Southern Glazer's docket.** Verified 2026-09-19: MOU executed 2026-08-28 (Dkt 226),
  administratively closed 2026-09-01 (Dkt 228), **next joint status report due 2026-09-25.**
  🔴 **If you send on or after September 25, re-read the docket first.** The argument — the FTC
  pursuing Robinson-Patman while writing about personalized pricing without mentioning it — does
  **not** depend on the posture, so if the docket is unclear, **drop the parenthetical rather than
  guess.** (Only relevant to Law360 / Bloomberg Law, where the litigation angle appears at all.)
- **New York's One Fair Price Act.** The most perishable fact in the pitch. As of 2026-09-16:
  passed both houses June 4, **not delivered to the Governor**, no chapter number. Re-verify the
  morning you send.
- **Ballard Spahr's post itself.** Re-open it before sending. If it has been corrected since
  2026-05-05, there is nothing to write about — **don't send.**
- **Connecticut.** Cite **P.A. 26-130 § 11 (H.B. 5563), eff. 2027-07-01**, string
  `THIS PRICE WAS INCREASED USING YOUR PERSONAL DATA`. ⛔ Never P.A. 26-64, never "price setting
  device" — both repealed in June.
- **New Jersey.** **P.L. 2026, c. 55** (not c. 65); short title **Fair Price Protection Act**;
  private right is **derivative of the Consumer Fraud Act, not express.**

---

## Standing rules for every send

- ⛔ **Two** states mandate a sentence — New York (in force) and Connecticut (2027-07-01). Never
  three, never four.
- ⛔ Never quote `THIS PRICE WAS SET BY AN ALGORITHM OR BY USING YOUR PERSONAL DATA` as law. Quote
  it only as the text that was struck.
- ⛔ Never say Maryland "has no algorithmic-pricing law." It has a real one and it bites October 1 —
  a *ban* on conduct in food retail, not a labelling duty.
- ⚠️ **Never name a firm as wrong**, in any email, to anyone. The defensible sentence is "several
  widely circulated summaries describe § 13-322 as enacted." And **do not say "several law-firm
  alerts"** — this sweep found **one**, and thirteen that got it right. See TARGETS.md §D.
- ⚠️ Lead with your own corrected draft. "I made the same error first" is the sentence that makes
  the rest of it land.
- ⛔ Nothing about the extension beyond "I build an open-source privacy extension." The banned
  phrases in `docs/THREAT-MODEL.md` apply to email too — no "protects you from fingerprinting,"
  no "makes you anonymous," no implying a site can't detect it.
- The monitoring line stays **soft and last**: he also builds monitoring for the New York
  disclosure. It is context for why he was reading statutes, not a pitch. Nothing is for sale.
- No attachments on first contact. Offer; send on a yes.

---

## What is NOT in this plan, and why

- **No note to Skadden, Orrick, Morgan Lewis, Hunton, Greenberg Traurig, Baker Donelson, Burr &
  Forman, Troutman, Frankfurt Kurnit, Covington, BCLP, Kelley Drye or DWT.** All were fetched and
  read; **all got Maryland right.** Four were on the original candidate list. ⛔ Do not send.
- **No note to Sidley.** Their PDF is a hosted copy of the chapter law, not a claim of their own.
  It is the best *demonstration* of the extraction trap in the project — offer it in a follow-up,
  never as an accusation.
- **No note to BakerHostetler.** The "borderline sentence" from the earlier sweep could not be
  located. Unverified means unsent.
- **A Venable note is parked, not planned.** Their Maryland treatment is correct; their
  **Connecticut** string is the repealed P.A. 26-64 wording. Real, but it is a weaker note and a
  different story. Revisit only if a second wave is wanted, and re-check the page first.
