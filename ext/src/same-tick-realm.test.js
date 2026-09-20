/**
 * Nullecho — the SAME-TICK child realm (D35)
 * ═══════════════════════════════════════════
 * Companion to docs/DECISIONS.md D35 and docs/CLAIM-VERIFICATION-2026-09-17.md §3c.
 *
 * THE DEFECT. A child browsing context is created SYNCHRONOUSLY, inside the native
 * insertion call that connects the `<iframe>` element. The shim reached those
 * realms two ways, and both were a tick late or a property short:
 *
 *   · `HTMLIFrameElement.prototype.contentWindow` — hooked, but a page that never
 *     reads `contentWindow` never triggers it.
 *   · a `MutationObserver` on the document — fires at the NEXT microtask
 *     checkpoint, which is after the inserting script's synchronous block.
 *
 * `window[n]` / `window.frames[n]` reach the same realm without touching
 * `contentWindow`, and an indexed property on a WindowProxy is not hookable. So
 *
 *     const n = self.length;
 *     document.body.appendChild(fragmentContainingAnIframe);
 *     const w = self[n];          // ← PRISTINE. Real cores, real everything.
 *
 * is a complete bypass of the whole shim, in one synchronous block, and it is
 * exactly what CreepJS does (`harness/vendor/creepjs-2026-06-11.js` →
 * `getPhantomIframe()`): DocumentFragment → `div.innerHTML` with an `<iframe>` →
 * `document.body.appendChild(frag)` → `self[numberOfIframes]`. Everything CreepJS
 * then measures is measured in that realm, including a pristine
 * `Function.prototype.toString` that prints the shim's ACTUAL SOURCE for every
 * function it patched in the parent — §3c's `hasToStringProxy`, the ~197
 * "failed toString" records and the `webDriverIsOn` bot verdict.
 *
 * THE FIX (D35). Wrap the insertion entry points themselves and install into
 * every reachable frame BEFORE the original's result is returned — so the realm is
 * already patched by the time the inserting expression finishes evaluating.
 *
 * THE RIG. Two or more real `node:vm` contexts. The parent's fake DOM models the
 * one thing that matters: connecting an `<iframe>` to the document tree pulls a
 * fresh realm out of a pool, registers it in `window.length` and defines
 * `window[i]` — synchronously, inside the insertion call, as a browser does.
 * Moving a connected `<iframe>` destroys its context and creates a NEW one, which
 * is what Chrome does and what makes a "did `length` grow?" test unsound.
 *
 * ⚠ The rig's `MutationObserver` NEVER FIRES. That is deliberate and it is what
 * makes every green assertion below a statement about the SAME TICK: if a child
 * realm reads as patched here, nothing but a synchronous install can have done it.
 *
 * NAVIGATION (D42). What `window[i]` / `contentWindow` hand out is a WINDOWPROXY:
 * an object whose identity survives navigation while the Window (realm) behind it
 * is replaced. The rig hands out exactly that — a `Proxy` forwarding to whichever
 * realm is current — and `__navigate(iframe)` swaps the realm behind it and fires
 * the element's `load` event along the real path (document → … → element,
 * capture then target; a load's path never includes the window). A navigation is a separate task in a browser, so
 * `__navigate` calls no DOM method: the only thing the parent hears is `load`.
 * Keying "already installed" on that proxy is the defect D42 closes.
 *
 * Run: `node --test` from `ext/`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import v8 from 'node:v8';
import { webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHIM_SRC = fs.readFileSync(path.join(HERE, 'shim.js'), 'utf8');

/** What the un-shimmed machine says. Seeing this in a child realm is the bypass. */
const REAL_UA = 'Mozilla/5.0 (REAL MACHINE — the thing we are hiding)';
const REAL_CORES = 12;

const DELIVERED = {
  id: 'macos-chrome-m1-pro', platform: 'MacIntel',
  ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
  uaData: { platform: 'macOS', platformVersion: '14.6.0', architecture: 'arm', bitness: '64', model: '', wow64: false },
  gpu: { vendor: 'Google Inc. (Apple)', renderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Pro, Unspecified Version)', unmaskedVendor: 'Google Inc. (Apple)', maxTextureSize: 16384 },
  cores: 8, memory: 16,
  screen: { width: 1728, height: 1117, availHeight: 1079, colorDepth: 30, dpr: 2 },
  fontList: ['Helvetica', 'Arial'], noise: { canvas: 0.25, audio: 0.5, webgl: 0.75 }, seed: 0x1234abcd,
};
const RIG_TOKENS = Array.from({ length: 32 }, (_, i) => `rigtoken${String(i).padStart(8, '0')}`);

/**
 * A realm with just enough DOM to connect an iframe.
 *
 * `window.length` lives on `Window.prototype`, not on the global object, because
 * that is where a `[Replaceable]` WebIDL attribute of the `Window` interface goes
 * — so the shim has to walk the prototype chain to capture its getter, and this
 * rig fails if it only looks for an own descriptor.
 */
