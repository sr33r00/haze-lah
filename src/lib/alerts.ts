import { LEVEL_NAME, REGIONS, pm25Band, psiLevel } from "./bands";
import { bestSlots } from "./exercise";
import { cap, fmtHour, fmtWeekday, trend3h } from "./format";
import { islandMax, islandSummary } from "./situation";
import type { HazeData, NewsItem } from "./types";
import { sgDate, sgHour } from "./util";

/** Persisted between runs. Fields added later are undefined in old files: record them without sending. */
export type AlertState = {
  psiLevel: number | null;
  pm25Band?: number | null;
  neaUrl: string | null;
  newsUrls?: string[]; // CNA/ST stories already seen, newest first
  briefDate?: string | null;
  outlookDate?: string | null;
  hourTime?: string | null; // NEA reading time of the last hourly update
};

export const BRIEF_HOUR = 7;
export const OUTLOOK_HOUR = 19;
/** Posts from 11pm to 7am go out without a notification sound. */
export const quietHours = (now = new Date()) => sgHour(now) >= 23 || sgHour(now) < 7;
const MAX_LINES = 6;

/** Hour of day (0-23) in Singapore. */

export const latestNea = (news: NewsItem[]) => news.find((n) => n.source === "NEA");

const NEWS_SEEN = 30;
const OUTLET_NAME = { CNA: "CNA", ST: "Straits Times" } as const;

const isOutlet = (n: NewsItem): n is NewsItem & { source: "CNA" | "ST" } => n.source === "CNA" || n.source === "ST";

const firstSentence = (s: string) => s.split(/(?<=[.!?])\s/)[0].trim();

/** "6am-9am" as "6-9am" when both ends share am/pm. */
function fmtWindow(start: string, end: string) {
  const [a, b] = [fmtHour(start), fmtHour(end)];
  return `${a.slice(-2) === b.slice(-2) ? a.slice(0, -2) : a}–${b}`;
}

/** Best time out for sensitive groups (the Plan your day rule), for one SGT date or the first slot; `tone` colours the card. */
export function bestWindowFor(data: HazeData, date?: string, now = new Date()) {
  const slots = bestSlots(data.forecast.hourly, "out", "sensitive", now.getTime());
  const s = date ? slots.find((x) => sgDate(0, new Date(x.start)) === date) : slots[0];
  return s && { start: s.start, end: s.end, text: fmtWindow(s.start, s.end), tone: s.rating.tone };
}

/** Direction of the 3-hour change of an hourly series. */
export function trendDir(series: { value: number }[] | undefined): "up" | "down" | "steady" | null {
  const t = trend3h(series);
  return !t ? null : t === "Steady" ? "steady" : t.startsWith("Up") ? "up" : "down";
}

const TREND_WORD = { up: "rising", down: "falling", steady: "steady" } as const;

/** Highest 1-hr PM2.5 band index per hour across regions, oldest first. */
function islandMaxSeries(history: HazeData["history"]) {
  const peak = new Map<string, number>();
  for (const r of REGIONS)
    for (const p of history?.regions[r] ?? []) if (Number.isFinite(p.value)) peak.set(p.time, Math.max(peak.get(p.time) ?? -Infinity, p.value));
  return [...peak].sort(([a], [b]) => Date.parse(a) - Date.parse(b)).map(([, v]) => v);
}

/** PM2.5 band index once the last two hourly island-max readings agree; otherwise the last known one. */
export function confirmedPm25Band(history: HazeData["history"], known: number | null | undefined): number | null {
  const s = islandMaxSeries(history);
  if (!s.length) return known ?? null;
  const [a, b] = [pm25Band(s.at(-2) ?? s[s.length - 1]).index, pm25Band(s.at(-1)!).index];
  return a === b ? b : (known ?? b);
}

/** pm25 holds the band index it moved from. */
export type Triggers = { psi: boolean; pm25: number | null; nea: NewsItem | null; news: NewsItem | null; brief: boolean; outlook: boolean; hourly: boolean };

