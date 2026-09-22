# Device-price probe — method, controls, limits

Instrument: `harness/device-price-probe.mjs` · site list: `harness/device-price-sites.json` ·
positive control: `harness/device-price-control.html` · results: `RUN-<date>.md` + `raw/<date>.json` in this directory.

**The question this answers, and only this:** for an anonymous visitor, from one connection, at one
moment, does a public e-commerce or travel page *declare* a different price to different devices?

It does not answer whether anyone is being charged more, whether a price was set using personal data,
or whether anything is lawful. Those are different questions and this instrument cannot reach them.
Section 4 lists what a result here does **not** show; read it before quoting a number.

---

## 1. Method

### 1.1 Four device profiles, each internally consistent

A profile is a bundle of everything a site can read about the "device" at load time. Every field in
a bundle agrees with every other field — a Mac user-agent with a phone viewport would itself be a bot
signal, and a Safari user-agent carrying Chromium client hints would be a contradiction a server can
see on the wire.

| id | what it claims to be | UA string | client hints (`Sec-CH-UA*`) | viewport | dpr | touch |
|---|---|---|---|---|---|---|
| `mac-chrome` | current Chrome on macOS | `Macintosh; Intel Mac OS X 10_15_7 … Chrome/<M>.0.0.0` | `platform "macOS"`, `mobile ?0`, brands Chromium/Google Chrome at `<M>` | 1440×900 | 2 | no |
| `win-chrome` | current Chrome on Windows | `Windows NT 10.0; Win64; x64 … Chrome/<M>.0.0.0` | `platform "Windows"`, `mobile ?0`, same brands | 1536×864 | 1.25 | no |
| `iphone-safari` | Safari on an iPhone | puppeteer `KnownDevices['iPhone 15 Pro']` UA, verbatim (`iPhone OS 17_5 … Version/17.5 Mobile/15E148 Safari/604.1`) | **none** — Safari sends no client hints and none are invented | 393×659 | 3 | yes |
| `android-budget` | Chrome on a low-end Android phone | `Linux; Android 10; K … Chrome/<M>.0.0.0 Mobile Safari/537.36` | `platform "Android"`, `mobile ?1`, `model "SM-A135F"`, `platform-version "13.0.0"` | 360×800 | 2 | yes |

`<M>` is the major version of the Chrome for Testing binary that actually runs, read from
`browser.version()` at start — never typed in. On 2026-09-22 that was **149** (`Chrome/149.0.7827.22`).

Two deliberate choices, written down because they differ from the first draft of the plan:

- **The Android and desktop UA strings use Chrome's frozen ("reduced") form.** Since Chrome 110 every
  Android Chrome sends `Android 10; K` and every macOS Chrome sends `10_15_7` in the UA string; the
  real OS version and device model travel only in client hints (`Sec-CH-UA-Platform-Version`,
  `Sec-CH-UA-Model`). A UA reading `Android 13; SM-A135F` next to `Chrome/149` is a combination no real
  Chrome 149 emits. So the model and OS version live in the hints, which is where a real Galaxy A13
  puts them.
- **The iPhone profile uses puppeteer's recorded iPhone 15 Pro UA unchanged** (iOS 17.5). It is an
  older iOS than a 2026 phone would typically run, but it is a string a real device sent, not one we
  composed. If a site's device logic keys on iOS version this would matter; nothing in the results
  suggested it did.

**What the wire actually carried was checked, not assumed.** The probe starts a throwaway local HTTP
server that echoes request headers (and replies with `Accept-CH` so the high-entropy hints are sent on
the second request). Each profile loads it and the headers are written into the raw JSON under
`controls.echo`. On 2026-09-22: the two desktop profiles and the Android profile sent `Sec-CH-UA`,
`-Mobile`, `-Platform`, `-Platform-Version`, `-Model`, `-Full-Version-List` matching the table; the
iPhone profile sent **no** `Sec-CH-UA*` header at all; all four sent `Accept-Language: en-US,en;q=0.9`.

### 1.2 One fresh incognito context per page load

Every load runs in a new `browser.createBrowserContext()` — a fresh cookie jar, cache and storage —
and the context is closed after. No cookie, session or "recently viewed" state can carry from one load
to the next, from one device to another, or from one site to another. Same machine, same IP, same run.

### 1.3 Interleaved repeats

