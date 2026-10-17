"use client";

import { useEffect, useMemo, useRef } from "react";
import { useMap } from "react-leaflet";
import { sample, type Field } from "@/lib/wind";

const COUNT = 600;
const MAX_AGE = 80; // frames
const PX_PER_MS = 0.012; // screen speed per m/s of wind
const ARROW_STEP = 2; // degrees between static arrows

type Particle = { lat: number; lon: number; pLat: number; pLon: number; age: number };
type Wind = { u: Field; v: Field };

/** Animated wind particles over the map (u and v in m/s on a lat/lon grid); static arrows under reduced motion. */
export default function WindLayer({ lats, lons, u, v }: { lats: number[]; lons: number[]; u: number[]; v: number[] }) {
  const map = useMap();
  const wind = useMemo<Wind>(() => ({ u: { lats, lons, data: u }, v: { lats, lons, data: v } }), [lats, lons, u, v]);
  const windRef = useRef(wind);
  const redraw = useRef<() => void>(() => {});

  useEffect(() => {
    windRef.current = wind;
    redraw.current();
  }, [wind]);

  useEffect(() => {
    const box = map.getContainer();
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:450";
    box.appendChild(canvas);
    const ctx = canvas.getContext("2d")!;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const dpr = window.devicePixelRatio || 1;
    let ink = "#000";
    let raf = 0;
    let last = 0;
    let n = 0;
    const parts: Particle[] = [];

    const size = () => {
      const s = map.getSize();
      canvas.width = s.x * dpr;
      canvas.height = s.y * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const clear = () => ctx.clearRect(0, 0, canvas.width, canvas.height);
    const readInk = () => (ink = getComputedStyle(document.documentElement).getPropertyValue("--fg").trim() || "#000");

    /** Visible part of the grid, as [south, west, north, east]. */
    const area = () => {
      const b = map.getBounds();
      const { lats, lons } = windRef.current.u;
      return [Math.max(b.getSouth(), lats[0]), Math.max(b.getWest(), lons[0]), Math.min(b.getNorth(), lats.at(-1)!), Math.min(b.getEast(), lons.at(-1)!)];
    };
    const velocity = (lat: number, lon: number) => {
      const u = sample(windRef.current.u, lat, lon);
      const v = sample(windRef.current.v, lat, lon);
      return u == null || v == null ? null : ([u, v] as const);
    };
    const seed = (p: Particle) => {
      const [s, w, nn, e] = area();
      p.lat = s + Math.random() * (nn - s);
      p.lon = w + Math.random() * (e - w);
      p.pLat = p.lat;
      p.pLon = p.lon;
      p.age = Math.floor(Math.random() * MAX_AGE);
    };
    const at = (lat: number, lon: number) => map.latLngToContainerPoint([lat, lon]);

    const frameStep = (t: number) => {
      raf = requestAnimationFrame(frameStep);
      const dt = Math.min(50, t - last);
      last = t;
      if (n++ % 60 === 0) readInk();
      // Fade old trails, then extend each particle along the wind.
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,0.1)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = ink;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1;
      ctx.beginPath();
      const ppd = (256 * 2 ** map.getZoom()) / 360; // screen pixels per degree of longitude
      for (const p of parts) {
        const vel = p.age++ < MAX_AGE ? velocity(p.lat, p.lon) : null;
        if (!vel) {
          seed(p);
          continue;
        }
        p.pLat = p.lat;
        p.pLon = p.lon;
        p.lon += (vel[0] * PX_PER_MS * dt) / ppd;
        p.lat += (vel[1] * PX_PER_MS * dt * Math.cos((p.lat * Math.PI) / 180)) / ppd;
        const a = at(p.pLat, p.pLon);
        const b = at(p.lat, p.lon);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
    };

    const arrows = () => {
      clear();
      readInk();
      const [s, w, nn, e] = area();
      ctx.strokeStyle = ink;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1.2;
      ctx.lineCap = "round";
      ctx.beginPath();
      for (let la = Math.ceil(s / ARROW_STEP) * ARROW_STEP; la <= nn; la += ARROW_STEP) {
        for (let lo = Math.ceil(w / ARROW_STEP) * ARROW_STEP; lo <= e; lo += ARROW_STEP) {
          const vel = velocity(la, lo);
          if (!vel) continue;
          const sp = Math.hypot(vel[0], vel[1]);
          if (sp < 0.3) continue;
          const len = Math.min(26, 6 + sp * 2.5);
          const c = at(la, lo);
          const dx = (vel[0] / sp) * len;
          const dy = (-vel[1] / sp) * len;
          const tx = c.x + dx / 2;
          const ty = c.y + dy / 2;
          const hx = (vel[0] / sp) * 4;
          const hy = (-vel[1] / sp) * 4;
          ctx.moveTo(c.x - dx / 2, c.y - dy / 2);
          ctx.lineTo(tx, ty);
          ctx.moveTo(tx - hx - hy * 0.6, ty - hy + hx * 0.6);
          ctx.lineTo(tx, ty);
          ctx.lineTo(tx - hx + hy * 0.6, ty - hy - hx * 0.6);
        }
      }
      ctx.stroke();
    };

    const start = () => {
      cancelAnimationFrame(raf);
      clear();
      if (reduced.matches) {
        redraw.current = arrows;
        arrows();
        return;
      }
      redraw.current = () => {};
      if (parts.length === 0) {
        for (let i = 0; i < COUNT; i++) {
          const p = { lat: 0, lon: 0, pLat: 0, pLon: 0, age: 0 };
          seed(p);
          parts.push(p);
        }
      }
      readInk();
      if (document.visibilityState === "visible") {
        last = performance.now();
        raf = requestAnimationFrame(frameStep);
      }
    };
    // Trails are drawn in screen space, so wipe them whenever the view moves.
    const moved = () => {
      clear();
      if (reduced.matches) arrows();
      else
        for (const p of parts) {
          p.pLat = p.lat;
          p.pLon = p.lon;
        }
    };
    // After a pan or zoom, particles that are now off screen are re-seeded in view.
    const settled = () => {
      const [s, w, nn, e] = area();
      for (const p of parts) if (p.lat < s || p.lat > nn || p.lon < w || p.lon > e) seed(p);
    };
    const resized = () => {
      size();
      moved();
    };

    size();
    start();
    map.on("move zoom", moved);
    map.on("moveend", settled);
    map.on("resize", resized);
    document.addEventListener("visibilitychange", start);
    reduced.addEventListener("change", start);
    return () => {
      cancelAnimationFrame(raf);
      map.off("move zoom", moved);
      map.off("moveend", settled);
      map.off("resize", resized);
      document.removeEventListener("visibilitychange", start);
      reduced.removeEventListener("change", start);
      canvas.remove();
    };
  }, [map]);

  return null;
}
