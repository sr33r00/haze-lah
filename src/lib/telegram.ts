/**
 * One Telegram Bot API call as the site's bot (`TELEGRAM_BOT_TOKEN`) to `chat`: the public alerts channel (`TELEGRAM_CHAT_ID`)
 * or the owner's private chat (`FEEDBACK_CHAT_ID`). Throws when Telegram refuses; the token never appears in the error.
 */
export async function telegram(method: string, chat: string, body: object): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("Telegram not configured: add the TELEGRAM_BOT_TOKEN secret");
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, ...body }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Telegram ${method} ${res.status}: ${(await res.text()).replaceAll(token, "***")}`);
}

/** Plain text (no parse mode), so nothing in the message is read as formatting or links. */
export const sendText = (chat: string, text: string, extra: object = {}) => telegram("sendMessage", chat, { text, disable_web_page_preview: true, ...extra });
