import {spring} from 'remotion';
import {FPS} from '../lib/timing';
import {BASE} from './poses';
import type {Channels, HandShape, Key, RigState} from './types';

/**
 * Overlapping action: joints further down the chain start later, so a gesture
 * travels shoulder -> elbow -> wrist instead of the whole arm snapping.
 */
const DELAY: Partial<Record<keyof Channels, number>> = {
  Lel: 2, Rel: 2, Lwr: 4, Rwr: 4, headTilt: 3, headTurn: 2, gazeX: 0, gazeY: 0, wave: 3,
};
const HAND_DELAY = 4; // hand shape crossfade starts with the wrist
const HAND_FADE = 5;

const springP = (dt: number, stiffness: number) =>
  dt <= 0 ? 0 : spring({frame: dt, fps: FPS, config: {damping: 14, mass: 0.9, stiffness}});

/** Small anticipation dip (opposite direction) during the first frames of a move. */
const anticip = (dt: number) => (dt > 0 && dt < 7 ? 0.06 * Math.sin((Math.PI * dt) / 7) : 0);

const evalChannel = (keys: Key[], ch: keyof Channels, frame: number) => {
  const d = DELAY[ch] ?? 0;
  const v0 = keys[0].pose[ch] ?? BASE[ch];
  let from = v0;
  let to = v0;
  let t0 = 0;
  let stiff = 120;
  const seg = (a: number, b: number, dt: number, k: number) => a + (b - a) * (springP(dt, k) - anticip(dt));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    const start = k.at + d;
    if (frame < start) break;
    const target = k.pose[ch];
    if (target === undefined) continue; // key doesn't touch this channel
    from = seg(from, to, start - t0, stiff);
    to = target;
    t0 = start;
    stiff = k.snap ?? 120;
  }
  return seg(from, to, frame - t0, stiff);
};

const evalHand = (keys: Key[], side: 'handL' | 'handR', frame: number): Record<HandShape, number> => {
  const w: Record<HandShape, number> = {open: 0, point: 0, fist: 0, thumbsUp: 0};
  let prev: HandShape = keys[0].pose[side] ?? 'open';
  let cur = prev;
  let t0 = -999;
  for (let i = 1; i < keys.length; i++) {
    if (keys[i].at + HAND_DELAY > frame) break;
    const s = keys[i].pose[side];
    if (s && s !== cur) {
      prev = cur;
      cur = s;
      t0 = keys[i].at + HAND_DELAY;
    }
  }
  const p = Math.min(1, Math.max(0, (frame - t0) / HAND_FADE));
  w[prev] += 1 - p;
  w[cur] += p;
  return w;
};

export const evalRig = (keys: Key[], frame: number, seed = 0): RigState => {
  const out = {} as Channels;
  (Object.keys(BASE) as (keyof Channels)[]).forEach((ch) => {
    out[ch] = evalChannel(keys, ch, frame);
  });
  const f = frame + seed * 37;
  // Idle life layer: tiny, slow, per-joint — never a whole-body bob.
  const breath = Math.sin(f / 22);
  out.lean += 0.6 * Math.sin(f / 41);
  out.headTilt += 1.3 * Math.sin(f / 33 + 1);
  out.Lsh += 1.2 * Math.sin(f / 29);
  out.Rsh += 1.2 * Math.sin(f / 31 + 2);
  // Wave: sinusoid on elbow + lagged wrist, faded by the 'wave' channel.
  out.Rel += out.wave * 18 * Math.sin(f * 0.5);
  out.Rwr += out.wave * 14 * Math.sin(f * 0.5 - 0.9);
  // Blink: 5-frame close/open every ~3.3s, deterministic.
  const phase = (f + 40) % 100;
  const blink = phase < 5 ? Math.sin((phase / 5) * Math.PI) : 0;
  return {...out, handL: evalHand(keys, 'handL', frame), handR: evalHand(keys, 'handR', frame), blink, breath};
};
