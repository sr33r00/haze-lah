import assert from "node:assert/strict";
import { test } from "node:test";
import { smokeTiles } from "./globe";

test("smoke tiles are the OMPS aerosol index of that date, with MapLibre's tile placeholders", () => {
  assert.equal(
    smokeTiles("2026-10-20"),
    "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/OMPS_NOAA20_NadirMapper_AerosolIndex_380/default/2026-10-20/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png",
  );
});
