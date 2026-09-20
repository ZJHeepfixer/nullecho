# GPC lane — read-only review, 2026-09-19

Scope: the Global Privacy Control signal only. `ext/src/gpc.js`, `ext/rules/gpc.json`,
the `gpc` wiring in `ext/src/background.js`, both manifests, and every user-facing
sentence about GPC in `popup/`, `options/`, `site/`, `README.md`,
`docs/STORE-LISTING.md`, `docs/PRIVACY-POLICY.md`.

Nothing under `ext/` was modified. `ext/src/shim.js` was read at `git show HEAD:` only
(another agent holds the working copy). `npm test` from `ext/` passes **328/328** on the
unmodified tree (run at the end of this review, not altered).

**Method.** Everything below marked ✅ was executed, not reasoned. The extension was
copied to a scratch directory and loaded unpacked into **Google Chrome for Testing
147.0.7727.15** (the installed Chrome 153 refuses `--load-extension`; a positive control
with a two-line test extension confirmed the flag is dead there and live in 147) and into
**Firefox 155.0.1** via WebDriver BiDi `webExtension.install`. A local server logged every
inbound request header. Scripts: `…/scratchpad/gpc/` — `server.mjs` (header capture),
`drive.mjs` (Chrome/CDP), `sw.mjs` (talks to the live service worker; `testMatchOutcome`),
`bidi.mjs` / `probe2.mjs` / `ffdel.mjs` (Firefox/BiDi), `attack.mjs` (the detector).

---

## Summary

**The header layer is the strongest part of the lane.** `Sec-GPC: 1` goes out on every
request type that matters — documents, subresources, iframes, `fetch`, XHR, beacons,
prefetch, WebSocket handshakes, and requests issued from inside dedicated workers *and*
service workers. 18 of 18 and 4 of 4, captured, against a clean negative control.
That also settles the open A8 question: **the worker gap does not break the header.**

**The legal footing is better than the copy suggests, in one important respect.** Nullecho
ships GPC on by default, and the obvious worry — that nine states forbid a "default setting"
— resolves in the extension's favour wherever a regulator has actually construed the words.
Colorado's Rule 5.04(B) and its worked example describe a user-installed privacy tool that
sends the signal by default and hold that installing it *is* the affirmative choice.
California imposes no default condition at all. **Maryland is the single jurisdiction where
the design is arguably disqualified**, and that goes to counsel, not to this document.

**Three things are broken, and two of them are the same mistake in different clothes:**
a signal whose two halves are derived from different sources and never reconciled. The
header comes from a DNR ruleset; the JS property comes from a settings key; nothing in the
code makes them agree, and there is no per-navigation cache to hang consistency on. Every
observed contradiction — the mid-session toggle, the unrecoverable desync, the window/worker
split — is a symptom of that one missing abstraction.

**The single worst finding is small and fixable:** a per-site GPC exception does not
suppress the header on the request that loads the page, and the popup says it did.

### Top three

1. **G1 (BLOCKER)** — the per-site exception rule ANDs `requestDomains` with
   `initiatorDomains`, so it misses the entry navigation and every third-party request. The
   bank's server gets `Sec-GPC: 1` while the popup prints "Global Privacy Control was **not**
   sent to this site". Proven twice: Chrome's own `testMatchOutcome`, and a header capture.
   Currently latent only because the feature has no UI (G4).
2. **G2 (BLOCKER)** — standing down `delete`s the property instead of returning `false`
   (a spec MUST), and on Firefox — which implements GPC natively — that deletes the
   *browser's own* property, leaving a Firefox where `'globalPrivacyControl' in
   Navigator.prototype === false`. Replayed against a stock Firefox 155.
3. **G3 (BLOCKER)** — `desc.get.name === "get"` and
   `desc.get.toString() === "get() { return true; }"`, where every native accessor in both
   engines is `"get <attr>"` / `[native code]`. A one-line detector separates Nullecho from
   Firefox-native GPC with no false positives. `gpc.js`'s claim that "no amount of
   `toString` masking can hide it" conflates the signal's *presence* (which must be visible)
   with its *implementation* (which need not be, and which `shim.js` already masks for
   everything else).

### Fastest path to closing the three blockers

4.1 + 4.2 + 4.3 — about four hours, all in `gpc.js`, no new abstractions. 4.10 (thirty
minutes of copy) closes G10. The structural fix behind G6/G7 (4.4) is a further two hours
and worth doing at the same time, because otherwise G6 and G7 will be rediscovered as new
bugs the next time someone touches the toggle.

---

## Counts

| rank | count |
|---|---|
| **BLOCKER** | 3 |
| **SHOULD-FIX** | 7 |
| **NICE** | 5 |

---

## 1. SPEC CONFORMANCE

### The spec, and its status

**Primary source:** W3C *Global Privacy Control (GPC)* — <https://www.w3.org/TR/gpc/> and
the editor's draft <https://w3c.github.io/gpc/>, both fetched **2026-09-19**.
Status: **W3C Working Draft, published 17 September 2026**, by the Privacy Working Group,
"using the Recommendation track". Two days old at the time of this review — worth
re-reading before shipping. `https://privacycg.github.io/gpc-spec/` now redirects to the
W3C copy (verified 2026-09-19); the PrivacyCG draft is no longer a separate document.

Normative text quoted below is from that draft.

### Requirement-by-requirement

| # | Spec requirement (verbatim) | Nullecho | verdict |
|---|---|---|---|
| S1 | "A user agent MUST generate a `Sec-GPC` header field with a field-value that is exactly the numeric character '1' if top-level browsing context's `gpcAtNavigation` is `true`." | DNR rule 5000, `modifyHeaders` / `set` / `"1"` | ✅ **pass** for 13 of Chrome's 15 resource types — see S7 / **G9** |
| S2 | "A user agent MUST NOT generate more than one `Sec-GPC` in a given HTTP request and MUST NOT use a `Sec-GPC` field in an HTTP trailer." | `operation: "set"` replaces rather than appends; DNR cannot write trailers | ✅ **pass** |
| S3 | `interface mixin GlobalPrivacyControl { readonly attribute boolean globalPrivacyControl; }; Navigator includes GlobalPrivacyControl;` | getter on `Navigator.prototype`, `enumerable: true`, `configurable: true`, no setter | ✅ **pass** in shape; ❌ **fail** in identity — see **G3** |
| S4 | `WorkerNavigator includes GlobalPrivacyControl;` | nothing at all in worker scope | ❌ **FAIL** — see **G5** |
| S5 | "The value is `false` if no `Sec-GPC` header field would be sent; otherwise, the value is `true`." | `undefined` when off (the property is `delete`d) | ❌ **FAIL** — see **G2** |
| S6 | "The preference MUST be cached on each top-level navigation to ensure consistency in communication of the person's request…" | not cached; the header flips mid-document | ❌ **FAIL** — see **G6** |
| S7 | (S1, applied to every request) | `resourceTypes` omits `webtransport` and `webbundle` | ❌ **FAIL**, narrow — see **G9** |
| S8 | "…user agent SHOULD inform the user of any inconsistent tabs and provide the option to reload them." | a toast ("Saved. Reload open tabs to apply.") and a popup line ("Reload this page for the change to take effect.") | ⚠️ **partial** — informs, does not identify the tabs or offer the reload |
| S9 | "The value of `globalPrivacyControl` MUST be the top-level browsing context's `gpcAtNavigation`." | derived per-request-domain, not per-top-level-context | ❌ **FAIL**, narrow — see **G8** |
| S10 | "HTTP intermediaries MUST NOT remove a `Sec-GPC` header set to '1'." | the per-site exception rule *removes* the header | ✅ **pass** — Nullecho is the user agent acting on the user's own instruction, not an intermediary |
| S11 | DNT | GPC's only mention of DNT is an acknowledgement ("This specification relies on concepts developed in large part by the Tracking Protection Working Group…"); no normative interaction | ✅ **n/a** — and see **§4 / N5** |

### ✅ The header layer, measured

Chrome for Testing 147 + Nullecho (defaults), probe page on `http://a.test:8731/`.
**18 of 18 requests carried `Sec-GPC: 1`:**

```
Sec-GPC:1  main_frame                 a.test      /
Sec-GPC:1  stylesheet                 a.test      /r/stylesheet.css
Sec-GPC:1  image                      a.test      /r/image.png
Sec-GPC:1  script                     a.test      /r/script.js
Sec-GPC:1  font (preload, crossorigin) a.test     /r/preload-font.woff2
Sec-GPC:1  sub_frame (same-origin)    a.test      /r/iframe.html
Sec-GPC:1  sub_frame (CROSS-origin)   third.test  /r/iframe-xo.html
Sec-GPC:1  fetch()                    a.test      /r/fetch.json
Sec-GPC:1  XMLHttpRequest             a.test      /r/xhr.json
Sec-GPC:1  <link rel=prefetch>        a.test      /r/prefetch.txt   [purpose:prefetch]
Sec-GPC:1  navigator.sendBeacon       a.test      /r/beacon.txt
Sec-GPC:1  worker script source       a.test      /r/worker.js
Sec-GPC:1  fetch() FROM a Worker      a.test      /r/worker-fetch.json
Sec-GPC:1  XHR FROM a Worker          a.test      /r/worker-xhr.json
Sec-GPC:1  fetch from cross-origin iframe third.test /r/iframe-sub-xo.json
Sec-GPC:1  favicon                    a.test      /favicon.ico
Sec-GPC:1  WebSocket handshake        a.test      /r/socket
```

Separately, on `http://127.0.0.1:8731/swpage` (a secure context, so service workers run) —
**4 of 4**, including the service-worker script fetch and a `fetch()` issued *from inside*
the service worker:

