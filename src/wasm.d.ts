// A .wasm import is a compiled module on Workers.
declare module "*.wasm" {
  const wasm: WebAssembly.Module;
  export default wasm;
}

// The site Worker's bindings that app code reads (see wrangler.jsonc): the static assets and the private data bucket.
// DATA lists only what src/lib/dataStore.ts uses of an R2 bucket, so no Workers type package is needed.
declare module "cloudflare:workers" {
  export const env: {
    ASSETS: { fetch(input: Request | URL | string): Promise<Response> };
    DATA: {
      get(key: string): Promise<{ text(): Promise<string> } | null>;
      put(key: string, value: string, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
      delete(key: string): Promise<void>;
      list(options?: { prefix?: string; cursor?: string }): Promise<{ objects: { key: string }[]; truncated: boolean; cursor?: string }>;
    };
  };
}
