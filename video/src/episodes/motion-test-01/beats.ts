/**
 * Beat sheet for Motion Test 01 (10 s, 30 fps, 300 frames).
 * Every on-screen text item is listed with the frame it is fully readable
 * and the frame it starts leaving, so scripts/qc.mjs can check hold times.
 * When the approved narration is added, re-anchor `at` values to its
 * timestamps (see narration.json) — never stretch the audio.
 */
export const DURATION = 300;

export const B = {
  headlineA: 2,
  card: 6,
  typing: 14,
  line1: 30,
  line2: 54,
  line3: 70,
  saulRead: 26,
  saulCheer: 44, // premature celebration: "¡Te compro!"
  saulShock: 84, // "...si me entregas en EE. UU."
  burst: 86,
  burstOut: 108,
  saulShrug: 100,
  saulIdea: 112,
  bubble: 114,
  wipe: 154, // swap at 162
  headlineB: 166,
  chipsB: 172,
  hub: 190,
  house: 198,
  planeIn: 182,
  planeGo: 186,
  planeArrive: 222,
  doc: 222,
  stamp: 232,
  docOut: 262,
  vanGo: 236,
  vanArrive: 262,
  handoff: 262,
  ownerPin: 238,
  delivered: 268,
  brand: 268,
} as const;

/** On-screen text inventory + planned cuts live in qc.json (read by scripts/qc.mjs). */
