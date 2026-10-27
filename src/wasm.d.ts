// A .wasm import is a compiled module on Workers.
declare module "*.wasm" {
  const wasm: WebAssembly.Module;
  export default wasm;
}

// The site Worker's bindings that app code reads (see wrangler.jsonc): the static assets, the private data bucket and the page cache bucket.
// DATA lists only what src/lib/dataStore.ts uses of an R2 bucket, so no Workers type package is needed.
declare module "cloudflare:workers" {
  export const env: {
    ASSETS: { fetch(input: Request | URL | string): Promise<Response> };
    DATA: {
      get(key: string): Promise<{ text(): Promise<string>; uploaded: Date } | null>;
      put(key: string, value: string, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
      delete(key: string): Promise<void>;
      list(options?: { prefix?: string; cursor?: string }): Promise<{ objects: { key: string }[]; truncated: boolean; cursor?: string }>;
    };
    // The shared page cache's bucket and this deployed version's id (the store keeps entries under runtime-cache/<id>/); used only by src/lib/jobs/cacheCleanup.ts.
    CACHE_BODIES: {
      list(options: { prefix: string; delimiter?: string; cursor?: string }): Promise<{ objects: { key: string; uploaded: Date }[]; delimitedPrefixes: string[]; truncated: boolean; cursor?: string }>;
      delete(keys: string[]): Promise<void>;
    };
    CF_VERSION_METADATA: { id: string };
  };
}
