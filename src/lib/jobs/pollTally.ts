import { hasStore, readJsonStrict, writeJson } from "../dataStore";
import { POLLS, tallyDue, tallyMessage, type PollCounts, type PollId, type TallyState } from "../poll";
import { countVotes } from "../pollStore";
import { sendText } from "../telegram";
import { sgDate } from "../util";

const STATE = "poll/tally-state.json";

/** What the poll tally step did: `sent` is 1 when the message went out. */
export type PollTallyResult = { sent: number; note?: string };

/**
 * Tells the owner the poll counts, privately: a plain message to the feedback chat (`FEEDBACK_CHAT_ID`, not the public alerts
 * channel) at the first hourly run from 08:00 SGT, at most once a day and only when the counts changed since the last message.
 * `poll/tally-state.json` is saved only after Telegram accepted the message. Skips quietly without the chat, the token or the bucket.
 */
export async function sendPollTally(now = new Date()): Promise<PollTallyResult> {
  const chat = process.env.FEEDBACK_CHAT_ID;
  if (process.env.HAZE_MOCK === "1" || !chat || !process.env.TELEGRAM_BOT_TOKEN || !hasStore()) return { sent: 0, note: "poll tally not configured, skipped" };
  const state = await readJsonStrict<TallyState>(STATE);
  if (!tallyDue(state, now)) return { sent: 0, note: "not due" };
  const ids = Object.keys(POLLS) as PollId[];
  const counts = Object.fromEntries(await Promise.all(ids.map(async (id) => [id, await countVotes(id)] as const))) as Record<PollId, PollCounts>;
  const text = tallyMessage(counts, state);
  if (!text) return { sent: 0, note: "no new votes" };
  await sendText(chat, text);
  await writeJson(STATE, { date: sgDate(0, now), counts } satisfies TallyState);
  return { sent: 1 };
}
