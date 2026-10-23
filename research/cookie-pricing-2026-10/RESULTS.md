# Workstream J: results

**Status (updated 2026-10-23 16:35 PDT): DRAFT, stage 2 in progress.** This file is filled in as each part finishes,
and no verdict is final until its part is marked done. Nothing here is a public claim. METHOD.md is the registration
(`a7bdd07`); the deviations listed below are the only departures from it.

| part | state | raw file(s) |
|---|---|---|
| calibration | done 10-17; Priceline recalibrated 10-23 (D9) | `raw/calibration-*.json`, `j1-items.json`, `j2-targets.json` |
| J1.1 + 1b | run 1 (10-17) stopped by the wall rule after 21 loads; **run 2 (10-23) queued** behind J2 | `raw/j1-assign-2026-10-17.json`, `raw/j1-assign-2026-10-23.json` |
| J1.2 | queued after J1.1 run 2 | `raw/j1-cookies-2026-10-23.json` |
| J1.3 | registered enrolment stopped 10-23 (one offer, 14/14); **single-offer version (D8) running 10-24 to 10-26** | `raw/j1-history-2026-10-23.json` (stopped); `raw/j1-history-2026-10-23-single.json` |
| J1.4 | inside J1.1 (12 profiles per run) | same as J1.1 |
| J2 | 10-17 run killed at slot 5 (D6); first 10-23 attempt stopped at slot 1 (D9); **rerun started 10-23 16:28 PDT** | `raw/j2-2026-10-17.json`, `raw/j2-2026-10-23-aborted-slot1.json`, `raw/j2-2026-10-23b.json` |

### Notice for Jason: test-browser windows (Pacific time)

Chrome windows open by themselves on the Mac at the times below. Let them run; they close on their own. Nothing is
bought, booked or signed into.

| when | which part |
|---|---|
| **Fri 10/23**, until about 8:00 PM | J2 and J1 |
| **Sat 10/24, Sun 10/25 and Mon 10/26**, 9:30–9:40 AM, 10:00–10:20 AM and 6:30–6:40 PM | J1.3 |
| **Mon 10/26**, about 6:45–7:00 PM | J1.3 swap |

### If this session ends: what is running and how to resume

Every live probe was started detached (`nohup`), so a session expiry does not stop it. Logs and the private J1.3
state are in `~/.cache/nullecho-cookie-pricing/`, outside the repo.

- **J2:** `probe-j2-repeat.mjs` → `raw/j2-2026-10-23b.json` (log `j2-2026-10-23b.log`), about 90 min from 16:28.
- **J1 chain:** `probe-j1-assign.mjs` then `probe-j1-cookies.mjs` (log `j1-chain-2026-10-23.log`). Each waits on the
  live lock, so J1.1 starts when J2 ends.
- **J1.3 daemon:** `caffeinate -i node probe-j1-history.mjs daemon` (log `j1-history-daemon.log`).
  - Events: 09:30, 10:00 and 18:30 PDT on Sat 10-24, Sun 10-25 and Mon 10-26, then the swap at 18:45 on 10-26.
  - `node probe-j1-history.mjs status` lists them.
  - If the daemon has died, `node probe-j1-history.mjs daemon` resumes it. An event more than 4 h late is skipped and
    recorded, as registered.
- **Analysis:** `node analyze.mjs assign|cookies|history|repeat <raw>`.
- **Clean-up after J1.3's swap:** delete `~/.cache/nullecho-cookie-pricing/j1-history/` (METHOD §2.7).

## Deviations from METHOD.md

Each deviation below is a departure from the registration. It is listed with its reason and with what it changes.

