"use client";

import { useCallback, useEffect, useState } from "react";
import { REGIONS, REGION_POINT, type Group, type Region } from "@/lib/bands";
import { SG } from "@/lib/util";

const GROUPS: Group[] = ["healthy", "sensitive", "chronic"];

function useStored<T extends string>(key: string, allowed: readonly T[], fallback: T) {
  const [value, setValue] = useState<T>(fallback);
  useEffect(() => {
    try {
      const v = localStorage.getItem(key) as T | null;
      if (v && allowed.includes(v)) setValue(v);
    } catch {}
  }, [key, allowed]);
  const set = useCallback(
    (v: T) => {
      setValue(v);
      try {
        localStorage.setItem(key, v);
      } catch {}
    },
    [key],
  );
  return [value, set] as const;
}

function nearestRegion(lat: number, lon: number): Region {
  return REGIONS.reduce((best, r) => {
    const d = (p: [number, number]) => (p[0] - lat) ** 2 + (p[1] - lon) ** 2;
    return d(REGION_POINT[r]) < d(REGION_POINT[best]) ? r : best;
  });
}

/** The visitor's remembered region and health group, plus "use my location". */
export function usePrefs() {
  const [region, setRegion] = useStored<Region>("region", REGIONS, "central");
  const [group, setGroup] = useStored<Group>("group", GROUPS, "healthy");
  const [locating, setLocating] = useState(false);

  const locate = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        const inSingapore = Math.abs(coords.latitude - SG.lat) < 0.3 && Math.abs(coords.longitude - SG.lon) < 0.4;
        if (inSingapore) setRegion(nearestRegion(coords.latitude, coords.longitude));
      },
      () => setLocating(false),
      { timeout: 8000, maximumAge: 600_000 },
    );
  }, [setRegion]);

  return { region, setRegion, group, setGroup, locating, locate };
}
