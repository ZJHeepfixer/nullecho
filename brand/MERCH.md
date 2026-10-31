# "nah." merch: print spec for Printful

A hoodie and a t-shirt with the Nullecho "nah." line, printed on demand by Printful (DTG, direct-to-garment). The
print files are in `brand/merch/` and are made from `brand/` by a script, so they can be re-made and checked.
Requirements below were read from Printful's own pages on **2026-10-17**; Printful changes them per product, so
re-check the product's **File guidelines** tab before each order.

Jason is testing a hoodie. Which model wasn't specified, so files are made for Printful's two common hoodies and its
best-selling tee. If the test hoodie is a different model, read its File guidelines tab, add a line to `MERCH` in the
script with its front size, and re-run it.

## What goes on it

| Placement | Design | Why |
|---|---|---|
| **Front** (chest) | The dots beside lowercase **nah.** | BRAND.md: the wordmark sits *beside* the icon, never on it. Centred near the top of the print area so it sits on the chest and clears a hoodie's front pocket. |
| **Back** | Trackers: "Can we follow you around the internet?" / Nullecho: **Nah.** / nullecho.org | The full slogan, word for word from BRAND.md. It names the product, so the shirt never says "nah." without saying whose. |

The slogan makes no claim (it never says Nullecho blocks *all* tracking or lowers prices), so nothing printed here
needs a caveat. Keep it that way: nothing on merch about blocking every tracker, hiding anyone, or prices.

## Printful's requirements (cited)

Per product, from each product page's **File guidelines → DTG printing** tab (rendered in Chrome on 2026-10-17):

