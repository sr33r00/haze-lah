import { ChartLine, Cigarette, Globe, type LucideIcon } from "lucide-react";
import { fmtFullDate } from "./format";

/** One change in a release: a row in the "What's new" sheet and on the About page. */
export type ReleaseItem = { title: string; text: string; href: string; icon: LucideIcon };

/** The current release, shown once to each visitor in the "What's new" sheet and listed on the About page. Keep `version` in step with package.json. */
export const RELEASE: { version: string; date: string; items: ReleaseItem[] } = {
  version: "1.7.0",
  date: "2026-10-25",
  items: [
    {
      title: "Cigarettes, now and so far",
      text: "See this hour's air as cigarettes a day, which drops as soon as the air clears, and a pack that burns down with what you've breathed since midnight.",
      href: "/#everyday",
      icon: Cigarette,
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

/** "Version 1.7.0, 25 Oct 2026". */
export const RELEASE_LABEL = `Version ${RELEASE.version}, ${fmtFullDate(RELEASE.date)}`;
