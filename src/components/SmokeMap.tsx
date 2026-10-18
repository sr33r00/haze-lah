"use client";

import "leaflet/dist/leaflet.css";
import { Pause, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CircleMarker, ImageOverlay, MapContainer, Polyline, TileLayer, Tooltip } from "react-leaflet";
import { LEVEL_COLOR, LEVEL_NAME, LEVEL_TEXT, REGIONS, REGION_POINT, pm25Color, psiLevel, stationLevel } from "@/lib/bands";
import { fmtDay, fmtHour } from "@/lib/format";
import { islandMax } from "@/lib/situation";
import type { DayPsi, FireSummary, NeaNow, Replay, ReplayDay, Sensor, SmokeGrid, Station } from "@/lib/types";
import { sgDate } from "@/lib/util";
import InfoNote from "./InfoNote";
import WindLayer from "./WindLayer";

const FIRE = "#c2410c";
const TRAIL = "#a855f7";

function frameLabel(t: string) {
  const day = sgDate(0, new Date(t));
  const offset = [0, 1, 2, 3, 4].find((k) => sgDate(k) === day) ?? 0;
  return `${fmtDay(day, offset)} ${fmtHour(t)}`;
}

const pastLabel = (date: string) =>
  new Intl.DateTimeFormat("en-SG", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00+08:00`));

/** One line on where the day's air came from. */
function trailCaption(d: ReplayDay) {
  if (!d.from) return "Light winds: the air stayed around Singapore.";
  const via = d.area && d.near > 0 ? ` via ${d.area}, past ${d.near.toLocaleString("en-SG")} fires` : "";
  return `Air came from the ${d.from}${via}.`;
}

/** Past days of fires and air trails, then the regional smoke forecast (CAMS, calibrated to NEA), on one time slider. */
export default function SmokeMap(props: {
  fires: FireSummary;
  stations: Station[];
  sensors: Sensor[];
  psi24: NeaNow["psi24"] | null;
  psiDaily: DayPsi[];
  biasFactor: number | null;
}) {
  const { fires, stations, sensors, psi24 } = props;
  const [grid, setGrid] = useState<SmokeGrid | null>(null);
  const [replay, setReplay] = useState<Replay | null>(null);
  const [failed, setFailed] = useState(false);
  const [frame, setFrame] = useState<number | null>(null); // null until loaded: then "now"
  const [playing, setPlaying] = useState(false);
  const scale = props.biasFactor ?? 1;

  useEffect(() => {
    const get = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : Promise.reject()));
    get("/api/smoke")
      .then(setGrid)
      .catch(() => setFailed(true));
    get("/api/replay")
      .then(setReplay)
      .catch(() => {});
  }, []);

  // Past days come first; the last replay day is today and shares the "now" frame with the forecast.
  const past = replay?.days.slice(0, -1) ?? [];
  const today = replay?.days.at(-1) ?? null;
  const nowIdx = past.length;
  const total = nowIdx + (grid?.times.length ?? 1);
  const f = frame ?? nowIdx;
  const day = f < nowIdx ? past[f] : f === nowIdx ? today : null;
  const ahead = f - nowIdx; // forecast step, 3 h each

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setFrame((k) => ((k ?? nowIdx) + 1) % total), 700);
    return () => clearInterval(id);
  }, [playing, total, nowIdx]);

  // One pixel per grid cell; the browser's smoothing turns the 1° grid into a soft smoke field.
  const image = useMemo(() => (grid && ahead >= 0 ? renderFrame(grid, ahead, scale) : null), [grid, ahead, scale]);
  const wind = day && replay ? { lats: replay.lats, lons: replay.lons, ...day.wind } : grid?.wind && ahead >= 0 ? { lats: grid.lats, lons: grid.lons, u: grid.wind.u[ahead], v: grid.wind.v[ahead] } : null;
  const live = ahead === 0;
  const psi = f < nowIdx ? props.psiDaily.find((p) => p.date === day?.date)?.max : psi24 ? islandMax(psi24)?.psi : undefined;

  return (
    <div className="lg:contents">
      <div className="relative isolate h-[420px] overflow-hidden lg:col-start-1 lg:row-span-3 lg:h-[max(560px,calc(100vh-15rem))] lg:rounded-3xl">
        <MapContainer
          center={[1.0, 106]}
          zoom={5}
          minZoom={4}
          maxZoom={9}
          scrollWheelZoom={false}
          preferCanvas
          style={{ height: "100%", width: "100%" }}
          attributionControl
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
          {image && <ImageOverlay url={image.url} bounds={image.bounds} opacity={0.75} />}
          {wind && <WindLayer {...wind} />}
          {day && day.trail.length > 1 && (
            <>
              <Polyline positions={day.trail} pathOptions={{ color: TRAIL, weight: 18, opacity: 0.3, lineCap: "round" }} />
              <Polyline positions={day.trail} pathOptions={{ color: TRAIL, weight: 2.5, opacity: 0.95 }} />
            </>
          )}
          {f < nowIdx &&
            day?.fires.map((p, i) => <CircleMarker key={i} center={p} radius={2.5} pathOptions={{ color: FIRE, weight: 0, fillOpacity: 0.85 }} />)}
          {live &&
            fires.points.map((p, i) => (
              <CircleMarker key={i} center={[p.lat, p.lon]} radius={2.5} pathOptions={{ color: FIRE, weight: 0, fillOpacity: 0.85 }} />
            ))}
          {live &&
            stations.map((s) => {
              const lv = stationLevel(s);
              return (
                <CircleMarker
                  key={s.id}
                  center={[s.lat, s.lon]}
                  radius={6}
                  pathOptions={{ color: "#fff", weight: 1.5, fillColor: lv != null ? LEVEL_COLOR[lv] : "#9ca3af", fillOpacity: 1 }}
                >
                  <Tooltip>
                    {s.name}: {s.api != null ? `API ${s.api}` : `PM2.5 ${s.pm25 ?? "–"} (model)`}
                  </Tooltip>
                </CircleMarker>
              );
            })}
          {live &&
            sensors.map((s, i) => (
              <CircleMarker
                key={i}
                center={[s.lat, s.lon]}
                radius={4}
                pathOptions={{ color: pm25Color(s.pm25), weight: 2, fillColor: "#fff", fillOpacity: 0.9 }}
              >
                <Tooltip>
                  {s.name}: PM2.5 about {s.pm25} µg/m³ (community sensor)
                </Tooltip>
              </CircleMarker>
            ))}
          {live &&
            psi24 &&
            REGIONS.map((r) => {
              const p = psi24![r];
              return (
                <CircleMarker
                  key={r}
                  center={REGION_POINT[r]}
                  radius={5}
                  pathOptions={{ color: "#13232e", weight: 1.5, fillColor: isNaN(p) ? "#9ca3af" : LEVEL_COLOR[psiLevel(p)], fillOpacity: 1 }}
                >
                  <Tooltip>
                    Singapore {r}: PSI {p}
                  </Tooltip>
                </CircleMarker>
              );
            })}
        </MapContainer>
        {day && (
          <div aria-live="polite" className="pointer-events-none absolute inset-x-3 bottom-3 z-[500] rounded-2xl bg-surface/90 px-3 py-2 text-[13px] leading-snug shadow">
            {psi != null && (
              <p className="font-bold">
                {f < nowIdx ? "Highest PSI" : "PSI now"} {psi}, <span style={{ color: LEVEL_TEXT[psiLevel(psi)] }}>{LEVEL_NAME[psiLevel(psi)]}</span>
              </p>
            )}
            <p className="text-muted">{trailCaption(day)}</p>
          </div>
        )}
        {!grid && (
          <div role="status" className="pointer-events-none absolute inset-x-0 top-3 z-[500] mx-auto w-fit rounded-full bg-surface px-3 py-1 text-[13px] text-muted shadow">
            {failed ? "Smoke forecast unavailable; showing live readings only" : "Loading smoke forecast…"}
          </div>
        )}
      </div>

      <div className="px-4 pt-3 lg:col-start-2 lg:px-0 lg:pt-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPlaying((p) => !p)}
            disabled={!grid && !replay}
            aria-label={playing ? "Pause" : "Play"}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-fg text-bg disabled:opacity-40"
          >
            {playing ? <Pause size={18} aria-hidden /> : <Play size={18} aria-hidden />}
          </button>
          <div className="flex-1">
            <div className="flex justify-between text-[13px]">
              <span className="font-bold">{day && f < nowIdx ? pastLabel(day.date) : grid ? frameLabel(grid.times[ahead]) : "Now"}</span>
              <span className="text-muted">{ahead < 0 ? `${-ahead} ${ahead === -1 ? "day" : "days"} ago` : ahead > 0 ? `in ${ahead * 3} h` : "now"}</span>
            </div>
            <input
              type="range"
              className="slider w-full"
              min={0}
              max={total - 1}
              value={f}
              onChange={(e) => {
                setPlaying(false);
                setFrame(Number(e.target.value));
              }}
              aria-label="Time: past days, now and forecast"
              disabled={total < 2}
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-muted">
          {[
            [LEVEL_COLOR[0], "Normal"],
            [LEVEL_COLOR[2], "Elevated"],
            [LEVEL_COLOR[3], "High"],
            [LEVEL_COLOR[4], "Very high"],
          ].map(([c, n]) => (
            <span key={n} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: c, opacity: 0.7 }} />
              {n}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: FIRE }} />
            Fires
          </span>
          {replay && (
            <span className="flex items-center gap-1.5">
              <span className="h-1 w-4 rounded-full" style={{ background: TRAIL }} />
              Air&apos;s path
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border-2 border-white bg-[var(--muted)]" />
            Stations
          </span>
          {sensors.length > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full border-2 border-[var(--muted)] bg-white" />
              Community sensors
            </span>
          )}
          {grid?.wind && (
            <span className="flex items-center gap-1.5">
              <svg width="16" height="8" viewBox="0 0 16 8" aria-hidden>
                <line x1="0" y1="4" x2="16" y2="4" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 2" className="animate-flow" />
              </svg>
              Wind
            </span>
          )}
        </div>
        <div className="mt-2">
          <InfoNote
            lead={
              sensors.length > 0 && (
                <span>
                  Data:{" "}
                  <a href="https://openaq.org" target="_blank" rel="noreferrer" className="underline">
                    OpenAQ
                  </a>{" "}
                  and AirGradient
                </span>
              )
            }
          >
            <p>
              Shading is the Copernicus PM2.5 forecast, scaled by how far it has been off from NEA&apos;s readings recently. Lines show the wind
              at about 1.5 km up. Drag back to see past days: the purple trail is where the air reaching Singapore that afternoon had been over
              the 3 days before, traced back along that wind. It is an estimate, and fires near its path are a likely but not certain source.
            </p>
            {sensors.length > 0 && (
              <p>Community sensors are low-cost and can read high in humid air; NEA&apos;s readings are the official measure.</p>
            )}
          </InfoNote>
        </div>
      </div>
    </div>
  );
}

function renderFrame(grid: SmokeGrid, frame: number, scale: number) {
  const w = grid.lons.length;
  const h = grid.lats.length;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  const vals = grid.values[frame];
  for (let i = 0; i < h; i++) {
    for (let j = 0; j < w; j++) {
      const v = (vals[i * w + j] ?? 0) * scale;
      const hex = pm25Color(v);
      const row = h - 1 - i; // canvas row 0 is the northern edge
      const o = (row * w + j) * 4;
      img.data[o] = parseInt(hex.slice(1, 3), 16);
      img.data[o + 1] = parseInt(hex.slice(3, 5), 16);
      img.data[o + 2] = parseInt(hex.slice(5, 7), 16);
      img.data[o + 3] = Math.round(255 * Math.min(0.85, Math.max(0, (v - 12) / 110)));
    }
  }
  ctx.putImageData(img, 0, 0);
  const half = (grid.lats[1] - grid.lats[0]) / 2;
  return {
    url: canvas.toDataURL(),
    bounds: [
      [grid.lats[0] - half, grid.lons[0] - half],
      [grid.lats[h - 1] + half, grid.lons[w - 1] + half],
    ] as [[number, number], [number, number]],
  };
}
