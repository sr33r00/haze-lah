import { LEVEL_NAME, REGIONS, pm25Band } from "@/lib/bands";
import { getHazeData } from "@/lib/data";
import { SITE_URL } from "@/lib/links";
import { islandSummary } from "@/lib/situation";

export const revalidate = 1800;

const fmt = (v: number | undefined) => (v == null || isNaN(v) ? "n/a" : String(Math.round(v)));

export async function GET() {
  const data = await getHazeData();
  const s = islandSummary(data);
  const day = data.forecast.days[0];
  const now = [`## Current conditions`];
  if (data.nea) {
    now.push(`- NEA reading time: ${data.nea.time}`);
    if (s) now.push(`- Island 24-hr PSI: ${s.psi.min === s.psi.max ? s.psi.max : `${s.psi.min} to ${s.psi.max}`} (${LEVEL_NAME[s.level]}, NEA descriptor)`);
    for (const r of REGIONS) {
      const pm = data.history?.regions[r].at(-1)?.value;
      now.push(`- ${r}: 24-hr PSI ${fmt(data.nea.psi24[r])}; 1-hr PM2.5 ${fmt(pm)} µg/m³${pm != null && !isNaN(pm) ? ` (${pm25Band(pm).name})` : ""}`);
    }
  } else now.push("- NEA readings are temporarily unavailable.");
  if (day) now.push(`- Forecast peak ${day.date}: 24-hr PSI ${fmt(day.psiMax)}, 1-hr PM2.5 ${fmt(day.pm25Max)} µg/m³ (likely ${fmt(day.low)} to ${fmt(day.high)})`);

  const body = `# Haze Lah

> Live Singapore haze tracker: NEA PSI and PM2.5 by region, a plain answer on whether it is safe to go out, a 5-day haze forecast and a globe of the air around Singapore. Independent, free, not an official government service.

Canonical site: ${SITE_URL}

## Pages
- [Now](${SITE_URL}/): the verdict for your region and group, current PSI and PM2.5, practical tips
- [Forecast](${SITE_URL}/forecast): next 48 hours of PM2.5 and a 5-day PSI outlook, with measured accuracy
- [Map](${SITE_URL}/map): a full-screen globe with a timeline from 1 August to the forecast: PM2.5, PM10, carbon monoxide, nitrogen dioxide, sulphur dioxide, ozone and dust from the Copernicus model, NASA satellite smoke, satellite-detected fires, wind, where the air came from, and air-quality readings (?view=path frames the air's path)
- [Photos](${SITE_URL}/photos): live LTA camera photos and webcams
- [News](${SITE_URL}/news): NEA haze updates, CNA and Straits Times haze headlines, and a timeline of changes
- [Guide](${SITE_URL}/guide): short answers on masks, exercise, air purifiers, schools, work and health, each with NEA, MOH, MOE or MOM sources
- [About](${SITE_URL}/about): where the data comes from, how the advice and forecast work, and measured accuracy

## How the advice works
- "Should I go out now?" follows NEA's personal guide for the region's latest 1-hr PM2.5 band, as NEA advises for activities in the next few hours (the 24-hr PSI advisory is used only when there is no PM2.5 reading; the 24-hr PSI forecast is for planning the next day). For the next hour, band II: reduce strenuous outdoor activity (vulnerable persons avoid it); band III: avoid it (vulnerable persons avoid all outdoor activity); band IV: minimise all outdoor activity (vulnerable persons avoid it).
- Planning ahead uses the 24-hr PSI. NEA bands: Good 0-50, Moderate 51-100, Unhealthy 101-200, Very unhealthy 201-300, Hazardous above 300.
- 1-hr PM2.5 bands (µg/m³): Normal 0-55, Elevated 56-150, High 151-250, Very high 251 and above.
- The forecast is the Copernicus CAMS PM2.5 model calibrated against live NEA readings; accuracy is measured and published on the About page.

## Data sources
- [NEA via data.gov.sg](https://data.gov.sg): live 1-hr PM2.5 and 24-hr PSI
- [NEA advisories](https://www.nea.gov.sg/media/news/advisories): haze news
- [Malaysia DOE APIMS](https://eqms.doe.gov.my/APIMS/main): Malaysian Air Pollutant Index
- [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov): satellite fire detections
- [Copernicus CAMS via Open-Meteo](https://open-meteo.com/en/docs/air-quality-api): PM2.5 forecast
- [OpenAQ](https://openaq.org): community air sensors
- [NASA GIBS](https://gibs.earthdata.nasa.gov): satellite images (OMPS aerosol index)
- [OpenFreeMap](https://openfreemap.org): the vector map under them, drawn with MapLibre (map data © OpenStreetMap contributors, © OpenMapTiles)
- LTA traffic images: live camera photos

${now.join("\n")}
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
