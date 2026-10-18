import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/links";

const PAGES: [string, MetadataRoute.Sitemap[number]["changeFrequency"], number][] = [
  ["/", "hourly", 1],
  ["/forecast", "hourly", 0.9],
  ["/map", "hourly", 0.7],
  ["/photos", "hourly", 0.6],
  ["/news", "hourly", 0.7],
  ["/guide", "weekly", 0.7],
  ["/about", "weekly", 0.5],
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PAGES.map(([path, changeFrequency, priority]) => ({ url: `${SITE_URL}${path === "/" ? "" : path}`, lastModified, changeFrequency, priority }));
}
