import React from 'react';
import {color, font, type} from '../brand/tokens';
import {pop, prog} from '../lib/motion';
import {textW} from '../lib/measure';

type Word = string | {t: string; hl?: boolean};

/**
 * Big headline, SVG. Words pop in with a stagger; `hl` words get a
 * burnt-orange marker swash drawn under them after the line lands.
 */
export const Headline: React.FC<{
  frame: number;
  at: number;
  lines: Word[][];
  x: number;
  y: number;
  size?: number;
  anchor?: 'start' | 'middle';
  exitAt?: number;
  stagger?: number;
}> = ({frame, at, lines, x, y, size = type.h1, anchor = 'start', exitAt, stagger = 3}) => {
  const exit = exitAt !== undefined ? prog(frame, exitAt, 8) : 0;
  let idx = 0;
  const lh = size * 1.12;
  return (
    <g opacity={1 - exit} transform={`translate(0 ${-exit * 40})`}>
      {lines.map((ws, li) => {
        const widths = ws.map((w) => textW(typeof w === 'string' ? w : w.t, size));
        const gap = textW(' ', size);
        const total = widths.reduce((a, b) => a + b, 0) + (ws.length - 1) * gap;
        let cx = anchor === 'middle' ? x - total / 2 : x;
        return ws.map((w, wi) => {
          const word = typeof w === 'string' ? w : w.t;
          const hl = typeof w !== 'string' && w.hl;
          const p = pop(frame, at + idx++ * stagger);
          const wx = cx;
          cx += widths[wi] + gap;
          const yy = y + li * lh;
          const swash = hl ? prog(frame, at + idx * stagger + 6, 12) : 0;
          return (
            <g key={`${li}-${wi}`} transform={`translate(${wx} ${yy + (1 - p) * 30}) scale(${0.85 + 0.15 * p})`} opacity={Math.min(1, p * 1.5)}>
              {hl && (
                <path
                  d={`M -8 ${size * 0.12} Q ${widths[wi] / 2} ${size * 0.22} ${widths[wi] + 8} ${size * 0.08}`}
                  stroke={color.orange}
                  strokeOpacity={0.85}
                  strokeWidth={size * 0.32}
                  strokeLinecap="round"
                  fill="none"
                  pathLength={1}
                  strokeDasharray={1}
                  strokeDashoffset={1 - swash}
                />
              )}
              <text fontFamily={font.display} fontWeight={700} fontSize={size} fill={color.navy}>
                {word}
              </text>
            </g>
          );
        });
      })}
    </g>
  );
};

/** Rounded label chip (e.g. place names). */
export const Chip: React.FC<{frame: number; at: number; x: number; y: number; text: string; fill?: string; ink?: string; size?: number}> = ({
  frame,
  at,
  x,
  y,
  text,
  fill = color.navy,
  ink = color.white,
  size = type.label,
}) => {
  const p = pop(frame, at);
  const w = textW(text, size, '600') + size * 1.1;
  const h = size * 1.6;
  return (
    <g transform={`translate(${x} ${y}) scale(${p})`} opacity={Math.min(1, p * 2)}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2} fill={fill} stroke={color.navy} strokeWidth={4} />
      <text textAnchor="middle" y={size * 0.36} fontFamily={font.display} fontWeight={600} fontSize={size} fill={ink}>
        {text}
      </text>
    </g>
  );
};
