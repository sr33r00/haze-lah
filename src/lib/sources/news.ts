import type { NewsItem } from "../types";
import { getText } from "../util";

// Official news: NEA news RSS and the Meteorological Service Singapore 24-hour forecast Atom feed.
const NEA_RSS = "https://www.nea.gov.sg/rss/news_update";
const MSS_ATOM = "https://www.weather.gov.sg/files/rss/rss24HrForecast.xml";
const MSS_PAGE = "https://www.weather.gov.sg/weather-forecast-24hrs/";
const FALLBACK = "https://www.nea.gov.sg/media/news/advisories";
const HOSTS = ["nea.gov.sg", "www.nea.gov.sg", "www.weather.gov.sg"];
const HAZE = /haze|psi|air quality|smoke|hotspot|pm2\.5/i;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘",
  rdquo: "”", ldquo: "“", micro: "µ", deg: "°", hellip: "…",
};

const decode = (s: string) =>
  s.replace(/&(?:#x([0-9a-f]+)|#(\d+)|([a-z]+));/gi, (m, hex, dec, name) => {
    const cp = hex ? parseInt(hex, 16) : dec ? parseInt(dec, 10) : NaN;
    if (!isNaN(cp)) return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : "";
    return NAMED[name.toLowerCase()] ?? m;
  });
const stripTags = (s: string) => s.replace(/<[^>]*>/g, " ");

/** HTML to plain text. Entities are decoded twice because NEA sometimes double-escapes. */
export const toText = (html: string) => stripTags(decode(stripTags(decode(html)))).replace(/\s+/g, " ").replace(/\s+([.,;:!?])/g, "$1").trim();

/** Only NEA and MSS pages are linked; http is upgraded to https. */
export function safeUrl(u: string | undefined): string {
  try {
    const url = new URL(u ?? "");
    if (HOSTS.includes(url.hostname) && /^https?:$/.test(url.protocol)) {
      url.protocol = "https:";
      return url.href;
    }
  } catch {}
  return FALLBACK;
}

/** First two sentences, without the dateline or paragraph numbers, cut to ~240 characters. */
export function summarise(text: string, max = 240): string {
  const clean = text
    .replace(/^(?:Singapore,?\s+)?\d{1,2} [A-Za-z]+ \d{4}\s*[–—-]?\s*/, "")
    .replace(/(^|[.!?]\s+)\d{1,2}\.?\s+(?=[A-Z])(?!\d)/g, "$1");
  let out = clean.split(/(?<=[.!?])\s+(?=[A-Z])/).slice(0, 2).join(" ");
  if (out.length > max) out = out.slice(0, max).replace(/\s+\S*$/, "").replace(/[,;:\s]+$/, "") + "…";
  return out;
}

const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1] ?? "";

/** "15 Oct 2026 06:19" to "2026-10-15"; the time of day has no am/pm, so it is dropped. */
function neaDate(s: string): string | null {
  const m = s.match(/(\d{1,2}) ([A-Za-z]{3}) (\d{4})/);
  const mi = m ? MONTHS.findIndex((x) => x.toLowerCase() === m[2].toLowerCase()) : -1;
  return m && mi >= 0 ? `${m[3]}-${String(mi + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}

export function parseNea(xml: string): NewsItem[] {
  const out: NewsItem[] = [];
  for (const [, item] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const title = toText(tag(item, "title"));
    const text = toText(tag(item, "description"));
    const date = neaDate(tag(item, "pubDate"));
    if (!date || !HAZE.test(`${title} ${text}`)) continue;
    out.push({ source: "NEA", title, summary: summarise(text), date, url: safeUrl(toText(tag(item, "link"))) });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
}

export function parseMss(xml: string): NewsItem[] {
  const entry = tag(xml, "entry");
  const updated = tag(entry, "updated").trim();
  const summary = toText(tag(entry, "content").match(/Forecast - ([\s\S]*?)(?:<br|Max\/Min|$)/)?.[1] ?? "");
  if (!summary || isNaN(Date.parse(updated))) return [];
  return [{ source: "MSS", title: "Weather outlook", summary, date: updated, url: MSS_PAGE }];
}

export async function fetchNews(): Promise<NewsItem[]> {
  const [nea, mss] = await Promise.allSettled([
    getText(NEA_RSS, { revalidate: 900 }).then(parseNea),
    getText(MSS_ATOM, { revalidate: 900 }).then(parseMss),
  ]);
  if (nea.status === "rejected" && mss.status === "rejected") throw nea.reason;
  return [...(nea.status === "fulfilled" ? nea.value : []), ...(mss.status === "fulfilled" ? mss.value : [])];
}
