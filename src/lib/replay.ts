import type { Fire, Replay, ReplayDay } from "./types";
import { SG, sgDate } from "./util";
import { backTrail, type WindFrame } from "./wind";

const DAYS = 5; // FIRMS keeps 5 days, so the replay goes back that far
const ARRIVAL_SGT = 14; // trace the air that reached Singapore at 2pm each day
const WINDOW_H = 72; // how far back the trail goes, and which fires count as "passed"
const NEAR_KM = 50;
const MAP_FIRES = 400;

// Rough province and state centres; a fire belongs to the nearest. Good enough to name where most fires were.
const AREAS: [string, number, number][] = [
  ["Aceh", 4.2, 96.8],
  ["North Sumatra", 2.2, 99.1],
  ["Riau", 0.3, 101.7],
  ["West Sumatra", -0.8, 100.6],
  ["Jambi", -1.6, 103.0],
  ["Bengkulu", -3.6, 102.3],
  ["South Sumatra", -3.3, 104.3],
  ["Lampung", -4.8, 105.1],
  ["Bangka-Belitung", -2.5, 106.4],
  ["West Kalimantan", 0.0, 110.5],
  ["Central Kalimantan", -1.6, 113.4],
  ["South Kalimantan", -3.0, 115.3],
  ["East Kalimantan", 0.5, 116.5],
  ["North Kalimantan", 3.0, 116.3],
  ["Sarawak", 2.5, 113.0],
  ["Sabah", 5.3, 117.0],
  ["Peninsular Malaysia", 3.8, 102.0],
];

const COMPASS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];

/** Equirectangular distance in km; fine at these scales near the equator. */
function km(a: [number, number], lat: number, lon: number) {
  const x = (lon - a[1]) * Math.cos((lat * Math.PI) / 180);
  return Math.hypot(lat - a[0], x) * 111.32;
}

function areaOf(lat: number, lon: number) {
  return AREAS.reduce((best, a) => (km([a[1], a[2]], lat, lon) < km([best[1], best[2]], lat, lon) ? a : best))[0];
}

/** Compass point the air came from, or null if it barely moved. */
function fromDirection(trail: [number, number][]) {
  const [lat, lon] = trail.at(-1)!;
  if (km([SG.lat, SG.lon], lat, lon) < 150) return null;
  const deg = (Math.atan2(lon - SG.lon, lat - SG.lat) * 180) / Math.PI;
  return COMPASS[Math.round(((deg + 360) % 360) / 45) % 8];
}

/** Fires the trail passed within NEAR_KM while the air was on its way, and the area with most of them. */
function firesPassed(trail: [number, number][], arrival: number, fires: Fire[]) {
  const from = arrival - WINDOW_H * 3600_000;
  const box = trail.reduce((b, [la, lo]) => [Math.min(b[0], la), Math.max(b[1], la), Math.min(b[2], lo), Math.max(b[3], lo)], [90, -90, 180, -180]);
  const pad = NEAR_KM / 100;
  const counts = new Map<string, number>();
  let near = 0;
  for (const f of fires) {
    const t = Date.parse(f.time);
    if (t < from || t > arrival) continue;
    if (f.lat < box[0] - pad || f.lat > box[1] + pad || f.lon < box[2] - pad || f.lon > box[3] + pad) continue;
    if (!trail.some((p) => km(p, f.lat, f.lon) < NEAR_KM)) continue;
    near++;
    const a = areaOf(f.lat, f.lon);
    counts.set(a, (counts.get(a) ?? 0) + 1);
  }
  const area = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return { near, area };
}

/** Wind of the frame nearest `t`, rounded for the page. */
function windNear(frames: WindFrame[], t: number) {
  const f = frames.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a));
  const r = (xs: number[]) => xs.map((x) => Math.round(x * 10) / 10);
  return { u: r(f.u.data), v: r(f.v.data) };
}

/** The past few days: each day's fires and where the air reaching Singapore came from. */
export function buildReplay(frames: WindFrame[], fires: (Fire & { where: string })[], now = Date.now()): Replay {
  const latest = frames.filter((f) => f.t <= now).at(-1)?.t ?? now;
  const days: ReplayDay[] = [];
  for (let k = DAYS - 1; k >= 0; k--) {
    const date = sgDate(-k, new Date(now));
    const arrival = Math.min(Date.parse(`${date}T${String(ARRIVAL_SGT).padStart(2, "0")}:00:00+08:00`), latest);
    const trail = backTrail(frames, SG.lat, SG.lon, arrival, WINDOW_H);
    const today = fires.filter((f) => sgDate(0, new Date(f.time)) === date);
    days.push({
      date,
      arrival: new Date(arrival).toISOString(),
      trail,
      from: fromDirection(trail),
      ...firesPassed(trail, arrival, fires),
      fires: today
        .sort((a, b) => b.frp - a.frp)
        .slice(0, MAP_FIRES)
        .map((f) => [Math.round(f.lat * 100) / 100, Math.round(f.lon * 100) / 100]),
      total: today.filter((f) => f.where !== "peninsula").length,
      wind: windNear(frames, arrival),
    });
  }
  const { lats, lons } = frames[0].u;
  return { lats, lons, days };
}
