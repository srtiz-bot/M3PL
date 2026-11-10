# Reveal engine — contract and invariants

Use [templates/reveal-engine.js](../templates/reveal-engine.js) as the
starting point; it encodes everything below. Read `/hyperframes-core` for
the framework contract (paused timeline on `window.__timelines`,
determinism, `class="clip"` timing).

## Structure

- One oversized **mural world** inside a camera wrapper
  (`transform-origin: 0 0`); a `camAt/camTo` helper computes
  `translate = viewportCenter − worldPoint × scale`.
- Each element = an `.artblock` div (absolutely positioned in world space)
  containing an SVG with `<mask>` (black rect base) + the element `<image>`
  referencing that mask. Stacked elements of one scene share identical
  position/size so their images align.

## Invariants (each one is a debugged production bug)

1. **`mix-blend-mode: multiply` goes on the `.artblock` WRAPPER, never on
   the masked `<image>`** — blending on the masked element forces it onto a
   separate compositor layer in Chrome and the SVG mask leaks (art shows
   before it is drawn).
2. **Serpentine rows are stroke centerlines inset by sw/2** so painted
   coverage (stroke + round caps) exactly matches the declared rect. Because
   caps scallop near row ends, content must sit within the horizontal safe
   zone `[x0+sw/2, x1−sw/2]` — with one-image-per-element, simply overshoot
   rects generously into blank space (e.g. `[-80, -80, W+80, H+80]`).
   Enforce with `scripts/coverage-check.py`.
3. **Row step ≤ stroke width** (`step = (h − sw)/(rows−1)`), else thin
   unrevealed stripes cross the art. The template warns at build time.
4. **Reveal = `stroke-dashoffset` on the mask path**, `ease:"none"`,
   `getTotalLength() || fallback`, art block `autoAlpha: 0` until its first
   draw (guards a layout-race flash at t=0).
5. **Hand follower** is a proxy-tween `onUpdate` reading
   `getPointAtLength` — a pure function of progress (seek-safe). Direction
   (ahead.x − pt.x) selects the A/B hand pose. Small sine jitter around the
   nib origin sells the hand-drawn feel; the CANVAS never drifts.
6. **Labels**: absolutely positioned divs revealed by
   `clip-path: inset(0 calc((1 − var(--rv)) * 100%) 0 0)`; the hand's nib
   tracks `x = left + progress × inkWidth`. The label class needs
   `padding-right: ~0.22em` — italic/hand fonts overhang their layout box
   and the clip cuts the last glyph without it. Verify each label fits its
   camera framing (label box inside viewport rect at that camera stop).
7. **Camera**: locked between moves — no idle drift/breathing (breaks the
   drawn-on-paper illusion). Never run a mask reveal while the camera
   travels; land the pan, then draw. Ending on a wide pull-back revealing
   the whole mural is the classic closer — worth offering.
8. **Erase beats**: black serpentine strokes appended to the SAME mask
   (later siblings win) with the cloth hand riding. Because the erased
   element is its own image, the erase rect can overshoot freely without
   touching neighbors.
9. **Timing source**: every `at` value in the choreography must trace to the
   Whisper word map (word start for labels; "finishes at or just before the
   keyword" for drawings). Comment each scene block with its word times.
10. **One gesture per element**: a single element's chunks draw
    back-to-back with no stall; if narration leaves a long gap inside one
    element's beat, slow the single gesture rather than pausing mid-draw.
