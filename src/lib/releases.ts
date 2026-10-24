import { CalendarDays, Camera, ChartLine, Globe, MapPin, Satellite, type LucideIcon } from "lucide-react";
import { fmtFullDate } from "./format";

/** One change in a release: a row in the "What's new" sheet and on the About page. */
export type ReleaseItem = { title: string; text: string; href: string; icon: LucideIcon };

/** The current release, shown once to each visitor in the "What's new" sheet and listed on the About page. Keep `version` in step with package.json. */
export const RELEASE: { version: string; date: string; items: ReleaseItem[] } = {
  version: "1.5.0",
  date: "2026-10-24",
  items: [
    {
      title: "New forecast",
      text: "One answer up top, then a 48-hour graph you can drag: PM2.5 with its likely range, the wind and the rain. See how accurate the forecast has been.",
      href: "/forecast",
      icon: ChartLine,
    },
    {
      title: "PM2.5 or US AQI",
      text: "Switch the map on Now between PM2.5 and US AQI, with every AQICN station in Singapore. Every dot shows its number, and a blue dot shows where you are.",
      href: "/#across",
      icon: MapPin,
    },
    {
      title: "Smoke from space",
      text: "Watch today's smoke on the Himawari-9 satellite loop, or switch to the last 7 days of NASA smoke thickness. Tap the picture for full screen.",
      href: "/photos#space",
      icon: Satellite,
    },
    {
      title: "Cameras first",
      text: "Photos now opens with the road cameras and webcams, so you can see the haze where you are.",
      href: "/photos#ground",
      icon: Camera,
    },
    {
      title: "Days of haze",
      text: "News now counts the whole haze spell, not just the last week.",
      href: "/news",
      icon: CalendarDays,
    },
    {
      title: "Fly in from space",
      text: "The globe now opens on the whole Earth and flies down to Singapore, and it loads faster. Tap anywhere to skip.",
      href: "/map",
      icon: Globe,
    },
  ],
};

/** "Version 1.5.0, 24 Oct 2026". */
export const RELEASE_LABEL = `Version ${RELEASE.version}, ${fmtFullDate(RELEASE.date)}`;
