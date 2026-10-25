import { scoreArchive, type ArchiveRecord } from "../accuracy";
import { getHazeData } from "../data";
import { listKeys, readText, writeJson, writeText } from "../dataStore";
import type { SavedForecast } from "../types";

/** What the archive step did: `archived` is false when the forecast of this NEA hour was already saved. */
export type ArchiveResult = { archived: boolean; issued: string; hours: number; scored: number | null };

/** The records of a month file (`archive/YYYY-MM.jsonl`, one JSON record per line). */
const parseRecords = (text: string): ArchiveRecord[] => text.split("\n").filter(Boolean).map((l) => JSON.parse(l));

/** Scores every archived forecast against NEA and saves `accuracy.json`; returns how many forecasts it scored. */
async function score(): Promise<number> {
  const keys = (await listKeys("archive/")).filter((k) => k.endsWith(".jsonl")).sort();
  const records = (await Promise.all(keys.map(async (k) => parseRecords((await readText(k)) ?? "")))).flat();
  await writeJson("accuracy.json", scoreArchive(records));
  return records.length;
}

/**
 * Archives the forecast at issue time so it can be scored against NEA later: appends a record to `archive/YYYY-MM.jsonl`, saves a
 * live forecast as `forecast-latest.json`, then scores the archive. The job may run twice an hour: a month file whose last
 * record has the same `issued` (the newest NEA reading) is left alone. Throws when there are no NEA observations.
 */
export async function archiveForecast(): Promise<ArchiveResult> {
  const d = await getHazeData();
  const obs = d.history?.island ?? [];
  if (!obs.length) throw new Error(`No NEA observations: ${d.errors.join("; ")}`);
  const issued = obs[obs.length - 1].time;
  const key = `archive/${issued.slice(0, 7)}.jsonl`;
  const existing = (await readText(key)) ?? "";
  const last = existing.trimEnd().split("\n").at(-1);
  if (last && (JSON.parse(last) as ArchiveRecord).issued === issued) {
    return { archived: false, issued, hours: 0, scored: null };
  }

  const t0 = Date.parse(issued);
  // A saved forecast is old: archiving it would be scored as if it were issued now.
  const live = d.forecast.available && !d.forecast.savedFrom;
  const rec: ArchiveRecord = {
    issued,
    retrieved: d.generatedAt,
    obs: obs.slice(-24).map((p) => [p.time, Math.round(p.value * 10) / 10]),
    fc: (live ? d.forecast.hourly : [])
      .map((p) => [Math.round((Date.parse(p.time) - t0) / 3600_000), p.pm25, p.raw] as [number, number, number])
      .filter(([lead]) => lead >= 1 && lead <= 96),
    bias: live ? d.forecast.biasFactor : null,
    fires: d.fires.available ? { sumatra: d.fires.sumatra, borneo: d.fires.borneo } : null,
    errors: d.errors,
  };
  await writeText(key, `${existing}${JSON.stringify(rec)}\n`);
  if (live) {
    const saved: SavedForecast = { issued: d.generatedAt, hourly: d.forecast.hourly, biasFactor: d.forecast.biasFactor, sigma: d.forecast.sigma };
    await writeJson("forecast-latest.json", saved);
  }
  return { archived: true, issued, hours: rec.fc.length, scored: await score() };
}
