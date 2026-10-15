import { REGIONS, type Region } from "../bands";
import type { HourPoint, NeaNow, NeaPm25History, RegionValues } from "../types";
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

export async function fetchNeaNow(): Promise<NeaNow> {
  const j = await getJson<Resp>(`${BASE}/psi`, { headers: headers() });
  const item = j.data.items[0];
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
