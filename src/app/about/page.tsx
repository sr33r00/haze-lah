import { Activity, BookOpen, Camera, CloudSun, Flame, History, Newspaper } from "lucide-react";
import Link from "next/link";
import { pageMeta } from "@/lib/seo";
import { GROUP_LABEL, LEVEL_COLOR, LEVEL_NAME, NEA_ADVICE, type Group } from "@/lib/bands";
import AccuracyTable from "@/components/AccuracyTable";
import AppShell from "@/components/AppShell";
import SectionNav from "@/components/SectionNav";
import { Bullets } from "@/components/ui";
import { fetchAccuracy } from "@/lib/accuracy";
import { CIGARETTE_NOTES, CIGARETTE_SOURCES } from "@/lib/cigarettes";
import { getHazeData } from "@/lib/data";
import { FORECAST_METHOD } from "@/lib/forecast";

export const metadata = pageMeta(
  "About Haze Lah: data sources, forecast method and accuracy",
  "How Haze Lah works: where the data comes from, how the advice follows NEA's guidance, how the forecast is made and how accurate it has been.",
  "/about",
);
export const revalidate = 3600;

const PSI_RANGES = ["0–50", "51–100", "101–200", "201–300", "Above 300"];

const SECTIONS = [
  { id: "sources", title: "Data sources" },
  { id: "advice", title: "How the advice works" },
  { id: "forecast", title: "How the forecast works" },
  { id: "accuracy", title: "Accuracy" },
  { id: "cigarettes", title: "Cigarette comparison" },
  { id: "privacy", title: "Privacy" },
];

const ADVICE_POINTS = [
  "The 1-hour PM2.5, for the next few hours, read with NEA's personal guide (stricter for the elderly, pregnant women, children and people with heart or lung disease).",
  "The 24-hour PSI, for planning the day, read with NEA's health advisory below.",
  "The answer follows whichever of the two is stricter. The 5-day outlook uses the expected 24-hour PSI; the hourly plan uses the PM2.5 guide.",
];

const SOURCE_GROUPS = [
  {
    title: "Live air readings",
    icon: Activity,
    items: [
      ["NEA via data.gov.sg", "Live 1-hour PM2.5 and 24-hour PSI for the five regions, updated hourly", "https://data.gov.sg"],
      ["Malaysia DOE APIMS", "Live Air Pollutant Index for Malaysian stations", "https://eqms.doe.gov.my/APIMS/main"],
      ["OpenAQ", "Low-cost community air sensors on the map, mainly AirGradient", "https://openaq.org"],
    ],
  },
  {
    title: "Forecast and weather",
    icon: CloudSun,
    items: [
      [
        "Copernicus CAMS via Open-Meteo",
        "The EU's atmosphere model, run by ECMWF. It forecasts smoke particles (PM2.5) up to 5 days ahead. Haze Lah corrects it with NEA's live readings. Also used for the smoke map and Indonesian city estimates.",
        "https://open-meteo.com/en/docs/air-quality-api",
      ],
      ["ECMWF via Open-Meteo", "Wind at 850 hPa (about 1.5 km up) and rain forecast", "https://open-meteo.com"],
      ["Meteorological Service Singapore", "24-hour weather forecast", "https://www.weather.gov.sg/weather-forecast-24hrs/"],
    ],
  },
  {
    title: "Photos",
    icon: Camera,
    items: [["LTA traffic cameras via data.gov.sg", "Live photos at Woodlands, Tuas and Sentosa Gateway, updated every few minutes", "https://data.gov.sg"]],
  },
  {
    title: "Fires",
    icon: Flame,
    items: [["NASA FIRMS (VIIRS)", "Satellite-detected fires in Sumatra, Borneo and Malaysia", "https://firms.modaps.eosdis.nasa.gov"]],
  },
  {
    title: "News",
    icon: Newspaper,
    items: [
      ["NEA haze updates", "Haze situation updates and announcements", "https://www.nea.gov.sg/media/news/advisories"],
      ["CNA", "Singapore haze headlines", "https://www.channelnewsasia.com"],
      ["The Straits Times", "Singapore haze headlines", "https://www.straitstimes.com"],
    ],
  },
  {
    title: "History",
    icon: History,
    items: [
      [
        "NEA historical PSI",
        "Hourly 24-hour PSI since April 2014, to compare this week's peak with past years",
        "https://data.gov.sg/datasets/d_b4cf557f8750260d229c49fd768e11ed/view",
      ],
    ],
  },
  {
    title: "For reference",
    icon: BookOpen,
    items: [
      ["ASEAN Specialised Meteorological Centre", "Regional haze outlook and hotspot maps", "https://asmc.asean.org"],
      ["MyCMAQ (MetMalaysia)", "Malaysian air-quality forecast maps", "https://mycmaq.met.gov.my"],
    ],
  },
];

const H2 = "text-[20px] font-bold";
const H3 = "text-[16px] font-semibold";

