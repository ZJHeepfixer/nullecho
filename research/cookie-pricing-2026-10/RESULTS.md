# Workstream J: results

**Status (updated 2026-10-23 19:35 PDT): DRAFT, stage 2 in progress.** This file is filled in as each part finishes,
and no verdict is final until its part is marked done. Nothing here is a public claim. METHOD.md is the registration
(`a7bdd07`); the deviations listed below are the only departures from it.

| part | state | raw file(s) |
|---|---|---|
| calibration | done 10-17; Priceline recalibrated 10-23 (D9) | `raw/calibration-*.json`, `j1-items.json`, `j2-targets.json` |
| J1.1 + 1b | run 1 (10-17) stopped by the wall rule after 21 loads; **run 2 (10-23) DONE**, 40/40 observed | `raw/j1-assign-2026-10-17.json`, `raw/j1-assign-2026-10-23.json` |
| J1.2 | **running** (started 19:16 PDT) | `raw/j1-cookies-2026-10-23.json` |
| J1.3 | registered enrolment stopped 10-23 (one offer, 14/14); **single-offer version (D8) running 10-24 to 10-26** | `raw/j1-history-2026-10-23.json` (stopped); `raw/j1-history-2026-10-23-single.json` |
| J1.4 | **DONE** inside J1.1 run 2 (and run 1, descriptive) | same as J1.1 |
| J2 | 10-17 run killed at slot 5 (D6); first 10-23 attempt stopped at slot 1 (D9); **rerun DONE** 10-23 16:28–17:43 PDT | `raw/j2-2026-10-17.json`, `raw/j2-2026-10-23-aborted-slot1.json`, `raw/j2-2026-10-23b.json` |

### Notice for Jason: test-browser windows (Pacific time)

Chrome windows open by themselves on the Mac at the times below. Let them run; they close on their own. Nothing is
bought, booked or signed into.

| when | which part |
|---|---|
| **Fri 10/23**, until about 10:30 PM | J1.1 and J1.2 (J2 finished at 5:43 PM) |
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

## J1: walmart.com item 5689919121

### What a new visitor is shown changed between the two study days

