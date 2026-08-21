/*
 * Nullecho fingerprint harness
 * ─────────────────────────
 * Collects the signals a real tracker would read, so we can measure
 * what the browser leaks BEFORE and AFTER the extension is loaded.
 *
 * Design rules:
 *  - Every probe is wrapped: a probe that throws must not kill the run.
 *  - Every probe reports its raw value AND a stable hash, so we can see
 *    both "what changed" and "did it change at all".
 *  - Probes are grouped by whether an extension can realistically spoof
 *    them (content-script reachable) or not (network/TLS layer).
 */

const nullechoHarness = (() => {
  /**
   * ⚠⚠ MEASUREMENT CONSTANTS — CHANGING ANY STRING BELOW INVALIDATES EVERY
   * RECORDED BASELINE IN research/BASELINE.md. ⚠⚠
   *
   * These strings are painted into the fingerprinting canvases, so their glyphs are
   * part of the rasterized pixels that `canvas.hash` and `canvasPixels.hash` digest,
   * which feed `compositeHash`. They are measurement inputs, not UI copy.
   *
   * This has already bitten us once: the project rename Chaff → Nullecho rewrote
   * these as if they were prose and silently invalidated both recorded composites.
   * A find-and-replace across the repo will do it again. If you must change one,
   * re-run the full baseline capture in real Chrome afterwards and update
   * research/BASELINE.md in the same commit.
   *
   * They are deliberately NOT derived from the product name for that reason.
   */
  const PROBE_TEXT = {
    /** canvasProbe — the classic mixed text + compositing payload. */
    canvas: 'Nullecho✨ fingerprint 1.0',
    /** canvasPixelProbe — raw getImageData read. */
    canvasPixels: 'Nullecho',
    /** The repeated-read stability probe (also used by harness/shim-test.html). */
    stability: 'Nullecho stability probe',
  };

  // ---------- utilities ----------

  /** Non-cryptographic, stable, fast. Enough to compare runs. */
  const hash = (str) => {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
  };

  /** Run a probe without letting it break the whole sweep. */
  const probe = async (name, fn) => {
    const t0 = performance.now();
    try {
      const value = await fn();
      return { name, ok: true, value, ms: +(performance.now() - t0).toFixed(2) };
    } catch (err) {
      return { name, ok: false, error: String(err && err.message || err), ms: +(performance.now() - t0).toFixed(2) };
    }
  };

  // ---------- probes: canvas ----------

  const canvasProbe = () => {
    const c = document.createElement('canvas');
    c.width = 280; c.height = 60;
    const ctx = c.getContext('2d');
    // The classic fingerprinting payload: mixed text rendering + compositing.
    // Small differences in font rasterization / GPU compositing produce
    // machine-specific pixels.
    ctx.textBaseline = 'top';
    ctx.font = '14px "Arial"';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText(PROBE_TEXT.canvas, 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText(PROBE_TEXT.canvas, 4, 17);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgb(255,0,255)';
    ctx.beginPath(); ctx.arc(50, 50, 50, 0, Math.PI * 2, true); ctx.closePath(); ctx.fill();
    const data = c.toDataURL();
    return { dataUrlLength: data.length, hash: hash(data) };
  };

  /**
   * Reads raw pixels rather than the encoded PNG. A shim that only patches
   * toDataURL but not getImageData is trivially caught by this.
   */
  const canvasPixelProbe = () => {
    const c = document.createElement('canvas');
    c.width = 40; c.height = 20;
    const ctx = c.getContext('2d');
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#123456';
    ctx.fillText(PROBE_TEXT.canvasPixels, 1, 14);
    const px = ctx.getImageData(0, 0, 40, 20).data;
    let sum = 0;
    for (let i = 0; i < px.length; i++) sum += px[i];
    return { pixelSum: sum, hash: hash(Array.from(px.slice(0, 400)).join(',')) };
  };

  // ---------- probes: webgl ----------

  const webglProbe = () => {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
    if (!gl) throw new Error('no webgl context');
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const params = {
      vendor: gl.getParameter(gl.VENDOR),
      renderer: gl.getParameter(gl.RENDERER),
      version: gl.getParameter(gl.VERSION),
      shadingLanguage: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
      unmaskedVendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : null,
      unmaskedRenderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : null,
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      maxViewportDims: Array.from(gl.getParameter(gl.MAX_VIEWPORT_DIMS) || []),
      maxRenderbufferSize: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
      aliasedLineWidthRange: Array.from(gl.getParameter(gl.ALIASED_LINE_WIDTH_RANGE) || []),
      extensions: (gl.getSupportedExtensions() || []).sort(),
    };
    return { ...params, hash: hash(JSON.stringify(params)) };
  };

  const webgpuProbe = async () => {
    if (!navigator.gpu) throw new Error('no navigator.gpu');
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('no adapter');
    const info = adapter.info || {};
    const features = Array.from(adapter.features || []).sort();
    const limits = {};
    if (adapter.limits) {
      for (const k in adapter.limits) {
        const v = adapter.limits[k];
        if (typeof v === 'number') limits[k] = v;
      }
    }
    const payload = { vendor: info.vendor, architecture: info.architecture,
                      device: info.device, description: info.description, features, limits };
    return { ...payload, hash: hash(JSON.stringify(payload)) };
  };

  // ---------- probes: audio ----------

  const audioProbe = async () => {
    const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OfflineCtx) throw new Error('no OfflineAudioContext');
    const ctx = new OfflineCtx(1, 44100, 44100);
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(10000, ctx.currentTime);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.setValueAtTime(-50, ctx.currentTime);
    comp.knee.setValueAtTime(40, ctx.currentTime);
    comp.ratio.setValueAtTime(12, ctx.currentTime);
    comp.attack.setValueAtTime(0, ctx.currentTime);
    comp.release.setValueAtTime(0.25, ctx.currentTime);
    osc.connect(comp); comp.connect(ctx.destination);
    osc.start(0);
    const buf = await ctx.startRendering();
    const ch = buf.getChannelData(0);
    let sum = 0;
    for (let i = 4500; i < 5000; i++) sum += Math.abs(ch[i]);
    return { fingerprint: sum.toFixed(10), hash: hash(sum.toFixed(10)) };
  };

  // ---------- probes: fonts ----------

  const fontProbe = () => {
    // Measure-based detection: render a string in a candidate font with a
    // known fallback; if metrics differ from the fallback, the font exists.
    const candidates = [
      'Andale Mono','Arial','Arial Black','Arial Narrow','Arial Rounded MT Bold','Baskerville',
      'Big Caslon','Bookman','Bradley Hand','Brush Script MT','Calibri','Cambria','Candara',
      'Century Gothic','Comic Sans MS','Consolas','Copperplate','Courier','Courier New','Didot',
      'Futura','Geneva','Georgia','Gill Sans','Helvetica','Helvetica Neue','Herculanum','Impact',
      'Lucida Bright','Lucida Console','Lucida Grande','Luminari','Marker Felt','Menlo','Monaco',
      'Optima','Palatino','Papyrus','Perpetua','Rockwell','SF Pro','Segoe UI','Skia','Snell Roundhand',
      'Tahoma','Times','Times New Roman','Trattatello','Trebuchet MS','Verdana','Zapfino',
      'Roboto','Ubuntu','Cantarell','DejaVu Sans','Liberation Sans','Noto Sans',
    ];
    const base = ['monospace', 'sans-serif', 'serif'];
    const text = 'mmmmmmmmmmlli';
    const size = '72px';
    const span = document.createElement('span');
    span.style.cssText = `position:absolute;left:-9999px;top:-9999px;font-size:${size};`;
    span.textContent = text;
    document.body.appendChild(span);

    const baseline = {};
    for (const b of base) {
      span.style.fontFamily = b;
      baseline[b] = { w: span.offsetWidth, h: span.offsetHeight };
    }
    const detected = [];
    for (const f of candidates) {
      let found = false;
      for (const b of base) {
        span.style.fontFamily = `"${f}",${b}`;
        if (span.offsetWidth !== baseline[b].w || span.offsetHeight !== baseline[b].h) { found = true; break; }
      }
      if (found) detected.push(f);
    }
    document.body.removeChild(span);
    return { count: detected.length, detected, hash: hash(detected.join('|')) };
  };

  // ---------- probes: hardware / navigator ----------

  const navigatorProbe = () => {
    const n = navigator;
    const payload = {
      userAgent: n.userAgent,
      platform: n.platform,
      language: n.language,
      languages: (n.languages || []).join(','),
      hardwareConcurrency: n.hardwareConcurrency,
      deviceMemory: n.deviceMemory ?? null,
      maxTouchPoints: n.maxTouchPoints,
      vendor: n.vendor,
      pdfViewerEnabled: n.pdfViewerEnabled ?? null,
      webdriver: n.webdriver ?? null,
      doNotTrack: n.doNotTrack ?? null,
      cookieEnabled: n.cookieEnabled,
      plugins: Array.from(n.plugins || []).map(p => p.name).sort(),
      mimeTypes: Array.from(n.mimeTypes || []).map(m => m.type).sort(),
    };
    return { ...payload, hash: hash(JSON.stringify(payload)) };
  };

  const screenProbe = () => {
    const s = screen;
    const payload = {
      width: s.width, height: s.height,
      availWidth: s.availWidth, availHeight: s.availHeight,
      colorDepth: s.colorDepth, pixelDepth: s.pixelDepth,
      devicePixelRatio: window.devicePixelRatio,
      orientation: s.orientation ? s.orientation.type : null,
      innerWidth: window.innerWidth, innerHeight: window.innerHeight,
      outerWidth: window.outerWidth, outerHeight: window.outerHeight,
    };
    return { ...payload, hash: hash(JSON.stringify(payload)) };
  };

  const timezoneProbe = () => {
    const dtf = Intl.DateTimeFormat().resolvedOptions();
    const payload = {
      timeZone: dtf.timeZone,
      locale: dtf.locale,
      calendar: dtf.calendar,
      numberingSystem: dtf.numberingSystem,
      offsetMinutes: new Date().getTimezoneOffset(),
    };
    return { ...payload, hash: hash(JSON.stringify(payload)) };
  };

  /** Client Hints — the modern, increasingly-preferred UA surface. */
  const clientHintsProbe = async () => {
    const uad = navigator.userAgentData;
    if (!uad) throw new Error('no navigator.userAgentData');
    const low = { brands: uad.brands, mobile: uad.mobile, platform: uad.platform };
    let high = null;
    try {
      high = await uad.getHighEntropyValues([
        'architecture','bitness','model','platformVersion','uaFullVersion','fullVersionList','wow64',
      ]);
    } catch (e) { high = { error: String(e.message || e) }; }
    const payload = { low, high };
    return { ...payload, hash: hash(JSON.stringify(payload)) };
  };

  const mediaDevicesProbe = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) throw new Error('no enumerateDevices');
    const devs = await navigator.mediaDevices.enumerateDevices();
    // Without permission, labels are empty — the *shape* is still a signal.
    const payload = devs.map(d => ({ kind: d.kind, hasLabel: !!d.label, hasId: !!d.deviceId }));
    const counts = payload.reduce((a, d) => (a[d.kind] = (a[d.kind] || 0) + 1, a), {});
    return { counts, total: devs.length, hash: hash(JSON.stringify(counts)) };
  };

  const mathProbe = () => {
    // FP implementation differences across engines/CPUs. Cheap, stable, rarely spoofed.
    const ops = {
      acos: Math.acos(0.123456789),
      asinh: Math.asinh(1e300),
      atanh: Math.atanh(0.5),
      expm1: Math.expm1(1),
      sinh: Math.sinh(1),
      tan: Math.tan(-1e300),
      pow: Math.pow(Math.PI, -100),
    };
    const str = Object.entries(ops).map(([k, v]) => `${k}:${v}`).join('|');
    return { ops, hash: hash(str) };
  };

  const cssProbe = () => {
    // Feature-support matrix + prefers-* media queries. Reveals browser build
    // and OS accessibility settings.
    const feats = [
      'display:grid','backdrop-filter:blur(1px)','color:color(display-p3 1 0 0)',
      'width:1dvh','aspect-ratio:1/1','container-type:inline-size','text-wrap:balance',
    ].map(f => { const [p, v] = f.split(/:(.+)/); return `${f}=${CSS.supports(p, v)}`; });
    const mqs = [
      'prefers-color-scheme: dark','prefers-reduced-motion: reduce','prefers-contrast: more',
      'forced-colors: active','any-pointer: coarse','any-hover: hover','dynamic-range: high',
    ].map(q => `${q}=${matchMedia(`(${q})`).matches}`);
    const payload = { feats, mqs };
    return { ...payload, hash: hash(JSON.stringify(payload)) };
  };

  const storageProbe = async () => {
    const out = { localStorage: false, sessionStorage: false, indexedDB: false, quota: null };
    try { localStorage.setItem('__nullecho', '1'); localStorage.removeItem('__nullecho'); out.localStorage = true; } catch {}
    try { sessionStorage.setItem('__nullecho', '1'); sessionStorage.removeItem('__nullecho'); out.sessionStorage = true; } catch {}
    out.indexedDB = !!window.indexedDB;
    try {
      if (navigator.storage?.estimate) {
        const e = await navigator.storage.estimate();
        // Quota is derived from disk size — a surprisingly strong signal.
        out.quota = e.quota ?? null;
      }
    } catch {}
    return { ...out, hash: hash(JSON.stringify(out)) };
  };

  const timingProbe = () => {
    // Resolution of performance.now() — Tor/Brave coarsen this deliberately.
    const deltas = [];
    for (let i = 0; i < 40; i++) {
      const a = performance.now();
      let b = performance.now();
      let guard = 0;
      while (b === a && guard++ < 100000) b = performance.now();
      deltas.push(b - a);
    }
    const nonzero = deltas.filter(d => d > 0);
    const min = nonzero.length ? Math.min(...nonzero) : 0;
    return { minDeltaMs: min, estResolutionUs: +(min * 1000).toFixed(3), samples: nonzero.length };
  };

  // ---------- runner ----------

  /** Signals grouped by whether a WebExtension can plausibly intervene. */
  const REACHABLE = new Set([
    'canvas','canvasPixels','webgl','webgpu','audio','fonts','navigator',
    'screen','timezone','clientHints','mediaDevices','css','storage','timing','math',
  ]);

  async function run() {
    const results = [];
    results.push(await probe('canvas', canvasProbe));
    results.push(await probe('canvasPixels', canvasPixelProbe));
    results.push(await probe('webgl', webglProbe));
    results.push(await probe('webgpu', webgpuProbe));
    results.push(await probe('audio', audioProbe));
    results.push(await probe('fonts', fontProbe));
    results.push(await probe('navigator', navigatorProbe));
    results.push(await probe('screen', screenProbe));
    results.push(await probe('timezone', timezoneProbe));
    results.push(await probe('clientHints', clientHintsProbe));
    results.push(await probe('mediaDevices', mediaDevicesProbe));
    results.push(await probe('math', mathProbe));
    results.push(await probe('css', cssProbe));
    results.push(await probe('storage', storageProbe));
    results.push(await probe('timing', timingProbe));

    // Composite fingerprint = what a tracker would actually key on.
    const composite = results
      .filter(r => r.ok && r.value && r.value.hash)
      .map(r => `${r.name}:${r.value.hash}`)
      .join('|');

    return {
      generatedAt: new Date().toISOString(),
      compositeHash: hash(composite),
      componentCount: results.filter(r => r.ok).length,
      failedCount: results.filter(r => !r.ok).length,
      results,
      reachable: [...REACHABLE],
    };
  }

  return { run, hash, PROBE_TEXT };
})();

if (typeof module !== 'undefined') module.exports = nullechoHarness;
