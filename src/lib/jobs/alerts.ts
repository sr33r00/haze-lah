import { caption, detect, quietHours, type AlertState, type Triggers } from "../alerts";
import { getHazeData } from "../data";
import { readJsonStrict, writeJson } from "../dataStore";
import { SITE_URL } from "../links";

const STATE = "alert-state.json";

/** What the alerts step did: `sent` is how many posts went out. */
export type AlertsResult = { sent: number; psiLevel: number | null; note?: string };

async function tg(method: string, body: object) {
  const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: chat } = process.env;
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, ...body }),
    signal: AbortSignal.timeout(20_000),
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

const configured = () => Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);

/**
 * Sends haze alerts to the Telegram channel: a card image plus a short caption, one post per new NEA reading (and per event).
 * The state in `alert-state.json` records what was sent, so a second run for the same reading sends nothing. With `test`, posts the
 * full format once to prove the bot and channel work, and leaves the state alone. Throws when Telegram fails (the state is then not saved).
 */
export async function sendAlerts(test = false): Promise<AlertsResult> {
  const data = await getHazeData();
  if (test) {
    if (!configured()) throw new Error("Telegram not configured: add the TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID secrets");
    const all: Triggers = { psi: true, pm25: null, nea: null, news: null, brief: false, outlook: false, hourly: false };
    await send(data.nea ? `Test: alerts are connected\n${caption(data, all, SITE_URL)}` : `Test: Haze Lah alerts are connected.\n${SITE_URL}`);
    return { sent: 1, psiLevel: null, note: "test alert" };
  }
  const d = detect(data, await readJsonStrict<AlertState>(STATE));
  if (!d) return { sent: 0, psiLevel: null, note: "NEA unavailable, state kept" };
  const { fired } = d;
  const any = fired.psi || fired.pm25 != null || fired.nea || fired.news || fired.brief || fired.outlook || fired.hourly;
  let note: string | undefined;
  if (any) {
    const text = caption(data, fired, SITE_URL);
    if (configured()) await send(text);
    else note = `Telegram not configured, would send:\n${text}`;
  }
  await writeJson(STATE, d.next);
  return { sent: any && !note ? 1 : 0, psiLevel: d.next.psiLevel, ...(note && { note }) };
}
