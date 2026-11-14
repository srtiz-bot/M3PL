import type {Channels, Pose} from './types';

export const BASE: Channels = {
  lean: 0, headTilt: 0, headTurn: 0, gazeX: 0, gazeY: 0,
  browRaise: 0, browWorry: 0, eyeOpen: 1, mouthW: 34, mouthOpen: 0, smile: 0.5,
  sweat: 0, wave: 0,
  Lsh: 12, Lel: 14, Lwr: 4, Rsh: 12, Rel: 14, Rwr: 4,
};

/** Body poses (arms + torso). Combine with an expression: {...POSE.x, ...EXPR.y} */
export const POSE = {
  idle: {Lsh: 12, Lel: 14, Lwr: 4, Rsh: 12, Rel: 14, Rwr: 4, lean: 0, wave: 0, handL: 'open', handR: 'open'},
  wave: {Rsh: 128, Rel: -38, Rwr: 0, wave: 1, Lsh: 12, Lel: 14, Lwr: 4, handR: 'open', handL: 'open'},
  handsUp: {Lsh: 125, Lel: -40, Lwr: -10, Rsh: 125, Rel: -40, Rwr: -10, lean: 0, wave: 0, handL: 'open', handR: 'open'},
  think: {Rsh: -15, Rel: 150, Rwr: 8, Lsh: -10, Lel: 80, Lwr: 0, lean: -2, wave: 0, handR: 'fist', handL: 'fist'},
  pointUp: {Rsh: 158, Rel: 8, Rwr: 0, Lsh: 12, Lel: 14, Lwr: 4, lean: -3, wave: 0, handR: 'point', handL: 'open'},
  pointRight: {Rsh: 92, Rel: 6, Rwr: -4, Lsh: 14, Lel: 18, Lwr: 4, lean: -4, wave: 0, handR: 'point', handL: 'open'},
  pointLeft: {Lsh: 92, Lel: 6, Lwr: -4, Rsh: 14, Rel: 18, Rwr: 4, lean: 4, wave: 0, handL: 'point', handR: 'open'},
  presentLeft: {Lsh: 62, Lel: 30, Lwr: -25, Rsh: 14, Rel: 20, Rwr: 4, lean: 3, wave: 0, handL: 'open', handR: 'open'},
  thumbsUp: {Rsh: 50, Rel: -128, Rwr: 0, Lsh: 14, Lel: 18, Lwr: 4, lean: -2, wave: 0, handR: 'thumbsUp', handL: 'open'},
  shrug: {Lsh: 35, Lel: -55, Lwr: -20, Rsh: 35, Rel: -55, Rwr: -20, lean: 0, wave: 0, handL: 'open', handR: 'open'},
  holdPhone: {Lsh: 15, Lel: 130, Lwr: -10, Rsh: 14, Rel: 18, Rwr: 4, lean: 0, wave: 0, handL: 'fist', handR: 'open'},
} satisfies Record<string, Pose>;

export const EXPR = {
  neutral: {browRaise: 0, browWorry: 0, eyeOpen: 1, mouthW: 34, mouthOpen: 0, smile: 0.4, sweat: 0},
  happy: {browRaise: 0.3, browWorry: 0, eyeOpen: 0.95, mouthW: 46, mouthOpen: 12, smile: 1, sweat: 0},
  surprised: {browRaise: 1, browWorry: 0.2, eyeOpen: 1.35, mouthW: 22, mouthOpen: 26, smile: 0, sweat: 0},
  nervous: {browRaise: 0.6, browWorry: 1, eyeOpen: 1.15, mouthW: 36, mouthOpen: 4, smile: -0.4, sweat: 1},
  thinking: {browRaise: -0.3, browWorry: 0.3, eyeOpen: 0.85, mouthW: 22, mouthOpen: 0, smile: -0.1, gazeX: 0.6, gazeY: -0.7, sweat: 0},
  confident: {browRaise: 0.2, browWorry: 0, eyeOpen: 0.95, mouthW: 44, mouthOpen: 6, smile: 1, gazeX: 0, gazeY: 0, sweat: 0},
  talk: {browRaise: 0.2, browWorry: 0, eyeOpen: 1, mouthW: 34, mouthOpen: 14, smile: 0.6, sweat: 0},
} satisfies Record<string, Pose>;
