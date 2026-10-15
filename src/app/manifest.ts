import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Haze SG",
    short_name: "Haze SG",
    description: "Is it safe to go out? Live haze levels and forecast for Singapore.",
    start_url: "/",
    display: "standalone",
    background_color: "#e9eef1",
    theme_color: "#13232e",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
