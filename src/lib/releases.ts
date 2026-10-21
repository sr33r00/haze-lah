import { fmtFullDate } from "./format";

/** The current release, shown once to returning visitors in the "What's new" sheet and listed on the About page. Keep `version` in step with package.json. */
export const RELEASE = {
  version: "1.2.0",
  date: "2026-10-21",
  items: [
    {
      title: "Smoke you breathe",
      text: "The cigarette card now shows how much fine dust you breathed today. It also compares today with a normal day.",
      href: "/#everyday",
    },
    {
      title: "Your air's journey",
      text: "See where today's air started, how far it travelled and how many fires it passed. You can share it as a picture.",
      href: "/#origin",
    },
    {
      title: "Smoke on the way",
      text: "See if smoke from today's fires will reach Singapore, and about when.",
      href: "/#origin",
    },
    {
      title: "AQICN number",
      text: "The Now card shows the number AQICN shows for the same PM2.5 reading. The Guide explains why it is bigger.",
      href: "/guide#other-apps",
    },
  ],
};

/** "Version 1.2.0, 21 Oct 2026". */
export const RELEASE_LABEL = `Version ${RELEASE.version}, ${fmtFullDate(RELEASE.date)}`;
