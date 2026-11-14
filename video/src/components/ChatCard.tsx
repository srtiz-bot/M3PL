import React from 'react';
import {color, font} from '../brand/tokens';
import {pop, prog} from '../lib/motion';
import {textW} from '../lib/measure';

export type ChatLine = {text: string; at: number; hl?: boolean};

/**
 * Generic messaging card (deliberately NOT any real app's UI/branding).
 * Typing dots run from `typingAt` until the first line starts; each line
 * types on character-by-character from its own `at`.
 */
export const ChatCard: React.FC<{
  frame: number;
  at: number;
  typingAt: number;
  name: string;
  place: string;
  lines: ChatLine[];
  x: number;
  y: number;
  w: number;
  size?: number;
  cps?: number; // characters per second while typing on
}> = ({frame, at, typingAt, name, place, lines, x, y, w, size = 60, cps = 28}) => {
  const p = pop(frame, at, 13);
  const lh = size * 1.25;
  const headerH = 120;
  const bubbleH = Math.max(lh, lines.length * lh) + 60;
  const h = headerH + bubbleH + 70;
  const firstAt = lines[0]?.at ?? 0;
  const typing = frame >= typingAt && frame < firstAt;
  return (
    <g transform={`translate(${x + w / 2} ${y + h + (1 - p) * 260}) rotate(${(1 - p) * 6 - 1.5}) translate(${-w / 2} ${-h})`} opacity={Math.min(1, p * 2)}>
      <rect x={10} y={14} width={w} height={h} rx={44} fill={color.navy} opacity={0.15} />
      <rect width={w} height={h} rx={44} fill={color.white} stroke={color.navy} strokeWidth={6} />
      <path d={`M 0 ${headerH} L ${w} ${headerH}`} stroke={color.rule} strokeWidth={4} />
      <circle cx={80} cy={headerH / 2} r={38} fill={color.orangeTint} stroke={color.navy} strokeWidth={5} />
      <text x={80} y={headerH / 2 + 14} textAnchor="middle" fontFamily={font.display} fontWeight={700} fontSize={38} fill={color.orange}>
        {name.slice(0, 1)}
      </text>
      <text x={140} y={headerH / 2 - 4} fontFamily={font.display} fontWeight={700} fontSize={48} fill={color.navy}>
        {name}
      </text>
      <text x={140} y={headerH / 2 + 36} fontFamily={font.body} fontWeight={700} fontSize={36} fill={color.navySoft}>
        {place}
      </text>
      {/* incoming bubble */}
      <g transform={`translate(40 ${headerH + 36})`}>
        {(() => {
          const shown = lines.map((l) => {
            const n = Math.max(0, Math.min(l.text.length, Math.floor(((frame - l.at) / 30) * cps)));
            return l.text.slice(0, n);
          });
          const contentW = typing ? 150 : Math.max(150, ...lines.map((l, i) => (frame >= l.at ? textW(l.text, size, '800') : 0)));
          const bw = Math.min(w - 80, contentW + 70);
          const bh = typing ? lh + 20 : Math.max(lh + 20, lines.filter((l) => frame >= l.at).length * lh + 34);
          const bp = pop(frame, typingAt, 12);
          return (
            <g transform={`scale(${bp})`} style={{transformOrigin: '0px 0px'}}>
              <path d={`M 6 ${bh - 30} L -18 ${bh + 6} L 40 ${bh - 4} Z`} fill={color.paper} stroke={color.navy} strokeWidth={5} strokeLinejoin="round" />
              <rect width={bw} height={bh} rx={34} fill={color.paper} stroke={color.navy} strokeWidth={5} />
              <rect x={4} y={bh - 34} width={36} height={28} fill={color.paper} />
              {typing &&
                [0, 1, 2].map((i) => (
                  <circle key={i} cx={46 + i * 30} cy={bh / 2} r={10} fill={color.navySoft} opacity={0.35 + 0.65 * Math.max(0, Math.sin(frame * 0.35 - i * 0.9))} />
                ))}
              {!typing &&
                lines.map((l, i) => {
                  if (frame < l.at) return null;
                  const full = shown[i].length === l.text.length;
                  const hl = l.hl ? prog(frame, l.at + (l.text.length / cps) * 30 + 2, 10) : 0;
                  const tw = textW(l.text, size, '800');
                  return (
                    <g key={i} transform={`translate(34 ${34 + size * 0.86 + i * lh})`}>
                      {l.hl && (
                        <path
                          d={`M -6 ${size * 0.1} Q ${tw / 2} ${size * 0.2} ${tw + 6} ${size * 0.06}`}
                          stroke={color.orange}
                          strokeOpacity={0.55}
                          strokeWidth={size * 0.42}
                          strokeLinecap="round"
                          fill="none"
                          pathLength={1}
                          strokeDasharray={1}
                          strokeDashoffset={1 - hl}
                        />
                      )}
                      <text fontFamily={font.body} fontWeight={800} fontSize={size} fill={color.navy}>
                        {shown[i]}
                        {!full && <tspan fill={color.orange}>|</tspan>}
                      </text>
                    </g>
                  );
                })}
            </g>
          );
        })()}
      </g>
      <text x={w - 40} y={h - 30} textAnchor="end" fontFamily={font.body} fontWeight={700} fontSize={34} fill={color.navySoft}>
        10:42
      </text>
    </g>
  );
};
