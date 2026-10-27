import { Info } from "lucide-react";
import Link from "next/link";
import { ALERTS_URL } from "@/lib/links";
import { newestTime } from "@/lib/situation";
import type { HazeData } from "@/lib/types";
import AlertsButton from "./AlertsButton";
import BottomNav, { TopNav } from "./BottomNav";
import Freshness from "./Freshness";
import InstallPrompt from "./InstallPrompt";
import Logo from "./Logo";
import ShareButton from "./ShareButton";
import ThemeToggle from "./ThemeToggle";
import WhatsNew from "./WhatsNew";

const WIDTH = "max-w-lg lg:max-w-6xl 2xl:max-w-[1400px] min-[1920px]:max-w-[1600px]";
const WIDE = "max-w-lg lg:max-w-none"; // the Now page: from lg up the whole window, for its map

/** Shared chrome of every tab: header, optional page title, bottom tabs. Without `data` (a fully static page) it shows no "updated" label, no New dot and no demo banner. `wide` lets the page use the whole window from lg up. */
export default function AppShell({ data, title, wide = false, children }: { data?: HazeData; title?: string; wide?: boolean; children: React.ReactNode }) {
  const width = wide ? WIDE : WIDTH;
  const newest = data ? newestTime(data) : null;
  return (
    <div className="pb-[calc(var(--nav-space)+1rem)] lg:pb-0">
      <WhatsNew />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[1100] focus:rounded-full focus:bg-surface focus:px-4 focus:py-2 focus:text-label focus:font-semibold"
      >
        Skip to content
      </a>
      <header className={`sticky top-0 z-[1000] mx-auto ${width} border-b border-line bg-bg/90 pt-[env(safe-area-inset-top)] backdrop-blur`}>
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <Link href="/" aria-label="Haze Lah home" className="flex min-w-0 items-center gap-2.5">
            <Logo size={32} />
            <span className="min-w-0">
              <span className="block text-[17px] font-extrabold leading-5 tracking-tight">Haze Lah</span>
              {data && (
                <span className="block truncate text-label leading-5 text-muted">
                  <Freshness generatedAt={data.generatedAt} />
                </span>
              )}
            </span>
          </Link>
          <TopNav newest={newest} />
          <div className="flex shrink-0 items-center gap-1.5 min-[400px]:gap-2">
            {ALERTS_URL && <AlertsButton href={ALERTS_URL} />}
            <Link
              href="/about"
              aria-label="About and data sources"
              title="About and data sources"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface transition-colors hover:bg-line"
            >
              <Info size={16} aria-hidden />
            </Link>
            <ThemeToggle />
            <ShareButton />
          </div>
        </div>
      </header>
      <main id="main" className={`mx-auto ${width} [&>h1+section]:mt-4`}>
        {data?.mock && <p className="mx-4 mb-3 rounded-xl bg-[var(--lv2)]/15 px-3 py-2 text-label">Demo data. These are not real readings.</p>}
        {title && <h1 className="px-4 pt-1 text-[28px] lg:pt-4 text-balance font-extrabold leading-tight tracking-tight">{title}</h1>}
        {children}
      </main>
      <InstallPrompt />
      <BottomNav newest={newest} />
    </div>
  );
}
