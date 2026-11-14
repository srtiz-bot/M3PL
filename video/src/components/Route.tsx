import React from 'react';
import {getLength, getPointAtLength, getTangentAtLength} from '@remotion/paths';
import {color} from '../brand/tokens';

/** Dashed route that draws itself on as `p` goes 0→1. */
export const Route: React.FC<{d: string; p: number; id: string; width?: number; stroke?: string}> = ({d, p, id, width = 10, stroke = color.orange}) => {
  const len = getLength(d);
  return (
    <g>
      <defs>
        <mask id={`m-${id}`} maskUnits="userSpaceOnUse" x={0} y={0} width={1080} height={1920}>
          <path d={d} stroke="#fff" strokeWidth={width + 12} fill="none" strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - p)} />
        </mask>
      </defs>
      <path d={d} stroke={stroke} strokeWidth={width} fill="none" strokeLinecap="round" strokeDasharray="4 26" mask={`url(#m-${id})`} />
    </g>
  );
};

/** Position + heading (deg) at fraction t of a path. */
export const along = (d: string, t: number) => {
  const len = getLength(d);
  const l = Math.max(0, Math.min(len, len * t));
  const pt = getPointAtLength(d, l);
  const tg = getTangentAtLength(d, l);
  if (!pt || !tg) return {x: 0, y: 0, angle: 0};
  return {x: pt.x, y: pt.y, angle: (Math.atan2(tg.y, tg.x) * 180) / Math.PI};
};
