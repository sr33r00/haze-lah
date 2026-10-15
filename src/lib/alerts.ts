import { GROUP_LABEL, LEVEL_NAME, NEA_ADVICE, REGIONS, psiLevel, type Group, type Level, type Region } from "./bands";
import type { HazeData, NewsItem } from "./types";

export type AlertState = { psiLevel: number | null; neaUrl: string | null };

/** Highest 24-hr PSI across regions, and where; null when no region has a reading. */
export function islandMax(psi24: Record<Region, number>): { psi: number; region: Region } | null {
  const valid = REGIONS.filter((r) => Number.isFinite(psi24[r]));
  if (!valid.length) return null;
  const region = valid.reduce((a, b) => (psi24[b] > psi24[a] ? b : a));
  return { psi: psi24[region], region };
}

export const latestNea = (news: NewsItem[]) => news.find((n) => n.source === "NEA");

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Band-change message: headline, one NEA advice line per group, site link. */
export function psiMessage(level: Level, psi: number, region: Region, site: string): string {
  const groups = (Object.keys(NEA_ADVICE) as Group[]).map((g) => `${GROUP_LABEL[g]}: ${NEA_ADVICE[g][level]}`);
  return [`24-hr PSI is now ${LEVEL_NAME[level]}: ${psi} (${cap(region)}).`, ...groups, site].join("\n");
}

export const neaMessage = (n: NewsItem) => `NEA: ${n.title}\n${n.summary}\n${n.url}`;

/** Messages to send and the next state. Null state means first run: record only. */
export function plan(data: HazeData, prev: AlertState | null, site: string): { messages: string[]; next: AlertState } | null {
  const top = data.nea && islandMax(data.nea.psi24);
  if (!top) return null;
  const { psi, region } = top;
  const level = psiLevel(psi);
  const nea = latestNea(data.news);
  const next: AlertState = { psiLevel: level, neaUrl: nea?.url ?? prev?.neaUrl ?? null };
  const messages: string[] = [];
  if (prev) {
    if (prev.psiLevel != null && prev.psiLevel !== level) messages.push(psiMessage(level, psi, region, site));
    if (nea && nea.url !== prev.neaUrl) messages.push(neaMessage(nea));
  }
  return { messages, next };
}
