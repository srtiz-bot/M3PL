import React from 'react';
import {Composition, Still} from 'remotion';
import {canvas} from './brand/tokens';
import {FontGate} from './brand/fonts';
import {PoseSheet} from './dev/PoseSheet';
import {MotionTest01, MotionTest01Props} from './episodes/motion-test-01/MotionTest01';
import {DURATION} from './episodes/motion-test-01/beats';

const Sheet: React.FC = () => (
  <FontGate>
    <PoseSheet />
  </FontGate>
);

export const Root: React.FC = () => (
  <>
    <Composition
      id="MotionTest01"
      component={MotionTest01}
      durationInFrames={DURATION}
      fps={canvas.fps}
      width={canvas.width}
      height={canvas.height}
      // narration.src: e.g. 'audio/motion-test-01/narration.wav' once the approved file is provided.
      defaultProps={{narration: {src: null}} satisfies MotionTest01Props}
    />
    <Still id="PoseSheet" component={Sheet} width={canvas.width} height={canvas.height} />
  </>
);
