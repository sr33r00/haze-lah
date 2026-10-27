// Saves the app icons as static PNGs in public/ from a running dev server, where src/lib/appIcon.tsx draws them:
//   HAZE_MOCK=1 npm run dev -- --port 3124   then   node scripts/icons.mjs [http://localhost:3124]
// Run it again after the logo changes. Each icon's file is where its route (src/app/icons/[name]/route.tsx) redirects to;
// the PNG itself is the same route with `?render=1` (development only).
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const base = process.argv[2] ?? "http://localhost:3124";
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

for (const name of ["192", "512", "maskable-192", "maskable-512", "apple"]) {
  const route = `${base}/icons/${name}`;
  const file = (await fetch(route, { redirect: "manual" })).headers.get("location");
  const res = await fetch(`${route}?render=1`);
  if (!file || !res.ok || res.headers.get("content-type") !== "image/png") throw new Error(`${name}: ${file} ${res.status} ${res.headers.get("content-type")}`);
  const path = join(root, file);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, Buffer.from(await res.arrayBuffer()));
  console.log("wrote public" + file);
}
