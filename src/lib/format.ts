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

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
export const compass = (deg: number) => COMPASS[Math.round(((deg % 360) / 45)) % 8];

/** Where wind blowing *from* `deg` comes from, seen from Singapore. */
export function windOrigin(deg: number): { place: string; smoky: "sumatra" | "borneo" | null } {
  if (deg >= 190 && deg <= 300) return { place: "Sumatra", smoky: "sumatra" };
  if (deg > 160 && deg < 190) return { place: "Riau Islands and Sumatra", smoky: "sumatra" };
  if (deg >= 90 && deg <= 160) return { place: "Borneo and the South China Sea", smoky: "borneo" };
  return { place: "the north (Malaysia and the sea)", smoky: null };
}
