import React, {useEffect, useState} from 'react';
import {continueRender, delayRender, staticFile} from 'remotion';

// Fonts are vendored in public/fonts (OFL, from @fontsource) so renders are
// deterministic and need no network access.
const faces: Array<[string, string, string]> = [
  ['Fredoka', '500', 'fredoka-latin-500-normal.woff2'],
  ['Fredoka', '600', 'fredoka-latin-600-normal.woff2'],
  ['Fredoka', '700', 'fredoka-latin-700-normal.woff2'],
  ['Nunito', '600', 'nunito-latin-600-normal.woff2'],
  ['Nunito', '700', 'nunito-latin-700-normal.woff2'],
  ['Nunito', '800', 'nunito-latin-800-normal.woff2'],
];

let promise: Promise<void> | null = null;
const load = () => {
  if (!promise) {
    promise = Promise.all(
      faces.map(([family, weight, file]) => {
        const f = new FontFace(family, `url(${staticFile(`fonts/${file}`)}) format('woff2')`, {weight});
        document.fonts.add(f);
        return f.load();
      }),
    ).then(() => undefined);
  }
  return promise;
};

/** Renders children only after brand fonts are loaded, so text measurement is exact. */
export const FontGate: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender('brand fonts'));
  useEffect(() => {
    load()
      .then(() => {
        setReady(true);
        continueRender(handle);
      })
      .catch((e) => {
        console.error(e);
        continueRender(handle);
      });
  }, [handle]);
  return ready ? <>{children}</> : null;
};
