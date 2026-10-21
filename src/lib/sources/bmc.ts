import type { Supporters } from "../types";
import { getJson } from "../util";

// Buy Me a Coffee one-time supporters: GET /api/v1/supporters, bearer token, Laravel-style pages
// (`data`, `current_page`, `last_page`). Server only: BMC does not allow browser requests, and the token must stay secret.
// Privacy: the rows also hold emails and payer names. This file reads only the five fields in `Row`; nothing else is kept.

const API = "https://developers.buymeacoffee.com/api/v1/supporters";
const TTL = 10_800; // 3 hours
const MAX_PAGES = 20; // the API serves 5 supports a page, so up to 100 supports
const MAX_NAME = 24;

/**
 * Support ids whose names are not shown (for example an abusive name). They count as anonymous.
 * Find the id in the Buy Me a Coffee dashboard, or in the API response (`support_id`).
 */
export const HIDDEN_SUPPORTERS: number[] = [];

type Row = {
  support_id: number;
  supporter_name: string | null; // the name the supporter chose; BMC fills "Someone" when they leave it empty
  support_visibility: number | string | null; // 1 = public
  support_created_on: string; // "2020-08-05 09:38:26"
  is_refunded: unknown; // null, or truthy when refunded
};
type Page = { data: Row[]; last_page: number };

/** The name as typed: spaces collapsed, cut to 24 characters with an ellipsis. Null when empty or BMC's "Someone". */
function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.replace(/\s+/g, " ").trim();
  if (!name || name.toLowerCase() === "someone") return null;
  const chars = Array.from(name);
  return chars.length > MAX_NAME ? `${chars.slice(0, MAX_NAME - 1).join("").trimEnd()}…` : name;
}

/** Supporters for the thank-you lines; null without a token or when BMC fails. Counts only the newest pages. */
export async function fetchSupporters(): Promise<Supporters | null> {
  const token = process.env.BMC_ACCESS_TOKEN;
  if (!token) return null;
  try {
    const get = (page: number) => getJson<Page>(`${API}?page=${page}`, { headers: { Authorization: `Bearer ${token}` }, revalidate: TTL });
    const first = await get(1);
    const more = await Promise.all(Array.from({ length: Math.min(first.last_page, MAX_PAGES) - 1 }, (_, i) => get(i + 2)));
    const rows = [first, ...more]
      .flatMap((p) => p.data)
      .filter((r) => !r.is_refunded)
      .sort((a, b) => b.support_created_on.localeCompare(a.support_created_on) || b.support_id - a.support_id);

    const names: string[] = [];
    let anonymous = 0;
    for (const r of rows) {
      const name = Number(r.support_visibility) === 1 && !HIDDEN_SUPPORTERS.includes(r.support_id) ? cleanName(r.supporter_name) : null;
      if (!name) anonymous++;
      else if (!names.some((n) => n.toLowerCase() === name.toLowerCase())) names.push(name);
    }
    return { names, anonymous, total: names.length + anonymous };
  } catch (e) {
    // The error holds the host and status only, never the token.
    console.error("[haze] Buy Me a Coffee supporters:", e instanceof Error ? e.message : "failed");
    return null;
  }
}
