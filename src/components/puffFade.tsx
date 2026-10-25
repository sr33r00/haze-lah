import { useEffect, useState, type ReactNode } from "react";

/** How long a mood stays mounted after it changes: the fade-out (300 ms) plus the fade-in's head start. */
const LEAVE_MS = 560;

/** The value `value` had before its last change, kept for `LEAVE_MS` so it can fade out; null the rest of the time. */
export function useLeaving<T>(value: T): { v: T } | null {
  const [last, setLast] = useState(value);
  const [gone, setGone] = useState<{ v: T } | null>(null);
  if (last !== value) {
    setLast(value);
    setGone({ v: last });
  }
  useEffect(() => {
    if (!gone) return;
    const t = setTimeout(() => setGone(null), LEAVE_MS);
    return () => clearTimeout(t);
  }, [gone]);
  return gone;
}

/**
 * One keyed layer for the current value, plus one for the value just left while it fades out. The keys never change, so nothing
 * remounts when the leaving layer goes; with motion off the leaving layer is already at opacity 0.
 */
export function fadeLayers<T extends string | null>(cur: T, gone: { v: T } | null, render: (v: T) => ReactNode): ReactNode[] {
  const layer = (v: T, leaving: boolean) => (
    <g key={String(v)} className={leaving ? "animate-puff-out" : gone ? "animate-puff-in" : undefined} style={leaving ? { opacity: 0 } : undefined}>
      {render(v)}
    </g>
  );
  return gone ? [layer(gone.v, true), layer(cur, false)] : [layer(cur, false)];
}
