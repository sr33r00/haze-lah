import { ImageResponse } from "next/og";

/** The icon.svg design as a PNG. Rounded for "any"; full-bleed for maskable and Apple, whose launchers apply their own mask (waves sit inside the 80% safe zone). */
export function appIcon(size: number, rounded: boolean) {
  return new ImageResponse(
    (
      <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#60a0ce" />
            <stop offset="1" stopColor="#e2d4b2" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx={rounded ? 14 : 0} fill="url(#sky)" />
        <path d="M10 40c8-6 14-6 22 0s14 6 22 0" fill="none" stroke="#13232e" strokeWidth="5" strokeLinecap="round" />
        <path d="M10 28c8-6 14-6 22 0s14 6 22 0" fill="none" stroke="#13232e" strokeWidth="5" strokeLinecap="round" opacity=".45" />
      </svg>
    ),
    { width: size, height: size },
  );
}
