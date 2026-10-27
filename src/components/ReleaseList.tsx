import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { RELEASES, releaseLabel } from "@/lib/releases";

// The group and its icon tiles take opposite backgrounds so the tiles show on either surface.
const TONE = {
  sheet: { group: "bg-bg", tile: "bg-surface" },
  page: { group: "bg-surface", tile: "bg-bg" },
} as const;

/** The last releases, newest first: a version and date heading, then its changes as tappable rows (icon, title, text and a chevron). `onNavigate` runs when a row is chosen (the sheet closes itself). */
export default function ReleaseList({ on = "sheet", onNavigate }: { on?: keyof typeof TONE; onNavigate?: () => void }) {
  const { group, tile } = TONE[on];
  return (
    <div className="space-y-4">
      {RELEASES.map((release) => (
        <section key={release.version}>
          <h3 className="mb-1.5 text-label text-muted">{releaseLabel(release)}</h3>
          <ul className={`divide-y divide-line overflow-hidden rounded-2xl ${group}`}>
            {release.items.map(({ title, text, href, icon: Icon }) => (
              <li key={title}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  className="flex min-h-11 items-center gap-3 px-3 py-3 transition-colors hover:bg-line active:bg-line focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
                >
                  <span className={`grid size-9 shrink-0 place-items-center rounded-xl text-accent ${tile}`}>
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-label font-semibold">{title}</span>
                    <span className="mt-0.5 block text-label leading-snug text-muted">{text}</span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
