import { addProtocol } from "maplibre-gl";
import { clearNoise } from "./fieldImage";

/** The tiles' URL scheme: `smokeai://` followed by the https address of a GIBS tile. */
export const SMOKE_SCHEME = "smokeai";

let registered = false;

/** Lets MapLibre load `smokeai://` tiles: NASA's tile with its low values cleared, so that only thick smoke shows, as in the server's picture. Once per page. */
export function registerSmokeScheme() {
  if (registered) return;
  registered = true;
  addProtocol(SMOKE_SCHEME, async ({ url }, abort) => {
    const res = await fetch(url.slice(SMOKE_SCHEME.length + 3), { signal: abort.signal });
    if (!res.ok) throw new Error(`GIBS ${res.status}`);
    const bitmap = await createImageBitmap(await res.blob());
    // OffscreenCanvas is missing before Safari 16.4 and Firefox 105: an ordinary canvas does the same there.
    const canvas = typeof OffscreenCanvas === "function" ? new OffscreenCanvas(bitmap.width, bitmap.height) : Object.assign(document.createElement("canvas"), { width: bitmap.width, height: bitmap.height });
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    const img = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    clearNoise(img.data);
    ctx.putImageData(img, 0, 0);
    const png = "convertToBlob" in canvas ? await canvas.convertToBlob({ type: "image/png" }) : await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/png"));
    if (!png) throw new Error("tile could not be encoded");
    return { data: await png.arrayBuffer() };
  });
}
