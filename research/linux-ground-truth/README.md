# Linux persona ground truth — measured 2026-08-21

**Real data, not reconstruction.** Method, so it can be re-run and challenged:

1. Canonical's own desktop ISO manifests (`u2204.manifest`, `u2404.manifest`) — the authoritative
   record of what a **default desktop install** contains, fetched from `releases.ubuntu.com`.
2. Every font package named in each manifest installed into a matching `ubuntu:22.04` / `ubuntu:24.04`
   container, then `fc-list : family` → `ubuntu2204-families.txt` (**180**), `ubuntu2404-families.txt`
   (**259**).

Host was an M2 Max (arm64); font packages are `arch: all`, so architecture does not affect this.
Two independent methods (package presence, and rendered family enumeration) agree on every finding.

---

## 🔴 FINDING 1 — five claimed fonts DO NOT EXIST on a real Ubuntu 22.04 desktop

`FONT_SETS['ubuntu-22']` claims 30 families. **Five of them are not there:**

| Claimed | Why it is absent |
|---|---|
| **Noto Sans** | needs `fonts-noto-core` — **not in the default install** (only `-cjk`, `-color-emoji`, `-mono`) |
| **Noto Serif** | same |
| **Century Schoolbook L** | an old `gsfonts` name; **`gsfonts` is not installed**, `fonts-urw-base35` supersedes it |
| **Dingbats** | same — `fonts-urw-base35` ships this face as **`D050000L`**, which we already claim separately |
| **DejaVu Math TeX Gyre** | needs `fonts-dejavu-extra`; only **`fonts-dejavu-core`** is installed |

**Why this is worse than the unverified GPU strings.** Font detection works by probing a list and
recording present/absent. A site probing **Noto Sans** — one of the most commonly probed families
anywhere — gets `present` from us and `absent` from every real Ubuntu. That is a *self-contradicting
persona*, the D2 failure mode, and it is trivially detectable by an ordinary fingerprinting script
rather than by an adversary who is looking for us specifically.

## 🟠 FINDING 2 — we deny 155 families a real Ubuntu has

25 correct claims out of 180 real families. The 155 we report absent include families that appear
on standard font-probe lists: **FreeSans, FreeMono, FreeSerif, Droid Sans Fallback, Courier 10
Pitch**, plus the whole CJK / Indic / Thai / Arabic set Ubuntu ships by default (`AR PL UMing`,
`Lohit *`, `Noto Sans CJK`, `Waree`, `Purisa`, `KacstBook`, …).

Each false-absent is a weaker signal than a false-present, but there are 155 of them and they are
systematic — a Linux persona that knows no Indic or CJK fonts does not look like Ubuntu.

## ✅ FINDING 3 — the kernel pairing is CORRECT (an earlier worry, retracted)

`os: 'ubuntu-22'` + `uaData.platformVersion: '6.8.0'` is right and current:

- **22.04.5 ships `linux-image-6.8.0-40-generic`** via `linux-image-generic-hwe-22.04`.
- 24.04.4 has **moved on to 6.17.0** — so 6.8.0 is *not* the current 24.04 kernel.

An earlier note in `docs/LINUX-PERSONA-VERIFICATION.md` speculated this pairing might be a narrow
slice. **It is not. That speculation is withdrawn** — 22.04.5 + 6.8.0 is the mainstream combination.

## What this does NOT settle

The **five WebGL renderer strings**. Those are GPU-hardware-specific and no container or VM can
produce them. Still blocker #1.

## Recommended fix

Replace `FONT_SETS['ubuntu-22']` with the measured list. Two options, both defensible — the choice
is an anonymity-set question, not a correctness one:

- **Ship all 180.** Maximum fidelity to a real default install; the crowd is "every default Ubuntu
  22.04 desktop".
- **Ship a probe-relevant subset**, chosen by what real fingerprinting scripts actually test, but
  **only ever removing families a real Ubuntu lacks** — never inventing one.

⚠️ Whichever: **delete the five false-presents first.** That is a pure correctness fix with no
anonymity-set tradeoff, and it is the only one of these findings that is unambiguously a bug.
