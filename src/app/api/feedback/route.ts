// Feedback from the site, sent privately to the owner: by email through Resend when RESEND_API_KEY and
// FEEDBACK_EMAIL are set, otherwise to Telegram with TELEGRAM_BOT_TOKEN and FEEDBACK_CHAT_ID (the owner's own
// chat with the bot, not the channel).

import { clientIp, createLimiter } from "@/lib/rateLimit";
import { sendText } from "@/lib/telegram";

const MAX_MESSAGE = 2000;
const MAX_CONTACT = 200;
const WINDOW_MS = 10 * 60_000;
const PER_WINDOW = 5;

const limited = createLimiter(WINDOW_MS, PER_WINDOW);

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Plain-text email via Resend; Reply goes to the visitor when they left an email address. Throws when Resend refuses. */
async function byEmail(key: string, to: string, body: string, contact: string) {
  const res = await fetch("https://api.resend.com/emails", {
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
  if (!res.ok) throw new Error(`Resend ${res.status}`);
}

export async function POST(req: Request) {
  const { RESEND_API_KEY: key, FEEDBACK_EMAIL: to, TELEGRAM_BOT_TOKEN: token, FEEDBACK_CHAT_ID: chat } = process.env;
  const send =
    key && to
      ? (body: string, contact: string) => byEmail(key, to, body, contact)
      : token && chat
        ? (body: string) => sendText(chat, body)
        : null;
  if (!send) return Response.json({ error: "Feedback is not set up" }, { status: 503 });

  const input = await req.json().catch(() => null);
  // Bots fill the hidden "website" field; pretend it worked.
  if (input?.website) return Response.json({ ok: true });
  const message = text(input?.message, MAX_MESSAGE);
  const contact = text(input?.contact, MAX_CONTACT);
  const page = text(input?.page, 100);
  if (message.length < 3) return Response.json({ error: "Please write a little more" }, { status: 400 });
  if (limited(clientIp(req))) {
    return Response.json({ error: "Too many messages, try again later" }, { status: 429 });
  }

  const head = ["Haze Lah feedback", page && `Page: ${page}`, contact && `Contact: ${contact}`].filter(Boolean).join("\n");
  const body = `${head}\n\n${message}`;
  try {
    await send(body, contact);
  } catch (e) {
    console.error("[haze] feedback: send failed", e);
    return Response.json({ error: "Could not send right now" }, { status: 502 });
  }
  return Response.json({ ok: true });
}
