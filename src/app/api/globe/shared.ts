import { GLOBE_LAYERS, type GlobeLayer } from "@/lib/globe";
import { sgDate } from "@/lib/util";

// What both globe routes share: the layer in the path and how long an answer is cached. The satellite data is
// fetched and averaged on the server, so the browser only ever downloads the finished answer.

// The browser keeps an answer for a while too, so that playing the days again does not fetch them again.
const RECENT = "public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400"; // NASA adds a day's passes once a day
const PARTIAL = "public, s-maxage=300"; // something upstream failed: try again soon
const SETTLED = "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000"; // a day older than 2 days will not change

/** The `Cache-Control` of an answer whose newest day is `date`. */
export const cacheControl = (date: string, complete: boolean) => (!complete ? PARTIAL : date < sgDate(-2) ? SETTLED : RECENT);

/** The layer named in the route's path, or null when there is none such. */
export async function layerOf({ params }: { params: Promise<{ layer: string }> }) {
  const { layer } = await params;
  return Object.hasOwn(GLOBE_LAYERS, layer) ? (layer as GlobeLayer) : null;
}
