/* ============================================================================
 * Whiteboard reveal engine (HyperFrames) — battle-tested template.
 * Inline this in the composition <script> (lint requires inline registration).
 * Replace EXAMPLE data; keep every invariant comment — each one is a fixed bug.
 *
 * Required CSS (verbatim; values marked <adjust> are per-project):
 *   .artblock { position: absolute; mix-blend-mode: multiply; }   // multiply on
 *     WRAPPER — on the masked <image> Chrome drops the mask (art leaks early)
 *   .artblock svg { display: block; overflow: visible; }
 *   .revealPath { fill: none; stroke: #fff; stroke-linecap: round; stroke-linejoin: round; }
 *   .erasePath  { fill: none; stroke: #000; stroke-linecap: round; stroke-linejoin: round; }
 *   .hand { position: absolute; width: <adjust>px; height: <adjust>px;
 *           will-change: transform; pointer-events: none; }
 *   .lbl  { position: absolute; white-space: nowrap; padding-right: 0.22em; //
 *           padding guards italic glyph overhang vs the clip box (clipped "!")
 *           clip-path: inset(0 calc((1 - var(--rv, 0)) * 100%) 0 0); }
 *
 * Required HTML per element (all elements of one scene share position/size):
 *   <div class="artblock" id="el1" style="left:Xpx; top:Ypx; width:Wpx; height:Hpx;">
 *     <svg width="W" height="H" viewBox="0 0 IW IH">
 *       <defs><mask id="mk-el1" maskUnits="userSpaceOnUse" x="0" y="0" width="IW" height="IH">
 *         <rect x="0" y="0" width="IW" height="IH" fill="#000"></rect>
 *       </mask></defs>
 *       <image id="el1img" href="assets/img/el1.png" x="0" y="0" width="IW" height="IH"
 *              mask="url(#mk-el1)"></image>
 *     </svg>
 *   </div>
 * ========================================================================== */
window.__timelines = window.__timelines || {};
const tl = gsap.timeline({ paused: true });
const SVGNS = "http://www.w3.org/2000/svg";

/* ---- art registry: world placement + viewBox->world scale per art group ---- */
const ARTS = {
  // EXAMPLE: el1: { x: 150, y: 450, k: displayWidth / viewBoxWidth },
};

/* ---- serpentine reveal generator ----------------------------------------
 * Rows are stroke CENTERLINES inset by sw/2: painted coverage (stroke body +
 * round caps) stays exactly inside [x0..x1]x[y0..y1]. Caps scallop near row
 * ends, so an element's ink must sit within the horizontal safe zone
 * [x0+sw/2, x1-sw/2] — with one-image-per-element just overshoot the rect
 * generously into blank space, e.g. [-80, -80, IW+80, IH+80].
 * Row step must stay <= sw or thin unrevealed stripes cross the art.      */
function serp(x0, y0, x1, y1, rows, sw) {
  const ix0 = x0 + sw / 2, ix1 = x1 - sw / 2;
  const iy0 = y0 + sw / 2, iy1 = y1 - sw / 2;
  const step = (iy1 - iy0) / Math.max(1, rows - 1);
  let d = `M${ix0} ${Math.round(iy0)}`;
  for (let i = 0; i < rows; i++) {
    d += ` H${i % 2 === 0 ? ix1 : ix0}`;
    if (i < rows - 1) d += ` V${Math.round(iy0 + step * (i + 1))}`;
  }
  return d;
}
function chunk(maskId, id, rect, rows, sw, erase = false) {
  const step = (rect[3] - rect[1] - sw) / Math.max(1, rows - 1);
  if (step > sw) console.warn(`chunk ${id}: row step ${step} > stroke ${sw} — gap stripes!`);
  const p = document.createElementNS(SVGNS, "path");
  p.setAttribute("id", id);
  p.setAttribute("class", erase ? "erasePath" : "revealPath");
  p.setAttribute("stroke-width", sw);
  p.setAttribute("d", serp(rect[0], rect[1], rect[2], rect[3], rows, sw));
  document.getElementById(maskId).appendChild(p);
  return p;
}
// EXAMPLE: chunk("mk-el1", "c-el1", [-80, -80, 1456, 848], 7, 150);
// Erase beats: append a BLACK chunk to the SAME mask (later siblings win):
// EXAMPLE: chunk("mk-el1", "c-el1-erase", [-80, -80, 1456, 848], 5, 200, true);

/* ---- virtual camera -------------------------------------------------------
 * LOCKED between moves: no idle drift/breathing — a floating canvas breaks
 * the drawn-on-paper illusion. Never run a reveal while the camera travels.
 * VIEW_W/VIEW_H = composition size. Camera wrapper: transform-origin 0 0.  */
const cameraEl = document.getElementById("camera");
const VIEW_W = 1920, VIEW_H = 1080;
const cam = { scale: 1, x: 0, y: 0 };
function applyCamera() {
  cameraEl.style.transform = `translate(${cam.x}px, ${cam.y}px) scale(${cam.scale})`;
}
function camAt(wx, wy, s) { return { scale: s, x: VIEW_W / 2 - wx * s, y: VIEW_H / 2 - wy * s }; }
function camTo(wx, wy, s, dur, at, ease = "power2.inOut") {
  tl.to(cam, { ...camAt(wx, wy, s), duration: dur, ease, onUpdate: applyCamera }, at);
}
// EXAMPLE initial framing: Object.assign(cam, camAt(950, 900, 1.06)); applyCamera();

/* ---- hands ----------------------------------------------------------------
 * Two near-identical draw poses (A: default sweep, B: opposite sweep — the
 * swap by stroke direction IS the wrist realism), plus an erase-cloth pose.
 * NIB = marker-tip pixel offset inside the displayed hand element (measure
 * per pose, see hand-prep.md). transform-origin at the nib so jitter pivots
 * around the pen tip.                                                       */
