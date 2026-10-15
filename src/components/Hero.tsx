import { GROUP_LABEL, LEVEL_COLOR, LEVEL_NAME, NEA_ADVICE, TONE_COLOR, pm25Band, pm25Color, psiLevel, verdict, type Group, type Level } from "@/lib/bands";
import { fmtHour } from "@/lib/format";
import type { ForecastPoint } from "@/lib/types";
import { cap } from "./ui";

const GROUPS: Group[] = ["healthy", "sensitive", "chronic"];
const GROUP_SHORT: Record<Group, string> = { healthy: "Healthy adult", sensitive: "Child, elderly, pregnant", chronic: "Heart or lung condition" };

export default function Hero(props: {
  region: string;
  readingTime: string | null;
  pm25: number | null;
  psi: number | null;
  trend: string | null;
  level: Level | null;
  group: Group;
  onGroup: (g: Group) => void;
  next: ForecastPoint[];
}) {
  const { pm25, psi, level, group } = props;
  const v = level != null ? verdict(level, group) : null;
  // Solid verdict colour with a subtle same-hue shade; neutral when there is no reading.
  const tone = v ? TONE_COLOR[v.tone] : null;
  const ink = tone ? tone.fg : "var(--fg)";
  const soft = `color-mix(in srgb, ${ink} 80%, transparent)`;
  const bg = tone ? `linear-gradient(180deg, ${tone.bg}, color-mix(in srgb, ${tone.bg} 88%, black))` : "var(--surface)";

  return (
    <section
      id="now"
      className="relative mt-3 overflow-hidden rounded-b-[32px] px-5 pb-6 pt-5"
      style={{ background: bg, color: ink }}
    >
      <p className="text-[15px]" style={{ color: soft }}>
        {cap(props.region)}
        {props.readingTime ? `, ${fmtHour(props.readingTime)}` : ""}. Should I go out?
      </p>
      <h1 className="mt-1 text-[40px] font-extrabold leading-[1.02] tracking-[-0.02em]">{v ? v.headline : "No reading yet."}</h1>
      <p className="mt-2 max-w-[34ch] text-[17px] leading-snug">{v ? v.detail : "NEA data is temporarily unavailable."}</p>

      <div role="radiogroup" aria-label="Advice for" className="mt-5 grid grid-cols-3 gap-1 rounded-2xl p-1" style={{ background: `color-mix(in srgb, ${ink} 14%, transparent)` }}>
        {GROUPS.map((g) => (
          <button
            key={g}
            role="radio"
            aria-checked={g === group}
            onClick={() => props.onGroup(g)}
            className="rounded-xl px-1 py-2 text-[13px] font-semibold leading-tight transition-colors"
            style={g === group ? { background: ink, color: tone ? tone.bg : "var(--surface)" } : { color: soft }}
          >
            {GROUP_SHORT[g]}
          </button>
        ))}
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-4">
        <div>
          <dt className="text-[13px]" style={{ color: soft }}>
            PM2.5 now, 1-hour
          </dt>
          <dd className="tabular text-[52px] font-light leading-none tracking-tight">{pm25 != null ? Math.round(pm25) : "–"}</dd>
          <dd className="mt-1 flex items-center gap-1.5 text-[15px] font-semibold">
            {pm25 != null && <Dot color={pm25Color(pm25)} />}
            {pm25 != null ? `${pm25Band(pm25).name}, band ${pm25Band(pm25).band}` : ""}
          </dd>
          <dd className="text-[12px]" style={{ color: soft }}>
            µg/m³{props.trend ? `, ${props.trend.toLowerCase()}` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-[13px]" style={{ color: soft }}>
            PSI, 24-hour
          </dt>
          <dd className="tabular text-[52px] font-light leading-none tracking-tight">{psi ?? "–"}</dd>
          <dd className="mt-1 flex items-center gap-1.5 text-[15px] font-semibold">
            {psi != null && <Dot color={LEVEL_COLOR[psiLevel(psi)]} />}
            {psi != null ? LEVEL_NAME[psiLevel(psi)] : ""}
          </dd>
          <dd className="text-[12px]" style={{ color: soft }}>
            for planning the day
          </dd>
        </div>
      </dl>

      {props.next.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-[13px]" style={{ color: soft }}>
            Next {props.next.length} hours, island-wide forecast
          </p>
          <ol className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${props.next.length}, minmax(0, 1fr))` }}>
            {props.next.map((p) => (
              <li key={p.time} className="text-center">
                <div className="h-2 rounded-full" style={{ background: pm25Color(p.pm25), boxShadow: `0 0 0 1.5px ${soft}` }} />
                <div className="tabular mt-1 text-[15px] font-bold">{p.pm25}</div>
                <div className="text-[11px]" style={{ color: soft }}>
                  {fmtHour(p.time)}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {level != null && (
        <p className="mt-5 text-[13px] leading-snug" style={{ color: soft }}>
          NEA advice for {GROUP_LABEL[group].toLowerCase()}: {NEA_ADVICE[group][level].toLowerCase()}.
        </p>
      )}
    </section>
  );
}

function Dot({ color }: { color: string }) {
  return <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full ring-2 ring-white/60" style={{ background: color }} />;
}
