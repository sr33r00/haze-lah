import type { Viewport } from "next";
import MapScreen from "@/components/globe/MapScreen";
import { LEVEL_NAME, psiLevel } from "@/lib/bands";
import { mapContext } from "@/lib/context";
import { getHazeData } from "@/lib/data";
import { dotData } from "@/lib/readings";
import { REPLAY_URL, SMOKE_URL, aheadParts, trailCaption } from "@/lib/replay";
import { readReplay } from "@/lib/replayData";
import { pageMeta } from "@/lib/seo";
import { islandMax } from "@/lib/situation";
import type { HazeData, Replay } from "@/lib/types";

export const metadata = pageMeta(
  "Haze globe: fires, wind and air quality across Singapore and the region",
  "A full-screen globe of the air around Singapore: PM2.5, PM10, carbon monoxide, nitrogen dioxide, sulphur dioxide, ozone and dust from the Copernicus model, NASA's satellite smoke, fires in Sumatra and Borneo, the wind, and where the air came from. Play any day from 1 August to the forecast.",
  "/map",
);
// The globe is dark whatever the site's theme, so the browser's bar is too.
export const viewport: Viewport = { themeColor: "#02030a", colorScheme: "dark" };
export const revalidate = 1800;

/** Today in a few sentences, for screen readers, crawlers and a device that cannot run the globe. */
function summaryOf(data: HazeData, replay: Replay | null): string[] {
  const lines: string[] = [];
  const psi = data.nea ? islandMax(data.nea.psi24) : null;
  if (psi) lines.push(`Singapore's highest 24-hour PSI is ${psi.psi} (${LEVEL_NAME[psiLevel(psi.psi)]}), in the ${psi.region} region.`);
  const context = mapContext(data);
  if (context) lines.push(context);
  const day = replay?.days.at(-1);
  if (day) {
    lines.push(trailCaption(day));
    const ahead = day.ahead && aheadParts(day.ahead);
    if (ahead) lines.push([ahead.reach, ahead.source, ahead.expected].filter(Boolean).join(" "));
  }
  return lines;
}

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