const handA = document.getElementById("handA");
const handB = document.getElementById("handB");
const handE = document.getElementById("handE");
const NIB = {
  a: { x: 0, y: 0 }, // EXAMPLE: measure!
  b: { x: 0, y: 0 },
  e: { x: 0, y: 0 },
};
handA.style.transformOrigin = `${NIB.a.x}px ${NIB.a.y}px`;
handB.style.transformOrigin = `${NIB.b.x}px ${NIB.b.y}px`;
handE.style.transformOrigin = `${NIB.e.x}px ${NIB.e.y}px`;
function hideHands(at) { tl.set([handA, handB, handE], { autoAlpha: 0 }, at); }

/* ---- draw: stroke (mask chunk or visible marker path) + hand rider --------
 * Deterministic/seek-safe: hand transform is a pure function of progress.
 * HAND LIFECYCLE CONTRACT: hand visible iff a stroke is in progress. Pass
 * { keep: true } ONLY when another stroke starts immediately after — audit
 * every keep flag; a leftover keep = hand hovering awkwardly mid-air.      */
function draw(pathOrId, artKey, dur, at, opts = {}) {
  const path = typeof pathOrId === "string" ? document.getElementById(pathOrId) : pathOrId;
  const art = ARTS[artKey];
  const len = (path.getTotalLength() || 6000) * 1.02;
  path.style.strokeDasharray = `${len}`;
  path.style.strokeDashoffset = `${len}`;
  tl.to(path, { strokeDashoffset: 0, duration: dur, ease: "none" }, at);
  if (opts.hand === "none") return;
  const erase = opts.hand === "erase";
  const proxy = { p: 0 };
  tl.to(proxy, {
    p: 1, duration: dur, ease: "none",
    onUpdate: () => {
      const L = path.getTotalLength();
      const d = Math.min(L, proxy.p * L);
      const pt = path.getPointAtLength(d);
      const ahead = path.getPointAtLength(Math.min(L, d + 3));
      const back = (ahead.x - pt.x) < -0.5;
      const active = erase ? handE : (back ? handB : handA);
      const idles = erase ? [handA, handB] : (back ? [handA] : [handB]);
      const nib = erase ? NIB.e : (back ? NIB.b : NIB.a);
      const jitter = Math.sin(proxy.p * 34) * 2.2; // hand wobble, NOT canvas wobble
      active.style.opacity = 1; active.style.visibility = "visible";
      idles.forEach((h) => { h.style.opacity = 0; h.style.visibility = "hidden"; });
      active.style.transform =
        `translate(${art.x + pt.x * art.k - nib.x}px, ${art.y + pt.y * art.k - nib.y}px) rotate(${jitter}deg)`;
    },
  }, at);
  if (!opts.keep) hideHands(at + dur + 0.05);
}

/* ---- drawLbl: the hand WRITES a label --------------------------------------
 * clip-path reveal + nib riding the ink edge. `at` MUST come from the
 * Whisper word map: start writing AS the word is spoken. w = ink width in
 * px (estimate, then verify with a snapshot).                              */
function drawLbl(id, at, dur, w, opts = {}) {
  const el = document.querySelector(id);
  const lx = el.offsetLeft, ly = el.offsetTop;
  const fh = parseFloat(getComputedStyle(el).fontSize) || 90;
  const baseY = ly + fh * 0.72;
  tl.set(id, { autoAlpha: 1 }, at);
  tl.to(id, { "--rv": 1, duration: dur, ease: "none" }, at);
  const proxy = { p: 0 };
  tl.to(proxy, {
    p: 1, duration: dur, ease: "none",
    onUpdate: () => {
      const jitter = Math.sin(proxy.p * 40) * 1.6;
      const wob = Math.sin(proxy.p * 26) * fh * 0.06;
      handA.style.opacity = 1; handA.style.visibility = "visible";
      handB.style.opacity = 0; handB.style.visibility = "hidden";
      handE.style.opacity = 0; handE.style.visibility = "hidden";
      handA.style.transform =
        `translate(${lx + proxy.p * w - NIB.a.x}px, ${baseY + wob - NIB.a.y}px) rotate(${jitter}deg)`;
    },
  }, at);
  if (!opts.keep) hideHands(at + dur + 0.05);
}

/* ---- initial state ---------------------------------------------------------
 * Every art block, marker overlay, label, and hand hidden at t=0 (also
 * guards the getTotalLength layout race). Reveal each art block via
 * tl.set(..., { autoAlpha: 1 }, firstDrawTime - 0.05).                      */
// EXAMPLE:
// tl.set(["#el1", "#el2"], { autoAlpha: 0 }, 0);
// tl.set(allLabels, { autoAlpha: 0, "--rv": 0 }, 0);
// tl.set([handA, handB, handE], { autoAlpha: 0 }, 0);

/* ---- choreography -----------------------------------------------------------
 * One block per scene, commented with its Whisper word times. Rules:
 * - element finishes drawing at or just before its keyword
 * - one continuous gesture per element (no partial-then-stall)
 * - labels start ON the spoken word
 * - camera lands BEFORE any reveal starts; whoosh SFX on pan starts
 * EXAMPLE:
 * // S1 (0.5-7.5) - "cloud" @5.13 / "not true" @6.35
 * tl.set("#el1", { autoAlpha: 1 }, 0.7);
 * draw("c-el1", "el1", 2.6, 0.8);
 * drawLbl("#lbl1", 5.1, 0.6, 520);
 */

// End-of-timeline anchor = total duration (audio-driven, from the word map):
// tl.set({}, {}, TOTAL_DURATION);
window.__timelines["main"] = tl; // key must match data-composition-id