| Product (Printful catalog ID) | Placement | Max print area | Recommended print file | Our file at 300 DPI |
|---|---|---|---|---|
| [Unisex Heavy Blend Hoodie, Gildan 18500](https://www.printful.com/custom/mens/hoodies/unisex-heavy-blend-hoodie-gildan-18500) (146) | Front | S 11″ × 11″, M 11.5″, L 12″, XL 13″, 2–5XL 14″ × 14″ | 14″ × 14″ | 4200 × 4200 px |
| | Back | 12″ × 16″ (all sizes) | 12″ × 16″ | 3600 × 4800 px |
| [Unisex Premium Pullover Hoodie, Cotton Heritage M2580](https://www.printful.com/custom/mens/hoodies/unisex-premium-hoodie-cotton-heritage-m2580) (380) | Front | 10″ × 10″ – 13″ × 13″ ("Each hoodie has a different front print area due to the pocket. We will scale graphics proportionately.") | 13″ × 13″ | 3900 × 3900 px |
| | Back | 12″ × 16″ | 12″ × 16″ | 3600 × 4800 px |
| [Unisex Staple T-Shirt, Bella + Canvas 3001](https://www.printful.com/custom/mens/t-shirts/unisex-staple-t-shirt-bella-canvas-3001) (71) | Front | XS–M 11.5″ × 13.8″; from L 15″ × 18″ | the same, per size group | 3450 × 4140 px and 4500 × 5400 px |
| | Back | 12″ × 16″ | 12″ × 16″ | 3600 × 4800 px |

The back is 12″ × 16″ on all three, so one back file serves all of them.

Rules on those same tabs, and on Printful's guides:

- **PNG or JPEG, at least 150 DPI**; "Create files in sRGB color profile"; delete template guide layers before saving.
  (Product File guidelines tabs, above.)
- **150–300 DPI is the range; "it's best not to exceed 300 DPI."** Use a **transparent background** (PNG; "JPG files
  don't support transparent backgrounds"). 100% cotton prints most opaque; poly and tri-blends print faded.
  ([Printful: Create the perfect DTG file](https://www.printful.com/creating-dtg-file))
- **"Avoid semi-transparent designs"** (use solid colors). **"Black ink will appear gray on black garments because of
  the white underbase … Leave these areas fully transparent."** **Avoid perfect borders** (the print can warp).
  (Product File guidelines tabs, "Tips for best results".)
- **Max upload 200 MB.** ([Printful: How to prepare the perfect print file](https://www.printful.com/blog/everything-you-need-to-know-to-prepare-the-perfect-printfile))

How the files meet them: 300 DPI (the top of the range, and the pHYs chunk says 300 so Printful's checker reads it),
PNG with a fully transparent background, an sRGB chunk, solid fills only (the only partial transparency is
anti-aliasing on letter and dot edges), no borders, and no near-black ink in the dark versions. Each file is 95–191 KB.

## Which brand file

- **The dots** are read from `brand/nullecho-icon.svg` by the script, never redrawn.
- **Dark garments: the dots only, no tile.** The tile color `#0D1117` against a black garment is 1.04 : 1, so it would
  print as a faint grey square (Printful's underbase note above) and add nothing. The teal dots and teal **nah.** go
  straight on the fabric.
- **Light garments: the whole rounded tile** (`nullecho-icon.svg`), with the teal dots inside it. Teal straight on a
  white shirt is only 2.16 : 1, so on light colors the dots must sit on their own dark tile. The text is `#0D1117`.
- **Typeface: Inter** ExtraBold/Bold (SIL Open Font License 1.1, [rsms.me/inter](https://rsms.me/inter/)), which
  allows use in artwork you sell. The social cards use the computer's system font; that's fine for a post, but not
  something to print on a product for sale, so the merch script refuses to run without Inter.

## Colorways that keep the dots legible

Contrast is the WCAG ratio between the ink and the garment color, using **Printful's own catalog color codes**
(`api.printful.com/products/{id}`, variant `color_code`, read 2026-10-17). The bar is **4.5 : 1**, the text standard,
because "nah." is text and the dots are small. Screens and fabric differ: order one sample before anything else.

**Dark file** (teal `#56C3A4` on the fabric). Use it where teal is at least 4.5 : 1:

| Gildan 18500 hoodie | M2580 hoodie | Bella + Canvas 3001 tee |
|---|---|---|
| **Black 9.1** · Navy 8.1 · Maroon 6.9 · Dark Chocolate 6.9 · Forest Green 6.6 · Purple 5.6 | **Black 9.3** · Navy Blazer 7.7 · Charcoal Heather 4.8 · Vintage Black 4.7 | **Black 9.1** · Black Heather 9.1 · Vintage Black 8.5 · Oxblood Black 8.2 · Team Purple 7.9 · Navy 6.9 · Heather Emerald 6.8 · Brown 6.8 · Dark Grey 6.7 · Heather Midnight Navy 6.1 · Heather Navy 5.6 · Forest 5.5 · Dark Grey Heather 5.1 · Maroon 5.0 · True Royal 4.6 · Cardinal 4.6 |

**Light file** (the tile, and `#0D1117` text). Use it where `#0D1117` is at least 4.5 : 1, leaving out greens and
teals, which fight the dots even though they sit on their own tile:

| Gildan 18500 hoodie | M2580 hoodie | Bella + Canvas 3001 tee |
|---|---|---|
| **White 18.9** · Ash 14.1 · Light Pink 13.8 · Sand 12.9 · Light Blue 10.4 · Gold 10.3 · Azalea 9.8 · Carolina Blue 9.2 · Sport Grey 6.5 · Orange 6.0 · Heliconia 5.2 | **White 18.9** · Oatmeal Heather 17.0 · Bone 15.6 · Sky Blue 15.6 · Lavender 15.1 · Light Pink 13.7 · Carbon Grey 10.8 · Team Gold 9.9 · Carolina Blue 9.3 · Khaki 8.2 · Dusty Rose 6.3 · Latte 6.1 · Adobe 5.3 · Team Red 5.1 | **White 18.9** · Solid White Blend 18.4 · Heather Ice Blue 18.0 · Vintage White 17.3 · Natural 16.9 · Ash 16.6 · Heather Natural 15.8 · Silver 14.7 · Soft Pink 14.6 · Heather Prism Ice Blue 13.8 · Heather Dust 13.6 · Yellow 13.6 · Soft Cream 13.1 · Ocean Blue 13.1 · Baby Blue 13.0 · Light Blue 12.8 · Pink 12.1 · Athletic Heather 12.0 · Heather Prism Peach 11.9 · Lilac 11.6 · Heather Yellow Gold 11.0 · Heather Carolina Blue 10.6 · Tan 10.2 · Heather Prism Lilac 10.0 · Gold 9.1 · Mustard 8.7 · Burnt Orange 7.0 · Heather Orange 6.9 · Orange 6.8 · Toast 6.8 · Charity Pink 6.6 · Heather Columbia Blue 6.6 · Heather Orchid 6.4 · Heather Team Purple 6.2 · Heather Autumn 5.8 · Steel Blue 5.4 · Heather Red 5.4 · Pebble 5.4 · Mauve 5.1 · Heather Mauve 5.0 |

**Skip** (teal / tile ratio in brackets):

- **Mid-tones where neither file reaches 4.5 : 1.** Gildan 18500: Dark Heather (4.2 / 2.1), Charcoal (3.8 / 2.3), Royal
  (3.6 / 2.5), Heather Sport Dark Navy (3.2 / 2.7), Indigo Blue (3.2 / 2.8), Graphite Heather (2.6 / 3.4), Red
  (2.4 / 3.6). M2580: Maroon (4.4 / 2.0), Forest Green (4.1 / 2.2), Purple (4.0 / 2.2), Team Royal (4.0 / 2.2),
  Military Green (3.7 / 2.4). 3001: Military Green, Heather Forest, Asphalt, Heather Olive, Heather Brown, Army,
  Heather Slate, Olive, Heather Clay, Red, Berry, Heather Deep Teal, Heather Grass Green, Heather True Royal, Heather
  Raspberry, Autumn (teal between 2.1 and 4.1, tile under 4.5).
- **Greens and teals.** Gildan 18500 Irish Green and Military Green; 3001 Aqua, Kelly, Leaf, Mint, Heather Mint,
  Heather Kelly, Heather Prism Mint, Teal, Heather Aqua, Turquoise, Heather Prism Dusty Blue and Sage.

**First pick: Black**, dark file. Highest contrast on all three garments, and it's the brand's own dark ground. On the
Gildan 18500 (50/50 cotton/poly), expect the teal slightly softer than on the cotton-faced M2580 or the cotton 3001.

## The files

All PNG, RGBA, transparent background, 300 DPI, sRGB. `PREVIEW.png` shows every file on Printful's Black, Navy, White
and Ash swatches; it is a preview, not a print file.

| File | Placement | Product | Print size | Pixels |
|---|---|---|---|---|
| `merch/nah-front-hoodie-gildan18500-dark-4200x4200.png` | Front | Gildan 18500 | 14″ × 14″ | 4200 × 4200 |
| `merch/nah-front-hoodie-gildan18500-light-4200x4200.png` | Front | Gildan 18500 | 14″ × 14″ | 4200 × 4200 |
| `merch/nah-front-hoodie-m2580-dark-3900x3900.png` | Front | M2580 | 13″ × 13″ | 3900 × 3900 |
| `merch/nah-front-hoodie-m2580-light-3900x3900.png` | Front | M2580 | 13″ × 13″ | 3900 × 3900 |
| `merch/nah-front-tee-3001-xs-m-dark-3450x4140.png` | Front, XS–M | 3001 | 11.5″ × 13.8″ | 3450 × 4140 |
| `merch/nah-front-tee-3001-xs-m-light-3450x4140.png` | Front, XS–M | 3001 | 11.5″ × 13.8″ | 3450 × 4140 |
| `merch/nah-front-tee-3001-l-up-dark-4500x5400.png` | Front, L and up | 3001 | 15″ × 18″ | 4500 × 5400 |
| `merch/nah-front-tee-3001-l-up-light-4500x5400.png` | Front, L and up | 3001 | 15″ × 18″ | 4500 × 5400 |
| `merch/nah-back-slogan-12x16-dark-3600x4800.png` | Back | all three | 12″ × 16″ | 3600 × 4800 |
| `merch/nah-back-slogan-12x16-light-3600x4800.png` | Back | all three | 12″ × 16″ | 3600 × 4800 |

The front lockup is 68% of the print width (9.5″ on the 14″ hoodie front, 10″ at most) and starts 0.75″ below the top
of the print area. Everything stays at least 0.25″ inside the canvas; the script fails if anything doesn't.

## Ordering a sample

1. In Printful, pick the product and color, choose **DTG printing**, and upload the matching file to **Front print**
   and the back file to **Back print**. Don't resize them in the Design Maker; they're already the print-area size.
2. Check the mockup: the front should sit on the chest above the pocket.
3. Order **one** sample (black hoodie, dark files) and look at it in daylight before ordering more or listing it
   anywhere. Teal is the color most likely to shift between screen and fabric.
4. Before selling anything, decide where it's sold and how; that's a separate decision, and nothing here sets it up.

## Re-making the files

```bash
NULLECHO_PUPPETEER_DIR=/Users/jasonluker/bodybuilding \
  node harness/social/make-brand-files.mjs --merch-only --font-dir <folder with Inter-SemiBold/Bold/ExtraBold/Black.ttf>
```

The script also renders the press-kit icons (`--icons-only`). It refuses to write a file if a block leaves the
0.25″ margin, a corner isn't transparent, Inter didn't load, or the PNG isn't exactly inches × 300 px with a 300 DPI
pHYs and an sRGB chunk.

## Not verified

- How the teal actually prints. Contrast numbers come from Printful's catalog hex codes, which are screen colors; a
  sample is the only real check.
- That Printful's sizes stay as listed. They were read from the live product pages on 2026-10-17.
- The Inter files used were a local copy (version not recorded in the file names); any Inter release under the OFL
  will do.
