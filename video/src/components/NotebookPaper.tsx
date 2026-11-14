import React from 'react';
import {AbsoluteFill} from 'remotion';
import {color} from '../brand/tokens';

/** Cream ruled notebook page. Static on purpose: the page never moves, only what's on it. */
export const NotebookPaper: React.FC<{lineGap?: number; marginX?: number; holes?: boolean}> = ({
  lineGap = 64,
  marginX = 110,
  holes = true,
}) => {
  const lines = [];
  for (let y = 150; y < 1920; y += lineGap) lines.push(y);
  return (
    <AbsoluteFill style={{background: color.paper}}>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{position: 'absolute'}}>
        <defs>
          <filter id="grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={4} />
            <feColorMatrix values="0 0 0 0 0.35  0 0 0 0 0.28  0 0 0 0 0.18  0 0 0 0.07 0" />
          </filter>
          <radialGradient id="vignette" cx="50%" cy="45%" r="75%">
            <stop offset="70%" stopColor="#000" stopOpacity={0} />
            <stop offset="100%" stopColor="#5a4320" stopOpacity={0.12} />
          </radialGradient>
        </defs>
        {lines.map((y) => (
          <line key={y} x1={0} x2={1080} y1={y} y2={y} stroke={color.rule} strokeWidth={2} />
        ))}
        <line x1={marginX} x2={marginX} y1={0} y2={1920} stroke={color.margin} strokeWidth={3} />
        {holes && [420, 960, 1500].map((y) => <circle key={y} cx={46} cy={y} r={20} fill={color.paperShade} stroke={color.rule} strokeWidth={2} />)}
        <rect width={1080} height={1920} filter="url(#grain)" />
        <rect width={1080} height={1920} fill="url(#vignette)" />
      </svg>
    </AbsoluteFill>
  );
};
