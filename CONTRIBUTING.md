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