/** Messages to send: the triggers that fired and the next state. Null when NEA is unavailable (state kept). */
export function detect(data: HazeData, prev: AlertState | null, now = new Date()): { fired: Triggers; next: AlertState } | null {
  const top = data.nea && islandMax(data.nea.psi24);
  if (!top) return null;
  const today = sgDate(0, now);
  const tomorrow = data.forecast.days.find((d) => d.date === sgDate(1, now));
  const todayOutlook = data.forecast.days.find((d) => d.date === today);
  const level = psiLevel(top.psi);
  const nea = latestNea(data.news);
  const outlets = data.news.filter(isOutlet).sort((a, b) => b.date.localeCompare(a.date));
  const unseen = prev?.newsUrls ? outlets.filter((n) => !prev.newsUrls!.includes(n.url)) : [];
  const band = confirmedPm25Band(data.history, prev?.pm25Band);
  const hour = sgHour(now);
  const briefDue = hour >= BRIEF_HOUR && prev?.briefDate !== today;
  const outlookDue = hour >= OUTLOOK_HOUR && prev?.outlookDate !== today;
  const next: AlertState = {
    psiLevel: level,
    pm25Band: band,
    neaUrl: nea?.url ?? prev?.neaUrl ?? null,
    newsUrls: [...new Set([...outlets.map((n) => n.url), ...(prev?.newsUrls ?? [])])].slice(0, NEWS_SEEN),
    briefDate: briefDue ? today : (prev?.briefDate ?? null),
    outlookDate: outlookDue ? today : (prev?.outlookDate ?? null),
    hourTime: data.nea!.time,
  };
  // A missing field means it is new: record it, send nothing for it.
  const fired: Triggers = {
    psi: prev?.psiLevel != null && prev.psiLevel !== level,
    pm25: prev?.pm25Band != null && band != null && prev.pm25Band !== band ? prev.pm25Band : null,
    nea: prev && nea && prev.neaUrl != null && nea.url !== prev.neaUrl ? nea : null,
    news: unseen[0] ?? null,
    brief: briefDue && prev?.briefDate !== undefined && (top.psi > 100 || (todayOutlook?.psiMax ?? 0) > 100),
    outlook: outlookDue && prev?.outlookDate !== undefined && (tomorrow?.psiMax ?? 0) > 100,
    // One update per new NEA hourly reading.
    hourly: prev != null && data.nea!.time !== prev.hourTime,
  };
  return { fired, next };
}

/** Short caption (a few lines) for the triggers that fired. */
export function caption(data: HazeData, fired: Triggers, site: string, now = new Date()): string {
  const top = islandMax(data.nea!.psi24)!;
  const level = psiLevel(top.psi);
  const where = cap(top.region);
  const summary = islandSummary(data);
  const peak = summary?.peak;
  const tomorrow = data.forecast.days.find((d) => d.date === sgDate(1, now));
  const trend = peak && trendDir(data.history?.regions[peak.region]);
  const win = bestWindowFor(data, fired.outlook && !fired.psi && fired.pm25 == null && !fired.brief ? sgDate(1, now) : undefined, now);

  const lines: string[] = [];
  if (fired.brief) lines.push(`Morning brief · ${fmtWeekday(sgDate(0, now), "long")}`);
  const only = fired.hourly && !fired.psi && fired.pm25 == null && !fired.nea && !fired.news && !fired.brief && !fired.outlook;
  if (only) lines.push(`Hourly update · ${fmtHour(data.nea!.time)}`);
  if (fired.nea) lines.push(`NEA: ${fired.nea.title}`, firstSentence(fired.nea.summary));
  if (fired.news) lines.push(`${OUTLET_NAME[fired.news.source as "CNA" | "ST"]}: ${fired.news.title}`, fired.news.url);
  if (fired.pm25 != null && peak) {
    const b = pm25Band(peak.value);
    lines.push(`PM2.5 ${b.index > fired.pm25! ? "rose to" : "eased to"} ${b.name} (band ${b.band}) · ${Math.round(peak.value)} ${cap(peak.region)}`);
  }
  lines.push(`PSI ${fired.psi ? "now " : ""}${LEVEL_NAME[level]} · ${top.psi} ${where}`);
  if (fired.pm25 == null && peak) lines.push(`PM2.5 now ${Math.round(peak.value)}${trend ? ` · ${TREND_WORD[trend]}` : ""}`);
  if (fired.outlook && tomorrow) lines.push(`Tomorrow: PSI ~${tomorrow.psiMax}, ${LEVEL_NAME[psiLevel(tomorrow.psiMax)]}`);
  else if (tomorrow && tomorrow.psiMax > 100) lines.push(`Tomorrow: PSI ~${tomorrow.psiMax}`);
  if (win) lines.push(`Best time out: ${win.text}${sgDate(0, new Date(win.start)) === sgDate(0, now) ? "" : " tomorrow"}`);
  return [...lines.slice(0, MAX_LINES - 1), site].join("\n");
}
