"use client";

import { Moon, Sun, SunMoon } from "lucide-react";
import { useEffect, useState } from "react";

const MODES = ["system", "light", "dark"] as const;
type Mode = (typeof MODES)[number];
const ICON = { system: SunMoon, light: Sun, dark: Moon };

/** Cycles system, light, dark; the saved choice is applied before paint by the script in layout. */
export default function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("system");

  useEffect(() => {
    try {
      const t = localStorage.getItem("theme") as Mode | null;
      if (t && MODES.includes(t)) setMode(t);
    } catch {}
  }, []);

  const next = () => {
    const m = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
    setMode(m);
    if (m === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = m;
    try {
      if (m === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", m);
    } catch {}
  };

  const Icon = ICON[mode];
  return (
    <button onClick={next} aria-label={`Theme: ${mode[0].toUpperCase()}${mode.slice(1)}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface">
      <Icon size={18} aria-hidden />
    </button>
  );
}
