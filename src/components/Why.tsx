import { compass, windOrigin } from "@/lib/format";
import type { HazeData } from "@/lib/types";

/** The drivers behind the forecast: fires, wind and rain. */
export default function Why({ data }: { data: HazeData }) {
  const now = Date.now();
  const next = data.weather.filter((w) => Date.parse(w.time) >= now - 3600_000).slice(0, 12);
  // Vector-average the wind so 350° and 10° don't average to 180°.
  let u = 0;
  let v = 0;
  let speed = 0;
  for (const w of next) {
    if (isNaN(w.windDir)) continue;
    const r = (w.windDir * Math.PI) / 180;
    u += Math.sin(r);
    v += Math.cos(r);
    speed += w.windSpeed;
  }
  const dir = next.length ? ((Math.atan2(u, v) * 180) / Math.PI + 360) % 360 : null;
  const spd = next.length ? Math.round(speed / next.length) : null;
  const origin = dir != null ? windOrigin(dir) : null;
  const rain = next.reduce((m, w) => Math.max(m, w.rainProb ?? 0), 0);

  const f = data.fires;
  const smokeRisk =
    origin?.smoky === "sumatra" && f.sumatra > 100
      ? "Wind is carrying smoke from Sumatra fires towards us."
      : origin?.smoky === "borneo" && f.borneo > 100
        ? "Wind is carrying smoke from Borneo fires towards us."
        : origin?.smoky
          ? "Wind comes from fire regions; smoke depends on how many fires are burning."
          : "Wind is from the north, which usually brings cleaner air.";

  return (
    <section className="mt-3 rounded-3xl bg-card p-4">
      <h2 className="mb-3 font-semibold">Why</h2>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-bg p-3">
          <div className="text-2xl" aria-hidden>
            🔥
          </div>
          {f.available ? (
            <>
              <div className="tabular text-lg font-bold">{(f.sumatra + f.borneo).toLocaleString()}</div>
              <div className="text-[11px] leading-tight text-muted">
                fires in {f.days * 24} h
                <br />
                Sumatra {f.sumatra.toLocaleString()} · Borneo {f.borneo.toLocaleString()}
              </div>
            </>
          ) : (
            <div className="text-[11px] text-muted">Fire data coming soon</div>
          )}
        </div>
        <div className="rounded-2xl bg-bg p-3">
          <div className="text-2xl" aria-hidden style={{ transform: `rotate(${(dir ?? 0) + 180}deg)`, display: "inline-block" }}>
            ⬆
          </div>
          <div className="text-lg font-bold">{dir != null ? `From ${compass(dir)}` : "–"}</div>
          <div className="text-[11px] leading-tight text-muted">
            {spd != null ? `${spd} km/h at 1.5 km` : ""}
            <br />
            {origin ? `from ${origin.place}` : ""}
          </div>
        </div>
        <div className="rounded-2xl bg-bg p-3">
          <div className="text-2xl" aria-hidden>
            🌧
          </div>
          <div className="tabular text-lg font-bold">{rain}%</div>
          <div className="text-[11px] leading-tight text-muted">
            rain chance
            <br />
            next 12 h
          </div>
        </div>
      </div>
      <p className="mt-3 text-sm">
        {smokeRisk} {rain >= 60 ? "Heavy showers can wash haze out of the air." : ""}
      </p>
    </section>
  );
}