const DOM_SETUP = `
(() => {
  const slots = new WeakMap();
  // \`o\` may be a WindowProxy (D42): listeners and frame slots belong to the
  // Window BEHIND it, exactly as in a browser.
  const slot = (o) => { o = __proxyInner(o); let s = slots.get(o); if (!s) { s = { children: [], parent: null }; slots.set(o, s); } return s; };
  const brand = (self, C) => { if (!(self instanceof C)) throw new TypeError('Illegal invocation'); };
  const ro = (C, name, read) => Object.defineProperty(C.prototype, name, {
    get() { brand(this, C); return read(this); }, configurable: true, enumerable: true,
  });
  /**
   * A read/write accessor whose functions are named the way a native one's are
   * ("get innerHTML" / "set innerHTML") — getter/setter shorthand on a computed
   * key, which is also the only form with a native's SHAPE (D32). Object-literal
   * \`set(v) {}\` would be named "set", and the name guard below would then be
   * measuring the rig instead of the shim.
   */
  const rw = (C, name, read, write) => {
    const holder = { get [name]() { brand(this, C); return read(this); }, set [name](v) { brand(this, C); write(this, v); } };
    const d = Object.getOwnPropertyDescriptor(holder, name);
    Object.defineProperty(C.prototype, name, { get: d.get, set: d.set, configurable: true, enumerable: true });
  };

  // ── events ───────────────────────────────────────────────────────────────
  class EventTarget {
    addEventListener(type, fn, capture) { const s = slot(this); (s.ls || (s.ls = [])).push({ type, fn, capture: !!capture }); }
    removeEventListener() {}
    dispatchEvent(ev) {
      for (const node of [globalThis, globalThis.document]) {
        if (!node) continue;
        const ls = (slots.get(node) || {}).ls || [];
        for (const l of ls.slice()) {
          if (l.type !== ev.type) continue;
          if (node === globalThis && !l.capture) continue;
          l.fn.call(node, ev);
        }
      }
      return true;
    }
  }
  class Event { constructor(type) { this.type = type; } stopPropagation() {} stopImmediatePropagation() {} }
  class CustomEvent extends Event { constructor(type, init) { super(type); this._detail = init ? init.detail : undefined; } }
  Object.defineProperty(CustomEvent.prototype, 'detail', { get() { return this._detail; }, configurable: true });

  // ── navigator: the two fields §3c reads out of a pristine realm ──────────
  class Navigator {}
  ro(Navigator, 'userAgent', () => ${JSON.stringify(REAL_UA)});
  ro(Navigator, 'appVersion', () => '5.0 (Macintosh)');
  ro(Navigator, 'platform', () => 'MacIntel');
  ro(Navigator, 'hardwareConcurrency', () => ${REAL_CORES});
  ro(Navigator, 'deviceMemory', () => 64);
  ro(Navigator, 'webdriver', () => false);
  const navigator = Object.create(Navigator.prototype);

  // ── the frame registry: what window.length and window[i] are made of ─────
  const frames = [];            // DOCUMENT-TREE child navigables, in insertion order
  const shadowFrames = [];      // child navigables inside a shadow tree (see D35)
  globalThis.__frames = frames;
  globalThis.__shadowFrames = shadowFrames;
  globalThis.__realmPool = [];  // filled from the Node side before the shim boots
  globalThis.__openPool = [];
  globalThis.__observerFired = 0;
  globalThis.__observed = 0;
  globalThis.__realmsTaken = 0;

  const MAX_INDEX = 64;
  const reindex = () => {
    for (let i = 0; i < MAX_INDEX; i++) { try { delete globalThis[i]; } catch (_) {} }
    for (let i = 0; i < frames.length; i++) {
      Object.defineProperty(globalThis, i, { value: frames[i], configurable: true, enumerable: true, writable: false });
    }
  };

  class Window extends EventTarget {}
  Object.defineProperty(Window.prototype, 'length', {
    get() { return frames.length; }, configurable: true, enumerable: true,
  });
  Object.defineProperty(Window.prototype, 'frames', {
    get() { return globalThis; }, configurable: true, enumerable: true,
  });
  Object.defineProperty(Window.prototype, 'self', {
    get() { return globalThis; }, configurable: true, enumerable: true,
  });
  Object.defineProperty(Window.prototype, 'open', {
    value: function open(url, name, features) { return globalThis.__openPool.shift() || null; },
    writable: true, enumerable: false, configurable: true,
  });
  Object.setPrototypeOf(globalThis, Window.prototype);

  // ── the tree ─────────────────────────────────────────────────────────────
  const rootOf = (n) => { let c = n; for (;;) { const p = slot(c).parent || slot(c).host; if (!p) return c; c = p; } };
  const connected = (n) => rootOf(n) === globalThis.document;
  const inShadow = (n) => { let c = n; while (c) { if (c instanceof ShadowRoot) return true; c = slot(c).parent || slot(c).host; } return false; };
  const walk = (n, fn) => { fn(n); const c = slot(n).children; for (let i = 0; i < c.length; i++) walk(c[i], fn); if (slot(n).shadow) walk(slot(n).shadow, fn); };

  const takeRealm = () => {
    const w = globalThis.__realmPool.shift();
    if (!w) throw new Error('rig: realm pool exhausted — construct the rig with more child realms');
    globalThis.__realmsTaken++;
    return w;
  };
  /** Connecting an <iframe> creates its browsing context synchronously. */
  const createContext = (el) => {
    const w = takeRealm();
    slot(el).win = w;
    (inShadow(el) ? shadowFrames : frames).push(w);
    reindex();
  };
  /** Disconnecting destroys it. A MOVE is a destroy + create: a brand-new realm. */
  const destroyContext = (el) => {
    const w = slot(el).win;
    slot(el).win = null;
    for (const list of [frames, shadowFrames]) {
      const i = list.indexOf(w);
      if (i >= 0) list.splice(i, 1);
    }
    reindex();
  };
  const attach = (n) => walk(n, (x) => { if (x instanceof HTMLIFrameElement && !slot(x).win) createContext(x); });
  const detach = (n) => walk(n, (x) => { if (x instanceof HTMLIFrameElement && slot(x).win) destroyContext(x); });

  /**
   * NAVIGATION (D42). The WindowProxy at window[i] / contentWindow survives; the
   * Window behind it is replaced by a brand-new realm — or, with \`to\`, by a
   * cross-origin stand-in whose \`document\` throws. A navigation is a separate
   * task in a browser, so nothing here calls a DOM method the shim could have
   * wrapped; the only thing the parent hears is the iframe's \`load\` event,
   * dispatched along the real path: document → … → element, capture listeners
   * first, then the target's own (capture before bubble, as Chrome ≥ 89).
   * \`load\` does not bubble — and its path STOPS AT THE DOCUMENT: per the DOM
   * spec a Document's "get the parent" returns null for a load event, so a
   * capture listener on the WINDOW never hears an iframe load. Measured in real
   * Chrome 151 before this line was written: a window-capture door saw nothing
   * and the page's own handler read the host's cores.
   */
  const listenersOf = (node) => (slots.get(__proxyInner(node)) || {}).ls || [];
  const fireLoad = (el) => {
    const ev = new Event('load'); ev.target = el;
    const path = []; let c = el;
    while (c) { path.unshift(c); c = slot(c).parent || slot(c).host || null; }
    for (let i = 0; i < path.length - 1; i++) {
      for (const l of listenersOf(path[i]).slice()) if (l.type === 'load' && l.capture) l.fn.call(path[i], ev);
    }
    const own = listenersOf(el).slice();
    for (const l of own) if (l.type === 'load' && l.capture) l.fn.call(el, ev);
    for (const l of own) if (l.type === 'load' && !l.capture) l.fn.call(el, ev);
    if (typeof el.onload === 'function') el.onload.call(el, ev);
  };
  const navigate = (el, opts) => {
    opts = opts || {};
    const p = slot(el).win;
    if (!p) throw new Error('rig: navigate() on an iframe with no browsing context');
    __swapRealm(p, opts.to !== undefined ? opts.to : takeRealm());
    if (opts.load !== false) fireLoad(el);
    return p;
  };
  globalThis.__navigate = navigate;
  globalThis.__fireLoad = fireLoad;

  const unlink = (n) => {
    const p = slot(n).parent;
    if (!p) return;
    const was = connected(n);
    const c = slot(p).children;
    const i = c.indexOf(n);
    if (i >= 0) c.splice(i, 1);
    slot(n).parent = null;
    if (was) detach(n);
  };
  /** The one primitive every entry point below routes through. */
  const place = (parent, node, ref) => {
    if (node instanceof DocumentFragment) {
      for (const k of slot(node).children.slice()) place(parent, k, ref);
      return node;
    }
    unlink(node);
    const c = slot(parent).children;
    const at = ref ? c.indexOf(ref) : -1;
    if (at < 0) c.push(node); else c.splice(at, 0, node);
    slot(node).parent = parent;
    if (connected(parent)) attach(node);
    return node;
  };
  const nextSibling = (n) => { const p = slot(n).parent; if (!p) return null; const c = slot(p).children; return c[c.indexOf(n) + 1] || null; };
  const clear = (n) => { for (const k of slot(n).children.slice()) unlink(k); };

  /**
   * A parser only as clever as it has to be: N <iframe> tags become N iframe
   * elements inside one wrapper div, which is CreepJS's exact markup shape.
   */
  const parseHTML = (html) => {
    const frag = new DocumentFragment();
    const n = (String(html).match(/<iframe/gi) || []).length;
    const box = new HTMLElement(); slot(box).tag = 'DIV';
    for (let i = 0; i < n; i++) place(box, new HTMLIFrameElement(), null);
    place(frag, box, null);
    return frag;
  };

  class Node extends EventTarget {
    appendChild(n) { brand(this, Node); return place(this, n, null); }
    insertBefore(n, ref) { brand(this, Node); return place(this, n, ref || null); }
    replaceChild(n, old) { brand(this, Node); const ref = nextSibling(old); unlink(old); place(this, n, ref); return old; }
    removeChild(n) { brand(this, Node); unlink(n); return n; }
  }
  ro(Node, 'nodeType', (o) => slot(o).nodeType || 1);
  ro(Node, 'isConnected', (o) => connected(o));
  ro(Node, 'parentElement', (o) => slot(o).parent || null);
  ro(Node, 'textContent', (o) => slot(o).text || '');
  ro(Node, 'childNodes', (o) => slot(o).children.slice());

  class Element extends Node {
    append(...ns) { brand(this, Element); for (const n of ns) place(this, n, null); }
    prepend(...ns) { brand(this, Element); const first = slot(this).children[0] || null; for (const n of ns) place(this, n, first); }
    replaceChildren(...ns) { brand(this, Element); clear(this); for (const n of ns) place(this, n, null); }
    after(...ns) { brand(this, Element); const p = slot(this).parent; if (!p) return; const ref = nextSibling(this); for (const n of ns) place(p, n, ref); }
    before(...ns) { brand(this, Element); const p = slot(this).parent; if (!p) return; for (const n of ns) place(p, n, this); }
    replaceWith(...ns) { brand(this, Element); const p = slot(this).parent; if (!p) return; const ref = nextSibling(this); unlink(this); for (const n of ns) place(p, n, ref); }
    insertAdjacentElement(pos, el) {
      brand(this, Element);
      const p = slot(this).parent;
      if (pos === 'beforebegin') { if (p) place(p, el, this); }
      else if (pos === 'afterbegin') place(this, el, slot(this).children[0] || null);
      else if (pos === 'beforeend') place(this, el, null);
      else if (pos === 'afterend') { if (p) place(p, el, nextSibling(this)); }
      return el;
    }
    insertAdjacentHTML(pos, html) { brand(this, Element); const frag = parseHTML(html); for (const k of slot(frag).children.slice()) this.insertAdjacentElement(pos, k); }
    setHTMLUnsafe(html) { brand(this, Element); clear(this); place(this, parseHTML(html), null); }
    querySelectorAll(sel) {
      brand(this, Element);
      const out = [];
      walk(this, (x) => { if (x !== this && String(sel).toLowerCase() === 'iframe' && x instanceof HTMLIFrameElement) out.push(x); });
      return out;
    }
    attachShadow() { brand(this, Element); const s = new ShadowRoot(); slot(s).host = this; slot(this).shadow = s; return s; }
    getAttribute() { brand(this, Element); return null; }
    setAttribute() { brand(this, Element); }
    removeAttribute() { brand(this, Element); }
  }
  ro(Element, 'tagName', (o) => slot(o).tag || 'DIV');
  ro(Element, 'childElementCount', (o) => slot(o).children.length);
  ro(Element, 'clientWidth', () => 100);
  rw(Element, 'innerHTML', () => '', (el, v) => { clear(el); place(el, parseHTML(v), null); });
  rw(Element, 'outerHTML', () => '', (el, v) => {
    const p = slot(el).parent; if (!p) return;
    const ref = nextSibling(el); unlink(el); place(p, parseHTML(v), ref);
  });

  class HTMLElement extends Element {}
  ro(HTMLElement, 'offsetWidth', () => 100);
  ro(HTMLElement, 'offsetHeight', () => 20);
  class HTMLIFrameElement extends HTMLElement {}
  ro(HTMLIFrameElement, 'contentWindow', (o) => slot(o).win || null);
  ro(HTMLIFrameElement, 'contentDocument', (o) => { const w = slot(o).win; if (!w) return null; try { return w.document; } catch (_) { return null; } });

  class CharacterData extends Node {
    after(...ns) { brand(this, CharacterData); const p = slot(this).parent; if (!p) return; const ref = nextSibling(this); for (const n of ns) place(p, n, ref); }
    before(...ns) { brand(this, CharacterData); const p = slot(this).parent; if (!p) return; for (const n of ns) place(p, n, this); }
    replaceWith(...ns) { brand(this, CharacterData); const p = slot(this).parent; if (!p) return; const ref = nextSibling(this); unlink(this); for (const n of ns) place(p, n, ref); }
  }
  class Text extends CharacterData {}

  class DocumentFragment extends Node {
    append(...ns) { brand(this, DocumentFragment); for (const n of ns) place(this, n, null); }
    prepend(...ns) { brand(this, DocumentFragment); const first = slot(this).children[0] || null; for (const n of ns) place(this, n, first); }
    replaceChildren(...ns) { brand(this, DocumentFragment); clear(this); for (const n of ns) place(this, n, null); }
  }
  class ShadowRoot extends DocumentFragment {
    setHTMLUnsafe(html) { brand(this, ShadowRoot); clear(this); place(this, parseHTML(html), null); }
  }
  rw(ShadowRoot, 'innerHTML', () => '', (r, v) => { clear(r); place(r, parseHTML(v), null); });
  ro(ShadowRoot, 'host', (o) => slot(o).host || null);

  class Range {
    setStart(node, offset) { brand(this, Range); const s = slot(this); s.container = node; s.ref = slot(node).children[offset] || null; }
    setEnd() { brand(this, Range); }
    selectNodeContents(node) { brand(this, Range); const s = slot(this); s.container = node; s.ref = null; }
    insertNode(n) { brand(this, Range); const s = slot(this); place(s.container, n, s.ref); }
    surroundContents(wrapper) {
      brand(this, Range);
      const c = slot(this).container;
      const kids = slot(c).children.slice();
      for (const k of kids) unlink(k);
      for (const k of kids) place(wrapper, k, null);
      place(c, wrapper, null);
    }
    createContextualFragment(html) { brand(this, Range); return parseHTML(html); }
  }

  class Document extends Node {
    createElement(tag) {
      const t = String(tag).toLowerCase();
      const el = t === 'iframe' ? new HTMLIFrameElement() : new HTMLElement();
      slot(el).tag = t.toUpperCase();
      return el;
    }
    createDocumentFragment() { return new DocumentFragment(); }
    createTextNode(t) { const n = new Text(); slot(n).text = String(t); slot(n).nodeType = 3; return n; }
    createRange() { return new Range(); }
    write(...html) { brand(this, Document); place(globalThis.document.body, parseHTML(html.join('')), null); }
    writeln(...html) { brand(this, Document); place(globalThis.document.body, parseHTML(html.join('') + '\\n'), null); }
    append(...ns) { brand(this, Document); for (const n of ns) place(this, n, null); }
    prepend(...ns) { brand(this, Document); const first = slot(this).children[0] || null; for (const n of ns) place(this, n, first); }
    replaceChildren(...ns) { brand(this, Document); clear(this); for (const n of ns) place(this, n, null); }
    open() { brand(this, Document); return this; }
    close() { brand(this, Document); }
  }
  ro(Document, 'nodeType', () => 9);

  class MutationObserver {
    constructor(cb) { slot(this).cb = cb; }
    observe() { globalThis.__observed++; }     // …and NEVER fires. That is the point.
    disconnect() {}
  }
  class NodeList {}

  const document = new Document();
  const documentElement = new HTMLElement(); slot(documentElement).tag = 'HTML';
  place(document, documentElement, null);
  const body = new HTMLElement(); slot(body).tag = 'BODY';
  place(documentElement, body, null);
  document.documentElement = documentElement;
  document.body = body;
  document.head = (() => { const h = new HTMLElement(); slot(h).tag = 'HEAD'; place(documentElement, h, null); return h; })();
  document.readyState = 'loading';
  document.scripts = { length: 0 };

  const getComputedStyle = () => ({ fontFamily: '', fontSize: '', fontWeight: '', fontStyle: '', letterSpacing: '' });

  Object.assign(globalThis, {
    EventTarget, Event, CustomEvent, Navigator, navigator, Window,
    Node, Element, HTMLElement, HTMLIFrameElement, CharacterData, Text,
    DocumentFragment, ShadowRoot, Range, Document, NodeList, MutationObserver,
    document, getComputedStyle,
  });
  globalThis.__slot = slot;
  globalThis.__place = place;
  globalThis.__parseHTML = parseHTML;
})();
`;

