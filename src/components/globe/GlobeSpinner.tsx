import { LoaderCircle } from "lucide-react";

/**
 * The quiet "Loading globe" mark, centred over the globe from the first paint until the globe has drawn. It fades out when `done`
 * (at once for a viewer who asked for less motion) and then leaves the accessibility tree. A sibling layer: it takes no space.
 */
export default function GlobeSpinner({ done = false }: { done?: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none absolute inset-0 grid place-content-center justify-items-center gap-2 text-white/60 motion-safe:transition-[opacity,visibility] motion-safe:duration-500 ${done ? "invisible opacity-0" : ""}`}
    >
      <LoaderCircle size={28} aria-hidden className="motion-safe:animate-spin" />
      <span className="text-label">Loading globe</span>
    </div>
  );
}
