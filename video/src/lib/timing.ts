import {canvas} from '../brand/tokens';

export const FPS = canvas.fps;
/** seconds -> frames */
export const s = (seconds: number) => Math.round(seconds * FPS);

/**
 * Timing rules (enforced by scripts/qc.mjs on the episode's beat sheet):
 * - Readable hold: on-screen text must stay fully visible for
 *   max(0.8s, chars / 15 per second) before it leaves.
 * - Entrances: 8–14 frames. Exits: 6–10 frames. Never pop in < 4 frames.
 * - One new focal element at a time; stagger siblings by 3–6 frames.
 * - Character pose changes: at least 10 frames apart, joints overlap (see rig).
 * - Scene transitions: 10–16 frames, motivated (wipe follows the route / action).
 * - When narration exists, beats are anchored to narration timestamps, never
 *   the other way around: visuals move, the voice is never stretched.
 */
export const minHoldFrames = (text: string) =>
  Math.max(s(0.8), Math.ceil((text.replace(/\s+/g, ' ').length / 15) * FPS));
