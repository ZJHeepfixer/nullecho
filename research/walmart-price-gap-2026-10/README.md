# Walmart price gap — isolation notes (research, 2026-10-17)

**Status: the difference can be switched on and off with Walmart's own cookies, with no extension at all.**

This note records measurements. It is not user-facing copy, and nothing here may be quoted as "Nullecho lowers
prices". It says what switches the price, not why Walmart does it.

## What was seen

The shopping lab (0.9.3) recorded walmart.com item **5689919121** (AirPods Pro 2, USB-C) at **$169.99 with the
extension OFF and $149.99 ON** three times:

- 2026-10-15, an unseeded debug run;
- 2026-10-15, the seeded-gate re-run on `980d532`;
- 2026-10-17, the breadth lab, round 1.

Every time, **zero personalization-rule requests matched** on the page.

## Method

`probe.mjs` changes one thing per arm and runs the arms one after another within the same few minutes. Each arm is its
own Chrome for Testing 149 browser and profile:

- **OFF**: no extension.
- **ON**: the store zip, seeded.
- **A**: ON without the personalization ruleset.
- **B**: ON without the device layer (no shim or loader).
- **C**: persona only (every blocking ruleset, GPC and the learner off).
- **D**: OFF with Chrome's UA and client hints set to an ON page's values.
- **E**: ON with a new seeded profile every cycle.
- **F**: ON with a new unseeded profile every cycle.

Per load it records Walmart's page data (`__NEXT_DATA__`: offer, seller, fulfilment, condition, current and was
price), the assigned store (`assortmentStoreId`), a hash of the experiment-assignment cookie (`xpa`), and the device
the page saw. `cookies.mjs` then works with **no extension**:

1. It finds one fresh profile showing each price.
2. It copies that profile's walmart.com cookies (all of them, then subsets) into brand-new profiles.
3. It loads other items in the two donor profiles.

Walls (PerimeterX/HUMAN "Robot or human?") are recorded, never evaded. Cookie values are saved only as short hashes.

## Results

**What Walmart showed.** Every reading has:

- seller `66306FC5…` (a marketplace seller; "Top renew LLC" on the page);
- fulfilment MARKETPLACE, condition New;
- was-price $199.00;
- store 1600;
- no ZIP on the page;
- no member price (`wPlusEarlyAccessPrice` null).

The two prices are **two offers from that same seller**: offer `0C3F46B1…` at **$169.99** and offer `BEB7CB59…` at
**$149.99**.

**Run 2: one variable per arm** (`raw-run2-gap75s.json`, 75 s between loads, 16:31–17:05 PDT):

| arm | what changes | c1 | c2 | c3 |
|---|---|---|---|---|
| OFF | no extension (one profile kept) | WALL | 169.99 | 169.99 |
| ON | full extension, seeded (one profile kept) | 149.99 | 149.99 | 149.99 |
| A | ON − personalization ruleset | 169.99 | 169.99 | 169.99 |
| B | ON − device layer (blocking + GPC only) | 169.99 | 169.99 | 169.99 |
| C | persona only (no blocking, GPC or learner) | 149.99 | 149.99 | 149.99 |
| D | OFF + ON's UA and client hints | 169.99 | 169.99 | 169.99 |
| E | ON, a NEW seeded profile each cycle | 169.99 | 149.99 | 169.99 |
| F | ON, a NEW unseeded profile each cycle | 169.99 | WALL | 169.99 |

Other readings in fresh profiles with no extension: $169.99 (offer `0C3F…`, the first load of the day) and **$149.99**
(offer `BEB7…`, run 1). So each profile kept the offer it first got, through every cycle, with its `xpa` hash
unchanged. Fresh profiles got either offer with the extension (E) and without it.

Run 3 (`raw-run3-cookies.json`) found a $169.99 donor, then 7 walls in a row: no transfer was possible.

**Run 4: cookie transfer, NO extension anywhere** (`raw-run4-cookies.json`, 90 s between loads). One fresh profile
showed $149.99 and the next showed $169.99. Their cookies were then copied into new profiles:

| copied into a fresh profile | from the $149.99 profile | from the $169.99 profile |
|---|---|---|
| all walmart.com cookies (3 tries) | WALL, **149.99**, **149.99** | WALL, **169.99**, **169.99** |
| only the experiment cookies (`xpa`, `xptc`, `exp-ck`, …) (2 tries) | **149.99**, **149.99** | **169.99**, **169.99** |
| only the visitor cookies (`vtc`, `ACID`, …) (2 tries) | **149.99**, **149.99** | **169.99**, **169.99** |

Every copy that loaded showed its donor's price: 10 of 10, with no extension anywhere. **The $20 difference follows
the visitor's Walmart cookies.** Either subset carried it, so the assignment is tied to more than one cookie. Which
one, and why Walmart shows this seller's two offers to different visitors, is not established.

**Other items, loaded in the two donor profiles:** AirPods 4 (`11381374703`) $99.00 in both; AirPods Pro 3
(`17835006350`) $199.00 in both; Mainstays towel (`980653774`) $3.24 (the second profile was walled). All three are sold
by seller `F55CDC31…` (Walmart itself), and none showed a gap.

**Run 5: the same copies, with the extension (the 0.9.3 store zip, unseeded) loaded in each copy**
(`raw-run5-cookies-with-extension.json`; donors found extension-free: 149.99, 149.99, 169.99):

| copied into a fresh profile WITH the extension | from the $149.99 profile | from the $169.99 profile |
|---|---|---|
| all walmart.com cookies (3 tries) | WALL, **149.99**, **149.99** | WALL, **169.99**, **169.99** |

With the extension on, a copied visitor still sees its donor's price (4 of 4 that loaded), in both directions.

**Later sightings (lab, not this probe).** In the seeded gate on `22d28e3`, OFF read 149.99 and ON read **173.99**,
a third price, again with 0 personalization matches. The lab's visitor swap (ON reloading with OFF's cookies) and its
retry were both walled, so that run could not test it. In the walmart-only re-check (`…-walmart-swap`), both profiles
drew 169.99.

## What this means for the lab

The price this item shows is switched on and off by the visitor's Walmart cookies: 10 of 10 copies without the
extension and 4 of 4 with it showed the donor's price, in both directions. Given the same cookies, the extension
changed nothing. The lab's OFF and ON browsers are two different visitors, so a store that shows different visitors
different offers will read there as a price difference whatever the extension does. That is why every such
difference is listed. This one stays listed as a FAIL row with this note attached, rather than being explained away
in the harness. Why Walmart shows this seller's two offers to different visitors is not established, and is not
claimed.
