import assert from "node:assert/strict";
import { test } from "node:test";
import { HISTORY_BASE, historyUrl, loadDay, loadIndex, prefetchAround } from "@/lib/historyClient";

/** A fake fetch that answers each URL from `routes` (a status and a JSON body) and counts the calls. */
function fake(routes: Record<string, { status?: number; body?: unknown }>) {
  const calls: string[] = [];
  const fn = (async (url: string) => {
    calls.push(url);
    const r = routes[url];
    if (!r) throw new Error("network");
    const status = r.status ?? 200;
    return { ok: status >= 200 && status < 300, status, json: async () => r.body } as Response;
  }) as unknown as typeof fetch;
  return { fn, calls };
}

test("historyUrl joins the base and the date", () => {
  assert.equal(historyUrl("2026-10-01"), `${HISTORY_BASE}2026-10-01.json`);
  assert.equal(historyUrl("index"), `${HISTORY_BASE}index.json`);
});

test("loadIndex returns null when fetch rejects", async () => {
  assert.equal(await loadIndex(fake({}).fn), null);
});

test("loadIndex returns null on 404", async () => {
  assert.equal(await loadIndex(fake({ [historyUrl("index")]: { status: 404 } }).fn), null);
});

test("loadIndex returns null when the JSON is not an index", async () => {
  assert.equal(await loadIndex(fake({ [historyUrl("index")]: { body: { days: "x" } } }).fn), null);
});

test("loadIndex returns the index", async () => {
  const body = { updated: "2026-10-23T00:00:00Z", days: [] };
  assert.deepEqual(await loadIndex(fake({ [historyUrl("index")]: { body } }).fn), body);
});

test("loadDay memoises (fetch called once for two calls)", async () => {
  const f = fake({ [historyUrl("2026-01-01")]: { body: { date: "2026-01-01" } } });
  const [a, b] = await Promise.all([loadDay("2026-01-01", f.fn), loadDay("2026-01-01", f.fn)]);
  assert.equal(a, b);
  assert.equal(f.calls.length, 1);
  await loadDay("2026-01-01", f.fn);
  assert.equal(f.calls.length, 1);
});

test("loadDay returns null for a missing day, and tries again on the next call", async () => {
  const f = fake({ [historyUrl("2026-01-02")]: { status: 404 } });
  assert.equal(await loadDay("2026-01-02", f.fn), null);
  assert.equal(await loadDay("2026-01-02", f.fn), null);
  assert.equal(f.calls.length, 2);
});

test("a failed fetch is not remembered: a later call can succeed", async () => {
  const body = { date: "2026-01-05" };
  let up = false;
  const fn = (async () => {
    if (!up) throw new Error("network");
    return { ok: true, status: 200, json: async () => body } as Response;
  }) as unknown as typeof fetch;
  assert.equal(await loadDay("2026-01-05", fn), null);
  up = true;
  assert.deepEqual(await loadDay("2026-01-05", fn), body);
});

test("loadDay returns null when the file is for another date", async () => {
  const f = fake({ [historyUrl("2026-01-03")]: { body: { date: "2026-01-04" } } });
  assert.equal(await loadDay("2026-01-03", f.fn), null);
});

test("prefetchAround loads the next two dates and never throws", async () => {
  const dates = ["2026-02-01", "2026-02-02", "2026-02-03", "2026-02-04"];
  const f = fake({ [historyUrl("2026-02-03")]: { body: { date: "2026-02-03" } } });
  prefetchAround("2026-02-01", dates, f.fn);
  await Promise.all(dates.map((d) => loadDay(d, f.fn)));
  assert.deepEqual(f.calls.slice(0, 2).sort(), [historyUrl("2026-02-02"), historyUrl("2026-02-03")]);
  prefetchAround("unknown", dates, f.fn);
});
