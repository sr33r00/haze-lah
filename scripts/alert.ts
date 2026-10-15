// Sends haze alerts to a Telegram channel on a 24-hr PSI band change or a new NEA haze update.
// Run hourly by .github/workflows/archive.yml. State lives in data/alert-state.json.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { getHazeData } from "../src/lib/data";
import { plan, type AlertState } from "../src/lib/alerts";
import { SITE_URL } from "../src/lib/links";

const STATE = process.env.ALERT_STATE || "data/alert-state.json";
const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: chat } = process.env;

async function send(text: string) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
  });
  if (!res.ok) throw new Error(`Telegram ${res.status}: ${(await res.text()).replace(token!, "***")}`);
}

async function main() {
  const prev: AlertState | null = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : null;
  const p = plan(await getHazeData(), prev, SITE_URL);
  if (!p) return console.log("alerts: NEA unavailable, state kept");
  if (token && chat) for (const m of p.messages) await send(m);
  else console.log("alerts: Telegram not configured");
  writeFileSync(STATE, JSON.stringify(p.next, null, 2) + "\n");
  console.log(`alerts: ${p.messages.length} message(s), PSI level ${p.next.psiLevel}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
