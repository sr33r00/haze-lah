import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createImageCodec } from "./imageCodec";

// Node cannot import a .wasm as a module, so the test compiles the same files from disk. The Workers loader (codecWasm.ts) is checked by the build and the local Workers preview.
const compile = async (file: string) => WebAssembly.compile(await readFile(new URL(`../../../node_modules/${file}`, import.meta.url)));
const codec = createImageCodec(async () => ({
  png: await compile("@jsquash/png/codec/pkg/squoosh_png_bg.wasm"),
  webp: await compile("@jsquash/webp/codec/enc/webp_enc_simd.wasm"),
}));

// A 2 by 1 RGBA PNG: one opaque red pixel, one half-transparent blue pixel (built with Python's zlib).
const PNG_2X1 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAADklEQVR4nGP4z8AAQg0AD3oDfnfpf5cAAAAASUVORK5CYII=", "base64");

test("a PNG decodes to its RGBA pixels, alpha kept", async () => {
  const { data, width, height } = await codec.decodePng(PNG_2X1.buffer.slice(PNG_2X1.byteOffset, PNG_2X1.byteOffset + PNG_2X1.length));
  assert.deepEqual([width, height], [2, 1]);
  assert.deepEqual([...data], [255, 0, 0, 255, 0, 0, 255, 128]);
});

test("RGBA pixels encode to a WebP file", async () => {
  const size = 8;
  const data = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < size * size; i++) data.set([200, 40, 40, i % 2 ? 255 : 0], i * 4);
  const webp = await codec.encodeWebp({ data, width: size, height: size });
  assert.equal(Buffer.from(webp.subarray(0, 4)).toString("latin1"), "RIFF");
  assert.equal(Buffer.from(webp.subarray(8, 12)).toString("latin1"), "WEBP");
  assert.equal(new DataView(webp.buffer, webp.byteOffset).getUint32(4, true), webp.length - 8, "the RIFF length matches the file");
});
