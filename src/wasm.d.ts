// A .wasm import is a compiled module on Workers.
declare module "*.wasm" {
  const wasm: WebAssembly.Module;
  export default wasm;
}

// The site Worker's bindings that app code reads (see wrangler.jsonc); only the static assets so far.
declare module "cloudflare:workers" {
  export const env: { ASSETS: { fetch(input: Request | URL | string): Promise<Response> } };
}
