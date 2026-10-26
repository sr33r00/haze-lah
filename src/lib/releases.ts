import { Cloud, type LucideIcon } from "lucide-react";
import { fmtFullDate } from "./format";

/** One change in a release: a row in the "What's new" sheet and on the About page. */
export type ReleaseItem = { title: string; text: string; href: string; icon: LucideIcon };

/** The current release, shown once to each visitor in the "What's new" sheet and listed on the About page. Keep `version` in step with package.json. */
export const RELEASE: { version: string; date: string; items: ReleaseItem[] } = {
  version: "1.11.1",
  date: "2026-10-26",
  items: [
    {
      title: "Puff comes alive",
      text: "Puff is a real, fluffy cloud now, with hands and feet, and acts out the air: it hops when the air is clear and wipes its brow when it gets hazy. Its sky follows the clock: sun by day, moon and stars at night. Tap Puff to say hi.",
      href: "/#now",
      icon: Cloud,
    },
  ],
};

/** "Version 1.9.0, 26 Oct 2026". */
export const RELEASE_LABEL = `Version ${RELEASE.version}, ${fmtFullDate(RELEASE.date)}`;
