import AppShell from "@/components/AppShell";
import MapView from "@/components/MapView";
import { mapContext } from "@/lib/context";
import { getHazeData } from "@/lib/data";

export const metadata = { title: "Smoke map · Haze Lah" };
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
        biasFactor={data.forecast.biasFactor}
        windDir={wind?.windDir ?? null}
        context={mapContext(data)}
      />
    </AppShell>
  );
}
