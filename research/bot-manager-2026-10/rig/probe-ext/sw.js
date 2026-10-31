globalThis.LOG = [];
const names = (hs) => (hs || []).filter((h) => h.name.toLowerCase() === 'set-cookie')
  .flatMap((h) => String(h.value).split('\n')).map((v) => v.split(';')[0].split('=')[0].trim());
const host = (u) => { try { return new URL(u).hostname; } catch { return String(u).slice(0, 40); } };
const pth = (u) => { try { return new URL(u).pathname.slice(0, 40); } catch { return ''; } };
const rec = (which) => (d) => {
  LOG.push({ t: Date.now(), which, type: d.type, frameId: d.frameId, tabId: d.tabId, url: host(d.url), path: pth(d.url),
    initiator: d.initiator || null, status: d.statusCode, sc: names(d.responseHeaders) });
};
chrome.webRequest.onHeadersReceived.addListener(rec('hdr'), { urls: ['<all_urls>'] }, ['responseHeaders']);
chrome.webRequest.onHeadersReceived.addListener(rec('hdr+extra'), { urls: ['<all_urls>'] }, ['responseHeaders', 'extraHeaders']);
chrome.webRequest.onResponseStarted.addListener(rec('started'), { urls: ['<all_urls>'], types: ['main_frame'] }, ['responseHeaders']);
chrome.runtime.onMessage.addListener((m, s, r) => {
  const seen = LOG.some((e) => e.which === 'hdr+extra' && e.type === 'main_frame' && e.tabId === s.tab?.id && e.url === host(s.url));
  LOG.push({ t: Date.now(), which: 'cs', frameId: s.frameId, url: host(s.url), sentAt: m.at, top: m.top, seenMainFrameHdr: seen });
  r({ ok: true, seen });
});
