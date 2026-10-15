// US EPA AQI breakpoints for PM2.5 before the 2024 revision: [AQI lo, AQI hi, PM2.5 lo, PM2.5 hi µg/m³].
// WAQI still reports on this scale. Cross-check: WAQI "Central, Singapore" AQI 216 while NEA's 1-hr PM2.5
// for Central was 166 µg/m³; the inverse below gives 150.5 + (216 - 201) / (300 - 201) * (250.4 - 150.5) = 165.6.
const BREAKPOINTS = [
  [0, 50, 0, 12.0],
  [51, 100, 12.1, 35.4],
  [101, 150, 35.5, 55.4],
  [151, 200, 55.5, 150.4],
  [201, 300, 150.5, 250.4],
  [301, 400, 250.5, 350.4],
  [401, 500, 350.5, 500.4],
] as const;

/** Convert a US EPA AQI (pre-2024 PM2.5 scale) back to PM2.5 in µg/m³. */
export function aqiToPm25(aqi: number): number | null {
  if (!Number.isFinite(aqi) || aqi < 0 || aqi > 500) return null;
  const [aLo, aHi, cLo, cHi] = BREAKPOINTS.find((b) => aqi <= b[1]) ?? BREAKPOINTS[BREAKPOINTS.length - 1];
  return cLo + ((aqi - aLo) / (aHi - aLo)) * (cHi - cLo);
}
