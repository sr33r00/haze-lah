import { Footprints, type LucideIcon } from "lucide-react";
import { fmtFullDate } from "./format";

/** One change in a release: a row in the "What's new" sheet and on the About page. */
export type ReleaseItem = { title: string; text: string; href: string; icon: LucideIcon };

/** The current release, shown once to each visitor in the "What's new" sheet and listed on the About page. Keep `version` in step with package.json. */
export const RELEASE: { version: string; date: string; items: ReleaseItem[] } = {
  version: "1.6.0",
  date: "2026-10-24",
  items: [
    {
      title: "Plan your run",
      text: "Pick running, cycling, football or a walk and how long you'll be out. Get the steadiest time today and tomorrow, and how much fine dust you'd breathe, in cigarettes.",
      href: "/#plan",
      icon: Footprints,
    },
  ],
};

/** "Version 1.6.0, 24 Oct 2026". */
export const RELEASE_LABEL = `Version ${RELEASE.version}, ${fmtFullDate(RELEASE.date)}`;
