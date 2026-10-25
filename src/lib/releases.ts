import { Cloud, Map as MapIcon, type LucideIcon } from "lucide-react";
import { fmtFullDate } from "./format";

/** One change in a release: a row in the "What's new" sheet and on the About page. */
export type ReleaseItem = { title: string; text: string; href: string; icon: LucideIcon };

/** The current release, shown once to each visitor in the "What's new" sheet and listed on the About page. Keep `version` in step with package.json. */
export const RELEASE: { version: string; date: string; items: ReleaseItem[] } = {
  version: "1.8.0",
  date: "2026-10-26",
  items: [
    {
      title: "Meet Puff",
      text: "A little cloud beside the answer that shows how the air feels: happy when it's fine, worried as it gets hazy, and in tears with a mask on the worst days.",
      href: "/#now",
      icon: Cloud,
    },
    {
      title: "Easier to read map numbers",
      text: "On the Across Singapore map, numbers on yellow, light green and orange now use dark text, so the US AQI view is readable.",
      href: "/#across",
      icon: MapIcon,
    },
  ],
};

/** "Version 1.8.0, 26 Oct 2026". */
export const RELEASE_LABEL = `Version ${RELEASE.version}, ${fmtFullDate(RELEASE.date)}`;
