// Archives each forecast at issue time so it can be scored against NEA later.
// Run hourly by .github/workflows/archive.yml. Appends one line to data/archive/YYYY-MM.jsonl.
import { appendFileSync, mkdirSync } from "node:fs";
import { getHazeData } from "../src/lib/data";
import type { ArchiveRecord } from "../src/lib/accuracy";

async function main() {
  const d = await getHazeData();
  const obs = d.history?.island ?? [];
  if (!obs.length) throw new Error(`No NEA observations: ${d.errors.join("; ")}`);
  const issued = obs[obs.length - 1].time;
  const t0 = Date.parse(issued);
  const rec: ArchiveRecord = {
    issued,
    retrieved: d.generatedAt,
    obs: obs.slice(-24).map((p) => [p.time, Math.round(p.value * 10) / 10]),
    fc: d.forecast.hourly
      .map((p) => [Math.round((Date.parse(p.time) - t0) / 3600_000), p.pm25, p.raw] as [number, number, number])
      .filter(([lead]) => lead >= 1 && lead <= 96),
    bias: d.forecast.biasFactor,
    fires: d.fires.available ? { sumatra: d.fires.sumatra, borneo: d.fires.borneo } : null,
    errors: d.errors,
  };
  mkdirSync("data/archive", { recursive: true });
  appendFileSync(`data/archive/${issued.slice(0, 7)}.jsonl`, JSON.stringify(rec) + "\n");
  console.log(`archived forecast issued ${issued} with ${rec.fc.length} hours`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
