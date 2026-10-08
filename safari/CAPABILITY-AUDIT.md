# Nullecho for Safari — capability audit (phase 0)

Date: 2026-10-01/02. Safari 27.0 on macOS 26.6; iOS/iPadOS 27.0 (24A434) in the Simulator; Xcode 27.0 (27A266a).

This page is the summary. Every line points to one of three detailed reports, which carry the raw evidence
(server-log keys, run ids, Apple/WebKit URLs):

- [`audit/01-api-support.md`](audit/01-api-support.md): which WebExtension APIs work. Measured in Safari on iOS 27
  with a probe extension of our own. The macOS column comes from docs and WebKit source only.
- [`audit/02-builtin-protections.md`](audit/02-builtin-protections.md): what Safari already does without us. Measured
  in real macOS Safari 27 (normal browsing) and the iPadOS 27 Simulator (normal, AFP = All Browsing, Private tab).
- [`audit/03-packaging.md`](audit/03-packaging.md): converter output, container app, distribution, App Review,
  privacy label. Builds were run, but nothing was executed at runtime.

**Measured** means a request reached (or did not reach) a server we control and was read from its log. Each check
was paired with a control that proves the check can fail. **Docs** means Apple or WebKit publications or WebKit
source. **Unverified** is stated plainly. Nothing below was measured with a Nullecho extension running in macOS
Safari. That needs one owner step (§6).

## Verdict

**Phase 1 is static tracker lists + Global Privacy Control, with no learner and no persona.** The audit leaves no
room for the learner:

| Phase-1 piece | Ships? | Why (evidence) |
|---|---|---|
| Static tracker blocking (`rules/ads`, `analytics`, `social`, `fingerprinting`) | **Yes** | DNR `block` works on iOS **even with no website access granted**. It covers images, scripts, fetch and XHR, plus `requestDomains`, `urlFilter ‖d^`, `domainType`, `resourceTypes` and `updateEnabledRulesets` (01 §3, runs `noperm2-a`, `v2c-toggle-a`). Safari itself lets every tracker request through in normal browsing (02 §1). |
| GPC header `Sec-GPC: 1` | **Yes, partial, and it must be described that way** | Applied only with the extra `declarativeNetRequestWithHostAccess` permission **and** website access. Even then Safari attaches it **only to image and script loads**, never to the page (main_frame), frames, fetch or XHR (01 §4.4, run `v2b-a`; I re-read the server log myself). |
| GPC JavaScript signal (`navigator.globalPrivacyControl === true`) | **Yes** | MAIN-world content scripts at `document_start` work in all frames, including about:blank, srcdoc, blob: and data: (01 §3). They only run on sites the user has granted. macOS Safari 27 already exposes the property as `false`; iPadOS 27 does not expose it (02 §2.1). |
| Heuristic learner (`heuristics.js`) | **No** | `webRequest` never shows `Cookie` (0 of 860 events). `Set-Cookie` appears only in `onCompleted`. `initiator`/`documentUrl` are never set, so `isObservable()` is always false, and DNR cookie stripping does nothing (01 §0, §4.7). ITP already blocks third-party cookies by default, so the signal the learner counts barely exists (02 §3). |
| Fingerprint persona (`shim.js`, `shim-loader.js`, personas, `ua-*.json`) | **No** (scope) | Chrome personas must never appear in Safari. Phase 2 is decided separately (§5). |
| Price-disclosure scan (`pricing*.js`) | **No** (scope) | Not part of the agreed phase 1. |

## 1. What Safari 27 already does (so we neither rebuild it nor claim it)

