import { Coffee, Info } from "lucide-react";
import Link from "next/link";
import { ALERTS_URL, BMC_URL } from "@/lib/links";
import { newestTime } from "@/lib/situation";
import type { HazeData } from "@/lib/types";
import AlertsButton from "./AlertsButton";
import BottomNav, { TopNav } from "./BottomNav";
import Freshness from "./Freshness";
import Logo from "./Logo";
import SwipeTabs from "./SwipeTabs";
import ShareButton from "./ShareButton";
import ThemeToggle from "./ThemeToggle";

/** Shared chrome of every tab: header, optional page title, bottom tabs. */
export default function AppShell({ data, title, children }: { data: HazeData; title?: string; children: React.ReactNode }) {
  return (
    <div className="pb-24 lg:pb-0">
      <main className="mx-auto max-w-lg lg:max-w-6xl 2xl:max-w-7xl [&>h1+section]:mt-4">
        <header className="sticky top-0 z-[1000] border-b border-line bg-bg/90 pt-[env(safe-area-inset-top)] backdrop-blur">
          <div className="flex h-14 items-center justify-between gap-3 px-4">
            <Link href="/" aria-label="Haze Lah home" className="flex min-w-0 items-center gap-2.5">
              <Logo size={32} />
              <span className="min-w-0">
                <span className="block text-[17px] font-extrabold leading-5 tracking-tight">Haze Lah</span>
                <span className="block truncate text-[12px] leading-4 text-muted">
                  <Freshness generatedAt={data.generatedAt} />
                </span>
              </span>
            </Link>
            <TopNav newest={newestTime(data)} />
            <div className="flex shrink-0 items-center gap-1.5 min-[400px]:gap-2">
              {ALERTS_URL && <AlertsButton href={ALERTS_URL} />}
              <Link
                href="/about"
                aria-label="About and data sources"
                title="About and data sources"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface"
              >
                <Info size={16} aria-hidden />
              </Link>
              <a
                href={BMC_URL}
                target="_blank"
                rel="noreferrer"
                aria-label="Buy me a coffee"
                title="Buy me a coffee"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface"
              >
                <Coffee size={16} aria-hidden />
              </a>
              <ThemeToggle />
              <ShareButton />
            </div>
          </div>
        </header>
        {data.mock && <p className="mx-4 mb-3 rounded-xl bg-[var(--lv2)]/15 px-3 py-2 text-[13px]">Demo data. These are not real readings.</p>}
        {title && <h1 className="px-4 pt-1 text-[28px] lg:pt-4 font-extrabold leading-tight tracking-tight">{title}</h1>}
        {children}
      </main>
      <SwipeTabs />
      <BottomNav newest={newestTime(data)} />
    </div>
  );
}
