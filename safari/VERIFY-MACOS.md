# Nullecho for Safari — macOS verification (owner's step, ~10 minutes)

Everything in the phase-1 report was measured in Safari on the **iOS 27 Simulator**. Nothing has been
measured in **macOS Safari 27** yet, because loading an unsigned extension there asks for your Mac
password, which is your step and nobody else's. This page is the whole sitting: five clicks in Safari,
two local pages, and a one-line summary command that says pass or fail from the server log.

Nothing here touches the network beyond `harness/blocking-proof.html`, which fetches real tracker
*library* files (never beacons) to prove they are cancelled — read its disclosure box.

## 0. Before you start (one terminal, from the repo root)

```sh
node safari/tools/build-extension.mjs --zip        # → dist/safari/extension/ and dist/nullecho-<version>-safari.zip
node --test safari/test/*.test.mjs                 # must be all green
python3 safari/tools/verify-server.py              # leave it running; it prints the two URLs
```

The server listens on the loopback interface only (port 47301; `--port` if taken). `*.lvh.me` is public
wildcard DNS for the loopback address, so `a.lvh.me` and `b.lvh.me` are two origins on this one server
without touching `/etc/hosts`. Logs go to `dist/safari/verify/` (gitignored).

## 1. Load the extension (Safari asks for your password once)

1. Safari ▸ Settings ▸ **Advanced** ▸ tick **Show features for web developers**.
2. Safari ▸ Settings ▸ **Developer** ▸ tick **Allow unsigned extensions** — Safari asks for your Mac
   password. This resets when Safari quits (Apple's documented behaviour), so do the rest in one go.
3. Same Developer tab ▸ **Add Temporary Extension…** ▸ choose the folder `dist/safari/extension`
   (or the zip). "Nullecho" appears in Settings ▸ **Extensions**; tick it.
4. Still in Settings ▸ Extensions ▸ Nullecho: under *Permissions*, set website access to
   **Allow on Every Website** (or Settings ▸ **Websites** ▸ Nullecho ▸ *Other websites* ▸ **Allow**).
   Blocking works without this; Global Privacy Control does not (safari/CAPABILITY-AUDIT.md §3.1).

## 2. Run the two pages

Open each in a normal (not Private) window and leave the tab in front while it works.

| Step | URL | Wait | What pass looks like |
|---|---|---|---|
| A | `http://a.lvh.me:47301/page?run=mac-on` | ~8 s, until the page prints `DONE` | the `gpc_top`, `gpc_frame_*`, `gpc_child_*` lines all say `"value": true` |
| B | `http://a.lvh.me:47301/blocking-proof.html` ▸ **Run the test** | ~10 s | verdict **BLOCKING PROVEN** (6/6 trackers cancelled, 3/3 controls loaded). The page will prefix it with "NOT AUTHORITATIVE": its engine gate only knows Chrome; in Safari read the rows, and keep a screenshot |
| C (negative control) | Settings ▸ Extensions ▸ **untick Nullecho**, reload A as `…?run=mac-off`, reload B and run it again | — | A: every GPC value `false` (macOS ships the property natively, as `false`); B: **BLOCKING IS NOT HAPPENING**, all trackers loaded |

Then, back in the terminal:

```sh
python3 safari/tools/verify-server.py --summary mac-on
python3 safari/tools/verify-server.py --summary mac-off
```

`mac-on` must print **PASS** on every row. `mac-off` prints the same table; there every `want` is
the opposite (headers absent, JS `false`) — the line-by-line `got` values are the record. The summary
reads the **server log**, not the page: a header "sent" is one the server received.

Expected on macOS, from the iOS measurement and the audit:

- `Sec-GPC: 1` on the **image and script** rows, absent on fetch, XHR and the document. That is
  Safari's `modifyHeaders` scope (audit 01 §4.4), not a Nullecho bug.
- `navigator.globalPrivacyControl === true` in the top frame from its first inline script, in the
  cross-origin frame, the srcdoc frame, the about:blank frame and the same-tick child realm; the
  getter is named `get globalPrivacyControl`. On macOS the browser's own property reads `false`
  natively, so `true` proves the override took.
- If the **same-tick child realm** row alone fails on macOS, that is new information (it passed on
  iOS: Safari injects content scripts into a freshly inserted about:blank frame synchronously).
  Record it; it is a documented limit, not a blocker.

## 3. Two optional checks (two more minutes)

- **Exception mechanism, real host (D17).** With Nullecho ticked, open `https://open.spotify.com`,
  then Develop ▸ Show Web Inspector ▸ Console: `navigator.globalPrivacyControl` must be **`false`**
  (Nullecho ships GPC off there; macOS's native value shows through). On `https://example.org` it
  must be **`true`**. Network tab on Spotify: image requests carry no `Sec-GPC`.
- **Strict tier absent.** Web Inspector on the extension's background has nothing to inspect (there
  is no worker). Instead, Settings ▸ Extensions ▸ Nullecho shows no toggle for anti-fraud blocking,
  and `dist/safari/extension/manifest.json` registers `fingerprinting-strict` with `"enabled": false`.
  A bank sign-in page that uses ThreatMetrix (`online-metrix.net`) loading normally is the behavioural
  version.

## 4. Afterwards

Untick **Allow unsigned extensions** (or quit Safari), stop the server (Ctrl-C), and paste the two
summaries plus the blocking-proof screenshot into the review thread. If anything printed FAIL, copy
the whole `--summary` output and the matching lines of `dist/safari/verify/requests.jsonl`.
