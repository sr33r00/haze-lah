import { useEffect, useState } from "react";
import { RELEASE } from "@/lib/releases";

const SEEN = "seen-release";
const EVENT = "haze:release-seen";

/** Whether this browser has already seen the current release's "What's new" sheet. True when storage is unavailable, as the sheet then never opens. */
export function hasSeenRelease() {
  try {
    return localStorage.getItem(SEEN) === RELEASE.version;
  } catch {
    return true;
  }
}

/** Marks the current release as seen, and tells `useReleaseSeen` users on this page. */
export function markReleaseSeen() {
  try {
    localStorage.setItem(SEEN, RELEASE.version);
  } catch {}
  dispatchEvent(new Event(EVENT));
}

/** Whether the "What's new" sheet is out of the way: false until hydrated and while it is due or open, true once it was closed. */
export function useReleaseSeen() {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const read = () => setSeen(hasSeenRelease());
    read();
    addEventListener(EVENT, read);
    return () => removeEventListener(EVENT, read);
  }, []);
  return seen;
}

/** Whether this browser closed a "What's new" sheet on an earlier page load, so it is a returning visitor. Read on mount, before this page load's sheet can be closed. False until hydrated, and when storage is unavailable. */
export function useReturning() {
  const [returning, setReturning] = useState(false);
  useEffect(() => {
    try {
      setReturning(localStorage.getItem(SEEN) !== null);
    } catch {}
  }, []);
  return returning;
}
