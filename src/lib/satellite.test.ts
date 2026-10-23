import assert from "node:assert/strict";
import { test } from "node:test";
import { himawariTimes, himawariUrl, isDaylight, onImage, visibleTimes } from "@/lib/satellite";

test("himawariTimes: 10-minute steps, the newest an hour or more before now, oldest first", () => {
  const times = himawariTimes(Date.parse("2026-10-23T12:07:30Z"), 18);
  assert.equal(times.length, 18);
  assert.equal(times.at(-1), "2026-10-23T11:00:00Z");
  assert.equal(times[0], "2026-10-23T08:10:00Z");
  assert.ok(Date.parse(times.at(-1)!) <= Date.parse("2026-10-23T12:07:30Z") - 3600_000);
});

test("himawariTimes crosses midnight", () => {
  const times = himawariTimes(Date.parse("2026-10-24T01:10:00Z"), 3);
  assert.deepEqual(times, ["2026-10-23T23:50:00Z", "2026-10-24T00:00:00Z", "2026-10-24T00:10:00Z"]);
});

test("himawariUrl asks for the layer with coastlines at the time", () => {
  const q = new URL(himawariUrl("2026-10-23T11:00:00Z")).searchParams;
  assert.equal(q.get("LAYERS"), "Himawari_AHI_Band3_Red_Visible_1km,Coastlines_15m");
  assert.equal(q.get("TIME"), "2026-10-23T11:00:00Z");
  assert.equal(q.get("BBOX"), "-6,95,7,120");
  assert.equal(q.get("WIDTH"), "1000");
});

test("onImage puts Singapore left of centre and above the middle", () => {
  const p = onImage(1.35, 103.82);
  assert.ok(p.x > 30 && p.x < 40 && p.y > 40 && p.y < 46);
});

test("isDaylight runs from 07:30 to 18:30 Singapore time", () => {
  assert.equal(isDaylight("2026-10-23T23:20:00Z"), false); // 07:20 SGT
  assert.equal(isDaylight("2026-10-23T23:30:00Z"), true); // 07:30 SGT
  assert.equal(isDaylight("2026-10-23T05:00:00Z"), true); // 13:00 SGT
  assert.equal(isDaylight("2026-10-23T10:30:00Z"), true); // 18:30 SGT
  assert.equal(isDaylight("2026-10-23T10:40:00Z"), false); // 18:40 SGT
  assert.equal(isDaylight("2026-10-23T17:00:00Z"), false); // 01:00 SGT
});

test("visibleTimes: by day it is the last 3 hours", () => {
  const { times, night } = visibleTimes(Date.parse("2026-10-23T08:05:00Z")); // 16:05 SGT; newest picture 15:00 SGT
  assert.equal(night, false);
  assert.equal(times.length, 19);
  assert.equal(times.at(-1), "2026-10-23T07:00:00Z");
});

test("visibleTimes: just after sunrise it keeps only the daylight pictures", () => {
  const { times, night } = visibleTimes(Date.parse("2026-10-24T02:05:00Z")); // 10:05 SGT; newest 09:00 SGT
  assert.equal(night, false);
  assert.equal(times[0], "2026-10-23T23:30:00Z"); // 07:30 SGT
  assert.equal(times.at(-1), "2026-10-24T01:00:00Z");
  assert.equal(times.length, 10);
});

test("visibleTimes: at night it is the 3 hours up to 17:30", () => {
  const { times, night } = visibleTimes(Date.parse("2026-10-23T15:00:00Z")); // 23:00 SGT
  assert.equal(night, true);
  assert.equal(times.length, 19);
  assert.equal(times.at(-1), "2026-10-23T09:30:00Z"); // 17:30 SGT
  assert.equal(times[0], "2026-10-23T06:30:00Z"); // 14:30 SGT
});

test("visibleTimes: in the evening, with dusk pictures still in the window, it is night", () => {
  const { times, night } = visibleTimes(Date.parse("2026-10-23T13:38:00Z")); // 21:38 SGT
  assert.equal(night, true);
  assert.equal(times.at(-1), "2026-10-23T09:30:00Z"); // 17:30 SGT
});

test("visibleTimes: before sunrise it is yesterday's evening", () => {
  const { times, night } = visibleTimes(Date.parse("2026-10-23T21:00:00Z")); // 05:00 SGT on the 24th
  assert.equal(night, true);
  assert.equal(times.at(-1), "2026-10-23T09:30:00Z");
});

test("visibleTimes: in the first hour of daylight it still shows the last evening", () => {
  const { night, times } = visibleTimes(Date.parse("2026-10-24T00:20:00Z")); // 08:20 SGT; newest 07:10 SGT
  assert.equal(night, true);
  assert.equal(times.at(-1), "2026-10-23T09:30:00Z");
});
