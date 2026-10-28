import { Clock, Globe, Palette, RefreshCw, Wind, type LucideIcon } from "lucide-react";
import { fmtFullDate } from "./format";

/** One change in a release: a row in the "What's new" sheet and on the About page. */
export type ReleaseItem = { title: string; text: string; href: string; icon: LucideIcon };

/** One release: its version (the newest is in step with package.json, except for fix-only releases, which leave it so the sheet does not open again), its date (YYYY-MM-DD) and its highlights. */
export type Release = { version: string; date: string; items: ReleaseItem[] };

/** The last three releases, newest first: all shown in the "What's new" sheet and on the About page. Drop the oldest when adding one. */
export const RELEASES: Release[] = [
  {
    version: "1.16.0",
    date: "2026-10-28",
    items: [
      {
        title: "The air on a globe",
        text: "On a laptop or monitor, Now shows the air and wind on a globe beside your reading. Open Haze Lah on a computer to explore it.",
        href: "/#origin",
        icon: Globe,
      },
      {
        title: "Weather that stays",
        text: "The weather card keeps its last reading when you come back to Now, instead of loading again.",
        href: "/#outdoor",
        icon: RefreshCw,
      },
      {
        title: "Wind all night",
        text: "The globe keeps its wind overnight and shows when it is still loading.",
        href: "/map",
        icon: Wind,
      },
    ],
  },
  {
    version: "1.15.0",
    date: "2026-10-28",
    items: [
      {
        title: "Clearer colours",
        text: "Each colour now means one thing: green to red for the air, blue for rain, violet for UV. Links are underlined and main buttons are solid, so they never look like a reading.",
        href: "/",
        icon: Palette,
      },
    ],
  },
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
];

/** The newest release: the one a visitor is shown once, and the one "seen" is keyed to. */
export const RELEASE = RELEASES[0];

/** "Version 1.9.0, 26 Oct 2026". */
export const releaseLabel = ({ version, date }: Release) => `Version ${version}, ${fmtFullDate(date)}`;