| date | fresh profiles observed | offers seen (offer id, price, seller) |
|---|---|---|
| 10-17, calibration and J1.1 run 1 | 8 | `609E2BE5…` $159.99 from seller `66306FC5…` (the prior study's seller); `1C388ED2…` $173.99 from seller `7E9CC878…` |
| 10-23 15:52–16:20, J1.3 enrolment (both attempts) | 20 of 20 | `F5392DD4…` **$127.00 from seller `66656029…`** only |
| 10-23 17:43–19:16, J1.1 run 2 | 40 of 40 | `F5392DD4…` $127.00 ×18; **`0C3F46B1…`** from seller `66306FC5…` ×22 ($161.45, then $172.25 from 19:03). One reload showed walmart.com's own listing at $199. |

- **10-17:** neither of the prior isolation's offers ($149.99 / $169.99) appeared.
- **10-23 afternoon:** only $127 appeared.
- **10-23 evening:** the prior isolation's own offer id `0C3F46B1…` (its $169.99 offer, 10-15 to 10-17) was back, at
  $161.45 and then $172.25.
- **Seller `66306FC5…`** (the prior study's "Top renew LLC") had an offer in play on both study days, under a different
  offer id each day.
- **What the "offer" is.** On both days the price difference came from **which marketplace seller's listing the page
  shows as its default**, not from one seller quoting two prices. Each offer is a different seller.

### J1.1 + J1.1b: the registered run (10-23, 17:43–19:16 PDT, `raw/j1-assign-2026-10-23.json`) — DONE

`node analyze.mjs assign raw/j1-assign-2026-10-23.json`. 40 brand-new profiles, 10 per device profile, in shuffled
blocks of four. **All 40 observed.** The 13 walls ("Robot or human?") all fell on second or third pages within a profile
(follow-on items or reloads), none on a first load.

| measure | result | registered verdict |
|---|---|---|
| offers drawn | **$127.00** (`F5392DD4…`, seller `66656029…`): 18. **`0C3F46B1…`** (seller `66306FC5…`): 22, at $161.45 until 19:00 and $172.25 from 19:03; the seller repriced that offer for everyone mid-run. | — |
| share drawing the cheaper offer | 0.45 (95% Wilson CI 0.31–0.60); binomial vs ½ p = 0.64 | **SPLIT-CONSISTENT-WITH-HALF** |
| by device (1b) | Mac 0.2 (0.06–0.51) · Android 0.4 (0.17–0.69) · iPhone 0.6 (0.31–0.83) · Windows 0.6 (0.31–0.83); permutation χ² p = 0.27 | **NO-DEVICE-EFFECT-DETECTED** |
| drift within the run | mean load number, cheaper minus dearer, = −11; permutation p = 0.085 | **NO-ORDER-EFFECT-DETECTED** (borderline; see below) |
| reload ~1 min later (stickiness) | 5 of 6 readable reloads kept their offer (4 reloads were walled) | **NOT-STICKY** (registered rule: every reload must match) |
| store label | one store for all 40 | — |

**The non-sticky reload.** Profile p012 drew `0C3F46B1…` at $161.45. Its reload, 7 minutes later, showed neither
marketplace offer but **walmart.com's own listing** (seller `F55CDC31…`, fulfilment "STORE", $199.00, the was-price).
So the page's default offer can also fall back to Walmart's own store listing. This one event does not say why.

**The split moved over the afternoon (descriptive).** Between 15:52 and 16:20, all 20 J1.3 enrolment profiles drew
$127. From 17:43 the split was mixed; in the last 10 profiles (from 19:02), 8 of 10 drew the dearer offer. The
within-run test is borderline (p = 0.085, not significant by the registered rule). Taken together with 10-17's
different offers, what a new visitor is shown here is not a fixed property of the visitor. It changes from day to day
and probably hour to hour.

**What this says.** On 10-23, new visitors to this item were shown one of two marketplace sellers' listings, $127 or
$161–172, in roughly even proportions. Which device they presented did not detectably change that.

**What it does not say.**
- **Not a 50/50 test, necessarily.** "Consistent with half" is not "a 50/50 test". With 40 profiles the CI is about
  ±0.15, and the share moved during the day.
- **Device:** only a large device tilt was detectable (METHOD §6). The Mac profile's 0.2 is within chance here.
- **Personal data:** nothing about it. Every profile was a new, anonymous lab browser on one connection.

### J1.4 in the registered run (10-23)

| item | first-12 profiles readable | offers | registered verdict |
|---|---|---|---|
| iPad 9th gen (324081942) | 8 (4 walled) | $164.01 (`E06DBF92…`, seller `8C8D812C…`) ×4; $179.00 (`6EE42303…`, seller `9F26296C…`) ×4 | **SPLIT-FOLLOWS-MAIN-BUCKET**: every $127-AirPods profile saw $164.01 and every other profile saw $179 (4/4 and 4/4; Fisher p = 0.029) |
| Galaxy Buds (8470119448) | 7 (5 walled) | $105.00 (`ECED3460…`, seller `66656029…`) ×7 | **NO-SPLIT-IN-7** (an unseen minority offer below about 35% cannot be ruled out) |

**What this says.** For the iPad, which marketplace listing a new visitor is shown was tied to which AirPods listing
the same visitor was shown minutes earlier. That points to one visitor-level assignment applied across items, a
site-wide experiment or rule, rather than a per-item coin flip. On 10-17 the same pairing appeared (4 of 4, mirrored)
with other sellers.

**What it does not say.**
- **Why:** nothing on the page says who runs the assignment.
- **Generality:** it does not hold for every marketplace item; the Galaxy Buds showed one offer.
- **Not a discount group:** the bucket is not "the cheap group". On 10-23 the cheaper-AirPods visitors got the
  cheaper iPad, while on 10-17 they got the dearer one.

### J1.1 run 1 (10-17): stopped by the wall rule

- **Walls.** 21 loads, 7 of them walled (HUMAN "Robot or human?"), 5 of those on a profile's second or third page.
  After the second run of three walls in a row, the registered rule stopped the probe for the day.
- **Draws.** 6 profiles were observed: 2 drew $159.99 and 4 drew $173.99. The share of the cheaper offer was
  0.33 (95% CI 0.10–0.70), verdict `INSUFFICIENT` (n < 20).
- **Stickiness.** The one reload kept its offer.
- **Device and pooling.** No device association can be judged at n = 6 (permutation p = 0.73). Because the offers
  changed by 10-23, run 1 **is not pooled** with run 2 (D6) and is reported here on its own.

### J1.4 in run 1 (10-17), descriptive

- **Galaxy Buds 8470119448:** one offer ($95, seller `66656029…`) in all 3 reads.
- **iPad 324081942:** two offers from two sellers, $164 (`8C8D812C…`) and $159 (`575677CF…`, Magnakom). In 4 of 4
  profiles, the iPad offer was the **mirror** of the AirPods draw:

| AirPods drawn | iPad drawn |
|---|---|
| $159.99 | $164 |
| $173.99 | $159 |

  Fisher p = 0.33 at n = 4, so the registered verdict is `SPLIT-NOT-SHOWN-TO-FOLLOW-MAIN-BUCKET`. The pattern is
  worth testing, not claiming. If it held, a visitor's draw would select which seller's listing wins the default
  slot across items, not make the visitor cheaper or dearer overall.

### J1.3 registered enrolment (10-23): stopped

All 14 fresh profiles drew the same $127 offer, and the registered rule ("≥2 profiles in each of two offers") stopped
enrolment. J1.3 runs in its single-offer form (D8).

## J2: repeat views (Excalibur, Wed 12-09 to Fri 12-11)

### The registered run: 2026-10-23, 16:28–17:43 PDT (`raw/j2-2026-10-23b.json`) — DONE

`node analyze.mjs repeat raw/j2-2026-10-23b.json`. The run had 10 slots 6–9 min apart. Each slot paired one
long-lived REPEAT browser per site with a brand-new FRESH browser, seconds apart, in a balanced order. The registered
room is the cheapest king card.

| | Priceline | Agoda |
|---|---|---|
| repeat browser, slots 1–10 ($/night) | 19 at every slot | 64, —, —, —, —, 64, —, —, —, — |
| fresh browser, slots 1–10 ($/night) | 19 at every slot | 64 at every slot |
| repeat − fresh, slots 2–10 | 0 at all 9 (sign-flip p = 1.0) | 1 slot comparable (slot 6: 0) |
| **PERSONAL verdict** | **NONE-DETECTED** | **INCONCLUSIVE** (fewer than 6 slots compared) |
| fresh-series trend (Spearman) | flat (ρ = 0) | flat (ρ = 0) |
| **DEMAND verdict** | **NONE-DETECTED** | **NONE-DETECTED** |
| swap-C (repeat cookies in a fresh browser) | $19, $19: no gap to carry | $64 ($64 on both copies; one paired fresh unreadable) |
| swap-CS (cookies + localStorage) | $19: no gap | $64: no gap |
| availability per slot | 14 rate cards; cheapest card $17 throughout | 6–10 offer cards; cheapest $62 throughout |

**What this says.** On Priceline, looking at the same hotel, dates and room ten times over 75 minutes did not change
the price this browser was shown. A brand-new browser was shown the same price at every slot, and the price did not
drift for anyone. The prediction was H0, and H0 held.

**What it does not say.**
- **Within reach of this design:** no other hotel, no longer or busier stretch, no logged-in user, no checkout page.
- **Below its sensitivity:** a difference appearing in fewer than 6 of 9 slots could not reach significance (METHOD §6).
- **Beyond the stay:** flights were not tested.

**Agoda's returning browser lost the room grid.** On 8 of its 10 views, the long-lived repeat browser got an HTTP 200
page with no room grid within the 40-second budget. Fresh browsers at the same slots rendered 6–10 offers in about 8
seconds. New browsers carrying that repeat browser's cookies (swap-C) or its cookies plus localStorage (swap-CS) also
rendered the grid at $64. So the cause did not travel with the cookies; it belongs to the long-lived session itself
(its tab history, caches or in-memory state), which this design cannot tell apart. Agoda's personal comparison is
therefore **INCONCLUSIVE**, not "none". The two repeat views that did render (slots 1 and 6) showed the fresh price.

**Display variants (not prices).** Priceline served the same room under two naming templates ("Royal Tower King" /
"Royal Tower, King Bed") and two stay-total captions. Both carried the same price.

### The aborted 10-17 run (D6), descriptive only

- **Coverage.** 4 complete slots on both sites, about 30 min.
  - Priceline: Royal Tower King $19 a night on all 8 loads.
  - Agoda: $64 on all 8.
  - Every slot's repeat-minus-fresh gap was **0** on both sites.
  - Agoda's slot 5 had no room cards on either arm.
- **The "64/19 alternation" in this file is two sites interleaved.** Each slot holds both a Priceline load and an
  Agoda load. It is not a reader fault: on each site the reading never changed.
- **Templates.** On Priceline, the repeat browser got the "with taxes and fees" caption on all five views, including
  its first. Fresh browsers got either caption. That is a display bucket, not a price difference.

## Deviations from METHOD.md

Each deviation below is a departure from the registration. It is listed with its reason and with what it changes.

| id | what | why | effect on the results |
|---|---|---|---|
| D0 | The registration commit is `a7bdd07`, not `eb69cef`. | Rebased onto main `e69f6a3` before any data, as the director asked. The content is identical (`git diff eb69cef a7bdd07 -- research/cookie-pricing-2026-10` is empty). | none |
| D1 | **J1.3 shops by views only:** the item, two related items, then the item again. There is no add-to-cart and no cart-emptying. | Walmart cart calibration failed twice and used 5 loads against a budget of 4. The first visible "Add to cart" in document order belongs to a related-item carousel, so a related item went into the cart instead of the J1 item. The cart page then showed no Remove control the reader recognised. By the pre-registered safety rule, that calibration profile's cookies were cleared: one anonymous guest cart (a "Restored AirPods Pro") was left unattached to any browser, and nothing was bought. METHOD §2.6 says a reader that cannot be made to work within budget is "not forced". | J1.3 tests whether **browsing** history moves the offer or price. It does not test cart history; that needs a calibrated cart reader in a later run. |
| D2 | Priceline calibration used 5 loads (budget 4). | The 5th load was a live confirmation with the final selectors, so the J2 series would not start on an unverified reader. | none on the data |
| D3 | Agoda calibration used 5 loads (budget 4; §4.1 allows 2 for site selection). J2's second site is conditional on one check load just before slot 1. | Agoda rendered its room grid on load 2, so it qualified under §4.1. The reader only worked after offline tuning on that saved page. Loads 4 and 5 then came back as HTTP 200 with an empty title and no grid (a soft block). Expedia and Hotels.com each answered HTTP 429 "Bot or Not?" on their first load and were not retried. | Agoda was included in J2: it passed the single pre-J2 check on 10-17 and again on 10-23 (`calibration-hotel-agoda-6/7-precheck`). |
| D4 | Reader code changed during calibration (§2.6 allows this). | Made before any measured load and committed in `b856925`: <ul><li>cart: each label is tested on its own, and "Add to cart" may continue (`- <item>`);</li><li>hotel: a split "$" / "17" is re-joined, a "Per night" label is joined to its price, and a price followed by "N nights" is the stay total;</li><li>new options `nameAncestor`, `scrollSteps` and `scrollTo`;</li><li>a configured card selector never falls back to the heuristic.</li></ul>The fixture cases K1, K2, R3 and R4 passed again after the changes. | none |
| D5 | J1.4 has 2 items, not 3. | The registered selection rule found marketplace items for 2 of its 4 queries: every Bose and Nintendo candidate was sold by walmart.com. The brief allows "2–3". | J1.4 covers 2 items. |
| D6 | **A six-day interruption.** The agent's session expired on 2026-10-17 at about 16:15 PDT, mid-J2, and work resumed on 2026-10-23 at 15:48 PDT. The director saved the partial raw files as WIP `f9c497a`. | Infrastructure (an OAuth 401), not the study. | <ul><li>**J1.1:** run 1 (10-17) had already stopped under the wall rule (21 loads, 6 profiles observed). The plan was to continue as run 2 and pool to 40 observed profiles, but only if run 2 showed the same offer ids and sellers as run 1. **It did not:** the offers had changed. So run 1 is reported separately, and run 2 reached 10 per device on its own (40/40).</li><li>**J1.3:** never enrolled, because no walmart.com day was left on 10-17. It is enrolled fresh on 10-23, with days 1–3 on 10-24 to 10-26.</li><li>**J2:** the 10-17 run was killed after slot 5. It is excluded as an incomplete series and reported descriptively; J2 reruns from slot 1 with new browsers.</li></ul> |
| D7 | The Priceline stay-total rule was widened before the J2 rerun. | The aborted run read the stay total on only 2 of 10 Priceline loads. Priceline captions the total either "2 nights, 1 room" or "with taxes and fees", and the rule knew only the first. Checked on a local page carrying both captions and Agoda's "Per night before taxes", which must not count as a total, plus fixture cases K2, R3, R4 and A3. | Secondary measure only. The registered measure (nightly) was read on every Priceline load. |
| D8 | **J1.3 runs on one offer instead of two buckets:** 6 profiles all on that offer, randomly drawn into 4 shoppers and 2 controls. Schedule, views-only shopping and swaps are as registered. | On 2026-10-23 the registered enrolment stopped by its own rule. All 14 fresh profiles drew the same offer (`F5392DD4…`, $127, seller `66656029…`), so no second bucket existed to enrol (`raw/j1-history-2026-10-23.json`). The brief's question, "does history move it", can still be asked against untouched controls, and the director asked for J1.3 to run. | Answers "does browsing history move a visitor off the offer everyone else gets", not "does history move a bucket". The permutation has 15 role assignments, so the smallest attainable p is 1/15 = 0.067; descriptive, as registered. Checked on the fixture: a one-offer fixture gave `NO-CHANGE` with 15 assignments, and H2 still passes. |
| D9 | **Priceline reader recalibrated; the J2 rerun restarted.** The first rerun attempt (10-23, 16:21 PDT) was stopped after slot 1 and kept as `raw/j2-2026-10-23-aborted-slot1.json`. | Priceline returned 0 room cards on both slot-1 loads. A diagnostic load showed Priceline had redesigned its room section since 10-17, removing the `RATE_CARD` hook. The new hook (`[data-name] [class*="group/card"]`, room name from the `data-name` attribute) was checked offline on the saved page (14 rate rows read) and confirmed with one live load. Fixture K2 and R3 still pass. | Neither Priceline arm had a price at slot 1, so restarting from slot 1 with new browsers loses no paired data. Priceline's registered room read the same before and after the redesign: Royal Tower King, $19 a night, $129 for the stay. |

Not a deviation, but it changes the question: **the offers on item 5689919121 change from day to day and within a
day** (see "What a new visitor is shown", above). J1 measures whatever offers fresh visitors are shown when it runs,
which is what METHOD registers (bucket = offer id).
