import { pageMeta } from "@/lib/seo";
import AppShell from "@/components/AppShell";
import MapView from "@/components/MapView";
import { mapContext } from "@/lib/context";
import { getHazeData } from "@/lib/data";
import { LAYERS, globeSeries } from "@/lib/globe";
import { REPLAY_URL, SMOKE_URL } from "@/lib/replay";

export const metadata = pageMeta(
  "Haze map: smoke forecast, fires and wind around Singapore",
  "Map of the smoke forecast, satellite-detected fires in Sumatra and Borneo, a zoomable map of NASA satellite data on smoke and carbon monoxide, air-quality stations and wind direction around Singapore.",
  "/map",
);
export const revalidate = 300;

export default async function MapPage() {
  const data = await getHazeData();
  const wind = data.weather[0] && !isNaN(data.weather[0].windDir) ? data.weather[0] : null;
  return (
    <AppShell data={data} title="Smoke map">
      {/* The page's own data and the basemap's hosts are on their way from the first bytes, long before the map code that uses them has loaded. Elements, not react-dom's preload(): those would also fire when the router prefetches this page from another one. */}
      {[SMOKE_URL, REPLAY_URL, globeSeries(LAYERS[0])].map((href) => (
        <link key={href} rel="preload" as="fetch" href={href} crossOrigin="anonymous" fetchPriority="low" />
      ))}
      <link rel="preconnect" href="https://tiles.openfreemap.org" crossOrigin="anonymous" />
      <link rel="preconnect" href="https://tile.openstreetmap.org" />
      <MapView
        fires={data.fires}
        stations={data.stations}
        sensors={data.sensors}
        psi24={data.nea?.psi24 ?? null}
        psiDaily={data.psiDaily}
        biasFactor={data.forecast.biasFactor}
        windDir={wind?.windDir ?? null}
        context={mapContext(data)}
        now={Date.now()}
      />
    </AppShell>
  );
}
