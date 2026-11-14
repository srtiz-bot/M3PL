import React from 'react';
import {color, font} from '../brand/tokens';
import {pop, prog} from '../lib/motion';

const N = color.navy;
const sw = 5;

/** Cardboard product box with an optional face (for gags). Origin = bottom center. */
export const ProductBox: React.FC<{size?: number; face?: 'none' | 'happy' | 'worried'; frame?: number; label?: string}> = ({
  size = 90,
  face = 'none',
  frame = 0,
  label,
}) => {
  const s = size;
  const blink = (frame + 13) % 70 < 4 ? 0.15 : 1;
  return (
    <g>
      <path d={`M ${-s / 2} ${-s} L ${s / 2} ${-s} L ${s / 2} 0 L ${-s / 2} 0 Z`} fill={color.kraft} stroke={N} strokeWidth={sw} strokeLinejoin="round" />
      <path d={`M ${-s / 2} ${-s} L ${-s / 2 + s * 0.18} ${-s * 1.22} L ${s / 2 + s * 0.18} ${-s * 1.22} L ${s / 2} ${-s} Z`} fill={color.kraftDark} stroke={N} strokeWidth={sw} strokeLinejoin="round" />
      <path d={`M ${s / 2} ${-s} L ${s / 2 + s * 0.18} ${-s * 1.22} L ${s / 2 + s * 0.18} ${-s * 0.22} L ${s / 2} 0 Z`} fill={color.kraftDark} stroke={N} strokeWidth={sw} strokeLinejoin="round" />
      <rect x={-s * 0.08} y={-s} width={s * 0.16} height={s * 0.42} fill={color.orangeTint} stroke={N} strokeWidth={3} />
      {label && (
        <text x={0} y={-s * 0.14} textAnchor="middle" fontFamily={font.display} fontWeight={700} fontSize={s * 0.2} fill={N}>
          {label}
        </text>
      )}
      {face !== 'none' && (
        <g>
          <ellipse cx={-s * 0.17} cy={-s * 0.45} rx={s * 0.055} ry={s * 0.075 * blink} fill={N} />
          <ellipse cx={s * 0.17} cy={-s * 0.45} rx={s * 0.055} ry={s * 0.075 * blink} fill={N} />
          {face === 'happy' ? (
            <path d={`M ${-s * 0.12} ${-s * 0.3} Q 0 ${-s * 0.18} ${s * 0.12} ${-s * 0.3}`} stroke={N} strokeWidth={4} fill="none" strokeLinecap="round" />
          ) : (
            <path d={`M ${-s * 0.1} ${-s * 0.24} Q 0 ${-s * 0.32} ${s * 0.1} ${-s * 0.24}`} stroke={N} strokeWidth={4} fill="none" strokeLinecap="round" />
          )}
        </g>
      )}
    </g>
  );
};

/** Small cargo plane, nose pointing +x. Origin = center. */
export const Plane: React.FC<{s?: number}> = ({s = 1}) => (
  <g transform={`scale(${s})`} stroke={N} strokeWidth={5} strokeLinejoin="round">
    <path d="M -20 -6 L -48 -64 L -26 -64 L 18 -8 Z" fill={color.orangeLight} />
    <path d="M -90 -12 Q -92 -30 -70 -30 L 70 -26 Q 104 -20 106 0 Q 104 18 70 22 L -70 22 Q -92 20 -90 -12 Z" fill={color.white} />
    <path d="M -86 -14 L -104 -54 L -84 -54 L -60 -20 Z" fill={color.orange} />
    <path d="M -20 10 L -46 64 L -24 64 L 20 12 Z" fill={color.orange} />
    {[-30, -6, 18, 42].map((x) => <circle key={x} cx={x} cy={-6} r={6} fill={color.navySoft} strokeWidth={3} />)}
  </g>
);

/** Delivery van, facing +x. Origin = bottom center. */
export const Van: React.FC<{s?: number; frame?: number}> = ({s = 1, frame = 0}) => (
  <g transform={`scale(${s})`} stroke={N} strokeWidth={5} strokeLinejoin="round">
    <path d="M -80 -16 L -80 -90 L 30 -90 L 30 -16 Z" fill={color.white} />
    <path d="M 30 -16 L 30 -70 L 62 -70 L 82 -40 L 82 -16 Z" fill={color.orange} />
    <path d="M 38 -64 L 60 -64 L 74 -42 L 38 -42 Z" fill="#BFD9EE" strokeWidth={4} />
    <rect x={-70} y={-62} width={88} height={22} rx={6} fill={color.orange} strokeWidth={3} />
    {[-50, 54].map((x) => (
      <g key={x} transform={`translate(${x} -14) rotate(${frame * 18})`}>
        <circle r={17} fill={N} />
        <line x1={-8} x2={8} y1={0} y2={0} stroke={color.white} strokeWidth={3} />
      </g>
    ))}
  </g>
);

