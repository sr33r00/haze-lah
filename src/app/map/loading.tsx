import GlobeSpinner from "@/components/globe/GlobeSpinner";

/** The globe's own dark, with the same spinner the globe shows while it loads, so that the page does not flash the site's colours. */
export default function Loading() {
  return (
    <div className="fixed inset-0 bg-[#02030a]">
      <GlobeSpinner />
    </div>
  );
}