/**
 * A WINDOWPROXY (D42). In a browser `window[i]` and `contentWindow` do not hand
 * out the realm's global object but a proxy that forwards to whichever Window is
 * CURRENT in that browsing context. Its identity is stable across navigation; the
 * Window behind it is not. That is the object the shim used to key `INSTALLED` on,
 * and why a navigated frame was never re-installed. The rig hands out proxies of
 * the same shape so a green assertion about navigation is about the right object.
 *
 * The Proxy target is an empty, extensible object, so every descriptor the proxy
 * reports must read as configurable or the Proxy invariants throw; nothing in the
 * shim or in these tests defines a property ON a window proxy.
 */
const PROXY_BOX = new WeakMap();
const innerOf = (o) => {
  const b = (o !== null && (typeof o === 'object' || typeof o === 'function')) ? PROXY_BOX.get(o) : undefined;
  return b ? b.inner : o;
};
function windowProxyFor(inner) {
  const box = { inner };
  const p = new Proxy(Object.create(null), {
    get: (_t, k) => Reflect.get(box.inner, k),
    set: (_t, k, v) => Reflect.set(box.inner, k, v),
    has: (_t, k) => Reflect.has(box.inner, k),
    deleteProperty: (_t, k) => Reflect.deleteProperty(box.inner, k),
    ownKeys: () => Reflect.ownKeys(box.inner),
    getOwnPropertyDescriptor: (_t, k) => { const d = Reflect.getOwnPropertyDescriptor(box.inner, k); if (d) d.configurable = true; return d; },
    defineProperty: (_t, k, d) => Reflect.defineProperty(box.inner, k, d),
    getPrototypeOf: () => Reflect.getPrototypeOf(box.inner),
  });
  PROXY_BOX.set(p, box);
  return p;
}
/** What `__navigate` does to a proxy: the Window behind it changes, the proxy does not. */
const swapRealm = (proxy, next) => {
  const b = PROXY_BOX.get(proxy);
  if (!b) throw new Error('rig: __swapRealm on something that is not a WindowProxy');
  b.inner = innerOf(next);
};
/**
 * A cross-origin realm as the parent sees it: reading `document` throws, exactly
 * as across an origin boundary, and the read is COUNTED — the shim must attempt
 * such a frame once, not once per insertion.
 */
