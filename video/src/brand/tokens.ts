// Vende en USA — brand tokens for animated explainers.
// Change values here, never inline in scenes.
export const color = {
  paper: '#F6EFDF', // cream notebook paper
  paperShade: '#EDE3CC',
  rule: 'rgba(27, 42, 74, 0.13)', // notebook lines (navy, faint)
  margin: 'rgba(196, 90, 30, 0.45)', // margin line (burnt orange, faint)
  navy: '#1B2A4A', // primary text + outlines
  navySoft: '#3A4A6B',
  orange: '#C45A1E', // burnt orange accent
  orangeLight: '#E8894E',
  orangeTint: '#F5D3B8',
  white: '#FFFDF8',
  kraft: '#D9A66B', // cardboard
  kraftDark: '#B8834A',
  green: '#3E8E5A', // "ok / delivered" only, use sparingly
  land: '#E9DDC2',
  landStroke: 'rgba(27, 42, 74, 0.55)',
} as const;

export const font = {
  display: 'Fredoka', // headlines, labels
  body: 'Nunito', // bubbles, documents, small text
} as const;

// Vertical 9:16 for Reels / TikTok / Shorts.
export const canvas = {width: 1080, height: 1920, fps: 30} as const;

// Safe area: keep text out of the platform UI (top bar, caption + buttons at bottom/right).
export const safe = {top: 170, bottom: 380, left: 70, right: 150} as const;

// Type scale (px at 1080 wide). Minimum on-screen text = 34px.
export const type = {
  hero: 112,
  h1: 92,
  h2: 68,
  bubble: 50,
  label: 40,
  small: 34,
} as const;

export const stroke = {outline: 6, thin: 4} as const;
