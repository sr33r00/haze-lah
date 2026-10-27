import assert from "node:assert/strict";
import { test } from "node:test";
import { parseHeat, parseLightning, parseRain, parseTemp, parseUv } from "@/lib/sources/neaWeather";

const rainJson = {
  code: 0,
  data: {
    area_metadata: [
      { name: "Bedok", label_location: { latitude: 1.321, longitude: 103.924 } },
      { name: "City", label_location: { latitude: 1.292, longitude: 103.844 } },
      { name: "Nowhere", label_location: { latitude: 1.3, longitude: 103.8 } },
    ],
    items: [
      {
        valid_period: { start: "2026-10-26T23:00:00+08:00", end: "2026-10-27T01:00:00+08:00", text: "11.00 pm to 1.00 am" },
        forecasts: [
          { area: "Bedok", forecast: "Thundery Showers" },
          { area: "City", forecast: "Cloudy" },
        ],
      },
    ],
  },
};

test("rain joins each town's forecast to its label point and drops towns without a forecast", () => {
  const feed = parseRain(rainJson);
  assert.equal(feed.end, "2026-10-27T01:00:00+08:00");
  assert.deepEqual(feed.areas, [
    { name: "Bedok", lat: 1.321, lon: 103.924, forecast: "Thundery Showers" },
    { name: "City", lat: 1.292, lon: 103.844, forecast: "Cloudy" },
  ]);
  assert.throws(() => parseRain({ data: { area_metadata: [], items: [] } }));
});

const heatJson = {
  data: {
    records: [
      {
        datetime: "2026-10-26T22:45:00+08:00",
        item: {
          type: "observation",
          readings: [
            { station: { id: "S125", name: "Woodlands Street 13", townCenter: "Woodlands Stadium" }, location: { latitude: "1.433789", longitude: "103.780731" }, wbgt: "25.2", heatStress: "Low" },
            { station: { id: "S999", name: "No reading" }, location: { latitude: "1.3", longitude: "103.8" }, wbgt: "", heatStress: "Low" },
            { station: { id: "S998", name: "Bad place" }, location: { latitude: "x", longitude: "103.8" }, wbgt: "27", heatStress: "Low" },
          ],
        },
      },
    ],
  },
};

test("heat reads text numbers and skips stations without a position, a reading or a band", () => {
  const feed = parseHeat(heatJson);
  assert.equal(feed.time, "2026-10-26T22:45:00+08:00");
  assert.deepEqual(feed.stations, [{ id: "S125", town: "Woodlands Stadium", lat: 1.433789, lon: 103.780731, wbgt: 25.2, stress: "Low" }]);
  assert.throws(() => parseHeat({ data: { records: [] } }));
});

const tempJson = {
  code: 0,
  data: {
    stations: [
      { id: "S109", deviceId: "S109", name: "Ang Mo Kio Avenue 5", location: { latitude: 1.3764, longitude: 103.8492 } },
      { id: "S107", name: "East Coast Parkway", location: { latitude: 1.3135, longitude: 103.9625 } },
      { id: "S111", name: "No position", location: { latitude: "x", longitude: 103.8 } },
    ],
    readings: [
      {
        timestamp: "2026-10-27T11:54:00+08:00",
        data: [
          { stationId: "S109", value: 31.4 },
          { stationId: "S107", value: "32.1" },
          { stationId: "S111", value: 30 },
          { stationId: "S999", value: 30 },
          { stationId: "S109", value: null },
        ],
      },
    ],
  },
};

test("temperature joins the newest minute's readings to their stations and skips the rest", () => {
  const feed = parseTemp(tempJson);
  assert.equal(feed.time, "2026-10-27T11:54:00+08:00");
  assert.deepEqual(feed.stations, [
    { name: "Ang Mo Kio Avenue 5", lat: 1.3764, lon: 103.8492, temp: 31.4 },
    { name: "East Coast Parkway", lat: 1.3135, lon: 103.9625, temp: 32.1 },
  ]);
  assert.throws(() => parseTemp({ data: { stations: [], readings: [] } }));
  assert.throws(() => parseTemp({ data: { ...tempJson.data, readings: [{ timestamp: "2026-10-27T11:54:00+08:00", data: [] }] } }));
});

test("uv lists the readings newest first, and may be empty before the first hour of a day", () => {
  const rec = (index: unknown[]) => ({ data: { records: [{ date: "2026-10-26", index }] } });
  const feed = parseUv(
    rec([
      { hour: "2026-10-26T08:00:00+08:00", value: 0 },
      { hour: "2026-10-26T09:00:00+08:00", value: 1 },
      { hour: "junk", value: 5 },
    ]),
  );
  assert.deepEqual(feed.readings, [
    { hour: "2026-10-26T09:00:00+08:00", value: 1 },
    { hour: "2026-10-26T08:00:00+08:00", value: 0 },
  ]);
  assert.deepEqual(parseUv(rec([])).readings, []);
  assert.throws(() => parseUv({ data: { records: [] } }));
});

const T = "2026-10-26T23:10:00+08:00";
const lightning = (readings: unknown[], datetime = T) => ({ data: { records: [{ datetime, item: { type: "observation", isStationData: false, readings } }] } });

test("lightning reads the observed shape: location with text coordinates and its own time", () => {
  const feed = parseLightning([lightning([{ location: { latitude: "1.5150", longitude: "103.6388" }, type: "G", text: "Cloud to Ground", datetime: "2026-10-26T23:09:02.968+08:00" }])]);
  assert.equal(feed.time, new Date(T).toISOString());
  assert.deepEqual(feed.strikes, [{ t: Date.parse("2026-10-26T23:09:02.968+08:00"), lat: 1.515, lon: 103.6388 }]);
});

test("lightning also accepts plain latitude and longitude, numbers, and falls back to the record's time", () => {
  const feed = parseLightning([lightning([{ latitude: 1.3, longitude: "103.8" }, { location: { latitude: 1.4, longitude: 103.9 } }])]);
  assert.deepEqual(
    feed.strikes.map((s) => [s.lat, s.lon, s.t]),
    [
      [1.3, 103.8, Date.parse(T)],
      [1.4, 103.9, Date.parse(T)],
    ],
  );
});

test("lightning ignores what it cannot read, counts a repeat once and drops old strikes", () => {
  const good = { location: { latitude: "1.3", longitude: "103.8" }, datetime: "2026-10-26T23:09:00+08:00" };
  const feed = parseLightning(
    [
      lightning([good, good, { location: { latitude: "n/a", longitude: "103.8" } }, "oops", null, { location: { latitude: "1.2", longitude: "103.7" }, datetime: "2026-10-26T20:00:00+08:00" }]),
      lightning([good], "2026-10-26T23:08:00+08:00"),
      null,
    ],
    Date.parse("2026-10-26T22:30:00+08:00"),
  );
  assert.equal(feed.strikes.length, 1);
  assert.equal(feed.time, new Date(T).toISOString()); // the newest record of any answer
});

test("lightning with no records is an error, not 'none nearby'; empty records are a quiet sky", () => {
  assert.throws(() => parseLightning([{ code: 24, data: null }]));
  assert.deepEqual(parseLightning([lightning([])]).strikes, []);
});
