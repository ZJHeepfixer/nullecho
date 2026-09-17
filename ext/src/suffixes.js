/**
 * Nullecho — the ONE multi-label public-suffix table (DECISIONS.md D23).
 *
 * Both layers key a site by its registrable domain (eTLD+1): the service worker
 * for the salted persona and the per-site allowlist (`background.js siteKeyFor`,
 * via `heuristics.js`), and `shim.js` for the stage-1 fallback persona a page
 * is locked to when it reads a shimmed API before the handshake lands. If the
 * two disagree, the "upgrade" is a different machine — and until 2026-09-16 they
 * disagreed on 41 entries (review A4d): the worker keyed every *.myshopify.com
 * store as ONE site (one persona for ~5M storefronts; allowlisting one store
 * stood the whole platform down — A4a/A4b), while the shim lacked co.il, co.id,
 * com.ua, com.pl and more, collapsing whole national TLDs into one fallback
 * persona (A4c).
 *
 * Chrome exposes no Public Suffix List to extensions and shipping the real one
 * is ~230 KB this layer does not need to be exact about. This is the pragmatic
 * subset: the common two-label ccTLD suffixes, plus the app-hosting / platform
 * suffixes where treating the whole platform as one party would be badly wrong
 * (every *.vercel.app, *.github.io, *.myshopify.com, *.wordpress.com is a
 * different publisher). Every entry is in the real PSL (ICANN or private
 * section). Getting an entry wrong over- or under-merges two domains.
 *
 * MV3 content scripts cannot import, so `shim.js` carries a GENERATED SUFFIX
 * MIRROR of this file. Edit HERE, then run `node tools/gen-suffix-mirror.mjs`;
 * `review-2026-09-16.test.js` (A4d) fails on any drift, and pins the shim's
 * copy of `registrableDomain` to this one on a corpus built from the table.
 *
 * Keep the list SORTED — the drift test insists, so diffs stay readable.
 */
export const MULTI_LABEL_SUFFIXES = Object.freeze([
  'ac.in', 'ac.jp', 'ac.nz', 'ac.uk', 'ad.jp', 'appspot.com', 'azureedge.net',
  'azurewebsites.net', 'blogspot.com', 'cloudfront.net', 'co.id', 'co.il', 'co.in', 'co.jp',
  'co.kr', 'co.nz', 'co.th', 'co.uk', 'co.za', 'com.ar', 'com.au', 'com.bd', 'com.br', 'com.cn',
  'com.co', 'com.ec', 'com.eg', 'com.es', 'com.hk', 'com.mx', 'com.my', 'com.ng', 'com.pe',
  'com.ph', 'com.pk', 'com.pl', 'com.ru', 'com.sa', 'com.sg', 'com.tr', 'com.tw', 'com.ua',
  'com.uy', 'com.ve', 'com.vn', 'edu.au', 'edu.cn', 'firebaseapp.com', 'firm.in', 'fly.dev',
  'gen.in', 'github.io', 'gitlab.io', 'glitch.me', 'go.jp', 'go.kr', 'gob.es', 'gob.mx',
  'gov.au', 'gov.br', 'gov.cn', 'gov.in', 'gov.uk', 'gov.za', 'govt.nz', 'herokuapp.com',
  'id.au', 'ltd.uk', 'me.uk', 'myshopify.com', 'ne.jp', 'neocities.org', 'net.au', 'net.br',
  'net.cn', 'net.in', 'net.nz', 'net.uk', 'net.za', 'netlify.app', 'onrender.com', 'or.jp',
  'or.kr', 'org.au', 'org.br', 'org.cn', 'org.es', 'org.in', 'org.nz', 'org.uk', 'org.za',
  'pages.dev', 'plc.uk', 'r2.dev', 'repl.co', 's3.amazonaws.com', 'sch.uk', 'surge.sh',
  'translate.goog', 'tumblr.com', 'vercel.app', 'web.app', 'wordpress.com', 'workers.dev',
]);

const SUFFIX_SET = new Set(MULTI_LABEL_SUFFIXES);

/**
 * Registrable domain (eTLD+1) for a hostname. IP literals (v4, or anything with
 * a colon — bracketed or bare v6), `localhost` and other single labels are
 * returned as-is; a trailing dot is dropped; case is folded.
 *
 * ⚠ Plain JS on purpose: the shim's mirror is this function's source, verbatim
 * (`SUFFIX_SET` → `MULTI_LABEL_SUFFIXES`), running at boot before any page
 * script, in the region the D21 lint exempts. No captured builtins here.
 */
export function registrableDomain(hostname) {
  if (!hostname) return '';
  const host = String(hostname).toLowerCase().replace(/\.$/, '');
  if (host.indexOf(':') >= 0 || /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.indexOf('.') < 0) return host;
  const parts = host.split('.');
  if (parts.length <= 2) return host;
  const lastTwo = parts.slice(-2).join('.');
  const lastThree = parts.slice(-3).join('.');
  if (SUFFIX_SET.has(lastThree)) return parts.slice(-4).join('.');
  if (SUFFIX_SET.has(lastTwo)) return lastThree;
  return lastTwo;
}
