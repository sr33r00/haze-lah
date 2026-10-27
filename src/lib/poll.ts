import { sgDate, sgHour } from "./util";

/** The polls the site runs: each id with the votes it accepts. A vote is stored as its own tiny object, so counting needs no read-modify-write. */
export const POLLS = { "clean-alert": ["yes", "no"] } as const;
export type PollId = keyof typeof POLLS;
export type PollVote = (typeof POLLS)[PollId][number];

/** The "Tell me when it's clean" poll: would the visitor use an opt-in Telegram alert for their area. */
export const CLEAN_ALERT: PollId = "clean-alert";

/** A vote from a request body, or null unless the poll and the vote are both known. */
export function parseVote(input: unknown): { poll: PollId; vote: PollVote } | null {
  if (typeof input !== "object" || input === null) return null;
  const { poll, vote } = input as Record<string, unknown>;
  if (typeof poll !== "string" || !Object.hasOwn(POLLS, poll)) return null;
  const votes: readonly string[] = POLLS[poll as PollId];
  return typeof vote === "string" && votes.includes(vote) ? { poll: poll as PollId, vote: vote as PollVote } : null;
}

/** The bucket prefix holding every vote of one kind: count the keys under it. */
export const votePrefix = (poll: PollId, vote: PollVote) => `poll/${poll}/${vote}/`;

/** Where one vote is stored: its time and a random suffix keep keys unique. Nothing about the voter is kept. */
export const voteKey = (poll: PollId, vote: PollVote, at: Date, unique: string) => `${votePrefix(poll, vote)}${at.toISOString()}-${unique}.json`;

/** What each poll is called in the owner's daily tally. */
const TITLES: Record<PollId, string> = { "clean-alert": "Telegram alert when the air turns clean" };

/** Votes per answer for one poll. */
export type PollCounts = Record<PollVote, number>;

/** The daily tally's memory (`poll/tally-state.json`): the SGT day of the last message and the counts it reported. */
export type TallyState = { date: string; counts: Record<PollId, PollCounts> };

/** The tally goes out at the first run from this Singapore hour. */
export const TALLY_HOUR = 8;

/** Whether the tally may go out at `now`: from 08:00 SGT, and not yet sent on this SGT day. */
export const tallyDue = (state: TallyState | null, now = new Date()) => sgHour(now) >= TALLY_HOUR && state?.date !== sgDate(0, now);

/**
 * The tally message for `counts`, or null when nothing changed since `state` (no votes at all counts as unchanged).
 * Each answer shows its rise since the last message as "(+3)"; the first message has no rises.
 */
export function tallyMessage(counts: Record<PollId, PollCounts>, state: TallyState | null): string | null {
  const blocks: string[] = [];
  for (const id of Object.keys(POLLS) as PollId[]) {
    const now = counts[id];
    const before = state?.counts[id];
    const total = (c: PollCounts) => POLLS[id].reduce((sum, vote) => sum + c[vote], 0);
    if (POLLS[id].every((vote) => now[vote] === (before?.[vote] ?? 0))) continue;
    const rows = POLLS[id].map((vote) => {
      const rise = before ? now[vote] - before[vote] : 0;
      return `${vote[0].toUpperCase()}${vote.slice(1)} ${now[vote]}${rise > 0 ? ` (+${rise})` : ""}`;
    });
    blocks.push([`Haze Lah poll: ${TITLES[id]}`, ...rows, `Total ${total(now)}`].join("\n"));
  }
  return blocks.length ? blocks.join("\n\n") : null;
}
