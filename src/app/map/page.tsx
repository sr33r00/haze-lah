import { pageMeta } from "@/lib/seo";
import AppShell from "@/components/AppShell";
import MapView from "@/components/MapView";
import { mapContext } from "@/lib/context";
import { getHazeData } from "@/lib/data";

export const metadata = pageMeta(
  "Haze map: smoke forecast, fires and wind around Singapore",
  "Map of the smoke forecast, satellite-detected fires in Sumatra and Borneo, a 3D globe of NASA satellite data on smoke and carbon monoxide, air-quality stations and wind direction around Singapore.",
  "/map",
);
export const revalidate = 300;

export default async function MapPage() {
  const data = await getHazeData();
  const wind = data.weather[0] && !isNaN(data.weather[0].windDir) ? data.weather[0] : null;
  return (
    <AppShell data={data} title="Smoke map">
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
