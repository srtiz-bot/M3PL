#!/usr/bin/env python
"""Split composite artwork into per-element images (fallback tool — prefer
generating elements isolated in the first place; see art-generation.md).

All outputs keep the source canvas size (white elsewhere) so stacked
artblocks align 1:1.

Subcommands:

  poly SRC OUT_INSIDE OUT_REST --points x1,y1 x2,y2 ...
      Polygon cut: OUT_INSIDE gets the polygon region, OUT_REST the rest.
      Use only for cleanly separable regions — pixel-scan interleaved
      boundaries first (print an ASCII ink map) instead of guessing.

  comps SRC OUT_A OUT_B --seed-b x,y [--zone-a x0,y0,x1,y1]
      Connected-component split (8-connectivity): the component containing
      --seed-b (and everything touching it) goes to OUT_B; remaining
      components go to OUT_A if their centroid falls inside --zone-a
      (default: everywhere). Strokes that physically touch travel together —
      this beats any polygon for interleaved elements.

  color SRC OUT_SEL OUT_REST --min-rb-diff 35 [--zone x0,y0,x1,y1] [--dilate 4]
      Color-based select: pixels where R-B exceeds the threshold (warm
      accents out of black linework), dilated to catch their dark outlines.

  move-specks SRC_FROM SRC_TO --zone x0,y0,x1,y1 --max-px 3000
      Move small stray components (connector lines, shading ticks) whose
      bbox sits fully inside the zone from one image to another. Use when a
      fragment reveals at the wrong moment.

Requires: pip install pillow scipy numpy
"""
import argparse, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

INK = 235

def load(path):
    im = Image.open(path).convert("RGB")
    arr = np.array(im)
    gray = np.array(im.convert("L"))
    return arr, gray < INK

def save_masked(arr, mask, path):
    white = np.full_like(arr, 255)
    Image.fromarray(np.where(mask[..., None], arr, white)).save(path)
    print(f"wrote {path} ({int(mask.sum())} ink px)")

def parse_xy(s): return tuple(int(v) for v in s.split(","))

def cmd_poly(a):
    arr, ink = load(a.src)
    m = Image.new("L", (arr.shape[1], arr.shape[0]), 0)
    ImageDraw.Draw(m).polygon([parse_xy(p) for p in a.points], fill=255)
    poly = np.array(m) > 0
    save_masked(arr, poly, a.out_inside)
    save_masked(arr, ~poly, a.out_rest)

def cmd_comps(a):
    arr, ink = load(a.src)
    lab, n = ndimage.label(ink, structure=np.ones((3, 3)))
    sx, sy = parse_xy(a.seed_b)
    bid = lab[sy, sx]
    if bid == 0:
        sys.exit(f"seed-b ({sx},{sy}) hit background — pick a pixel on the element's ink")
    mask_b = lab == bid
    mask_a = np.zeros_like(ink)
    zone = tuple(int(v) for v in a.zone_a.split(",")) if a.zone_a else None
    for cid in range(1, n + 1):
        if cid == bid: continue
        sel = lab == cid
        cy, cx = ndimage.center_of_mass(sel)
        if zone is None or (zone[0] <= cx <= zone[2] and zone[1] <= cy <= zone[3]):
            mask_a |= sel
        else:
            mask_b |= sel
    mask_a = ndimage.binary_dilation(mask_a, iterations=2) & ~mask_b
    save_masked(arr, mask_a, a.out_a)
    save_masked(arr, mask_b | (ink & ~mask_a), a.out_b)

def cmd_color(a):
    arr, ink = load(a.src)
    R, B = arr[..., 0].astype(int), arr[..., 2].astype(int)
    sel = (R - B > a.min_rb_diff) & ink
    if a.zone:
        z = tuple(int(v) for v in a.zone.split(","))
        zm = np.zeros_like(ink); zm[z[1]:z[3], z[0]:z[2]] = True
        sel &= zm
        grown = ndimage.binary_dilation(sel, iterations=a.dilate) & ink & zm
    else:
        grown = ndimage.binary_dilation(sel, iterations=a.dilate) & ink
    save_masked(arr, grown | sel, a.out_sel)
    save_masked(arr, ink & ~(grown | sel), a.out_rest)

def cmd_move_specks(a):
    arr_f, ink_f = load(a.src_from)
    arr_t = np.array(Image.open(a.src_to).convert("RGB"))
    z = tuple(int(v) for v in a.zone.split(","))
    lab, n = ndimage.label(ink_f, structure=np.ones((3, 3)))
    moved = 0
    for cid in range(1, n + 1):
        sel = lab == cid
        if sel.sum() > a.max_px: continue
        ys, xs = np.where(sel)
        if xs.min() >= z[0] and ys.min() >= z[1] and xs.max() <= z[2] and ys.max() <= z[3]:
            sel_d = ndimage.binary_dilation(sel, iterations=2)
            arr_t[sel_d] = arr_f[sel_d]
            arr_f[sel_d] = 255
            moved += 1
    Image.fromarray(arr_f).save(a.src_from)
    Image.fromarray(arr_t).save(a.src_to)
    print(f"moved {moved} components {a.src_from} -> {a.src_to}")

def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("poly"); p.add_argument("src"); p.add_argument("out_inside"); p.add_argument("out_rest")
    p.add_argument("--points", nargs="+", required=True); p.set_defaults(f=cmd_poly)
    p = sub.add_parser("comps"); p.add_argument("src"); p.add_argument("out_a"); p.add_argument("out_b")
    p.add_argument("--seed-b", required=True); p.add_argument("--zone-a"); p.set_defaults(f=cmd_comps)
    p = sub.add_parser("color"); p.add_argument("src"); p.add_argument("out_sel"); p.add_argument("out_rest")
    p.add_argument("--min-rb-diff", type=int, default=35); p.add_argument("--zone")
    p.add_argument("--dilate", type=int, default=4); p.set_defaults(f=cmd_color)
    p = sub.add_parser("move-specks"); p.add_argument("src_from"); p.add_argument("src_to")
    p.add_argument("--zone", required=True); p.add_argument("--max-px", type=int, default=3000)
    p.set_defaults(f=cmd_move_specks)
    a = ap.parse_args()
    a.f(a)

if __name__ == "__main__":
    main()
