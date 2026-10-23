import assert from "node:assert/strict";
import { test } from "node:test";
import { HIMAWARI_BANDS, himawariTimes, himawariUrl, onImage } from "@/lib/satellite";

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
  const q = new URL(himawariUrl(HIMAWARI_BANDS[1].layer, "2026-10-23T11:00:00Z")).searchParams;
  assert.equal(q.get("LAYERS"), "Himawari_AHI_Band3_Red_Visible_1km,Coastlines_15m");
  assert.equal(q.get("TIME"), "2026-10-23T11:00:00Z");
  assert.equal(q.get("BBOX"), "-6,95,7,120");
  assert.equal(q.get("WIDTH"), "1000");
});

test("onImage puts Singapore left of centre and above the middle", () => {
  const p = onImage(1.35, 103.82);
  assert.ok(p.x > 30 && p.x < 40 && p.y > 40 && p.y < 46);
});
