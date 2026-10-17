/**
 * Chrome's own network log for harness/blocking-proof.html, and the check that every row the page
 * reports agrees with it. Used by harness/blocking-proof-check.mjs and harness/social/make-social-assets.mjs.
 *
 *   const net = await recordNetwork(page);                  // before page.goto
 *   ... click #run, wait for window.__proofDone ...
 *   const rows = compare((await page.evaluate(() => window.__proofDone)).rows, net.entries(),
 *                        { blockedBy: 'net::ERR_BLOCKED_BY_CLIENT' });   // ON runs: attribute blocks
 *   const bad = rows.filter((r) => !r.agree);
 *
 * WHY. On 2026-10-07, recording the demo video, the page called the cdn.jsdelivr.net control
 * "loaded" in both runs while Chrome logged that request as net::ERR_ABORTED. The control was a
 * no-cors fetch of a JSON file; Chrome's Opaque Response Blocking withheld the body and resolved
 * the fetch with an empty response anyway (with --enable-features=
 * OpaqueResponseBlockingErrorsForAllFetches the same request fails as net::ERR_BLOCKED_BY_ORB).
 * Nothing compared the page's word with the browser's, so "3/3 controls loaded" went into a video.
 * The page's own disclosure says it cannot see everything; this is the check that can.
 *
 * AGREEMENT — what the page claims → what the log must show for that URL (its last request):
 *   control loaded, unexpected   a 2xx response, then loadingFinished: the bytes arrived (whether they
 *                                were the right file is the page's check; the log cannot see content)
 *   control http-<n>             a response with status n
 *   control cancelled            loadingFailed, with or without a response first (a CORS failure comes
 *                                after the response)
 *   tracker loaded               a response, any status: the host answered. ORB may still abort an
 *                                opaque body afterwards; the request left the machine either way
 *   tracker cancelled            loadingFailed and NO response; with `blockedBy`, that exact error text
 *   timeout (either kind)        no response for a tracker (no-cors resolves on headers), no
 *                                loadingFinished for a control (the page's abort logs as ERR_ABORTED)
 * A row whose URL is not in the log at all disagrees too. CORS preflights are not rows and are skipped.
 */

/** Start recording Chrome's network log for `page` (a puppeteer Page). Call before navigating. */
export async function recordNetwork(page) {
  const cdp = await page.createCDPSession();
  const byId = new Map();
  const list = [];
  cdp.on('Network.requestWillBeSent', (e) => {
    const prior = byId.get(e.requestId);
    if (prior && e.redirectResponse) {                         // a redirect continues the same request
      prior.redirects.push({ status: e.redirectResponse.status, to: e.request.url });
      return;
    }
    const entry = { url: e.request.url, method: e.request.method, type: e.type || null,
      response: null, finished: null, failed: null, redirects: [] };
    byId.set(e.requestId, entry);
    list.push(entry);
  });
  cdp.on('Network.responseReceived', (e) => {
    const x = byId.get(e.requestId);
    if (x) x.response = { status: e.response.status, mimeType: e.response.mimeType };
  });
  cdp.on('Network.loadingFinished', (e) => {
    const x = byId.get(e.requestId);
    if (x) x.finished = { bytes: e.encodedDataLength };
  });
  cdp.on('Network.loadingFailed', (e) => {
    const x = byId.get(e.requestId);
    if (x) x.failed = { errorText: e.errorText, canceled: !!e.canceled, blockedReason: e.blockedReason || null,
      corsError: (e.corsErrorStatus && e.corsErrorStatus.corsError) || null };
  });
  await cdp.send('Network.enable');
  return {
    entries: () => list.filter((x) => x.method !== 'OPTIONS' && x.type !== 'Preflight').map((x) => ({ ...x })),
    detach: () => cdp.detach().catch(() => {}),
  };
}

const href = (u) => { try { return new URL(u).href; } catch { return u; } };
const host = (u) => { try { return new URL(u).host; } catch { return u; } };

/** Chrome's outcome for one request, in DevTools' words. */
export function describe(e) {
  if (!e) return 'not in the log';
  const r = e.response;
  const f = e.failed;
  const err = f ? f.errorText + (f.corsError ? ` (CORS ${f.corsError})` : f.blockedReason ? ` (${f.blockedReason})` : '') : '';
  if (r && f) return `${r.status}, then failed ${err}`;
  if (f) return `failed ${err}`;
  if (r && e.finished) return `${r.status}, finished (${e.finished.bytes} B)`;
  if (r) return `${r.status}, still loading`;
  return 'no response yet';
}

/** Why the page's `state` for a row of `kind` disagrees with log entry `e`, or null if it agrees. */
function disagreement(kind, state, e, blockedBy) {
  if (!e) return 'the page reports a result for a request Chrome never logged';
  const answered = !!e.response;
  const ok2xx = answered && e.response.status >= 200 && e.response.status < 300;
  const finished = !!e.finished && !e.failed;
  if (kind === 'control') {
    if (state === 'loaded' || state === 'unexpected') {
      return ok2xx && finished ? null : 'the page says this file arrived, but Chrome did not finish a 2xx load of it';
    }
    const http = /^http-(\d+)$/.exec(state);
    if (http) return answered && e.response.status === Number(http[1]) ? null : `the page saw HTTP ${http[1]}; Chrome did not`;
    if (state === 'cancelled') return e.failed ? null : 'the page says this failed; Chrome logged no failure';
    if (state === 'timeout') return finished ? 'the page timed out on a load Chrome finished' : null;
    return `unknown control state "${state}"`;
  }
  if (kind === 'tracker') {
    if (state === 'loaded') return answered ? null : 'the page says the host answered; Chrome logged no response';
    if (state === 'cancelled') {
      if (answered) return `the page says blocked, but the host answered (${e.response.status})`;
      if (!e.failed) return 'the page says blocked; Chrome logged no failure';
      if (blockedBy && e.failed.errorText !== blockedBy) return `failed, but not with ${blockedBy}: not attributable to the extension`;
      return null;
    }
    if (state === 'timeout') return answered ? 'the page timed out, but the host answered' : null;
    return `unknown tracker state "${state}"`;
  }
  return `unknown row kind "${kind}"`;
}

/**
 * One result per page row: { kind, category, host, url, page, chrome, agree, why }.
 * `rows` is window.__proofDone.rows; `entries` is recordNetwork(page).entries(). When the page has
 * run more than once, a URL's LAST request is the one compared.
 */
export function compare(rows, entries, { blockedBy = null } = {}) {
  return rows.map((r) => {
    const want = href(r.url);
    const hits = entries.filter((e) => href(e.url) === want);
    const e = hits[hits.length - 1] || null;
    const why = disagreement(r.kind, r.state, e, blockedBy);
    return { kind: r.kind, category: r.category, host: host(r.url), url: r.url, page: r.state, chrome: describe(e), agree: why === null, why };
  });
}

/** The comparison as aligned text lines, for a console. */
export function formatComparison(results) {
  return results.map((r) => `  ${r.agree ? '✓' : '✗'} ${r.kind.padEnd(8)} ${r.host.padEnd(31)} page: ${r.page.padEnd(10)} chrome: ${r.chrome}` +
    (r.agree ? '' : `\n      DISAGREES — ${r.why}`));
}
