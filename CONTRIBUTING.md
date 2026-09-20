# Contributing

## The one rule

**Verify by rendering, not by grepping.** This project has been burned repeatedly by source that
looked right and behaved wrong — a baseline measured in the wrong browser, a test harness that 404'd
its own subject and still reported success, a rename that silently moved a hash. If you change
behaviour, load it and look at it.

## Ground rules

1. **Never weaken an invariant to make a test pass.** Twice a persona was genuinely wrong and the
   data got fixed rather than the rule. Keep that pattern.
2. **A detectable-but-consistent persona is acceptable. A self-contradicting one is not.**
   If you can't make a spoof internally consistent, remove the spoof — a consistent honest leak beats
   an inconsistent fake.
3. **No claim without a measurement.** Docs cite sources or say "unverified." Don't round a number
   into something you can't defend.
4. **No synthetic content, ever.** See `docs/DECISIONS.md` D15. We generate no fake browsing,
   searches, or interests — a synthetic signal is indistinguishable from a real one to a subpoena,
   an employer's monitor, or a border inspection. We'd generate it; the user would carry it.
5. **Disclose AI assistance** in PRs. It's fine; undisclosed isn't.

## Before you open a PR

```bash
cd ext && npm test && npm run validate
```

Then load it unpacked and check the popup still renders in light *and* dark.

## What we publish, and what we don't

This repo is public on purpose: a privacy tool nobody can audit gets distrusted on sight, and being
checkable matters more here than being secret. But there is a line.

**We publish honest gap disclosure.** `docs/THREAT-MODEL.md` lists what Nullecho cannot protect, and
`docs/CLAIM-VERIFICATION-2026-09-17.md` records what third-party libraries actually detect — which is
the number that counts, not our score on our own suite. (`docs/ARKENFOX-RESPONSE.md` carries the
earlier self-measured detector counts and a correction banner saying so; don't quote them.) Users
need this to decide whether the tool fits their threat model. Hiding it would make the tool less safe
to rely on, not more.

**We do not publish evasion roadmaps.** No running "how we're beating detection this week," no
blocklist-circumvention techniques, no changelog framed as staying ahead of specific vendors. That
kind of document helps the other side more than it helps users, and it turns an honest tool into an
arms-dealer.

The test: *does this help a user decide whether to trust us, or does it mainly help someone defeat
us faster?* Publish the first. Don't write the second.

Worth knowing why the trade is worth it: FP-Scanner (USENIX Security 2018) detected **all seven**
anti-fingerprinting countermeasures it tested with accuracy 1.0 — including closed-source commercial
ones. Detection vendors work from production telemetry across billions of requests, not from reading
GitHub. Secrecy would not have saved us; it would only have cost us the auditability that makes the
tool worth installing.

