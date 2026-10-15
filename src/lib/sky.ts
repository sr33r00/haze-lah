// The hero is tinted like the sky at the current PM2.5: clear blue, then ochre haze, then brown smoke.
type RGB = [number, number, number];
const STOPS: [number, RGB, RGB][] = [
  // pm2.5, top colour, bottom colour
  [0, [96, 160, 206], [196, 224, 238]],
  [40, [128, 170, 196], [214, 226, 228]],
  [90, [176, 160, 120], [226, 212, 178]],
  [160, [158, 120, 78], [214, 182, 134]],
  [260, [104, 76, 56], [160, 124, 94]],
];

const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB;

export function skyColors(pm: number): { top: string; bottom: string; dark: boolean } {
  let i = STOPS.findIndex(([v]) => pm < v);
  if (i === -1) i = STOPS.length;
  const lo = STOPS[Math.max(0, i - 1)];
  const hi = STOPS[Math.min(STOPS.length - 1, i)];
  const t = hi[0] === lo[0] ? 0 : (pm - lo[0]) / (hi[0] - lo[0]);
  const top = mix(lo[1], hi[1], t);
  const bottom = mix(lo[2], hi[2], t);
  // Relative luminance of the middle of the gradient decides the text colour.
  const mid = mix(top, bottom, 0.5).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * mid[0] + 0.7152 * mid[1] + 0.0722 * mid[2];
  const css = (c: RGB) => `rgb(${c.join(" ")})`;
  return { top: css(top), bottom: css(bottom), dark: lum < 0.28 };
}