```
Sec-GPC:1  main_frame                     /swpage           [dest:document]
Sec-GPC:1  service worker script          /sw.js            [dest:serviceworker]
Sec-GPC:1  fetch() from the SERVICE WORKER /r/sw-fetch.json [dest:empty]
Sec-GPC:1  favicon                        /favicon.ico      [dest:image]
```

Negative control: the same probe in Chrome 147 **without** the extension →
0 of 18 requests carried the header, `navigator.globalPrivacyControl === undefined`.

**This answers the A8 question directly.** The worker gap in
`docs/REVIEW-2026-09-16.md` does **not** break the header — DNR matches at the request
level and worker- and service-worker-initiated requests carry `Sec-GPC: 1`. It *does*
break the JS property in worker scope (**G5**), and that asymmetry is itself a
contradiction: inside a worker the page's own code sees `undefined` while the server sees
`1`.

---

## 2. LEGAL MAP

Every row below rests on a primary source fetched **2026-09-19**. Nothing here is from
memory. Where a source could not be reached it says so rather than guessing.

California gets one row by instruction — Jason's lawyers own it.

### 2.1 States that impose a UOOM-honouring duty (11 verified)

| State | Statute | Reg | Law eff. | **UOOM duty eff.** | Mandatory? | Scope | Operative text |
|---|---|---|---|---|---|---|---|
| **California** | Civ. Code §1798.135(b) | **11 CCR §7025** | CPRA 1/1/2023 | in force | **MANDATORY** | sale / sharing | §7025(b): "A business that sells or shares personal information **shall process any opt-out preference signal** that meets the following requirements as a valid request to opt-out of sale/sharing" — [cppa.ca.gov](https://cppa.ca.gov/regulations/pdf/ccpa_statute_eff_20260101.pdf) |
| **Colorado** | C.R.S. §6-1-1306(1)(a)(IV) | **4 CCR 904-3 Part 5** | 7/1/2023 | **7/1/2024** | **MANDATORY** | targeted ads + sale | Rule 5.08(A): "**Effective July 1, 2024** … A Controller that receives an opt-out request through a Universal Opt-Out Mechanism **shall treat such as a valid request to opt out**" — [CO SOS CCR](https://www.sos.state.co.us/CCR/GenerateRulePdf.do?ruleVersionId=11819&fileName=4+CCR+904-3) |
| **Connecticut** | §42-520(c)(1)(A)(ii) *(was (e))* | — | 7/1/2023 | **1/1/2025**; condition deleted 7/1/2026 → now unconditional | **MANDATORY** | targeted ads + sale | P.A. 25-113 strikes "[Not later than January 1, 2025,]" — [cga.ct.gov](https://www.cga.ct.gov/2025/ACT/PA/PDF/2025PA-00113-R00SB-01295-PA.PDF) |
| **Delaware** | 6 Del. C. §12D-106(e)(1)a.2 | — | 1/1/2025 | **1/1/2026** | **MANDATORY** | targeted ads + sale | "**Not later than January 1, 2026**, allowing a consumer to opt out … through an opt-out preference signal" — [delcode](https://delcode.delaware.gov/title6/c012D/index.html) |
| **Maryland** | Com. Law §14-4607(f)(3)(ii) | — | 10/1/2025 | "on or before October 1, 2025" | ⚠️ **drafted PERMISSIVE**: "A controller **MAY UTILIZE** … (i) link … **OR** (ii) … opt-out preference signal" | targeted ads + sale | [Ch. 454 (HB 567)](https://mgaleg.maryland.gov/2024RS/Chapters_noln/CH_454_hb0567e.pdf) |
| **Minnesota** | §325M.14 Subd. 3 | — | 7/31/2025 | 7/31/2025, no phase-in | **MANDATORY** | targeted ads + sale | "A controller **must allow** a consumer to opt out … through an opt-out preference signal" — [revisor.mn.gov](https://www.revisor.mn.gov/statutes/cite/325M/full) |
| **Montana** | MCA §30-14-2809(3)(b) | — | 10/1/2024 *(date unverified — see 2.5)* | **1/1/2025** | **MANDATORY** | targeted ads + sale | "**by no later than January 1, 2025**, allow a consumer to opt out … through an opt-out preference signal" — [mca.legmt.gov](https://mca.legmt.gov/bills/mca/title_0300/chapter_0140/part_0280/section_0090/0300-0140-0280-0090.html) |
| **Nebraska** | §87-1111(5)–(6) | — | 1/1/2025 *(date unverified — see 2.5)* | same | **MANDATORY**, with verification conditions | targeted ads + sale | "designate an authorized agent using a technology, including … **an Internet browser setting or extension**" — [nebraskalegislature.gov](https://nebraskalegislature.gov/laws/statutes.php?statute=87-1111) |
| **New Hampshire** | RSA 507-H:6, V(a)(1)(B) | — | 1/1/2025 | **1/1/2025** | **MANDATORY** | targeted ads + sale | "**Not later than January 1, 2025**, allowing a consumer to opt-out … through an opt-out preference signal" — [gencourt.state.nh.us](https://www.gencourt.state.nh.us/rsa/html/LII/507-H/507-H-mrg.htm) |
| **New Jersey** | N.J.S.A. 56:8-166.11(b) | N.J.A.C. 13:45L-5.1/5.2 **proposed only** | 1/15/2025 | **~7/15/2025** | **MANDATORY** | sale + targeted ads + **profiling** | "**shall allow consumers to exercise the right to opt out** … through a **user-selected universal opt-out mechanism**" — [P.L.2023 c.266](https://pub.njleg.state.nj.us/Bills/2022/PL23/266_.PDF) |
| **Oregon** | ORS 646A.578(5)(c) | — | 7/1/2024 | **1/1/2026** | **MANDATORY** | targeted ads + sale | OR DOJ: "required to accept opt-out requests through universal opt-out mechanisms **starting on January 1, 2026**. Prior to January 1, 2026, controllers **may, but are not required to**" — [doj.state.or.us](https://www.doj.state.or.us/consumer-protection/for-businesses/privacy-law-faqs-for-businesses/) |
| **Texas** | Bus. & Com. Code §541.055(e)–(f) | — | 7/1/2024 | **1/1/2025** | **MANDATORY**, with verification conditions | sale + targeted ads | HB 4 §7(b): "**Section 541.055(e)** … takes effect **January 1, 2025**" — [capitol.texas.gov](https://capitol.texas.gov/tlodocs/88R/billtext/html/HB00004F.HTM) |

**Note the date split.** Nine of these have a UOOM-compliance date **later** than the law's
own effective date. Oregon's arrived **eight months ago** (1/1/2026) and Delaware's
**nine** (1/1/2026) — both after the last time this repo's GPC copy was written.

### 2.2 Comprehensive laws with NO UOOM duty (7 verified)

Verified by fetching the enacted text and scanning for *universal opt / opt-out preference
signal / browser / global device / global setting / default setting / authorized agent*.
Zero hits on the signal terms is the proof.

| State | Law eff. | Proof |
|---|---|---|
| **Virginia** (CDPA) | 1/1/2023 | [2021 Sp. Sess. I ch. 35](https://lis.virginia.gov/cgi-bin/legp604.exe?212+ful+CHAP0035+pdf) — zero hits |
| **Utah** (UCPA) | 12/31/2023 | [SB 227 enrolled](https://le.utah.gov/~2022/bills/sbillenr/SB0227.pdf) — zero hits |
| **Iowa** | 1/1/2025 | [Iowa Code ch. 715D](https://www.legis.iowa.gov/docs/code/715D.pdf) — zero hits |
| **Tennessee** (TIPA) | **7/1/2025** | [Pub. Ch. 408](https://publications.tnsosfiles.com/acts/113/pub/pc0408.pdf) — zero hits. ⚠️ capitol.tn.gov's pre-amendment `HB1181.pdf` says 2024 and is wrong |
| **Kentucky** | 1/1/2026 | [HB 15 enrolled](https://apps.legislature.ky.gov/recorddocuments/bill/24RS/hb15/bill.pdf) — zero hits |
| **Rhode Island** | 1/1/2026 | [H 7787 Sub A](https://webserver.rilegislature.gov/BillText/BillText24/HouseText24/H7787A.pdf) — zero signal hits |
| **Florida** | 7/1/2024 | [§501.705](http://www.leg.state.fl.us/Statutes/index.cfm?App_mode=Display_Statute&URL=0500-0599/0501/Sections/0501.705.html) grants the opt-out with **no** signal mechanism *(partial — §§501.702 and 501.705 only)* |

### 2.3 Official recognition lists

**Colorado runs the only one, and GPC is the only thing on it.** Rule 5.07(A): the
Department "**shall maintain a public list of Universal Opt-Out Mechanisms** that have been
recognized." Fetched live from <https://coag.gov/opt-out/> on 2026-09-19 — the table has
exactly one row:

| Universal Opt-Out Mechanism | Technical Specification | Additional Information |
|---|---|---|
| Global Privacy Control (GPC) | Privacy CG | Website: Global Privacy Control; GPC Implementation Guide |

Page text, verbatim: *"The GPC was the first UOOM to be recognized… **Currently, GPC is the
only UOOM considered valid by The Department**… **This list represents the valid and
recognized UOOMs that The Department will prioritize for enforcement.**"* Rule 5.07(F)
gives controllers six months to honour any newly added mechanism.

- **California keeps no list.** §7025 has no recognition mechanism. The
  [CA AG CCPA page](https://oag.ca.gov/privacy/ccpa) says GPC "**must be honored by covered
  businesses**" and names Privacy Badger as an example, but maintains no registry. CPPA
  staff have *recommended* rulemaking to "Explicitly Identify GPC as an OOPS"
  ([board materials, 8/6–7/2026](https://cppa.ca.gov/meetings/materials/20260806_07_03.pdf))
  — **not adopted**.
- **New Jersey, Delaware, and the other eight: no list.** Delaware has an
  *authorized-agent* list **power** (6 Del. C. §12D-105(b), "may publish"), unrelated.
  MD §14-4607(g)(2) and MN §325M.14 Subd.3(d) instead give a **safe harbour**: a controller
  that recognises signals approved by other states is in compliance — which is how
  Colorado's recognition of GPC travels.

### 2.4 The default-on question — Nullecho ships GPC ON, and that is fine almost everywhere

**The factual predicate, measured.** `manifest.json` declares
`{"id":"gpc","enabled":true}`; a fresh profile's first page load carried `Sec-GPC: 1` on
18 of 18 requests with zero user interaction, and `settings` was written as
`{…,"gpc":true,…}`. So GPC is on by default, with a global toggle and (notionally) a
per-site one.

Nine states carry a "no default setting" command. Colorado's is the ancestor —
C.R.S. §6-1-1313(2)(c) ([SB 21-190](https://coag.gov/app/uploads/2022/01/SB-21-190-CPA_Final.pdf)):
rules must *"**NOT ADOPT A MECHANISM THAT IS A DEFAULT SETTING, BUT RATHER CLEARLY
REPRESENTS THE CONSUMER'S AFFIRMATIVE, FREELY GIVEN, AND UNAMBIGUOUS CHOICE TO OPT OUT**."*

**And Colorado's implementing rule answers this exact fact pattern, in the tool's favour.**
4 CCR 904-3 **Rule 5.04**, quoted verbatim from the fetched CCR:

> **A.** A Universal Opt-Out Mechanism may not be the default setting **for a tool that
> comes pre-installed with a device**…
>
> **B.** Notwithstanding 4 CCR 904-3, Rule 5.04(A), a Consumer's decision to adopt a tool
> that **does not come pre-installed** … but is **marketed as a tool that will exercise a
> user's rights to opt out** … **shall be considered the Consumer's affirmative, freely
> given, and unambiguous choice**… The marketing for such a tool **may also describe
> functionality other than the exercise of opt out rights** and it need not refer
> specifically to opt-out rights in the State of Colorado.
>
> **B.1. Example:** A browser manufacturer markets its browser as a "privacy friendly"
> browser, prominently highlighting that the browser **sends a Universal Opt-Out Mechanism
> signal by default**. The browser does not come pre-installed … and **must be installed by
> the Consumer**. The Consumer's decision to use this browser **represents the Consumer's
> affirmative, freely given, and unambiguous choice**… **The Consumer need not be given an
> explicit choice about whether to use the Universal Opt-Out Mechanism in this example.**

A user-installed extension marketed as a privacy tool is squarely inside 5.04(B). Note that
5.04(B)'s second sentence is written for exactly Nullecho's shape — a tool that *also* does
other things (blocking, personas) and still qualifies.

**California imposes no default condition at all.** 11 CCR §7025(b), full text:

> (b) … shall process any opt-out preference signal that meets the following requirements…:
> (1) The signal shall be **in a format commonly used and recognized** by businesses…
> (2) The platform, technology, or mechanism that sends the signal **shall make clear to the
> consumer, whether in its configuration or in disclosures to the public, that the use of
> the signal is meant to have the effect of opting the consumer out** of the sale and
> sharing… The configuration or disclosure **does not need to be tailored only to
> California**.

Searching the whole operative CCPA regulations for "default" returns three hits, none of
them about opt-out signals.

**The standard formula** — CT §42-520(c)(1)(A)(ii)(II), DE §12D-106(e)(1)a.2.B,
MN §325M.14 Subd.3(a)(2), MT §30-14-2809(3)(b)(ii), NE §87-1111(6)(b), NH 507-H:6,V(a)(1)(B)(ii),
TX §541.055(f)(2) — is materially identical: the mechanism shall *"**Not make use of a
default setting**, but, rather, require the consumer to make an **affirmative, freely given
and unambiguous choice** to opt out."* Oregon differs only in adjectives ("affirmative,
voluntary and unambiguous").

**Two outliers, pointing opposite ways:**

- 🔴 **MARYLAND is the one real risk.** §14-4607(f)(5): a mechanism "**MAY NOT** … (II)
  **USE A DEFAULT SETTING TO OPT A CONSUMER OUT** OF ANY PROCESSING", plus (f)(4)(V) "must
  **REQUIRE A CONSUMER TO MAKE AN AFFIRMATIVE, UNAMBIGUOUS, AND VOLUNTARY CHOICE IN ORDER
  TO OPT OUT**." This is the only statute that describes and forbids Nullecho's exact
  configuration. Counterweights: Colorado's construction of the same idea; Maryland's own
  other-states safe harbour at §14-4607(g)(2); and the fact that Maryland's UOOM provision
  is itself drafted permissively ("**may utilize**"), so a controller who ignores the signal
  in Maryland may not be violating anything either. **Flag to counsel; do not resolve it
  here.**
- 🟢 **NEW JERSEY forbids the opposite.** §56:8-166.11(b)(2)(b) bars a default setting "that
  opts **IN** a consumer". Proposed N.J.A.C. 13:45L-5.2(6) repeats it. Default-*out* is
  exactly what New Jersey wants.

**Verdict:** **(b) — installing the extension is itself the affirmative choice — in
Colorado (by adopted rule, with a worked example), California (no condition exists), and
New Jersey (the bar runs the other way).** **(c) genuinely unsettled** in the eight
plain-formula states: no regulator guidance, FAQ, or enforcement action was found in any of
them on default-on extensions. The best available argument is that Colorado's statute says
the same words, and the only regulator to construe those words construed them in the tool's
favour. **(a) arguably disqualified in Maryland alone.**

### 2.5 Duties that land on Nullecho itself, not on sites

These are the part of the legal map that produce a finding rather than a copy note.

| Obligation | Source | Nullecho |
|---|---|---|
| Don't retain or reuse data gathered via the mechanism; **specifically, don't fingerprint on it** | **CO Rule 5.05(A)**: "shall not use, disclose, or retain any Personal Data collected … for any purpose other than sending or processing the opt-out preference. **For example, the fact that a particular device sends a Universal Opt-Out Mechanism may not be used as part of a digital fingerprint to later identify that device.**" (and CA §7025(d)) | ✅ **strongly met** — no server, no telemetry, no accounts; `docs/PRIVACY-POLICY.md` documents it and `ext/src/manifest.test.js` enforces it at build time |
| No self-dealing | CO Rule 5.06(E) — must not benefit "the creator … over other Controllers" | ✅ met — no ad business; and `docs/…monetization` records the deliberate decision not to build one |
| Say the signal is meant to opt the user out | CA §7025(b)(2); CO Rule 5.03(A) | ✅ met — `options.html:187-193` |
| **Disclose the mechanism's limitations, e.g. that it "applies only to a single browser or device"** | **CO Rule 5.03(A)(3)(b)**, verbatim | 🔴 **NOT met** — see **G10** |
| The signal must be free / FRAND | **not a validity condition anywhere** — appears only as a discretionary factor for Colorado's *list*, Rule 5.07(D)(4) | n/a |
| Bundling with other features | no state prohibits it; Colorado expressly permits it (Rule 5.04(B)) | ✅ n/a |
| **Residency / geo-gating** | **no state requires it**, and the duty runs the other way: **CO Rule 5.03(C)** — the provider "**is not obligated to authenticate that a user is a Resident of Colorado**"; Minnesota adds that an IP-based estimate is sufficient for the controller | ✅ **Nullecho may send GPC everywhere** — and this is the answer to the §4.8 question |

### 2.6 Added or changed in 2026

- **Connecticut, P.A. 25-113 §9, effective 1 July 2026 — in force today.** Repeals and
  replaces §42-520; the UOOM duty moves from §42-520(e) to **§42-520(c)(1)(A)(ii)** and the
  "Not later than January 1, 2025" condition is struck, making it unconditional. The
  no-default clause carries forward verbatim. ⚠️ cga.ct.gov's browsable chapter 743jj is
  "revised to January 1, 2026" and still shows the **pre-amendment** text.
- **New laws effective 2026: Kentucky (1/1/2026) and Rhode Island (1/1/2026) — both verified,
  and neither imposes a UOOM duty.**
- **Delaware, 85 Del. Laws c. 463, eff. 1/1/2027** — both codified versions compared;
  §12D-106(e)(1)a.2 is substantively unchanged.
- **New Hampshire 2026 ch. 168** adds a child-data provision to paragraph I; RSA 507-H:6 **V**
  (the signal) is untouched.
- **Colorado, Oregon, Montana** — verified untouched in 2025/26 as to the UOOM provisions.
- 🔭 **California AB 566, "Opt Me Out Act", Ch. 465, approved 8 Oct 2025, adding Civ. Code
  §1798.136, OPERATIVE 1 JANUARY 2027** —
  [leginfo](https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=202520260AB566):
  > (a)(1) "**A business shall not develop or maintain a browser that does not include
  > functionality configurable by a consumer that enables the browser to send an opt-out
  > preference signal**" … (e)(1) "**Browser**" means "**an interactive software application
  > that is used by consumers to locate, access, and navigate internet websites**."

  **Two things `DECISIONS.md` D6's watch-item note should be updated to say.** First, the
  duty binds developers of a *browser* as defined — an **extension is very likely not one**,
  so AB 566 probably imposes nothing directly on Nullecho (no authority construing it yet).
  Second, and more to the point of D6's worry that AB 566 "may make this feature redundant":
  **AB 566 requires only that the functionality exist and be configurable — it is silent on
  the signal's default state.** A Chrome that ships an off-by-default GPC toggle in 2027
  satisfies AB 566 and leaves Nullecho's on-by-default signal doing exactly what it does
  today. D6's redundancy risk is smaller than it reads.
- **California enforcement is live and recent.** CPPA board materials
  ([8/6–7/2026](https://cppa.ca.gov/meetings/materials/20260806_07_03.pdf)) timeline:
  "**July 2025 – Feb. 2026 — Continued enforcement actions by CA AG and CalPrivacy involving
  failure to honor GPC (i.e., Healthline, Tractor Supply, PlayOn Sports, Disney).**" The
  Sephora settlement is no longer the only example the copy could cite.

### 2.7 Legal rows that could NOT be verified

Carried forward verbatim so nobody treats a gap as a negative.

1. **Montana's law effective date (10/1/2024).** The *UOOM* date (1/1/2025) is verified from
   the MCA. The Act's own date is not: archive.legmt.gov 404'd on seven path variants,
   laws.leg.mt.gov is a SPA, dojmt.gov is Cloudflare-gated.
2. **Nebraska's operative date (1/1/2025).** §87-1111's text is verified; the legislature's
   site returned HTTP 429 across three backed-off attempts before §87-1101 could be read.
3. **Texas §541.055 currency.** The text above is the enrolled HB 4 — authoritative for what
   was enacted, but the codified section could not be re-read (SPA). Indirect check: the
   2025 privacy bills amend ch. 509 (data brokers), not §541.055. "Unamended" is likely, not
   proven.
4. **Whether New Jersey adopted N.J.A.C. 13:45L.** The proposal (57 N.J.R. 1101(a),
   6/2/2025) is verified; adoption is not. **The NJ statutory duty is in force regardless.**
   The rule text was read from a PDF reproduction of the N.J. Register, not an NJ-hosted
   file.
5. **Delaware DOJ authorized-agent list** — whether one exists is unknown (404).
6. **Colorado's 2023 Statement of Basis and Purpose** — not locatable. Largely moot: Rule
   5.04's Examples are part of the **adopted rule text**, which is stronger authority than a
   SBP.
7. **Florida** — no UOOM verified in §§501.702 and 501.705 only; the rest of Part V was not
   read and the 7/1/2024 date was not sourced.
8. **Indiana** — every route blocked (iga.in.gov returns a SPA shell on six paths;
   api.iga.in.gov 403). **No claim is made.**
9. **Nine states not reached at all: Washington (My Health My Data), Nevada, Oklahoma,
   Vermont, Maine, Michigan, Wisconsin, New York, and Indiana.** **No claim is made about
   any of them** — in particular, do **not** infer from this document that they lack a
   comprehensive privacy law or a UOOM duty. If the copy is rewritten to name a count of
   states, that count must come from a sweep that covers these nine.

**Consequently: the copy's "California, Colorado and several other states" is accurate and
conservative. A specific number ("12 states") is NOT supported by this research** — eleven
are verified and nine states were never checked.

---

## 3. WHAT WE TELL THE USER

Every user-facing sentence about GPC in `ext/popup/`, `ext/options/`, `site/`, `README.md`,
`docs/STORE-LISTING.md` and `docs/PRIVACY-POLICY.md`, quoted verbatim and rated against §2.

| # | where | verbatim | rating |
|---|---|---|---|
| C1 | `ext/options/options.html:183` | "Send Global Privacy Control" | ✅ accurate |
| C2 | `ext/options/options.html:187-193` | "Adds a `Sec-GPC: 1` header and sets `navigator.globalPrivacyControl`. In California, Colorado and several other states this is a legally binding do-not-sell request — the Sephora settlement was partly about ignoring it. Coverage is real but partial: a 2025 study found only about a third of sites that appear to sell or share data implement any opt-out signal, and only 44% of those honoured all of them." | ✅ **every factual claim verified** (§2.1: 11 states; §3 for the two citations) — ⚠️ residency framing, and missing the Rule 5.03(A)(3) scope line (**G10**) |
| C3 | `ext/src/linkage.js:368` | "Global Privacy Control was sent to this site" | ⚠️ **can be false** — see G1 |
| C4 | `ext/src/linkage.js:369` | "Global Privacy Control was **not** sent to this site" | 🔴 **can be false** — see G1 |
| C5 | `ext/src/linkage.js:371` | "In California, Colorado and several other states this is a legally binding do-not-sell request. Whether the site acted on it happens on their servers — Nullecho can show the signal went out, never that anyone honoured it." | ✅ the second sentence is the best copy in the file |
| C6 | `ext/src/linkage.js:373` | "You turned the signal off for this site, or it ships off here because the site breaks when it sees it." | 🔴 **can be false** — see G1 |
| C7 | `ext/src/linkage.js:374` | "The signal is switched off, so this site was never asked not to sell or share your data." | ✅ accurate |
| C8 | `ext/src/linkage.js:740` | "Send Global Privacy Control — it is legally enforceable in some states." | ✅ accurate and correctly hedged |
| C9 | `ext/src/linkage.js:791` | "Turn on Global Privacy Control. In California, Colorado and several other states it is a legally binding do-not-sell request." | ✅ accurate — ⚠️ residency framing |
| C10 | `ext/src/linkage.js:797` | "The signal only covers data collected from now on. File a California DROP request to delete what brokers already hold." | ✅ accurate — and currently unreachable (`isCalifornian` is never set; see 4.8) |
| C11 | `ext/src/linkage.js:513` (share card) | "Global Privacy Control was sent. Whether the site acted on it is not observable from a browser." | ✅ exemplary |
| C12 | `ext/options/drop.html:106-111` | "GPC is a signal Nullecho sends with every request that legally means 'do not sell or share my data' in states that recognise it. It is not a deletion — it is a stop-selling instruction — and enforcement is real but partial… Worth having on. Not worth over-trusting." | ✅ the best long-form GPC copy in the project |
| C13 | `README.md:30` | "**Global Privacy Control** — legally enforceable in California and several other states." | ✅ accurate and conservative (11 verified) — ⚠️ residency framing |
| C14 | `docs/STORE-LISTING.md:32-33` | "It sends Global Privacy Control, the do-not-sell/share signal that's legally enforceable in California and several other states." | ✅ accurate — ⚠️ residency framing |
| C15 | `docs/STORE-LISTING.md:16` | "Blocks trackers, sends Global Privacy Control, and shows each site a different device profile so they can't link you." | ✅ accurate for GPC |
| C16 | `docs/PRIVACY-POLICY.md:12` | "sends the legally-recognized Global Privacy Control signal" | ✅ accurate |
| C17 | `site/drop/index.html:276` | "**Turn on Global Privacy Control.** A browser signal that legally counts as an opt-out in California and several other states. Free, takes seconds, and it's been enforced — a company was fined for ignoring it." | ✅ accurate |
| C18 | `site/blog-…:57` | "Sends Global Privacy Control, which is legally enforceable in California and several other states." | ✅ accurate — ⚠️ residency framing |

### The three things the copy gets wrong

**1. C4 and C6 are statements that a packet capture disproves (G1).** This is the only place
in the GPC copy where Nullecho asserts a fact about its own behaviour that is false. It is
currently unreachable because the per-site exception has no UI (G4), but C4/C6 also fire for
the ~50 shipped-exclusion hosts, where they *are* true. Fix G1 before wiring G4, or C4/C6
start lying the day the toggle ships.

**2. "legally enforceable / legally binding" without a subject.** C2, C9, C13, C14 and C18
all say the signal is legally binding *in* a list of states, which reads as a property of
the site. It is a property of **the consumer's residency**, not the site's location — see
§2.1, where every statute scopes its duty to that state's consumers. A California resident's
GPC signal creates a duty for a covered business wherever that business sits; a Wyoming
resident's identical signal creates none, on the same site, in the same second. The copy is
not false, but it is the kind of true-sounding sentence a user reads as "this works where I
am".

Suggested rewrite, same length: *"Global Privacy Control — a legal opt-out if you live in
one of the states that recognise it."*

Two guard-rails if this copy is ever rewritten. **(a) Do not put a number on it.** Eleven
states are verified here and **nine were never checked** (§2.7) — "12 states", a figure that
circulates in vendor marketing, is not supported by this research. "California, Colorado and
several other states" is the right register and should survive. **(b) Do not add
geolocation to make it precise.** §2.5: no state requires the signal to be geo-gated, and
Colorado Rule 5.03(C) says the provider "is not obligated to authenticate that a user is a
Resident of Colorado". Sending GPC everywhere is correct; see §4.8 for the honest way to
personalise the sentence without measuring anything.

**2b. The copy says "sell or share" and never "targeted advertising".** Nine of the eleven
states in §2.1 scope the UOOM duty to **targeted advertising *and* sale**; New Jersey adds
**profiling**. California is the outlier whose scope really is sale/sharing — and
California's framing is the one the whole project inherited. This under-sells the signal
everywhere outside California, and it interacts with **G10**.

**3. "with every request" (C12).** ✅ Measured as true in Chrome for 13 of 15 resource types
(G9). `webtransport` and `webbundle` are the exceptions. Either fix the rule or drop the
absolute.

### The two things the copy gets right, and should not be edited

**The Sephora claim is exact.** ✅ California Attorney General, press release of
**24 August 2022** (<https://oag.ca.gov/news/press-releases/attorney-general-bonta-announces-settlement-sephora-part-ongoing-enforcement>,
fetched 2026-09-19): the $1.2 million settlement was for, among other things, having
*"failed to process user requests to opt out of sale via user-enabled global privacy
controls in violation of the CCPA"*. "Partly about ignoring it" is precisely right, and the
AG's own phrase — **"user-enabled"** — is the one §2 turns on.

**The USENIX figures are exact.** ✅ Hausladen, Wang, Eng, Wang, Wijaya, May & Zimmeck,
*"Websites' Global Privacy Control Compliance at Scale and over Time"*, USENIX Security '25,
13–15 August 2025 (<https://www.usenix.org/system/files/usenixsecurity25-hausladen.pdf>,
fetched 2026-09-19). Abstract, verbatim:

> "Using longitudinal data collected by crawling a set of 11,708 sites… We find that about a
> third of sites that have evidence of selling or sharing personal information per the CCPA
> implement at least one of the four privacy strings. In December 2023, 44% (1,411/3,226) of
> such sites opted users out via all implemented privacy strings. In February 2024, this
> percentage decreased to 43% (1,473/3,402) before increasing to 45% (1,620/3,566) in April
> 2024."

The extension's "about a third… and only 44% of those honoured all of them" tracks the
abstract almost word for word, and picks the *lowest* of the three figures. One nit: the
paper's most recent number is 45% (April 2024), and the study measures **California** opt
outs specifically. Worth saying "44–45%" and "California opt outs" if the sentence is ever
touched; it is not worth touching otherwise.

**One thing the copy could strengthen without weakening.** C2 and `DECISIONS.md` D6 both
reach for Sephora (2022) as the enforcement example. It is still correct, but it is four
years old and now reads as the *only* example. CPPA board materials of 6–7 August 2026
(<https://cppa.ca.gov/meetings/materials/20260806_07_03.pdf>, fetched 2026-09-19) record:
"**July 2025 – Feb. 2026 — Continued enforcement actions by CA AG and CalPrivacy involving
failure to honor GPC (i.e., Healthline, Tractor Supply, PlayOn Sports, Disney).**" "Still
being enforced this year" is a stronger and more honest sentence than "a company was fined
in 2022".

`docs/THREAT-MODEL.md`'s banned-phrase list is not breached anywhere in the GPC copy.

---

## 4. 'AND THEN SOME' — concrete improvements

Ordered by value per hour. Each has an effort estimate and the reason.

### 4.1 Fix the exception rule (G1) — **~1 hour, do it first**

Two rules per excepted host instead of one, and correct the comment in `gpc.test.js` that
caused the bug. The current shape is the single place where Nullecho tells a user something
that a packet capture disproves. Everything else in this list is optional; this is not.

### 4.2 Give the getter a native shape (G3) — **~1 hour**

Name it `globalPrivacyControl`, run it through the `toString` masking `shim.js` already
owns, and add a case to `native-shape.test.js`. This is not an attempt to hide GPC — GPC
must be visible — it is the difference between disclosing *that the signal is on* (the
feature, ~1 bit) and disclosing *which software is sending it* (not the feature, and a
stable cross-site bit that undoes some of what the persona lane buys).

### 4.3 Return `false` instead of deleting (G2) — **~2 hours**

Capture the native descriptor before overwriting; restore it on stand-down; otherwise
define a getter returning `false`. Fixes a spec MUST, removes the Firefox
"browser with no `globalPrivacyControl`" state, and costs nothing.

### 4.4 Reconcile the two sources of truth (G7) — **~2 hours**

`NullechoGPC.init()` should call `setEnabled(settings.gpc)` unconditionally, and
`GET_PERSONA` should report `await NullechoGPC.isEnabled()` rather than `settings.gpc`.
Stop swallowing the `setEnabled` rejection, or at least surface it the way
`loudFailures` surfaces shim failures.

### 4.5 Wire the per-site exception into the popup (G4) — **~4 hours**

One row in the popup: "This site breaks with GPC → turn the signal off here." It is the
documented recovery path, it is implemented and tested, and today it does not exist for
users. Pair it with 4.1 or it will ship broken.

### 4.6 `WorkerNavigator.globalPrivacyControl` (G5) — **~1 day, partial by nature**

Wrapping `Worker`/`SharedWorker` to prepend a four-line `defineProperty` covers same-origin
and `blob:` classic workers. Module workers, cross-origin worker sources, and service
workers stay uncovered, and the wrapper is itself detectable. For the GPC lane specifically
the payoff is better than for the general persona problem — it is one boolean with a
normative MUST behind it, not a whole device profile — but it should be scoped honestly in
`THREAT-MODEL.md` rather than claimed as complete.

### 4.7 `.well-known/gpc.json` in the popup — **RECOMMEND AGAINST**

**~1 day to build, and the evidence says don't.**

The spec does define it:

> "A GPC support resource has the well-known identifier `/.well-known/gpc.json` relative to
> the origin server's URL."
> "The origin server MUST return the GPC support resource as a valid representation using
> the `application/json` media type, otherwise the origin's support is unknown."
> "The value of the `gpc` member MUST be either `true`, to indicate that the server intends
> to abide by GPC requests at least to the extent it is legally obligated to do so, or
> `false`…"
> `lastUpdate` "MUST be an RFC3339 `full-date` (YYYY-MM-DD) or `date-time`…"

Answers to the specific sub-questions asked: it is **not required to be same-origin** — the
spec explicitly permits "a sequence of redirects that leads to such a representation (which
MAY be provided by a server at another origin)", which means a naive implementation can be
redirected off-origin and leak the browsing event to a third party. And the spec states
**no caching requirements** for the resource, so any cache policy would be Nullecho's own
invention.

Against building it:

1. **It is a self-declaration, not a measurement.** The spec's own wording is that the
   server "intends to abide". Surfacing "this site says it honors GPC" in a popup that
   otherwise carefully distinguishes *presence* from *behaviour*
   (`popup.html`: "Nullecho sees that these companies were **present** on this page") would
   import an unverified claim into the one surface that has earned its credibility by
   refusing to make them.
2. **Almost nobody publishes it.** Hausladen et al., USENIX Security 2025 (see §3), crawled
   11,708 sites and report: *"fewer than 200 sites made use of this option in each crawl"* —
   Table 3 totals 181 (Jan 2024), 182 (Feb 2024), 193 (April 2024). That is ~1.6%. The
   paper also finds *"not much overlap of sites with a `.well-known/gpc.json` and other
   privacy strings"*, i.e. publishing the file does not predict actually honouring the
   signal.
3. **It costs a request per origin, on an extension whose entire pitch is that it makes no
   requests it does not have to.** `ext/PERMISSIONS.md:164` currently boasts "exactly two
   `fetch` calls exist", and that is not a slogan — `ext/src/manifest.test.js:128-143`
   ("every fetch() reads a bundled extension file, never a remote URL") **fails the build**
   if any `fetch()` argument does not match `/^chrome\.runtime\.getURL\(/`. Building 4.7
   means deleting a build-enforced invariant that is currently one of the extension's
   strongest verifiable privacy claims. That is a large price for a 1.6%-coverage
   self-declaration, and the off-origin redirect behaviour above makes it a change in the
   wrong direction.

If it is built anyway: same-origin only (refuse cross-origin redirects), a hard cache with
a long TTL keyed by origin, never on first paint, and label it verbatim as "this site
*claims* to honor GPC" with a link to the paper's finding.

### 4.8 A per-state "legally required to honor this" line — **RECOMMEND AGAINST as phrased; a rewritten version is fine**

The blocker is not geolocation; it is **which** geolocation. Every state law in §2.1
attaches the duty to the **consumer's residency**, not the site's location or its state of
incorporation. Nullecho has no location by design and should keep it that way — and §2.5
confirms it does not need one: **no state requires the signal to be geo-gated**, and
Colorado Rule 5.03(C) says the provider "**is not obligated to authenticate that a user is a
Resident of Colorado**". So sending GPC everywhere is correct. What Nullecho cannot do is
tell a user whether *they* are covered, which is the only fact that would make "this site is
legally required to honor your opt-out" true.

The second, larger problem with the per-site framing: coverage thresholds are facts about
the **business** — revenue, number of consumers processed, share of revenue from sale — and
no extension can determine any of them. "This site is required to…" would be a claim about
a company Nullecho knows nothing about.

There is a ready-made pattern in the codebase for solving this the honest way: `settings`
already carries an `isCalifornian` flag that the DROP copy branches on
(`linkage.js:742, 795, 807`). Note in passing — out of this lane, but found while tracing
it — **nothing ever sets `isCalifornian`**: a live read of `chrome.storage.local` on a
running instance returns
`{"categories":{…},"gpc":true,"autoRotateDays":0,"loudFailures":true}` with no such key,
and no UI writes one. Every `isCalifornian` branch in `linkage.js` is currently dead.

The honest version, if wanted: a user-declared "I live in ___" picker (never inferred,
never sent anywhere), and copy of the form *"You told us you live in Colorado. Colorado law
requires businesses covered by the CPA to honor this signal for targeted advertising and
sale — whether this site is covered, and whether it complied, is not something a browser can
see."* That is defensible, it fixes the residency framing in §3, and it is the natural place
to also satisfy **G10**'s scope disclosure. The dataset for it is §2.1 — eleven verified
states, with the nine unchecked ones in §2.7 that would need sweeping first. The per-site
"this site is required to…" framing is not defensible and should not be built.

### 4.9 Send the legacy `DNT: 1` header alongside — **RECOMMEND AGAINST**

✅ Verified: Nullecho sends no `DNT` header today — every captured request across every run
in this review logged `dnt: -`, in Chrome and in Firefox, with GPC on and off.

Keep it that way.

- The W3C GPC draft's only reference to DNT is an acknowledgement of prior art. There is no
  normative interaction to implement.
- MDN, <https://developer.mozilla.org/en-US/docs/Web/API/Navigator/doNotTrack> (fetched
  2026-09-19), is unambiguous: *"The whole DNT (Do Not Track) specification has been
  discontinued."* And, on the exact trade-off Nullecho cares about: *"Moreover, it is
  harmful as it leaves more user fingerprint in the header, which can be used to track
  users even more."*
- The one thing worth checking before dismissing it entirely — whether any state statute
  names DNT rather than a generic opt-out preference signal — is covered in §2.

### 4.10 Add the two disclosure sentences Colorado asks for (G10) — **~30 minutes, best ratio in this list**

One line saying the opt-out covers this browser profile only, and one widening
"do-not-sell" to the purposes the signal actually exercises. Colorado Rule 5.03(A)(4)(a)
blesses a state-agnostic phrasing — a disclosure that the mechanism exercises "any and all
opt-out rights available to you under state laws" satisfies the rule without naming a
state, which also sidesteps the count problem in §3. Thirty minutes of copy closes a
regulatory obligation that lands on Nullecho itself rather than on the sites it signals.

### 4.11 Things the spec recommends that we do not do

- **S8's reload affordance.** SHOULD, partially met (a toast). Cheap to finish.
- **S6's per-navigation cache.** MUST, unmet. This is the structural one: Nullecho has no
  concept of a navigation-scoped GPC value at all, which is also why G6 and G7 look like
  two bugs when they are one missing abstraction.

---

---

## 5. ATTACK — distinguishing Nullecho's GPC from a native one

`…/scratchpad/gpc/attack.mjs`. Five checks, all synchronous property reads, no network, no
timing, no heuristics. It was run in five configurations.

```js
const d = Object.getOwnPropertyDescriptor(Navigator.prototype, 'globalPrivacyControl');

// A1 — a WebIDL accessor is named "get <attr>"; an object-literal getter is named "get".
A1 = d && d.get && d.get.name === 'get';

// A2 — a native getter stringifies to "[native code]".
A2 = d && d.get && Function.prototype.toString.call(d.get).indexOf('[native code]') === -1;

// A3 — a property appended at document_start is the LAST own key of Navigator.prototype;
//      a WebIDL member sits in declaration order.
const keys = Object.getOwnPropertyNames(Navigator.prototype);
A3 = keys.indexOf('globalPrivacyControl') === keys.length - 1;

// A4 — window and worker disagree. One preference cannot do that.
//      (asynchronous; a blob: Worker that postMessages navigator.globalPrivacyControl)

// A5 — the value's type. Spec says boolean.
A5 = typeof navigator.globalPrivacyControl;
```

### ✅ Measured results

| configuration | A1 name | A2 source | A3 last key | A5 type | window / worker | verdict |
|---|---|---|---|---|---|---|
| Chrome 147, no extension | `<no descriptor>` | — | no (−1 of 36) | `undefined` | — / — | no GPC |
| **Chrome 147 + Nullecho** | **`"get"` 🔴** | **`"get() { return true; }"` 🔴** | **yes (36 of 37) 🔴** | `boolean` | `true` / `undefined` 🔴 | **SHIMMED** |
| Firefox 155, pref default (off) | `"get globalPrivacyControl"` | `[native code]` | no (31 of 48) | `boolean` | `false` / `false` | native |
| Firefox 155, pref on | `"get globalPrivacyControl"` | `[native code]` | no (31 of 48) | `boolean` | `true` / `true` | native |
| **Firefox 155 + Nullecho** | **`"get"` 🔴** | **`"get() { return true; }"` 🔴** | no (31 of 48) | `boolean` | **`true` / `false` 🔴** | **SHIMMED** |

✅ **The A1/A2 baseline is not Firefox-specific.** Every native `Navigator` accessor in
Chrome for Testing 147 follows the same WebIDL convention:

```
hardwareConcurrency  "get hardwareConcurrency"  function get hardwareConcurrency() { [native code] }  enum:true conf:true
language             "get language"             function get language() { [native code] }             enum:true conf:true
onLine               "get onLine"               function get onLine() { [native code] }               enum:true conf:true
webdriver            "get webdriver"            function get webdriver() { [native code] }            enum:true conf:true
```

Nullecho's is `"get"` / `get() { return true; }`. It is the only accessor on
`Navigator.prototype` that does not look like the others — which is also what makes A1 and
A2 zero-cost for an adversary: no list of expected values, just "does this one match its
neighbours".

Three true positives against three native configurations, zero false positives, zero false
negatives, from a single property read. A3 does not fire on Firefox because `defineProperty`
over an existing key keeps its slot — A1 and A2 do.

The strongest single check on Firefox is A4: **`navigator.globalPrivacyControl === true` in
the window and `false` in a `Worker`.** Both values come from the same preference natively,
so no stock Firefox can produce that pair. Nullecho produces it because it patches the
window and not `WorkerNavigator` (**G5**). Its counterpart on Chrome is A3 plus the fact
that Chrome ships no native GPC at all, so any `globalPrivacyControl` there is an extension.

And one more state, from **G2**: on Firefox, a user who excepts a site is left with
`'globalPrivacyControl' in Navigator.prototype === false` — a Firefox where the property
does not exist. That is rarer than "GPC is on", and rarer is worse.

### What this does and does not prove

It proves the property is **shimmed rather than native**. It does **not** prove the shim is
Nullecho: I could not test DuckDuckGo Privacy Essentials or Privacy Badger, so I cannot say
whether they produce the same descriptor shape and would be lumped in. Either way the
honest reading is that the shape leak adds entropy beyond the one bit `gpc.js:41-46`
budgets for, and that the comment claiming it cannot be hidden is wrong — 4.2 hides it for
about an hour of work.

`THREAT-MODEL.md`'s banned-phrase list is not violated by anything in the GPC copy; the
popup footer already says "**sites can tell it is installed**". The gap is between that
honest headline and `gpc.js`'s internal claim that the *shape* is unfixable.

---

# FINDINGS

## BLOCKER

### G1 — A per-site GPC exception does not suppress the header on the top-level navigation, and the UI says it did

`ext/src/gpc.js` `syncExceptionRules()` builds the exception rule with **both**
`requestDomains` and `initiatorDomains` in one condition. DNR ANDs condition fields, so
the rule only matches a request that is *to* the host **and** *from* the host. A
top-level navigation typed, bookmarked, opened in a new tab, or followed from any other
site does not have that host as its initiator, so it never matches.

Precise scope: the exception catches a *same-site* link navigation (initiator = the
excepted host) and every same-origin subresource. It misses the **entry** navigation — the
one that actually loads the page the user complained about — and every third-party request
the page makes.

`ext/src/gpc.test.js:110-118` asserts exactly this shape, under a comment that states the
opposite of the platform's behaviour:

> `// main_frame navigation matches on requestDomains; subresources on the page`
> `// match on initiatorDomains. Missing either leaks the header.`

They are ANDed, not ORed. The test passes and the behaviour is wrong.

✅ **Chrome's own matcher, asked directly** (`chrome.declarativeNetRequest.testMatchOutcome`
from the live service worker, after `NullechoGPC.setSiteException('a.test', true)` —
rule `1100000` is the exception, `5000` is the Sec-GPC rule):

```
top-level nav to a.test (NO initiator)   -> matched [5200(ua-mac), 5000(gpc)]      ← exception MISSED
top-level nav to a.test (initiator a.test) -> matched [1100000, 5200, 5000]
a.test subresource -> a.test             -> matched [1100000, 5200, 5000]
a.test subresource -> third.test (3P)    -> matched [5200, 5000]                   ← exception MISSED
b.test page -> a.test subresource        -> matched [5200, 5000]                   ← exception MISSED
```

✅ **And the real captured headers**, same run, exception active for `a.test`:

```
Sec-GPC:1  main_frame                 a.test:8731    /            ← the document request
ABSENT     stylesheet                 a.test:8731    /r/stylesheet.css
ABSENT     script                     a.test:8731    /r/script.js
ABSENT     sub_frame(same-origin)     a.test:8731    /r/iframe.html
ABSENT     fetch/XHR/beacon/ws/…      a.test:8731    (all suppressed)
Sec-GPC:1  sub_frame(CROSS-origin)    third.test     /r/iframe-xo.html
Sec-GPC:1  fetch from that iframe     third.test     /r/iframe-sub-xo.json
```

Meanwhile `ext/src/linkage.js:372` prints, for that exact state:

> "You turned the signal off for this site, or it ships off here because the site breaks
> when it sees it."

under the headline "Global Privacy Control was **not** sent to this site"
(`linkage.js:369`). The bank's server received `Sec-GPC: 1` on the page request. The UI
statement is false and the falsity is provable from a header capture.

Contrast the **shipped** breakage list, which is correct because `excludedRequestDomains`
and `excludedInitiatorDomains` are exclusion lists and therefore ORed. ✅ Measured on a
shipped-exclusion host (`usaa.com` mapped to the local server): **17 of 18 requests had no
header**, including the top-level navigation. So the two exception mechanisms in the same
file behave differently, and only the user-facing one is broken.

**Currently latent, and that is the only reason it is not already shipping harm:** nothing
in `popup/` or `options/` ever sends `nullecho:gpc:setSiteException`
(`grep -rn "gpc:setSiteException" ext/` → one hit, the handler in `background.js:532`).
See **G4**. The bug becomes user-visible the moment the UI is wired up.

**Fix:** emit two rules per excepted host — one with `requestDomains` only, one with
`initiatorDomains` only — or, better, key the exception off the top-level context the
spec actually names (S9). And fix the comment in `gpc.test.js`, which is the reason the
bug survived review.

---

### G2 — When GPC is off the property is `undefined`, not `false`; on Firefox that deletes the browser's own native property

Spec, verbatim: **"The value is `false` if no `Sec-GPC` header field would be sent;
otherwise, the value is `true`."** `globalPrivacyControl` is typed `readonly attribute
boolean`. `undefined` is not a conformant value.

`gpc.js` `setSignal(false)` does `delete RawNavigator.prototype.globalPrivacyControl`.

✅ Chrome 147 + Nullecho, site excepted:
`{"windowProp":"<<undefined>>","windowPropType":"undefined","desc":null,"inNavigatorProto":false}`

On Chrome that is merely non-conformant — Chrome ships no native GPC, so `undefined` is
what an uninstalled browser shows anyway.

**On Firefox it is worse.** Firefox implements GPC natively and always exposes the
property. ✅ Firefox 155.0.1, three configurations, read over WebDriver BiDi:

| config | `navigator.globalPrivacyControl` | getter name | getter source | position on `Navigator.prototype` | worker scope |
|---|---|---|---|---|---|
| stock, pref default | `false` | `get globalPrivacyControl` | `function globalPrivacyControl() { [native code] }` | 31 of 48 | `false` (boolean) |
| stock, `privacy.globalprivacycontrol.enabled=true` | `true` | `get globalPrivacyControl` | `[native code]` | 31 of 48 | `true` (boolean) |
| **+ Nullecho** | `true` | **`get`** | **`get() { return true; }`** | 31 of 48 | **`false`** (native, untouched) |

So Nullecho **overwrites Firefox's native getter** (the `navigator.globalPrivacyControl
=== true` early-out in `setSignal` does not fire, because the native value is `false`).

✅ And replaying `gpc.js`'s own two operations against the native property in a plain
Firefox 155:

```
before  {v:"false",     t:"boolean",   name:"get globalPrivacyControl"}
during  {v:"true",      t:"boolean",   name:"get"}                       ← setSignal(true)
after   {v:"undefined", t:"undefined", hasDescriptor:false, inProto:false} ← setSignal(false)
```

`'globalPrivacyControl' in Navigator.prototype === false`. A per-site GPC exception on
Firefox therefore leaves the user with a **Firefox that has no `globalPrivacyControl` at
all** — a state no stock Firefox can produce, and a stronger identifier than the one the
exception was meant to avoid.

**Fix:** never `delete`. Define a getter returning `false`, and on a browser that owned the
property natively, restore the captured native descriptor instead of removing it. Capture
`Object.getOwnPropertyDescriptor(Navigator.prototype,'globalPrivacyControl')` before
overwriting; if one existed, put it back.

---

### G3 — Nullecho's `globalPrivacyControl` is distinguishable from a native one in a single property read

See **§5 ATTACK** for the page and the measured verdicts. Summary of the tells:

- `Object.getOwnPropertyDescriptor(Navigator.prototype,'globalPrivacyControl').get.name`
  is **`"get"`**. A WebIDL accessor is named `"get globalPrivacyControl"` (measured in
  Firefox 155). The name comes from the object-literal method shorthand in
  `gpc.js:199` — `{ get() { return true; }, … }`.
- `Function.prototype.toString.call(desc.get)` returns **`"get() { return true; }"`**
  instead of `"function globalPrivacyControl() { [native code] }"`.
- On Chrome the property is the **last** own key of `Navigator.prototype` (index 36 of 37),
  because it was appended at `document_start`. A WebIDL member sits in declaration order.
- On Firefox: `window` says `true` while a `Worker` says `false`. Both come from one pref
  natively; they cannot disagree.

`gpc.js:41-46` argues this away:

> "That costs roughly a bit of entropy, and **no amount of `toString` masking can hide it**
> — the entire point of GPC is to be *seen*."

The first half is right and the second half is wrong, and the distinction matters. GPC's
*presence* must be visible — that is the feature. GPC's *implementation* need not be. The
shim lane already holds itself to exactly this standard: commit `8b86562` ("D32: every
installed function has a native's shape — no own prototype, not a constructor") and
`ext/src/native-shape.test.js` exist for precisely this, and `gpc.js` is outside their
reach because it installs its getter itself. By the repo's own review taxonomy this is a
category-(b) contradiction — a signal that identifies *Nullecho users* rather than
*GPC users*.

**Honest limit:** the detector proves "a shim, not native". I could not verify whether
another GPC extension (DuckDuckGo, Privacy Badger) produces the *same* shape, so I cannot
claim it uniquely names Nullecho. It does reliably separate Nullecho from
**Firefox-native GPC**, which is the comparison the brief asked for.

**Fix, cheap:** name the getter `globalPrivacyControl` and route it through the same
`toString` masking `shim.js` already applies; extend `native-shape.test.js` to cover it.
That reduces the leak back to the one bit the design intends.

---

## SHOULD-FIX

### G4 — The per-site GPC exception has no user interface at all

`NullechoGPC.setSiteException` is implemented, persisted (`nullecho:gpc:v1`), rule-synced,
documented in `gpc.js:472-476` as "the recovery path for a site that misbehaves with GPC —
'enable cookies' errors, blank pages, refused sign-in — and is strictly better than
switching GPC off globally", and covered by eight tests in `gpc.test.js`.

```
$ grep -rn "gpc:setSiteException\|gpc:setEnabled" ext/ --exclude-dir=node_modules
ext/src/background.js:529:    case 'nullecho:gpc:setEnabled':
ext/src/background.js:532:    case 'nullecho:gpc:setSiteException':
```

Two hits: the handlers. No caller. Nothing in `popup/` or `options/` sends either message.
A user who hits GPC breakage on a site outside the shipped 50 has exactly one lever: turn
GPC off **globally**, which is the outcome the feature exists to avoid. This is also the
only reason **G1** is not already causing harm.

`ext/rules/README.md` and `ext/PERMISSIONS.md` both describe per-site GPC exceptions as a
working feature.

---

### G5 — `WorkerNavigator.globalPrivacyControl` is missing (documented gap A8/G1 — here is what it costs the GPC lane specifically)

Spec, verbatim and normative: **`WorkerNavigator includes GlobalPrivacyControl;`**

✅ Chrome 147 + Nullecho, GPC on, header confirmed going out on every request:

```
classic same-origin Worker : {gpc: undefined, typeof: "undefined", 'globalPrivacyControl' in WorkerNavigator.prototype: false}
blob: Worker               : {gpc: undefined, typeof: "undefined", inProto: false}
ServiceWorker              : {gpc: undefined, typeof: "undefined", inProto: false, fetched: true}
```

✅ Firefox 155 stock, no extension: worker reports `{v:"false", t:"boolean", inProto:true}`
— Firefox implements the worker half.

So: the header is complete in worker scope, the JS property is absent, and on Firefox
Nullecho's window-only patch turns a consistent native pair into a contradictory one
(window `true`, worker `false`). For the GPC lane the fix is much smaller than the general
worker-shim problem the review is worried about: this is one boolean, not a persona. A
`Worker`/`SharedWorker` constructor wrapper that prepends four lines
(`Object.defineProperty(WorkerNavigator.prototype,'globalPrivacyControl',…)`) covers
same-origin and `blob:` classic workers; module workers and cross-origin sources stay
uncovered, and service workers cannot be reached this way at all.

---

### G6 — The GPC preference is not cached per navigation; a mid-session toggle desynchronises an open tab

Spec, verbatim: **"The preference MUST be cached on each top-level navigation to ensure
consistency in communication of the person's request that their data 'not be sold or
shared'."**

Nullecho caches nothing. The header comes from a DNR ruleset evaluated per request; the JS
property is fixed once at `document_start`.

✅ Measured. One document, loaded with GPC on, never reloaded; GPC then switched off
through the real settings path (`nullecho:set-settings {gpc:false}`); then the *same*
document issued another `fetch()`:

```
BEFORE toggle: navigator.globalPrivacyControl = true
AFTER  toggle: navigator.globalPrivacyControl = true      (same document, not reloaded)

Sec-GPC:1   /r/iframe.html
Sec-GPC:1   /r/iframe-sub-same.json
Sec-GPC:1   /favicon.ico
Sec-GPC:1   /r/before-toggle.json
ABSENT      /r/after-toggle.json        ← the header stopped mid-document
```

The tab now tells a site two different things at once. The toast
(`options.js:68`, "Saved. Reload open tabs to apply.") acknowledges the problem without
fixing it, and partially satisfies S8's SHOULD.

---

### G7 — The header and the property are derived from two different sources of truth, with no reconciliation

- **Header** ← whether the `gpc` DNR ruleset is enabled (`chrome.declarativeNetRequest.getEnabledRulesets()`).
- **Property** ← `settings.gpc` in `chrome.storage.local`, via
  `background.js:593` — `gpc: settings.gpc && !NullechoGPC.isExceptedSync(site)`.

Nothing reconciles them. `NullechoGPC.init()` (`gpc.js:410`) only calls
`syncExceptionRules()`; it never calls `setEnabled(settings.gpc)`. And the one write path
swallows its own failure:

```js
// background.js:830
if (gpcChanged) {
  await globalThis.NullechoGPC.setEnabled(settings.gpc).catch(warn('NullechoGPC.setEnabled'));
}
```

with the guard one line earlier:

```js
// background.js:816
const gpcChanged = 'gpc' in patch && patch.gpc !== settings.gpc;
```

✅ Demonstrated end to end. I induced the divergence directly (`setEnabled(false)` while
`settings.gpc` stayed `true`) — I could **not** reproduce a naturally-occurring trigger, so
treat the *likelihood* as unquantified and the *consequences* as measured:

```
STEP 3 — what the page sees while settings say GPC is ON:
  navigator.globalPrivacyControl = true
  18 requests, 0 carried Sec-GPC

STEP 4 — the user clicks the GPC toggle back to ON in options:
  response: {"ok":true, …, "gpc":true}       ← reported as saved
  enabled rulesets: [ua-mac, ads, analytics, social, fingerprinting]   ← still no gpc
```

Because `settings.gpc` was already `true`, `gpcChanged` is `false`, the repair call never
runs, and **the state is unrecoverable from the UI**. `gpc.js:426` names this exact hazard:
"Header and property disagreeing is worse than either being off."

Two cheap fixes, both worth doing: reconcile in `init()` (`setEnabled(settings.gpc)`
unconditionally at worker start), and derive the reported `gpc` from
`NullechoGPC.isEnabled()` rather than from `settings.gpc`.

---

### G8 — `Sec-GPC` is scoped by request/initiator domain, not by the top-level browsing context

Spec, verbatim: **"The value of `globalPrivacyControl` MUST be the top-level browsing
context's `gpcAtNavigation`"**, and the header MUST NOT be generated when that value is
`false`.

Nullecho's rule 5000 excludes by `excludedRequestDomains` / `excludedInitiatorDomains`.
A cross-origin iframe's subresources carry the *iframe's* origin as initiator, so they
escape the exclusion even when the top-level page is excepted.

✅ Measured on `usaa.com` (a shipped-exclusion host). 17 of 18 requests correctly had no
header; the one leak:

```
Sec-GPC:1   xhr/fetch   third.test:8731   /r/iframe-sub-xo.json
            ↑ a fetch from a cross-origin iframe embedded on the excepted top-level page
```

Small in practice, real in principle: on a site Nullecho ships GPC *off* for because the
site breaks, its embedded third parties still receive the signal.

---

### G9 — `resourceTypes` covers 13 of Chrome's 15 types

`rules/gpc.json` rule 5000 lists 13 types. Chrome's enum (per
<https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest>,
fetched 2026-09-19) has 15: the two missing are **`webtransport`** and **`webbundle`**.
`ext/rules/validate.mjs:79-83` already carries the correct 15-entry set and does not check
the GPC rule against it.

✅ Asked Chrome's matcher for all 15 types, same URL and initiator:

```
main_frame sub_frame stylesheet script image font object
xmlhttprequest ping csp_report media websocket other   → rule 5000 MATCHES
webtransport                                            → rule 5000 does NOT match
webbundle                                               → rule 5000 does NOT match
```

Low impact today (WebTransport is rare and WebBundle rarer), but `webbundle` is an ad-tech
delivery path and the fix is two strings. The same two are missing from
`HEADER_RESOURCE_TYPES` in `gpc.js:334-337`, which the exception rules use.

---

### G10 — Colorado requires the mechanism's provider to disclose its limitations; Nullecho does not disclose that GPC covers only this browser

This is an obligation on **Nullecho**, not on the sites it signals. 4 CCR 904-3
**Rule 5.03(A)**, verbatim from the fetched CCR:

> **A.** If a platform, developer, or provider provides a Universal Opt-Out Mechanism, that
> platform, developer, or provider **shall make clear to the Consumer, whether in its
> configuration or disclosures to the public**, that the mechanism is meant to allow the
> Consumer to exercise the right to opt out … These notices provided to the Consumer:
> …
> **3. Shall clearly describe any limitations that may be applicable to the mechanism**, for
> example:
> a. That the mechanism will allow a consumer to exercise the opt-out right for **only one
> specific purpose**, either Targeted Advertising or Sale of Personal Data; or
> **b. That the mechanism applies only to a single browser or device.**

Nullecho's GPC copy satisfies the first half of 5.03(A) — `options.html:187-193` makes clear
the signal is a do-not-sell request, which is also what CA §7025(b)(2) asks for. It does not
satisfy 5.03(A)(3).

```
$ grep -rn -i "this browser|only in this browser|this device|per-browser|other browsers"     ext/popup ext/options docs/PRIVACY-POLICY.md docs/STORE-LISTING.md README.md
ext/popup/popup.js:199    'from your own browsing · stays on this device'
ext/options/drop.html:263 'Local to this browser, on this machine.'
ext/options/options.js:112 '"stays on this device"'
ext/options/options.html:45,58 'stays here, on this device'
docs/PRIVACY-POLICY.md:48 'per-browser-profile store on your own machine'
```

Every one of those is about **where data is stored**. Not one tells the user that the
**opt-out itself** reaches only this browser profile — not their phone, not their other
browser, not the same sites signed in elsewhere. That is precisely the limitation
5.03(A)(3)(b) names as its own example.

Two sub-points:

1. **The missing scope sentence.** One line in `options.html`, e.g. *"This covers this
   browser profile only — your phone and your other browsers each need their own."*
2. **The copy describes only *sale*, when in 9 of the 11 states the duty also covers
   targeted advertising** (and profiling in New Jersey — §2.1). "do-not-sell/share" is the
   framing everywhere in the project. It is not wrong, it under-sells the signal, and under
   5.03(A) the provider is expected to be clear about which purposes the mechanism exercises.
   Colorado's own Rule 5.03(A)(4)(a) blesses the easy fix: a disclosure saying the mechanism
   exercises *"any and all opt-out rights available to you under state laws"* satisfies the
   rule without naming any state.

**How confident to be:** the obligation is unambiguous and it binds "a platform, developer,
or provider [that] provides a Universal Opt-Out Mechanism", which Nullecho is. What is
*not* clear is the consequence — Rule 5.03(B) defines a mechanism's *validity* in terms of
affirmative choice, not notice, so a missing 5.03(A)(3) disclosure may be a compliance
defect without invalidating the signal. That is a question for counsel. The fix is two
sentences either way, which is why it is ranked here and not lower.

---

## NICE

### N1 — `gpc.test.js:110-118` documents DNR semantics backwards

Quoted in **G1**. The comment is the load-bearing part: it is why a reviewer reading the
test would conclude the rule was correct. Worth fixing even before the rule is.

### N2 — 50 hosts, one list, three copies

`rules/gpc.json` (`excludedRequestDomains` + `excludedInitiatorDomains`), `manifest.json`
(`exclude_matches`), `manifest.firefox.json` (`exclude_matches`) — four literal copies of
the same 50 hosts across three files. `validate.mjs` does enforce that they match
(`ext/README.md:65`), and `ext/PERMISSIONS.md:147` already flags it. Generate them.

### N3 — S8's reload affordance

The toast tells the user to reload; it does not say which tabs are inconsistent or offer to
do it. The extension has `tabs` reach through the popup already.

### N4 — `.well-known/gpc.json` — recommend NOT building it

See **§4**. The spec supports it; the evidence says it would fire on ~1.6% of sites and
report a self-declaration that does not predict behaviour.

### N5 — DNT — recommend NOT sending it

See **§4**.


---

# What I could not verify, and why

Listed so the confidence on each finding is legible. **Legal gaps are listed separately and
in more detail at §2.7** — in particular, nine states were never reached, and nothing in
this document should be read as a finding that they lack a UOOM duty.

1. **A naturally-occurring trigger for the G7 desync.** I induced it directly over CDP. The
   *consequences* are measured; the *likelihood* is not. The mechanism is visible in the
   code (a swallowed `setEnabled` rejection, no reconciliation in `init()`, and a
   `gpcChanged` guard that blocks repair), but I did not observe it happen on its own.

2. **Whether the G3 detector uniquely identifies Nullecho.** It cleanly separates Nullecho
   from Firefox-native GPC and from a stock Chrome. I could not install DuckDuckGo Privacy
   Essentials or Privacy Badger to check whether they produce the same descriptor shape and
   would be lumped into the same bucket.

3. **`webtransport` / `webbundle` in a live browser.** Proven absent via
   `chrome.declarativeNetRequest.testMatchOutcome` — Chrome's own matcher — but not with a
   real WebTransport server or a real WebBundle. The matcher is authoritative for rule
   matching; the end-to-end capture is the step I did not do.

4. **The extension in the *installed* Chrome (153).** Chrome 153 refuses `--load-extension`
   even with `--enable-unsafe-extension-debugging` and
   `--disable-features=DisableLoadExtensionCommandLineSwitch`; a two-line positive-control
   extension confirmed the flag is inert there and live in Chrome for Testing 147, which is
   what every Chrome measurement above used. Nothing in the GPC lane depends on a
   post-147 behaviour change that I am aware of, but this review did not run on 153, and
   `minimum_chrome_version` is `121`.

5. **Whether any site actually honours the signal.** Out of scope for a browser, by the
   project's own repeated and correct statement — `linkage.js:511` ("Whether the site acted
   on it is not observable from a browser") is the right sentence and this review does not
   improve on it.

6. **Real-world breakage on the 50 shipped-exclusion hosts.** Not tested; that is the
   breakage-testing gate, not this lane. `usaa.com` was mapped to a local server purely to
   exercise the exclusion rule, not the real site.

7. **`isCalifornian`.** I established that nothing writes it and that a live
   `chrome.storage.local` read on a running instance has no such key, so every branch on it
   is dead. I did not trace whether that is a regression or a feature that was never
   finished — it is the DROP lane, not this one.

---

# Provenance

| artefact | where |
|---|---|
| header-capture server (all resource types + WebSocket + service worker) | `…/scratchpad/gpc/server.mjs` |
| Chrome driver (CDP) | `…/scratchpad/gpc/drive.mjs` |
| live service-worker interrogation + `testMatchOutcome` | `…/scratchpad/gpc/sw.mjs`, `rt.mjs` |
| settings path via the extension's own message API | `…/scratchpad/gpc/optpage.mjs` |
| mid-session toggle (G6) | `…/scratchpad/gpc/midsession2.mjs` |
| Firefox driver (WebDriver BiDi) + `webExtension.install` | `…/scratchpad/gpc/ffprobe/bidi.mjs`, `probe2.mjs` |
| Firefox native-property delete replay (G2) | `…/scratchpad/gpc/ffprobe/ffdel.mjs` |
| the detector | `…/scratchpad/gpc/attack.mjs`, `run-attack-chrome.mjs`, `run-attack-ff.mjs` |
| USENIX paper, extracted text | `…/scratchpad/gpc/usenix.txt` |

Browsers: Google Chrome for Testing **147.0.7727.15**, Firefox **155.0.1**, both on
macOS 26.6 arm64, both with throwaway profiles. The extension was loaded from a *copy* at
`…/scratchpad/gpc/ext-copy` (Chrome) and `…/scratchpad/gpc/ext-ff` (Firefox, with
`manifest.firefox.json` renamed into place); nothing under `ext/` in the repository was
read-modified or loaded directly.
