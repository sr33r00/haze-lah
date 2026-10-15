// Forecast verification: our corrected forecast vs raw CAMS vs persistence ("same as now"),
// matched on issue time and lead time against NEA island-mean 1-hr PM2.5.

export type ArchiveRecord = {
  issued: string; // time of the last NEA observation used
  retrieved: string;
  obs: [string, number][]; // last 24 h of NEA island-mean 1-hr PM2.5
  fc: [number, number, number][]; // [lead h, ours, raw CAMS]
  bias: number | null;
  fires: { sumatra: number; borneo: number } | null;
  errors: string[];
};

export const LEADS = [6, 24, 48, 72, 96] as const;
export const EVENT_THRESHOLD = 55; // µg/m³, top of NEA 1-hr PM2.5 Band I (Normal)

type Stats = { n: number; mae: number | null; rmse: number | null; bias: number | null };
type Event = { n: number; precision: number | null; recall: number | null; f1: number | null };
export type LeadScore = { lead: number; ours: Stats; cams: Stats; persistence: Stats; event: Event };
/** Night-before call: will tomorrow's peak 1-hr PM2.5 go above the threshold? */
export type HazyDays = { days: number; hazy: number; ours: { hits: number; clearRight: number }; persistence: { hits: number; clearRight: number } };
export type Accuracy = { updated: string; forecasts: number; from: string | null; to: string | null; leads: LeadScore[]; hazyDays: HazyDays };

function stats(errs: number[]): Stats {
  const n = errs.length;
  if (!n) return { n, mae: null, rmse: null, bias: null };
  const r = (x: number) => Math.round(x * 10) / 10;
  return {
    n,
    mae: r(errs.reduce((a, e) => a + Math.abs(e), 0) / n),
    rmse: r(Math.sqrt(errs.reduce((a, e) => a + e * e, 0) / n)),
    bias: r(errs.reduce((a, e) => a + e, 0) / n), // forecast minus observed
  };
}

function event(pairs: [boolean, boolean][]): Event {
  const tp = pairs.filter(([p, o]) => p && o).length;
  const fp = pairs.filter(([p, o]) => p && !o).length;
  const fn = pairs.filter(([p, o]) => !p && o).length;
  const precision = tp + fp ? tp / (tp + fp) : null;
  const recall = tp + fn ? tp / (tp + fn) : null;
  const f1 = precision != null && recall != null && precision + recall ? (2 * precision * recall) / (precision + recall) : null;
  const r = (x: number | null) => (x == null ? null : Math.round(x * 100) / 100);
  return { n: pairs.length, precision: r(precision), recall: r(recall), f1: r(f1) };
}

export function scoreArchive(records: ArchiveRecord[]): Accuracy {
  const observed = new Map<number, number>();
  for (const r of records) for (const [t, v] of r.obs) observed.set(Date.parse(t), v);

  const leads = LEADS.map((lead) => {
    const e = { ours: [] as number[], cams: [] as number[], persistence: [] as number[] };
    const ev: [boolean, boolean][] = [];
    for (const r of records) {
      const t0 = Date.parse(r.issued);
      const now = observed.get(t0);
      const f = r.fc.find(([l]) => l === lead);
      const o = observed.get(t0 + lead * 3600_000);
      if (!f || o == null || now == null) continue;
      e.ours.push(f[1] - o);
      e.cams.push(f[2] - o);
      e.persistence.push(now - o);
      ev.push([f[1] > EVENT_THRESHOLD, o > EVENT_THRESHOLD]);
    }
    return { lead, ours: stats(e.ours), cams: stats(e.cams), persistence: stats(e.persistence), event: event(ev) };
  });
  const issued = records.map((r) => r.issued).sort();
  return {
    updated: new Date().toISOString(),
    forecasts: records.length,
    from: issued[0] ?? null,
    to: issued.at(-1) ?? null,
    leads,
    hazyDays: scoreHazyDays(records, observed),
  };
}

const SGT = 8 * 3600_000;
const sgDay = (t: number) => new Date(t + SGT).toISOString().slice(0, 10);
const sgHour = (t: number) => new Date(t + SGT).getUTCHours();

/** Score the forecast issued closest to 11pm SGT each night against the next day's observed peak. */
export function scoreHazyDays(records: ArchiveRecord[], observed: Map<number, number>): HazyDays {
  const nightly = new Map<string, ArchiveRecord>();
  for (const r of records) {
    const t = Date.parse(r.issued);
    if (sgHour(t) < 21) continue;
    const prev = nightly.get(sgDay(t));
    if (!prev || Math.abs(sgHour(t) - 23) < Math.abs(sgHour(Date.parse(prev.issued)) - 23)) nightly.set(sgDay(t), r);
  }
  const out: HazyDays = { days: 0, hazy: 0, ours: { hits: 0, clearRight: 0 }, persistence: { hits: 0, clearRight: 0 } };
  for (const r of nightly.values()) {
    const t0 = Date.parse(r.issued);
    const target = sgDay(t0 + 24 * 3600_000);
    const inTarget = (lead: number) => sgDay(t0 + lead * 3600_000) === target;
    const fcPeak = Math.max(...r.fc.filter(([l]) => inTarget(l)).map(([, v]) => v));
    const obsDay = [...observed].filter(([t]) => sgDay(t) === target).map(([, v]) => v);
    const now = observed.get(t0);
    if (obsDay.length < 18 || !isFinite(fcPeak) || now == null) continue;
    const hazy = Math.max(...obsDay) > EVENT_THRESHOLD;
    const call = (predHazy: boolean, s: { hits: number; clearRight: number }) => {
      if (hazy && predHazy) s.hits++;
      if (!hazy && !predHazy) s.clearRight++;
    };
    out.days++;
    if (hazy) out.hazy++;
    call(fcPeak > EVENT_THRESHOLD, out.ours);
    call(now > EVENT_THRESHOLD, out.persistence);
  }
  return out;
}

const ACCURACY_URL =
  process.env.ACCURACY_URL || "https://raw.githubusercontent.com/sr33r00/haze-sg/main/data/accuracy.json";

/** Published scores, or null until the archive has enough matched forecasts. */
export async function fetchAccuracy(minN = 20): Promise<Accuracy | null> {
  try {
    const res = await fetch(ACCURACY_URL, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const a = (await res.json()) as Accuracy;
    return a.leads.some((l) => l.ours.n >= minN) ? a : null;
  } catch {
    return null;
  }
}
