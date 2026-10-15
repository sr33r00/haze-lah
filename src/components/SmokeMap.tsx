"use client";

import "leaflet/dist/leaflet.css";
import { Pause, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CircleMarker, ImageOverlay, MapContainer, TileLayer, Tooltip } from "react-leaflet";
import { LEVEL_COLOR, REGIONS, REGION_POINT, pm25Color, psiLevel, stationLevel } from "@/lib/bands";
import { fmtDay, fmtHour } from "@/lib/format";
import type { FireSummary, NeaNow, Sensor, SmokeGrid, Station } from "@/lib/types";
import { sgDate } from "@/lib/util";
import InfoNote from "./InfoNote";
import WindLayer from "./WindLayer";

function frameLabel(t: string) {
  const day = sgDate(0, new Date(t));
  const offset = [0, 1, 2, 3, 4].find((k) => sgDate(k) === day) ?? 0;
  return `${fmtDay(day, offset)} ${fmtHour(t)}`;
}

/** Regional smoke forecast (CAMS, calibrated to NEA) with fires, stations and a time slider. */
export default function SmokeMap(props: { fires: FireSummary; stations: Station[]; sensors: Sensor[]; psi24: NeaNow["psi24"] | null; biasFactor: number | null }) {
  const { fires, stations, sensors, psi24 } = props;
  const [grid, setGrid] = useState<SmokeGrid | null>(null);
  const [failed, setFailed] = useState(false);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const scale = props.biasFactor ?? 1;

  useEffect(() => {
    fetch("/api/smoke")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setGrid)
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    if (!playing || !grid) return;
    const id = setInterval(() => setFrame((f) => (f + 1) % grid.times.length), 700);
    return () => clearInterval(id);
  }, [playing, grid]);

  // One pixel per grid cell; the browser's smoothing turns the 1° grid into a soft smoke field.
  const image = useMemo(() => (grid ? renderFrame(grid, frame, scale) : null), [grid, frame, scale]);

  return (
    <div>
      <div className="relative h-[420px] overflow-hidden">
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
          {grid?.wind && <WindLayer grid={grid as Parameters<typeof WindLayer>[0]["grid"]} frame={frame} />}
          {frame === 0 &&
            fires.points.map((f, i) => (
              <CircleMarker key={i} center={[f.lat, f.lon]} radius={2.5} pathOptions={{ color: "#c2410c", weight: 0, fillOpacity: 0.85 }} />
            ))}
          {frame === 0 &&
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
          {frame === 0 &&
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
          {frame === 0 &&
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
        {!grid && (
          <div className="pointer-events-none absolute inset-x-0 top-3 z-[500] mx-auto w-fit rounded-full bg-surface px-3 py-1 text-[13px] text-muted shadow">
            {failed ? "Smoke forecast unavailable; showing live readings only" : "Loading smoke forecast"}
          </div>
        )}
      </div>

      <div className="px-4 pt-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPlaying((p) => !p)}
            disabled={!grid}
            aria-label={playing ? "Pause" : "Play forecast"}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-fg text-bg disabled:opacity-40"
          >
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <div className="flex-1">
            <div className="flex justify-between text-[13px]">
              <span className="font-bold">{grid ? frameLabel(grid.times[frame]) : "Now"}</span>
              <span className="text-muted">{grid && frame > 0 ? `in ${frame * 3} h` : "now"}</span>
            </div>
            <input
              type="range"
              className="slider w-full"
              min={0}
              max={grid ? grid.times.length - 1 : 0}
              value={frame}
              onChange={(e) => {
                setPlaying(false);
                setFrame(Number(e.target.value));
              }}
              aria-label="Forecast time"
              disabled={!grid}
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
            <span className="h-2 w-2 rounded-full bg-[#c2410c]" />
            Fires
          </span>
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
              at about 1.5 km up. Fires and stations show at the current time.
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
