# I built a privacy extension that can't tell whether it's working. On purpose.

*Draft — Jason, this needs your voice on top before it goes anywhere public. The facts and numbers
are all verified; the sentences are a starting point. Read the note at the bottom.*

---

Every privacy tool I've ever installed shows me a little green shield and a number, and asks me to
believe it. Trackers blocked: 47. Protected. Have a nice day.

I never had any way to check. That's the part that always bothered me. The one category of software
whose entire job is *not trusting things* is also the category that asks for the most blind trust.

So I built the opposite. Nullecho is a browser extension that blocks trackers and defends against
fingerprinting — and it **collects nothing about you**. No telemetry, no phone-home, no account, no
analytics on its own pages. I can't see how many people use it or whether it works for them. That's
not a limitation I'm apologizing for. It's the whole design.

Because here's the thing that falls out of collecting nothing: **if I can't measure whether it's
working, the only person who can is you.** So the tool ships with a button that runs your actual
browser fingerprint with protection off and on, side by side, on the page you're looking at. Real
values. Your machine. Don't trust me — measure me. And I can't see the result either.

## The part most fingerprint tools get wrong

The naive way to defeat fingerprinting is to randomize everything — new canvas hash, new fonts, new
GPU string on every page. It feels right. It's worse than doing nothing.

Fraud-detection vendors already cross-reference five or six signals at once. Randomize each one
independently and you produce a machine that doesn't exist: a Chrome-on-Windows user agent next to
an Apple GPU next to three CPU cores. That's not "anonymous." That's "flagged as evasive," which is a
smaller and more suspicious crowd than just being yourself. And if your fingerprint changes every
time the page reloads, the *pattern of change* becomes its own identifier — you're now the only
visitor whose GPU flickers on refresh.

Nullecho does something narrower and, I think, more honest. It picks **one internally consistent
fake machine per website** — a real, common hardware-and-OS configuration that millions of people
actually run — and holds every field consistent with it. Site A sees one ordinary machine. Site B
sees a different ordinary machine. Neither can join you to the other, which is the actual harm.
Within a site, across a session, you look completely stable — so nothing breaks, and you don't stand
out.

The goal was never to be invisible. You can't be invisible to a site you're logged into; it knows
who you are. The goal is to break the link *between* sites — the quiet machinery that connects your
visit to a bank with your visit to a health forum. That link is what surveillance pricing runs on,
what data brokers sell, and what nobody shows you.

## What it actually does, and what it doesn't

I'm going to tell you the limitations up front, because a privacy tool that oversells is worse than
no privacy tool — you make real decisions based on what it implies.

**What it does:**
- Blocks known ad, analytics, social, and fingerprinting trackers.
- Presents each site a different, internally consistent device profile, breaking the cross-site
  fingerprint join.
- Sends Global Privacy Control, which is legally enforceable in California and several other states.
- Shows you what each shopping page did before it quoted you a price — including whether it carried
  the personalized-pricing disclosure New York law now requires.
- For Californians: walks you into the state's DROP platform, which forces 600+ registered data
  brokers to delete you — the one feature here that *removes* data instead of just obstructing
  collection.

**What it doesn't:**
- It is **detectable.** A determined site can tell Nullecho is installed. When I tested my own build
  adversarially, 2 of 10 detection methods still fire — mostly things no browser extension can reach.
  I'd rather tell you that than have you find out.
- It does **nothing about your IP address or your TLS fingerprint.** Those live below the layer any
  extension can touch. If that's your threat model, you want a VPN or Tor, and I'll say so in the app.
- **Firefox's built-in protection and Brave are genuinely stronger** at anti-fingerprinting, because
  they work below the JavaScript layer where the hardest problems are decided. If you use one of
  those, you may not need this. Nullecho's honest niche is Chrome, where neither of those exists.
- It will **not** get you cheaper prices. I looked hard at this — the best controlled study found that
  clearing your tracks gives you the *worse* price more often than the better one. Anyone selling a
  browser extension as a discount machine is selling you something that doesn't work. Nullecho shows
  you the pricing *mechanism*; it doesn't promise to beat it.

## Why "collects nothing" is the feature, not a footnote

There's a tension in building this that took me a while to make peace with. If the extension phones
nothing home, I can't run a dashboard of how well it's doing. I can't A/B test messaging on you. I
can't even tell if anyone installed it.

Good. That means the trust runs the right direction. You don't have to take my word that it protects
you and doesn't sell you out, because there's no channel for it to sell you out through, and the code
is open for anyone to check. The way you learn whether it works isn't a testimonial or a star rating —
it's the measurement, run on your own machine, that I can't see.

That's also the honest answer to *"will this actually get me results?"* Results here means: a
different fingerprint per site, trackers blocked, GPC sent, and — if you're in California — brokers
made to delete you. You can verify every one of those yourself, locally, in about a minute. Nothing
about that requires believing me.

## Try to break it

It's open source. If you find a fingerprinting method it doesn't cover, or a site it breaks, or a way
to tell it's installed that I missed — I want to know, and the repo is the place. This category
improves by people trying to break each other's tools in public, and I'd rather you break mine than a
tracker does.

[install links · repo · the "prove it yourself" page]

---

## NOTE TO JASON — read before publishing

- **This is a draft in a neutral voice. Rewrite it in yours before it goes live** — real blog posts
  under your name should sound like you, and this space can smell ghost-written copy. Keep the facts,
  change the sentences. Add a personal reason you built it (the DirecTV-era "how does this system
  actually work" instinct is genuine and would land here).
- **Do not publish until the tool is verified working** — specifically the blocked-count confirmation
  and the rest of Tier A breakage testing. Every number in here is real *as tested*; don't let the
  copy get ahead of the gate.
- **Fill the bracketed links** once AMO/Chrome listings exist. Lead with the Firefox/AMO link and the
  repo, not the Chrome Web Store link (r/degoogle Rule 5 blocks first-party Google links).
- **The "2 of 10 detectors" and "600+ brokers" and "worse price ~60% of the time" numbers are all
  from our own verified research** — sources are in `docs/` and `research/`. Keep them exact or drop
  them; don't round them into something you can't defend.
- Disclosing "written with AI assistance" on a *blog post* is fine and honest. Doing it on a Reddit
  comment is required. Different channels, different rules.
