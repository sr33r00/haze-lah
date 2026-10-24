import type { Metadata, Viewport } from "next";
import "@fontsource-variable/atkinson-hyperlegible-next";
import "./globals.css";
import JsonLd from "@/components/JsonLd";
import { SITE_URL } from "@/lib/links";
import { THEME_COLOR } from "@/lib/theme";

const DESCRIPTION =
  "Live NEA PSI and PM2.5 for Singapore, a clear should-I-go-out answer, a 5-day haze forecast and a smoke map of fires and wind across the region.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Singapore haze today: live PSI, PM2.5 and forecast | Haze Lah", template: "%s | Haze Lah" },
  description: DESCRIPTION,
  applicationName: "Haze Lah",
  keywords: ["Singapore haze", "PSI", "PM2.5", "haze forecast", "NEA", "air quality", "smoke map"],
  authors: [{ name: "Haze Lah", url: SITE_URL }],
  creator: "Haze Lah",
  category: "health",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Haze Lah",
    locale: "en_SG",
    url: "/",
    title: "Singapore haze today: live PSI, PM2.5 and forecast",
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: "Singapore haze today: live PSI, PM2.5 and forecast", description: DESCRIPTION },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  formatDetection: { telephone: false },
};

const SCHEMA = [
  { "@context": "https://schema.org", "@type": "WebSite", name: "Haze Lah", alternateName: ["HazeLah", "Haze Lah Singapore"], url: SITE_URL },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Haze Lah",
    url: SITE_URL,
    logo: `${SITE_URL}/icons/512`,
    sameAs: ["https://t.me/hazelahh", "https://github.com/sr33r00/haze-lah"],
  },
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Haze Lah",
    url: SITE_URL,
    description: DESCRIPTION,
    applicationCategory: "HealthApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: 0, priceCurrency: "SGD" },
    areaServed: { "@type": "Country", name: "Singapore" },
    inLanguage: "en-SG",
  },
];

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLOR.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLOR.dark },
  ],
};

// Applies a saved light/dark choice before first paint; static string, no user input.
const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

// Cloudflare Web Analytics token, read at build time; no beacon without it (local development, forks).
const CF_BEACON = process.env.NEXT_PUBLIC_CF_BEACON;

const INSTALL_SCRIPT = `addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__installEvent=e;window.dispatchEvent(new Event("installready"))})`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {/* Chrome can offer installing before the page hydrates; keep the offer for InstallPrompt. */}
        <script dangerouslySetInnerHTML={{ __html: INSTALL_SCRIPT }} />
      </head>
      <body className="antialiased">
        {SCHEMA.map((d) => (
          <JsonLd key={d["@type"]} data={d} />
        ))}
        {children}
        {/* Cookieless page-view counts. */}
        {CF_BEACON && <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon={JSON.stringify({ token: CF_BEACON })} />}
      </body>
    </html>
  );
}
