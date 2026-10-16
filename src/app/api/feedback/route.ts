// Feedback from the site, sent privately to the owner's Telegram chat by the alerts bot.
// Needs TELEGRAM_BOT_TOKEN and FEEDBACK_CHAT_ID (the owner's own chat with the bot, not the channel).

const MAX_MESSAGE = 2000;
const MAX_CONTACT = 200;
const WINDOW_MS = 10 * 60_000;
const PER_WINDOW = 5;

// Per-instance limit: enough to stop one person flooding the chat, not a hard guarantee.
const recent = new Map<string, number[]>();

function limited(ip: string, now = Date.now()) {
  const times = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  times.push(now);
  recent.set(ip, times);
  return times.length > PER_WINDOW;
}

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.FEEDBACK_CHAT_ID;
  if (!token || !chat) return Response.json({ error: "Feedback is not set up" }, { status: 503 });

  const body = await req.json().catch(() => null);
  // Bots fill the hidden "website" field; pretend it worked.
  if (body?.website) return Response.json({ ok: true });
  const message = text(body?.message, MAX_MESSAGE);
  const contact = text(body?.contact, MAX_CONTACT);
  const page = text(body?.page, 100);
  if (message.length < 3) return Response.json({ error: "Please write a little more" }, { status: 400 });
  if (limited(req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown")) {
    return Response.json({ error: "Too many messages, try again later" }, { status: 429 });
  }

  // Plain text (no parse mode), so nothing in the message is interpreted as formatting or links.
  const lines = ["Haze Lah feedback", page && `Page: ${page}`, contact && `Contact: ${contact}`, "", message].filter((l) => l !== "");
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text: lines.join("\n"), disable_web_page_preview: true }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!res?.ok) {
    console.error("[haze] feedback: Telegram", res?.status);
    return Response.json({ error: "Could not send right now" }, { status: 502 });
  }
  return Response.json({ ok: true });
}
