import React from 'react';
import {color, font, type} from '../brand/tokens';
import {pop, prog} from '../lib/motion';

/**
 * Character speech bubble. Scales from the tail tip so it reads as coming
 * out of the speaker. Lines are pre-broken by the author (max ~16 chars).
 */
export const SpeechBubble: React.FC<{
  frame: number;
  at: number;
  exitAt?: number;
  x: number;
  y: number;
  w: number;
  lines: string[];
  tail: {x: number; y: number}; // tail tip, absolute
  size?: number;
}> = ({frame, at, exitAt, x, y, w, lines, tail, size = type.bubble}) => {
  const p = pop(frame, at, 10);
  const out = exitAt !== undefined ? prog(frame, exitAt, 7) : 0;
  const s = p * (1 - out);
  if (s <= 0.001) return null;
  const h = lines.length * size * 1.2 + size * 0.9;
  const bx = x + w * 0.3;
  const by = y + h;
  return (
    <g transform={`translate(${tail.x} ${tail.y}) scale(${s}) translate(${-tail.x} ${-tail.y})`}>
      <path d={`M ${bx - 26} ${by - 6} L ${tail.x} ${tail.y} L ${bx + 34} ${by - 6} Z`} fill={color.white} stroke={color.navy} strokeWidth={6} strokeLinejoin="round" />
      <rect x={x} y={y} width={w} height={h} rx={38} fill={color.white} stroke={color.navy} strokeWidth={6} />
      <rect x={bx - 22} y={by - 14} width={52} height={16} fill={color.white} />
      {lines.map((l, i) => (
        <text key={i} x={x + w / 2} y={y + size * 1.15 + i * size * 1.2} textAnchor="middle" fontFamily={font.display} fontWeight={700} fontSize={size} fill={color.navy}>
          {l}
        </text>
      ))}
    </g>
  );
};

/** Comic burst behind short exclamations like "¡¿?!" */
export const Burst: React.FC<{frame: number; at: number; exitAt: number; x: number; y: number; r?: number; text: string}> = ({frame, at, exitAt, x, y, r = 90, text}) => {
  const p = pop(frame, at, 8, 0.6);
  const out = prog(frame, exitAt, 6);
  const s = p * (1 - out);
  if (s <= 0.001) return null;
  const pts: string[] = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const rr = i % 2 ? r * 0.72 : r;
    pts.push(`${Math.cos(a) * rr},${Math.sin(a) * rr}`);
  }
  const jitter = Math.sin(frame * 1.7) * 3; // nervous shake, only on the burst
  return (
    <g transform={`translate(${x + jitter} ${y}) scale(${s}) rotate(${-8 + jitter})`}>
      <polygon points={pts.join(' ')} fill={color.orange} stroke={color.navy} strokeWidth={6} strokeLinejoin="round" />
      <text textAnchor="middle" y={r * 0.26} fontFamily={font.display} fontWeight={700} fontSize={r * 0.8} fill={color.white}>
        {text}
      </text>
    </g>
  );
};
