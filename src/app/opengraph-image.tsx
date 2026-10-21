import { ImageResponse } from "next/og";
import { LogoMark } from "@/lib/appIcon";
import { LEVEL_COLOR, LEVEL_NAME } from "@/lib/bands";
import { getHazeData } from "@/lib/data";
import { islandSummary } from "@/lib/situation";

export const revalidate = 300;
export const alt = "Haze Lah: live Singapore haze";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const s = islandSummary(await getHazeData().catch(() => ({ nea: null, history: null })));
  const color = s ? LEVEL_COLOR[s.level] : "#13232e";
  const range = s ? (s.psi.min === s.psi.max ? `${s.psi.max}` : `${s.psi.min}-${s.psi.max}`) : "";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#e9eef1", color: "#13232e" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <LogoMark size={96} />
          <div style={{ fontSize: 64, fontWeight: 800, marginLeft: 28 }}>Haze Lah</div>
        </div>
        {s ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "baseline" }}>
              <div style={{ fontSize: 168, fontWeight: 800, color, lineHeight: 1 }}>{range}</div>
              <div style={{ fontSize: 44, marginLeft: 24 }}>24-hr PSI</div>
            </div>
            <div style={{ fontSize: 56, fontWeight: 700, color, marginTop: 12 }}>{LEVEL_NAME[s.level]}</div>
            {s.peak && <div style={{ fontSize: 36, marginTop: 16 }}>{`Highest 1-hr PM2.5: ${Math.round(s.peak.value)} µg/m³`}</div>}
          </div>
        ) : (
          <div style={{ fontSize: 72, fontWeight: 800 }}>Is it safe to go out?</div>
        )}
        <div style={{ fontSize: 34 }}>Live Singapore haze</div>
      </div>
    ),
    size,
  );
}
