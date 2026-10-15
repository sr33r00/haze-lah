import type { Metadata } from "next";

/** Per-page metadata: title, description and canonical path, with matching Open Graph fields. */
export function pageMeta(title: string, description: string, path: string): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    // Setting openGraph here drops the inherited file-based image, so point at it again.
    openGraph: { title, description, url: path, images: ["/opengraph-image"] },
  };
}
