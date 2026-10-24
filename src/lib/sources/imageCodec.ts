import { init as initPng, decode as decodePngWasm } from "@jsquash/png/decode.js";
import { init as initWebp, default as encodeWebpWasm } from "@jsquash/webp/encode.js";

// The package's types leave out init's first parameter, the compiled module.
const initWebpWith = initWebp as unknown as (module: WebAssembly.Module, options: object) => Promise<unknown>;

/** The compiled WebAssembly of the two codecs. Workers cannot fetch a .wasm by URL, so the host hands the modules over (see `codecWasm.ts`). */
export type CodecWasm = { png: WebAssembly.Module; webp: WebAssembly.Module };

/** Raw 8-bit RGBA pixels, row by row. */
export type Pixels = { data: Uint8ClampedArray; width: number; height: number };

/** PNG decoding and WebP encoding in WebAssembly (sharp is a native module and does not run on Workers). `loadWasm` runs once, on first use. */
export function createImageCodec(loadWasm: () => Promise<CodecWasm>) {
  let ready: Promise<void> | undefined;
  const init = () =>
    (ready ??= loadWasm().then(async ({ png, webp }) => {
      // locateFile: without it the Emscripten glue builds a URL from import.meta.url, which Workers do not have. Nothing is located: the module is given.
      await Promise.all([initPng(png), initWebpWith(webp, { locateFile: (file: string) => file })]);
    }));

  return {
    /** A PNG as RGBA pixels (opaque where it has no alpha). */
    async decodePng(png: ArrayBuffer): Promise<Pixels> {
      await init();
      const { data, width, height } = await decodePngWasm(png);
      return { data, width, height };
    },
    /** RGBA pixels as a lossy WebP with a separately compressed alpha channel. */
    async encodeWebp({ data, width, height }: Pixels): Promise<Uint8Array> {
      await init();
      // The encoder reads only data, width and height: Workers have no ImageData class.
      const image = { data, width, height } as ImageData;
      return new Uint8Array(await encodeWebpWasm(image, { quality: 80, alpha_quality: 90, use_sharp_yuv: 1 }));
    },
  };
}
