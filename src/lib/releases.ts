import { CalendarClock, CloudSun, Map as MapIcon, type LucideIcon } from "lucide-react";
import { fmtFullDate } from "./format";

/** One change in a release: a row in the "What's new" sheet and on the About page. */
export type ReleaseItem = { title: string; text: string; href: string; icon: LucideIcon };

/** The current release, shown once to each visitor in the "What's new" sheet and listed on the About page. Keep `version` in step with package.json. */
export const RELEASE: { version: string; date: string; items: ReleaseItem[] } = {
  version: "1.12.0",
  date: "2026-10-27",
  items: [
    {
      title: "Outdoor conditions",
      text: "Rain, heat, UV and lightning near you, straight from NEA and refreshed every 5 minutes, right under the haze answer.",
      href: "/#outdoor",
      icon: CloudSun,
    },
    {
      title: "Plans that dodge the rain",
      text: "Plan your day now weighs rain and UV as well as the air, so the best time skips wet and very sunny hours.",
      href: "/#plan",
      icon: CalendarClock,
    },
    {
      title: "Made for big screens, Singapore marked",
      text: "On a laptop the map now fills the screen beside the answer. Singapore has a red outline on the maps, and the smoke map points it out.",
      href: "/#across",
      icon: MapIcon,
    },
  ],
};

/** "Version 1.9.0, 26 Oct 2026". */
export const RELEASE_LABEL = `Version ${RELEASE.version}, ${fmtFullDate(RELEASE.date)}`;