| Protection | Normal browsing | Private Browsing / AFP "All Browsing" | Evidence |
|---|---|---|---|
| **GPC** | **Not sent** on macOS or iPadOS. No setting exists. WebKit has an opt-in API for host apps (default off) that Safari does not turn on | Not sent (iPad Private tab measured; macOS Private unverified) | 02 §2: 57 Safari requests, 0 with `Sec-GPC`; curl control shows the logger sees it |
| **ITP** | On: third-party cookies blocked, storage partitioned, 7-day script-storage cap, CNAME cookie cap | On | 02 §3 (docs). Measured: GA, GTM, Facebook, Hotjar and 4 beacons all **loaded**, so ITP limits cookies but **does not block requests** |
| **Advanced Fingerprinting Protection** | Off by default (default = Private Browsing). Measured: canvas/WebGL/audio identical across sites and reloads on both platforms | On: canvas/WebGL change per site **and per reload**, audio per read, screen clamped | 02 §4.2 |
| Known-fingerprinting-script limits (Safari 26+) | On, but only for scripts on Apple's list (217 hosts observed) | On | 02 §4.1, §4.3 |
| **Link tracking protection** | **Not applied** (full query arrived) | Strips `gclid fbclid msclkid dclid twclid igshid mc_eid yclid` and others. Keeps `utm_* ttclid _ga wbraid gbraid` | 02 §5 |
| Known-tracker request blocking | No | Apple docs say yes; **unverified** (the Simulator lacked the block list) | 02 §4.4 |
| iCloud Private Relay / Hide IP | Needs iCloud+. Not active for Safari on this Mac | — | 02 §6 |

**Copy rule that follows:** never claim IP hiding, cookie partitioning, the storage cap, CNAME defences or
private-mode fingerprint noise. Those are Apple's.

## 2. API support (what the Safari build can rely on)

| Capability | iOS 27 (measured) | macOS 27 | Ref |
|---|---|---|---|
| MV3 `service_worker`, `type: "module"` | Works. Suspended after ~30 s idle and restarted by alarms/messages. `storage.session` survives a restart | Docs: supported | 01 §3 |
| Static rulesets, `updateEnabledRulesets`, dynamic and session rules | Works | Docs: supported | 01 §3 |
| `updateStaticRules`, `getDisabledRuleIds`, `getAvailableStaticRuleCount`, `testMatchOutcome`, `onRuleMatchedDebug` | **Absent** (calling one throws `TypeError`) | WebKit IDL: absent | 01 §3 |
| `block` without website access | Works | WebKit: no gate | 01 §4.3 |
| `modifyHeaders` | Needs `declarativeNetRequestWithHostAccess` + access. Applies to **image/script only**. `remove Cookie` / `Set-Cookie`: no effect | Docs: needs host access | 01 §4.4 |
| `requestDomains`, `excludedRequestDomains`, `domainType`, `urlFilter`, `resourceTypes` | Work (`csp_report`, `object` silently dropped) | WebKit source | 01 §3 |
| `initiatorDomains` / `excludedInitiatorDomains` | Work, but in our test rig only matched with a host:port form. Real sites have no port. The port-less form is **unverified live** | WebKit source | 01 §3, §6 |
| Limits | 100 static rulesets, 50 enabled, 30,000 dynamic + session rules | Same in WebKit | 01 §3 |
| `getMatchedRules` | URLs + tabId, **no rule or ruleset id**, and it includes modifyHeaders matches, so it can't be used as a "blocked" count | — | 01 §4.9 |
| `webRequest` | Events fire, but no `Cookie`, no `initiator`. `extraHeaders` is ignored | Docs: cookies unsupported | 01 §4.7 |
| Content scripts: `document_start`, `world: "MAIN"`, `all_frames`, `match_about_blank`, `match_origin_as_fallback` | All work, **only on granted sites**. The converter's warning on these keys is stale | Docs (18.4) | 01 §1, §4.8 |
| `storage.local/session`, `alarms` (30 s minimum), `runtime.onMessage`, `getURL`, `scripting.executeScript` | Work | Docs: supported | 01 §3 |
| `userScripts` | Absent | Absent | 01 §3 |

## 3. Safari traps the phase-1 build must respect

