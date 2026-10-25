import { CalendarClock, Cloud, Newspaper, Type, type LucideIcon } from "lucide-react";
import { fmtFullDate } from "./format";

/** One change in a release: a row in the "What's new" sheet and on the About page. */
export type ReleaseItem = { title: string; text: string; href: string; icon: LucideIcon };

/** The current release, shown once to each visitor in the "What's new" sheet and listed on the About page. Keep `version` in step with package.json. */
export const RELEASE: { version: string; date: string; items: ReleaseItem[] } = {
  version: "1.9.0",
  date: "2026-10-26",
  items: [
    {
      title: "News, easier to read",
      text: "NEA's latest haze update is on top, and older days fold away until you open them.",
      href: "/news",
      icon: Newspaper,
    },
    {
      title: "Bigger text",
      text: "Small labels and notes across the site are larger and easier to read.",
      href: "/#now",
      icon: Type,
    },
    {
      title: "Forecast in plain words",
      text: "The Forecast page starts with the haziest hour ahead and the best time to go out.",
      href: "/forecast",
      icon: CalendarClock,
    },
    {
      title: "Puff, now with weather",
      text: "Puff is bigger and brings sun on clear days and drifting haze when the air gets worse.",
      href: "/#now",
      icon: Cloud,
    },
  ],
};

/** "Version 1.9.0, 26 Oct 2026". */
export const RELEASE_LABEL = `Version ${RELEASE.version}, ${fmtFullDate(RELEASE.date)}`;
