import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {color, font} from '../../brand/tokens';
import {FontGate} from '../../brand/fonts';
import {NotebookPaper} from '../../components/NotebookPaper';
import {Chip, Headline} from '../../components/Text';
import {Burst, SpeechBubble} from '../../components/Bubbles';
import {ChatCard} from '../../components/ChatCard';
import {MarkerWipe, wipeSwapped} from '../../components/MarkerWipe';
import {DocumentCard, House, Pin, Plane, ProductBox, Van, Warehouse} from '../../components/Props';
import {Route, along} from '../../components/Route';
import {Narration, NarrationProps} from '../../audio/Narration';
import {Character} from '../../rig/Character';
import {CUSTOMER, OWNER, SAUL} from '../../rig/looks';
import {EXPR, POSE} from '../../rig/poses';
import {evalRig} from '../../rig/useRig';
import type {Key} from '../../rig/types';
import {ease, pop, prog} from '../../lib/motion';
import {B} from './beats';

const look = (gx: number, gy: number, turn = 0) => ({gazeX: gx, gazeY: gy, headTurn: turn});

// ---------- Scene A: the message ----------
const saulA: Key[] = [
  {at: 0, pose: {...POSE.idle, ...EXPR.neutral, ...look(0.5, -0.7, 0.3), headTilt: -4}},
  {at: B.saulRead, pose: {lean: -3, headTilt: -9, eyeOpen: 0.85, browRaise: -0.2, smile: 0.2}},
  {at: B.saulCheer, pose: {...POSE.thumbsUp, ...EXPR.happy, ...look(0.4, -0.6, 0.3), headTilt: 4}},
  {at: B.saulShock, pose: {...POSE.handsUp, ...EXPR.surprised, ...look(0.4, -0.8, 0.3), headTilt: 0}, snap: 200},
  {at: B.saulShrug, pose: {...POSE.shrug, ...EXPR.nervous, ...look(-0.3, 0, -0.1), headTilt: 6}},
  {at: B.saulIdea, pose: {...POSE.pointUp, ...EXPR.confident, ...look(0.3, -0.3, 0.15), headTilt: -3}},
];

const SceneA: React.FC<{f: number}> = ({f}) => {
  const s = evalRig(saulA, f);
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{position: 'absolute'}}>
      <Headline frame={f} at={B.headlineA} x={540} y={265} anchor="middle" size={84} lines={[['Te', 'llega', 'este', 'mensaje:']]} />
      <ChatCard
        frame={f}
        at={B.card}
        typingAt={B.typing}
        name="Cliente nuevo"
        place="Houston, TX · EE. UU."
        x={80}
        y={330}
        w={920}
        size={78}
        lines={[
          {text: 'Te compro…', at: B.line1},
          {text: 'si me entregas', at: B.line2},
          {text: 'en EE. UU.', at: B.line3, hl: true},
        ]}
      />
      <Character s={s} look={SAUL} x={300} y={1850} scale={1.25} />
      <Burst frame={f} at={B.burst} exitAt={B.burstOut} x={660} y={1060} r={110} text="¡¿?!" />
      <SpeechBubble frame={f} at={B.bubble} x={540} y={930} w={480} lines={['¡Yo me', 'encargo!']} tail={{x: 470, y: 1180}} size={72} />
    </svg>
  );
};

// ---------- Scene B: the route ----------
const US = 'M -10 380 L 1090 380 L 1090 800 C 1000 830 900 790 800 810 C 720 825 660 820 620 830 C 560 840 520 826 480 832 C 400 812 300 842 200 816 C 120 800 60 822 -10 810 Z';
const LATAM = 'M -10 1110 C 80 1090 160 1130 260 1115 C 360 1100 420 1140 520 1125 C 640 1110 700 1080 820 1100 C 920 1115 1000 1090 1090 1105 L 1090 1930 L -10 1930 Z';
const SEG1 = 'M 430 1560 C 660 1470 760 1200 660 1030 C 600 930 480 860 430 690';
const SEG2 = 'M 520 770 C 600 750 650 700 720 668';