function crossOriginStandIn() {
  const counter = { documentReads: 0 };
  const win = Object.create(null, {
    document: {
      get() { counter.documentReads++; throw new Error('SecurityError: Blocked a frame with origin "https://example.test" from accessing a cross-origin frame.'); },
      configurable: true,
    },
  });
  return { win, counter };
}

/**
 * A realm: its own vm context, its own Array/Object, its own REAL machine, and
 * `depth` levels of further realms waiting in its own pool — so a child realm can
 * create a grandchild the way `getBehemothIframe` does.
 */
function makeRealm(name, depth = 0) {
  const sandbox = {
    location: { hostname: 'example.test', origin: 'https://example.test' },
    crypto: { getRandomValues: (a) => webcrypto.getRandomValues(a) },
    console: { log() {}, info() {}, warn() {}, error() {}, debug() {}, trace() {} },
    setTimeout, clearTimeout, queueMicrotask,
    __proxyInner: innerOf, __swapRealm: swapRealm,
  };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(DOM_SETUP, ctx, { filename: `dom-setup.${name}.js` });
  const win = vm.runInContext('globalThis', ctx);
  for (let i = 0; depth > 0 && i < 2; i++) {
    win.__realmPool.push(windowProxyFor(vm.runInContext('globalThis', makeRealm(`${name}.${i}`, depth - 1))));
  }
  return ctx;
}

/**
 * Boot the REAL shim in a parent realm, with `pool` child realms waiting to be
 * handed out as browsing contexts and `openPool` for `window.open`.
 */
function bootRealm({ pool = 4, openPool = 0, crossOrigin = 0, depth = 1 } = {}) {
  const ctx = makeRealm('parent');
  const win = vm.runInContext('globalThis', ctx);

  // A cross-origin child, handed out FIRST: reading `document` throws, exactly as
  // it does across an origin boundary. `installInto` must not let that escape into
  // the page's own insertion call.
  const crossOriginRealms = [];
  for (let i = 0; i < crossOrigin; i++) {
    const x = crossOriginStandIn();
    crossOriginRealms.push(x);
    win.__realmPool.push(x.win);
  }
  const children = [];
  for (let i = 0; i < pool; i++) {
    const c = makeRealm(`child${i}`, depth);
    children.push(c);
    win.__realmPool.push(windowProxyFor(vm.runInContext('globalThis', c)));
  }
  const opened = [];
  for (let i = 0; i < openPool; i++) {
    const c = makeRealm(`opened${i}`);
    opened.push(c);
    win.__openPool.push(windowProxyFor(vm.runInContext('globalThis', c)));
  }

  let boot = null;
  const onReverse = (ev) => { try { const d = JSON.parse(ev.detail); if (d.phase === 'boot' && d.channel === 'shim' && !boot) boot = d; } catch (_) {} };
  ctx.EventTarget.prototype.addEventListener.call(win, 'nullecho:status', onReverse, true);
  ctx.document.addEventListener('nullecho:status', onReverse, true);

  vm.runInContext(SHIM_SRC, ctx, { filename: 'shim.js' });
  assert.ok(boot && boot.nonce, 'rig: the shim did not announce a boot nonce');
  vm.runInContext(
    'document.dispatchEvent(new CustomEvent("nullecho:persona", { detail: __payload }))',
    Object.assign(ctx, {
      __payload: JSON.stringify({
        ok: true, enabled: true, gpc: false, site: 'example.test', dev: true,
        persona: DELIVERED, nonce: boot.nonce, reportTokens: RIG_TOKENS,
      }),
    }),
  );

  const page = (code) => vm.runInContext(code, ctx, { filename: 'page.js' });
  assert.equal(ctx.navigator.userAgent, DELIVERED.ua, 'rig: the parent realm is not shimmed');

  return {
    ctx, win, page, children, opened, crossOrigin: crossOriginRealms,
    /** Is the realm now at `window[i]` patched? Read it the way a page would. */
    frameCores: (i) => page(`self[${i}].navigator.hardwareConcurrency`),
    frameUA: (i) => page(`self[${i}].navigator.userAgent`),
    len: () => page('self.length'),
  };
}

/** The probes CreepJS runs on every API it audits (D32 / native-shape.test.js). */
const PROBE = `
(f) => {
  const r = {
    names: Object.getOwnPropertyNames(f).sort().join(','),
    protoIn: 'prototype' in f,
  };
  try { class X extends f {} r.extends = 'no-throw'; } catch (e) { r.extends = e.constructor.name; }
  try { new f(); r.construct = 'no-throw'; } catch (e) { r.construct = e.constructor.name; }
  return r;
}
`;
const NATIVE_SHAPE = { names: 'length,name', protoIn: false, extends: 'TypeError', construct: 'TypeError' };

/**
 * THE TABLE, lifted from `shim.js` itself rather than transcribed. A row added to
 * the shim without a wrapper, or a wrapper added without a row, fails the lint
 * below — which is the only thing that keeps the enumeration honest.
 */
