import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {color, font} from '../brand/tokens';
import {Character} from '../rig/Character';
import {SAUL, OWNER, CUSTOMER} from '../rig/looks';
import {EXPR, POSE} from '../rig/poses';
import {evalRig} from '../rig/useRig';
import type {Pose} from '../rig/types';


const rows: Array<[string, Pose]> = [
  ['idle', {...POSE.idle, ...EXPR.neutral}],
  ['wave', {...POSE.wave, ...EXPR.happy}],
  ['handsUp', {...POSE.handsUp, ...EXPR.surprised}],
  ['think', {...POSE.think, ...EXPR.thinking}],
  ['pointUp', {...POSE.pointUp, ...EXPR.confident}],
  ['pointRight', {...POSE.pointRight, ...EXPR.talk}],
  ['pointLeft', {...POSE.pointLeft, ...EXPR.talk}],
  ['thumbsUp', {...POSE.thumbsUp, ...EXPR.happy}],
  ['shrug', {...POSE.shrug, ...EXPR.nervous}],
  ['holdPhone', {...POSE.holdPhone, ...EXPR.neutral}],
  ['presentLeft', {...POSE.presentLeft, ...EXPR.confident}],
];

/** Dev-only: every pose/expression at rest, for visual review of the rig. */
export const PoseSheet: React.FC = () => {
  const frame = useCurrentFrame();
  const looks = [SAUL, SAUL, SAUL, SAUL, SAUL, SAUL, SAUL, SAUL, SAUL, OWNER, CUSTOMER];
  return (
    <AbsoluteFill style={{background: color.paper}}>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920}>
        {rows.map(([name, pose], i) => {
          const col = i % 3;
          const row = Math.floor(i / 3);
          const s = evalRig([{at: 0, pose}], 200 + frame);
          return (
            <g key={name}>
              <Character s={s} look={looks[i]} x={190 + col * 350} y={420 + row * 480} scale={0.62} />
              <text x={190 + col * 350} y={460 + row * 480} textAnchor="middle" fontFamily={font.display} fontWeight={600} fontSize={34} fill={color.navy}>
                {name}
              </text>
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};
