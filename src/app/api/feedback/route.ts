// Feedback from the site, sent privately to the owner: by email through Resend when RESEND_API_KEY and
// FEEDBACK_EMAIL are set, otherwise to Telegram with TELEGRAM_BOT_TOKEN and FEEDBACK_CHAT_ID (the owner's own
// chat with the bot, not the channel).

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
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Plain-text email via Resend; Reply goes to the visitor when they left an email address. */
function byEmail(key: string, to: string, body: string, contact: string) {
  return fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Haze Lah <onboarding@resend.dev>",
      to: [to],
      subject: "Haze Lah feedback",
      text: body,
      ...(EMAIL.test(contact) && { reply_to: contact }),
    }),
    signal: AbortSignal.timeout(10_000),
  });
}

/** Plain text (no parse mode), so nothing in the message is read as formatting or links. */
function byTelegram(token: string, chat: string, body: string) {
  return fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text: body, disable_web_page_preview: true }),
    signal: AbortSignal.timeout(10_000),
  });
}

export async function POST(req: Request) {
  const { RESEND_API_KEY: key, FEEDBACK_EMAIL: to, TELEGRAM_BOT_TOKEN: token, FEEDBACK_CHAT_ID: chat } = process.env;
  const send =
    key && to
      ? (body: string, contact: string) => byEmail(key, to, body, contact)
      : token && chat
        ? (body: string) => byTelegram(token, chat, body)
        : null;
  if (!send) return Response.json({ error: "Feedback is not set up" }, { status: 503 });

  const input = await req.json().catch(() => null);
  // Bots fill the hidden "website" field; pretend it worked.
  if (input?.website) return Response.json({ ok: true });
  const message = text(input?.message, MAX_MESSAGE);
  const contact = text(input?.contact, MAX_CONTACT);
  const page = text(input?.page, 100);
  if (message.length < 3) return Response.json({ error: "Please write a little more" }, { status: 400 });
  if (limited(req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown")) {
    return Response.json({ error: "Too many messages, try again later" }, { status: 429 });
  }

  const head = ["Haze Lah feedback", page && `Page: ${page}`, contact && `Contact: ${contact}`].filter(Boolean).join("\n");
  const body = `${head}\n\n${message}`;
  const res = await send(body, contact).catch(() => null);
  if (!res?.ok) {
    console.error("[haze] feedback: send failed", res?.status);
    return Response.json({ error: "Could not send right now" }, { status: 502 });
  }
  return Response.json({ ok: true });
}