function insertionTableFromSource() {
  const block = /const INSERTION_SITES = \[([\s\S]*?)\n\s*\];/.exec(SHIM_SRC);
  assert.ok(block, 'shim.js no longer contains an `INSERTION_SITES` table');
  const rows = [];
  for (const m of block[1].matchAll(/\[\s*'([A-Za-z]+)'\s*,\s*'(method|setter|opener)'\s*,\s*'([A-Za-z]+)'\s*\]/g)) {
    rows.push({ iface: m[1], kind: m[2], prop: m[3] });
  }
  assert.ok(rows.length >= 20, `only ${rows.length} rows parsed out of INSERTION_SITES`);
  return rows;
}

// ═══════════════════════════════════════════════════════════════════════════
// §3c — the same-tick pristine realm, by every path that can create one
// ═══════════════════════════════════════════════════════════════════════════

test('D35: CreepJS\'s exact path — DocumentFragment + div.innerHTML + body.appendChild — hands back an ALREADY-PATCHED realm in the same tick', () => {
  const s = bootRealm();
  const got = s.page(`
    (() => {
      const numberOfIframes = self.length;
      const frag = document.createDocumentFragment();
      const div = document.createElement('div');
      frag.appendChild(div);
      div.innerHTML = '<div style="display:none"><iframe></iframe></div>';
      document.body.appendChild(frag);
      const w = self[numberOfIframes];
      return { cores: w.navigator.hardwareConcurrency, ua: w.navigator.userAgent, n: self.length };
    })()
  `);
  assert.equal(got.n, 1, 'rig: exactly one browsing context was created');
  assert.equal(s.win.__observed > 0, true, 'rig: the shim did install its MutationObserver (which never fires here)');
  assert.equal(got.cores, DELIVERED.cores, 'REGRESSION: the same-tick child realm reported the REAL core count (§3c)');
  assert.equal(got.ua, DELIVERED.ua, 'REGRESSION: the same-tick child realm reported the REAL user agent');
});

test('D35: the child realm\'s Function.prototype.toString is patched in the same tick, so the shim\'s source is not readable through it', () => {
  const s = bootRealm();
  const got = s.page(`
    (() => {
      const n = self.length;
      const f = document.createElement('iframe');
      document.body.appendChild(f);
      const w = self[n];
      const ts = w.Function.prototype.toString;
      const uaGetter = Object.getOwnPropertyDescriptor(Navigator.prototype, 'userAgent').get;
      return { viaChild: ts.call(uaGetter), tsOfTs: ts.call(ts) };
    })()
  `);
  assert.match(got.viaChild, /\[native code\]/,
    'REGRESSION: a pristine child realm printed the shim\'s ACTUAL SOURCE for a parent-realm patched getter (§3c)');
  assert.match(got.tsOfTs, /\[native code\]/, 'and the child\'s own toString reads native');
});

test('D35: innerHTML on a CONNECTED element creates and installs the realm in the same tick', () => {
  const s = bootRealm();
  const cores = s.page(`
    (() => { const n = self.length; document.body.innerHTML = '<iframe></iframe>'; return self[n].navigator.hardwareConcurrency; })()
  `);
  assert.equal(cores, DELIVERED.cores);
});

test('D35: document.write and document.writeln install in the same tick', () => {
  const s = bootRealm();
  assert.equal(s.page(`(() => { const n = self.length; document.write('<iframe></iframe>'); return self[n].navigator.hardwareConcurrency; })()`), DELIVERED.cores);
  assert.equal(s.page(`(() => { const n = self.length; document.writeln('<iframe></iframe>'); return self[n].navigator.hardwareConcurrency; })()`), DELIVERED.cores);
});

test('D35: insertBefore and replaceChild install in the same tick', () => {
  const s = bootRealm();
  assert.equal(s.page(`
    (() => {
      const anchor = document.createElement('span');
      document.body.appendChild(anchor);
      const n = self.length;
      document.body.insertBefore(document.createElement('iframe'), anchor);
      return self[n].navigator.hardwareConcurrency;
    })()
  `), DELIVERED.cores, 'insertBefore');
  assert.equal(s.page(`
    (() => {
      const victim = document.createElement('span');
      document.body.appendChild(victim);
      const n = self.length;
      document.body.replaceChild(document.createElement('iframe'), victim);
      return self[n].navigator.hardwareConcurrency;
    })()
  `), DELIVERED.cores, 'replaceChild');
});

test('D35: window.open returns an installed same-origin window', () => {
  const s = bootRealm({ openPool: 1 });
  const got = s.page(`(() => { const w = open('about:blank', 'aux'); return { cores: w.navigator.hardwareConcurrency, ua: w.navigator.userAgent }; })()`);
  assert.equal(got.cores, DELIVERED.cores, 'REGRESSION: an opened window is a pristine realm');
  assert.equal(got.ua, DELIVERED.ua);
});

test('D35: Range.insertNode and a Range-created fragment install in the same tick', () => {
  const s = bootRealm({ pool: 4 });
  assert.equal(s.page(`
    (() => {
      const r = document.createRange();
      r.selectNodeContents(document.body);
      const n = self.length;
      r.insertNode(document.createElement('iframe'));
      return self[n].navigator.hardwareConcurrency;
    })()
  `), DELIVERED.cores, 'Range.insertNode');
  assert.equal(s.page(`
    (() => {
      const r = document.createRange();
      r.selectNodeContents(document.body);
      const frag = r.createContextualFragment('<iframe></iframe>');
      const n = self.length;
      r.insertNode(frag);
      return self[n].navigator.hardwareConcurrency;
    })()
  `), DELIVERED.cores, 'createContextualFragment + insertNode');
});

