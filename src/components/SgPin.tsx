import { SG_ON_IMAGE } from "@/lib/satellite";

/** Singapore's ring and label, laid over a satellite image; `at` is its place on the image (percentages). */
export default function SgPin({ at = SG_ON_IMAGE }: { at?: { x: number; y: number } }) {
  return (
    <>
      <span
        aria-hidden
        className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
        style={{ left: `${at.x}%`, top: `${at.y}%` }}
      />
      <span
        aria-hidden
        className="absolute -translate-y-1/2 rounded bg-black/60 px-1.5 text-[11px] font-semibold text-white"
        style={{ left: `calc(${at.x}% + 12px)`, top: `${at.y}%` }}
      >
        Singapore
      </span>
    </>
  );
}
