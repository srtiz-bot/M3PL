export type HandShape = 'open' | 'point' | 'fist' | 'thumbsUp';

/** Every animatable scalar of the rig. Angles in degrees.
 *  Arms: L = screen-left arm, R = screen-right arm (mirrored, same meaning).
 *  sh = shoulder: 0 hangs down, + raises outward (90 = horizontal, 180 = straight up)
 *  el = elbow:    forearm angle = sh - el (0 down, 90 out, 180 up, <0 across the body)
 *  wr = wrist:    + bends hand toward the midline
 */
export type Channels = {
  lean: number; // torso rotation around hips
  headTilt: number;
  headTurn: number; // -1..1 fake 3/4 turn (features shift)
  gazeX: number; // -1..1
  gazeY: number; // -1..1
  browRaise: number; // -1 frown .. 1 surprised
  browWorry: number; // 0..1 inner ends up
  eyeOpen: number; // 0 closed .. 1 normal .. 1.35 wide
  mouthW: number; // px
  mouthOpen: number; // px
  smile: number; // -1 .. 1
  sweat: number; // 0..1 comedic sweat drop
  wave: number; // 0..1 additive wave oscillation on R arm
  Lsh: number;
  Lel: number;
  Lwr: number;
  Rsh: number;
  Rel: number;
  Rwr: number;
};

export type Pose = Partial<Channels> & {handL?: HandShape; handR?: HandShape};

export type Key = {at: number; pose: Pose; /** spring stiffness, default 120 */ snap?: number};

export type Look = {
  skin: string;
  skinShade: string;
  hair: string;
  hairStyle: 'short' | 'bun' | 'curly';
  beard: boolean;
  glasses: boolean;
  shirt: string;
  shirtAccent: string;
  pants: string;
  shoes: string;
};

export type RigState = Channels & {
  handL: Record<HandShape, number>;
  handR: Record<HandShape, number>;
  blink: number; // 0 open .. 1 closed
  breath: number; // -1..1
};
