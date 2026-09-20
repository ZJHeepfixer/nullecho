# DRAFT — Ballard Spahr LLP (Consumer Finance Monitor)

**Type:** private heads-up to the named authors (<250 words). **Not** a public correction, not a
comment on the blog, not a tweet. One email, to the people who can fix it.
**To:** Adam Maarec — `maareca@ballardspahr.com` · Joseph J. Schuster — `schusterj@ballardspahr.com`
**Cc:** Alan S. Kaplinsky — `kaplinsky@ballardspahr.com`
(all three scraped from ballardspahr.com's own bio pages, 2026-09-20 — see TARGETS.md §A1)
**Their post:** "Maryland Targets 'Surveillance Pricing'…", 2026-05-05,
https://www.consumerfinancemonitor.com/2026/05/05/maryland-targets-surveillance-pricing-is-it-a-warning-shot-for-ai-driven-pricing-across-industries-including-consumer-financial-services/
**Attachment:** none on first contact. Offer the brief; send it if they say yes.

⚠️ **The alert is from May, not September.** Do not write "your September alert." The honest line is
"your May 5 post" — and the reason to write *now* is the October 1 date, not the age of the post.

⚠️ **Proofs must say "in a browser."** Under `curl` the Maryland endpoint returns "File not Found"
for **every** section including the control. If they check with a script, the control fails and the
finding looks bogus. See TARGETS.md §E0.

---

**Subject:** A second look at the Maryland disclosure line in your May 5 surveillance-pricing post

Hi Adam, Joseph,

Your May 5 post on Maryland's Protection From Predatory Pricing Act has a section on disclosure
duties for merchants outside food retail, quoting "THIS PRICE WAS SET BY AN ALGORITHM OR BY USING
YOUR PERSONAL DATA." With October 1 close, I think that one is worth re-reading against the
enrolled text.

That section — proposed Com. Law § 13-322 — was struck by amendment before the bill passed.
Maryland enacted § 13-321 only, and it mandates no wording. Three checks, each about a minute in a
browser (not curl — the statute text is rendered client-side, so a script returns "File not Found"
for every section, control included):

- `mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcl&section=13-322&enactments=true&archived=false`
  returns "File Not Found." The same URL with `section=13-321` returns the full statute.
- Codified § 13-408(a) reads "This section does not apply to a violation of § 13–321 of this title."
  No "or § 13-322." Same for § 13-411(a).
- In the Ch. 154 print, the enacting clause carries "and 13-322" struck through.

For what it's worth, Greenberg Traurig's September alert reaches the same place: "the enacted law
does not impose a broader algorithmic-pricing disclosure requirement on merchants generally."

I made this exact error myself first. Chapter PDFs print deletions as strike-through and text
extraction silently drops it — Sidley's hosted copy of Ch. 154 still extracts as
"§ 13–321 OR § 13–322," which is the deleted text reading as live.

I build an open-source privacy extension and ended up reading these statutes closely for a feature.
Not a lawyer, and nothing to sell. I have a sourced four-state brief I'd send free if it's useful,
or just the statutes with the sections marked.

Jason Luker
jason@nullecho.org
https://nullecho.org

---

*Body word count: 246.*

*To trim to ~200: drop the Sidley sentence (it is the best detail, but it is also the one that
needs the most trust) and shorten the opening to "Your May 5 post quotes a Maryland disclosure
string for merchants outside food retail."*

*⛔ Do not add a list of other firms that got it wrong — there isn't one. Fourteen alerts were
checked and thirteen are correct. If they ask who else, the answer is "as far as I can tell, this
is mostly confined to the extraction of the chapter PDF rather than to anyone's analysis," and then
point at the endpoint.*

*⛔ Do not say or imply the post is negligent, and do not ask them to publish a correction. Hand
over the proofs and let them decide. The ask is zero.*
