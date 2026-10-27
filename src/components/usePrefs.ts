"use client";

import { useCallback, useEffect, useState } from "react";
import { REGIONS, nearestRegion, type Group, type Region } from "@/lib/bands";
import { ACTIVITIES, ACTIVITY, DURATIONS, type Activity } from "@/lib/exercise";
import { locateMe } from "./useMyPosition";

const GROUPS: Group[] = ["healthy", "sensitive", "chronic"];

/** Tells the other `useStored` users of a key, on this page, that it changed (the browser's own `storage` event only reaches other tabs). */
const STORED_EVENT = "haze:stored";

/** A string setting remembered in this browser, limited to `allowed`. Every component using the same key follows a change, on this page and in other tabs. */
export function useStored<T extends string>(key: string, allowed: readonly T[], fallback: T) {
  const [value, setValue] = useState<T>(fallback);
  useEffect(() => {
    const read = () => {
      try {
        const v = localStorage.getItem(key) as T | null;
        setValue(v && allowed.includes(v) ? v : fallback);
      } catch {}
    };
    const changed = (e: Event) => {
      if ((e instanceof StorageEvent ? e.key : (e as CustomEvent<string>).detail) === key) read();
    };
    read();
    addEventListener(STORED_EVENT, changed);
    addEventListener("storage", changed);
    return () => {
      removeEventListener(STORED_EVENT, changed);
      removeEventListener("storage", changed);
    };
  }, [key, allowed, fallback]);
  const set = useCallback(
    (v: T) => {
      setValue(v);
      try {
        localStorage.setItem(key, v);
        dispatchEvent(new CustomEvent(STORED_EVENT, { detail: key }));
      } catch {}
    },
    [key],
  );
  return [value, set] as const;
}

const DURATION_KEYS = DURATIONS.map(String);

/** The activity and session length last picked in Plan your day, shared with the Now page's best-time line. `hours` is the length in hours; `usual` the activity's own usual length (the default). */
export function usePlanChoice() {
  const [activity, setActivity] = useStored<Activity>("activity", ACTIVITIES, "out");
  const usual = ACTIVITY[activity].hours;
  const [chosen, setHours] = useStored(`duration-${activity}`, DURATION_KEYS, String(usual));
  return { activity, setActivity, hours: Number(chosen), setHours, usual };
}

const FIRST_VISIT = "first-visit";

/** Whether this browser first visited more than `afterMs` ago (false on the first visit, which records the time). False until the page has hydrated. */
export function useReturning(afterMs: number) {
  const [returning, setReturning] = useState(false);
  useEffect(() => {
    try {
      const first = Number(localStorage.getItem(FIRST_VISIT));
      if (first) setReturning(Date.now() - first > afterMs);
      else localStorage.setItem(FIRST_VISIT, String(Date.now()));
    } catch {}
  }, [afterMs]);
  return returning;
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

  const locate = useCallback(async () => {
    setLocating(true);
    const r = await locateMe();
    setLocating(false);
    if (r.status === "ok") pickRegion(nearestRegion(r.lat, r.lon));
  }, [pickRegion]);

  return { region, setRegion: pickRegion, group, setGroup, locating, locate };
}