export default async function About() {
  const [data, accuracy] = await Promise.all([getHazeData(), fetchAccuracy(1)]);
  const groups = Object.keys(GROUP_LABEL) as Group[];
  return (
    <AppShell data={data} title="About">
      <div className="mt-4 px-4 pb-10 text-[15px] leading-relaxed">
        <div className="max-w-2xl space-y-2">
          <p>
            Haze Lah is a free, independent haze tracker for Singapore. It turns NEA&apos;s official readings into a plain answer on whether
            to go out, and adds a forecast and a map of fires and wind.
          </p>
          <p>No ads and no accounts. Made by sr33.</p>
          <p>
            Not an official government service. For official advisories, see{" "}
            <a href="https://www.haze.gov.sg" target="_blank" rel="noreferrer" className="text-accent underline">
              haze.gov.sg
            </a>
            .
          </p>
          <p>
            Questions about masks, schools, work or health? See the{" "}
            <Link href="/guide" className="text-accent underline">
              Guide
            </Link>
            .
          </p>
        </div>

        <div className="mt-6 space-y-8 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-x-10 lg:space-y-0">
          <SectionNav label="About sections" sections={SECTIONS} />
          <div className="max-w-2xl space-y-8">
            <section id="sources" className="scroll-mt-20 space-y-4">
              <h2 className={H2}>Data sources</h2>
              {SOURCE_GROUPS.map(({ title, icon: Icon, items }) => (
                <div key={title}>
                  <h3 className={`mb-2 flex items-center gap-2 ${H3}`}>
                    <Icon size={16} aria-hidden className="text-muted" />
                    {title}
                  </h3>
                  <ul className="divide-y divide-line rounded-2xl bg-surface">
                    {items.map(([name, what, url]) => (
                      <li key={name} className="p-3">
                        <a href={url} target="_blank" rel="noreferrer" className="font-semibold text-accent">
                          {name}
                        </a>
                        <div className="text-[14px] text-muted">{what}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <p className="text-[13px] text-muted">
                Contains information from NEA and LTA made available under the Singapore Open Data Licence. Contains modified Copernicus Atmosphere
                Monitoring Service information. Weather data by Open-Meteo.com (CC BY 4.0). Fire data from NASA FIRMS. Community sensor data
                from OpenAQ.
              </p>
            </section>

            <section id="advice" className="scroll-mt-20 space-y-3">
              <h2 className={H2}>How the advice works</h2>
              <p>The answer at the top of Now uses two NEA readings for your region:</p>
              <Bullets items={ADVICE_POINTS} />
              <h3 className={`pt-2 ${H3}`}>NEA health advisory (24-hour PSI)</h3>
              <div className="overflow-x-auto rounded-2xl bg-surface">
                <table className="w-full text-left text-[13px]">
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
              <p className="text-[13px] text-muted">
                1-hr PM2.5 bands (µg/m³): Band I Normal 0–55, Band II Elevated 56–150, Band III High 151–250, Band IV Very high ≥251.
                Personal guide for the next hour: band II reduce strenuous outdoor activity (vulnerable persons avoid it), band III avoid
                strenuous outdoor activity (vulnerable persons avoid all outdoor activity), band IV minimise all outdoor activity
                (vulnerable persons avoid it). Source:{" "}
                <a
                  href="https://www.haze.gov.sg/docs/default-source/posters/haze-pm-psi-guide-a4-english.pdf"
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent underline"
                >
                  NEA PSI and PM2.5 guide
                </a>
                .
              </p>
            </section>

            <section id="forecast" className="scroll-mt-20 space-y-3">
              <h2 className={H2}>How the forecast works</h2>
              <p>
                The forecast starts from Copernicus CAMS, the EU&apos;s global atmosphere model. It usually gets the timing of haze right
                but is often far off on how bad it gets, so Haze Lah corrects it against what NEA measured over the past 48 hours.
              </p>
              <p className="text-[14px] text-muted">
                <b>Technical detail: </b>
                {FORECAST_METHOD}
              </p>
              <p>
                The 24-hr PSI outlook is computed from the forecast PM2.5 using NEA&apos;s published PM2.5 sub-index breakpoints (a rolling
                24-hour mean). During haze, PM2.5 almost always sets the PSI. Forecasts are estimates and can be wrong, especially when wind
                shifts suddenly or fires flare up.
              </p>
            </section>

            <section id="accuracy" className="scroll-mt-20 space-y-3">
              <h2 className={H2}>Accuracy</h2>
              <p>
                Every hour the forecast is saved as issued, then compared with what NEA actually measured. Numbers are the average miss in
                µg/m³ (lower is better), next to the raw Copernicus model and the simplest guess, &ldquo;same as now&rdquo;. An alert counts
                as caught when we forecast PM2.5 above 55 and it happened.
              </p>
              {accuracy ? (
                <>
                  <AccuracyTable a={accuracy} />
                  <p className="text-[13px] text-muted">
                    {accuracy.forecasts} forecasts since {accuracy.from?.slice(0, 10)}. Raw data is public in the project repository.
                  </p>
                </>
              ) : (
                <p className="text-muted">Scores appear once enough forecasts have been checked against real readings.</p>
              )}
            </section>

            <section id="cigarettes" className="scroll-mt-20 space-y-3">
              <h2 className={H2}>Cigarette comparison</h2>
              {CIGARETTE_NOTES.map((t) => (
                <p key={t}>{t}</p>
              ))}
              <p className="text-[13px] text-muted">
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

            <section id="privacy" className="scroll-mt-20 space-y-3">
              <h2 className={H2}>Privacy</h2>
              <p>
                No accounts and no cookies. Anonymous page-view counts are collected with Vercel Web Analytics. Your region and group
                choices stay on your device.
              </p>
            </section>

            <section className="rounded-2xl border border-line bg-surface p-3">
              This is an independent tool, not an official government service. If you feel unwell, seek medical attention. Official
              advisories:{" "}
              <a className="underline" href="https://www.haze.gov.sg">
                haze.gov.sg
              </a>
              .
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
