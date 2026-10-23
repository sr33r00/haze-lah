import assert from "node:assert/strict";
import { test } from "node:test";
import type { ReplayDay } from "@/lib/types";
import { SG } from "@/lib/util";
import { captionOf } from "./caption";
import type { GlobeDay } from "./frame";

const LATS = [0, 1, 2, 3];
const LONS = [100, 101, 102, 103, 104, 105];
const base = (extra: Partial<GlobeDay> = {}): GlobeDay => ({
  date: "2026-10-23", kind: "today", fires: [], fireDate: "2026-10-23", older: [], fresh: [], trail: [], ahead: [], grid: { lats: LATS, lons: LONS }, wind: null, field: null, ...extra,
});
const live = (extra: Partial<ReplayDay> = {}) => ({ from: "southeast", area: "Riau", near: 12, ahead: null, ...extra }) as ReplayDay;

test("the headline is where the air came from, with the fires it passed when the live replay knows them", () => {
  assert.equal(captionOf({ day: base(), layer: "off", live: live(), fires: 100 }).headline, "Air came from the southeast via Riau, past 12 fires.");
});

test("a day with only a trail names the direction; a forecast day says should; none says so", () => {
  const trail: [number, number][] = [[SG.lat, SG.lon], [SG.lat - 5, SG.lon + 5]];
  assert.equal(captionOf({ day: base({ kind: "past", trail }), layer: "off", fires: null }).headline, "Air came from the southeast.");
  assert.equal(captionOf({ day: base({ kind: "forecast", trail }), layer: "off", fires: null }).headline, "Air should come from the southeast.");
  assert.equal(captionOf({ day: base({ kind: "forecast" }), layer: "off", fires: null }).headline, "No air path for this day.");
});

test("smoke on the way becomes the headline on today, and the air's path moves to the facts", () => {
  const ahead = { fires: 5, checked: 150, area: "Riau", hours: 30, at: "2026-10-24T12:00:00.000Z", path: [] as [number, number][] };
  const { headline, facts } = captionOf({ day: base(), layer: "off", live: live({ ahead }), fires: null });
  assert.match(headline, /^Smoke from 5 of today's 150 strongest fires/);
  assert.ok(facts.includes("Air came from the southeast via Riau, past 12 fires."));
});

test("facts: the model value over Singapore with its band, fires, new zones, PSI and wind", () => {
  const field = LATS.flatMap(() => LONS.map(() => 80));
  const wind = { u: LATS.flatMap(() => LONS.map(() => -5)), v: LATS.flatMap(() => LONS.map(() => 5)) };
  const day = base({ field, wind, grid: { lats: [0, 1, 2, 3], lons: [100, 101, 102, 103, 104, 105] }, fresh: [[0, 100], [1, 101]] });
  const { facts } = captionOf({ day, layer: "pm25", fires: 1873, psi: 86 });
  assert.deepEqual(facts, [
    "Model PM2.5 over Singapore: 80 µg/m³, Elevated",
    "1,873 fires in Sumatra and Borneo",
    "2 new fire zones",
    "Highest 24-hour PSI in Singapore: 86",
    "Wind from the southeast, 25 km/h",
  ]);
});

test("today before the afternoon pass counts the fires it draws and says whose they are, as the Now map does", () => {
  const { facts } = captionOf({ day: base({ fireDate: "2026-10-22" }), layer: "off", fires: 812 });
  assert.deepEqual(facts, ["812 fires in Sumatra and Borneo", "Fires of Thu 22 Oct"]);
  // The day's own fires need no date.
  assert.ok(!captionOf({ day: base(), layer: "off", fires: 812 }).facts.some((f) => f.startsWith("Fires of")));
  // Nor does a day with no count.
  assert.ok(!captionOf({ day: base({ fireDate: "2026-10-22" }), layer: "off", fires: null }).facts.some((f) => f.startsWith("Fires of")));
});

test("a layer the day has no data for says so instead of showing a value; a day with no grid says nothing", () => {
  assert.ok(captionOf({ day: base({ kind: "past" }), layer: "co", fires: null }).facts.includes("No CO model for this day"));
  const none = captionOf({ day: base({ grid: { lats: [], lons: [] } }), layer: "pm25", fires: null }).facts;
  assert.ok(!none.some((f) => f.includes("model")));
  assert.ok(!captionOf({ day: base({ kind: "past" }), layer: "pm25", fires: null }).facts.some((f) => f.startsWith("Model PM2.5")));
});

test("facts: a day that has just begun has no fire count; the satellite layer has no picture of a forecast day", () => {
  assert.ok(!captionOf({ day: base(), layer: "off", fires: 0 }).facts.some((f) => f.includes("fires")));
  assert.ok(captionOf({ day: base({ kind: "past" }), layer: "off", fires: 0 }).facts.includes("No fires seen in Sumatra and Borneo"));
  assert.ok(captionOf({ day: base({ kind: "forecast" }), layer: "smoke", fires: null }).facts.includes("No satellite picture for this day."));
});

test("the satellite layer on today before the evening says it shows the latest pass", () => {
  const morning = Date.parse("2026-10-23T03:00:00+08:00"); // NASA's newest frame is yesterday's until 5pm SGT
  const { facts } = captionOf({ day: base({ date: "2026-10-23" }), layer: "smoke", fires: null, now: morning });
  assert.ok(facts.some((f) => f.startsWith("Satellite picture: the latest pass, ")));
  const evening = Date.parse("2026-10-23T18:00:00+08:00");
  assert.ok(!captionOf({ day: base({ date: "2026-10-23" }), layer: "smoke", fires: null, now: evening }).facts.some((f) => f.includes("latest pass")));
});
