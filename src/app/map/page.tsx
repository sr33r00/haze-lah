import type { Viewport } from "next";
import MapScreen from "@/components/globe/MapScreen";
import { getHazeData } from "@/lib/data";
import { summaryOf } from "@/lib/mapSummary";
import { dotData } from "@/lib/readings";
import { REPLAY_URL, SMOKE_URL } from "@/lib/replay";
import { readReplay } from "@/lib/replayData";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta(
  "Haze globe: fires, wind and air quality across Singapore and the region",
  "A full-screen globe of the air around Singapore: PM2.5, PM10, carbon monoxide, nitrogen dioxide, sulphur dioxide, ozone and dust from the Copernicus model, NASA's satellite smoke, fires in Sumatra and Borneo, the wind, and where the air came from. Play any day from 1 August to the forecast.",
  "/map",
);
// The globe is dark whatever the site's theme, so the browser's bar is too.
export const viewport: Viewport = { themeColor: "#02030a", colorScheme: "dark" };
export const revalidate = 1800;

export default async function MapPage() {
  const [data, replay] = await Promise.all([getHazeData(), readReplay().catch(() => null)]);
  return (
    <>
      {/* The page's own data and the globe's hosts are on their way from the first bytes, long before the code that uses them has loaded. Elements, not react-dom's preload(): those would also fire when the router prefetches this page from another one. */}
      {[SMOKE_URL, REPLAY_URL].map((href) => (
        <link key={href} rel="preload" as="fetch" href={href} crossOrigin="anonymous" fetchPriority="low" />
      ))}
      {["https://tiles.openfreemap.org", "https://gibs.earthdata.nasa.gov"].map((href) => (
        <link key={href} rel="preconnect" href={href} crossOrigin="anonymous" />
      ))}
      <MapScreen dots={dotData(data)} psiDaily={data.psiDaily} summary={summaryOf(data, replay)} />
    </>
  );
}
