# Independent claim verification — 2026-09-17

Every verification in this repo before today used **our** probes (`harness/fingerprint.js`)
and **our** detectors (`harness/shim-test.html`). That is circular. It proves the shim does
what we told it to do, measured by code that knows what we told it.

This is the first time third-party, commercial-grade fingerprinting code has been pointed
at Nullecho. The harness is `harness/claim-verification.html`; the libraries are vendored
under `harness/vendor/` (sources, versions, licences and SHA-256 in that directory's README).

**The verdict, up front: the canonical claim is half-verified and half-refuted, and the
refuted half is the more important one.**

- ✅ **FingerprintJS and ClientJS are joined-then-split exactly as claimed.** Two site keys →
  two different `visitorId`s. Same site key twice → the same `visitorId`. That is the
  product working.
- ❌ **CreepJS re-joins every persona, immediately, out of the box.** Four different personas
  produced **one identical CreepJS identity**. Not a determined adversary; a 550 KB MIT
  library run with its defaults.
- ❌ **"2 of 9 adversarial detectors fire" badly understates detectability.** CreepJS goes
  from **0 lies on the control to 453 lie records across 198 distinct APIs**, names the
  `Function.prototype.toString` patch, emits a 30-entry extension signature, and classifies
  the browser as **running a webdriver** — i.e. as a bot.
- ❌ **The shim announces itself by name.** Provoked by CreepJS's illegal-receiver probes, it
  writes `[Nullecho] shim could NOT patch "…"` to the page console — readable by any page in
  three lines — and the warning is **false**: the API is patched and working. See §3d.
- ⚠️ **The margin that breaks the join is thinner than the threat model implies.** Of
  FingerprintJS's 42 components, only **3** differ between the two personas the extension
  actually assigned. Two of those three are our canvas and audio noise — the exact signals
  CreepJS detects and discards.

---

## The environment, stated so the numbers can be checked

| | |
|---|---|
| Browser | **Real Chrome 151.0.0.0** — `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) … Chrome/151.0.0.0 Safari/537.36`, no `Electron` token |
| Host | macOS 26.6.0, Apple M2 Max, 12 cores / 32 GB, screen 1512×982 @ colorDepth 30, DPR 2 |
| Window | 1512×805 for every run, never resized (FingerprintJS hashes screen geometry) |
| Server | `nullecho-root`, repo root on :4886, reachable as both `127.0.0.1` and `localhost` |
| Cache | every subresource carries `?cb=`; verified by network log — 5 requests, all local, all 200 |
| Network | **zero outbound requests.** `FingerprintJS.load({monitoring: false})`; its default is `true` and fires a GET at `m1.openfpcdn.io` |

The UA is captured in stage 0 **before** `shim.js` runs, because after that `navigator` is
the persona's and could not tell Chrome from Electron at all. Nothing on this page was
measured in the in-app Browser pane.

---

## 1. The join test

`background.js siteKeyFor(url)` is `registrableDomain(u.hostname)`, and `registrableDomain`
returns single-label hosts and IPv4 literals unchanged. So **`localhost` and `127.0.0.1` are
two different sites to Nullecho** — one machine, one port, two genuinely different site keys,
no `/etc/hosts` edit. Personas come from the real `personaFor()` via
`harness/gen-claim-personas.mjs`.

**⚠ Ports are not part of a site key.** `localhost:4886` and `localhost:4887` are ONE site and
get ONE persona. Two ports is not a two-origin test; two hostnames is.

| Run | Site key | Persona | FingerprintJS `visitorId` | ClientJS | CreepJS identity |
|---|---|---|---|---|---|
| **Control, no shim** | `127.0.0.1` | — | `aeabc5306d13ab237c3bc22598bfc03c` | `674107523` | `aa47f9e9597d40f3…` |
| **Persona A** | `localhost` | `macos-chrome-mini-m2` | `e28d352936c7ae5e0c9938135693687c` | `3754792222` | `9bc65b4cbf1e7c96…` |
| **Persona A, again** | `localhost` | `macos-chrome-mini-m2` | `e28d352936c7ae5e0c9938135693687c` | `3754792222` | `9bc65b4cbf1e7c96…` |
| **Persona B** | `127.0.0.1` | `macos-chrome-m2-air` | `239627412c59be31e7eb46dac942738d` | `1187996492` | `9bc65b4cbf1e7c96…` |
| **Persona B, again** | `127.0.0.1` | `macos-chrome-m2-air` | `239627412c59be31e7eb46dac942738d` | `1187996492` | `9bc65b4cbf1e7c96…` |
| Persona A forced on B's origin | `localhost` (forced) | `macos-chrome-mini-m2` | `e28d352936c7ae5e0c9938135693687c` | `3754792222` | `9bc65b4cbf1e7c96…` |
| Widest pair in the macOS pool | `::1` (forced) | `macos-chrome-m1-pro` | `5f13b6562f17b032c2d77d79e0e0d23d` | `3944735495` | `9bc65b4cbf1e7c96…` |
| Widest pair in the macOS pool | `nytimes.com` (forced) | `macos-chrome-m1` | `99152cc9c6092253e12b85f0ce00fea1` | `989632858` | `9bc65b4cbf1e7c96…` |

**Join broken — FingerprintJS: YES.** Four personas, four distinct `visitorId`s, all different
from the control.

**Stable — YES, and this matters as much as the split.** The same site key, reloaded with a
fresh cache-buster, produced a byte-identical `visitorId` from all three libraries. An unstable
fingerprint is its own identifier (D2); it is stable.

**Join broken — ClientJS: YES.** Four distinct murmur values.

**Join broken — CreepJS: NO.** `9bc65b4cbf1e7c9663890c6dddf805dc` under **all four** personas.

A useful control fell out of this: persona A forced onto persona B's *origin* produced persona
A's exact `visitorId`. The id is a pure function of the persona, not of the URL — which is why
the `?site=` stand-in below is a legitimate way to compare personas the extension would not
otherwise pair.

### Why CreepJS re-joins, and why it is not an unfair test

CreepJS computes its identity from a `creep` object that it deliberately builds **only from
signals it has not caught lying**. After discarding everything Nullecho touches, `window.Creep`
was left holding exactly four keys:

```
["media", "cssMedia", "css", "forceRenew"]
```

`cssMedia` and `css` are the display layer, which **D11 deliberately stopped spoofing** because
a contradiction was judged worse than a leak. `media` is `mediaDevices`, which this layer never
claimed. `forceRenew` is a CreepJS version constant.

So CreepJS's identity is built from precisely the surfaces Nullecho leaves truthful — and those
are identical across every persona **by design**. This is not a bug in the shim. It is the
direct, measured consequence of the D11 retreat, and it is the strongest available evidence
that the retreat cost more than "two fewer protected signals."

**The threat model says a determined adversary could re-join on engine-level invariants. That
is now an understatement: an off-the-shelf library does it with no configuration.**

---

## 2. What an outside library recovered anyway

Per-signal diff between two personas. `joined` = the signal is identical under both personas,
so a tracker can re-join on it.

| Pair | FingerprintJS components | CreepJS sections | Combined |
|---|---|---|---|
| **As the extension assigned them** (`mini-m2` vs `m2-air`) | **39 of 42 joined**, 3 split | **21 of 24 joined**, 3 split | 60 of 66 joined |
| **Widest pair in the macOS pool** (`m1-pro` vs `m1`) | **37 of 42 joined**, 5 split | **21 of 24 joined**, 3 split | 58 of 66 joined |

**The only components that ever split:**

| Component | Split by | Note |
|---|---|---|
| `canvas` | our canvas noise | CreepJS detects it and discards the signal |
| `audio` | our audio noise | same |
| `deviceMemory` | a real persona field | 8 vs 16 GB |
| `hardwareConcurrency` | a real persona field | only in the widest pair — 8 vs 10 |
| `webGlBasics` | the renderer string | only in the widest pair — `Apple M1 Pro` vs `Apple M1` |
| CreepJS `canvas2d`, `canvasWebgl`, `offlineAudioContext` | our noise | the same two noise sources |

Read that carefully. **For the pair the extension actually chose, once a tracker discards the
two noised signals — which CreepJS does automatically — the entire remaining difference between
the two personas is `deviceMemory: 8` versus `deviceMemory: 16`.** About one bit.

This is a direct consequence of D12 (host-matched OS) narrowing the pool to five macOS entries,
and of that pool being tight: all five claim 8 or 10 cores, 8/16/32 GB, and two of them
(`mini-m2` and `m2-air`) have **byte-identical WebGL renderer strings**. The Arkenfox follow-up
already recorded that host-matching cut the moving signals from 8-of-14 to 5-of-14 in our own
harness. Measured from outside, it is 3 of 42.

**Engine invariants: the threat model's claim here is TRUE, and now verified rather than
assumed.** Identical under every persona and identical to the unshimmed control:

| Surface | Value under every persona | |
|---|---|---|
| libm (`acos/sinh/tan/expm1/…`) | `1c9a3a2946476dc8…` | unchanged from control |
| CSS `@media` | `dppx=2 gamut=p3 hdr=high ptr=fine` | unchanged — real display, D11 |
| `screen` / DPR | `1512x982@30 dpr=2` | unchanged — truthful by decision |
| timezone | `America/Los_Angeles / offset 420` | not spoofed |
| locale | `en-US [en-US,en]` | left real, D25 |
| `maxTouchPoints` | `0` | left real, D26 |
| CreepJS `maths`, `css`, `cssMedia`, `intl`, `features`, `voices`, `htmlElementVersion`, `windowFeatures`, `consoleErrors`, `media`, `trash`, `capturedErrors` | identical to the no-shim control | 12 of 24 sections |

---

## 3. Detectability — the number is much worse than "2 of 9"

Every row below is shim-off vs shim-on **in the same tab, same session, minutes apart**. The
control column is what makes this a measurement rather than a claim about Chrome.

| CreepJS signal | Control (no shim) | Shim on | |
|---|---|---|---|
| lie records | **0** | **453** | |
| distinct APIs flagged as lying | **0** | **198** | |
| `stealth.hasToStringProxy` | `false` | **`true`** | a patched `Function.prototype.toString`, named as such |
| `headless.webDriverIsOn` | `false` | **`true`** | **CreepJS concludes the browser is automated** |
| `resistance.extensionHashPattern` | `{}` | **~30 entries** | CreepJS's own per-extension signature |
| `trash` | 2 | 2 | ⚠ baseline: this host scores 2 with no extension (`suspicious gpu`, `suspicious capabilities`) |
| captured errors | 4 | 4 | unchanged |
| `resistance.privacy` | — | — | it did **not** classify us as a privacy browser |
| uniform-fill canvas noise | 1 distinct value | 5 (`126…130`) | the detector we already publish, reproduced |

Two of those deserve their own headings.

### 3a. CreepJS thinks Nullecho is a bot

`headless.webDriverIsOn` went `false → true` **in the same browser, same automation session**.
It is not the CDP connection: the control run, in the same tab, scored `false`.

The mechanism is a cascade from one root cause. CreepJS's rule is

```js
webDriverIsOn: (CSS.supports(…) && navigator.webdriver === undefined)
            || !!navigator.webdriver
            || !!lieProps['Navigator.webdriver']
```

`navigator.webdriver` is a correct `false` under the shim, and the `webdriver` getter is
**not patched**. It is flagged anyway, because CreepJS's per-API `failed toString` check also
inspects `apiFunction.toString` — which resolves to the *page's* `Function.prototype.toString`,
which the shim did replace. One patch therefore poisons the toString check for every API on
the page, patched or not.

`docs/THREAT-MODEL.md`'s "honest counterweight" section already warns that rotation trips named
fraud-vendor signals (`new_device`, `Hardware_Signals_Suppressed`, …). This is worse in kind:
the classification is not "privacy tool", it is **"webdriver"**. Fingerprint.com's published
weights put a bad bot at 7 and privacy settings at 6; a bot verdict is the more expensive one,
and it is the one an off-the-shelf library reaches.

> **2026-09-17:** the root of this cascade is §3c (the same-tick pristine realm CreepJS uses as its
> `scope`), not the toString shape — see the D32 note at the end of §3b. Fixing the shape left
> `webDriverIsOn` at `true`.
>
> **2026-09-19 — and closing §3c closed this.** With the same-tick realm patched (D35),
> `headless.webDriverIsOn` reads **`false`** and `stealth.hasToStringProxy` reads **`false`** — both
> equal to the control — and lie records fall 199 → **2**. The cascade diagnosis above was right: the
> root was the `scope` realm, not the shape.

### 3b. A patched function is a plain `function`, and that is three one-line tells

This is the concrete, fixable defect the exercise found. Our nine detectors check what a patched
function **says** (`toString` → `[native code]`) and what it does with a wrong receiver. CreepJS
checks the function **object's shape**, and a plain `function(){}` gives itself away:

| Probe | Native accessor | Nullecho's patch |
|---|---|---|
| `Object.getOwnPropertyNames(f).sort()` | `length,name` | **`length,name,prototype`** |
| `'prototype' in f` | `false` | **`true`** |
| `class X extends f {}` | throws `TypeError` | **does not throw** |

Measured, with positive controls in the same run:

```
Navigator.userAgent   (shimmed)      [length,name,prototype]  extends→no-throw
ctx.getImageData      (shimmed)      [length,name,prototype]  extends→no-throw
Navigator.webdriver   (never patched) [length,name]           extends→TypeError
Screen.width          (truthful, D11) [length,name]           extends→TypeError
```

Control run: all four read `[length,name] extends→TypeError`. The probe is specific; it is the
shim that differs.

`Function.prototype.toString` **itself** has the same shape defect, which is what sets
`stealth.hasToStringProxy` and starts the cascade in 3a.

This looks fixable: a patch defined as an arrow function or as method/getter shorthand has no
own `prototype` and is not a constructor, so all three probes come out native. That is a
shim change and is out of scope for this document — it belongs to whoever owns `shim.js`.

> **CLOSED 2026-09-17 (DECISIONS.md D32).** `shim.js` now installs only getter/method-shorthand
> functions (fixed in the three helpers + the one direct `[Symbol.iterator]` site). Real Chrome 151,
> same host, shim on: `nativeShapePatched` reads `[length,name] extends→TypeError` for both surfaces
> (= the control), and every structural lie type — `"prototype" in`, own property names/keys,
> descriptor/descriptor keys, class extends, instanceof, new/call/apply interface — went from 31
> (or 2) records to **0**; lie records **453 → 199**. FingerprintJS still splits `localhost` /
> `127.0.0.1` and is stable per host. Regression tests: `ext/src/native-shape.test.js`.
>
> **Correction to the paragraph above:** `Function.prototype.toString`'s shape is *not* what sets
> `stealth.hasToStringProxy` or starts the 3a cascade. With the shape fixed, `failed toString` is
> unchanged at 197 and `hasToStringProxy` / `webDriverIsOn` are still `true`. CreepJS's `scope` is
> `PHANTOM_DARKNESS`, built by `getPhantomIframe()` as `self[self.length]` in the inserting tick —
> §3c's same-tick pristine realm — so that cascade, and the bot verdict, belong to §3c.

### 3c. The same-tick pristine realm defeats the `[native code]` lie entirely

Already documented as "unreachable" for one persona field. The larger consequence was not
documented. Through a `window[n]` realm created in one synchronous block:

| | Control | Shim on |
|---|---|---|
| child realm `hardwareConcurrency` | 12 (host) | **12 (host, not the persona's 8)** |
| pristine `toString(userAgent getter)` says `[native code]`? | `true` | **`false`** |
| pristine `toString(Function.prototype.toString)` says `[native code]`? | `true` | **`false`** |

So a page can read the shim's **actual JavaScript source** for every patched function. Note
that an ordinary `document.body.appendChild(iframe)` then `frame.contentWindow` does *not*
leak this — `contentWindow` is hooked and returned `[native code]` correctly. Only the
same-tick `window[n]` path does. That is consistent with what the threat model says is
unreachable; what is new is that the reachable consequence is not one field, it is the whole
`toString` defence.

> **CLOSED 2026-09-19 (DECISIONS.md D35).** "Unreachable" was wrong. The child browsing context is
> created *synchronously inside the native insertion call*, so `shim.js` now wraps every DOM entry
> point that can connect an `<iframe>` (30 of them, enumerated in one `INSERTION_SITES` table and
> held by a lint test) and installs into the new realm before the original's result is returned.
> Re-measured in real Chrome 151, fresh `?cb=`, on both harness origins, with a control run in the
> same browser:
>
> | | Control | Before | **After** |
> |---|---|---|---|
> | child realm `hardwareConcurrency` | 12 (host) | 12 (host) | **8 (the persona)** |
> | pristine `toString(userAgent getter)` says `[native code]`? | `true` | `false` | **`true`** |
> | pristine `toString(Function.prototype.toString)`? | `true` | `false` | **`true`** |
> | CreepJS lie records | 0 | 199 | **2** |
> | CreepJS APIs flagged as lying | 0 | 198 | **2** |
> | `stealth.hasToStringProxy` | `false` | `true` | **`false`** |
> | `headless.webDriverIsOn` | `false` | `true` | **`false`** |
> | `resistance.extensionHashPattern` | `{}` | ~30 entries | **`{}`** |
> | `trash` | 2 | 2 | 3 |
> | captured errors | 4 | 4 | 4 |
>
> **The bot verdict is gone**, and so is the extension signature CreepJS was building. The **two**
> surviving lies are the defense itself and are not removable without removing it: `AudioBuffer:
> sample noise detected` and `CanvasRenderingContext2D.getImageData: pixel data modified` — our own
> farbling, which is also the third `trash` entry (`suspicious pixel data`).
>
> ⚠ **This does NOT fix the join, and must not be read as fixing it.** Measured in the same pair of
> runs: FingerprintJS still gives the two origins different visitorIds (`2396…` vs `e28d…`), and
> CreepJS still returns the **identical** id on both (`5e55ad8a2ff5dfda…`). §1 and §6.1 stand
> unchanged — CreepJS keys on the display layer D11 made truthful, which is persona-invariant by
> design and has nothing to do with how many lies it counts.
>
> **Two pristine-realm paths survive**, both found by D35's own attack pass, neither reachable by the
> bypass above and neither used by CreepJS. (1) The **HTML parser**: an `<iframe>` in static markup
> is connected by the parser, which calls no DOM method, so an inline `<script>` in the same parse
> still reads a pristine realm — measured at 12 cores during the parse and 8 once the enclosing
> `document.write` returned. (2) A frame inserted as `about:blank` and **navigated later**: the shim
> keys "already installed" on the WindowProxy, which survives navigation, so the new realm is never
> patched — pre-existing, async, and the next decision (key on the realm's `document` instead). Both
> are recorded in D35 and in `docs/THREAT-MODEL.md`. Cost of the fix: +0.15–0.49 µs per `appendChild`
> on a page with no child frames, ≈0.11 µs more per child frame
> (`docs/PERFORMANCE-2026-09-17.md`, 2026-09-19 follow-up).
>
> **D47 (2026-09-19), on those two.** (2) is **closed**: "already installed" is keyed on the realm's
> Document, not its WindowProxy, and a document-capture `load` door installs the new realm before the
> page's own load handler runs. Re-measured in real Chrome 151 with a fresh `?cb=` on both origins:
> the page's handler on a navigated frame reads the persona (was the host), that realm's `toString`
> is masked, and every number in the table above holds — lie records **2**, `hasToStringProxy`
> **false**, `webDriverIsOn` **false**, `extensionHashPattern` **`{}`**, the same two visitorIds and
> the same single CreepJS id. What remains of (2) is the interval between the navigation committing
> and `load` (5–11 ms on localhost). (1) is **narrowed**: static markup and `document.write` from a
> parser-inserted script already read the persona; only `document.write` into a document whose parser
> is not the caller (a child written from the parent) still reads the host inside the write.
> **Both remaining gaps are closed by the installed extension, now measured**: `ext/` loaded unpacked
> in Chrome for Testing 149 returned the persona for every reading on `harness/realm-timing.html`,
> including the grandchild read inside the write and the navigated frame at commit (§5). Cost of D47:
> nothing measurable with no child frames, ≈ +0.3 µs per same-origin child frame per insertion.

### 3d. The shim prints its own product name into the page console — and the message is false

The worst single finding, and the most fixable. CreepJS's `failed call interface error` and
`failed new instance error` probes call each patched method with an illegal receiver
(`fn.call({})`, `new fn()`). The **original** then throws `TypeError: Illegal invocation` —
which is the brand check working exactly as `ARKENFOX-RESPONSE.md` (f) describes. The shim's
error handler does not distinguish that from a genuine patch failure, and logs:

```
[Nullecho] shim could NOT patch "CanvasRenderingContext2D.measureText".
That API is UNPROTECTED on this page. A silently-unpatched API is the worst
outcome — please report this. TypeError: Illegal invocation
```

35 such errors in one CreepJS run, naming `measureText`, `toDataURL`, `toBlob`,
`convertToBlob`, `copyFromChannel` and others.

**Both halves of that are bad.**

1. **The message is a false alarm.** Verified in the same run: `measureText` is still patched
   (own-property names `length,name,prototype`) and still returns shimmed metrics — a font the
   persona does not have measures differently from one it does. `toDataURL` works. The persona
   is still applied. Nothing is unprotected. This is the cry-wolf failure that
   `harness/shim-test.html`'s own boot gate has a long comment warning against, reappearing in
   the shim itself.
2. **It is a nominative detector in three lines.** A page installs a `console.error` hook at
   any point after the shim boots, calls one shimmed method with a wrong receiver, and reads
   the literal string `[Nullecho]`:

| | Control (no shim) | Shim on |
|---|---|---|
| messages captured by a page-installed `console.error` hook | **0** | **1 per illegal call** |
| message contains the string "Nullecho" | **false** | **true** |
| `measureText` still functional (i.e. was the warning true?) | true | **true — the warning is false** |

`docs/THREAT-MODEL.md` bans "any phrasing implying a site cannot tell Nullecho is installed.
It can, in about ten lines of JavaScript." This is three lines, and it does not merely detect
a *class* of tool — **it returns the product name as a string.** That is a different and worse
category of disclosure than canvas farbling, and unlike farbling it is trivially fixable: the
handler needs to treat a `TypeError: Illegal invocation` raised by the delegated original as
the expected brand-check path, not as a patch failure, and it should not be writing
product-identifying text to a page-reachable console at all.

> **CLOSED 2026-09-17 (DECISIONS.md D33).** Root cause was five wrappers doing shim work *before* the
> original spoke (`toDataURL`, `toBlob`, `convertToBlob`, `copyFromChannel`, `measureText`); each now
> delegates or brand-checks first, outside the `try`, so the original's own error reaches the caller
> unlogged — including a second false alarm the test found, `measureText()` with no argument. And
> `shim.js` no longer calls `console` at all: a genuine failure rides the D30 status as a `failures`
> list of labels, printed by `shim-loader.js` from the ISOLATED world and recorded per site. Real
> Chrome 151, fresh `?cb=`: `consoleNameLeak` reads `0 message(s); names "Nullecho": false ·
> measureText still functional: true` in both the control and the shimmed run; twelve illegal probes
> with a hook on every console method captured nothing; a full CreepJS run left 0 lines matching
> `Nullecho` in the tab console (positive control captured) and 0 `failed call/new/apply interface`
> lies. Regression tests: `ext/src/claim-verification-2026-09-17.test.js`.

---

## 4. Cost

Per-pixel noise is more expensive than the last recorded figure.

| Operation (300×200, 20 iterations, warmed) | Shim off | Shim on | Ratio |
|---|---|---|---|
| `getImageData` | 0.150 ms/op | 2.945 ms/op | **19.6×** |
| `toDataURL` | 0.225 ms/op | 4.080 ms/op | **18.1×** |

`ARKENFOX-RESPONSE.md` open follow-up #6 records 7–12×. On this rig, in real Chrome 151, it
is ~19×. That is another cheap signal for anyone who benchmarks canvas, and it is the third
independent reading to come in worse than the one before it.

---

## 5. Which parts of the canonical claim are now independently verified

> "Nullecho shows each site a different, internally consistent device profile, which breaks
> the device-fingerprint join that ad-tech uses to follow you between sites. It is detectable,
> it does not defeat a determined adversary, and it does nothing about your IP address."

| Clause | Status | Evidence |
|---|---|---|
| "different … per site" | ✅ **verified independently** | 4 personas → 4 FingerprintJS `visitorId`s, 4 ClientJS values |
| stable per site (D2, implied) | ✅ **verified independently** | same site key, fresh load, cache-busted → identical id from all 3 libraries |
| "internally consistent" | ✅ **as of 2026-09-19** | was: 198 APIs flagged as lying by an outside library. After D32 (shape) and D35 (same-tick realm): **2**, and both are our own canvas/audio noise — see the §3c closure note |
| "breaks the join" | ⚠️ **verified for 2 of 3 libraries, refuted for the third** | FingerprintJS ✅, ClientJS ✅, **CreepJS ❌ — one identity across all four personas** |
| "it is detectable" | ✅ verified — magnitude first understated, then corrected downward | 0 → 453 lies; named as a toString proxy; classified as a webdriver; printing its own product name to the page console (§3d). **All three closed: 453 → 199 (D32) → 2 (D35); `hasToStringProxy` and `webDriverIsOn` both back to the control's `false`; 0 console lines (D33).** Still detectable — the 2 remaining lies are the canvas and audio noise, by design |
| "does not defeat a determined adversary" | ✅ **verified, and weaker than stated** | it does not defeat an *undetermined* one either — CreepJS needed no configuration |
| engine invariants survive every persona | ✅ **verified** | libm, CSS `@media`, display, timezone, locale, touch: identical under all personas and to the control |
| "nothing about your IP" | — | unchanged; unreachable from a WebExtension |

### What still requires a real unpacked install

This page stands in for the MAIN-world content script and for the service worker. It does not
replace the extension. The following are **assumed, not verified**, here:

1. **The MAIN-world injection race.** A property of Chrome's content-script scheduler. This
   page's shim is a blocking `<script>` in `<head>` and always wins; the real one may not.
2. **The service-worker round trip** — salt storage, `senderSiteKey`, the allowlist check, and
   the real per-origin persona delivery. This page hands the persona over itself.
3. **That the worker keys the two hostnames the way this page assumes.** Checkable without a
   browser and checked: `siteKeyFor` → `registrableDomain`, which returns `localhost` and
   `127.0.0.1` unchanged, and `personaFor` maps them to two different personas. But it was not
   observed end-to-end.
4. **Header-layer behaviour** (the D19 DNR UA rulesets). Not exercised at all.

> **Update 2026-09-19 (D47).** `ext/` was loaded unpacked for the first time — into **Chrome for
> Testing 149.0.7827.22** (new headless, `--load-extension`, a throwaway profile; `Chrome/149`, no
> Electron), driven from Puppeteer — now `harness/unpacked-chrome.mjs`, whose `claim` mode runs this
> page on both loopback hostnames with the extension supplying the persona. What that verified: the service worker boots and stores its
> `identity`; the MAIN-world shim runs before the page's first inline script (item 1, on that page:
> `hardwareConcurrency` was already the persona's at stage 0); and Chrome's per-frame injection
> (`all_frames` + `match_origin_as_fallback`) covers every child-realm path
> `harness/realm-timing.html?shim=off` measures — the static-markup frame in the same parse, the
> `document.write` shapes including a grandchild read inside the write, and a navigated frame **at
> commit** — which D35 and the threat model had called assumed. Still not verified there: the
> two-hostname persona split end-to-end (item 3), the DNR header rulesets (item 4), and any of this
> in a user's own Chrome profile.
>
> **What the rigorous version found, the first time it ran** (`unpacked-chrome.mjs claim`, both
> hostnames): item 3 holds — two site keys, two FingerprintJS visitorIds under the real service
> worker — but CreepJS reads **199 lies, `hasToStringProxy: true`, a 30-entry extension hash** on
> both origins, where page-script mode reads 2 / false / empty. It is `gpc.js`'s D38 toString
> wrapper, revealed from a child realm; the same build with `gpc.js` not injected reads 2 / false / 0.
> D47's closing paragraph has the chain probe and the decisive experiment.

**To run the rigorous version:** load `ext/` unpacked at `chrome://extensions`, then open
`harness/claim-verification.html?shim=off` (so the page does not fight the real content script)
on `http://localhost:4886` and again on `http://127.0.0.1:4886`, and compare. The personas will
differ from the ones in this document unless the extension's stored salt happens to equal
`nullecho-claim-verification-2026-09-17` — which does not matter to the claim, only that the
two site keys get different personas.

**Out of reach even with the extension installed:** Web Workers (no content script in a worker
scope), WASM-compiled fingerprinting, and the TLS/IP layer.

---

## 6. What this changes, in order of importance

1. **"Breaks the device-fingerprint join" cannot stand unqualified.** It is true of the most
   widely deployed fingerprinting library and false of a freely available one that any tracker
   could adopt tomorrow. The claim needs a scope: *breaks the join for trackers that hash the
   signals we cover; does not break it for a tracker that discards spoofed signals and keys on
   the display layer.* That is a narrower and defensible sentence.
2. **The D11 display-layer retreat is the load-bearing cause, and its cost was under-counted.**
   `ARKENFOX-RESPONSE.md` books it as "two fewer detectors, two fewer protected signals". In
   fact it handed CreepJS a complete, persona-invariant identity. The decision may still be
   right — a contradiction really is worse than a leak — but the entry should record what it
   actually bought the adversary.
3. **"2 of 9 detectors" is not a number we should publish without context.** It is our own
   suite's score. An outside library scores 198 flagged APIs and a bot verdict. Publishing the
   lower number while the higher one is a `<script>` tag away is the kind of understatement
   this project's threat model exists to prevent.
4. **Two cheap, high-value shim fixes fell out of this** (both out of scope here — they belong
   to whoever owns `shim.js`):
   - **The console message that names the product** (§3d). A false alarm that hands a page the
     string "Nullecho". Fix the handler to recognise a delegated `Illegal invocation` as the
     brand check, and stop writing identifying text to a page-reachable console.
     **Closed 2026-09-17 (D33)** — 0 messages in both runs; the shim no longer touches the page console.
   - **The plain-function shape leak** (§3b). Root of 3a and 3b, three lines of
     `Object.getOwnPropertyNames` to detect, and it costs a bot classification.
     **Closed 2026-09-17 (D32)** — 453 → 199 lie records; the bot classification did *not* move
     with it, because it is §3c's (see the note under §3b).
5. **The macOS pool is too tight to carry the claim on its own.** With `canvas` and `audio`
   discarded, the two assigned personas differed by one field. Either the pool needs more
   spread in `deviceMemory` / `hardwareConcurrency` / renderer within a family, or the claim
   needs to say that the per-site difference is small for a host-matched pool.

None of this says the extension is worthless. It splits the two most-deployed fingerprinting
implementations cleanly and stably, which is the common case. It says the *sentence* we ship
is stronger than the *measurement* supports, and that is the one failure mode
`docs/THREAT-MODEL.md` opens by forbidding.

---

## Reproducing

```sh
# serve the PROJECT ROOT (launch config `nullecho-root`, port 4886)
node harness/gen-claim-personas.mjs           # regenerate persona blobs from personaFor()

# real Chrome, same window size throughout, fresh ?cb= each time:
http://127.0.0.1:4886/harness/claim-verification.html?shim=off&cb=1   # control
http://127.0.0.1:4886/harness/claim-verification.html?cb=2            # persona B
http://127.0.0.1:4886/harness/claim-verification.html?cb=3            # persona B again
http://localhost:4886/harness/claim-verification.html?cb=4            # persona A
http://localhost:4886/harness/claim-verification.html?cb=5            # persona A again
```

Runs accumulate in `localStorage` per origin; **Copy this run as JSON** on one origin and
**Import run** on the other joins them into one table. `?site=<key>` forces a persona by hand,
for comparisons a real install could not produce — every row in this document produced by that
route is labelled "(forced)".
