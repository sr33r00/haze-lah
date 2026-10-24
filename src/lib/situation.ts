import { REGIONS, pm25Band, pm25ToLevel, psiLevel, type Level, type Region } from "./bands";
import { cap, fmtHour } from "./format";
import type { HazeData, HourPoint, NewsItem } from "./types";
import { shiftDate } from "./util";

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
function pm25Events(history: HazeData["history"]): TimelineItem[] {
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
function fireEvent(fires: HazeData["fires"]): TimelineItem[] {
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

/** A run of unhealthy days: how many, and the SGT date it began. */
export type Streak = { days: number; since: string };

const SPELL_BREAK = 3; // this many days in a row with a peak 24-hr PSI of 100 or below end a haze spell

/**
 * The haze spell ending today, from a date to peak 24-hr PSI map: back from today to the first day above 100 (NEA:
 * Unhealthy starts at 101) before `SPELL_BREAK` or more days in a row at 100 or below. `days` counts every day from
 * `since` to today. Today with no reading yet counts from yesterday. `missing` is the day the walk stopped at for lack
 * of a reading (null when it ended on clear days or `maxDays`), so a caller can fill it in and walk again. Pure.
 */
export function hazeSpell(psi: ReadonlyMap<string, number>, today: string, maxDays = 120): { spell: Streak | null; missing: string | null } {
  const end = psi.has(today) ? today : shiftDate(today, -1);
  let since: string | null = null;
  let clear = 0;
  let missing: string | null = null;
  for (let n = 0, date = end; n < maxDays; n++, date = shiftDate(date, -1)) {
    const max = psi.get(date);
    if (max == null) {
      missing = date;
      break;
    }
    if (psiLevel(max) >= 2) {
      since = date;
      clear = 0;
    } else if (++clear >= SPELL_BREAK) break;
  }
  const days = since ? Math.round((Date.parse(today) - Date.parse(since)) / 86400_000) + 1 : 0;
  return { spell: since ? { days, since } : null, missing };
}

/** Time of the newest timeline item that has already happened, or null. */
export const newestTime = (data: HazeData): number | null => buildTimeline(data).find((i) => i.time <= Date.now())?.time ?? null;

/**
 * Latest 1-hr PM2.5 reading, 24-hr PSI and an overall severity level for a region (the worse of the PM2.5 band's
 * matching PSI row and the PSI itself), used to pick tips. The advice itself comes from adviceStep in bands.ts.
 */
export function currentReading(data: Pick<HazeData, "history" | "nea">, region: Region): { latest: HourPoint | null; psi: number | null; level: Level | null } {
  const latest = data.history?.regions[region].at(-1) ?? null;
  const rawPsi = data.nea?.psi24[region];
  const psi = rawPsi != null && !isNaN(rawPsi) ? rawPsi : null;
  const levels = [latest && pm25ToLevel(latest.value), psi != null && psiLevel(psi)].filter((l): l is Level => typeof l === "number");
  const level = levels.length ? (Math.max(...levels) as Level) : null;
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

/** Highest 24-hr PSI across regions, and where; null when no region has a reading. */
export function islandMax(psi24: Record<Region, number>): { psi: number; region: Region } | null {
  const valid = REGIONS.filter((r) => Number.isFinite(psi24[r]));
  if (!valid.length) return null;
  const region = valid.reduce((a, b) => (psi24[b] > psi24[a] ? b : a));
  return { psi: psi24[region], region };
}