const ownerK: Key[] = [
  {at: 0, pose: {...POSE.idle, ...EXPR.happy, ...look(0.6, -0.4, 0.3)}},
  {at: B.planeIn + 2, pose: {...POSE.wave, ...look(0.6, -0.8, 0.3)}},
  {at: B.ownerPin - 6, pose: {...POSE.idle, ...EXPR.confident, ...look(0.3, -0.5, 0.2)}},
  {at: B.delivered + 2, pose: {...POSE.thumbsUp, ...EXPR.happy, ...look(0.5, -0.9, 0.3)}},
];
const saulB: Key[] = [
  {at: 0, pose: {...POSE.idle, ...EXPR.confident, ...look(-0.6, -0.6, -0.3)}},
  {at: B.planeGo, pose: {...POSE.pointUp, ...EXPR.talk, ...look(-0.4, -0.9, -0.3), lean: 2}},
  {at: B.vanGo + 4, pose: {...POSE.presentLeft, ...EXPR.confident, ...look(-0.6, -0.8, -0.3)}},
  {at: B.delivered, pose: {...POSE.thumbsUp, ...EXPR.happy, ...look(-0.2, -0.2, -0.1)}},
];
const custK: Key[] = [
  {at: 0, pose: {...POSE.idle, ...EXPR.neutral, ...look(-0.6, 0.2, -0.3)}},
  {at: B.handoff + 2, pose: {...POSE.handsUp, ...EXPR.happy, ...look(-0.5, 0.3, -0.3)}},
  {at: B.delivered + 8, pose: {...POSE.thumbsUp, ...EXPR.happy, ...look(-0.3, 0, -0.2)}},
];

