import React from 'react';
import {AbsoluteFill} from 'remotion';
import {color} from '../brand/tokens';
import {ease, prog} from '../lib/motion';

/**
 * Burnt-orange marker stroke sweeps across the page. The scene swap happens
 * at the midpoint, while the stroke fully covers the frame.
 * Duration 16 frames by default (timing rule: 10–16).
 */
export const MarkerWipe: React.FC<{frame: number; at: number; dur?: number; dir?: 1 | -1}> = ({frame, at, dur = 16, dir = 1}) => {
  const p = prog(frame, at, dur, ease.inOut);
  if (p <= 0 || p >= 1) return null;
  const x = (-2100 + p * 4200) * dir;
  // brush edges: wobbly leading/trailing edge
  const edge = (x0: number, sign: number) => {
    let d = '';
    for (let i = 0; i <= 24; i++) {
      const y = -400 + i * 125;
      d += `${i === 0 ? 'M' : 'L'} ${x0 + sign * (Math.sin(i * 1.9) * 26 + (i % 3) * 10)} ${y} `;
    }
    return d;
  };
  const right = edge(800, 1);
  const leftPts = edge(-800, -1)
    .trim()
    .split(/ (?=[ML])/)
    .reverse()
    .map((c) => c.replace(/^M/, 'L'))
    .join(' ');
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920">
        <g transform={`translate(${540 + x} 960) rotate(-14)`}>
          <path d={`${right} ${leftPts} Z`} fill={color.orange} />
          <path d={`${right} ${leftPts} Z`} fill="url(#none)" />
          {[-420, -150, 160, 430].map((xx, i) => (
            <line key={i} x1={xx} x2={xx + 30} y1={-1300} y2={1300} stroke={color.orangeLight} strokeWidth={14} opacity={0.35} />
          ))}
        </g>
      </svg>
    </AbsoluteFill>
  );
};

/** True when the wipe has covered the frame and the next scene should show. */
export const wipeSwapped = (frame: number, at: number, dur = 16) => frame >= at + dur / 2;
