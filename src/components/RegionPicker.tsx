import { REGIONS, type Region } from "@/lib/bands";
import { cap } from "./ui";

export default function RegionPicker(props: { region: Region; onPick: (r: Region) => void; onLocate: () => void; locating: boolean }) {
  return (
    <nav className="mb-3 flex gap-1.5" aria-label="Region">
      <button onClick={props.onLocate} aria-label="Use my location" className="shrink-0 rounded-full border border-line bg-card px-2.5 py-1.5 text-sm">
        {props.locating ? "…" : "📍"}
      </button>
      {REGIONS.map((r) => (
        <button
          key={r}
          onClick={() => props.onPick(r)}
          aria-pressed={r === props.region}
          className={`min-w-0 flex-1 rounded-full px-1 py-1.5 text-[13px] font-medium transition ${
            r === props.region ? "bg-fg text-bg" : "border border-line bg-card"
          }`}
        >
          {cap(r)}
        </button>
      ))}
    </nav>
  );
}
