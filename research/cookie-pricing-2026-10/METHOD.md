# Workstream J: does the price follow your cookie, and does looking again raise it? (pre-registration)

**Status: written 2026-10-17, before any workstream J data existed.** Stage 1 is this file, the harness in this
folder and its fixture self-test (§7). No J probe has loaded walmart.com, priceline.com or any other retail or travel
site. Every probe refuses a non-local target unless it is given `--live` (self-test G1–G4 proves that refusal).

**The registration is the commit that adds this file.** Anything changed after that commit (a threshold, a site, a
selector, a sample size) is listed in RESULTS.md under "Deviations", with the reason and the time. A change made after
a measured series has started is a deviation, even if it looks harmless.

**This measures sites, not Nullecho.** No extension is loaded anywhere in J. Nothing here may be quoted as "Nullecho
lowers prices", and no result is a public claim until it has been reviewed (brief: `nullecho-growth/counter-program/J-COOKIE-PRICING-BRIEF.md`).

---

## 0. The questions, and the ones this cannot answer

**J1 (walmart.com item 5689919121, AirPods Pro 2 USB-C).** One marketplace seller has two offers on this item,
$169.99 and $149.99, and which one a visitor sees follows that visitor's walmart.com cookies (prior isolation:
`research/walmart-price-gap-2026-10/`; 10 of 10 transfers without the extension, 4 of 4 with it).

1. **Assignment.** What share of brand-new visitors draws each offer? Do they keep it?
   - **1b. Device.** Does the device a new visitor presents tilt that first draw?
2. **Carrier.** Which cookie or cookies carry the offer?
3. **History.** Does three days of shopping (views, related items, add to cart, empty the cart) move a visitor's
   offer or price?
4. **Generality.** Do other marketplace items split the same way?

**J2 (priceline.com plus one comparable travel site).** The question is whether viewing the same hotel room again raises
its price. It separates two things:

- **PERSONAL:** the price for the person who keeps looking.
- **DEMAND:** the price for everyone, which ordinary revenue management moves.

**What none of this answers.** All loads come from one Mac on one residential connection, in a few days.

- **Accounts:** no logged-in or loyalty pricing, no checkout-page or cart-level pricing.
- **Purchases:** nothing is bought.
- **Place:** no other IP, region or ISP.
- **Browsers:** only Chromium. The iPhone profile is Chromium wearing Safari's identity (§2.2).
- **Motive:** nothing about intent, fairness or legality.

A difference found here shows that a site served two visitors two prices under stated conditions. It does not show
the price was set from personal data. The device-pricing study's §4 warnings (`research/device-pricing/METHOD.md`)
apply here in full.

---

## 1. Hypotheses and pre-registered predictions

