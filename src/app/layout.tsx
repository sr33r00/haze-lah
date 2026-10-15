import type { Metadata, Viewport } from "next";
import "@fontsource-variable/atkinson-hyperlegible-next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Haze Lah: is it safe to go out?",
  description:
    "Live Singapore haze levels, a 5-day forecast and a clear answer on whether it is safe to go out, from NEA, Malaysian, NASA and Copernicus data.",
  openGraph: {
    title: "Haze Lah",
    description: "Is it safe to go out? Live haze levels and forecast for Singapore.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e9eef1" },
    { media: "(prefers-color-scheme: dark)", color: "#0d161d" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
