import {Easing, interpolate, spring} from 'remotion';
import {FPS} from './timing';

export const ease = {
  out: Easing.bezier(0.16, 1, 0.3, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  in: Easing.bezier(0.7, 0, 0.84, 0),
};

/** 0→1 progress between two frames with easing, clamped. */
export const prog = (frame: number, from: number, dur: number, easing = ease.out) =>
  interpolate(frame, [from, from + dur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing,
  });

/** Springy pop (slight overshoot) starting at `from`. */
export const pop = (frame: number, from: number, damping = 11, mass = 0.7) =>
  spring({frame: frame - from, fps: FPS, config: {damping, mass, stiffness: 160}});

/** Smooth settle without overshoot. */
export const settle = (frame: number, from: number) =>
  spring({frame: frame - from, fps: FPS, config: {damping: 200}});

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Deterministic pseudo-random for jitter/grain (same every render). */
export const rand = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};
