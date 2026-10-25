import type { NewsItem } from "../types";
import { getText } from "../util";

// Official news: NEA news RSS and the Meteorological Service Singapore 24-hour forecast Atom feed,
// plus haze headlines from CNA and The Straits Times.
const NEA_RSS = "https://www.nea.gov.sg/rss/news_update";
const MSS_ATOM = "https://www.weather.gov.sg/files/rss/rss24HrForecast.xml";
const MSS_PAGE = "https://www.weather.gov.sg/weather-forecast-24hrs/";
const FALLBACK = "https://www.nea.gov.sg/media/news/advisories";
const OUTLETS = {
  CNA: { feed: "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=10416", host: "www.channelnewsasia.com" },
  ST: { feed: "https://www.straitstimes.com/news/singapore/rss.xml", host: "www.straitstimes.com" },
} as const;
type Outlet = keyof typeof OUTLETS;
const HOSTS = ["nea.gov.sg", "www.nea.gov.sg", "www.weather.gov.sg", OUTLETS.CNA.host, OUTLETS.ST.host];
const OUTLET_HAZE = /\bhaze\b|\bPSI\b|air quality|N95|hotspots?\b|transboundary/i; // title only, to keep noise out
const OUTLET_DAYS = 7;
const OUTLET_MAX = 6;
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
const BLOCK_TAG = /<\/?(?:p|div|br|li|h[1-6]|tr|td|th|ul|ol|table)\b[^>]*>/gi;
/** Block-level tags become a space; inline ones vanish, so "<b>Th</b>e" stays "The". */
const stripTags = (s: string) => s.replace(BLOCK_TAG, " ").replace(/<[^>]*>/g, "");

/** HTML to plain text. Entities are decoded twice because NEA sometimes double-escapes. */
export const toText = (html: string) => stripTags(decode(stripTags(decode(html)))).replace(/\s+/g, " ").replace(/\s+([.,;:!?])/g, "$1").trim();

/** Only NEA, MSS and the two outlets are linked; http is upgraded to https. */
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

/**
 * "15 Oct 2026 06:19" to "2026-10-15", or an SGT ISO time when the text allows it.
 * The pubDate clock has no am/pm, but NEA posts after the time it reports ("As at 6pm" goes out at 6:19pm).
 * So the publish time is the earliest 12-hour reading at or after that reference; with no reference, or
 * none that fits, only the date is kept rather than guessing.
 */
function neaDate(pub: string, text: string): string | null {
  const m = pub.match(/(\d{1,2}) ([A-Za-z]{3}) (\d{4})/);
  const mi = m ? MONTHS.findIndex((x) => x.toLowerCase() === m[2].toLowerCase()) : -1;
  if (!m || mi < 0) return null;
  const date = `${m[3]}-${String(mi + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const clock = pub.match(/\b(\d{1,2}):(\d{2})\b/);
  const ref = text.match(/as (?:at|of) (\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (!clock || !ref) return date;
  const refMin = ((+ref[1] % 12) + (ref[3].toLowerCase() === "pm" ? 12 : 0)) * 60 + +(ref[2] ?? 0);
  const hh = +clock[1] % 12;
  const hour = [hh, hh + 12].find((h) => h * 60 + +clock[2] >= refMin);
  return hour == null ? date : `${date}T${String(hour).padStart(2, "0")}:${clock[2]}:00+08:00`;
}

export function parseNea(xml: string): NewsItem[] {
  const out: NewsItem[] = [];
  for (const [, item] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const title = toText(tag(item, "title"));
    const text = toText(tag(item, "description"));
    const date = neaDate(tag(item, "pubDate"), `${title} ${text}`);
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

/** Haze headlines from a CNA or ST feed: last 7 days, newest first. Links must be on the outlet's own host. */
export function parseOutlet(xml: string, source: Outlet, now = Date.now()): NewsItem[] {
  const out: NewsItem[] = [];
  for (const [, item] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const title = toText(tag(item, "title"));
    const t = Date.parse(tag(item, "pubDate"));
    const url = safeUrl(toText(tag(item, "link")));
    if (!OUTLET_HAZE.test(title) || isNaN(t) || now - t > OUTLET_DAYS * 864e5 || new URL(url).hostname !== OUTLETS[source].host) continue;
    out.push({ source, title, summary: summarise(toText(tag(item, "description"))), date: new Date(t).toISOString(), url });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date)).slice(0, OUTLET_MAX);
}

export async function fetchNews(): Promise<NewsItem[]> {
  const feeds = await Promise.allSettled([
    getText(NEA_RSS).then(parseNea),
    getText(MSS_ATOM).then(parseMss),
    ...(Object.keys(OUTLETS) as Outlet[]).map((o) => getText(OUTLETS[o].feed).then((x) => parseOutlet(x, o))),
  ]);
  const failed = feeds.filter((f) => f.status === "rejected");
  if (failed.length === feeds.length) throw failed[0].reason;
  return feeds.flatMap((f) => (f.status === "fulfilled" ? f.value : []));
}
