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

export const fmtDay = (date: string, i: number) =>
  i === 0
    ? "Today"
    : i === 1
      ? "Tmrw"
      : new Intl.DateTimeFormat("en-SG", { timeZone: TZ, weekday: "short" }).format(new Date(`${date}T12:00:00+08:00`));

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
