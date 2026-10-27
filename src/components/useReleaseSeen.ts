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
