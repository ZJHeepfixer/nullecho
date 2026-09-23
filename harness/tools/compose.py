#!/usr/bin/env python3
"""
Nullecho — screenshot compositor for harness/store-screenshots.mjs.

Takes a JSON spec (a file path, argv[1]) and produces exactly one output PNG.
Every pixel placed on the canvas is a verbatim crop of a real screenshot PNG
already on disk — this script never draws, fills a shape over content, or
alters a source pixel. It only crops rectangles out of real captures and
pastes them at given positions, plus filling the untouched canvas background
with one flat color (there is no "content" under that color to misrepresent;
it is letterboxing, the same as a device frame around a phone screenshot).

Spec shape:
{
  "canvas": [1280, 800],
  "bg": "#ffffff",
  "out": "/abs/path/out.png",
  "paste": [
    {"src": "/abs/path/capture.png", "cropTop": 0, "cropBottom": 140, "x": 40, "y": 40},
    {"src": "/abs/path/capture.png", "cropLeft": 820, "cropTop": 200, "cropRight": 1260, "cropBottom": 480, "x": 0, "y": 0},
    ...
  ]
}

"cropTop"/"cropBottom" (with cropLeft/cropRight defaulting to the full image width) select a
rectangular region of the source image. Most of this project's crops are full-width horizontal
bands (a single-column popup or a full-width page), so cropLeft/cropRight are usually omitted;
the promo-tile crop uses all four to pull one rectangle out of an already-composed image. Omit
every crop key to paste the source image unmodified.
"""
import json
import sys
from PIL import Image

def hex_to_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def main():
    spec_path = sys.argv[1]
    with open(spec_path) as f:
        spec = json.load(f)

    cw, ch = spec['canvas']
    bg = hex_to_rgb(spec.get('bg', '#ffffff'))
    canvas = Image.new('RGB', (cw, ch), bg)

    for p in spec['paste']:
        img = Image.open(p['src']).convert('RGB')
        if 'cropTop' in p or 'cropBottom' in p or 'cropLeft' in p or 'cropRight' in p:
            left = p.get('cropLeft', 0)
            top = p.get('cropTop', 0)
            right = p.get('cropRight', img.width)
            bottom = p.get('cropBottom', img.height)
            img = img.crop((left, top, right, bottom))
        scale = p.get('scale')
        if scale and scale != 1:
            img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
        canvas.paste(img, (p['x'], p['y']))

    canvas.save(spec['out'], 'PNG')
    print(f"wrote {spec['out']} ({cw}x{ch})")

if __name__ == '__main__':
    main()
