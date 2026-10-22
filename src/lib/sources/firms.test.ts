import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { fetchFiresRange } from "@/lib/sources/firms";

const HEAD = "latitude,longitude,frp,acq_date,acq_time,confidence";
const FIRE = "-1.5,102.2,5,2026-08-02,0100,n";
const realFetch = globalThis.fetch;
let urls: string[];

/** Stubs fetch: `answer` gets the product and the URL and returns the body, or a status number for an error. */
function stub(answer: (url: string) => string | number) {
  globalThis.fetch = (async (u: string) => {
    urls.push(u);
    const a = answer(u);
    return typeof a === "number" ? new Response("", { status: a }) : new Response(a, { status: 200 });
  }) as typeof fetch;
}
const path = (u: string) => u.replace("https://firms.modaps.eosdis.nasa.gov/api/area/csv/KEY/", "");

beforeEach(() => {
  urls = [];
  delete process.env.FIRMS_SOURCE;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("an empty NRT table falls back to the _SP product and logs why", async () => {
  stub((u) => (u.includes("_SP") ? `${HEAD}\n${FIRE}` : HEAD));
  const log: string[] = [];
  const fires = await fetchFiresRange("KEY", "2026-08-01", "2026-08-03", (m) => log.push(m));
  assert.deepEqual(urls.map(path), ["VIIRS_SNPP_NRT/95,-6.5,120,7.5/3/2026-08-01", "VIIRS_SNPP_SP/95,-6.5,120,7.5/3/2026-08-01"]);
  assert.equal(fires.length, 1);
  assert.equal(log.length, 1);
  assert.match(log[0], /VIIRS_SNPP_NRT returned an empty table.*used VIIRS_SNPP_SP/);
});

test("fires from NRT are used as they are, with no fallback", async () => {
  stub(() => `${HEAD}\n${FIRE}`);
  const log: string[] = [];
  assert.equal((await fetchFiresRange("KEY", "2026-08-01", "2026-08-01", (m) => log.push(m))).length, 1);
  assert.equal(urls.length, 1);
  assert.deepEqual(log, []);
});

test("a failed NRT request does not fall back: the range fails", async () => {
  stub(() => 500);
  await assert.rejects(fetchFiresRange("KEY", "2026-08-01", "2026-08-01", () => {}), /FIRMS 500/);
  assert.equal(urls.length, 1);
  assert.ok(!urls[0].includes("_SP"));
});

test("an invalid key does not fall back either", async () => {
  stub(() => "Invalid MAP_KEY.");
  await assert.rejects(fetchFiresRange("KEY", "2026-08-01", "2026-08-01", () => {}), /unexpected/);
  assert.equal(urls.length, 1);
});

test("a 7-day range is asked in requests of 5 and 2 days from the right dates", async () => {
  stub(() => `${HEAD}\n${FIRE}`);
  await fetchFiresRange("KEY", "2026-07-31", "2026-08-06", () => {});
  assert.deepEqual(urls.map(path), ["VIIRS_SNPP_NRT/95,-6.5,120,7.5/5/2026-07-31", "VIIRS_SNPP_NRT/95,-6.5,120,7.5/2/2026-08-05"]);
});
