import { ChartLine, Footprints, Globe, type LucideIcon } from "lucide-react";
import { fmtFullDate } from "./format";

/** One change in a release: a row in the "What's new" sheet and on the About page. */
export type ReleaseItem = { title: string; text: string; href: string; icon: LucideIcon };

/** The current release, shown once to each visitor in the "What's new" sheet and listed on the About page. Keep `version` in step with package.json. */
export const RELEASE: { version: string; date: string; items: ReleaseItem[] } = {
  version: "1.6.2",
  date: "2026-10-24",
  items: [
    {
      title: "Plan your day, in one card",
      text: "Pick running, cycling, football or a walk and how long you'll be out. Your best time, the hours from now and the fine dust you'd breathe, all in one card, with bars sized to show the changes.",
      href: "/#plan",
      icon: Footprints,
    },
    {
      title: "New forecast",
      text: "One answer up top, then a 48-hour graph you can drag: PM2.5 with its likely range, the wind and the rain. See how accurate the forecast has been.",
      href: "/forecast",
      icon: ChartLine,
    },
    {
      title: "Fly in from space",
      text: "The globe now opens on the whole Earth and flies down to Singapore, and it loads faster. Tap anywhere to skip.",
      href: "/map",
      icon: Globe,
    },
  ],
};

/** "Version 1.6.2, 24 Oct 2026". */
export const RELEASE_LABEL = `Version ${RELEASE.version}, ${fmtFullDate(RELEASE.date)}`;
