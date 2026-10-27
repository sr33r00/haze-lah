import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { responseStoreAdapter } from "@vinext/cloudflare/cache/response-store-adapter";

export default defineConfig({
  plugins: [
    vinext({
      // One shared cache for pages and data (Workers Response Store, self-contained): bodies in R2, a Durable Object for tags and freshness.
      // A page is rendered once per period for the whole world; each location's Workers Cache then reads the stored copy instead of rendering again.
      // The Durable Object is created near Singapore, where most visitors are. Bindings are in wrangler.jsonc.
      cache: responseStoreAdapter({ mode: "self-contained", locationHint: "apac" }),
    }),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});
