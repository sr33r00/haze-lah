import assert from "node:assert/strict";
import { test } from "node:test";
import { fireDayAt, frameAt, originSteps } from "@/lib/originSteps";
import type { Replay, SmokeGrid } from "@/lib/types";

const day = (arrival: string) => ({ arrival }) as Replay["days"][number];
const replay = { lats: [], lons: [], days: [day("2026-10-20T06:00:00Z"), day("2026-10-21T06:00:00Z"), day("2026-10-22T06:00:00Z")] } as Replay;
const smoke = { times: ["2026-10-22T05:00:00Z", "2026-10-22T08:00:00Z", "2026-10-22T11:00:00Z"] } as SmokeGrid;

test("frameAt finds the step within half a step, else null", () => {
  assert.equal(frameAt(smoke, "2026-10-22T06:30:00Z"), 0);
  assert.equal(frameAt(smoke, "2026-10-22T07:00:00Z"), 1);
  assert.equal(frameAt(smoke, "2026-10-20T06:00:00Z"), null);
  assert.equal(frameAt(null, "2026-10-22T06:00:00Z"), null);
});

test("the steps are the earlier replay days, then now and the grid's steps; the newest day is today's", () => {
  const steps = originSteps(replay, smoke);
  assert.deepEqual(steps.map((s) => s.kind), ["past", "past", "now", "ahead", "ahead"]);
  assert.deepEqual(steps.map((s) => s.day), [0, 1, 2, 2, 2]);
  assert.deepEqual(steps.map((s) => s.frame), [null, null, 0, 1, 2]);
});

test("a past step has no frame of the live grid, even where its times would match", () => {
  const old = { times: ["2026-10-21T05:00:00Z", "2026-10-21T08:00:00Z"] } as SmokeGrid;
  assert.equal(originSteps(replay, old)[1].frame, null);
});

test("fireDayAt falls back to the newest day with 20 fires for now, never for a past step", () => {
  const fires = (n: number) => ({ fires: Array.from({ length: n }) });
  const days = [fires(400), fires(30), fires(0)]; // the newest day has had no fire pass yet
  assert.equal(fireDayAt(days, 2, false), 1);
  assert.equal(fireDayAt(days, 1, false), 1);
  assert.equal(fireDayAt(days, 2, true), 2);
  assert.equal(fireDayAt([fires(3)], 0, false), 0); // nothing better: its own
});

test("without the grid there is just now", () => {
  const steps = originSteps(replay, null, Date.parse("2026-10-22T07:00:00Z"));
  assert.deepEqual(steps.map((s) => [s.kind, s.t, s.frame]), [["past", "2026-10-20T06:00:00Z", null], ["past", "2026-10-21T06:00:00Z", null], ["now", "2026-10-22T07:00:00.000Z", null]]);
});
