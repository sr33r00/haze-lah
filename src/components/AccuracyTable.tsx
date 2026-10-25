import type { Accuracy } from "@/lib/accuracy";

const f = (x: number | null) => (x == null ? "–" : `±${x}`);

export default function AccuracyTable({ a }: { a: Accuracy }) {
  const h = a.hazyDays;
  const clear = h.days - h.hazy;
  const pct = (n: number, d: number) =>
    d ? `${n} of ${d} (${Math.round((100 * n) / d)}%)` : "–";
  return (
    <div className="space-y-3">
      {h?.days > 0 && (
        <div className="rounded-2xl bg-surface p-3 text-label">
          <p className="font-semibold">
            Hazy days called the night before (11pm)
          </p>
          <p className="mt-1">
            This site: {pct(h.ours.hits, h.hazy)} hazy days,{" "}
            {pct(h.ours.clearRight, clear)} clear days right.
          </p>
          <p className="text-muted">
            Assuming no change: {pct(h.persistence.hits, h.hazy)} hazy days,{" "}
            {pct(h.persistence.clearRight, clear)} clear days right.
          </p>
        </div>
      )}
      <div className="overflow-x-auto rounded-2xl bg-surface">
        <table className="w-full text-left text-label">
          <thead>
            <tr className="border-b border-line">
              <th className="p-2">Ahead</th>
              <th className="p-2">This site</th>
              <th className="p-2">Raw CAMS</th>
              <th className="p-2">Same as now</th>
              <th className="p-2">Unhealthy-air alerts caught</th>
            </tr>
          </thead>
          <tbody>
            {a.leads.map((l) => (
              <tr key={l.lead} className="border-b border-line last:border-0">
                <td className="p-2 font-semibold">{l.lead} h</td>
                <td className="p-2 font-semibold">{f(l.ours.mae)}</td>
                <td className="p-2">{f(l.cams.mae)}</td>
                <td className="p-2">{f(l.persistence.mae)}</td>
                <td className="p-2">
                  {l.event.recall == null
                    ? "–"
                    : `${Math.round(l.event.recall * 100)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