1. **Website access gates everything except blocking.** With the extension enabled but no site granted, blocking
   works, while the GPC header, the GPC JavaScript signal and content scripts do nothing (01 §4.6). The container
   app's onboarding and the store copy must say plainly that GPC needs "Allow on every website" (or per-site
   grants). Blocking does not.
2. **The GPC header is partial.** Copy must not say "sends GPC on every request" in Safari. Accurate wording is
   along the lines of "sets the GPC signal for page scripts and adds the header to image and script requests;
   Safari does not let extensions add it to page loads". Worth reporting upstream to WebKit (owner's call; that
   would be outward-facing).
3. **An exclusion on one rule bleeds into later rules.** WebKit compiles each `excludedRequestDomains` entry into an
   `ignore-following-rules` rule. Rules are ordered by priority, then action type (allow > block > … >
   modifyHeaders), so an exclusion on one rule also exempts that host from every rule after it (measured, 01 §4.5).
   **Phase 1 is not exposed:** I checked Nullecho's four block lists and none of their 174 block rules (175 rules
   with the one allow rule) uses `excludedRequestDomains`, and the GPC rule sorts last. Any future Safari rule with an exclusion must be tested
   against this. The D50/D52 carve-outs would have broken the GPC rule here.
4. **`requestDomains` over-matches on the suffix side — measured in phase 1 (2026-10-02, iOS 27.0 Simulator,
   server log as ground truth).** WebKit compiles `requestDomains: [d]` without a `urlFilter` to `||d`, i.e.
   `^[^:]+://+([^:/]+\.)?d` with the dots escaped and no boundary after the host (01 §4.2): a rule for
   `sfx.lvh.m` blocked `sfx.lvh.me`, and a rule for `dot.x.lvh.me` blocked `dot.x.lvh.me.evil.lvh.me` (the
   `t.co` → `t.com` / `t.co.evil` shape). The "unescaped dot" half of the earlier reading was wrong: the same
   rule let `dotzx.lvh.me` through. 142 of Nullecho's 174 block rules use bare `requestDomains`, so the Safari
   rulesets are **generated** with one `||d^` filter per domain (`safari/tools/safari-rules.mjs`); measured
   with the same probes, `||d^` still blocks the host and its subdomains (with a `:port` after the host) and
   lets both over-match hosts through.
5. **Unimplemented calls:** `updateStaticRules` and `getDisabledRuleIds` (both used by `ext/src/background.js`) throw
   in Safari, and there's no rule id in `getMatchedRules`. The Safari build does not run `ext/src/background.js`
   (persona, learner and pricing wiring). It gets its own small worker, or none.
6. **The Simulator's extension toggle** only sticks if MobileSafari is terminated first (01 §4.6). That matters for
   test scripts, not for users.
7. **`updateEnabledRulesets` poisons the enabled set across a Safari relaunch — measured in phase 1 (2026-10-02,
   iOS 27.0 Simulator, test build with a reporting worker).** Six rulesets enabled by the manifest;
   `updateEnabledRulesets({enableRulesetIds: ["fingerprinting-strict"]})` → `getEnabledRulesets()` correctly listed
   all seven and the strict fixture host was blocked. Safari writes the change as a delta,
   `DeclarativeNetRequestRulesetState => {"fingerprinting-strict": true}`, into
   `Library/WebKit/com.apple.mobilesafari/WebExtensions/Default/<extension id>/State.plist`, and after a relaunch
   loads that map as the **whole** enabled set: the new worker's first `getEnabledRulesets()` returned
   `["fingerprinting-strict"]`, the tier-A fixture host loaded and no request carried `Sec-GPC`. After
   `disableRulesetIds: ["fingerprinting-strict"]` the map read `{… : false}` and the next launch enabled nothing.
   The file sits in Safari's container, so it **survived uninstalling and reinstalling the app**; the shipped
   build sent no header until the file was removed. Phase 1 makes no such call (no worker), so it is not exposed;
   any later toggle must pass the complete intended `enableRulesetIds` + `disableRulesetIds` on every call,
   re-assert them at worker start, and be re-measured across a relaunch before it ships.