test('D35: the ChildNode/ParentNode family — append, prepend, after, before, replaceWith, replaceChildren, insertAdjacent* — all install in the same tick', () => {
  const cases = [
    ['append', `document.body.append(F())`],
    ['prepend', `document.body.prepend(F())`],
    ['replaceChildren', `document.body.replaceChildren(F())`],
    ['after', `A().after(F())`],
    ['before', `A().before(F())`],
    ['replaceWith', `A().replaceWith(F())`],
    ['insertAdjacentElement', `A().insertAdjacentElement('afterend', F())`],
    ['insertAdjacentHTML', `A().insertAdjacentHTML('afterend', '<iframe></iframe>')`],
    ['setHTMLUnsafe', `document.body.setHTMLUnsafe('<iframe></iframe>')`],
    ['outerHTML', `A().outerHTML = '<iframe></iframe>'`],
    ['CharacterData.after', `T().after(F())`],
  ];
  for (const [label, expr] of cases) {
    const s = bootRealm();
    const cores = s.page(`
      (() => {
        const F = () => document.createElement('iframe');
        const A = () => { const a = document.createElement('span'); document.body.appendChild(a); return a; };
        const T = () => { const t = document.createTextNode('x'); document.body.appendChild(t); return t; };
        const mk = () => { ${expr}; };
        const anchor = null;
        const n0 = self.length;
        mk();
        return self[n0] ? self[n0].navigator.hardwareConcurrency : null;
      })()
    `);
    assert.equal(cores, DELIVERED.cores, `REGRESSION: ${label} left a pristine same-tick realm`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// The cases a "did `length` grow?" test gets wrong
// ═══════════════════════════════════════════════════════════════════════════

test('D35: MOVING a connected iframe destroys and recreates its realm — `length` never changes, and the NEW realm is still installed', () => {
  const s = bootRealm({ pool: 3 });
  const got = s.page(`
    (() => {
      const f = document.createElement('iframe');
      document.body.appendChild(f);
      const first = self[0];
      const lenBefore = self.length;
      document.head.appendChild(f);            // same count, brand-new realm
      const second = self[0];
      return {
        lenBefore, lenAfter: self.length, same: first === second,
        cores: second.navigator.hardwareConcurrency,
      };
    })()
  `);
  assert.equal(got.lenBefore, got.lenAfter, 'rig: a move does not change window.length');
  assert.equal(got.same, false, 'rig: a move really did hand out a different realm (as Chrome does)');
  assert.equal(got.cores, DELIVERED.cores, 'REGRESSION: the realm created by a MOVE was left pristine');
});

test('D35: a cross-origin child cannot break the insertion call, and is attempted at most once', () => {
  const s = bootRealm({ pool: 1, crossOrigin: 1 });
  const got = s.page(`
    (() => {
      const a = document.createElement('iframe');      // cross-origin stand-in is next in the pool
      document.body.appendChild(a);
      const same = document.createElement('iframe');
      document.body.appendChild(same);
      return { n: self.length, cores: self[1].navigator.hardwareConcurrency };
    })()
  `);
  assert.equal(got.n, 2, 'both insertions completed normally');
  assert.equal(got.cores, DELIVERED.cores, 'the same-origin sibling is still installed');
});

test('D35: installing twice is a no-op — the second reach does not re-wrap or re-patch anything', () => {
  const s = bootRealm();
  const got = s.page(`
    (() => {
      const n = self.length;
      document.body.appendChild(document.createElement('iframe'));
      const w = self[n];
      const before = {
        ua: Object.getOwnPropertyDescriptor(w.Navigator.prototype, 'userAgent').get,
        append: w.Node.prototype.appendChild,
        ts: w.Function.prototype.toString,
        value: w.navigator.userAgent,
      };
      // Every one of these reaches the SAME realm again, through three different doors.
      document.body.appendChild(document.createElement('span'));
      document.body.querySelectorAll('iframe')[0].contentWindow;
      document.body.innerHTML = document.body.innerHTML;
      const after = {
        ua: Object.getOwnPropertyDescriptor(w.Navigator.prototype, 'userAgent').get,
        append: w.Node.prototype.appendChild,
        ts: w.Function.prototype.toString,
        value: w.navigator.userAgent,
      };
      return {
        ua: before.ua === after.ua, append: before.append === after.append,
        ts: before.ts === after.ts, value: after.value,
      };
    })()
  `);
  assert.equal(got.ua, true, 'REGRESSION: the child realm\'s patched getter was replaced by a second install');
  assert.equal(got.append, true, 'REGRESSION: the child realm\'s insertion wrapper was wrapped a second time');
  assert.equal(got.ts, true, 'REGRESSION: the child realm\'s toString was patched twice');
  assert.equal(got.value, DELIVERED.ua, 'and it still serves the persona');
});

test('D35: a GRANDCHILD created by the child realm\'s OWN appendChild is installed too (CreepJS getBehemothIframe goes two levels down)', () => {
  const s = bootRealm({ pool: 4 });
  const got = s.page(`
    (() => {
      const n = self.length;
      document.body.appendChild(document.createElement('iframe'));
      const child = self[n];
      const inner = child.document.createElement('iframe');
      child.document.body.appendChild(inner);          // the CHILD realm's own appendChild
      const grand = child[0];
      return { child: child.navigator.hardwareConcurrency, grand: grand ? grand.navigator.hardwareConcurrency : null };
    })()
  `);
  assert.equal(got.child, DELIVERED.cores);
  assert.equal(got.grand, DELIVERED.cores, 'REGRESSION: the grandchild realm was left pristine — CreepJS reads PHANTOM_DARKNESS two levels down');
});

test('D35: an iframe inside a SHADOW root is not a document-tree child navigable, and contentWindow is what reaches it', () => {
  const s = bootRealm();
  const got = s.page(`
    (() => {
      const host = document.createElement('div');
      document.body.appendChild(host);
      const root = host.attachShadow({ mode: 'open' });
      const before = self.length;
      root.innerHTML = '<iframe></iframe>';
      const el = root.childNodes[0].childNodes[0];
      return { before, after: self.length, cores: el.contentWindow.navigator.hardwareConcurrency };
    })()
  `);
  assert.equal(got.after, got.before, 'rig models shadow-tree navigables as NOT indexed by window[n]');
  assert.equal(got.cores, DELIVERED.cores, 'the contentWindow hook still installs it');
});

// ═══════════════════════════════════════════════════════════════════════════
// D42 — realm identity across NAVIGATION: the WindowProxy survives, the realm does not
// ═══════════════════════════════════════════════════════════════════════════

test('D42 RIG: a navigation keeps the WindowProxy and replaces the Document and the intrinsics behind it — what Chrome does', () => {
  const s = bootRealm({ pool: 2 });
  const got = s.page(`
    (() => {
      const n = self.length;
      const f = document.createElement('iframe');
      document.body.appendChild(f);
      const p = self[n]; const d0 = p.document; const nav0 = p.Navigator;
      __navigate(f, { load: false });
      return { sameProxy: self[n] === p, viaCW: f.contentWindow === p, sameDoc: p.document === d0,
               sameNavigator: p.Navigator === nav0, len: self.length, taken: __realmsTaken };
    })()
  `);
  assert.equal(got.sameProxy, true, 'rig: a navigation must keep the WindowProxy at window[n]');
  assert.equal(got.viaCW, true, 'rig: contentWindow is the same proxy');
  assert.equal(got.sameDoc, false, 'rig: a navigation must replace the Document');
  assert.equal(got.sameNavigator, false, 'rig: a navigation must hand out fresh intrinsics');
  assert.equal(got.len, 1, 'rig: window.length is unchanged by a navigation');
  assert.equal(got.taken, 2, 'rig: the navigation consumed a second realm');
});

test('D42: a frame navigated AFTER insertion is re-installed by the next insertion sweep — "already installed" is a statement about a Document, not a WindowProxy', () => {
  const s = bootRealm({ pool: 2 });
  const got = s.page(`
    (() => {
      const n = self.length;
      const f = document.createElement('iframe');
      document.body.appendChild(f);
      const before = self[n].navigator.hardwareConcurrency;
      __navigate(f, { load: false });                                   // a later task; no listener of any kind has run
      document.body.appendChild(document.createElement('span'));        // the next insertion anywhere on the page
      return { before, after: self[n].navigator.hardwareConcurrency, ua: self[n].navigator.userAgent };
    })()
  `);
  assert.equal(got.before, DELIVERED.cores, 'installed on insertion (D35)');
  assert.equal(got.after, DELIVERED.cores, 'REGRESSION: the realm created by a NAVIGATION was left pristine — INSTALLED is keyed on the WindowProxy, which survives navigation');
  assert.equal(got.ua, DELIVERED.ua);
});

test('D42: contentWindow re-installs a navigated frame too', () => {
  const s = bootRealm({ pool: 2 });
  const got = s.page(`
    (() => {
      const n = self.length;
      const f = document.createElement('iframe');
      document.body.appendChild(f);
      __navigate(f, { load: false });
      return { viaCW: f.contentWindow.navigator.hardwareConcurrency, viaIndex: self[n].navigator.hardwareConcurrency };
    })()
  `);
  assert.equal(got.viaCW, DELIVERED.cores, 'REGRESSION: contentWindow said "already installed" about a realm that no longer exists');
  assert.equal(got.viaIndex, DELIVERED.cores);
});

test('D42: the page\'s own load listener on the navigated iframe already sees an installed realm — the shim hears load at DOCUMENT capture, ahead of any target listener (a load never reaches the window)', () => {
  const s = bootRealm({ pool: 2 });
  const got = s.page(`
    (() => {
      const n = self.length;
      const f = document.createElement('iframe');
      document.body.appendChild(f);
      const seen = {};
      f.addEventListener('load', () => {
        const w = self[n];
        seen.cores = w.navigator.hardwareConcurrency;
        seen.ua = w.navigator.userAgent;
        seen.ts = w.Function.prototype.toString.call(Object.getOwnPropertyDescriptor(Navigator.prototype, 'userAgent').get);
      });
      f.onload = () => { seen.onloadCores = self[n].navigator.hardwareConcurrency; };
      __navigate(f);                                                    // commits the new realm, then fires load — nothing else happens
      return seen;
    })()
  `);
  assert.equal(got.cores, DELIVERED.cores, 'REGRESSION: the page read the REAL machine from inside its own load handler, with no insertion and no contentWindow read in between');
  assert.equal(got.ua, DELIVERED.ua);
  assert.match(got.ts, /\[native code\]/, 'the navigated realm\'s toString is masked before the page can use it');
  assert.equal(got.onloadCores, DELIVERED.cores, 'onload= sees the same');
});

test('D42: the load door reaches the child through the CAPTURED contentWindow getter, never the live prototype', () => {
  const s = bootRealm({ pool: 2 });
  const got = s.page(`
    (() => {
      const n = self.length;
      const f = document.createElement('iframe');
      document.body.appendChild(f);
      let spied = 0;
      const d = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
      Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', { get() { spied++; return d.get.call(this); }, configurable: true });
      __navigate(f);
      Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', d);
      return { spied, cores: self[n].navigator.hardwareConcurrency };
    })()
  `);
  assert.equal(got.cores, DELIVERED.cores);
  assert.equal(got.spied, 0, 'the shim read contentWindow through the page\'s own (hookable) prototype');
});

test('D42: a frame that navigates to a CROSS-ORIGIN document is attempted exactly once, and 25 later insertions never touch it again', () => {
  const s = bootRealm({ pool: 2 });
  const x = crossOriginStandIn();
  s.ctx.__xo = x.win;
  const got = s.page(`
    (() => {
      const n = self.length;
      const f = document.createElement('iframe');
      document.body.appendChild(f);
      __navigate(f, { to: __xo });                                      // load fires; the document throws
      for (let i = 0; i < 25; i++) document.body.appendChild(document.createElement('span'));
      return { len: self.length };
    })()
  `);
  assert.equal(got.len, 1, 'every insertion completed');
  // Read the counter BEFORE the rig itself touches the document below: every read counts.
  assert.equal(x.counter.documentReads, 1,
    `the shim read a cross-origin frame's document ${x.counter.documentReads} times — once on the load that made it cross-origin, and never again from the sweep`);
  assert.equal(s.page('(() => { try { void self[0].document; return false; } catch (_) { return true; } })()'), true, 'rig: the frame is cross-origin now');
});

test('D42: a frame that WAS cross-origin and navigates back same-origin is installed on that load (HONEST LIMIT 3 of D35, closed)', () => {
  const s = bootRealm({ pool: 3 });
  const x = crossOriginStandIn();
  s.ctx.__xo = x.win;
  const got = s.page(`
    (() => {
      const n = self.length;
      const f = document.createElement('iframe');
      document.body.appendChild(f);
      __navigate(f, { to: __xo });
      document.body.appendChild(document.createElement('span'));        // the sweep gives up on it, permanently
      let inHandler = null;
      f.addEventListener('load', () => { try { inHandler = self[n].navigator.hardwareConcurrency; } catch (_) { inHandler = 'threw'; } });
      __navigate(f);                                                    // back to a same-origin realm
      return { inHandler, after: self[n].navigator.hardwareConcurrency };
    })()
  `);
  assert.equal(got.inHandler, DELIVERED.cores, 'REGRESSION: a frame that was once cross-origin is never looked at again');
  assert.equal(got.after, DELIVERED.cores);
});

test('D42: after a navigation, re-reaching the new realm through three doors changes no function identity', () => {
  const s = bootRealm({ pool: 2 });
  const got = s.page(`
    (() => {
      const n = self.length;
      const f = document.createElement('iframe');
      document.body.appendChild(f);
      __navigate(f);
      const w = self[n];
      const snap = () => ({
        ua: Object.getOwnPropertyDescriptor(w.Navigator.prototype, 'userAgent').get,
        append: w.Node.prototype.appendChild,
        ts: w.Function.prototype.toString,
      });
      const before = snap();
      document.body.appendChild(document.createElement('span'));
      void f.contentWindow;
      __fireLoad(f);                                                    // a second load for the SAME document (a page can dispatch one)
      const after = snap();
      return { ua: before.ua === after.ua, append: before.append === after.append, ts: before.ts === after.ts, value: w.navigator.userAgent };
    })()
  `);
  assert.equal(got.ua, true, 'REGRESSION: the navigated realm\'s patched getter was replaced by a second install');
  assert.equal(got.append, true, 'REGRESSION: the navigated realm\'s insertion wrapper was wrapped a second time');
  assert.equal(got.ts, true, 'REGRESSION: the navigated realm\'s toString was patched twice');
  assert.equal(got.value, DELIVERED.ua);
});

test('D42: a navigated-away realm is not retained by the shim — the restore ledger is weak', async () => {
  // `gc` without a command-line flag: flip the V8 flag at run time and pull the
  // function out of a fresh context.
  v8.setFlagsFromString('--expose-gc');
  const gc = vm.runInNewContext('gc');
  const s = bootRealm({ pool: 5 });
  s.page(`document.body.appendChild(document.createElement('iframe'))`);
  const refs = [];
  for (let i = 0; i < 4; i++) {
    refs.push(new WeakRef(s.page('self[0].Navigator.prototype')), new WeakRef(s.page('self[0].document')));
    s.page('__navigate(document.body.childNodes[0])');              // the realm behind self[0] is now dead
  }
  assert.equal(s.page('self[0].navigator.hardwareConcurrency'), DELIVERED.cores, 'the live realm is installed');
  s.children.length = 0;                                             // the rig's own strong references to the child contexts
  // A WeakRef target lives to the end of the job that touched it, and a vm
  // context is torn down by a second-pass weak callback that runs as a TASK — so
  // each collection gets an event-loop turn before the next.
  for (let i = 0; i < 4; i++) { await new Promise((r) => setTimeout(r, 0)); gc(); }
  const alive = refs.filter((r) => r.deref() !== undefined).length;
  assert.equal(alive, 0, `${alive} of ${refs.length} objects from navigated-away realms are still reachable — the shim retains dead realms ` +
    '(measured in Chrome for Testing 149: 20 navigations of one child, 20 dead realms alive after gc, +7.7 MB)');
});

test('D42 KEEP: a load event on anything that is not an iframe is ignored, and nothing throws into the page', () => {
  const s = bootRealm({ pool: 1 });
  const got = s.page(`
    (() => {
      const img = document.createElement('img');
      document.body.appendChild(img);
      let ok = true;
      try { __fireLoad(img); __fireLoad(document.body); } catch (_) { ok = false; }
      return { ok, taken: __realmsTaken, len: self.length };
    })()
  `);
  assert.equal(got.ok, true);
  assert.equal(got.taken, 0);
  assert.equal(got.len, 0);
});

// ═══════════════════════════════════════════════════════════════════════════
// The lint: the table in shim.js IS the enumeration, and it is all wrapped
// ═══════════════════════════════════════════════════════════════════════════

test('D35 LINT: every interface/property named in shim.js\'s INSERTION_SITES table is really wrapped, with a native shape and a masked source', () => {
  const s = bootRealm();
  const rows = insertionTableFromSource();
  const probe = s.page(PROBE);
  const missing = [];
  const misshapen = [];
  const unmasked = [];
  for (const { iface, kind, prop } of rows) {
    const proto = s.page(`typeof ${iface} === 'function' ? ${iface}.prototype : null`);
    assert.ok(proto, `rig: the fake DOM has no ${iface} — the table cannot be checked`);
    const d = s.page(`Object.getOwnPropertyDescriptor(${iface}.prototype, ${JSON.stringify(prop)})`);
    if (!d) { missing.push(`${iface}.${prop} (absent from the rig's ${iface}.prototype)`); continue; }
    const fn = kind === 'setter' ? d.set : d.value;
    if (typeof fn !== 'function') { missing.push(`${iface}.${prop} (#${kind} is not a function)`); continue; }
    const masked = s.page(`Function.prototype.toString.call(Object.getOwnPropertyDescriptor(${iface}.prototype, ${JSON.stringify(prop)}).${kind === 'setter' ? 'set' : 'value'})`);
    if (!/\[native code\]/.test(masked)) unmasked.push(`${iface}.${prop}#${kind} → ${masked}`);
    const shape = { ...probe(fn) };
    try { assert.deepEqual(shape, NATIVE_SHAPE); } catch (_) { misshapen.push(`${iface}.${prop}#${kind} → ${JSON.stringify(shape)}`); }
  }
  assert.deepEqual(missing, [], 'listed in INSERTION_SITES but not present to wrap');
  assert.deepEqual(unmasked, [], 'wrapped but not masked — a listed entry point was replaced without going through the helpers');
  assert.deepEqual(misshapen, [], 'wrapped with a non-native function shape (D32)');
});

test('D35 LINT: the table covers every entry point the rig can connect an iframe through', () => {
  const rows = insertionTableFromSource();
  const have = new Set(rows.map((r) => `${r.iface}.${r.prop}`));
  const MUST = [
    'Node.appendChild', 'Node.insertBefore', 'Node.replaceChild',
    'Element.append', 'Element.prepend', 'Element.after', 'Element.before',
    'Element.replaceChildren', 'Element.replaceWith', 'Element.insertAdjacentElement',
    'Element.insertAdjacentHTML', 'Element.setHTMLUnsafe', 'Element.innerHTML', 'Element.outerHTML',
    'CharacterData.after', 'CharacterData.before', 'CharacterData.replaceWith',
    'ShadowRoot.innerHTML', 'ShadowRoot.setHTMLUnsafe',
    'Document.write', 'Document.writeln', 'Document.append', 'Document.prepend', 'Document.replaceChildren',
    'DocumentFragment.append', 'DocumentFragment.prepend', 'DocumentFragment.replaceChildren',
    'Range.insertNode', 'Range.surroundContents',
  ];
  const absent = MUST.filter((k) => !have.has(k));
  assert.deepEqual(absent, [], 'an insertion entry point lost its row in INSERTION_SITES');
});

// ═══════════════════════════════════════════════════════════════════════════
// What the fix must NOT cost
// ═══════════════════════════════════════════════════════════════════════════

test('D35 KEEP: a wrapped insertion method called with a wrong receiver still throws Illegal invocation, and still returns the original\'s value', () => {
  const s = bootRealm();
  assert.throws(() => s.page('Node.prototype.appendChild.call({}, document.createElement("div"))'),
    (e) => e.constructor.name === 'TypeError' && /Illegal invocation/.test(e.message));
  assert.throws(() => s.page('Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML").set.call({}, "<b></b>")'),
    (e) => e.constructor.name === 'TypeError' && /Illegal invocation/.test(e.message));
  // Return values and arguments pass through untouched.
  const ok = s.page(`
    (() => {
      const d = document.createElement('div');
      const r = document.body.appendChild(d);
      const span = document.createElement('span');
      document.body.appendChild(span);
      const before = document.body.insertBefore(document.createElement('i'), span);
      return { same: r === d, connected: d.isConnected, insertedFirst: before.tagName, count: document.body.childElementCount };
    })()
  `);
  assert.equal(ok.same, true, 'appendChild must return the node it was given');
  assert.equal(ok.connected, true);
  assert.equal(ok.insertedFirst, 'I');
  assert.ok(ok.count >= 3);
});

test('D35 KEEP: descriptor flags, name and length of every wrapped entry point match the original\'s', () => {
  const before = (() => {
    const ctx = makeRealm('pristine');
    const read = (iface, kind, prop) => vm.runInContext(`
      (() => {
        const d = Object.getOwnPropertyDescriptor(${iface}.prototype, ${JSON.stringify(prop)});
        if (!d) return null;
        const f = ${kind === 'setter' ? 'd.set' : 'd.value'};
        return { writable: d.writable, enumerable: d.enumerable, configurable: d.configurable, name: f.name, length: f.length };
      })()
    `, ctx);
    return read;
  })();
  const s = bootRealm();
  const diffs = [];
  for (const { iface, kind, prop } of insertionTableFromSource()) {
    const was = before(iface, kind, prop);
    if (!was) continue;
    const is = s.page(`
      (() => {
        const d = Object.getOwnPropertyDescriptor(${iface}.prototype, ${JSON.stringify(prop)});
        const f = ${kind === 'setter' ? 'd.set' : 'd.value'};
        return { writable: d.writable, enumerable: d.enumerable, configurable: d.configurable, name: f.name, length: f.length };
      })()
    `);
    for (const k of ['writable', 'enumerable', 'configurable', 'name', 'length']) {
      if (was[k] !== is[k]) diffs.push(`${iface}.${prop}#${kind}.${k}: ${JSON.stringify(was[k])} → ${JSON.stringify(is[k])}`);
    }
  }
  assert.deepEqual(diffs, [], 'a wrapped entry point no longer looks like the original');
});

test('D35 KEEP: nothing is written to the page console by any of this (D33)', () => {
  const calls = [];
  const ctx = makeRealm('quiet');
  const win = vm.runInContext('globalThis', ctx);
  for (let i = 0; i < 3; i++) win.__realmPool.push(vm.runInContext('globalThis', makeRealm(`quietchild${i}`)));
  for (const m of ['log', 'info', 'warn', 'error', 'debug', 'trace']) {
    ctx.console[m] = (...a) => calls.push(`${m}: ${a.map(String).join(' ')}`);
  }
  let boot = null;
  const onReverse = (ev) => { try { const d = JSON.parse(ev.detail); if (d.phase === 'boot' && d.channel === 'shim' && !boot) boot = d; } catch (_) {} };
  ctx.document.addEventListener('nullecho:status', onReverse, true);
  vm.runInContext(SHIM_SRC, ctx, { filename: 'shim.js' });
  vm.runInContext('document.dispatchEvent(new CustomEvent("nullecho:persona", { detail: __payload }))',
    Object.assign(ctx, { __payload: JSON.stringify({ ok: true, enabled: true, gpc: false, site: 'example.test', persona: DELIVERED, nonce: boot.nonce, reportTokens: RIG_TOKENS }) }));
  vm.runInContext(`
    document.body.appendChild(document.createElement('iframe'));
    try { Node.prototype.appendChild.call({}, document.createElement('div')); } catch (_) {}
    try { document.body.appendChild(null); } catch (_) {}
  `, ctx);
  assert.deepEqual(calls, [], `the page console was written to:\n${calls.join('\n')}`);
});
