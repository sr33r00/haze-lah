import assert from "node:assert/strict";
import { test } from "node:test";
import { hazeSpell } from "@/lib/situation";

const TODAY = "2026-10-24";
const days = (from: string, to: string, v: number): [string, number][] => {
  const out: [string, number][] = [];
  for (let t = Date.parse(from); t <= Date.parse(to); t += 86400_000) out.push([new Date(t).toISOString().slice(0, 10), v]);
  return out;
};
const spell = (entries: [string, number][]) => hazeSpell(new Map(entries), TODAY).spell;

test("hazeSpell counts every day from the first unhealthy day to today, not capped at a week", () => {
  assert.deepEqual(spell([...days("2026-09-20", "2026-10-02", 80), ...days("2026-10-03", TODAY, 120)]), { days: 22, since: "2026-10-03" });
});

test("hazeSpell runs through up to two clear days and ends at three", () => {
  // NEA's peaks: 26-30 Sep unhealthy, 1-2 Oct at 96 and 91, then unhealthy to today; 21-25 Sep clear.
  const sep = [...days("2026-09-21", "2026-09-25", 84), ...days("2026-09-26", "2026-09-30", 130), ["2026-10-01", 96], ["2026-10-02", 91]] as [string, number][];
  assert.deepEqual(spell([...sep, ...days("2026-10-03", TODAY, 120)]), { days: 29, since: "2026-09-26" });
  const three = [...days("2026-09-26", "2026-09-30", 130), ...days("2026-10-01", "2026-10-03", 95), ...days("2026-10-04", TODAY, 120)];
  assert.deepEqual(spell(three), { days: 21, since: "2026-10-04" });
});

test("hazeSpell keeps a spell going through clear days at its end, and ends after three", () => {
  assert.deepEqual(spell([...days("2026-10-20", "2026-10-22", 140), ["2026-10-23", 90], [TODAY, 95]]), { days: 5, since: "2026-10-20" });
  assert.equal(spell([...days("2026-10-18", "2026-10-21", 140), ...days("2026-10-22", TODAY, 90)]), null);
});

test("hazeSpell stops at a missing day and names it, so it can be filled", () => {
  const map = new Map([...days("2026-10-14", TODAY, 120), ["2026-10-12", 110]] as [string, number][]);
  assert.deepEqual(hazeSpell(map, TODAY), { spell: { days: 11, since: "2026-10-14" }, missing: "2026-10-13" });
  map.set("2026-10-13", 174);
  assert.equal(hazeSpell(map, TODAY).spell?.since, "2026-10-12");
});

test("hazeSpell counts from yesterday while today has no reading yet", () => {
  assert.deepEqual(spell(days("2026-10-22", "2026-10-23", 120)), { days: 3, since: "2026-10-22" });
  assert.equal(spell([]), null);
});
