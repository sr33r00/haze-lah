import assert from "node:assert/strict";
import { test } from "node:test";
import { CHECK_CRON, JOB_CRONS, SCHEDULES, jobForCron } from "./schedule.ts";

test("each job schedule starts its job; the NEA check and unknown schedules start none", () => {
  assert.equal(jobForCron("40 * * * *"), "hourly");
  assert.equal(jobForCron("30 17 * * *"), "history");
  assert.equal(jobForCron("45 17 * * *"), "readings");
  assert.equal(jobForCron(CHECK_CRON), null);
  assert.equal(jobForCron("toString"), null);
});

test("the Worker has the NEA check and every job schedule once", () => {
  assert.deepEqual(SCHEDULES, [CHECK_CRON, ...Object.keys(JOB_CRONS)]);
  assert.equal(new Set(SCHEDULES).size, SCHEDULES.length);
});
