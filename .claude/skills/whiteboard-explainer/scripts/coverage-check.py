#!/usr/bin/env python
"""Reveal-coverage gate: every element's ink must sit inside its serpentine's
full-coverage zone, or parts of the art will scallop out / never appear.

Usage:
    python coverage-check.py chunks.json

chunks.json (author it from the composition's chunk() calls):
[
  { "image": "assets/img/el1.png",       # element image (viewBox pixels)
    "rect":  [-80, -80, 1456, 848],      # chunk rect [x0, y0, x1, y1]
    "sw":    150 },                      # stroke width
  ...
]

Rules checked (see references/reveal-engine.md):
- horizontal safe zone: ink x within [x0 + sw, x1 - sw]  (sw/2 inset rows +
  sw/2 cap-chord margin — conservative on purpose)
- vertical: ink y within [y0, y1]
- row step <= sw is the engine's own build-time warning; not checked here.

Exit 1 on any violation; prints per-element margins either way.
"""
import json, sys
from PIL import Image

INK_THRESHOLD = 235  # gray value below which a pixel counts as ink

def ink_bbox(path):
    im = Image.open(path).convert("L")
    bbox = im.point(lambda v: 255 if v < INK_THRESHOLD else 0).getbbox()
    return bbox  # (x0, y0, x1, y1) or None if blank

def main():
    cfg = json.load(open(sys.argv[1], encoding="utf-8"))
    failed = False
    for c in cfg:
        bbox = ink_bbox(c["image"])
        if bbox is None:
            print(f"?? {c['image']}: no ink found — wrong image?")
            failed = True
            continue
        x0, y0, x1, y1 = c["rect"]
        sw = c["sw"]
        sx0, sx1 = x0 + sw, x1 - sw
        ok = bbox[0] >= sx0 and bbox[2] <= sx1 and bbox[1] >= y0 and bbox[3] <= y1
        status = "OK " if ok else "FAIL"
        print(f"{status} {c['image']}: ink=({bbox[0]},{bbox[1]})-({bbox[2]},{bbox[3]}) "
              f"safe-x=[{sx0},{sx1}] rect-y=[{y0},{y1}] "
              f"margins L{bbox[0]-sx0} R{sx1-bbox[2]} T{bbox[1]-y0} B{y1-bbox[3]}")
        if not ok:
            failed = True
    sys.exit(1 if failed else 0)

if __name__ == "__main__":
    main()
