import { NEA_ADVICE, TONE_COLOR, verdict, type Group, type Level } from "@/lib/bands";
import { fmtHour } from "@/lib/format";
import type { ForecastPoint } from "@/lib/types";

const GROUP_SHORT: Record<Group, string> = {
  healthy: "Healthy adult",
  sensitive: "Kids, elderly, pregnant",
  chronic: "Heart / lung condition",
};

export default function Verdict(props: { level: Level | null; group: Group; onGroup: (g: Group) => void; best: ForecastPoint | null }) {
  const { level, group } = props;
  const v = level != null ? verdict(level, group) : null;
  return (
    <section className="rounded-3xl p-5 text-white shadow-lg" style={{ background: v ? TONE_COLOR[v.tone] : "#6b7280" }}>
      <p className="text-sm font-medium opacity-90">Should I go out now?</p>
      <p className="mt-1 text-3xl font-extrabold leading-tight">
        {v ? (
          <>
            <span aria-hidden className="mr-2">
              {v.emoji}
            </span>
            {v.headline}
          </>
        ) : (
          "Data unavailable"
        )}
      </p>
      {level != null && <p className="mt-2 text-sm opacity-95">NEA advice: {NEA_ADVICE[group][level].toLowerCase()}.</p>}

      <div className="mt-4 grid grid-cols-3 gap-1 rounded-2xl bg-black/15 p-1" role="tablist" aria-label="Who is going out">
        {(Object.keys(GROUP_SHORT) as Group[]).map((g) => (
          <button
            key={g}
            role="tab"
            aria-selected={g === group}
            onClick={() => props.onGroup(g)}
            className={`rounded-xl px-1 py-2 text-xs font-semibold leading-tight ${g === group ? "bg-white text-black" : "text-white/90"}`}
          >
            {GROUP_SHORT[g]}
          </button>
        ))}
      </div>
      {props.best && (
        <p className="mt-3 text-sm">
          Cleanest air in the next 12 h: <b>around {fmtHour(props.best.time)}</b> (PM2.5 about {props.best.pm25}).
        </p>
      )}
    </section>
  );
}
