import React from 'react';
import {color} from '../brand/tokens';
import type {HandShape, Look, RigState} from './types';

/*
 * Cartoon character rig (pure SVG, programmatic).
 * Hierarchy: hips -> torso(lean) -> {head(tilt), shoulder -> elbow -> wrist -> hand}
 * Origin (0,0) = between the feet. Legs never move, so the character is
 * planted; only joints rotate.
 */
const L1 = 108; // upper arm
const L2 = 102; // forearm
const ARM_W = 30;
const OUT = 7; // outline thickness added each side
const SH_Y = -418;
const SH_X = 80;
const HIP_Y = -232;
const NECK_Y = -440;
const HEAD_Y = -522;
const N = color.navy;
const HEAD_SCALE = 1.2;

type ArmProps = {sh: number; el: number; wr: number; hands: Record<HandShape, number>; look: Look; mode: 'outline' | 'fill'};

const Hand: React.FC<{shape: HandShape; look: Look; mode: 'outline' | 'fill'}> = ({shape, look, mode}) => {
  const fill = mode === 'fill' ? look.skin : N;
  const sw = mode === 'fill' ? 0 : OUT * 2;
  const common = {fill, stroke: N, strokeWidth: sw, strokeLinejoin: 'round' as const};
  switch (shape) {
    case 'open':
      return (
        <g>
          <ellipse cx={-19} cy={16} rx={9} ry={16} transform="rotate(38 -19 16)" {...common} />
          {[-13, -4, 5, 14].map((fx, i) => (
            <rect key={i} x={fx - 4.5} y={26} width={9} height={i === 0 || i === 3 ? 26 : 32} rx={4.5} {...common} />
          ))}
          <rect x={-19} y={2} width={38} height={36} rx={15} {...common} />
        </g>
      );
    case 'point':
      return (
        <g>
          <rect x={-7} y={20} width={14} height={50} rx={7} {...common} />
          <circle cx={0} cy={20} r={21} {...common} />
        </g>
      );
    case 'thumbsUp':
      return (
        <g>
          <rect x={4} y={18} width={15} height={46} rx={7.5} {...common} />
          <circle cx={0} cy={20} r={22} {...common} />
          {mode === 'fill' && <path d="M 8 12 L 8 32" stroke={look.skinShade} strokeWidth={3} strokeLinecap="round" />}
        </g>
      );
    case 'fist':
    default:
      return (
        <g>
          <circle cx={0} cy={21} r={22} {...common} />
          {mode === 'fill' && <path d="M -10 30 Q 0 36 10 30" stroke={look.skinShade} strokeWidth={3} fill="none" strokeLinecap="round" />}
        </g>
      );
  }
};

const Arm: React.FC<ArmProps> = ({sh, el, wr, hands, look, mode}) => {
  const isFill = mode === 'fill';
  const w = isFill ? ARM_W : ARM_W + OUT * 2;
  const skin = isFill ? look.skin : N;
  return (
    <g transform={`rotate(${sh})`}>
      <line x1={0} y1={0} x2={0} y2={L1} stroke={skin} strokeWidth={w} strokeLinecap="round" />
      {/* Sleeve: rounded at shoulder, cut at mid-upper-arm */}
      <path
        d={`M -25 0 A 25 25 0 0 1 25 0 L 23 ${L1 * 0.55} L -23 ${L1 * 0.55} Z`}
        fill={isFill ? look.shirt : N}
        stroke={N}
        strokeWidth={isFill ? 5 : OUT * 2}
        strokeLinejoin="round"
      />
      <g transform={`translate(0 ${L1}) rotate(${-el})`}>
        <line x1={0} y1={0} x2={0} y2={L2} stroke={skin} strokeWidth={w - 2} strokeLinecap="round" />
        <g transform={`translate(0 ${L2 - 6}) rotate(${-wr})`}>
          {(Object.keys(hands) as HandShape[]).map((h) =>
            hands[h] > 0.001 ? (
              <g key={h} opacity={hands[h]}>
                <Hand shape={h} look={look} mode={mode} />
              </g>
            ) : null,
          )}
        </g>
      </g>
    </g>
  );
};

