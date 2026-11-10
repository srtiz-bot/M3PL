# QA gates

Run these in order. A gate that fails blocks progress — fix and re-run.
Painted pixels are ground truth; never trust logs or intentions over frames.

## G1 — VO integrity (after every TTS generation)
- Whisper transcript (`scripts/word-times.py` prints it) contains every
  scripted word — catches corrupted/truncated takes.
- Durations measured from files with ffprobe, not API metadata.
- Flag unnatural pauses to the user early (ellipses in the script often
  cause them); re-record rather than working around.

## G2 — art set
- Contact sheet of every element image: style-consistent, complete, nothing
  touching image borders, no fragments of other elements.
- `scripts/coverage-check.py chunks.json` passes for every element.

## G3 — build sanity
- `npx hyperframes lint` + `validate` + `inspect`: 0 errors.
- Grep the choreography: every `keep: true` justified by an immediately
  following stroke; every `at` traceable to the word map.

## G4 — full-frame audit (the big one)
Snapshot the ENTIRE timeline at 2-second intervals
(`npx hyperframes snapshot --at 1,3,5,...`) and inspect every frame:
- [ ] nothing cropped: heads, frames, ornaments intact at every moment
- [ ] no floating fragments (pieces of an element visible before its beat)
- [ ] no element stalls partially drawn while narration continues
- [ ] every label fully readable: inside the camera framing, trailing glyph
      not clipped, not overlapping art or other labels
- [ ] hand only on screen mid-stroke; nib touches what's being revealed
- [ ] erase beats leave zero residue (check the frame after each erase)
- [ ] no neighbor-scene art intruding in frame corners at any camera stop
- [ ] final pull-back (if used) shows a complete, coherent mural

Fix everything found, then RE-RUN the full audit — fixes cause regressions.

## G5 — live player verification
CLI snapshots and the studio player can diverge when the studio server is
stale (it survives many external file edits with an old in-memory copy).
After heavy edits: restart `hyperframes preview --force-new`, open the NEW
port, and spot-check key beats in the actual player (browser tools if
available). Advise the user to hard-refresh / use a fresh tab.

## G6 — audio mix
- Measure VO and BGM with ffmpeg `volumedetect`; start the bed ~12 dB under
  narration and tune with the user.
- SFX quiet relative to VO; ask about SFX taste rather than assuming
  (per-stroke scribble sounds are OFF by default — offer them).
- BGM must cover the full duration with a clean ending fade.

## G7 — sign-off then render
User watches the preview end-to-end and approves. Only then render
(`-q high`). Verify the output file's duration and size with ffprobe.
