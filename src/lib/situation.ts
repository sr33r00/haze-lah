import { REGIONS, pm25Band, pm25ToLevel, psiLevel, type Level, type Region } from "./bands";
import { cap, fmtHour } from "./format";
import type { DayPsi, HazeData, HourPoint, NewsItem } from "./types";
import { sgDate } from "./util";

export type TimelineItem = {
  source: NewsItem["source"] | "NEA readings" | "NASA FIRMS";
  title: string;
  summary: string;
  /** ms since epoch; official items with only a date count as 12:00 SGT. */
  time: number;
  hasHour: boolean;
  url?: string;
};

const NOON_SGT = (date: string) => Date.parse(`${date}T12:00:00+08:00`);

/** Each time the highest 1-hr PM2.5 band across regions changes (last 48 h). */
export function pm25Events(history: HazeData["history"]): TimelineItem[] {
  if (!history) return [];
  const peak = new Map<string, { value: number; region: Region }>();
  for (const r of REGIONS)
    for (const p of history.regions[r]) {
      const cur = peak.get(p.time);
      if (!cur || p.value > cur.value) peak.set(p.time, { value: p.value, region: r });
    }
  const hours = [...peak].sort(([a], [b]) => Date.parse(a) - Date.parse(b)).filter(([t]) => Date.parse(t) > Date.now() - 48 * 3600_000);
  const out: TimelineItem[] = [];
  let band = hours.length ? pm25Band(hours[0][1].value) : null;
  // A new band counts once it holds for two hours, so readings hovering at an edge do not flood the timeline.
  for (let i = 1; i + 1 < hours.length; i++) {
    const [t, { value, region }] = hours[i];
    const was = band!;
    const now = pm25Band(value);
    if (now.index === was.index || pm25Band(hours[i + 1][1].value).index !== now.index) continue;
    band = now;
    out.push({
      source: "NEA readings",
      title: `PM2.5 ${now.index > was.index ? "rose to" : "eased to"} ${now.name} (band ${now.band})`,
      summary: `Highest reading ${Math.round(value)} µg/m³, ${cap(region)}, at ${fmtHour(t)}.`,
      time: Date.parse(t),
      hasHour: true,
    });
  }
  return out;
}

const MIN_FIRES = 20; // ignore swings on tiny counts

/** The biggest day-on-day hotspot change (25% or more) between the last two full days. */
export function fireEvent(fires: HazeData["fires"]): TimelineItem[] {
  const d = fires.daily;
  if (!fires.available || d.length < 3) return [];
  const [prev, day] = [d[d.length - 3], d[d.length - 2]]; // the last day is partial
  const changes = (["sumatra", "borneo"] as const)
    .filter((k) => prev[k] >= MIN_FIRES)
    .map((k) => ({ k, pct: Math.round(((day[k] - prev[k]) / prev[k]) * 100), n: day[k], was: prev[k] }))
    .filter((c) => Math.abs(c.pct) >= 25)
    .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
  const c = changes[0];
  if (!c) return [];
  return [
    {
      source: "NASA FIRMS",
      title: `Hotspots in ${cap(c.k)} ${c.pct > 0 ? "up" : "down"} ${Math.abs(c.pct)}% on the day before`,
      summary: `${c.n.toLocaleString()} detected on ${day.date}, against ${c.was.toLocaleString()} the day before.`,
      time: NOON_SGT(day.date),
      hasHour: false,
    },
  ];
}

/** Official news plus events derived from the readings and fires, newest first. */
export function buildTimeline(data: HazeData): TimelineItem[] {
  const official = data.news.map((n): TimelineItem => {
    const hasHour = n.date.includes("T");
    return { ...n, time: hasHour ? Date.parse(n.date) : NOON_SGT(n.date), hasHour };
  });
  return [...official, ...pm25Events(data.history), ...fireEvent(data.fires)].sort((a, b) => b.time - a.time).slice(0, 30);
}

/** Consecutive days up to today with a peak 24-hr PSI above 100 (NEA: Unhealthy starts at 101). */
export function unhealthyStreak(days: DayPsi[]): number {
  let n = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].date !== sgDate(-n) || psiLevel(days[i].max) < 2) break;
    n++;
  }
  return n;
}

/** Time of the newest timeline item that has already happened, or null. */
export const newestTime = (data: HazeData): number | null => buildTimeline(data).find((i) => i.time <= Date.now())?.time ?? null;

/** Latest 1-hr PM2.5 reading, 24-hr PSI and advisory level for a region. NEA: 1-hr PM2.5 guides immediate activities; fall back to 24-hr PSI. */
export function currentReading(data: Pick<HazeData, "history" | "nea">, region: Region): { latest: HourPoint | null; psi: number | null; level: Level | null } {
  const latest = data.history?.regions[region].at(-1) ?? null;
  const rawPsi = data.nea?.psi24[region];
  const psi = rawPsi != null && !isNaN(rawPsi) ? rawPsi : null;
  const level = latest ? pm25ToLevel(latest.value) : psi != null ? psiLevel(psi) : null;
  return { latest, psi, level };
}

/** Island-wide headline numbers from NEA: 24-hr PSI range, and the region with the highest 1-hr PM2.5. Null when NEA is unavailable. */
export function islandSummary(data: Pick<HazeData, "history" | "nea">) {
  const values = data.nea ? Object.values(data.nea.psi24).filter((v) => !isNaN(v)) : [];
  if (!values.length) return null;
  const psi = { min: Math.min(...values), max: Math.max(...values) };
  let peak: { region: Region; value: number } | null = null;
  for (const r of REGIONS) {
    const v = data.history?.regions[r].at(-1)?.value;
    if (v != null && !isNaN(v) && (!peak || v > peak.value)) peak = { region: r, value: v };
  }
  return { psi, level: psiLevel(psi.max), peak };
}