const Hair: React.FC<{look: Look}> = ({look}) => {
  const h = look.hair;
  if (look.hairStyle === 'curly')
    return (
      <g fill={h} stroke={N} strokeWidth={5}>
        {[-58, -34, -10, 14, 38, 60].map((x, i) => (
          <circle key={i} cx={x} cy={HEAD_Y - 66 + Math.abs(x) * 0.35} r={26} />
        ))}
      </g>
    );
  const cap = `M -76 ${HEAD_Y + 2} C -84 ${HEAD_Y - 70} -40 ${HEAD_Y - 98} 6 ${HEAD_Y - 94} C 56 ${HEAD_Y - 92} 86 ${HEAD_Y - 62} 76 ${HEAD_Y + 2} C 70 ${HEAD_Y - 30} 52 ${HEAD_Y - 52} 18 ${HEAD_Y - 50} C -6 ${HEAD_Y - 36} -40 ${HEAD_Y - 46} -60 ${HEAD_Y - 34} C -68 ${HEAD_Y - 24} -72 ${HEAD_Y - 10} -76 ${HEAD_Y + 2} Z`;
  return (
    <g fill={h} stroke={N} strokeWidth={5} strokeLinejoin="round">
      {look.hairStyle === 'bun' && <circle cx={4} cy={HEAD_Y - 104} r={28} />}
      <path d={cap} />
    </g>
  );
};

const Head: React.FC<{s: RigState; look: Look}> = ({s, look}) => {
  const fx = s.headTurn * 12; // features shift for a 3/4 turn
  const eyeY = HEAD_Y - 10;
  const open = Math.max(0.06, s.eyeOpen * (1 - s.blink));
  const browY = eyeY - 32 - s.browRaise * 12;
  const mouthY = HEAD_Y + 44;
  const mw = s.mouthW / 2;
  const cornerY = mouthY - s.smile * 7;
  const topY = mouthY + s.smile * 5 - s.mouthOpen * 0.25;
  const botY = mouthY + s.smile * 12 + s.mouthOpen;
  const mouth = `M ${fx - mw} ${cornerY} Q ${fx} ${topY} ${fx + mw} ${cornerY} Q ${fx} ${botY} ${fx - mw} ${cornerY} Z`;
  return (
    <g>
      {/* ears */}
      <ellipse cx={-74} cy={HEAD_Y + 2} rx={13} ry={18} fill={look.skin} stroke={N} strokeWidth={5} />
      <ellipse cx={74} cy={HEAD_Y + 2} rx={13} ry={18} fill={look.skin} stroke={N} strokeWidth={5} />
      <ellipse cx={0} cy={HEAD_Y} rx={74} ry={84} fill={look.skin} stroke={N} strokeWidth={6} />
      {look.beard && (
        <path
          d={`M -70 ${HEAD_Y + 10} C -66 ${HEAD_Y + 70} -30 ${HEAD_Y + 90} 0 ${HEAD_Y + 90} C 30 ${HEAD_Y + 90} 66 ${HEAD_Y + 70} 70 ${HEAD_Y + 10} C 60 ${HEAD_Y + 40} 40 ${HEAD_Y + 34} 22 ${HEAD_Y + 30} C 10 ${HEAD_Y + 26} -10 ${HEAD_Y + 26} -22 ${HEAD_Y + 30} C -40 ${HEAD_Y + 34} -60 ${HEAD_Y + 40} -70 ${HEAD_Y + 10} Z`}
          fill={look.hair}
          stroke={N}
          strokeWidth={5}
          strokeLinejoin="round"
        />
      )}
      <Hair look={look} />
      {/* eyes */}
      {[-1, 1].map((side) => (
        <g key={side} transform={`translate(${fx + side * 27} ${eyeY}) scale(1 ${open})`}>
          <ellipse rx={12} ry={15} fill={color.white} stroke={N} strokeWidth={4} />
          <circle cx={s.gazeX * 4} cy={s.gazeY * 5} r={8.5} fill={N} />
          <circle cx={s.gazeX * 4 + 3} cy={s.gazeY * 5 - 3} r={2.5} fill={color.white} />
        </g>
      ))}
      {/* brows: inner end lifts with worry */}
      {[-1, 1].map((side) => (
        <line
          key={side}
          x1={fx + side * 14}
          y1={browY - s.browWorry * 8}
          x2={fx + side * 42}
          y2={browY + s.browWorry * 4}
          stroke={look.hair === color.navy ? N : look.hair}
          strokeWidth={9}
          strokeLinecap="round"
        />
      ))}
      {look.glasses && (
        <g fill="none" stroke={N} strokeWidth={4}>
          <circle cx={fx - 27} cy={eyeY} r={22} />
          <circle cx={fx + 27} cy={eyeY} r={22} />
          <line x1={fx - 5} y1={eyeY} x2={fx + 5} y2={eyeY} />
        </g>
      )}
      {/* nose */}
      <path d={`M ${fx + 2} ${eyeY + 14} Q ${fx + 12} ${eyeY + 32} ${fx - 2} ${eyeY + 34}`} fill="none" stroke={look.skinShade} strokeWidth={5} strokeLinecap="round" />
      {look.beard && <path d={mouth} fill="none" stroke={look.skin} strokeWidth={13} strokeLinejoin="round" />}
      <path d={mouth} fill="#9A3A2A" stroke={N} strokeWidth={4.5} strokeLinejoin="round" />
      {s.mouthOpen > 8 && (
        <path d={`M ${fx - mw * 0.6} ${cornerY + 1} Q ${fx} ${topY + 3} ${fx + mw * 0.6} ${cornerY + 1}`} stroke={color.white} strokeWidth={5} fill="none" strokeLinecap="round" />
      )}
      {/* comedic sweat drop */}
      {s.sweat > 0.02 && (
        <path
          transform={`translate(${66} ${HEAD_Y - 40 + s.sweat * 26}) scale(${s.sweat})`}
          d="M 0 -18 C 8 -6 12 2 12 8 A 12 12 0 0 1 -12 8 C -12 2 -8 -6 0 -18 Z"
          fill="#9CC7E8"
          stroke={N}
          strokeWidth={4}
        />
      )}
    </g>
  );
};

