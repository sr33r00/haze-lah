import { readText } from "@/lib/dataStore";

// The globe's history files for the browser, read from the private data bucket and served from this origin only (no CORS).
// Built on request, never at build time: the files are in R2, not in the build.
export const dynamic = "force-dynamic";

const FILE = /^(index|\d{4}-\d{2}-\d{2})\.json$/;
const NOT_FOUND = { "Cache-Control": "no-store" };

/** `/data/history/index.json` or `/data/history/<YYYY-MM-DD>.json`; anything else is a 404. A day file never changes once written, the index does daily. */
export async function GET(_req: Request, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params;
  const name = FILE.exec(file)?.[1];
  if (!name) return Response.json({ error: "Not found" }, { status: 404, headers: NOT_FOUND });
  try {
    const text = await readText(`history/${file}`);
    if (text === null) return Response.json({ error: "Not found" }, { status: 404, headers: NOT_FOUND });
    return new Response(text, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": name === "index" ? "public, max-age=300" : "public, max-age=31536000, immutable",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (e) {
    console.error("[haze] history file:", e);
    return Response.json({ error: "History unavailable" }, { status: 502, headers: NOT_FOUND });
  }
}
