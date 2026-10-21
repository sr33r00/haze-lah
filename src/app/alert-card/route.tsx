import { ImageResponse } from "next/og";
import { LEVEL_COLOR, LEVEL_NAME, REGIONS, TONE_COLOR, pm25Color, psiLevel, verdict, type Group } from "@/lib/bands";
import { bestWindowFor, trendDir } from "@/lib/alerts";
import { INK, LogoMark } from "@/lib/appIcon";
import { cigarettes } from "@/lib/cigarettes";
import { windFrom, windSource } from "@/lib/context";
import { getHazeData } from "@/lib/data";
import { fmtHour, fmtTime } from "@/lib/format";
import { islandSummary } from "@/lib/situation";
import { sgDate } from "@/lib/util";

export const revalidate = 300;

const SIZE = { width: 1200, height: 1200 };
const GROUPS: [Group, string][] = [
  ["healthy", "Healthy"],
  ["sensitive", "Children, elderly, pregnant"],
  ["chronic", "Heart or lung"],
];

const row = { display: "flex", alignItems: "center" } as const;
const box = {
  display: "flex",
  background: "#fff",
  borderRadius: 24,
  padding: "0 28px",
  alignItems: "center",
} as const;

/** Arrow pointing up, rotated clockwise by `deg`. */
const Arrow = ({ deg, size = 72, color = INK }: { deg: number; size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <g transform={`rotate(${deg} 12 12)`}>
      <path d="M12 2 L21 13 H15 V22 H9 V13 H3 Z" fill={color} />
    </g>
  </svg>
);

const Cig = () => (
  <div style={{ display: "flex", marginRight: 10 }}>
    <div style={{ width: 14, height: 14, background: "#d9822b" }} />
    <div
      style={{
        width: 44,
        height: 14,
        background: "#f5f1e6",
        border: "1px solid #b9b2a0",
      }}
    />
  </div>
);

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      padding: 36,
      background: "#e9eef1",
      color: INK,
      fontSize: 36,
    }}
  >
    {children}
  </div>
);

const Footer = ({ time }: { time?: string }) => (
  <div style={{ ...row, justifyContent: "space-between", height: 56 }}>
    <div style={row}>
      <LogoMark size={56} />
      <div style={{ marginLeft: 16, fontWeight: 800 }}>hazelah.app</div>
    </div>
    {time && <div>{`${time} SGT`}</div>}
  </div>
);

