import { sgDate } from "./util";

const TZ = "Asia/Singapore";

export const fmtHour = (t: string | number) =>
  new Intl.DateTimeFormat("en-SG", { timeZone: TZ, hour: "numeric", hour12: true })
    .format(new Date(t))
    .replace(" ", "")
    .toLowerCase();

export const fmtTime = (t: string | number) =>
  new Intl.DateTimeFormat("en-SG", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true })
    .format(new Date(t))
    .replace(" ", "")
    .toLowerCase();

/** Weekday name of an SGT date (YYYY-MM-DD). */
export const fmtWeekday = (date: string, weekday: "short" | "long" = "short") =>
  new Intl.DateTimeFormat("en-SG", { timeZone: TZ, weekday }).format(new Date(`${date}T12:00:00+08:00`));

/** "Thu 11am" for a moment in time, in Singapore. */
export const fmtDayHour = (t: string | number) => `${fmtWeekday(sgDate(0, new Date(t)))} ${fmtHour(t)}`;

/** "Sat, 17 Oct" for an SGT date (YYYY-MM-DD). */
export const fmtDate = (date: string) =>
  new Intl.DateTimeFormat("en-SG", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00+08:00`));

/** "Saturday 17 October, 2pm" for a moment in time, in Singapore: the full wording for a screen reader. */
export const fmtLongWhen = (t: string | number) =>
  `${new Intl.DateTimeFormat("en-SG", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(new Date(t))}, ${fmtHour(t)}`;

/** "17 Oct 2026" for an SGT date (YYYY-MM-DD). */
export const fmtFullDate = (date: string) =>
  new Intl.DateTimeFormat("en-SG", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" }).format(new Date(`${date}T12:00:00+08:00`));

/** "Oct" for an SGT date (YYYY-MM-DD). */
export const fmtMonth = (date: string) => new Intl.DateTimeFormat("en-SG", { timeZone: TZ, month: "short" }).format(new Date(`${date}T12:00:00+08:00`));

/** "Sat 17 Oct" for an SGT date (YYYY-MM-DD): `fmtDate` without the comma. */
export const fmtDateShort = (date: string) => fmtDate(date).replace(",", "");

/** "Fri 23 Oct, 7:40pm" for a moment in time, in Singapore. */
export const fmtDateTime = (t: string | number) => `${fmtDateShort(sgDate(0, new Date(t)))}, ${fmtTime(t)}`;

export const fmtDay = (date: string, i: number) => (i === 0 ? "Today" : i === 1 ? "Tmrw" : fmtWeekday(date));

export function ago(t: string) {
  const m = Math.round((Date.now() - Date.parse(t)) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return `${h} h ago`;
}

/** Change over the last 3 hours of an hourly series, as a short phrase. */
export function trend3h(series: { value: number }[] | undefined): string | null {
  if (!series || series.length < 4) return null;
  const d = Math.round(series[series.length - 1].value - series[series.length - 4].value);
  if (Math.abs(d) < 5) return "Steady";
  return `${d > 0 ? "Up" : "Down"} ${Math.abs(d)} in 3 h`;
}

export const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** "Today", "Yesterday" or "Mon 12 Oct", with the hour when known. */
export function fmtWhen(t: number, withHour: boolean) {
  const day = sgDate(0, new Date(t));
  const label =
    day === sgDate(0)
      ? "Today"
      : day === sgDate(-1)
        ? "Yesterday"
        : new Intl.DateTimeFormat("en-SG", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" }).format(new Date(t)).replace(",", "");
  return withHour ? `${label} ${fmtHour(t)}` : label;
}
