/** The NEA fields this Worker reads; a pure module (no Cloudflare imports) so it can be unit-tested. */
export interface NeaItem {
  timestamp: string;
  readings: { pm25_one_hourly: Record<string, number> };
}

const REGIONS = ["north", "south", "east", "west", "central"] as const;

/** Today's date in Singapore (UTC+8, no DST) as `YYYY-MM-DD`, the `date` NEA's dated feed expects. */
export function sgtDate(now: Date): string {
  return new Date(now.getTime() + 8 * 3600_000).toISOString().slice(0, 10);
}

/**
 * Identifies the newest reading by its timestamp and 1-hour PM2.5 values, e.g. `"2026-10-25T00:00:00+08:00 63,62,63,92,76"`,
 * or null when there are none. A re-stamp with identical values keeps the same signature; a revised value changes it.
 */
export function signature(items: readonly NeaItem[]): string | null {
  const newest = items.reduce<NeaItem | null>((a, it) => (!a || Date.parse(it.timestamp) > Date.parse(a.timestamp) ? it : a), null);
  if (!newest) return null;
  return `${newest.timestamp} ${REGIONS.map((r) => newest.readings.pm25_one_hourly[r]).join(",")}`;
}
