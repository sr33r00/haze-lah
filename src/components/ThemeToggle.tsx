"use client";

import { Moon, Sun, SunMoon } from "lucide-react";
import { useEffect, useState } from "react";
import { cap } from "@/lib/format";
import { THEME_COLOR } from "@/lib/theme";

const MODES = ["system", "light", "dark"] as const;
type Mode = (typeof MODES)[number];
const ICON = { system: SunMoon, light: Sun, dark: Moon };

/** Points every theme-color meta at the chosen theme; on system, each keeps its own scheme's colour. */
function paintChrome(mode: Mode) {
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    const dark = m.media.includes("dark");
    m.content = THEME_COLOR[mode === "system" ? (dark ? "dark" : "light") : mode];
  });
}

/** Cycles system, light, dark; the saved choice is applied before paint by the script in layout. */
export default function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("system");

  useEffect(() => {
    try {
      const t = localStorage.getItem("theme") as Mode | null;
      if (t && MODES.includes(t)) {
        setMode(t);
        paintChrome(t);
      }
    } catch {}
  }, []);

  const nextMode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
  const next = () => {
    const m = nextMode;
    setMode(m);
    paintChrome(m);
    if (m === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = m;
    try {
      if (m === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", m);
    } catch {}
  };

  const Icon = ICON[mode];
  const label = `Theme: ${cap(mode)}. Tap for ${cap(nextMode)}`;
  return (
    <button
      onClick={next}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface transition-colors hover:bg-line"
    >
      <Icon size={18} aria-hidden />
    </button>
  );
}
