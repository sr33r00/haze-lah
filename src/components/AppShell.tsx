import { Bell } from "lucide-react";
import Link from "next/link";
import { fmtTime } from "@/lib/format";
import { ALERTS_URL } from "@/lib/links";
import { newestTime } from "@/lib/situation";
import type { HazeData } from "@/lib/types";
import BottomNav from "./BottomNav";
import Freshness from "./Freshness";
import Logo from "./Logo";
import SwipeTabs from "./SwipeTabs";
import ShareButton from "./ShareButton";
import ThemeToggle from "./ThemeToggle";

/** Shared chrome of every tab: header, optional page title, bottom tabs. */
export default function AppShell({ data, title, children }: { data: HazeData; title?: string; children: React.ReactNode }) {
  const reading = data.history?.island.at(-1)?.time;
  return (
    <div className="pb-24">
      <main className="mx-auto max-w-lg [&>h1+section]:mt-4">
        <header className="sticky top-0 z-[1000] border-b border-line bg-bg/90 pt-[env(safe-area-inset-top)] backdrop-blur">
          <div className="flex h-14 items-center justify-between gap-2 px-4">
            <Link href="/" aria-label="Haze Lah home" className="flex min-w-0 items-center gap-2.5">
              <Logo />
              <span className="min-w-0">
                <span className="block text-[17px] font-extrabold leading-tight tracking-tight">Haze Lah</span>
                <span className="block truncate text-[12px] leading-tight text-muted">
                  {reading ? `NEA ${fmtTime(reading)}` : "Waiting for NEA"} · <Freshness generatedAt={data.generatedAt} />
                </span>
              </span>
            </Link>
            <div className="flex shrink-0 items-center gap-1.5">
              {ALERTS_URL && (
                <a
                  href={ALERTS_URL}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Get haze alerts on Telegram"
                  className="flex h-9 items-center gap-1.5 rounded-full bg-accent px-3 text-[13px] font-semibold text-bg"
                >
                  <Bell size={16} aria-hidden />
                  Alerts
                </a>
              )}
              <ThemeToggle />
              <ShareButton />
            </div>
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
