import assert from "node:assert/strict";
import { test } from "node:test";
import { parseFirmsCsv, rowToFire } from "@/lib/sources/firmsCsv";

const csv = [
  "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight",
  "-1.5,102.2,330,0.4,0.4,2026-08-01,0530,N,VIIRS,n,2.0NRT,300,12.5,D", // Sumatra
  "-1.6,102.3,330,0.4,0.4,2026-08-01,0530,N,VIIRS,l,2.0NRT,300,3.0,D", // low confidence: dropped
  "20.0,80.0,330,0.4,0.4,2026-08-01,0530,N,VIIRS,h,2.0NRT,300,9.0,D", // outside the three areas: dropped
  "1.0,112.0,330,0.4,0.4,2026-08-01,2310,N,VIIRS,h,2.0NRT,300,,N", // Borneo, no FRP
].join("\n");

test("parseFirmsCsv drops low-confidence fires and those outside the areas", () => {
  const rows = parseFirmsCsv(csv);
  assert.equal(rows.length, 2);
  assert.deepEqual(rowToFire(rows[0]), { lat: -1.5, lon: 102.2, frp: 12.5, confidence: "n", where: "sumatra", time: "2026-08-01T05:30:00Z" });
  assert.deepEqual(rowToFire(rows[1]), { lat: 1, lon: 112, frp: 0, confidence: "h", where: "borneo", time: "2026-08-01T23:10:00Z" });
});

test("parseFirmsCsv gives no rows for a table without fires and throws on anything else", () => {
  assert.deepEqual(parseFirmsCsv(csv.split("\n")[0]), []);
  assert.throws(() => parseFirmsCsv("Invalid MAP_KEY"), /unexpected/);
});