export async function GET() {
  const data = await getHazeData().catch(() => null);
  const s = data && islandSummary(data);
  const png = (el: React.ReactNode) => new ImageResponse(el as React.ReactElement, SIZE);
  if (!data?.nea || !s) {
    return png(
      <Shell>
        <div style={{ fontSize: 88, fontWeight: 800, marginTop: 300 }}>NEA data unavailable</div>
        <Footer />
      </Shell>,
    );
  }

  const { nea, history } = data;
  const color = LEVEL_COLOR[s.level];
  const fg = s.level === 2 ? "#1d1a10" : "#fff";
  const range = s.psi.min === s.psi.max ? `${s.psi.max}` : `${s.psi.min}–${s.psi.max}`;
  const trend = s.peak && trendDir(history?.regions[s.peak.region]);
  const hourly = data.forecast.hourly.slice(0, 12);
  const w = data.weather[0];
  const windOk = w && !isNaN(w.windDir);
  const src = windOk ? windSource(w.windDir) : null;
  const cigs = cigarettes(Math.max(...Object.values(nea.pm25_24h).filter(Number.isFinite)));
  const win = bestWindowFor(data);
  const cigCount = cigs ? Math.min(10, Math.max(1, Math.round(cigs))) : 0;

  return png(
    <Shell>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: color,
          color: fg,
          borderRadius: 32,
          padding: "0 40px",
          height: 250,
        }}
      >
        <div style={{ fontSize: 40, lineHeight: 1 }}>24-hr PSI</div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 12 }}>
          <div style={{ fontSize: 120, fontWeight: 800, lineHeight: 1, whiteSpace: "nowrap" }}>{range}</div>
          <div style={{ fontSize: 56, fontWeight: 800, lineHeight: 1, whiteSpace: "nowrap" }}>{LEVEL_NAME[s.level]}</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {GROUPS.map(([g, label]) => {
          const v = verdict(s.level, g);
          return (
            <div
              key={g}
              style={{
                ...row,
                background: TONE_COLOR[v.tone].bg,
                color: TONE_COLOR[v.tone].fg,
                borderRadius: 16,
                height: 54,
                padding: "0 24px",
                marginBottom: 8,
                fontWeight: 700,
              }}
            >
              {`${label}: ${v.headline.replace(/\.$/, "")}`}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {REGIONS.map((r) => {
          const v = nea.psi24[r];
          return (
            <div
              key={r}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                width: 206,
                height: 120,
                borderRadius: 20,
                background: LEVEL_COLOR[psiLevel(v)],
                color: psiLevel(v) === 2 ? "#1d1a10" : "#fff",
              }}
            >
              <div style={{ fontSize: 36 }}>{r[0].toUpperCase()}</div>
              <div style={{ fontSize: 56, fontWeight: 800, lineHeight: 1 }}>{Number.isFinite(v) ? `${v}` : "-"}</div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          height: 150,
        }}
      >
        <div style={{ ...box, width: 546, justifyContent: "space-between" }}>
          <div style={row}>
            {s.peak && <div style={{ width: 16, height: 110, borderRadius: 8, marginRight: 24, background: pm25Color(s.peak.value) }} />}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div>PM2.5 now</div>
              <div style={{ fontSize: 80, fontWeight: 800, lineHeight: 1 }}>{s.peak ? `${Math.round(s.peak.value)}` : "-"}</div>
            </div>
          </div>
          {trend && <Arrow deg={trend === "up" ? 0 : trend === "down" ? 180 : 90} size={84} />}
        </div>
        {windOk && (
          <div style={{ ...box, width: 546, justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div>Wind</div>
              <div style={{ fontSize: 44, fontWeight: 800 }}>{`from ${src ? src[0].toUpperCase() + src.slice(1) : windFrom(w.windDir)}`}</div>
            </div>
            <Arrow deg={w.windDir + 180} size={84} />
          </div>
        )}
      </div>

      <div
        style={{
          ...box,
          flexDirection: "column",
          alignItems: "stretch",
          justifyContent: "center",
          height: 150,
        }}
      >
        <div
          style={{
            display: "flex",
            height: 56,
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {hourly.map((h) => (
            <div key={h.time} style={{ flex: 1, background: pm25Color(h.pm25) }} />
          ))}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 8,
          }}
        >
          <div>{hourly.length ? `Next 12h · ${fmtHour(hourly[0].time)}` : "Forecast unavailable"}</div>
          {hourly.length > 6 && <div>{fmtHour(hourly[6].time)}</div>}
          {hourly.length > 11 && <div>{fmtHour(hourly[11].time)}</div>}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          height: 130,
        }}
      >
        <div
          style={{
            ...box,
            width: 546,
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "center",
          }}
        >
          <div>{`Cigarettes today: ${cigs ?? "-"}`}</div>
          <div style={{ display: "flex", marginTop: 12 }}>
            {Array.from({ length: cigCount }, (_, i) => (
              <Cig key={i} />
            ))}
          </div>
        </div>
        {win && (
          <div
            style={{
              ...box,
              width: 546,
              flexDirection: "column",
              alignItems: "flex-start",
              justifyContent: "center",
            }}
          >
            <div>{sgDate(0, new Date(win.start)) === sgDate(0) ? "Best time out" : "Best time out tomorrow"}</div>
            <div
              style={{
                fontSize: 52,
                fontWeight: 800,
                lineHeight: 1,
                marginTop: 8,
                padding: "6px 16px",
                borderRadius: 14,
                background: TONE_COLOR[win.verdict.tone].bg,
                color: TONE_COLOR[win.verdict.tone].fg,
              }}
            >
              {win.text}
            </div>
          </div>
        )}
      </div>

      <Footer time={fmtTime(nea.time)} />
    </Shell>,
  );
}
