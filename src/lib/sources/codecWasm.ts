// Imported by name so only Workers (and the Vite dev server) load it: a .wasm import gives a compiled WebAssembly.Module there, which node does not do.
// @ts-expect-error The package ships a wasm-bindgen .d.ts beside this file that has no default export; the bundler gives a WebAssembly.Module.
import png from "@jsquash/png/codec/pkg/squoosh_png_bg.wasm";
import webp from "@jsquash/webp/codec/enc/webp_enc_simd.wasm";
import type { CodecWasm } from "./imageCodec";

const wasm: CodecWasm = { png, webp };
export default wasm;