For each site the page is loaded as device 1, 2, 3, 4, then 1, 2, 3, 4, then 1, 2, 3, 4 — **12 loads a
site, interleaved**, with a random 3–6 s pause between loads. Interleaving is the control for time: if
a price drifts over minutes (inventory, a sale starting, an A/B bucket), the drift lands *across* devices
in a way that breaks the same-device agreement check (1.5), instead of masquerading as a device effect.

### 1.4 Price extraction, in a fixed priority, recording which source fired

1. **JSON-LD** — every `price` / `lowPrice` under `application/ld+json`, `@graph` walked, nearest
   `priceCurrency` attached. Source label `json-ld`.
2. **Microdata** — `[itemprop="price"]` `content` (or text), with a sibling `priceCurrency`. `microdata`.
3. **Meta** — `product:price:amount` / `og:price:amount` (+ `…:currency`). `meta`.
4. **Visible text** — only as a last resort, only through a CSS selector named per site in the sites
   file, parsed with a looser regex that tolerates "From $189 / night". Source label `visible`.

Steps 1–3 use `ext/src/pricing.js` — the extension's own `jsonLdPrices()` / `cleanPrice()` /
`cleanCurrency()` — imported unchanged, in the same order `priceContext()` applies them. Its strictness
is on purpose: a field holding anything other than a number and a currency marker is not reported as a
price. The first usable candidate in document order is "the price" for that load; **every** JSON-LD price
on the page (up to 12) is also recorded so a reviewer can see whether "the price" was the main product
or an unrelated offer.

**One deviation from `priceContext()`, written down here because it is a judgement call: a declared
price of zero falls through to the next source.** Hostelworld's property pages declare
`"price": 0, "priceCurrency": "EUR"` in JSON-LD — a placeholder — and `pricing.js` accepts `"0"`,
correctly for its own question ("does this page publish a price at all?"). For comparing numbers
across devices a zero is not a number to compare, so `0` / `0.00` is treated as "no usable declared
price" at every step, including the visible-text step.

**Two per-site knobs for the visible-text step, both recorded in the sites file and in the raw JSON:**

- `visiblePattern` — a regex whose first capture group is the amount, applied to each matched element's
  text in document order. It exists because phone and desktop templates put *different quantities*
  first: Kayak's desktop car results render "$134 Total for 2 days" while its phone template renders
  the per-day "$67" before "$134 total"; Agoda's phone template renders a struck-through "Original
  Price: USD 132" before "Final price: USD 122"; Airbnb's phone page lists "similar listings" prices
  before the booking footer. Without an anchor, a selector would have reported each of those as a
  device difference. With it, the same quantity (the two-day total, the final rate, the stay total) is
  read on every device — or nothing is, and the load says so.
- `settleMs` — a longer polling budget (18–20 s instead of 9 s) for the three client-rendered travel
  pages. Their phone templates were slow or intermittent under headless Chrome in vetting; the budget is
  what we could afford inside the hour, and a phone load that still rendered no price is recorded as
  `no-price`, never guessed.

For the Kayak car search, `?sort=price_a` is in the URL so that "the first result" means "the cheapest"
on every template rather than whatever the default ranking put first. Vetting showed the first slot is
nonetheless a sponsored placement that changes between loads; the same-device control is expected to
rule that page inconclusive, and it is kept on the list precisely to show the control doing that.

The page is loaded to `domcontentloaded`, then polled every 0.7 s for up to 9 s until a price or a wall
appears (client-rendered pages need the wait). After a price appears the probe waits 1.2 s and reads
again, because some pages rewrite their JSON-LD after hydration; the later read wins if it still has a
price, and any change between the two reads is recorded.

### 1.5 Controls — both mandatory, both reported before any site

**Positive control for the extractor.** `harness/device-price-control.html` is a local page carrying a
fixed JSON-LD `Offer` (`123.45 USD`), the same figure in microdata and in Open Graph meta, served from
the repo-root server at `http://localhost:4886/harness/device-price-control.html`. The probe
confirms the server answers, then loads the page once as each device. All four must read `123.45 USD`
via `json-ld`. If they do not, the probe is broken and it stops before touching any site (exit 4).
This also proves the profiles reach the page with the layout they claim: the control records
`clientWidth` 1440 / 1536 / 393 / 360 and the touch and DPR values.

**Same-device repeat control, per site.** The three loads of the *same* device on a site must read the
same price. If any device disagrees with itself, the site is `inconclusive: price varies within one
device (A/B test, inventory, or time)` and **no device claim is made for it, whatever the cross-device
numbers look like.** This is the check that keeps a drifting price from being reported as a device
difference.

