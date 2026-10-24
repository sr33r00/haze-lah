// A .wasm import is a compiled module on Workers.
declare module "*.wasm" {
  const wasm: WebAssembly.Module;
  export default wasm;
}
