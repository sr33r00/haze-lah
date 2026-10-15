import { CloudRain, Factory, Flame, Navigation, TrendingUp } from "lucide-react";
import { LEVEL_TEXT, psiLevel } from "@/lib/bands";
import { compass, windOrigin } from "@/lib/format";
import type { HazeData } from "@/lib/types";
import { median } from "@/lib/util";

type Row = { icon: React.ReactNode; title: string; status: string; color: string; detail: string };

const HIGH = "var(--lv3)";
const MID = "var(--lv2)";
const LOW = "var(--lv0)";
const NA = "var(--muted)";

/** The physical drivers of haze over Singapore, each summarised as a status. */
export default function Drivers({ data }: { data: HazeData }) {
  const rows: Row[] = [fires(data), wind(data), rain(data), model(data), neighbours(data)];
  return (
    <ul className="mx-4 divide-y divide-line rounded-3xl bg-surface px-4">
      {rows.map((r) => (
        <li key={r.title} className="flex gap-3 py-3.5">
          <span className="mt-0.5 text-muted" aria-hidden>
            {r.icon}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[15px] font-bold">{r.title}</span>
              <span className="text-[15px] font-bold" style={{ color: r.color }}>
                {r.status}
              </span>
            </div>
            <p className="mt-0.5 text-[13px] leading-snug text-muted">{r.detail}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function fires({ fires: f }: HazeData): Row {
  const icon = <Flame size={20} />;
  if (!f.available) return { icon, title: "Fires upwind", status: "No data", color: NA, detail: "NASA satellite fire data is not connected yet." };
  const n = f.sumatra + f.borneo;
  const [status, color] = n > 500 ? ["Many", HIGH] : n > 100 ? ["Some", MID] : ["Few", LOW];
  return {
    icon,
    title: "Fires upwind",
    status,
    color,
    detail: `${f.sumatra.toLocaleString()} in Sumatra and ${f.borneo.toLocaleString()} in Borneo seen by satellite in the last ${f.days * 24} hours.`,
  };
}

function wind({ weather, fires: f }: HazeData): Row {
  const icon = <Navigation size={20} />;
  const now = Date.now() - 3600_000;
  const next = weather.filter((w) => Date.parse(w.time) >= now && !isNaN(w.windDir)).slice(0, 48);
  if (!next.length) return { icon, title: "Wind toward us", status: "No data", color: NA, detail: "Wind forecast unavailable." };
  const burning = (side: "sumatra" | "borneo" | null) => side != null && (!f.available || f[side] > 50);
  const share = next.filter((w) => burning(windOrigin(w.windDir).smoky)).length / next.length;
  const [status, color] = share > 0.6 ? ["Mostly", HIGH] : share > 0.25 ? ["Partly", MID] : ["Rarely", LOW];
  const w0 = next[0];
  return {
    // The icon points where the wind is heading (it is drawn pointing north-east at rest).
    icon: <Navigation size={20} style={{ transform: `rotate(${w0.windDir + 180 - 45}deg)` }} />,
    title: "Wind toward us",
    status,
    color,
    detail: `Blowing from ${windOrigin(w0.windDir).place} (${compass(w0.windDir)}, ${Math.round(w0.windSpeed)} km/h at 1.5 km). From fire areas ${Math.round(share * 100)}% of the next ${next.length} hours.`,
  };
}

function rain({ weather }: HazeData): Row {
  const icon = <CloudRain size={20} />;
  const now = Date.now() - 3600_000;
  const p = Math.max(0, ...weather.filter((w) => Date.parse(w.time) >= now).slice(0, 24).map((w) => w.rainProb ?? 0));
  const [status, color] = p >= 60 ? ["Likely", LOW] : p >= 30 ? ["Possible", MID] : ["Unlikely", HIGH];
  return { icon, title: "Rain to clear it", status, color, detail: `${p}% chance of rain in the next 24 hours. Heavy showers wash smoke out of the air.` };
}

function model({ forecast }: HazeData): Row {
  const icon = <TrendingUp size={20} />;
  const h = forecast.hourly;
  if (h.length < 24) return { icon, title: "Smoke trend", status: "No data", color: NA, detail: "Forecast unavailable." };
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const first = avg(h.slice(0, 6).map((p) => p.pm25));
  const later = avg(h.slice(18, 24).map((p) => p.pm25));
  const change = (later - first) / Math.max(first, 1);
  const [status, color] = change > 0.15 ? ["Rising", HIGH] : change < -0.15 ? ["Easing", LOW] : ["Steady", MID];
  return {
    icon,
    title: "Smoke trend",
    status,
    color,
    detail: `Forecast moves from about ${Math.round(first)} now to about ${Math.round(later)} µg/m³ by this time tomorrow.`,
  };
}

function neighbours({ stations }: HazeData): Row {
  const icon = <Factory size={20} />;
  const johor = stations.filter((s) => s.country === "MY" && s.api != null && s.distanceKm < 150);
  if (!johor.length) return { icon, title: "Johor stations", status: "No data", color: NA, detail: "Malaysian readings unavailable." };
  const m = Math.round(median(johor.map((s) => s.api!)));
  const lv = psiLevel(m);
  return {
    icon,
    title: "Johor stations",
    status: `API ${m}`,
    color: LEVEL_TEXT[lv],
    detail: `Middle reading of ${johor.length} Malaysian stations within 150 km. Their air often reaches us within hours.`,
  };
}
