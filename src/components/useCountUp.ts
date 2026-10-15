import { useEffect, useRef, useState } from "react";

/** Eases a number from its last shown value (0 at first) to `target`; jumps straight there under reduced motion. */
export function useCountUp(target: number | null, ms = 600) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    if (target == null) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      from.current = target;
      setShown(target);
      return;
    }
    const start = from.current;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      from.current = start + (target - start) * (1 - (1 - k) ** 3);
      setShown(Math.round(from.current));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);

  return shown;
}
