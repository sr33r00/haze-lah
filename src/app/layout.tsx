import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Haze SG: is it safe to go out?",
  description:
    "Live Singapore haze levels, a 5-day forecast and a clear answer on whether it is safe to go out, from NEA, Malaysian, NASA and Copernicus data.",
  openGraph: {
    title: "Haze SG",
    description: "Is it safe to go out? Live haze levels and forecast for Singapore.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0f14" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
