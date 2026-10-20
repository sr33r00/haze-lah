import type { NextConfig } from "next";

// Everything is served from this origin except OpenStreetMap map tiles, OpenFreeMap vector tiles, NASA satellite images and Windy webcam images.
const csp = [
  "default-src 'self'",
  // Next.js inline bootstrap scripts; the page renders no user input. Dev mode also needs eval.
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tile.openstreetmap.org https://gibs.earthdata.nasa.gov https://imgproxy.windy.com",
  "font-src 'self'",
  // OpenFreeMap serves the globe's map to MapLibre as data, not images: the style, the tile list, the vector tiles and the font glyphs. MapLibre's worker is a file of this origin.
  "connect-src 'self' https://tiles.openfreemap.org",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=(), payment=(), usb=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
