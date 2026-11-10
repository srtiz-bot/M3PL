# Hand asset preparation

The hand is the single biggest "produced vs amateur" tell. Requirements:

## Pose set (all photorealistic, transparent PNG)

| Pose | Use |
|---|---|
| draw-A (pen grip, nib down) | default drawing hand (left-to-right sweeps) |
| draw-B (same grip, rotated a few degrees / wrist tilted) | right-to-left sweeps — the engine swaps A/B by stroke direction; the swap IS the realistic wrist motion |
| drag (open hand / fingertips) | placing pop-in elements (use sparingly; prefer drawing) |
| erase (hand gripping folded cloth, pressed flat) | erase beats |

Generate via image model from ONE reference photo so skin/sleeve/marker
match across poses ("the SAME hand, same sleeve, same lighting, but ...").

## Long forearm — critical

The sleeve/forearm must run OFF the frame edge in typical compositions. A
forearm that ends mid-canvas with a crop line is the #1 amateur tell. If the
source photo's arm is short, outpaint the image to a wider aspect so the
sleeve reaches a corner, THEN background-remove. Re-roll outpaints that
hallucinate smudges or artifacts — inspect at full size.

## Nib calibration

For each pose, measure the marker tip (or cloth center) pixel coordinates in
the final cutout, scale to the display size used in the composition, and
store as that pose's NIB offset. The engine pins this point to the reveal
path tip / label ink edge. Verify with a snapshot: the tip must touch the
artwork edge being revealed. Set each hand's CSS `transform-origin` to its
nib so rotation jitter pivots around the pen tip.

## Sizing

Scale the hand near life-size relative to the viewport (roughly 40–60% of
frame height including forearm). Too small reads like a sticker; the arm
should plausibly reach from outside the frame.

## Lifecycle contract (enforced in choreography)

- Hand visible **iff** a stroke is in progress. Hide within ~0.05s of a
  stroke ending unless the next stroke starts immediately (`keep` only for
  back-to-back strokes — audit every `keep` against the timeline).
- Between elements with a gap, the hand exits (fade+hide) and re-enters.
- The hand writes every label; nib rides the clip-path reveal edge.
- Erase hand sweeps must cover the erased region's full extent — verify
  leftover-free with snapshots before and after the erase beat.
