# Verifying the Linux persona GPU strings

Hard release blocker #1. Decision 2026-08-21: **verify against real Linux**, not the
carry-don't-apply workaround. This file is the procedure — and the constraint that shapes it.

## What is claimed

Five personas, four distinct driver stacks. Each string is **hardware-specific**:

| Persona | w | Claimed `WEBGL_debug_renderer_info` UNMASKED_RENDERER |
|---|---|---|
| `linux-chrome-mesa` | 24 | `ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 (KBL GT2), OpenGL 4.6)` |
| `linux-chrome-mesa-xe` | 22 | `ANGLE (Intel, Mesa Intel(R) Xe Graphics (TGL GT2), OpenGL 4.6)` |
| `linux-chrome-amd-renoir` | 20 | `ANGLE (AMD, AMD Radeon Graphics (radeonsi, renoir, LLVM 15.0.7, DRM 3.49, 6.8.0-generic), OpenGL 4.6)` |
| `linux-chrome-nvidia-rtx3060` | 20 | `ANGLE (NVIDIA Corporation, NVIDIA GeForce RTX 3060/PCIe/SSE2, OpenGL 4.5.0 NVIDIA 550.120)` |
| `linux-chrome-mesa-uhd630` | 14 | `ANGLE (Intel, Mesa Intel(R) UHD Graphics 630 (CFL GT2), OpenGL 4.6)` |

Also unverified on this family: `uaData.platformVersion` (`6.8.0`).

## ⚠️ The constraint: one box verifies at most ONE of five, and a VM verifies ZERO

These are not five variations on a theme — each names a specific GPU and driver revision.

- **A VM cannot settle the GPU strings.** UTM/QEMU/Parallels on a Mac, and every non-GPU cloud instance, present
  a virtual adapter. Chrome there reports **llvmpipe or virgl** — e.g.
  `ANGLE (Mesa, llvmpipe (LLVM 17.0.6, 256 bits), OpenGL 4.5)`. That is a real string for a VM and
  evidence for none of the five above. Do not expect a VM to settle *these five strings* — but see the section below: a VM settles
  almost everything else the Linux family claims, and that pass is worth doing first.
- **A physical Ubuntu box verifies exactly the GPU it contains.** A laptop with UHD 620 settles row
  1 and tells you nothing about rows 2–5.
- Row 4 additionally pins a **driver version** (`550.120`), and row 3 pins **LLVM 15.0.7, DRM 3.49,
  kernel 6.8.0-generic**. Those move with the distro image, so even matching hardware on a
  different Ubuntu point release yields a different string.

**Therefore the realistic outcomes are:** verify one row from whatever machine is reachable and
narrow the pool to it, or verify the *format* from primary sources and keep the pool.

## ✅ What a VM DOES settle — most of the family (Jason has UTM / VMware, 2026-08-21)

The GPU strings are the *only* part of the Linux family a VM cannot reach. Everything else the
`ubuntu-22` personas claim is **OS-level**, and a local Ubuntu VM is ground truth for all of it.
Do this pass first — it is most of the blocker, and it needs no new hardware.

| Claim | VM verifies? | How |
|---|---|---|
| `fonts: 'ubuntu-22'` — the 30-family list | ✅ **yes** | `fc-list : family` on a default install |
| `uaData.platformVersion: '6.8.0'` | ✅ **yes** | real kernel, real format |
| `platform: 'Linux x86_64'` | ✅ yes | `navigator.platform` |
| Chrome's Linux UA string shape | ✅ yes | `navigator.userAgent` |
| **`os: 'ubuntu-22'` paired with kernel 6.8.0** | ✅ **yes — and worth checking** | see below |
| The 5 GPU renderer strings | ❌ **no** | virtual adapter reports `llvmpipe` / `virgl` / `SVGA3D` |

**✅ RESOLVED 2026-08-21 — the release/kernel pairing is CORRECT.** An earlier draft of this file
speculated that "ubuntu-22 + 6.8.0" might be a narrow slice. **That speculation was wrong and is
withdrawn.** Canonical's manifests show **22.04.5 ships `linux-image-6.8.0-40-generic`** via the HWE
stack, while **24.04.4 has moved on to 6.17.0**. The persona pairing is the mainstream one. No change
needed.

