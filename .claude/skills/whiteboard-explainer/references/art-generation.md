# Art generation for whiteboard explainers

Mechanics for producing the illustration set. Style itself (line character,
palette, subject styling) is designed fresh with the user every project —
never reuse a previous video's look.

## 1. Decompose the script into elements FIRST

For each narration line, list every visual that appears at its own moment.
Each of those is **one element = one image**. Examples of "own moment":
- appears on a different keyword than its neighbors,
- gets erased later while neighbors stay,
- gets emphasized (circled/crossed) as a separate beat.

Static companions that always appear together may share one image.

## 2. Generate elements ISOLATED

Prompt each element as: *"[element description], isolated on a pure white
background, generous margin, no text anywhere"* + the project's style block.

- **Style block**: write ONE style paragraph with the user's chosen direction
  (line weight character, shading approach, 1–2 accent colors max — a
  limited accent palette reads produced, full color reads cheap). Reuse that
  exact paragraph verbatim across every generation in the project for
  coherence. It is a per-project artifact — do not carry it between projects.
- **Recurring characters**: generate a character turnaround sheet first,
  then pass it as a reference image to every scene featuring them.
- **White-on-white compositing**: black-line art on pure white needs no
  alpha — composite with `mix-blend-mode: multiply` ON THE WRAPPER div (see
  engine notes). Use background removal only for elements that must overlap
  other artwork.
- **Resolution**: `source pixels ≥ rendered size × max camera scale` for
  every element the camera pushes into. Upscale winners rather than
  generating everything huge.
- **No text in images**: all text is hand-written by the engine's label
  system so it can be timed to the VO. (Exception: text that is part of the
  object, e.g. a year on a ship's hull, is fine and often charming.)

## 3. QA the set

Build a contact sheet of every generated element and review before wiring:
consistent style, correct content, nothing clipped at image borders, no
stray fragments of other elements.

## 4. Fallback: splitting composite art

If a needed element only exists inside a composite image (or a generation
came back with two elements fused), split it with
`scripts/isolate-elements.py`:
- `comps` mode — connected-component labeling: strokes that physically touch
  travel together; classify components by seed point / zone.
- `color` mode — select by color channel difference (e.g. amber threads out
  of black linework).
- `poly` mode — polygon cut for cleanly separable regions.
- `move-specks` — relocate small stray components (shading ticks, connector
  lines) to the image whose reveal moment they belong to.

After any split, re-run the contact sheet + `scripts/coverage-check.py`.
Pixel-scan ambiguous boundaries (interleaved strokes) rather than guessing.
