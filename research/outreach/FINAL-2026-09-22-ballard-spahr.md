# FINAL — Ballard Spahr LLP (Consumer Finance Monitor) — send 2026-09-22

**Gate status:** all three Maryland checks re-run in a real browser 2026-09-22 (PASS — see
`VERIFY-2026-09-22.md`); their May 5 post re-opened 2026-09-22 and is still uncorrected (the
struck-string sentence is still there verbatim). Cleared to send.

**To:** maareca@ballardspahr.com, schusterj@ballardspahr.com
**Cc:** kaplinsky@ballardspahr.com
**Subject:** A second look at the Maryland disclosure line in your May 5 surveillance-pricing post

---

```
Hi Adam, Joseph,

Your May 5 post on Maryland's Protection From Predatory Pricing Act has a section on
disclosure duties for merchants outside food retail, quoting "THIS PRICE WAS SET BY AN
ALGORITHM OR BY USING YOUR PERSONAL DATA." With October 1 nine days out, I think that
section is worth a second look against the enrolled text.

That section — proposed Com. Law § 13-322 — was struck by amendment before the bill
passed. Maryland enacted § 13-321 only, and it mandates no wording. Three checks, each
about a minute, in a browser (not curl — the statute text renders client-side, so a
script returns "File not Found" for every section, including the control):

- Maryland's own statute endpoint returns the full § 13-321 text:
  https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcl&section=13-321&enactments=true&archived=false
  Swap in section=13-322 on that same endpoint and it returns "File Not Found."
- Codified § 13-408(a) reads "This section does not apply to a violation of § 13–321 of
  this title." No "or § 13-322." Same for § 13-411(a).
- In the Ch. 154 print, the enacting clause carries "and 13-322" struck through.

For what it's worth, Greenberg Traurig's September alert reaches the same place: "the
enacted law does not impose a broader algorithmic-pricing disclosure requirement on
merchants generally."

I made this exact error myself first. Chapter PDFs print deletions as strike-through and
text extraction silently drops it — Sidley's hosted copy of Ch. 154 still extracts as
"§ 13–321 OR § 13–322," which is the deleted text reading as live.

I build an open-source privacy extension and ended up reading these statutes closely for
a feature. Not a lawyer, and this isn't a pitch. I have a sourced four-state brief I'd send
free if it's useful, or just the statutes with the sections marked.

Jason Luker
Independent developer, Nullecho (free, open-source)
jason@nullecho.org · https://nullecho.org/research/
```

---

## Before you press send

1. **Gate:** re-open their May 5 post one more time the moment before you send — if it has been
   corrected since this morning's check, don't send this version (see SEND-ORDER.md #1).
2. Compose in plain-text mode — no signature image, no embedded logo.
3. Send from jason@nullecho.org; fall back to Gmail only if nullecho.org test sends have been
   landing in spam.