| id | effect looked for (H1) | null (H0) | prediction | why |
|---|---|---|---|---|
| J1.1 | the cheaper offer's share among new visitors is not ½, or a visitor's offer changes on reload | share ½, sticky per visitor | **H0**: the 95% CI holds 0.5 and every reload keeps its offer | Two consecutive fresh profiles drew different offers, and every profile kept its first offer (prior run 2). |
| J1.1b | the device profile is associated with the first draw | no association | **H0**: permutation p ≥ 0.05 | Arm D (ON's UA and client hints on an OFF profile) did not move an existing visitor. Cookie transfer flips the price whatever the device. |
| J1.2 | a specific cookie carries the offer | — (this is a search) | **an experiment-class cookie (`xp*` / `exp-ck`) decides, and a visitor-id cookie (`vtc` / `ACID` / …) carries it as a fallback when the experiment cookies are absent** | Prior run 4: the "experiment" and "visitor" subsets each carried the offer alone. **Untested caveat:** each subset also contained a bot-manager cookie (`_pxvid` / `TS01…`). This run never transfers those (§2.5), so it settles whether they were needed. |
| J1.3 | shoppers' offer or price moves away from their own baseline, and controls' does not | no shopper-specific movement | **H0**: NO-CHANGE, or GLOBAL-CHANGE (shoppers and controls together) | No controlled test has shown history moving a retail price (SURVEILLANCE-PRICING.md §3). |
| J1.4 | other third-party-seller items also split visitors between offers | one offer per item | no directional prediction | Walmart-sold items showed no gap (prior run 4). The two-offer pattern is known on one seller only. |
| J2-personal | repeat-viewer price differs from a fresh viewer's at the same moment, the gap appears after the first view, and it travels with the repeat browser's cookies | no repeat-vs-fresh difference | **H0 on both sites**: NONE-DETECTED | Vissers et al. 2014 (66 profiles, more than 130k queries: no systematic discrimination); CR 2016; Hannak et al. 2014 (Priceline reordered, did not reprice). |
| J2-demand | the fresh-viewer price trends over the 10 slots | no trend | none | Hotel revenue management moves prices for everyone; whether it does within ~90 min is open. |

---

## 2. Shared method

### 2.1 Browser and launch

- **Browser.** Chrome for Testing as installed by puppeteer. Its version is read from the binary and written into every
  raw file; on 2026-10-17 it was 149.0.7827.22.
- **Launch configuration.** The one documented by `research/bot-manager-2026-10/tesla/rig/run-tesla.mjs`:
  - `--disable-blink-features=AutomationControlled`;
  - `ignoreDefaultArgs: ['--enable-automation', '--disable-extensions']`, so `navigator.webdriver` is false;
  - `--no-first-run --no-default-browser-check --lang=en-US`.
- **Nothing else is hidden or spoofed.** That means no stealth plugin, no canvas or WebGL patching, no proxy, and no
  CAPTCHA interaction. The device profile (§2.2) is the only identity change, and it is the variable J1.1b studies.
- **Headful for live runs.** The tesla study found Akamai answers 403 to the automation-flagged configuration even
  without an extension. The fixture self-test runs headless. Before the first live load of stage 2, the quick
  self-test runs headful (§2.9).
- **Fresh profiles.** A fresh profile is a new, empty user-data directory under the OS temp directory, deleted when that
  browser closes.
- **Persistent profiles.** J1.3's six profiles and J2's repeat browser keep their state for the length of their study:
  - J1.3's profiles live in a **private state directory outside the repo** (default `~/.cache/nullecho-cookie-pricing/`);
  - J2's repeat browser stays open for the whole run.
- **Session cookies in J1.3.** Each J1.3 event starts the profile's browser and closes it afterwards, so session-only
  cookies end between events, as they would for a person who closes the browser.

### 2.2 Device profiles

The four internally consistent profiles of `research/device-pricing/METHOD.md` §1.1 are used, copied from
`harness/device-price-probe.mjs`:

- `mac-chrome`, `win-chrome`, `iphone-safari` (puppeteer's iPhone 15 Pro UA verbatim, no client hints);
- `android-chrome` (the device-pricing id `android-budget`).

**One addition, registered here.** `navigator.platform` is set to match the claimed OS: `MacIntel`, `Win32`, `iPhone` or
`Linux armv81`. The device-pricing probe left it at the host's `MacIntel` for all four. The self-test asserts, from
the fixture server's own logs, what each profile sent:

- the iPhone profile sends no `Sec-CH-UA*` header;
- Android sends `Sec-CH-UA-Mobile: ?1` and platform "Android";
- Windows sends platform "Windows" and macOS sends "macOS";
- no user agent says "Headless", and `navigator.webdriver` is false on every page.

**Profile use.** J1.1/1b interleaves all four profiles. **Every other part uses `mac-chrome` only**, so device cannot
confound those comparisons.

**Known limit.** Under the iPhone profile, JavaScript still sees Chromium: `navigator.userAgentData` exists and
reports `mobile: false`. A site that classifies devices in JavaScript by engine features would not see an iPhone.

### 2.3 What is read

**Walmart.**

- **What is read.** Walmart's own page data (`__NEXT_DATA__` → `product`), the same fields
  `walmart-price-gap-2026-10/probe.mjs` read: offer id, seller id and name, fulfilment, condition, current, was and
  member price. The reader also takes the cart badge count.
- **Store labels.** Store ids are replaced by run-local labels `S1`, `S2`, … before anything is written, because a
  store number locates the visitor.
- **A visitor's bucket is its offer id.** The price is recorded beside it, so a reprice of the same offer is visible
  as a price change, not as a bucket change.

**Hotels.**

- **Room cards.** The reader takes every room card the page shows: name, nightly price, total, fee and tax lines,
  "only N left", sold out, member-only. A per-site `cardSelector` / `nameSelector` / `priceSelector` set at
  calibration (§2.6) is used if given. Without one, a card is the innermost element whose text holds a room word and a
  price.
- **Primary measure (J2).** The lowest nightly price among non-sold-out cards whose name matches the registered room
  type (§4.1). The card name is recorded with it, so a change of card is visible.

### 2.4 Pacing, walls and stop rules

**Spacing.**

- Loads on a site are 45–75 s apart, uniform and seeded, so a run's spacing can be reproduced. J2 has its own slot
  timing (§4.3).
- One live load is in flight at a time across all J probes. A lock file in the private directory makes a second J
  probe wait.
- **J never overlaps another live study on this Mac.** Stage 2 starts only on the director's "GO STAGE 2".

**What counts as a wall.**

- an HTTP 401/403/429/503 response;
- a wall phrase near the top of a page that yielded no data (the device-pricing list, plus "Robot or human?").

A wall is recorded as **BLOCKED**, with its phrase and 200 characters of scrubbed text. It is never clicked, held,
solved or retried in the same profile.

**Stop rules.**

| condition | action |
|---|---|
| 3 walls in a row on a site | cool off 15 min |
| a second run of 3 walls in a row | stop that probe for the day |
| an HTTP 429 | stop that probe for the day |
| more than half of the first 10 loads on a site walled | that site's part of J is reported BLOCKED, not retried |
| on battery below 40 % (`pmset -g batt`, checked before every load batch) | pause, polling every 5 min, until on AC or at least 40 % |

**Replacements.**

- **J1.1:** a walled profile is replaced by a new profile of the same device at the end of the queue, at most 6 per
  device.
- **J1.2:** a walled copy is retried in a new profile at most twice, then counts as unresolved.

### 2.5 Cookies: what moves between browsers, and what is written down

**The bot-manager class is never transferred.** Several J tests copy a site's cookies from one lab browser into
another. Cookies whose names belong to a bot-manager vendor are never copied:

- PerimeterX/HUMAN: `_px*`, `pxcts`;
- Akamai: `_abck`, `bm_*`, `ak_bmsc`, `akavpau*`;
- F5: `TS…`;
- Cloudflare: `__cf_bm`, `cf_clearance`;
- DataDome, Imperva (`incap_ses*`, `visid_incap*`, `reese84`), Kasada.

The same rule applies to localStorage keys. Re-using a clearance token in another browser would be evading a wall, so
it is out. If the transferable cookies do not carry the offer, J1.2 stops and says so (JAR-DOES-NOT-CARRY). It does not
go on to test the bot-manager class.

**What is written to the repo about a cookie:**

- name, our role label, domain, `httpOnly`, `secure`, `sameSite`, and an expiry bucket;
- J1.3 only: which names changed, appeared or disappeared since that profile's own baseline. The comparison runs in
  memory against values kept in the private state directory.

**No cookie values, and no hashes of values.** This is stricter than the prior isolation, which stored 10-hex hashes.

**How roles are assigned.** Role labels are ours, read from the name:

- `experiment`, `visitor-id`, `location`, `session-app`, `traffic-class`, `consent`, `analytics-ads`, `other`,
  `bot-manager`;
- Walmart's names follow the prior isolation;
- `ipSessionTrafficType` is labelled `traffic-class`; it is Walmart's own and is not a bot-manager vendor cookie, so
  it is transferable.

The labels describe; no measurement depends on them except the bot-manager exclusion.

### 2.6 Calibration loads (not data)

Some live facts cannot be known before a live load:

- Walmart's cart-control text;
- Priceline's and Agoda's room-card markup;
- the hotel pages' URLs;
- J1.4's items.

**Calibration** is a small, fixed budget of loads made before any measured series. They are recorded, but they are not
data and no analysis uses them.

| site | budget | what is calibrated |
|---|---|---|
| walmart.com | ≤ 4 loads | `probe-calibrate.mjs walmart-cart`: one calibration profile reads the J1 item (does the reader see a product?), then adds it to the cart and empties it (are the cart texts in `adapters.mjs` `CART` recognised, and is the empty state SEEN?). A cart not seen empty clears that profile's cookies. |
| walmart.com, J1.4 selection | ≤ 16 loads | `probe-j1-select.mjs` (§3.4) |
| priceline.com | ≤ 4 loads | find the registered hotel's page for the registered dates; confirm room cards are read (`probe-calibrate.mjs hotel`); set selectors only if the heuristic fails |
| second travel site | ≤ 4 loads | the same, for the site chosen under §4.1 |

**Outputs.** Calibration writes `j1-items.json` and `j2-targets.json`, plus any change to `CART` regexes. These are
**committed before the first measured load**, and the commit SHA is in every raw file (`meta.gitHead`). Reader options
never change once a series has started.

**If calibration fails.** If a reader cannot be made to work within its budget, that part is reported as "not
measurable" with the reason. It is not forced.

### 2.7 Privacy of the outputs (this repo is public)

**The recorder (`lib.mjs` `Recorder`).**

- **Values seen in memory.** Every cookie value and localStorage value the probe sees is registered. Any occurrence in
  the output is replaced, in raw and JSON-escaped form. A value that survives makes the write **fail**.
- **Patterns.** IPv4/IPv6 addresses (version strings like `Chrome/149.0.0.0` excepted), e-mail addresses, wall
  reference ids (Akamai's "Reference #18.…" may encode an address), the home directory and temp paths are replaced as
  well, and a surviving path also fails the write.
- **Short values.** The value check covers values of 8 or more characters. Shorter ones, such as a 4-digit store id,
  `true` or `1`, are kept out only because no probe writes a value at all; the store id is replaced by a label (§2.3).
- **Page text.** Only titles and 200 characters of scrubbed wall text are kept. Screenshots are not saved, because a
  Walmart page names the visitor's store town.

**The private state directory.** It holds J1.3's profiles and baseline cookie values. It is never committed, and it is
deleted when RESULTS.md is written.

### 2.8 Readings are reproducible from the raw files

`analyze.mjs` recomputes every number and verdict from a raw file, using fixed seeds for every permutation test. The
raw files carry `gitHead`, the Chrome, puppeteer and node versions, the launch flags, the device profiles, the seeds and
the gaps.

### 2.9 Stage 2, in order (only after "GO STAGE 2")

0. **Preflight.**
   - `git status` is clean at the registration commit or a later one that only adds calibration files.
   - `pmset -g batt` passes the battery rule (§2.4).
   - `node selftest.mjs --only G1,G2,G3,G4,A1,C2,R3 --headful` passes in the live launch configuration. If it does
     not, stop.
1. **Calibration** (§2.6). Commit `j1-items.json`, `j2-targets.json` and any `CART` change.
2. **J1.1 + J1.1b + J1.4:** `probe-j1-assign.mjs`, about 90–110 loads, about 2 h.
3. **J1.2:** `probe-j1-cookies.mjs`, about 60–95 loads, about 1.5–2 h.
4. **J1.3:** `probe-j1-history.mjs init`, then `daemon`. Six profiles, three days, about 36 loads a day.
5. **J2:** `probe-j2-repeat.mjs`, about 55 loads over about 90 min.
   - Run it inside a gap between J1.3's events. The live lock makes overlap impossible, and the brief's order "J1,
     then J2" is kept by finishing J1.1–J1.2 and enrolling J1.3 first.
   - If the director prefers strictly sequential, J2 waits for J1.3 to finish.
6. **Write-up.** `analyze.mjs` on every raw file, then RESULTS.md, SUMMARY-FOR-JASON.md, and a PR against main (not
   merged).

---

## 3. J1: walmart.com

### 3.1 J1.1 assignment and J1.1b device (`probe-j1-assign.mjs`)

**Design.**

- **Profiles.** 40 brand-new profiles: **10 per device profile**, in 10 blocks of 4. Each block is a seeded random
  order of the four devices, so time cannot pass for device.
- **One load each.** Each profile loads the item once.
- **Stickiness.** Every 4th successful profile reloads once, 45–75 s later, to measure whether the offer sticks
  (10 reloads).
- **J1.4 follow-on.** The first 12 successful profiles then load the three J1.4 items (§3.4).
- **Limits.** Walled profiles are replaced (§2.4). The run stops at 10 observed per device, or at 110 loads.

**Measure.** The first-load offer of each profile.

- **The low offer** is the cheapest offer observed. The brief's "149.99 share" is its share.
- **More than two offers** (a third price was seen once in a lab run): all are listed, and the split is reported as
  low versus not-low.

**Analysis** (`analyzeAssign`).

| quantity | statistic | verdict rule |
|---|---|---|
| split | low-offer share with a **Wilson 95% CI**; exact two-sided binomial test against ½ | one offer: `NO-SPLIT`, with the Wilson upper bound for an offer never seen. Fewer than 20 observed: `INSUFFICIENT`. CI contains 0.5: `SPLIT-CONSISTENT-WITH-HALF`. Otherwise `SPLIT-UNEVEN`. |
| device (1b) | low-offer share per device, each with a Wilson CI; **permutation test** of the 4×2 Pearson χ² (20 000 label shuffles, seed 11) | p < 0.05: `DEVICE-ASSOCIATED`; otherwise `NO-DEVICE-EFFECT-DETECTED` |
| time (secondary) | mean load number, low minus not-low; permutation p (20 000, seed 12) | p < 0.05: `ORDER-ASSOCIATED`, meaning the split drifted during the run |
| stickiness | reloads showing the first offer | all: `STICKY`; any other: `NOT-STICKY` |
| store (descriptive) | offer by store label, if more than one store label appears | — |

### 3.2 J1.2 which cookie carries the offer (`probe-j1-cookies.mjs`)

**Donors.** Fresh `mac-chrome` profiles load the item until two have drawn different offers (at most 10 tries):

- **A** is the cheaper offer and **B** the dearer one;
- their site cookies are captured in memory immediately;
- the donor browsers stay open and re-read the item at the end, to check that the donors themselves did not drift.

**Candidate set U.** Every cookie name either donor holds, minus the bot-manager class (§2.5).

**Each test is a "copy".** A fresh `mac-chrome` profile gets a cookie jar, then loads the item once. Its outcome is A's
offer, B's offer, another offer, or unresolved (walled three times).

**Steps, in this order.**

1. **FULL(U).** U from A, then from B, alternating, up to 6 copies, stopping at the first copy that shows the other
   donor's offer.
   - Every copy matches: U carries the offer.
   - Otherwise J1.2 stops with **JAR-DOES-NOT-CARRY**: what carries the offer is not in the transferable jar (or
     not in cookies at all). That would be a finding: the prior run's subsets each contained a bot-manager cookie.
2. **BISECT(U) with mirrored jars.**
   - Split the current candidates C into halves H and C∖H.
   - Jar X = H from A, and every other name in U from B. Jar Y is the mirror.
   - Each jar holds a complete set of names, so a profile is never re-drawn at random unless the site rejects mixed
     jars. Whichever donor's offer X shows says which half holds the deciding cookie.
   - **Two mirror pairs per step must agree** (X→A and Y→B twice, or X→B and Y→A twice).
   - Anything else is an **interaction** (step 5).
   - Halving continues to one name d.
3. **VERIFY(d).** Two more mirror pairs with only d from A and all else from B, and the reverse. d is the **decider**
   only if both pairs agree.
4. **ALONE(d).** d by itself into fresh profiles, 6 copies, alternating donors, stopping at the first miss. Recorded
   as yes or no:
   - "yes": d is sufficient;
   - "no": d decides inside a full jar but needs companions.
5. **Next round.** U ← U∖{d}, then FULL again (6 copies).
   - It carries: BISECT/VERIFY/ALONE find the fallback carrier.
   - It does not: **NO-FURTHER-CARRIER** (without the deciders found so far, nothing else carries the offer).
   - At most three rounds.
6. **Interaction (DDMIN).** If a bisection step is not a clean mirror, Zeller's delta debugging searches U for a
   minimal sufficient set, using fresh transfers: each test is up to 8 alternating copies, stopping at the first
   miss. The set found is re-verified once (8 copies).
   - **INTERACTION**: a minimal carrying set {…} was found and held;
   - **INTERACTION-UNSTABLE**: the set did not re-verify.

**Budget.** 90 resolved copies. The budget, the wall stop rules and the copy cap all stop the probe with
**STOPPED/UNRESOLVED** and the narrowest result established so far.

**Error rates.** If the site re-draws a visitor 50/50 whenever a jar does not carry the offer, a non-carrying set
passes by luck with these probabilities (`analyze.mjs power`):

| test | chance of passing by luck |
|---|---|
| FULL, 6 copies | 1/64 = 0.016 |
| ALONE, 6 copies | 0.016 |
| DDMIN test, 8 copies | 1/256 = 0.004 |
| one BISECT step (two agreeing mirror pairs) | 0.125 |

A wrong BISECT step is then caught by VERIFY (0.125) and ALONE (0.016).

The J1.1 split is used to restate these bounds (`analyze.mjs cookies --split <J1.1 share>`).

**Expected cost.** About 60–75 copies with the predicted two-carrier structure. A fixture run with the C2 structure used 62.

### 3.3 J1.3 does history move it (`probe-j1-history.mjs`)

**Enrolment.** Fresh `mac-chrome` profiles (at most 14) load the item until **3 profiles hold each of the two
offers**.

- In each bucket, a seeded draw makes **2 SHOPPERS and 1 CONTROL**: 4 shoppers and 2 controls in all.
- The enrolment reading is each profile's **baseline**.
- If either offer has fewer than 2 profiles after 14 tries, J1.3 stops ("only one offer seen").

**Schedule** (local time, days 1–3 after enrolment):

| time | event | who |
|---|---|---|
| 09:30 | reading: the item once | all six |
| 10:00 | shopping session (below) | shoppers |
| 18:30 | reading: the item once | all six |
| after the last reading | swap (below) | — |

**Shopping session.** For each shopper, with 20–40 s between steps:

1. the item;
2. the first two other items linked from its page;
3. the item again;
4. **Add to cart**;
5. open the cart, press Remove until the page **says the cart is empty**.

**Cart safety.**

- If the empty state is not seen after two tries, the profile is **withdrawn**: its site cookies are cleared, so no
  cart stays attached to a lab browser.
- At every reading, a shopper whose cart badge is above 0 is emptied.
- Nothing is ever bought, and no checkout page is opened.

**Missed events.** An event more than 4 h late (for example, the Mac slept) is skipped and recorded. The swap is never
skipped.

**Swap.** Each profile whose offer or price differed from its baseline in **two consecutive** readings has its
transferable cookies copied into 2 fresh profiles. The question is whether the changed price follows the cookies.

**Analysis** (`analyzeHistory`).

- **Per profile:** the series, the share of readings that differ from baseline, whether a change persisted, its
  direction (up, down, or offer-switch), the cookie names that changed, and the swap result.
- **Verdict rules:**

| verdict | rule |
|---|---|
| `NO-CHANGE` | no reading differs from baseline |
| `GLOBAL-CHANGE` | shoppers and controls changed together in one direction: Walmart repriced for everyone |
| `HISTORY-EFFECT` | at least 2 shoppers changed persistently in one direction, no control changed, and at least one changed shopper's 2 of 2 swap copies showed the changed price |
| `CHANGE-NOT-CARRIED-BY-COOKIES` | as `HISTORY-EFFECT`, but the swap did not carry the change |
| `CONTROL-ONLY-CHANGE` | only controls changed |
| `MIXED` | anything else |

- **Secondary, descriptive.** The shoppers-minus-controls difference in changed share, with a permutation p over the
  9 assignments the stratified draw could have made. **The smallest attainable p is 1/9**, so J1.3 cannot reach
  p < 0.05 by itself and is not tested at that level. It can show "nothing moved" or "a large, consistent,
  cookie-carried movement worth a bigger study".

### 3.4 J1.4 other marketplace items

**Selection (`probe-j1-select.mjs`, calibration).** The queries are fixed in that file: "Bose QuietComfort
headphones", "Samsung Galaxy Buds", "Apple iPad 9th generation", "Nintendo Switch OLED". For each query, in order:

- open walmart.com's search page once in a fresh `mac-chrome` profile;
- take item links in document order, skipping the J1 item and items already chosen;
- open up to 3 of them, and admit the first whose page names a seller that is **not walmart.com** (seller id prefix
  ≠ `F55CDC31`, the prefix the prior isolation recorded for Walmart itself).

Selection stops at 3 items. The selection is written to `j1-items.json` and committed.

**Measurement.** The first 12 successful J1.1 profiles (by the block design, about 3 per device) load the three items
after their J1.1 reading, so each of those loads is paired with that profile's AirPods bucket.

**Analysis.**

| verdict | rule |
|---|---|
| `NO-SPLIT-IN-n` | one offer per item. Reported with the Wilson upper bound for an unseen offer: 0/12 bounds an unseen minority offer at about 24%, so a rarer bucket can be missed. |
| `SPLIT-FOLLOWS-MAIN-BUCKET` | two or more offers, and Fisher's exact test against the profile's AirPods bucket gives p < 0.05: one site-wide visitor bucket |
| `SPLIT-NOT-SHOWN-TO-FOLLOW-MAIN-BUCKET` | two or more offers, Fisher p ≥ 0.05. This is not proof of independence at n = 12. |

---

## 4. J2: repeat views versus fresh views

### 4.1 Sites, hotel, dates, room (registered)

**Sites.**

- **Primary site: priceline.com.** The owner's own recollection is from Priceline.
- **Second site:** the first of **agoda.com, expedia.com, hotels.com** whose calibration loads (at most 2 each) render
  the registered hotel's room rates without a wall. Agoda is first because it rendered a dated hotel rate to an
  anonymous automated visitor in the device-pricing run (`device-pricing/RUN-2026-09-22.md`).
- **If no second site qualifies,** J2 is Priceline only, and the report says so.

**Hotel.**

- **Primary:** Excalibur Hotel & Casino, Las Vegas, NV. It is large, listed by every major OTA, has actively managed
  rates, and carries a resort fee, which tests fee capture.
- **Fallback:** Luxor Hotel & Casino, Las Vegas, used if Priceline shows no bookable rate for the dates.

**Dates and rooms.**

- **Stay:** check-in **Wednesday 2026-12-09**, check-out **Friday 2026-12-11** (2 nights). If J2 runs after
  2026-11-25, the stay is the first Wednesday at least 14 days after the run date, again 2 nights.
- **Party:** 2 adults, 1 room, USD.
- **Room type:** regex `\bking\b`. The primary measure is the cheapest non-sold-out card whose name matches. Its name is
  recorded at every load, so a switch of card counts as an availability change.
- **Excluded:** Priceline's opaque products ("Express Deals" and the like) are not the registered hotel's retail rate.

### 4.2 Calibration

At most 4 loads per site (§2.6), to:

- resolve the hotel page URL with the dates in it;
- confirm the reader returns room cards and the registered room;
- set selectors only if the heuristic fails.

Calibration writes `j2-targets.json`, which is committed before slot 1.

### 4.3 Slot protocol (`probe-j2-repeat.mjs`)

**The REPEAT browser.**

- One per site, opened at the start and **kept open for the whole run**, so it keeps its cookies, its localStorage and
  any session state.
- It views the hotel once per slot, in a new tab each time; the old tab is closed.

**The FRESH browser.** At every slot, a brand-new profile views the same page.

**The pair.**

- The two loads run **back to back**, 8–20 s apart.
- **The order is counterbalanced and seeded:** 5 slots repeat-first, 5 fresh-first. A price that steps between the
  two loads of a pair then adds noise in both directions equally rather than bias.

**Timing.**

- **10 slots, 6–9 min apart** (uniform, seeded): 60–90 min in all.
- With two sites, the sites alternate inside a slot. Each site sees 2 loads per slot.

**Recorded per load:**

- price, room name and total;
- fee and tax lines, struck-through prices, "only N left", sold out, member-only;
- card count and cookie names;
- the repeat browser's view number.

### 4.4 The swap

After slot 10:

1. The repeat browser views once more (**repeat-now**). Its transferable cookies and localStorage are captured in
   memory.
2. **swap-C**, twice: a fresh browser with the repeat browser's cookies.
3. **swap-CS**, once: the same, plus its localStorage restored before the page's own scripts run.
4. **Each swap load is paired with its own new fresh control**, seconds apart, in a seeded order.

The swap runs whatever the slots showed.

### 4.5 Analysis (`analyzeRepeat`), per site

**Quantities.**

- r<sub>i</sub> and f<sub>i</sub>: the repeat and fresh primary prices at slot i.
- d<sub>i</sub> = r<sub>i</sub> − f<sub>i</sub>.
- **Slot 1 is both browsers' first view.** Its gap d<sub>1</sub> is the between-visitor baseline, not a repeat
  effect.

**DEMAND (everyone).**

- **Statistic:** Spearman ρ between slot number and f<sub>i</sub>, with a permutation p (20 000 shuffles, seed 21).
  Also reported: the Theil–Sen slope ($ per slot), first, last, min and max, and the same statistic for the repeat
  series.
- **Verdicts:** p < 0.05 gives `RISING` or `FALLING` by the sign of ρ; otherwise `NONE-DETECTED`; fewer than 6
  fresh readings gives `INCONCLUSIVE`.
- **Availability** per slot (cards, sold out, "only N left" for the primary room, cheapest card) is reported beside
  it, because availability is what explains demand moves.

**PERSONAL (the viewer who keeps looking).**

- **The gaps:** d<sub>2</sub>…d<sub>10</sub>, slots with both readings.
- **Exact paired sign-flip permutation test:** the sum of d over all 2<sup>m</sup> sign patterns of the non-zero d,
  two-sided. Under "no personal effect", repeat and fresh are exchangeable within a slot.
- **Persistence:** at least ⅔ of the compared slots (6 of 9) show a non-zero gap with the sign of the sum.
- **Gap origin:**
  - |d<sub>1</sub>| ≤ ½·|median gap|: the gap was not there at the first view;
  - the repeat browser's own price moved from its slot-1 value, in the gap's direction, in ≥ ⅔ of later slots.
- **Dose (secondary):** Spearman ρ between slot and d<sub>i</sub>, permutation p.
- **Fresh dispersion flag (descriptive):** the fresh series takes at least 2 values with at least 2 direction
  reversals. Fresh visitors did not all see one trajectory (buckets or noise).
- **Swap outcome, per copy:**
  - `carried` if the copy's gap over its own fresh partner is nearer the measured gap (median d<sub>2..10</sub>) than
    zero;
  - `not-carried` if nearer zero;
  - `no-gap` when the measured gap is 0.
  - Overall: all copies carried gives `CARRIES`; any not-carried gives `NOT-CARRIED`.

**Verdict, in this order:**

| verdict | rule |
|---|---|
| `INCONCLUSIVE` / `BLOCKED` | fewer than 6 compared slots. `BLOCKED` if more than ⅓ of the site's loads were walled. |
| `NONE-DETECTED` | sign-flip p ≥ 0.05, or the persistence rule fails |
| `GAP-ORIGIN-UNKNOWN` | p < 0.05 and persistent, but slot 1 is missing for either browser |
| `VISITOR-BUCKET` | p < 0.05 and persistent, but the gap was present at the first view, or the repeat browser's own price never moved: a standing between-visitor difference, not something looking again caused |
| `REPEAT-VIEW-EFFECT (carried by cookies)` | p < 0.05, persistent, absent at the first view, the repeat's own price moved, and swap-C `CARRIES` |
| `REPEAT-VIEW-EFFECT (carried by cookies + localStorage)` | as above, but swap-C did not carry and swap-CS `CARRIES` |
| `GAP-NOT-CARRIED` | everything above except that neither swap carried. **Per the brief, this does not count as a personal effect.** |

### 4.6 Stopping

- **Walls:** the §2.4 rules apply per site. A stopped site's remaining slots are recorded as skipped.
- **No bookings, no sign-ins.** No room is selected beyond loading the hotel page, and no checkout page is opened.

---

## 5. What each outcome would and would not mean

| outcome | would mean | would NOT mean |
|---|---|---|
| J1.1 `SPLIT-CONSISTENT-WITH-HALF` + `STICKY` + `NO-ORDER-EFFECT` | New visitors are split between the two offers about evenly, and each keeps its draw. This is what a random, sticky A/B assignment looks like. | That it IS random: a 50/50 hash of a visitor id looks the same. It also would not mean that it uses personal data, or that it holds on another day, IP or item. |
| J1.1 `SPLIT-UNEVEN` | The draw is weighted (for example a 90/10 holdout), or keyed to something all our profiles share. | Which of the two it is. |
| J1.1b `DEVICE-ASSOCIATED` | The device a NEW visitor presents tilts which offer it is first shown, on this item, from this connection. | That a device "pays more" in general, or why. The per-device CIs are wide (10 each); see §6. |
| J1.1b `NO-DEVICE-EFFECT-DETECTED` | No device tilt large enough to detect. | That there is none: a 0.65/0.35 phone/desktop tilt is detected only about 26% of the time (§6). |
| J1.2 decider of role `experiment` | The offer is carried by an experiment-assignment cookie: an A/B test of which offer to show. | Who runs the test (Walmart or the seller), or what it optimises. |
| J1.2 decider of role `visitor-id` or `location` | The offer is keyed to the visitor's identity cookie, or to a store/location cookie. | That the key is personal data beyond a random visitor id: the ids are anonymous lab profiles. |
| J1.2 `JAR-DOES-NOT-CARRY` | What carries the offer is a bot-manager cookie or not a cookie at all. That would overturn the prior reading that "the experiment and visitor subsets each carry it". | That the bot-manager vendor sets prices: it may only mean those cookies gate the visitor record. |
| J1.2 `INTERACTION` | No single cookie decides; a set must travel together (for example, an id and its signature). | — |
| J1.3 `HISTORY-EFFECT` | In this lab, three days of shopping moved shoppers' price and the change travelled with their cookies. A first controlled observation, to be replicated before anything else. | That purchases, accounts or longer histories behave the same, or that it is "surveillance pricing" in the FTC's sense. |
| J1.3 `NO-CHANGE` / `GLOBAL-CHANGE` | No shopper-specific movement in 3 days at this intensity. GLOBAL-CHANGE: Walmart repriced for everyone. | That history never matters. Logged-in, purchase-based and longer horizons are untested. |
| J1.4 `SPLIT-FOLLOWS-MAIN-BUCKET` | One visitor bucket spans items (a site-wide experiment). | — |
| J1.4 `NO-SPLIT-IN-12` | The two-offer split is not seen on that item. | That the item has no minority offer below about 24%. |
| J2 personal `NONE-DETECTED` | Looking again, ten times over about 90 min, did not move this viewer's price relative to a fresh viewer's. | That no site ever does it, that longer histories or logged-in users are not treated differently, or anything about flights. |
| J2 personal `REPEAT-VIEW-EFFECT` | This site showed a repeat viewer a different price than a simultaneous fresh viewer, the gap appeared after the first view, persisted, and travelled with the browser state. **That would be the first controlled demonstration this lab knows of**; it is reviewed before anyone says it aloud. | The motive, or that it is legal or illegal. |
| J2 personal `VISITOR-BUCKET` | A standing difference between two visitors that was there from the first view (as on Walmart). | That looking again caused it. |
| J2 demand `RISING` with personal `NONE-DETECTED` | The price rose for everyone during the run (revenue management). That is Jason's "increased demand" explanation, and it is indistinguishable from personal pricing to someone who only looks from one browser. | That anyone's viewing caused the rise: demand from other shoppers, inventory and scheduled rate changes all look the same here. |

---

## 6. Sensitivity (`node analyze.mjs power`)

**J1.1 (n = 40).**

- The Wilson CI at a 20/20 split is ±0.148.
- **Power of the binomial test against ½ at α = 0.05:**

| true low-offer share | power |
|---|---|
| 0.60 | 0.20 |
| 0.70 | 0.70 |
| 0.75 | 0.90 |
| 0.80 | 0.98 |
| 0.90 | 1.00 |

**J1.1b (10 per device).** Rejection rate of the permutation χ² over 400 simulated datasets (999 permutations each):

| scenario | rejection rate |
|---|---|
| no effect (false-positive rate) | **0.048** |
| one device 0.9, the rest 0.5 | 0.42 |
| phones 0.8 / desktops 0.2 | 0.95 |
| phones 0.7 / desktops 0.3 | 0.51 |
| phones 0.65 / desktops 0.35 | 0.26 |

**Only a large device tilt is reliably detectable.** That is why a null 1b result is worded "not detected".

**J2 personal (9 compared slots).** The exact sign-flip p when k slots show the same gap and the rest show 0:

| k (of 9) | p |
|---|---|
| 3 | 0.25 |
| 4 | 0.125 |
| 5 | 0.0625 |
| **6** | **0.031** |
| 7 | 0.016 |
| 8 | 0.008 |
| 9 | 0.004 |

Seven slots at +5 with two at −5 gives p = 0.18. So **a repeat-view gap must appear in at least 6 of 9 later slots**,
which is the same bar as the persistence rule.

**J2 demand (10 slots).** A single step up is detected if it lands between slot 4 (ρ 0.80, p 0.017) and slot 9
(ρ 0.70, p 0.044). A step at slot 2 or slot 10 is not (p ≈ 0.20). A steady climb is (ρ 0.98, p < 0.0001).

**J1.2.** Chance that a set which does not carry the offer passes by luck: FULL or ALONE 0.016, DDMIN 0.004, one bisect
step 0.125 (§3.2).

**J1.3.** Smallest attainable permutation p = 1/9 = 0.11 (§3.3).

---

## 7. The harness and its self-test (positive and negative controls)

`selftest.mjs` runs **every probe unmodified** as a child process against `fixtures/server.mjs`, a local stand-in.

- **What the fixture copies.** The page shapes the readers depend on: Walmart's `__NEXT_DATA__` block, a cart badge,
  "Add to cart" and "Remove" controls, and a client-rendered hotel page with marked and unmarked room-card templates.
- **What the fixture plants.** Known mechanisms, set per case.
- **What each case checks.** That `analyze.mjs` returns the pre-registered verdict:
  - **positive** cases plant an effect, and the analysis must find it;
  - **negative** cases plant none (or a confound), and the analysis must not report the effect;
  - **guard** cases check the safety rules.

Every case runs on a fresh fixture with a fixed seed. Results are in `selftest/selftest-<date>.json`.

| id | kind | planted | expected verdict |
|---|---|---|---|
| G1–G4 | guard | a live target (walmart.com / priceline.com) without `--live` | every probe exits 3 before a browser starts; no output |
| A1 | pos + neg | fair 50/50 bucket carried by `xpa` (fallback `vtc`); follow items F1 (same bucket), F2 (one offer), F3 (own split) | `SPLIT-CONSISTENT-WITH-HALF`, no device effect, no order effect, `STICKY`; F1 follows, F2 no split, F3 not shown to follow; per-device header checks |
| A2 | positive | phones drawn to the cheap offer 90%, desktops 10% | `DEVICE-ASSOCIATED`; phone CIs above desktop CIs |
| A3 | negative | one offer for everyone | `NO-SPLIT` |
| A4 | positive | uneven 90/10 bucket | `SPLIT-UNEVEN`, no device effect |
| A5 | guard | every 3rd page walled, with an IP address in the wall text | BLOCKED recorded, profiles replaced, wall text kept, IP scrubbed |
| A6 | guard | every page walled | stops after the second run of 3 walls (6 loads) |
| A7 | guard | battery 35%, then 38%, then AC | two pauses, then completes |
| S1 | guard | every search lists a walmart.com-sold item first | three marketplace items admitted, never the walmart.com-sold one, one per query |
| C1 | positive | `xpa` alone carries the offer | decider `xpa` (carries alone), then `NO-FURTHER-CARRIER` |
| C2 | positive | `xpa` decides; without it `vtc` carries (the prior two-subset pattern) | deciders `xpa`, then `vtc`, both carry alone |
| C3 | positive | only the PAIR (`xpa`, `vtc`) carries | `INTERACTION`, minimal set {vtc, xpa} |
| C4 | negative | the carrier is a bot-manager-class cookie | `JAR-DOES-NOT-CARRY`; `_px3` excluded |
| C5 | negative | one offer | `ONE-OFFER-ONLY` |
| H1 | negative | shopping changes nothing (scheduled by the daemon) | `NO-CHANGE`; 6 profiles (2+1 per bucket), every reading taken, 12 cart sessions all SEEN empty |
| H2 | positive | two cart sessions raise the visitor's price $10 | `HISTORY-EFFECT`; 4 shoppers, 0 controls changed; swaps carry |
| H3 | negative | the item is repriced for everyone after day 1 | `GLOBAL-CHANGE`, not `HISTORY-EFFECT` |
| R1 | negative | nothing | personal and demand `NONE-DETECTED` |
| R2 | negative | random ±$3 on every response, for everyone | personal and demand `NONE-DETECTED`; dispersion flagged |
| R3 | positive | +$12 from the 2nd view, counted on a cookie | `REPEAT-VIEW-EFFECT (carried by cookies)`; demand none |
| R4 | positive | +$12 from the 2nd view, counted in localStorage | `REPEAT-VIEW-EFFECT (… + localStorage)`; swap-C NOT-CARRIED, swap-CS CARRIES |
| R5 | positive | +$4 per slot for everyone | demand `RISING`; personal `NONE-DETECTED` |
| R6 | positive | demand drift and a repeat bump | demand `RISING` and `REPEAT-VIEW-EFFECT (cookies)` |
| R7 | negative | a 50/50 visitor bucket (+$10), no repeat effect | not a repeat-view effect; dispersion flagged or `VISITOR-BUCKET` |
| R8 | guard | every 4th hotel page walled, with an IP in the wall text | BLOCKED recorded; not a repeat-view effect; IP scrubbed |
| A8 | guard | 7 of the first 10 pages walled, never 3 in a row | stops at load 10, site BLOCKED |
| K1 | guard | the calibration cart check on the fixture cart | `CART-OK`; the fixture cart left empty |
| K2 | guard | the calibration hotel check on the unmarked template | `HOTEL-OK` via the heuristic reader |
| P1 | guard | the fixtures' every issued cookie value, their fake IP, local paths | none in any output file; no request left 127.0.0.1 |

**Result: 32 of 32 cases passed** (2026-10-17, headless, 10.9 min, Chrome for Testing 149.0.7827.22, 3 cases at a
time) on the code in this commit: `selftest/selftest-2026-10-17.json`. Every positive control found its planted
effect, and every negative control reported none. No fixture cookie value, fake IP or local path appeared in any
output file, and no request left 127.0.0.1.

**The self-test can fail.** A suite that always passes proves nothing. Before this registration, five deliberate
breakages were each run against a scratch copy of this folder, and every one was caught:

| breakage | case run | caught by |
|---|---|---|
| the analysis ignores swap-C's result | R4 | verdict became "carried by cookies"; R4 FAILED |
| the fixture's planted repeat-view bump removed | R3 | verdict became `NONE-DETECTED`; R3 FAILED |
| `navigator.platform` no longer set per device | A1 | the platform check saw only `MacIntel`; A1 FAILED |
| cookie VALUES written into raw files, redaction ON | C5, A3 | the recorder replaced 52 values with `[cookie-value]`; P1 passed because nothing leaked |
| cookie VALUES written, redaction OFF | C5, A3 | P1 found 312 issued values in the outputs; P1 FAILED |

**What the self-test does not prove.**

- That the live sites' markup matches the fixtures. That is what calibration (§2.6) is for.
- That live walls behave like the fixtures' walls.
- That a live site's mechanism is one of the planted ones. The probes and analysis are built to report "none of the
  above" (`MIXED`, `INTERACTION-UNSTABLE`, `GAP-NOT-CARRIED`, `INCONCLUSIVE`) rather than force a fit.

---

## 8. Files

| file | role |
|---|---|
| `METHOD.md` | this pre-registration |
| `lib.mjs` | launch configuration, device profiles, live-load guard, wall detection and stop rules, cookie roles and transfer, battery gate, privacy-scrubbing recorder, live lock |
| `adapters.mjs` | Walmart item, cart and related-item readers; hotel room-card reader; primary measure |
| `stats.mjs` | Wilson CI, exact binomial, permutation χ², sign-flip, Spearman and permutation, Theil–Sen, Fisher exact (seeded) |
| `analyze.mjs` | the analyses and verdict rules of §3–§5; `power` prints §6 |
| `probe-j1-assign.mjs` | J1.1, J1.1b, J1.4 measurement |
| `probe-j1-cookies.mjs` | J1.2 |
| `probe-j1-history.mjs` | J1.3 (`init`, `daemon`, `tick`, `status`) |
| `probe-j1-select.mjs` | J1.4 selection (calibration) |
| `probe-calibrate.mjs` | calibration checks: `walmart-cart` (add, then SEE the cart empty) and `hotel` (room cards, registered room) |
| `probe-j2-repeat.mjs` | J2 |
| `fixtures/server.mjs` | the local stand-in with planted effects |
| `selftest.mjs`, `selftest/` | the stage-1 controls and their result |
| stage 2: `j1-items.json`, `j2-targets.json` | calibration outputs, committed before data |
| stage 2: `raw/*.json`, `RESULTS.md`, `SUMMARY-FOR-JASON.md` | data and write-up |

**Reproduce.** Puppeteer is not a dependency of the repo; point `NULLECHO_PUPPETEER_DIR` at a directory whose
`node_modules` holds it.

```
NULLECHO_PUPPETEER_DIR=<dir> node research/cookie-pricing-2026-10/selftest.mjs     # stage-1 controls (~20 min)
node research/cookie-pricing-2026-10/analyze.mjs power                             # §6
```

## 9. Deviations

None. This section is closed at the registration commit, and later deviations go in RESULTS.md.
