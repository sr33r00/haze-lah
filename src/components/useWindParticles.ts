"use client";

import { useEffect, useState } from "react";
import { windParticles, type Wind, type WindParticles, type WindView } from "@/lib/windParticles";

/** Runs the wind animation on a map once its `view` exists. `motion` draws it even where the viewer asked for reduced motion; `ink` is the line colour (the page's text colour by default). */
export function useWindParticles(view: WindView | undefined, wind: Wind | undefined, motion: boolean, ink?: string) {
  const [engine, setEngine] = useState<WindParticles>();
  useEffect(() => {
    if (!view) return;
    const e = windParticles(view, ink);
    setEngine(e);
    return () => {
      e.destroy();
      setEngine(undefined);
    };
  }, [view, ink]);
  useEffect(() => engine?.setWind(wind), [engine, wind]);
  useEffect(() => engine?.setMotion(motion), [engine, motion]);
}
