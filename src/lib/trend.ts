import { LEVEL_NAME, psiLevel } from "./bands";
import { fmtWeekday } from "./format";
import type { DayOutlook } from "./types";

export type Trend = { tone: "better" | "worse" | "same" | "clear"; text: string; rain: string | null };

const RAIN = 70; // % chance worth a mention

const dayName = (d: DayOutlook, k: number) => (k === 1 ? "tomorrow" : fmtWeekday(d.date, "long"));

/**
 * One plain answer to "is it getting better?", from the expected peak 24-hr PSI of the coming days against the PSI
 * now. NEA's bands decide what counts as a change: above 100 is Unhealthy.
 */
export function hazeTrend(days: DayOutlook[], psiNow: number | null): Trend | null {
  if (psiNow == null || days.length < 2) return null;
  const now = psiLevel(psiNow);
  const ahead = days.slice(1).map((d, i) => ({ d, k: i + 1, lv: psiLevel(d.psiMax) }));
  const name = ({ d, k }: (typeof ahead)[number]) => dayName(d, k);

  let trend: Omit<Trend, "rain">;
  let until = ahead.length; // days the rain note may come from
  if (now >= 2) {
    const clear = ahead.find((a) => a.lv <= 1);
    const lower = ahead.find((a) => a.lv < now);
    const worse = ahead.find((a) => a.lv > now);
    if (clear) {
      // A clear day followed by haze again is a break, not the end of it; say so.
      const back = ahead.find((a) => a.k > clear.k && a.lv >= 2);
      const level = LEVEL_NAME[clear.lv].toLowerCase();
      trend = back
        ? { tone: "better", text: `A break ${name(clear) === "tomorrow" ? "" : "on "}${name(clear)} (${level}), but haze likely returns ${name(back)}.` }
        : { tone: "better", text: `Likely to ease to ${level} by ${name(clear)}.` };
      until = clear.k;
    } else if (worse && (!lower || worse.k < lower.k)) {
      trend = { tone: "worse", text: `Likely to get worse ${name(worse) === "tomorrow" ? "" : "on "}${name(worse)}, PSI up to ${worse.d.psiMax}.` };
    } else if (lower) {
      trend = { tone: "better", text: `Some relief by ${name(lower)}, but still unhealthy all week.` };
      until = lower.k;
    } else {
      trend = { tone: "same", text: "No relief expected in the next few days." };
    }
  } else {
    const bad = ahead.find((a) => a.lv >= 2);
    trend = bad
      ? { tone: "worse", text: `Haze likely to return ${name(bad) === "tomorrow" ? "" : "on "}${name(bad)}, PSI up to ${bad.d.psiMax}.` }
      : { tone: "clear", text: "Expected to stay clear for the next few days." };
    if (bad) until = bad.k;
  }
  const wet = ahead.find((a) => a.k <= until && (a.d.rainProb ?? 0) >= RAIN);
  const rain = wet ? `Showers likely ${wet.k === 1 ? "tomorrow" : `on ${name(wet)}`}.` : null;
  return { ...trend, rain };
}
