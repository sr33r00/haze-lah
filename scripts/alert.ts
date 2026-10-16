// Sends haze alerts to a Telegram channel: a card image plus a short caption.
// Run every 10 minutes by .github/workflows/alerts.yml; posts at least once per new NEA hourly reading. State lives in data/alert-state.json.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { caption, detect, quietHours, type AlertState, type Triggers } from "../src/lib/alerts";
import { SITE_URL } from "../src/lib/links";
import type { HazeData } from "../src/lib/types";

const STATE = process.env.ALERT_STATE || "data/alert-state.json";
const JSON_URL = process.env.HAZE_JSON_URL || `${SITE_URL}/api/haze`;
const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: chat } = process.env;

async function tg(method: string, body: object) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, ...body }),
  });
  if (!res.ok) throw new Error(`Telegram ${method} ${res.status}: ${(await res.text()).replaceAll(token!, "***")}`);
}

/** The card as a photo; if Telegram cannot fetch it, the caption alone. Silent at night. */
async function send(text: string) {
  const disable_notification = quietHours();
  try {
    await tg("sendPhoto", { photo: `${SITE_URL}/alert-card?t=${Date.now()}`, caption: text, disable_notification });
  } catch (e) {
    console.warn("alerts: sendPhoto failed, sending text:", (e as Error).message);
    await tg("sendMessage", { text, disable_web_page_preview: true, disable_notification });
  }
}

async function load(): Promise<HazeData> {
  const res = await fetch(JSON_URL, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`${JSON_URL} ${res.status}`);
  return res.json();
}

/** ALERT_TEST=1: post the full format once to prove the bot and channel work; state is left alone. */
async function test(data: HazeData) {
  if (!token || !chat) throw new Error("Telegram not configured: add the TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID secrets");
  const all: Triggers = { psi: true, pm25: null, nea: null, news: null, brief: false, outlook: false, hourly: false };
  if (!data.nea) return send(`Test: Haze Lah alerts are connected.\n${SITE_URL}`);
  await send(`Test: alerts are connected\n${caption(data, all, SITE_URL)}`);
  console.log("alerts: test alert sent");
}

async function main() {
  const data = await load();
  if (process.env.ALERT_TEST === "1") return test(data);
  const prev: AlertState | null = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : null;
  const d = detect(data, prev);
  if (!d) return console.log("alerts: NEA unavailable, state kept");
  const { fired } = d;
  const any = fired.psi || fired.pm25 != null || fired.nea || fired.news || fired.brief || fired.outlook || fired.hourly;
  if (any) {
    const text = caption(data, fired, SITE_URL);
    if (token && chat) await send(text);
    else console.log(`alerts: Telegram not configured, would send:\n${text}`);
  }
  writeFileSync(STATE, JSON.stringify(d.next, null, 2) + "\n");
  console.log(`alerts: ${any ? "sent 1 post" : "nothing to send"}, PSI level ${d.next.psiLevel}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
