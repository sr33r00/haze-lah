import assert from "node:assert/strict";
import { test } from "node:test";
import { latestNeaUpdate, parseOutlook } from "@/lib/neaOutlook";
import type { TimelineItem } from "@/lib/situation";

test("parseOutlook reads a PSI range with its band", () => {
  assert.deepEqual(parseOutlook("The PSI forecast for 26 Oct 2026 is 70 – 100 (Moderate). Please check the readings.", "2026-10-25"), {
    forDate: "2026-10-26",
    min: 70,
    max: 100,
    band: "Moderate",
    level: 1,
  });
  assert.deepEqual(parseOutlook("The PSI forecast for 25 Oct 2026 is 80 – 130 (Moderate to Unhealthy). More.", "2026-10-24"), {
    forDate: "2026-10-25",
    min: 80,
    max: 130,
    band: "Moderate to Unhealthy",
    level: 2,
  });
});

test("parseOutlook reads words alone, for the day after the post", () => {
  assert.deepEqual(parseOutlook("The 24-hr PSI forecast for tomorrow is Unhealthy to Low Very Unhealthy. Please check the latest readings.", "2026-10-31"), {
    forDate: "2026-11-01",
    min: null,
    max: null,
    band: "Unhealthy to Low Very Unhealthy",
    level: 3,
  });
});

test("parseOutlook takes any dash, with or without spaces, and a single number", () => {
  for (const dash of ["-", "–", "—"])
    for (const sp of ["", " "])
      assert.deepEqual(parseOutlook(`The PSI forecast for 3 Nov 2026 is 40${sp}${dash}${sp}60 (Good to Moderate).`, "2026-11-02")?.min, 40);
  const one = parseOutlook("The PSI forecast for 26 Oct 2026 is 85 (Moderate).", "2026-10-25");
  assert.deepEqual([one?.min, one?.max, one?.band, one?.level], [85, 85, "Moderate", 1]);
  assert.equal(parseOutlook("The PSI forecast for 26 Oct 2026 is 85.", "2026-10-25")?.band, "Moderate");
});

test("parseOutlook gives null when nothing parses", () => {
  assert.equal(parseOutlook("Showers fell over parts of Singapore today.", "2026-10-25"), null);
  assert.equal(parseOutlook("The PSI forecast for tomorrow is uncertain.", "2026-10-25"), null);
});

const item = (title: string, summary: string, time: number, source: TimelineItem["source"] = "NEA"): TimelineItem => ({
  source,
  title,
  summary,
  time,
  hasHour: true,
});

test("latestNeaUpdate picks the newest NEA situation update and ignores other items", () => {
  const at = Date.parse("2026-10-25T18:00:00+08:00");
  const items = [
    item("Haze Situation Update (25 October 2026)", "The PSI forecast for 26 Oct 2026 is 70 – 100 (Moderate).", at, "CNA"),
    item("Haze Situation Update (25 October 2026)", "The PSI forecast for 26 Oct 2026 is 70 – 100 (Moderate).", at),
    item("Haze Situation Update (24 October 2026)", "The PSI forecast for 25 Oct 2026 is 80 – 130 (Moderate to Unhealthy).", at - 864e5),
  ];
  const found = latestNeaUpdate(items);
  assert.equal(found?.item, items[1]);
  assert.equal(found?.outlook?.max, 100);
  assert.equal(latestNeaUpdate([items[0]]), null);
  assert.equal(latestNeaUpdate([item("Haze Situation Update", "Dry conditions today.", at)])?.outlook, null);
});
