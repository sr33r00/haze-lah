import { appIcon } from "@/lib/appIcon";

export const dynamic = "force-static";

const NAMES = ["192", "512", "maskable-192", "maskable-512"];

export function generateStaticParams() {
  return NAMES.map((name) => ({ name }));
}

/** Manifest PNG icons: /icons/192, /icons/512 and the maskable variants. */
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!NAMES.includes(name)) return new Response("Not found", { status: 404 });
  return appIcon(Number(name.replace("maskable-", "")), !name.startsWith("maskable"));
}
