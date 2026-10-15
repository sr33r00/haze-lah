import { useId } from "react";

/** The app icon (same artwork as app/icon.svg) as an inline, rounded SVG. */
export default function Logo({ size = 32 }: { size?: number }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="shrink-0">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#60a0ce" />
          <stop offset="1" stopColor="#e2d4b2" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill={`url(#${id})`} />
      <path d="M10 40c8-6 14-6 22 0s14 6 22 0" fill="none" stroke="#13232e" strokeWidth="5" strokeLinecap="round" />
      <path d="M10 28c8-6 14-6 22 0s14 6 22 0" fill="none" stroke="#13232e" strokeWidth="5" strokeLinecap="round" opacity=".45" />
    </svg>
  );
}