export const Character: React.FC<{s: RigState; look: Look; x: number; y: number; scale?: number; flip?: boolean}> = ({
  s,
  look,
  x,
  y,
  scale = 1,
  flip = false,
}) => {
  const lift = s.breath * 1.6; // chest rises a hair; legs/feet stay planted
  const arms = (mode: 'outline' | 'fill') => (
    <>
      <g transform={`translate(${-SH_X} ${SH_Y - lift})`}>
        <Arm sh={s.Lsh} el={s.Lel} wr={s.Lwr} hands={s.handL} look={look} mode={mode} />
      </g>
      <g transform={`translate(${SH_X} ${SH_Y - lift}) scale(-1 1)`}>
        <Arm sh={s.Rsh} el={s.Rel} wr={s.Rwr} hands={s.handR} look={look} mode={mode} />
      </g>
    </>
  );
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})`}>
      {/* ground shadow */}
      <ellipse cx={0} cy={4} rx={120} ry={16} fill={N} opacity={0.12} />
      {/* legs (static) */}
      <g stroke={N} strokeWidth={6} strokeLinejoin="round">
        <path d={`M -70 ${HIP_Y} L -62 -26 L -8 -26 L -4 ${HIP_Y + 40} L 4 ${HIP_Y + 40} L 8 -26 L 62 -26 L 70 ${HIP_Y} Z`} fill={look.pants} />
        <path d="M -72 -30 L -6 -30 L -4 0 L -86 0 C -92 -14 -84 -28 -72 -30 Z" fill={look.shoes} />
        <path d="M 72 -30 L 6 -30 L 4 0 L 86 0 C 92 -14 84 -28 72 -30 Z" fill={look.shoes} />
      </g>
      <g transform={`rotate(${s.lean} 0 ${HIP_Y})`}>
        {/* torso */}
        <path
          d={`M -74 ${HIP_Y + 4} C -80 ${HIP_Y - 70} -98 ${SH_Y + 40} -86 ${SH_Y - 2 - lift} Q -56 ${NECK_Y - 4 - lift} 0 ${NECK_Y - 6 - lift} Q 56 ${NECK_Y - 4 - lift} 86 ${SH_Y - 2 - lift} C 98 ${SH_Y + 40} 80 ${HIP_Y - 70} 74 ${HIP_Y + 4} Z`}
          fill={look.shirt}
          stroke={N}
          strokeWidth={6}
          strokeLinejoin="round"
        />
        {/* neck */}
        <rect x={-19} y={NECK_Y - 30 - lift} width={38} height={36} rx={10} fill={look.skinShade} stroke={N} strokeWidth={5} />
        {/* collar */}
        <path d={`M -34 ${NECK_Y - 4 - lift} L 0 ${NECK_Y + 30 - lift} L 34 ${NECK_Y - 4 - lift} L 18 ${NECK_Y + 26 - lift} L 0 ${NECK_Y + 40 - lift} L -18 ${NECK_Y + 26 - lift} Z`} fill={look.shirtAccent} stroke={N} strokeWidth={5} strokeLinejoin="round" />
        <circle cx={44} cy={SH_Y + 40} r={9} fill={look.shirtAccent} stroke={N} strokeWidth={3} />
        <g transform={`rotate(${s.headTilt} 0 ${NECK_Y - lift}) translate(0 ${-lift}) translate(0 ${NECK_Y}) scale(${HEAD_SCALE}) translate(0 ${-NECK_Y})`}>
          <Head s={s} look={look} />
        </g>
        {arms('outline')}
        {arms('fill')}
      </g>
    </g>
  );
};