/** Warehouse / hub. Origin = bottom center. */
export const Warehouse: React.FC<{s?: number; label?: string}> = ({s = 1, label}) => (
  <g transform={`scale(${s})`}>
    <g stroke={N} strokeWidth={5} strokeLinejoin="round">
      <path d="M -100 0 L -100 -90 L 0 -140 L 100 -90 L 100 0 Z" fill={color.white} />
      <rect x={-50} y={-70} width={100} height={70} fill={color.navySoft} />
      {[-52, -32, -12].map((y) => <line key={y} x1={-50} x2={50} y1={y} y2={y} stroke={color.white} strokeWidth={3} />)}
      <path d="M -100 -90 L 0 -140 L 100 -90" fill="none" stroke={color.orange} strokeWidth={10} strokeLinecap="round" />
    </g>
    {label && (
      <text y={44} textAnchor="middle" fontFamily={font.display} fontWeight={700} fontSize={40} fill={N}>
        {label}
      </text>
    )}
  </g>
);

/** House. Origin = bottom center. */
export const House: React.FC<{s?: number}> = ({s = 1}) => (
  <g transform={`scale(${s})`} stroke={N} strokeWidth={5} strokeLinejoin="round">
    <rect x={-80} y={-110} width={160} height={110} fill={color.white} />
    <path d="M -98 -104 L 0 -180 L 98 -104 Z" fill={color.orange} />
    <rect x={-22} y={-66} width={44} height={66} fill={color.navySoft} />
    <rect x={-66} y={-84} width={34} height={30} fill="#BFD9EE" strokeWidth={4} />
    <rect x={32} y={-84} width={34} height={30} fill="#BFD9EE" strokeWidth={4} />
  </g>
);

/** Map pin. Origin = tip. */
export const Pin: React.FC<{s?: number; fill?: string}> = ({s = 1, fill = color.orange}) => (
  <g transform={`scale(${s})`}>
    <path d="M 0 0 C -10 -24 -32 -40 -32 -62 A 32 32 0 0 1 32 -62 C 32 -40 10 -24 0 0 Z" fill={fill} stroke={N} strokeWidth={5} />
    <circle cy={-62} r={12} fill={color.white} stroke={N} strokeWidth={4} />
  </g>
);

/**
 * Document card that gets stamped. Stamp slams in at `stampAt`
 * (scale 1.8 -> 1, slight rotation) — the classic "approved" beat.
 */
export const DocumentCard: React.FC<{frame: number; at: number; stampAt: number; exitAt?: number; title: string; stamp: string; x: number; y: number}> = ({
  frame,
  at,
  stampAt,
  exitAt,
  title,
  stamp,
  x,
  y,
}) => {
  const p = pop(frame, at, 12);
  const out = exitAt !== undefined ? prog(frame, exitAt, 8) : 0;
  const sp = prog(frame, stampAt, 5);
  const shake = frame >= stampAt + 4 && frame < stampAt + 10 ? Math.sin(frame * 3) * 4 * (1 - (frame - stampAt - 4) / 6) : 0;
  if (p * (1 - out) < 0.001) return null;
  return (
    <g transform={`translate(${x + shake} ${y + out * 60}) rotate(${-4 + (1 - p) * -10}) scale(${p})`} opacity={1 - out}>
      <rect x={-130} y={-160} width={260} height={320} rx={16} fill={color.white} stroke={N} strokeWidth={6} />
      <path d="M 70 -160 L 130 -100 L 70 -100 Z" fill={color.paperShade} stroke={N} strokeWidth={5} strokeLinejoin="round" />
      <text x={-100} y={-104} fontFamily={font.display} fontWeight={700} fontSize={34} fill={N}>
        {title}
      </text>
      {[-50, -10, 30, 70].map((yy, i) => (
        <line key={yy} x1={-100} x2={i % 2 ? 40 : 90} y1={yy} y2={yy} stroke={color.rule} strokeWidth={10} strokeLinecap="round" />
      ))}
      {sp > 0 && (
        <g transform={`translate(10 60) rotate(-14) scale(${1.8 - 0.8 * sp})`} opacity={sp}>
          <rect x={-104} y={-40} width={208} height={80} rx={12} fill="none" stroke={color.green} strokeWidth={8} />
          <text textAnchor="middle" y={16} fontFamily={font.display} fontWeight={700} fontSize={46} fill={color.green}>
            {stamp}
          </text>
        </g>
      )}
    </g>
  );
};
