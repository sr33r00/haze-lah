import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { kvDataAdapter } from "@vinext/cloudflare/cache/kv-data-adapter";
import { workersCacheCdnAdapter } from "@vinext/cloudflare/cache/workers-cache-cdn-adapter";

export default defineConfig({
  plugins: [
    vinext({
      // Pages and cacheable responses are served from Cloudflare's edge (Workers Cache); KV holds the data cache underneath.
      cache: { data: kvDataAdapter(), cdn: workersCacheCdnAdapter() },
    }),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});