## 4. Packaging and distribution

- The converter (`xcrun safari-web-extension-converter`, now a symlink to `safari-web-extension-packager`) produces
  iOS + macOS app targets and extension targets. **Both compile unsigned** (03 §1.6). Its "unsupported keys"
  warning (`match_origin_as_fallback`, `match_about_blank`, `type`, `world`) is contradicted by measurement (01 §1).
- The manifest needs to **add** `declarativeNetRequestWithHostAccess` and **drop** `webRequest`, the `ua-*` rulesets
  and the shim/pricing scripts. It **keeps** `<all_urls>` (needed for GPC) (03 §8).
- Distribution: App Store for iPhone/iPad, with the Mac in the same universal purchase (shared bundle id, as the
  template already has). On the Mac, a Developer ID–notarized app on GitHub Releases is also allowed (Safari 18.4+).
  App Store Connect's ZIP packager builds on Xcode Cloud and isn't reproducible, so the Xcode project stays in the
  repo (03 §2).
- Privacy label: **"Data Not Collected"** (nothing leaves the device). A privacy-policy URL is still required: the
  existing https://nullecho.org/privacy/ needs a Safari paragraph, and **a link inside the app** (5.1.1(i)). Set
  `ITSAppUsesNonExemptEncryption = NO`. An empty-declaration `PrivacyInfo.xcprivacy` is cheap insurance (03 §5).
- Review risks, highest first: 4.4.2 (host-access scope, honest claims) > 4.2 (an instruction-only container; this
  is Apple's own template and we found no public rejection) > 2.3.1/2.3.7 (privacy marketing, naming) > 5.1.1(i) >
  2.4.1 (iPad; Apple reviews on iPad) (03 §4).
- Native Content Blocker type: it can't set headers or run JavaScript, so GPC forces the web-extension route.
  Blocking through DNR compiles into the same engine anyway. It could be an optional later "zero-access" mode
  (03 §7).

## 5. Phase 2 (persona): evidence so far, decision deferred

In normal browsing Safari adds no noise for unlisted scripts and reports true screen metrics. `hardwareConcurrency`
is already capped at 8. With AFP on (Private Browsing, or All Browsing by opt-in), Safari randomizes canvas/WebGL
per site and per reload below the JS layer, which is stronger than an extension and would be fought by a
per-site-stable persona (02 §4.2, §8). A WebKit persona could only add value in normal browsing, and would have to
detect AFP and stand down. That decision needs its own measurement (an AFP detector, and whether a Safari persona can
be self-consistent per D11). It will be written into `docs/DECISIONS.md` on this branch when made.

## 6. Unverified, and what unblocks it

| Item | Unblocked by |
|---|---|
| Any extension behaviour in **macOS** Safari 27 (all API rows are iOS-measured) | Owner: Safari ▸ Settings ▸ Advanced ▸ "Show features for web developers", then Settings ▸ Developer ▸ "Allow unsigned extensions" (Safari asks for the Mac password; resets when Safari quits) ▸ "Add Temporary Extension…". Done once, for the probe and the phase-1 build together |
| macOS Private Browsing GPC/AFP | Owner opens one Private window to a local probe URL (02 §9). Low priority: iPad Private already measured no GPC |
| ~~`requestDomains` over-match (§3.4)~~ | Measured in phase 1 (§3.4): real on the suffix side, fixed by generating `‖d^` filters |
| Port-less `initiatorDomains` | Phase-1 test, or a port-80/443 fixture |
| Known-tracker blocking in Private Browsing on real hardware | Owner check on a real device (02 §9). Matters only for copy |
| Container app review outcome | Only App Review can answer it |
