import { hasStore, writeJson } from "@/lib/dataStore";
import { CLEAN_ALERT, POLLS, parseVote, voteKey, type PollId } from "@/lib/poll";
import { countVotes } from "@/lib/pollStore";
import { clientIp, createLimiter } from "@/lib/rateLimit";
import { NO_STORE, refuse } from "@/lib/routeAuth";

/**
 * Anonymous yes/no polls. POST `{ poll, vote }` stores the vote as its own tiny object (`poll/<poll>/<vote>/<time>-<random>.json`,
 * holding only the time and the vote: no IP, no user agent). GET `?poll=<id>` with the jobs' bearer returns `{ poll, yes, no }`.
 */
export const dynamic = "force-dynamic";

const limited = createLimiter(10 * 60_000, 10);

export async function POST(req: Request) {
  const input = await req.json().catch(() => null);
  // Bots fill the hidden "website" field; pretend it worked.
  if (input?.website) return Response.json({ ok: true });
  const parsed = parseVote(input);
  if (!parsed) return Response.json({ error: "Unknown poll or vote" }, { status: 400 });
  if (limited(clientIp(req))) return Response.json({ error: "Too many votes, try again later" }, { status: 429 });
  // Demo and local runs without the bucket count nothing.
  if (process.env.HAZE_MOCK === "1" || !hasStore()) return Response.json({ ok: true });

  const at = new Date();
  try {
    await writeJson(voteKey(parsed.poll, parsed.vote, at, crypto.randomUUID()), { t: at.toISOString(), vote: parsed.vote });
  } catch (e) {
    console.error("[haze] poll: write failed", e);
    return Response.json({ error: "Could not save right now" }, { status: 502 });
  }
  return Response.json({ ok: true });
}

export async function GET(req: Request) {
  const denied = refuse(req);
  if (denied) return denied;
  const poll = new URL(req.url).searchParams.get("poll") ?? CLEAN_ALERT;
  if (!Object.hasOwn(POLLS, poll)) return Response.json({ error: "Unknown poll" }, { status: 400, headers: NO_STORE });
  if (!hasStore()) return Response.json({ error: "No data bucket" }, { status: 503, headers: NO_STORE });
  return Response.json({ poll, ...(await countVotes(poll as PollId)) }, { headers: NO_STORE });
}
