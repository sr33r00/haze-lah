import { SG_ON_IMAGE } from "@/lib/satellite";

/** Singapore's pulsing ring and label, laid over a satellite image; `at` is its place on the image (percentages). */
export default function SgPin({ at = SG_ON_IMAGE }: { at?: { x: number; y: number } }) {
  return (
    <>
      <span aria-hidden className="sg-ring" style={{ left: `${at.x}%`, top: `${at.y}%` }} />
      <span aria-hidden className="sg-label -translate-y-1/2" style={{ left: `calc(${at.x}% + 12px)`, top: `${at.y}%` }}>
        Singapore
      </span>
    </>
  );
}
