import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/links";

const AI_CRAWLERS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "ClaudeBot", "Claude-SearchBot", "Google-Extended", "Applebot-Extended", "Bingbot"];

/** Not for search: the data endpoints, including the globe's history files. */
const DISALLOW = ["/api/", "/data/"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: ["*", ...AI_CRAWLERS].map((userAgent) => ({ userAgent, allow: "/", disallow: DISALLOW })),
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
