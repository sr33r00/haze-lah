"use client";

import { Wind } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * With reduced motion the wind is drawn as still arrows; the viewer can still ask for the animation, and the choice is remembered.
 * `reduced` says the viewer asked for less motion (so the toggle is worth showing); `motion` says the animation is wanted anyway.
 */
export function useWindMotion() {
  const [reduced, setReduced] = useState(false);
  const [motion, setMotion] = useState(false);
  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    try {
      setMotion(localStorage.getItem("wind-motion") === "1");
    } catch {}
    return () => mq.removeEventListener("change", sync);
  }, []);
  const toggle = () => {
    setMotion((m) => {
      try {
        localStorage.setItem("wind-motion", m ? "0" : "1");
      } catch {}
      return !m;
    });
  };
  return { reduced, motion, toggle };
}

/** The button that turns the wind animation on or off under reduced motion; `className` places it. */
export default function WindMotionButton({ motion, onToggle, className }: { motion: boolean; onToggle: () => void; className: string }) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={motion}
      className={`flex min-h-[36px] items-center gap-1.5 rounded-full bg-surface px-3 text-[13px] font-semibold shadow hover:bg-line ${className}`}
    >
      <Wind size={15} aria-hidden />
      {motion ? "Still wind" : "Animate wind"}
    </button>
  );
}
