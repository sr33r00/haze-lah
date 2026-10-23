import { fmtFullDate } from "./format";

/** The current release, shown once to each visitor in the "What's new" sheet and listed on the About page. Keep `version` in step with package.json. */
export const RELEASE = {
  version: "1.3.1",
  date: "2026-10-23",
  items: [
    {
      title: "The air globe",
      text: "The map is now a globe of the Earth from NASA. See the fires, the wind and the air's path to Singapore.",
      href: "/map",
    },
    {
      title: "Every day since 1 August",
      text: "Drag the timeline to see each day of the haze season and the next 3 days. Press play to see the smoke move.",
      href: "/map",
    },
    {
      title: "More pollutants",
      text: "See PM2.5, PM10, carbon monoxide, nitrogen dioxide, sulphur dioxide, ozone and dust on the globe, and NASA's smoke picture.",
      href: "/map",
    },
    {
      title: "Measured readings",
      text: "Dots on the globe show what NEA, Malaysian stations and air sensors measure now. Tap a dot to see the number.",
      href: "/map",
    },
    {
      title: "New fire zones",
      text: "Cyan rings show fires that started far from earlier ones.",
      href: "/map?view=path",
    },
    {
      title: "One smoke map on Now",
      text: "The air journey map now shows the wind and the smoke. Move the slider over the past few days and the next 3, and tap a spot to read the smoke level.",
      href: "/#origin",
    },
  ],
};

/** "Version 1.3.1, 23 Oct 2026". */
export const RELEASE_LABEL = `Version ${RELEASE.version}, ${fmtFullDate(RELEASE.date)}`;
