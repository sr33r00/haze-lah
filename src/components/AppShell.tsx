import { fmtTime } from "@/lib/format";
import { newestTime } from "@/lib/situation";
import type { HazeData } from "@/lib/types";
import BottomNav from "./BottomNav";
import Freshness from "./Freshness";
import SwipeTabs from "./SwipeTabs";
import ShareButton from "./ShareButton";
import ThemeToggle from "./ThemeToggle";

/** Shared chrome of every tab: header, optional page title, bottom tabs. */
export default function AppShell({ data, title, children }: { data: HazeData; title?: string; children: React.ReactNode }) {
  const reading = data.history?.island.at(-1)?.time;
  return (
    <div className="pb-24">
      <main className="mx-auto max-w-lg [&>h1+section]:mt-4">
        <header className="flex items-center justify-between px-4 pb-3 pt-4">
          <div>
            <span className="block text-[19px] font-extrabold leading-tight tracking-tight">Haze Lah</span>
            <span className="block text-[13px] text-muted">
              {reading ? `NEA ${fmtTime(reading)}` : "Waiting for NEA"} · <Freshness generatedAt={data.generatedAt} />
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <ShareButton />
          </div>
        </header>
        {data.mock && <p className="mx-4 mb-3 rounded-xl bg-[var(--lv2)]/15 px-3 py-2 text-[13px]">Demo data. These are not real readings.</p>}
        {title && <h1 className="px-4 pt-1 text-[28px] font-extrabold leading-tight tracking-tight">{title}</h1>}
        {children}
      </main>
      <SwipeTabs />
      <BottomNav newest={newestTime(data)} />
    </div>
  );
}
