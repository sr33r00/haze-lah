// Sends haze alerts to a Telegram channel on a 24-hr PSI band change or a new NEA haze update.
// Run hourly by .github/workflows/archive.yml. State lives in data/alert-state.json.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { getHazeData } from "../src/lib/data";
import { islandMax, plan, psiMessage, type AlertState } from "../src/lib/alerts";
import { psiLevel } from "../src/lib/bands";
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

/** ALERT_TEST=1: post the current situation once to prove the bot and channel work; state is left alone. */
async function test() {
  if (!token || !chat) throw new Error("Telegram not configured: add the TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID secrets");
  const data = await getHazeData();
  const top = data.nea && islandMax(data.nea.psi24);
  const now = top ? psiMessage(psiLevel(top.psi), top.psi, top.region, SITE_URL) : SITE_URL;
  await send(`Test: Haze Lah alerts are connected.\n\n${now}`);
  console.log("alerts: test message sent");
}

async function main() {
  if (process.env.ALERT_TEST === "1") return test();
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
