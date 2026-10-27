import { CloudSun, type LucideIcon } from "lucide-react";
import { fmtFullDate } from "./format";

/** One change in a release: a row in the "What's new" sheet and on the About page. */
export type ReleaseItem = { title: string; text: string; href: string; icon: LucideIcon };

/** The current release, shown once to each visitor in the "What's new" sheet and listed on the About page. Keep `version` in step with package.json. */
export const RELEASE: { version: string; date: string; items: ReleaseItem[] } = {
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
};

/** "Version 1.9.0, 26 Oct 2026". */
export const RELEASE_LABEL = `Version ${RELEASE.version}, ${fmtFullDate(RELEASE.date)}`;
