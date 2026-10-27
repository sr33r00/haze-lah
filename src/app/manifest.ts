import type { MetadataRoute } from "next";

const shortcut = (name: string, url: string) => ({ name, url });

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Haze Lah",
    short_name: "Haze Lah",
    description: "Is it safe to go out? Live haze levels and forecast for Singapore.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    categories: ["weather", "health"],
    background_color: "#e9eef1",
    theme_color: "#13232e",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icons/192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [shortcut("Forecast", "/forecast"), shortcut("Map", "/map"), shortcut("News", "/news"), shortcut("Glance", "/glance")],
  };
}
