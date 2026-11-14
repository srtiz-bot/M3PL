import React from 'react';
import {Audio, Sequence, staticFile} from 'remotion';

/**
 * Approved narration is sacred:
 * - It is placed as-is (no time-stretch, pitch shift, trimming of words,
 *   regenerated voice or TTS). Visual beats are retimed to it, not vice versa.
 * - Volume stays at 1 unless the approved mix says otherwise; music, if any,
 *   is ducked under it, never the reverse.
 * - Source file lives in public/audio/<episode>/narration.(wav|mp3|m4a).
 */
export type NarrationProps = {src: string | null; startFrame?: number; volume?: number};

export const Narration: React.FC<NarrationProps> = ({src, startFrame = 0, volume = 1}) => {
  if (!src) return null;
  return (
    <Sequence from={startFrame} name="Narration (approved — do not alter)">
      <Audio src={src.startsWith('http') ? src : staticFile(src)} volume={volume} />
    </Sequence>
  );
};
