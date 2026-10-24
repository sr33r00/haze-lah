import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { fetchAqiStations, parseStations } from "@/lib/sources/waqi";

const NOW = Date.parse("2026-10-23T14:00:00+08:00");
const SINCE = NOW - 3 * 3600_000;
const row = (over: Record<string, unknown> = {}, station: Record<string, unknown> = {}) => ({
  lat: 1.33,
  lon: 103.93,
  uid: 1,
  aqi: "157",
  station: { name: "Bedok Reservoir, Singapore", time: "2026-10-23T13:00:00+08:00", ...station },
  ...over,
});

test("parseStations reads a station: number from the string, trimmed name, time as UTC", () => {
  assert.deepEqual(parseStations({ data: [row()] }, SINCE), [
    { uid: 1, name: "Bedok Reservoir", lat: 1.33, lon: 103.93, aqi: 157, time: "2026-10-23T05:00:00.000Z" },
  ]);
});

test("parseStations drops stations with no reading, stale, outside Singapore, incomplete or NEA's own", () => {
  const data = [
    row({ uid: 2, aqi: "-" }),
    row({ uid: 3 }, { time: "2026-10-23T09:00:00+08:00" }),
    row({ uid: 4, lat: 3.1, lon: 101.7 }),
    row({ uid: 5, lat: undefined }),
    row({ uid: 6 }, { name: "" }),
    row({ uid: 7 }, { time: "not a date" }),
    row({ uid: 8, aqi: "-5" }),
    row({ uid: 9, aqi: "abc" }),
    row({ uid: 11 }, { name: "North, Singapore" }),
    null,
    row({ uid: 10, aqi: 42 }),
  ];
  assert.deepEqual(
    parseStations({ data }, SINCE).map((s) => [s.uid, s.aqi]),
    [[10, 42]],
  );
});

test("parseStations keeps the first of a repeated uid and survives an error answer", () => {
  assert.deepEqual(
    parseStations({ data: [row(), row({ aqi: "99" })] }, SINCE).map((s) => s.aqi),
    [157],
  );
  assert.deepEqual(parseStations({ data: "Invalid key" }, SINCE), []);
  assert.deepEqual(parseStations(null, SINCE), []);
});

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.WAQI_TOKEN;
});

test("fetchAqiStations returns nothing without a token and does not call the API", async () => {
  delete process.env.WAQI_TOKEN;
  globalThis.fetch = (async () => assert.fail("fetched without a token")) as typeof fetch;
  assert.deepEqual(await fetchAqiStations(), []);
});

test("fetchAqiStations rejects on an error answer without repeating its message", async () => {
  process.env.WAQI_TOKEN = "test-token";
  globalThis.fetch = (async () => new Response(JSON.stringify({ status: "error", data: "Invalid key secret-detail" }))) as typeof fetch;
  await assert.rejects(fetchAqiStations(), (e: Error) => e.message.includes("error") && !e.message.includes("secret-detail"));
});
