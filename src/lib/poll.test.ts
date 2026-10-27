import assert from "node:assert/strict";
import { test } from "node:test";
import { CLEAN_ALERT, parseVote, tallyDue, tallyMessage, voteKey, votePrefix, type TallyState } from "@/lib/poll";

test("accepts only known polls with their own votes", () => {
  assert.deepEqual(parseVote({ poll: "clean-alert", vote: "yes" }), { poll: "clean-alert", vote: "yes" });
  assert.deepEqual(parseVote({ poll: "clean-alert", vote: "no", website: "" }), { poll: "clean-alert", vote: "no" });
});

test("rejects anything else", () => {
  for (const bad of [null, undefined, "yes", 1, [], {}, { poll: "clean-alert" }, { vote: "yes" }, { poll: "clean-alert", vote: "maybe" }, { poll: "clean-alert", vote: 1 }, { poll: "other", vote: "yes" }, { poll: "toString", vote: "yes" }, { poll: "__proto__", vote: "yes" }]) {
    assert.equal(parseVote(bad), null, JSON.stringify(bad));
  }
});

test("a vote's key sits under its prefix and holds only the time and a suffix", () => {
  const key = voteKey(CLEAN_ALERT, "yes", new Date("2026-10-27T01:02:03.000Z"), "abc");
  assert.equal(key, "poll/clean-alert/yes/2026-10-27T01:02:03.000Z-abc.json");
  assert.ok(key.startsWith(votePrefix(CLEAN_ALERT, "yes")));
  assert.ok(!key.startsWith(votePrefix(CLEAN_ALERT, "no")));
});

const state = (date: string, yes: number, no: number): TallyState => ({ date, counts: { "clean-alert": { yes, no } } });

test("the tally is due from 08:00 SGT, once per SGT day", () => {
  assert.equal(tallyDue(null, new Date("2026-10-26T23:59:00Z")), false); // 07:59 SGT
  assert.equal(tallyDue(null, new Date("2026-10-27T00:00:00Z")), true); // 08:00 SGT
  assert.equal(tallyDue(state("2026-10-27", 1, 1), new Date("2026-10-27T05:00:00Z")), false);
  assert.equal(tallyDue(state("2026-10-26", 1, 1), new Date("2026-10-27T05:00:00Z")), true);
  // 00:30 SGT on the 28th is still before 08:00 even though yesterday's message is a day old.
  assert.equal(tallyDue(state("2026-10-27", 1, 1), new Date("2026-10-27T16:30:00Z")), false);
});

test("the first tally has no rises", () => {
  assert.equal(
    tallyMessage({ "clean-alert": { yes: 12, no: 4 } }, null),
    "Haze Lah poll: Telegram alert when the air turns clean\nYes 12\nNo 4\nTotal 16",
  );
});

test("later tallies show the rise since the last message and omit zero rises", () => {
  assert.equal(
    tallyMessage({ "clean-alert": { yes: 12, no: 4 } }, state("2026-10-26", 9, 3)),
    "Haze Lah poll: Telegram alert when the air turns clean\nYes 12 (+3)\nNo 4 (+1)\nTotal 16",
  );
  assert.equal(
    tallyMessage({ "clean-alert": { yes: 12, no: 4 } }, state("2026-10-26", 12, 3)),
    "Haze Lah poll: Telegram alert when the air turns clean\nYes 12\nNo 4 (+1)\nTotal 16",
  );
});

test("no message when nothing changed or nobody has voted", () => {
  assert.equal(tallyMessage({ "clean-alert": { yes: 12, no: 4 } }, state("2026-10-26", 12, 4)), null);
  assert.equal(tallyMessage({ "clean-alert": { yes: 0, no: 0 } }, null), null);
});