| id | what | why | effect on the results |
|---|---|---|---|
| D0 | The registration commit is `a7bdd07`, not `eb69cef`. | Rebased onto main `e69f6a3` before any data, as the director asked. The content is identical (`git diff eb69cef a7bdd07 -- research/cookie-pricing-2026-10` is empty). | none |
| D1 | **J1.3 shops by views only:** the item, two related items, then the item again. There is no add-to-cart and no cart-emptying. | Walmart cart calibration failed twice and used 5 loads against a budget of 4. The first visible "Add to cart" in document order belongs to a related-item carousel, so a related item went into the cart instead of the J1 item. The cart page then showed no Remove control the reader recognised. By the pre-registered safety rule, that calibration profile's cookies were cleared: one anonymous guest cart (a "Restored AirPods Pro") was left unattached to any browser, and nothing was bought. METHOD §2.6 says a reader that cannot be made to work within budget is "not forced". | J1.3 tests whether **browsing** history moves the offer or price. It does not test cart history; that needs a calibrated cart reader in a later run. |
| D2 | Priceline calibration used 5 loads (budget 4). | The 5th load was a live confirmation with the final selectors, so the J2 series would not start on an unverified reader. | none on the data |
| D3 | Agoda calibration used 5 loads (budget 4; §4.1 allows 2 for site selection). J2's second site is conditional on one check load just before slot 1. | Agoda rendered its room grid on load 2, so it qualified under §4.1. The reader only worked after offline tuning on that saved page. Loads 4 and 5 then came back as HTTP 200 with an empty title and no grid (a soft block). Expedia and Hotels.com each answered HTTP 429 "Bot or Not?" on their first load and were not retried. | J2 may be Priceline-only (§4.1's registered fallback). |
| D4 | Reader code changed during calibration (§2.6 allows this). | Made before any measured load and committed in `b856925`: <ul><li>cart: each label is tested on its own, and "Add to cart" may continue (`- <item>`);</li><li>hotel: a split "$" / "17" is re-joined, a "Per night" label is joined to its price, and a price followed by "N nights" is the stay total;</li><li>new options `nameAncestor`, `scrollSteps` and `scrollTo`;</li><li>a configured card selector never falls back to the heuristic.</li></ul>The fixture cases K1, K2, R3 and R4 passed again after the changes. | none |
| D6 | **A six-day interruption.** The agent's session expired on 2026-10-17 at about 16:15 PDT, mid-J2, and work resumed on 2026-10-23 at 15:48 PDT. The director saved the partial raw files as WIP `f9c497a`. | Infrastructure (an OAuth 401), not the study. | <ul><li>**J1.1:** run 1 (10-17) had already stopped under the wall rule (21 loads, 6 profiles observed). It continues as run 2 under the same protocol, and the runs are pooled to 40 observed profiles (`analyze.mjs` pools with run-prefixed profile ids). Pooling is allowed only if run 2 shows the same offer ids and sellers as run 1; if not, run 1 is reported separately and run 2 must reach 10 per device by itself.</li><li>**J1.3:** never enrolled, because no walmart.com day was left on 10-17. It is enrolled fresh on 10-23, with days 1–3 on 10-24 to 10-26.</li><li>**J2:** the 10-17 run was killed after slot 5. It is excluded as an incomplete series and reported descriptively; J2 reruns from slot 1 with new browsers.</li></ul> |
| D7 | The Priceline stay-total rule was widened before the J2 rerun. | The aborted run read the stay total on only 2 of 10 Priceline loads. Priceline captions the total either "2 nights, 1 room" or "with taxes and fees", and the rule knew only the first. Checked on a local page carrying both captions and Agoda's "Per night before taxes", which must not count as a total, plus fixture cases K2, R3, R4 and A3. | Secondary measure only. The registered measure (nightly) was read on every Priceline load. |
| D8 | **J1.3 runs on one offer instead of two buckets:** 6 profiles all on that offer, randomly drawn into 4 shoppers and 2 controls. Schedule, views-only shopping and swaps are as registered. | On 2026-10-23 the registered enrolment stopped by its own rule. All 14 fresh profiles drew the same offer (`F5392DD4…`, $127, seller `66656029…`), so no second bucket existed to enrol (`raw/j1-history-2026-10-23.json`). The brief's question, "does history move it", can still be asked against untouched controls, and the director asked for J1.3 to run. | Answers "does browsing history move a visitor off the offer everyone else gets", not "does history move a bucket". The permutation has 15 role assignments, so the smallest attainable p is 1/15 = 0.067; descriptive, as registered. Checked on the fixture: a one-offer fixture gave `NO-CHANGE` with 15 assignments, and H2 still passes. |
| D9 | **Priceline reader recalibrated; the J2 rerun restarted.** The first rerun attempt (10-23, 16:21 PDT) was stopped after slot 1 and kept as `raw/j2-2026-10-23-aborted-slot1.json`. | Priceline returned 0 room cards on both slot-1 loads. A diagnostic load showed Priceline had redesigned its room section since 10-17, removing the `RATE_CARD` hook. The new hook (`[data-name] [class*="group/card"]`, room name from the `data-name` attribute) was checked offline on the saved page (14 rate rows read) and confirmed with one live load. Fixture K2 and R3 still pass. | Neither Priceline arm had a price at slot 1, so restarting from slot 1 with new browsers loses no paired data. Priceline's registered room read the same before and after the redesign: Royal Tower King, $19 a night, $129 for the stay. |
| D5 | J1.4 has 2 items, not 3. | The registered selection rule found marketplace items for 2 of its 4 queries: every Bose and Nintendo candidate was sold by walmart.com. The brief allows "2–3". | J1.4 covers 2 items. |

Not a deviation, but it changes the question: **the offers on item 5689919121 are no longer the two seen in the prior
isolation.** At calibration, two fresh profiles drew $159.99 from seller `66306FC5…`, the prior study's seller (offer
`609E2BE5…`), and $173.99 from a *different* seller, `7E9CC878…` (offer `1C388ED2…`). The prior study's $149.99 and
$169.99 offers were not seen. J1 measures whatever offers fresh visitors are shown now, which is what METHOD registers
(bucket = offer id).
