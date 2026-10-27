import { listKeys } from "./dataStore";
import { POLLS, votePrefix, type PollCounts, type PollId } from "./poll";

/** The votes cast so far in a poll: one stored object per vote, so counting is listing the keys under each answer. Server only. */
export async function countVotes(id: PollId): Promise<PollCounts> {
  const entries = await Promise.all(POLLS[id].map(async (vote) => [vote, (await listKeys(votePrefix(id, vote))).length] as const));
  return Object.fromEntries(entries) as PollCounts;
}
