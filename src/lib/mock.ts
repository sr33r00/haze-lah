// Synthetic data for local development and screenshots (HAZE_MOCK=1). Not real readings.
import { REGIONS, type Region } from "./bands";
import type { Inputs } from "./data";
import type { DayPsi, HourPoint, NewsItem, SmokeGrid, Station, WeatherHour } from "./types";
import { hourKey, sgDate } from "./util";

export function mockInputs(): Inputs {
  const now = Date.parse(hourKey(new Date()));
  const H = 3600_000;
  const shape = (t: number) => {
    const sgHour = (new Date(t).getUTCHours() + 8) % 24;
    return 1 + 0.35 * Math.cos(((sgHour - 7) / 24) * 2 * Math.PI);
  };
  const regionScale: Record<Region, number> = { north: 0.7, south: 0.9, east: 0.95, west: 1.25, central: 1.05 };
  const regions = Object.fromEntries(REGIONS.map((r) => [r, [] as HourPoint[]])) as Record<Region, HourPoint[]>;
  const island: HourPoint[] = [];
  for (let h = 40; h >= 0; h--) {
    const t = now - h * H;
    const base = 95 * shape(t) * (1 + 0.15 * Math.sin(h / 5));
    let sum = 0;
    for (const r of REGIONS) {
      const v = Math.round(base * regionScale[r]);
      regions[r].push({ time: new Date(t).toISOString(), value: v });
      sum += v;
    }
    island.push({ time: new Date(t).toISOString(), value: sum / REGIONS.length });
  }
  const cams: HourPoint[] = [];
  for (let h = -48; h <= 120; h++) {
    const t = now + h * H;
    const trend = h > 30 ? Math.max(0.35, 1 - (h - 30) / 80) : 1;
    cams.push({ time: new Date(t).toISOString(), value: 38 * shape(t) * trend });
  }
  const weather: WeatherHour[] = [];
  for (let h = -24; h <= 120; h++) {
    weather.push({
      time: new Date(now + h * H).toISOString(),
      windDir: h < 50 ? 225 : 160,
      windSpeed: 18,
      rainProb: h > 60 ? 70 : 20,
      rain: h > 60 ? 2 : 0,
    });
  }
  const st = (id: string, name: string, state: string, lat: number, lon: number, api: number, pm25: number, d: number): Station => ({
    id, name, state, country: "MY", lat, lon, api, pm25, time: new Date(now).toISOString(), distanceKm: d,
  });
  return {
    cams,
    nea: {
      time: new Date(now).toISOString(),
      psi24: { north: 126, south: 159, east: 173, west: 197, central: 183 },
      pm25_24h: { north: 80, south: 111, east: 124, west: 148, central: 134 },
      pm10_24h: { north: 99, south: 144, east: 171, west: 168, central: 165 },
      sub: {
        pm25: { north: 126, south: 159, east: 173, west: 197, central: 183 },
        pm10: { north: 75, south: 97, east: 111, west: 110, central: 108 },
        o3: { north: 57, south: 25, east: 31, west: 22, central: 36 },
        so2: { north: 4, south: 2, east: 2, west: 2, central: 4 },
        co: { north: 24, south: 29, east: 22, west: 26, central: 24 },
      },
      no2_1h_max: { north: 14, south: 44, east: 33, west: 60, central: 27 },
    },
    history: { regions, island },
    stations: [
      st("CA25J", "Pasir Gudang", "Johor", 1.47, 103.89, 168, 92, 14),
      st("CA27J", "Johor Bahru", "Johor", 1.5, 103.75, 172, 101, 18),
      st("CA31J", "Batu Pahat", "Johor", 1.86, 102.93, 177, 128, 113),
      st("CA32J", "Kluang", "Johor", 2.03, 103.32, 166, 133, 93),
      st("CA29J", "Segamat", "Johor", 2.5, 102.8, 161, 78, 170),
      st("CA35M", "Bandaraya Melaka", "Melaka", 2.21, 102.25, 158, 84, 198),
      { id: "pekanbaru", name: "Pekanbaru", state: "Riau", country: "ID", lat: 0.51, lon: 101.45, api: null, pm25: 210, time: null, distanceKm: 279 },
      { id: "jambi", name: "Jambi", state: "Jambi", country: "ID", lat: -1.61, lon: 103.61, api: null, pm25: 165, time: null, distanceKm: 330 },
      { id: "palembang", name: "Palembang", state: "South Sumatra", country: "ID", lat: -2.98, lon: 104.78, api: null, pm25: 240, time: null, distanceKm: 492 },
      { id: "pontianak", name: "Pontianak", state: "West Kalimantan", country: "ID", lat: -0.03, lon: 109.34, api: null, pm25: 60, time: null, distanceKm: 632 },
    ],
    sensors: [
      ["4 Haig Road", 1.3125, 103.8947, 142],
      ["Sengkang West Way", 1.3920, 103.8800, 118],
      ["Fernvale", 1.3910, 103.8770, 125],
      ["Yio Chu Kang Beacon", 1.3820, 103.8450, 131],
      ["Taman Jurong", 1.3400, 103.7230, 156],
    ].map(([name, lat, lon, pm25]) => ({ name: String(name), lat: Number(lat), lon: Number(lon), pm25: Number(pm25), time: new Date(now).toISOString() })),
    fires: {
      available: true,
      days: 2,
      sumatra: 1243,
      borneo: 318,
      peninsula: 12,
      daily: [820, 1010, 1190, 1065, 1243].map((sumatra, i) => ({
        date: new Date(now - (4 - i) * 86400_000).toISOString().slice(0, 10),
        sumatra,
        borneo: [190, 230, 215, 290, 318][i],
      })),
      points: Array.from({ length: 300 }, (_, i) => {
        const sum = i < 230;
        return {
          lat: sum ? -3.2 + Math.sin(i * 1.7) * 2.2 : -1.5 + Math.sin(i) * 1.6,
          lon: sum ? 103.2 + Math.cos(i * 2.3) * 2.0 : 112 + Math.cos(i * 1.3) * 2.5,
          frp: 5 + ((i * 37) % 60),
          time: new Date(now).toISOString(),
          confidence: "n",
        };
      }),
    },
    weather,
    news: mockNews(),
    psiDaily: [112, 124, 98, 135, 150, 168, 190].map((max, i): DayPsi => ({ date: sgDate(i - 6), max, region: i % 2 ? "west" : "central" })),
    errors: [],
  };
}

