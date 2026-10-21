import { Coffee, Info } from "lucide-react";
import Link from "next/link";
import { ALERTS_URL, BMC_ICON_LABEL, BMC_URL } from "@/lib/links";
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

/** Shared chrome of every tab: header, optional page title, bottom tabs. */
export default function AppShell({ data, title, children }: { data: HazeData; title?: string; children: React.ReactNode }) {
  return (
    <div className="pb-24 lg:pb-0">
      <WhatsNew />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[1100] focus:rounded-full focus:bg-surface focus:px-4 focus:py-2 focus:text-[14px] focus:font-semibold"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-[1000] mx-auto max-w-lg lg:max-w-6xl 2xl:max-w-[1400px] min-[1920px]:max-w-[1600px] border-b border-line bg-bg/90 pt-[env(safe-area-inset-top)] backdrop-blur">
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
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface transition-colors hover:bg-line"
            >
              <Info size={16} aria-hidden />
            </Link>
            <a
              href={BMC_URL}
              target="_blank"
              rel="noreferrer"
              aria-label={BMC_ICON_LABEL}
              title={BMC_ICON_LABEL}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface transition-colors hover:bg-line"
            >
              <Coffee size={16} aria-hidden />
            </a>
            <ThemeToggle />
            <ShareButton />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-lg lg:max-w-6xl 2xl:max-w-[1400px] min-[1920px]:max-w-[1600px] [&>h1+section]:mt-4">
        {data.mock && <p className="mx-4 mb-3 rounded-xl bg-[var(--lv2)]/15 px-3 py-2 text-[13px]">Demo data. These are not real readings.</p>}
        {title && <h1 className="px-4 pt-1 text-[28px] lg:pt-4 text-balance font-extrabold leading-tight tracking-tight">{title}</h1>}
        {children}
      </main>
      <InstallPrompt />
      <BottomNav newest={newestTime(data)} />
    </div>
  );
}
