import { addProtocol } from "maplibre-gl";
import { GIBS_SCHEME } from "./globeStyle";


// Blue Marble and the Black Marble of 2016 are fixed pictures, but GIBS marks the night lights no-store, so the browser would fetch them again on every visit.
const CACHE = "gibs-tiles-v1";
/** Tiles asked for before the map needs them, by address. Each is handed over once; after that Cache Storage has it. */
const ahead = new Map<string, Promise<ArrayBuffer>>();

let registered = false;

/** The tile's bytes from Cache Storage (missing on insecure origins, and it can fail in private windows) or else from the network, which then fills the cache. */
async function load(url: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  let store: Cache | undefined;
  try {
    store = typeof caches === "undefined" ? undefined : await caches.open(CACHE);
    const hit = await store?.match(url);
    if (hit) return await hit.arrayBuffer();
  } catch {}
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`GIBS ${res.status}`);
  store?.put(url, res.clone()).catch(() => {});
  return res.arrayBuffer();
}

/** Starts loading these tiles (https addresses) so that they are there when the map asks. Failures are forgotten: the map's own request tries again. */
export function prefetchTiles(urls: string[]) {
  for (const url of urls) {
    if (ahead.has(url)) continue;
    const tile = load(url);
    ahead.set(url, tile);
    tile.catch(() => ahead.delete(url));
  }
}

/** Lets MapLibre load `gibs://` tiles: from the prefetched ones, else Cache Storage, else NASA. Once per page. */
export function registerGibsScheme() {
  if (registered) return;
  registered = true;
  addProtocol(GIBS_SCHEME, async ({ url }, abort) => {
    const https = url.slice(GIBS_SCHEME.length + 3);
    const early = ahead.get(https);
    if (early) {
      ahead.delete(https);
      try {
        return { data: await early };
      } catch {} // it failed: ask again below
    }
    return { data: await load(https, abort.signal) };
  });
}