**🔴 But the FONT list is wrong — see `research/linux-ground-truth/`.** Measured against Canonical's
own desktop manifests: a real default Ubuntu 22.04 desktop has **180 font families**; the persona
claims 30, and **five of those do not exist** (Noto Sans, Noto Serif, Century Schoolbook L, Dingbats,
DejaVu Math TeX Gyre). A false-*present* font is a self-contradicting persona detectable by ordinary
fingerprinting scripts — worse than the unverified GPU strings. **Fix the five false-presents first.**

### VM run — ~5 minutes, closes most of blocker #1

In the Ubuntu guest, terminal:

```bash
lsb_release -d && uname -r && fc-list : family | tr ',' '\n' | sort -u | wc -l
```

Then, to capture the font list verbatim for comparison against `FONT_SETS['ubuntu-22']`:

```bash
fc-list : family | tr ',' '\n' | sed 's/^ *//' | sort -u
```

Then in Chrome in the guest, the console snippet in the next section. Ignore its `renderer` /
`vendor` output — that is the virtualised adapter and proves nothing about the pool — but **do**
record `platformVersion`, `platform` and the UA.

**Bonus the VM unlocks:** it is also the only way to load the extension unpacked on Linux and run
the breakage suite there. Nothing has ever done that. Worth doing in the same sitting.

### What still needs real hardware afterwards

Only the five renderer strings. Options at that point: narrow the pool to rows we can prove, or
format-verify from ANGLE/Mesa primary source (covers all five, weaker evidence, must be labelled).

---

## Procedure — on a real Ubuntu box, ~2 minutes

Boot Ubuntu 22.04 with Chrome (not Chromium snap, not Firefox), open any page, paste in the console:

```js
(() => {
  const gl = document.createElement('canvas').getContext('webgl');
  const d  = gl.getExtension('WEBGL_debug_renderer_info');
  return {
    vendor:   gl.getParameter(d.UNMASKED_VENDOR_WEBGL),
    renderer: gl.getParameter(d.UNMASKED_RENDERER_WEBGL),
    glVendor: gl.getParameter(gl.VENDOR),
    version:  gl.getParameter(gl.VERSION),
    platform: navigator.platform,
    uaPlatformVersion: navigator.userAgentData?.getHighEntropyValues
      ? '(run getHighEntropyValues([\'platformVersion\']))' : 'n/a',
  };
})()
```

Then, for `platformVersion`:

```js
navigator.userAgentData.getHighEntropyValues(['platform','platformVersion','architecture','model'])
```

Record verbatim — **character for character**, including spacing and parenthesisation. Paste into
the table above with the machine's `lsb_release -d`, `uname -r` and GPU. A string that is *close* is
a failure, not a pass: the whole risk is emitting something no driver emits.

## Acceptance rule

- A row is **verified** only when read off real hardware matching it, on real Chrome.
- Any row still unverified at release either gets **removed from the pool**, or the family ships
  narrowed to the verified rows. ⚠️ Removing rows requires care: `MIN_PERSONAS_PER_FAMILY` is 4 and
  `validatePool()` enforces it, and dropping the family entirely does **not** do what it looks like
  — `personasForFamily()` falls back to `DEFAULT_FAMILY` (`'win'`), which would silently hand Linux
  users Windows personas and undo D12 for exactly them.
- Weights must be renormalised to sum to 100 within the family after any removal.

## Fallback if no matching hardware appears

Verify the *format* rather than the instance, from primary sources — this covers all five rows and
needs no hardware, but is weaker evidence and must be labelled as such in the pool comment:

- **ANGLE wrapper** — `ANGLE (<vendor>, <renderer>, <GL version>)` is emitted by ANGLE's GL backend;
  the exact assembly is in ANGLE source, not folklore.
- **Mesa device names** — `Mesa Intel(R) UHD Graphics 620 (KBL GT2)` is generated from Mesa's Intel
  device tables; the `(KBL GT2)` / `(TGL GT2)` / `(CFL GT2)` suffixes are Mesa's, and the exact
  spelling is checkable against Mesa source for the shipped release.
- **radeonsi** — the inline `(radeonsi, <chip>, LLVM x.y.z, DRM a.b, <kernel>)` form is radeonsi's
  own renderer-string construction, so the *shape* is verifiable even where the version numbers
  are not.
- **Cross-check population** against a public corpus of real collected renderer strings so the pool
  keeps its "high-population real configs" property. A unique fake and a unique real are equally
  bad — the pool exists to put the user in a crowd.

**A format-verified row is not a hardware-verified row.** If we ship on format verification alone,
say so in `personas.js` and in the release notes rather than quietly upgrading the caveat.
