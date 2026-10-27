import { appIcon } from "@/lib/appIcon";

export const dynamic = "force-dynamic";

/** The icons: their size, whether the corners are rounded, and the static file in public/ that serves them. */
const ICONS: Record<string, { size: number; rounded: boolean; file: string }> = {
  "192": { size: 192, rounded: true, file: "/icons/192.png" },
  "512": { size: 512, rounded: true, file: "/icons/512.png" },
  "maskable-192": { size: 192, rounded: false, file: "/icons/maskable-192.png" },
  "maskable-512": { size: 512, rounded: false, file: "/icons/maskable-512.png" },
  apple: { size: 180, rounded: false, file: "/apple-icon.png" },
};

/**
 * The icons are static PNGs in public/ (made by scripts/icons.mjs), so this route only sends old links and installed apps there
 * (permanent redirect). In development, `?render=1` draws the icon with `appIcon`, which is what the script saves.
 */
export async function GET(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const icon = ICONS[(await params).name];
  if (!icon) return new Response("Not found", { status: 404 });
  if (process.env.NODE_ENV !== "production" && new URL(req.url).searchParams.has("render")) return appIcon(icon.size, icon.rounded);
  return new Response(null, { status: 301, headers: { location: icon.file, "cache-control": "public, max-age=86400" } });
}