const SceneB: React.FC<{f: number}> = ({f}) => {
  const p1 = prog(f, B.planeGo, B.planeArrive - B.planeGo, ease.inOut);
  const p2 = prog(f, B.vanGo, B.vanArrive - B.vanGo, ease.inOut);
  const plane = along(SEG1, p1);
  const van = along(SEG2, p2);
  const planeIn = pop(f, B.planeIn);
  const planeOut = prog(f, B.planeArrive, 6);
  const vanIn = pop(f, B.vanGo - 4);
  const handoff = prog(f, B.handoff, 10, ease.out);
  const boxOnGround = f < B.planeIn + 4;
  const brand = pop(f, B.brand, 9);
  const check = pop(f, B.delivered + 4, 9);
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{position: 'absolute'}}>
      <path d={US} fill={color.land} stroke={color.landStroke} strokeWidth={5} opacity={0.92} />
      <path d={LATAM} fill={color.land} stroke={color.landStroke} strokeWidth={5} opacity={0.92} />
      {[880, 960, 1040].map((y, i) =>
        [120, 330, 760, 940].map((x, j) => (
          <path key={`${i}-${j}`} d={`M ${x + ((i + j) % 2) * 60 + Math.sin(f / 12 + i + j) * 6} ${y} q 18 -14 36 0 t 36 0`} stroke={color.navySoft} strokeOpacity={0.3} strokeWidth={4} fill="none" strokeLinecap="round" />
        )),
      )}
      <Chip frame={f} at={B.chipsB} x={190} y={470} text="EE. UU." />
      <Chip frame={f} at={B.chipsB + 4} x={190} y={1190} text="Tu país" />
      {/* hub + destination */}
      <g transform={`translate(420 770) scale(${0.95 * pop(f, B.hub)})`}>
        <Warehouse />
      </g>
      <Chip frame={f} at={B.hub + 6} x={420} y={830} text="Bodega Miami" fill={color.white} ink={color.navy} />
      <g transform={`translate(810 665) scale(${0.85 * pop(f, B.house)})`}>
        <House />
      </g>
      <Route d={SEG1} p={prog(f, B.planeIn, B.planeArrive - B.planeIn, ease.inOut)} id="r1" />
      <Route d={SEG2} p={prog(f, B.vanGo - 2, B.vanArrive - B.vanGo, ease.inOut)} id="r2" />
      {/* people */}
      <Character s={evalRig(ownerK, f, 1)} look={OWNER} x={235} y={1710} scale={0.6} />
      <Character s={evalRig(custK, f, 2)} look={CUSTOMER} x={975} y={790} scale={0.44} />
      <Character s={evalRig(saulB, f, 3)} look={SAUL} x={850} y={1870} scale={0.7} />
      {/* box waiting next to owner (worried face = humor beat) */}
      {boxOnGround && (
        <g transform={`translate(430 1600)`}>
          <ProductBox size={84} face="worried" frame={f} />
        </g>
      )}
      {/* plane carrying the box */}
      {f >= B.planeIn && planeOut < 1 && (
        <g transform={`translate(${plane.x} ${plane.y}) rotate(${plane.angle}) scale(${0.85 * planeIn * (1 - planeOut)})`}>
          <g transform="translate(-10 -26)">
            <ProductBox size={56} face="happy" frame={f} />
          </g>
          <Plane />
        </g>
      )}
      {/* van carries it to the customer */}
      {f >= B.vanGo - 4 && (
        <g transform={`translate(${van.x} ${van.y + 34}) scale(${0.8 * vanIn})`}>
          <Van frame={f * (p2 > 0 && p2 < 1 ? 1 : 0)} />
          {handoff <= 0 && (
            <g transform="translate(-20 -96)">
              <ProductBox size={56} face="happy" frame={f} />
            </g>
          )}
        </g>
      )}
      {handoff > 0 && (
        <g transform={`translate(${720 + handoff * 210} ${600 + handoff * 40 - Math.sin(handoff * Math.PI) * 90})`}>
          <ProductBox size={62} face="happy" frame={f} />
        </g>
      )}
      {/* customs document gets stamped mid-route */}
      <g transform="translate(860 990) scale(0.72)">
        <DocumentCard frame={f} at={B.doc} stampAt={B.stamp} exitAt={B.docOut} title="Aduana" stamp="LISTO" x={0} y={0} />
      </g>
      {/* owner stays put */}
      <g transform={`translate(235 1290) scale(${pop(f, B.ownerPin)})`}>
        <Pin s={0.9} />
      </g>
      <Chip frame={f} at={B.ownerPin + 4} x={470} y={1250} text="Tú sigues aquí" fill={color.orange} />
      {check > 0.01 && (
        <g transform={`translate(810 440) scale(${check})`}>
          <circle r={44} fill={color.green} stroke={color.navy} strokeWidth={5} />
          <path d="M -20 0 L -6 16 L 22 -16" stroke={color.white} strokeWidth={10} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
      <Headline frame={f} at={B.headlineB} x={540} y={240} anchor="middle" size={86} lines={[['Tu', 'producto', 'viaja.'], ['Tú,', {t: 'no.', hl: true}]]} />
      {/* brand stamp */}
      {brand > 0.01 && (
        <g transform={`translate(540 980) rotate(-6) scale(${1.6 - 0.6 * brand})`} opacity={Math.min(1, brand * 1.4)}>
          <rect x={-300} y={-70} width={600} height={140} rx={30} fill={color.navy} stroke={color.white} strokeWidth={8} />
          <text textAnchor="middle" y={26} fontFamily={font.display} fontWeight={700} fontSize={78} fill={color.white}>
            Vende en <tspan fill={color.orangeLight}>USA</tspan>
          </text>
        </g>
      )}
    </svg>
  );
};

export type MotionTest01Props = {narration: NarrationProps};

export const MotionTest01: React.FC<MotionTest01Props> = ({narration}) => {
  const f = useCurrentFrame();
  const swapped = wipeSwapped(f, B.wipe);
  return (
    <FontGate>
      <AbsoluteFill>
        <NotebookPaper />
        {swapped ? <SceneB f={f} /> : <SceneA f={f} />}
        <MarkerWipe frame={f} at={B.wipe} />
        <Narration {...narration} />
      </AbsoluteFill>
    </FontGate>
  );
};
