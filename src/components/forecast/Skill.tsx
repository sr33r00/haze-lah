import Link from "next/link";
import type { Accuracy } from "@/lib/accuracy";
import { skillRows, skillSentence } from "@/lib/forecastHours";
import { Section } from "../ui";

const W = 280; // viewBox width; the chart scales to its card, so its text stays about 15 px at 360 px wide
const LABEL_W = 38; // room for the lead on the left
const VALUE_W = 34; // and for the number at the end of the longest bar
const BAR = { h: 16, gap: 2, group: 14 } as const; // px: one bar, between bars, between leads
const METHODS = [
  { key: "ours", label: "This site", fill: "var(--fg)", opacity: 1 },
  { key: "cams", label: "Copernicus", fill: "var(--fg)", opacity: 0.65 },
  { key: "persistence", label: "No change", fill: "var(--muted)", opacity: 0.8 },
] as const;

/**
 * "How sure we are": average error by lead time for this forecast, Copernicus and "assuming no change", one plain sentence on
 * what it means, and today's correction (`bias` is Copernicus x bias, `sigma` the typical error as a log ratio).
 * Renders nothing until enough forecasts have been scored. `className` places the section.
 */
export default function Skill({ accuracy, bias, sigma, className }: { accuracy: Accuracy | null; bias: number | null; sigma: number | null; className?: string }) {
  const rows = skillRows(accuracy);
  if (!rows.length) return null;
  const claim = skillSentence(rows);
  const max = Math.max(...rows.flatMap((r) => METHODS.map((m) => r[m.key])));
  const scale = (W - LABEL_W - VALUE_W) / max;
  const groupH = METHODS.length * BAR.h + (METHODS.length - 1) * BAR.gap;
  const height = rows.length * groupH + (rows.length - 1) * BAR.group;
  const summary = rows.map((r) => `${r.lead} hours: ${METHODS.map((m) => `${m.label} ${r[m.key]}`).join(", ")}`).join("; ");
  return (
    <Section className={className} title="How sure we are" aside="Average error, µg/m³">
      <div className="mx-4 rounded-3xl bg-surface p-4">
        <p className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-label text-muted">
          {METHODS.map((m) => (
            <span key={m.key} className="inline-flex items-center gap-1.5">
              <span aria-hidden className="size-2.5 rounded-sm" style={{ background: m.fill, opacity: m.opacity }} />
              {m.label}
            </span>
          ))}
        </p>
        <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label={`Average error in micrograms per cubic metre by hours ahead. ${summary}.`} className="tabular block w-full max-w-md">
          {rows.map((r, i) => {
            const top = i * (groupH + BAR.group);
            return (
              <g key={r.lead}>
                <text x={0} y={top + groupH / 2 + 5} fontSize={14} fontWeight={600} fill="var(--fg)">
                  {r.lead} h
                </text>
                {METHODS.map((m, k) => {
                  const y = top + k * (BAR.h + BAR.gap);
                  return (
                    <g key={m.key}>
                      <rect x={LABEL_W} y={y} width={Math.max(1, r[m.key] * scale)} height={BAR.h} rx={2} fill={m.fill} fillOpacity={m.opacity} />
                      <text x={LABEL_W + Math.max(1, r[m.key] * scale) + 4} y={y + BAR.h - 2} fontSize={14} fontWeight={m.key === "ours" ? 700 : 400} fill={m.key === "ours" ? "var(--fg)" : "var(--muted)"}>
                        {r[m.key]}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
        {claim && <p className="mt-3 text-label">{claim}</p>}
        {bias != null && (
          <p className="mt-2 text-label text-muted">
            Today: Copernicus × {bias.toFixed(1)}
            {sigma != null && `, typical error ±${Math.round((Math.exp(sigma) - 1) * 100)}%`}.
          </p>
        )}
        <Link href="/about#accuracy" className="mt-1 inline-flex min-h-[44px] items-center text-label link font-semibold">
          How we measure this
        </Link>
      </div>
    </Section>
  );
}
