"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  GROUP_LABEL,
  LEVEL_COLOR,
  LEVEL_TEXT,
  LEVEL_NAME,
  NEA_ADVICE,
  REGIONS,
  TONE_COLOR,
  pm25Band,
  pm25ToLevel,
  psiLevel,
  verdict,
  type Group,
  type Region,
} from "@/lib/bands";
import { ago, fmtDay, fmtHour, fmtTime } from "@/lib/format";
import type { HazeData } from "@/lib/types";
import { SG } from "@/lib/util";
import Chart from "./Chart";
import Why from "./Why";

const HazeMap = dynamic(() => import("./HazeMap"), {
  ssr: false,
  loading: () => <div className="h-72 animate-pulse rounded-2xl bg-line" />,
});

const REGION_CENTRE: Record<Region, [number, number]> = {
  north: [1.418, 103.82],
  south: [1.296, 103.82],
  east: [1.352, 103.94],
  west: [1.352, 103.7],
  central: [1.357, 103.82],
};

function load<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key) as T | null;
    return v && allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {}
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export default function Dashboard({ data }: { data: HazeData }) {
  const [region, setRegion] = useState<Region>("central");
  const [group, setGroup] = useState<Group>("healthy");
  const [locating, setLocating] = useState(false);
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    setRegion(load("region", REGIONS, "central"));
    setGroup(load("group", ["healthy", "sensitive", "chronic"] as const, "healthy"));
  }, []);

  const pickRegion = (r: Region) => {
    setRegion(r);
    save("region", r);
  };
  const pickGroup = (g: Group) => {
    setGroup(g);
    save("group", g);
  };

  const locate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        if (Math.abs(coords.latitude - SG.lat) > 0.3 || Math.abs(coords.longitude - SG.lon) > 0.4) return;
        let best: Region = "central";
        let d = Infinity;
        for (const r of REGIONS) {
          const [la, lo] = REGION_CENTRE[r];
          const dd = (la - coords.latitude) ** 2 + (lo - coords.longitude) ** 2;
          if (dd < d) {
            d = dd;
            best = r;
          }
        }
        pickRegion(best);
      },
      () => setLocating(false),
      { timeout: 8000, maximumAge: 600_000 },
    );
  };

  const regionSeries = data.history?.regions[region] ?? [];
  const latest = regionSeries[regionSeries.length - 1];
  const pmNow = latest?.value;
  const psi = data.nea?.psi24[region];
  const nowLevel = pmNow != null ? pm25ToLevel(pmNow) : psi != null && !isNaN(psi) ? psiLevel(psi) : null;
  const v = nowLevel != null ? verdict(nowLevel, group) : null;
  const advice = nowLevel != null ? NEA_ADVICE[group][nowLevel] : null;

  // Best hour to be outside in the next 12 hours, if the air varies meaningfully.
  const best = useMemo(() => {
    const next = data.forecast.hourly.slice(0, 12).filter((p) => {
      const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Singapore", hour: "numeric" }).format(new Date(p.time)));
      return h >= 6 && h <= 22;
    });
    if (next.length < 3) return null;
    const min = next.reduce((a, b) => (b.pm25 < a.pm25 ? b : a));
    const max = Math.max(...next.map((p) => p.pm25));
    return max - min.pm25 >= 15 ? min : null;
  }, [data.forecast.hourly]);

  const bg = v ? TONE_COLOR[v.tone] : "#6b7280";

  return (
    <main className="mx-auto max-w-lg px-4 pb-16 pt-4">
      {data.mock && (
        <div className="mb-3 rounded-xl bg-amber-100 px-3 py-2 text-sm text-amber-900">Demo data, not real readings.</div>
      )}

      <header className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-tight">
          Haze<span className="text-muted">SG</span>
        </h1>
        <span className="text-xs text-muted">
          {latest ? `NEA reading ${fmtTime(latest.time)}` : data.nea ? `NEA ${fmtTime(data.nea.time)}` : "Updating"}
        </span>
      </header>

      {/* Region picker */}
      <div className="mb-3 flex gap-1.5">
        <button
          onClick={locate}
          aria-label="Use my location"
          className="shrink-0 rounded-full border border-line bg-card px-2.5 py-1.5 text-sm"
        >
          {locating ? "…" : "📍"}
        </button>
        {REGIONS.map((r) => (
          <button
            key={r}
            onClick={() => pickRegion(r)}
            className={`min-w-0 flex-1 rounded-full px-1 py-1.5 text-[13px] font-medium transition ${
              r === region ? "bg-fg text-bg" : "border border-line bg-card"
            }`}
          >
            {cap(r)}
          </button>
        ))}
      </div>

      {/* Verdict */}
      <section className="rounded-3xl p-5 text-white shadow-lg" style={{ background: bg }}>
        <p className="text-sm font-medium opacity-90">Should I go out now?</p>
        <p className="mt-1 text-3xl font-extrabold leading-tight">
          {v ? (
            <>
              <span aria-hidden className="mr-2">
                {v.emoji}
              </span>
              {v.headline}
            </>
          ) : (
            "Data unavailable"
          )}
        </p>
        {advice && <p className="mt-2 text-sm opacity-95">NEA advice: {advice.toLowerCase()}.</p>}

        <div className="mt-4 grid grid-cols-3 gap-1 rounded-2xl bg-black/15 p-1" role="tablist" aria-label="Who is going out">
          {(Object.keys(GROUP_LABEL) as Group[]).map((g) => (
            <button
              key={g}
              role="tab"
              aria-selected={g === group}
              onClick={() => pickGroup(g)}
              className={`rounded-xl px-1 py-2 text-xs font-semibold leading-tight ${g === group ? "bg-white text-black" : "text-white/90"}`}
            >
              {g === "healthy" ? "Healthy adult" : g === "sensitive" ? "Kids, elderly, pregnant" : "Heart / lung condition"}
            </button>
          ))}
        </div>
        {best && (
          <p className="mt-3 text-sm">
            Cleanest air in the next 12 h: <b>around {fmtHour(best.time)}</b> (PM2.5 about {best.pm25}).
          </p>
        )}
      </section>

      {/* Now numbers */}
      <section className="mt-3 grid grid-cols-2 gap-3">
        <Stat
          label="PM2.5 now (1 h)"
          value={pmNow != null ? Math.round(pmNow) : null}
          unit="µg/m³"
          tag={pmNow != null ? `${pm25Band(pmNow).name}` : ""}
          color={pmNow != null ? LEVEL_TEXT[pm25ToLevel(pmNow)] : undefined}
          hint="Use for what to do right now"
        />
        <Stat
          label="PSI (24 h)"
          value={psi != null && !isNaN(psi) ? psi : null}
          tag={psi != null && !isNaN(psi) ? LEVEL_NAME[psiLevel(psi)] : ""}
          color={psi != null && !isNaN(psi) ? LEVEL_TEXT[psiLevel(psi)] : undefined}
          hint="Use for planning your day"
        />
      </section>

      {/* Chart */}
      <section className="mt-3 rounded-3xl bg-card p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-semibold">Next 48 hours</h2>
          <span className="text-xs text-muted">PM2.5 µg/m³, island-wide</span>
        </div>
        {data.history ? (
          <Chart observed={data.history.island} forecast={data.forecast.hourly.slice(0, 48)} />
        ) : (
          <p className="text-sm text-muted">Readings unavailable right now.</p>
        )}
      </section>

      {/* 5-day */}
      {data.forecast.days.length > 0 && (
        <section className="mt-3 rounded-3xl bg-card p-4">
          <h2 className="mb-3 font-semibold">5-day outlook</h2>
          <div className="grid grid-cols-5 gap-2 text-center">
            {data.forecast.days.map((d, i) => {
              const lv = psiLevel(d.psiMax);
              const vv = verdict(lv, group);
              return (
                <div key={d.date} className="flex flex-col items-center gap-1">
                  <span className="text-xs font-medium text-muted">{fmtDay(d.date, i)}</span>
                  <span className="grid h-11 w-11 place-items-center rounded-full text-lg" style={{ background: LEVEL_COLOR[lv] }}>
                    <span aria-hidden>{vv.emoji}</span>
                  </span>
                  <span className="tabular text-sm font-bold">{d.psiMax}</span>
                  <span className="text-[10px] leading-tight text-muted">{LEVEL_NAME[lv]}</span>
                  {d.rainProb != null && d.rainProb >= 40 && <span className="text-[10px] text-sky-500">🌧 {d.rainProb}%</span>}
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted">Peak 24-hr PSI expected each day. Icons show advice for: {GROUP_LABEL[group].toLowerCase()}.</p>
        </section>
      )}

      {/* Regions */}
      {data.nea && (
        <section className="mt-3 rounded-3xl bg-card p-4">
          <h2 className="mb-3 font-semibold">Across Singapore</h2>
          <div className="grid grid-cols-5 gap-2 text-center">
            {REGIONS.map((r) => {
              const p = data.nea!.psi24[r];
              const pm = data.history?.regions[r].at(-1)?.value;
              const lv = isNaN(p) ? null : psiLevel(p);
              return (
                <button key={r} onClick={() => pickRegion(r)} className={`rounded-2xl p-2 ${r === region ? "ring-2 ring-fg" : ""}`}>
                  <div className="text-[11px] text-muted">{cap(r)}</div>
                  <div className="tabular text-lg font-bold" style={{ color: lv != null ? LEVEL_TEXT[lv] : undefined }}>
                    {isNaN(p) ? "–" : p}
                  </div>
                  <div className="tabular text-[10px] text-muted">{pm != null ? `${Math.round(pm)} µg` : ""}</div>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted">24-hr PSI (big) and 1-hr PM2.5 (small).</p>
        </section>
      )}

      <Why data={data} />

      {/* Neighbours */}
      {data.stations.length > 0 && (
        <section className="mt-3 rounded-3xl bg-card p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-semibold">Neighbours</h2>
            <button onClick={() => setShowMap((s) => !s)} className="text-sm font-medium text-sky-600">
              {showMap ? "Hide map" : "Show map"}
            </button>
          </div>
          {showMap && (
            <div className="mb-3">
              <HazeMap data={data} />
            </div>
          )}
          <ul className="divide-y divide-line">
            {data.stations
              .filter((s) => s.country === "ID" || s.distanceKm < 260)
              .slice(0, 14)
              .map((s) => {
                const val = s.api ?? s.pm25;
                const lv = s.api != null ? psiLevel(s.api) : s.pm25 != null ? pm25ToLevel(s.pm25) : null;
                return (
                  <li key={s.id} className="flex items-center justify-between py-2">
                    <div>
                      <div className="text-sm font-medium">
                        {s.country === "MY" ? "🇲🇾" : "🇮🇩"} {s.name}
                      </div>
                      <div className="text-xs text-muted">
                        {s.state} · {s.distanceKm} km
                        {s.country === "ID" ? " · model estimate" : ""}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="tabular text-lg font-bold" style={{ color: lv != null ? LEVEL_TEXT[lv] : undefined }}>
                        {val ?? "–"}
                      </div>
                      <div className="text-[10px] text-muted">{s.api != null ? "API" : "PM2.5 µg/m³"}</div>
                    </div>
                  </li>
                );
              })}
          </ul>
          <p className="mt-2 text-xs text-muted">
            Malaysia&apos;s API uses the same bands as Singapore&apos;s PSI. Indonesian cities have no open live feed, so these are
            Copernicus model estimates.
          </p>
        </section>
      )}

      <footer className="mt-6 space-y-2 text-center text-xs text-muted">
        <p suppressHydrationWarning>
          Data: NEA (data.gov.sg), Malaysia DOE APIMS, NASA FIRMS, Copernicus CAMS and ECMWF via Open-Meteo. Built{" "}
          {ago(data.generatedAt)}.
        </p>
        <p>
          Not an official service. For official advisories see{" "}
          <a className="underline" href="https://www.haze.gov.sg" target="_blank" rel="noreferrer">
            haze.gov.sg
          </a>
          .
        </p>
        <p>
          <Link className="font-medium text-sky-600" href="/about">
            How this works, sources and forecast method
          </Link>
        </p>
        {data.errors.length > 0 && <p className="text-amber-600">Some sources are unavailable: {data.errors.map((e) => e.split(":")[0]).join(", ")}.</p>}
      </footer>
    </main>
  );
}

function Stat({
  label,
  value,
  unit,
  tag,
  color,
  hint,
}: {
  label: string;
  value: number | null;
  unit?: string;
  tag: string;
  color?: string;
  hint: string;
}) {
  return (
    <div className="rounded-3xl bg-card p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="tabular text-3xl font-extrabold" style={{ color }}>
          {value ?? "–"}
        </span>
        {unit && <span className="text-xs text-muted">{unit}</span>}
      </div>
      <div className="text-sm font-semibold" style={{ color }}>
        {tag}
      </div>
      <div className="mt-1 text-[11px] text-muted">{hint}</div>
    </div>
  );
}
