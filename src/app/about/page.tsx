import Link from "next/link";
import { pageMeta } from "@/lib/seo";
import { GROUP_LABEL, LEVEL_COLOR, LEVEL_NAME, NEA_ADVICE, type Group } from "@/lib/bands";
import AccuracyTable from "@/components/AccuracyTable";
import { fetchAccuracy } from "@/lib/accuracy";
import { CIGARETTE_NOTES, CIGARETTE_SOURCES } from "@/lib/cigarettes";
import { FORECAST_METHOD } from "@/lib/forecast";

export const metadata = pageMeta(
  "About Haze Lah: data sources, forecast method and FAQ",
  "How Haze Lah works: NEA health advisory bands, the forecast method, measured accuracy, data sources and measured accuracy.",
  "/about",
);
export const revalidate = 3600;

const PSI_RANGES = ["0–50", "51–100", "101–200", "201–300", "Above 300"];

const SOURCES = [
  ["NEA via data.gov.sg", "Live 1-hr PM2.5 and 24-hr PSI for 5 regions", "https://data.gov.sg"],
  ["NEA news RSS", "Haze situation updates and announcements", "https://www.nea.gov.sg/media/news/advisories"],
  ["NEA historical PSI", "Hourly 24-hr PSI since April 2014, used to compare this week's peak with past years", "https://data.gov.sg/datasets/d_b4cf557f8750260d229c49fd768e11ed/view"],
  ["Meteorological Service Singapore", "24-hour weather forecast", "https://www.weather.gov.sg/weather-forecast-24hrs/"],
  ["Malaysia DOE APIMS", "Live Air Pollutant Index for Malaysian stations", "https://eqms.doe.gov.my/APIMS/main"],
  ["NASA FIRMS (VIIRS)", "Satellite-detected fires in Sumatra, Borneo and Malaysia", "https://firms.modaps.eosdis.nasa.gov"],
  ["OpenAQ", "Low-cost community air sensors on the map, mainly AirGradient", "https://openaq.org"],
  ["Copernicus CAMS via Open-Meteo", "5-day PM2.5 smoke model; Indonesian city estimates", "https://open-meteo.com/en/docs/air-quality-api"],
  ["ECMWF via Open-Meteo", "Wind at 850 hPa (about 1.5 km up) and rain forecast", "https://open-meteo.com"],
  ["ASEAN Specialised Meteorological Centre", "Regional haze outlook and hotspot maps (reference)", "https://asmc.asean.org"],
  ["MyCMAQ (MetMalaysia)", "Malaysian air-quality forecast maps (reference)", "https://mycmaq.met.gov.my"],
];

export default async function About() {
  const accuracy = await fetchAccuracy(1);
  const groups = Object.keys(GROUP_LABEL) as Group[];
  return (
    <main className="mx-auto max-w-lg space-y-5 px-4 pb-16 pt-4 text-sm leading-relaxed">
      <Link href="/" className="text-accent">
        ← Back
      </Link>
      <h1 className="text-2xl font-bold">How this works</h1>

      <p>
        Looking for masks, schools, work or health answers? See the{" "}
        <Link href="/guide" className="text-accent underline">
          Guide
        </Link>
        .
      </p>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">The answer at the top</h2>
        <p>
          &ldquo;Should I go out?&rdquo; looks at two NEA readings for your region: the latest <b>1-hour PM2.5</b>, which NEA
          recommends for deciding on immediate activities, and the <b>24-hour PSI</b>, which it recommends for planning the day. Each
          PM2.5 band is matched to the advisory row it corresponds to (Normal → Moderate, Elevated → Unhealthy, High → Very unhealthy,
          Very high → Hazardous), and the advice follows whichever of the two is worse, so a brief dip in PM2.5 is not shown as all
          clear while the day&apos;s PSI is still high. The 5-day outlook uses the expected 24-hour PSI.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">NEA health advisory (24-hr PSI)</h2>
        <div className="overflow-x-auto rounded-2xl bg-surface">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line">
                <th className="p-2">PSI</th>
                {groups.map((g) => (
                  <th key={g} className="p-2">
                    {GROUP_LABEL[g]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LEVEL_NAME.map((name, i) => (
                <tr key={name} className="border-b border-line align-top last:border-0">
                  <td className="p-2">
                    <span className="font-semibold" style={{ color: LEVEL_COLOR[i] }}>
                      {name}
                    </span>
                    <br />
                    {PSI_RANGES[i]}
                  </td>
                  {groups.map((g) => (
                    <td key={g} className="p-2">
                      {NEA_ADVICE[g][i]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">
          1-hr PM2.5 bands (µg/m³): Band I Normal 0–55, Band II Elevated 56–150, Band III High 151–250, Band IV Very high ≥251.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">The forecast</h2>
        <p>{FORECAST_METHOD}</p>
        <p>
          The 24-hr PSI outlook is computed from the forecast PM2.5 using NEA&apos;s published PM2.5 sub-index breakpoints (a rolling
          24-hour mean). During haze, PM2.5 almost always sets the PSI. Forecasts are estimates and can be wrong, especially when wind
          shifts suddenly or fires flare up.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Cigarette comparison</h2>
        {CIGARETTE_NOTES.map((t) => (
          <p key={t}>{t}</p>
        ))}
        <p className="text-xs text-muted">
          Sources:{" "}
          {CIGARETTE_SOURCES.map(([name, url], i) => (
            <span key={url}>
              {i > 0 && "; "}
              <a href={url} target="_blank" rel="noreferrer" className="text-accent underline">
                {name}
              </a>
            </span>
          ))}
          .
        </p>
      </section>

      <section id="accuracy" className="space-y-2">
        <h2 className="text-lg font-semibold">Measured accuracy</h2>
        <p>
          Every hour the forecast is saved as issued, then compared with what NEA actually measured. Numbers are the average miss in
          µg/m³ (lower is better), next to the raw Copernicus model and the simplest guess, &ldquo;same as now&rdquo;. An alert counts as
          caught when we forecast PM2.5 above 55 and it happened.
        </p>
        {accuracy ? (
          <>
            <AccuracyTable a={accuracy} />
            <p className="text-xs text-muted">
              {accuracy.forecasts} forecasts since {accuracy.from?.slice(0, 10)}. Raw data is public in the project repository.
            </p>
          </>
        ) : (
          <p className="text-muted">Scores appear once enough forecasts have been checked against real readings.</p>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Data sources</h2>
        <ul className="space-y-2">
          {SOURCES.map(([name, what, url]) => (
            <li key={name} className="rounded-2xl bg-surface p-3">
              <a href={url} target="_blank" rel="noreferrer" className="font-semibold text-accent">
                {name}
              </a>
              <div className="text-muted">{what}</div>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">
          Contains information from NEA made available under the Singapore Open Data Licence. Contains modified Copernicus Atmosphere
          Monitoring Service information. Weather data by Open-Meteo.com (CC BY 4.0). Fire data from NASA FIRMS. Community sensor data from OpenAQ.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Privacy</h2>
        <p>
          No accounts and no cookies. Anonymous page-view counts are collected with Vercel Web Analytics. Your region and group
          choices stay on your device.
        </p>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-3">
        This is an independent tool, not an official government service. If you feel unwell, seek medical attention. Official advisories:{" "}
        <a className="underline" href="https://www.haze.gov.sg">
          haze.gov.sg
        </a>
        .
      </section>
    </main>
  );
}
