import { SG_ON_IMAGE } from "@/lib/satellite";

/** Singapore's ring and label, laid over a satellite image of the region. */
export default function SgPin() {
  return (
    <>
      <span
        aria-hidden
        className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
        style={{ left: `${SG_ON_IMAGE.x}%`, top: `${SG_ON_IMAGE.y}%` }}
      />
      <span
        aria-hidden
        className="absolute -translate-y-1/2 rounded bg-black/60 px-1.5 text-[11px] font-semibold text-white"
        style={{ left: `calc(${SG_ON_IMAGE.x}% + 12px)`, top: `${SG_ON_IMAGE.y}%` }}
      >
        Singapore
      </span>
    </>
  );
}
