import { mockOutdoor } from "@/lib/mock";
import { fetchOutdoor } from "@/lib/sources/neaWeather";

// Fetched by the page on load and every 5 minutes, not built into it: lightning is safety information, so it must not ride the
// 30-minute haze data. Cached for 5 minutes (ISR), so data.gov.sg is asked about once per period, not per visitor. Each source
// fails on its own (null in the answer), so one outage never hides the others or caches an error.
export const revalidate = 300;

export async function GET() {
  return Response.json(process.env.HAZE_MOCK === "1" ? mockOutdoor() : await fetchOutdoor());
}
