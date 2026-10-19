"use client";

import { useCallback, useEffect, useState } from "react";
import { REGIONS, nearestRegion, type Group, type Region } from "@/lib/bands";
import { SG } from "@/lib/util";

const GROUPS: Group[] = ["healthy", "sensitive", "chronic"];

/** A string setting remembered in this browser, limited to `allowed`. */
export function useStored<T extends string>(key: string, allowed: readonly T[], fallback: T) {
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

/**
 * The visitor's remembered region and health group, plus "use my location". Until the visitor picks a region,
 * `defaultRegion` (the one with the highest PSI) is shown and nothing is stored, so it follows the haze.
 */
export function usePrefs(defaultRegion: Region = "central") {
  const [region, setRegion] = useStored<Region>("region", REGIONS, defaultRegion);
  const [group, setGroup] = useStored<Group>("group", GROUPS, "healthy");
  const [locating, setLocating] = useState(false);

  // A shared link (?region=west) wins over the remembered region.
  useEffect(() => {
    const r = new URLSearchParams(location.search).get("region") as Region | null;
    if (r && REGIONS.includes(r)) setRegion(r);
  }, [setRegion]);

  const pickRegion = useCallback(
    (r: Region) => {
      setRegion(r);
      const url = new URL(location.href);
      url.searchParams.set("region", r);
      history.replaceState(null, "", url);
    },
    [setRegion],
  );

  const locate = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        const inSingapore = Math.abs(coords.latitude - SG.lat) < 0.3 && Math.abs(coords.longitude - SG.lon) < 0.4;
        if (inSingapore) pickRegion(nearestRegion(coords.latitude, coords.longitude));
      },
      () => setLocating(false),
      { timeout: 8000, maximumAge: 600_000 },
    );
  }, [pickRegion]);

  return { region, setRegion: pickRegion, group, setGroup, locating, locate };
}
