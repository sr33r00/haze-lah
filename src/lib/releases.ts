import { CalendarClock, Clock, CloudSun, Map as MapIcon, type LucideIcon } from "lucide-react";
import { fmtFullDate } from "./format";

/** One change in a release: a row in the "What's new" sheet and on the About page. */
export type ReleaseItem = { title: string; text: string; href: string; icon: LucideIcon };

/** One release: its version (the newest is in step with package.json, except for fix-only releases, which leave it so the sheet does not open again), its date (YYYY-MM-DD) and its highlights. */
export type Release = { version: string; date: string; items: ReleaseItem[] };

/** The last three releases, newest first: all shown in the "What's new" sheet and on the About page. Drop the oldest when adding one. */
export const RELEASES: Release[] = [
  {
    version: "1.14.0",
    date: "2026-10-27",
    items: [
      {
        title: "Cleanest time to go out",
        text: "The haze card now tells you when the air is cleanest for what you plan to do, from Plan your day.",
        href: "/#plan",
        icon: Clock,
      },
    ],
  },
  {
    version: "1.13.0",
    date: "2026-10-27",
    items: [
      {
        title: "Weather in the haze card",
        text: "Temperature, UV, rain and lightning now sit under the haze reading. Tap one to see where and when it was measured.",
        href: "/#outdoor",
        icon: CloudSun,
      },
    ],
  },
  {
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
  },
];

/** The newest release: the one a visitor is shown once, and the one "seen" is keyed to. */
export const RELEASE = RELEASES[0];

/** "Version 1.9.0, 26 Oct 2026". */
export const releaseLabel = ({ version, date }: Release) => `Version ${version}, ${fmtFullDate(date)}`;
