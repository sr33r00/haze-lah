import { LEVEL_NAME, LEVEL_TEXT, pm25Band, pm25ToLevel, psiLevel } from "@/lib/bands";

function Stat(p: { label: string; value: number | null; unit?: string; tag: string; color?: string; hint: string }) {
  return (
    <div className="rounded-3xl bg-card p-4">
      <div className="text-xs text-muted">{p.label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="tabular text-3xl font-extrabold" style={{ color: p.color }}>
          {p.value ?? "–"}
        </span>
        {p.unit && <span className="text-xs text-muted">{p.unit}</span>}
      </div>
      <div className="text-sm font-semibold" style={{ color: p.color }}>
        {p.tag}
      </div>
      <div className="mt-1 text-[11px] text-muted">{p.hint}</div>
    </div>
  );
}

export default function NowStats({ pm25, psi }: { pm25: number | null; psi: number | null }) {
  return (
    <section className="mt-3 grid grid-cols-2 gap-3">
      <Stat
        label="PM2.5 now (1 h)"
        value={pm25 != null ? Math.round(pm25) : null}
        unit="µg/m³"
        tag={pm25 != null ? pm25Band(pm25).name : ""}
        color={pm25 != null ? LEVEL_TEXT[pm25ToLevel(pm25)] : undefined}
        hint="Use for what to do right now"
      />
      <Stat
        label="PSI (24 h)"
        value={psi}
        tag={psi != null ? LEVEL_NAME[psiLevel(psi)] : ""}
        color={psi != null ? LEVEL_TEXT[psiLevel(psi)] : undefined}
        hint="Use for planning your day"
      />
    </section>
  );
}