const haze = (d: number, text: string): NewsItem => {
  const date = sgDate(-d);
  const long = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Singapore", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T12:00:00+08:00`));
  return {
    source: "NEA",
    title: `Haze Situation Update (${long})`,
    summary: text,
    date,
    url: `https://www.nea.gov.sg/media/news/advisories/index/haze-situation-update-${long.toLowerCase().replace(/ /g, "-")}`,
  };
};

function mockNews(): NewsItem[] {
  return [
    haze(0, "The 24-hr PSI forecast for tomorrow is Unhealthy to Low Very Unhealthy. Please check the latest 1-hr PM2.5 concentration readings and personal guide when deciding on carrying out activities in the next few hours."),
    haze(1, "Dry conditions were observed over Singapore today. As at 4pm, the 1-hr PM2.5 concentration readings were 139 – 251 µg/m3, and the 24-hr PSI was 118 – 168, in the Unhealthy range."),
    haze(3, "Showers fell over parts of Singapore today. As at 7pm, the 1-hr PM2.5 concentration readings were 93 – 135 µg/m3, and the 24-hr PSI was 118 – 155, in the Unhealthy range."),
    {
      source: "NEA",
      title: "Singapore Ready To Step Up Haze Response",
      summary: "Over the past week, the haze situation has deteriorated due to an increase in hotspots in southern and central Sumatra, and unfavourable wind conditions.",
      date: sgDate(-5),
      url: "https://www.nea.gov.sg/media/news/news/index/singapore-ready-to-step-up-haze-response",
    },
    {
      source: "CNA",
      title: "Singapore haze: Air quality unhealthy in central region as hotspots rise in Sumatra",
      summary: "The 24-hour PSI in central Singapore was in the unhealthy range on Thursday.",
      date: new Date(Date.now() - 3 * 36e5).toISOString(),
      url: "https://www.channelnewsasia.com/singapore/haze-psi-unhealthy-central-region",
    },
    {
      source: "ST",
      title: "N95 masks to be distributed at community clubs as haze persists",
      summary: "Residents can collect masks from vending machines at selected community clubs.",
      date: new Date(Date.now() - 20 * 36e5).toISOString(),
      url: "https://www.straitstimes.com/singapore/n95-masks-community-clubs-haze",
    },
    {
      source: "MSS",
      title: "Weather outlook",
      summary: "Cloudy. For tomorrow, thundery showers mainly over northern, western and central Singapore in the afternoon.",
      date: new Date().toISOString(),
      url: "https://www.weather.gov.sg/weather-forecast-24hrs/",
    },
  ];
}

/** Synthetic regional smoke: plumes over Sumatra and Borneo drifting north-east. */
export function mockGrid(): SmokeGrid {
  const lats = Array.from({ length: 14 }, (_, i) => -6 + i);
  const lons = Array.from({ length: 26 }, (_, i) => 95 + i);
  const t0 = Date.parse(hourKey(new Date()));
  const times = Array.from({ length: 25 }, (_, k) => new Date(t0 + k * 3 * 3600_000).toISOString());
  const values = times.map((_, k) =>
    lats.flatMap((la) =>
      lons.map((lo) => {
        const drift = k * 0.08;
        const sum = 160 * Math.exp(-(((la + 1.5 - drift) / 2.2) ** 2 + ((lo - 103 - drift) / 2.4) ** 2));
        const bor = 90 * Math.exp(-(((la + 1.5) / 2) ** 2 + ((lo - 112.5) / 2.5) ** 2));
        return Math.round((sum + bor) * (k > 12 ? 0.7 : 1) + 8);
      }),
    ),
  );
  // A steady south-westerly (towards the north-east) with a gentle swirl, in m/s.
  const wind = (f: (la: number, lo: number) => number) => times.map(() => lats.flatMap((la) => lons.map((lo) => Math.round(f(la, lo) * 10) / 10)));
  return { lats, lons, times, values, wind: { u: wind((la) => 4 + 2 * Math.sin(la / 3)), v: wind((la, lo) => 3 + 2 * Math.cos(lo / 4)) } };
}
