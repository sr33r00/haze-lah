/** The globe's own dark, so that the page does not flash the site's colours before the globe is there. */
export default function Loading() {
  return <div className="fixed inset-0 bg-[#02030a]" aria-hidden />;
}
