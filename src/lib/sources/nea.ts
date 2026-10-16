import { REGIONS, type Region } from "../bands";
import type { DayPsi, HourPoint, NeaNow, NeaPm25History, RegionValues } from "../types";
import { getJson, num, sgDate } from "../util";

// NEA data via data.gov.sg (Singapore Open Data Licence).
const BASE = "https://api-open.data.gov.sg/v2/real-time/api";

type Item = { timestamp: string; readings: Record<string, Record<string, number>> };
type Resp = { code: number; data: { items: Item[] } };

function headers(): HeadersInit {
  const key = process.env.DATA_GOV_SG_API_KEY;
  return key ? { "x-api-key": key } : {};
}

function regionValues(r: Record<string, number> | undefined): RegionValues {
  const out = {} as RegionValues;
  for (const k of REGIONS) out[k] = num(r?.[k]) ?? NaN;
  return out;
}

/**
 * Latest PSI reading. The undated endpoint has been seen serving a reading hours old from cache, so
 * today's dated feed (also used by fetchPsiDaily) is read too and the newest item wins.
 */
export async function fetchNeaNow(): Promise<NeaNow> {
  const resps = await Promise.allSettled([
    getJson<Resp>(`${BASE}/psi`, { headers: headers() }),
    getJson<Resp>(`${BASE}/psi?date=${sgDate(0)}`, { headers: headers() }),
  ]);
  const item = resps
    .flatMap((r) => (r.status === "fulfilled" ? r.value.data.items : []))
    .reduce<Item | undefined>((a, b) => (!a || Date.parse(b.timestamp) > Date.parse(a.timestamp) ? b : a), undefined);
  if (!item) throw new Error("NEA PSI: no items");
  return {
    time: item.timestamp,
    psi24: regionValues(item.readings.psi_twenty_four_hourly),
    pm25_24h: regionValues(item.readings.pm25_twenty_four_hourly),
    pm10_24h: regionValues(item.readings.pm10_twenty_four_hourly),
    sub: {
      pm25: regionValues(item.readings.pm25_sub_index),
      pm10: regionValues(item.readings.pm10_sub_index),
      o3: regionValues(item.readings.o3_sub_index),
      so2: regionValues(item.readings.so2_sub_index),
      co: regionValues(item.readings.co_sub_index),
    },
    no2_1h_max: regionValues(item.readings.no2_one_hour_max),
  };
}

/** 1-hour PM2.5 for yesterday and today (SGT), oldest first. */
export async function fetchNeaPm25History(): Promise<NeaPm25History> {
  const days = [sgDate(-1), sgDate(0)];
  const resps = await Promise.all(
    days.map((d) => getJson<Resp>(`${BASE}/pm25?date=${d}`, { headers: headers() }).catch(() => null)),
  );
  const items = resps
    .flatMap((r) => r?.data.items ?? [])
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const seen = new Set<string>();
  const regions = Object.fromEntries(REGIONS.map((r) => [r, [] as HourPoint[]])) as Record<Region, HourPoint[]>;
  const island: HourPoint[] = [];
  for (const it of items) {
    if (seen.has(it.timestamp)) continue;
    seen.add(it.timestamp);
    const r = it.readings.pm25_one_hourly;
    const vals: number[] = [];
    for (const k of REGIONS) {
      const v = num(r?.[k]);
      if (v != null) {
        regions[k].push({ time: it.timestamp, value: v });
        vals.push(v);
      }
    }
    if (vals.length) island.push({ time: it.timestamp, value: vals.reduce((a, b) => a + b, 0) / vals.length });
  }
  if (!island.length) throw new Error("NEA PM2.5: no readings");
  return { regions, island };
}

/**
 * Highest 24-hr PSI of each of the last `days` SGT days. Fetched one at a time: data.gov.sg allows
 * 6 anonymous calls per 10 s. Past days never change, so they are cached for a day.
 */
export async function fetchPsiDaily(days = 7): Promise<DayPsi[]> {
  const out: DayPsi[] = [];
  for (let k = 1 - days; k <= 0; k++) {
    const date = sgDate(k);
    try {
      const j = await getJson<Resp>(`${BASE}/psi?date=${date}`, { headers: headers(), revalidate: k < 0 ? 86400 : 300 });
      let best: DayPsi | null = null;
      for (const it of j.data.items)
        for (const r of REGIONS) {
          const v = num(it.readings.psi_twenty_four_hourly?.[r]);
          if (v != null && (!best || v > best.max)) best = { date, max: v, region: r };
        }
      if (best) out.push(best);
    } catch (e) {
      console.error(`[haze] PSI ${date}:`, e);
    }
  }
  if (!out.length) throw new Error("NEA PSI history: no days");
  return out;
}