### 1.6 Verdict per site

| verdict | when |
|---|---|
| `same` | every device returned a price on at least two loads, no device disagreed with itself, and all four read the same number (a load that errored or timed out is tolerated and named in the reason) |
| `differs by device` | no device disagreed with itself, and at least two devices read different numbers; any device that returned nothing is named in the reason, not ignored |
| `inconclusive` | a device disagreed with itself (the same-device control); or fewer than two devices returned a price on ≥2 loads; or the devices that answered agreed but at least one device returned no usable price on ≥2 loads — "same" would overstate that, and "differs" would too |
| `no declared price` | no JSON-LD / microdata / meta price and the visible selector (if any) matched nothing, on a page that was not a wall |
| `blocked` | a bot wall, a consent wall that hides the price, a login redirect, or HTTP 401/403/429/503 — the wall's text is recorded verbatim |
| `error` | navigation failed or exceeded the load budget on most loads |

The verdict compares the *string* the extractor produced (`"115" USD`), not a parsed number, so
`115` and `115.00` would count as different. If a site produces that shape the reviewer should say so
in the RUN file rather than let the code paper over it.

A wall is recognised by its text (Akamai "Access Denied … Reference #", PerimeterX "Press & Hold",
Cloudflare "Just a moment… Performing security verification", Adidas's "UNFORTUNATELY WE ARE UNABLE TO
GIVE YOU ACCESS", a queue page's "Hang tight / Sit tight"), by status (401/403/429/503), by a login
redirect, by Booking.com's HTTP 202 + `chal_t=` challenge reload, or by a consent container standing on
an otherwise empty page. The matched phrase and the first 300 characters of the page are recorded.

### 1.7 Bail-outs and politeness

45 s per load. Three consecutive `blocked`/`error` loads abandon the site (recorded as abandoned).
One load in flight at a time, 3–6 s between loads, one run. Read-only GETs: no logins, no forms, no
purchases, no captcha interaction, no attempt to get past any wall. A wall is quoted and the probe moves
on. **No extension is loaded** — puppeteer's default `--disable-extensions` is left in place. This
measures sites, not Nullecho.

### 1.8 Attacking the finding

- The positive control runs first, every run.
- Any site read as `differs by device` is loaded again, all 12 loads, **ten minutes later**. A split that
  does not hold across the gap is reported as not holding.
- For the two phone profiles, every load records `document.documentElement.clientWidth`,
  `window.innerWidth`, `devicePixelRatio`, `navigator.maxTouchPoints`, `(pointer: coarse)`,
  `navigator.userAgentData.mobile`, whether the page has a `<meta name="viewport">`, whether it
  overflowed horizontally, whether a hamburger/mobile-nav element exists, and whether the final host is
  an `m.`/`mobile.` subdomain. A phone profile that received a 1440-px desktop layout would show up
  here; the device claim depends on it.

---

## 2. What would make a result here wrong

- **A price that is not the product's.** JSON-LD on a product page can list recommendations, bundles or
  variants; the extractor takes the first usable candidate in document order. Every candidate is
  recorded so this can be checked; the RUN file notes where the first candidate was not obviously the
  headline item.
- **A site that serves a different *page* to phones** (a mobile template with different markup) can
  declare the same price through a different source, or declare none. A `no declared price` on one
  device and a price on another is reported as `inconclusive`, never as a difference.
- **Automation is visible.** `navigator.webdriver` is `true` in every load and nothing hides it. A site
  that treats automation as a bot walls every profile the same way, which is recorded as `blocked`.
  A site that *quietly* served a different price to suspected automation would be indistinguishable
  from a site that did nothing — so a `same` verdict is not proof the site never varies price.
- **The engine is Chromium under every profile.** The iPhone profile is Chromium wearing Safari's UA
  string, viewport, DPR and touch — the *wire* identity is consistent (no client hints, Safari UA), but
  JavaScript-level feature detection sees Chromium: `navigator.userAgentData` exists (empty), WebKit-only
  APIs are absent, Chromium-only ones are present. A site whose device logic runs in JS on those
  features would classify the iPhone profile as "a Chromium browser with an odd UA". Server-side logic
  would not. This is a real limit of the instrument and the reason the iPhone row is the weakest of the four.
- **One connection, one region, one day.** A residential IP in one US state, in one hour. Geographic,
  ISP-level and day-of-week effects are untested.
- **Twelve loads is a small sample.** It is enough to separate "every device saw X" from "one device
  saw Y three times running"; it is not enough to detect a 5 % A/B bucket.

---

### 2.x A page that lists MANY offers (found by this run's own recheck, 2026-09-22)

Apple's "Buy iPad" page carries one JSON-LD offer per iPad model. The extractor took the FIRST offer, and
the desktop and phone templates list the models in a different order (the desktop order even changed
between the main run and the +10-minute recheck: first offer 599, then 699). Read as a single price that
looked like "desktop 599 / 699, phone 549" — a device difference. Read as the SET of offers per load, the
four devices agree (449 / 549 / 599 / 699 / 749 / 899, with one model occasionally absent from a
desktop load). **Verdict reclassified to `inconclusive: multi-offer page`, and the probe now compares the
sorted set of distinct JSON-LD prices when a page declares more than one.** A single-product page still
compares its single price. Rule for future runs: a `differs by device` on a page whose `allJsonLdPrices`
has more than one distinct value is the extractor's claim, not the site's, until the sets are compared.

## 3. Tried and dropped, and why

Every candidate URL was loaded once as `mac-chrome` before being admitted to the list (the four
visible-selector sites were then loaded once as each device to confirm the selector exists in the
phone templates too). The ones below did not make it. All on 2026-09-22, 13:35–14:05 Pacific, from
the same connection the run used. Wall texts are quoted as the page rendered them.

| candidate | category | what happened | verdict |
|---|---|---|---|
| adidas.com Samba OG product | apparel | Page text: "UNFORTUNATELY WE ARE UNABLE TO GIVE YOU ACCESS TO OUR SITE AT THIS TIME. A security issue was automatically…" with a "Reference Error" id | bot wall |
| levi.com 501 product | apparel | "Access Denied — You don't have permission to access … on this server. Reference #18.…" (Akamai) | bot wall |
| uniqlo.com men's t-shirts | apparel | same Akamai "Access Denied" page | bot wall |
| rei.com Cotopaxi Allpa 35 | travel gear | same Akamai "Access Denied" page | bot wall |
| crateandbarrel.com side tables | home goods | same Akamai "Access Denied" page | bot wall |
| marriott.com JW Marriott LA Live | hotel | same Akamai "Access Denied" page | bot wall |
| hyatt.com Hyatt Regency SF | hotel | HTTP 429 on the first request, empty body | rate-limited on first hit |
| hilton.com Hilton SF Union Square | hotel | `DOMContentLoaded` never fired within 45 s | load budget exceeded |
| booking.com The Jane, dated | hotel | HTTP 202, then a client-side reload appending `chal_t=<timestamp>` and a generic "Booking.com Online Hotel Reservations" page with no hotel content, twice | JavaScript challenge |
| turo.com LA search, dated | car rental | Cloudflare: "Just a moment… Performing security verification. This website uses a security service to protect against malicious bots." | bot wall |
| viator.com WB Studio Tour | experiences | HTTP 403, empty body | blocked |
| klook.com LA things-to-do | experiences | HTTP 403 | blocked |
| patagonia.com Black Hole duffel | travel gear | Queue page: "Hang Tight! Routing to checkout… Sit tight. We've got our hands full at the moment…" | queue / wall |
| homedepot.com /p/305484216 | home goods | "Oops!! Something went wrong. Please refresh page" (their generic error page) | no page |
| bose.com QC Ultra product URL | electronics | redirected to `/home`; the homepage declares several unrelated JSON-LD prices — not a product page | wrong page |
| allbirds.com Tree Runners | apparel | redirected to a collection page; Shopify collection JSON-LD carries no Offer | product URL gone |
| omnihotels.com SF | hotel | 4 JSON-LD blocks (Hotel, breadcrumbs), no price; no from-rate in text | no declared price |
| choicehotels.com Ridgecrest | hotel | client-rendered list; no price in markup or in text within 13 s | no declared price |
| hostelworld.com Green Tortoise + HI SF Downtown property pages | hostel | JSON-LD declares `price: 0, priceCurrency: EUR` — a placeholder — and no from-rate renders on the property page without a dated search (the city list shows "From US$31.67" per hostel but is a ranked list, not one price) | no usable declared price — and the reason zeros now fall through (§1.4) |
| kayak.com hotels SF, dated | hotel | client-rendered list; my city code (`c14290`) resolved to Sammamish, WA; no price element found within 10 s | not verified |
| airbnb.com SF search, dated | lodging | client-rendered list, no price within 9 s; a *listing* page did render (admitted) | list dropped, listing kept |
| google.com/travel/search hotels SF, dated | hotel | client-rendered; no priced element within 16 s | no declared price |
| google.com/travel/flights LAX–JFK | flights | admitted, via the accessible fare label | — |
| kayak.com flights LAX–JFK | flights | rendered fares in text (`$191`, `$166`, `$237`), but the first priced element under the sort is the "best" flight and the list re-sorts; two flight pages were enough | dropped for budget |
| expedia.com flights LAX–JFK | flights | no fare rendered within 22 s ("Unlock instant savings with Member Prices — Sign in") | no declared price |
| priceline.com flights LAX–JFK | flights | 2 JSON-LD blocks, no price; no fare in text within 21 s | no declared price |
| kiwi.com LAX–NYC | flights | consent dialog ("Your privacy, your choice") over a client-rendered list; no price within 10 s; not clicked through | consent wall |
| sixt.com LA landing | car rental | 3 JSON-LD blocks, no price; no rate in text within 20 s | no declared price |
| discovercars.com LA | car rental | "Page not found" | no page |
| economybookings.com LA | car rental | redirected to `/car-rental/all`, a search form | no page |
| kayak.com cars **LAX** airport code | car rental | rendered no priced element within 22 s on two tries; the city-code URL did (admitted, see the sites file for the caveat) | not verified |
| ticketmaster.com Lakers | ticketing | 5 JSON-LD blocks (events), no `price`/`lowPrice`; prices are client-rendered per event | no declared price |
| universalstudioshollywood.com GA tickets | ticketing | redirected to `/oops-sorry` | no page |
| metmuseum.org tickets | ticketing | "Page Not Found" | no page |
| tiqets.com LA attractions | ticketing | redirected to a Japan page under a consent dialog | wrong page |
| wayfair.com loveseat | home goods | 2 JSON-LD blocks, no Offer price within 12 s | no declared price |
| newegg.com Samsung 990 Pro | electronics | 4 JSON-LD blocks, no Offer price within 12 s (price is client-rendered) | no declared price |
| peakdesign.com, tortugabackpacks.com, sony.com, logitech.com, bigbustours.com, gocity.com | retail / ticketing | all declared a JSON-LD price and would have qualified; left out to keep the run inside an hour (duplicates of categories already covered) | cut for budget |

Amazon was excluded by instruction (its bot walls, and it is on a separate list of the owner's). No site
requiring login was tried.

---

## 4. What this does NOT show

Stated here and at the top of every RUN file, because a device difference is easy to over-read.

1. **A device difference is not proof of personal-data pricing.** The visitor was anonymous; no account,
   no cookie, no history. A site can price by device class for reasons that involve no personal data at
   all (a mobile-only promotion, a different fee bundle, a different default variant).
2. **One connection, one day, one region.** Nothing here generalises to another IP, another state,
   another week.
3. **Anonymous visitors only.** Logged-in pricing, loyalty pricing, cart-level pricing and
   checkout-page pricing were not tested and are where personalisation would most plausibly live.
4. **The price *declared in markup* may differ from what a human sees.** JSON-LD and meta prices are
   written for search engines and social cards. They are often correct, sometimes stale, occasionally a
   base variant's price while the visible page shows another. Where the `visible` source fired the
   opposite caution applies: rendered text is what a person sees but is harder to parse exactly.
5. **A/B experiments exist.** A site can bucket visitors at random. The same-device repeat check catches
   a bucket that flips within our 12 loads; it cannot catch a bucket assigned once per connection.
6. **Mobile sites may quote different fees or bundles.** A phone page that declares a lower base price
   may add fees a desktop page folded in, or default to a different pack size. A difference in the
   declared number is not a difference in what would be paid without reading both pages.
7. **`same` is not "never varies".** It is "did not vary, for these devices, in these 12 loads, at this hour".

---

## 5. Reproducing

```
# the repo-root server must be up on :4886 (launch config `nullecho-root`)
node harness/device-price-probe.mjs control                     # positive control + header echo only
node harness/device-price-probe.mjs check <url> [--visible sel]  # what the extractor sees on one page, per device
node harness/device-price-probe.mjs run                         # full run → research/device-pricing/raw/<today>.json
```

Puppeteer is not a dependency of this repo; the probe finds it via `--puppeteer <dir>`,
`$NULLECHO_PUPPETEER_DIR`, or the owner's default checkout. Chrome for Testing comes from
`~/.cache/puppeteer`.
