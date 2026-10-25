import { LEVEL_NAME, psiLevel, type Level } from "./bands";
import type { TimelineItem } from "./situation";
import { sgDate, shiftDate } from "./util";

/** The PSI range NEA expects for one day, as written in its Haze Situation Update. */
export type Outlook = {
  /** SGT date (YYYY-MM-DD) the forecast is for. */
  forDate: string;
  /** Null when NEA gives only words ("Unhealthy to Low Very Unhealthy"). */
  min: number | null;
  max: number | null;
  /** NEA's own wording for the band, e.g. "Moderate to Unhealthy". */
  band: string;
  /** Worst level in the forecast, for colour. */
  level: Level;
};

const MONTHS = "janfebmaraprmayjunjulaugsepoctnovdec";
const LEVEL_WORD = /very unhealthy|unhealthy|moderate|good|hazardous/gi;
const RANGE = /^(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?(?:\s*\(([^)]+)\))?/;
const WORDS = /^((?:(?:good|moderate|unhealthy|very unhealthy|hazardous|low|high|to)\s*)+)\./i;

/** The level named last in a phrase such as "Unhealthy to Low Very Unhealthy", or null. */
function lastLevel(text: string): Level | null {
  const word = text.match(LEVEL_WORD)?.at(-1)?.toLowerCase();
  const i = LEVEL_NAME.findIndex((n) => n.toLowerCase() === word);
  return i < 0 ? null : (i as Level);
}

/**
 * The outlook in the summary of an NEA update posted on the SGT date `postedOn`, or null when it has none. Reads
 * "The PSI forecast for 26 Oct 2026 is 70 – 100 (Moderate).", a single number, and the wordy
 * "The 24-hr PSI forecast for tomorrow is Unhealthy to Low Very Unhealthy.". Pure.
 */
export function parseOutlook(summary: string, postedOn: string): Outlook | null {
  const m = summary.match(/forecast\b([^.]*?)\bis\s+(.*)/i);
  if (!m) return null;
  const [, head, rest] = m;
  const d = head.match(/(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})/);
  const month = d ? MONTHS.indexOf(d[2].toLowerCase()) / 3 : -1;
  const forDate =
    d && Number.isInteger(month) && month >= 0
      ? `${d[3]}-${String(month + 1).padStart(2, "0")}-${d[1].padStart(2, "0")}`
      : /tomorrow/i.test(head)
        ? shiftDate(postedOn, 1)
        : postedOn;

  const r = rest.match(RANGE);
  if (r) {
    const [a, b] = [+r[1], r[2] != null ? +r[2] : +r[1]];
    const [min, max] = [Math.min(a, b), Math.max(a, b)];
    return {
      forDate,
      min,
      max,
      band: r[3]?.trim() || LEVEL_NAME[psiLevel(max)],
      level: psiLevel(max),
    };
  }
  const w = rest.match(WORDS);
  const level = w ? lastLevel(w[1]) : null;
  return w && level != null ? { forDate, min: null, max: null, band: w[1].trim(), level } : null;
}

/** NEA's newest "Haze Situation Update" among the (newest first) timeline items, with its outlook when it parses. */
export function latestNeaUpdate(items: TimelineItem[]): { item: TimelineItem; outlook: Outlook | null } | null {
  const item = items.find((i) => i.source === "NEA" && /haze situation update/i.test(i.title));
  return item
    ? {
        item,
        outlook: parseOutlook(item.summary, sgDate(0, new Date(item.time))),
      }
    : null;
}
