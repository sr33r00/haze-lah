import { INK, LogoMark } from "./appIcon";
import { fmtDate } from "./format";
import { onImage } from "./satellite";
import { FIRE_COLOR, TRAIL_COLOR, isNearTrail, journeyText } from "./replay";
import type { ReplayDay } from "./types";
import { SG } from "./util";

/** Size of the "Your air's journey" picture. */
export const JOURNEY_SIZE = { width: 1080, height: 1350 };

const row = { display: "flex", alignItems: "center" } as const;
const col = { display: "flex", flexDirection: "column" } as const;

const PANEL = { w: 968, h: Math.round((968 * 520) / 1000) }; // the relief map keeps its 1000:520 shape
const S = PANEL.w / 1000;
const xy = ([lat, lon]: [number, number]) => {
  const p = onImage(lat, lon);
  return [Math.round((p.x / 100) * 1000 * S), Math.round((p.y / 100) * 520 * S)] as const;
};

/** The air's path over the relief map: the start, the fires it passed and Singapore. `relief` is the map as a data URL. */
function PathPanel({ day, relief }: { day: ReplayDay; relief: string }) {
  const trail = day.trail.map(xy);
  const fires = day.fires.filter((p) => isNearTrail(day.trail, p)).map(xy);
  const [sx, sy] = xy([SG.lat, SG.lon]);
  const [ox, oy] = trail.at(-1)!;
  const line = trail.map((p) => p.join(",")).join(" ");
  return (
    <div style={{ display: "flex", position: "relative", width: PANEL.w, height: PANEL.h, borderRadius: 36, background: INK, overflow: "hidden" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- rendered to a PNG, not shown in a page */}
      <img src={relief} alt="" width={PANEL.w} height={PANEL.h} style={{ position: "absolute", left: 0, top: 0 }} />
      <svg width={PANEL.w} height={PANEL.h} viewBox={`0 0 ${PANEL.w} ${PANEL.h}`} style={{ position: "absolute", left: 0, top: 0 }}>
        {fires.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r={6} fill={FIRE_COLOR} fillOpacity={0.9} />
        ))}
        <polyline points={line} fill="none" stroke={TRAIL_COLOR} strokeOpacity={0.35} strokeWidth={20} strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={line} fill="none" stroke={TRAIL_COLOR} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={ox} cy={oy} r={13} fill="#fff" stroke={TRAIL_COLOR} strokeWidth={6} />
        <circle cx={sx} cy={sy} r={24} fill="none" stroke="#fff" strokeWidth={4} />
        <circle cx={sx} cy={sy} r={11} fill="#fff" />
      </svg>
      <div
        style={{
          position: "absolute",
          top: sy - 20,
          left: sx + 38,
          fontSize: 30,
          fontWeight: 800,
          color: "#fff",
          background: "rgba(19,35,46,0.8)",
          padding: "2px 14px",
          borderRadius: 10,
        }}
      >
        Singapore
      </div>
    </div>
  );
}

/** Left and right end of the ticket: a small label, the place and the time. */
const End = ({ text, at, align }: { text: string; at: string; align: "flex-start" | "flex-end" }) => (
  <div style={{ ...col, flex: 1, alignItems: align, textAlign: align === "flex-end" ? "right" : "left" }}>
    <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.15 }}>{text}</div>
    <div style={{ fontSize: 32, marginTop: 8, color: "#566773" }}>{at}</div>
  </div>
);

/** "Today's air in Singapore": the picture shared from the journey strip. 1080 x 1350. `relief` is the map of `SAT_BOX` as a data URL. */
export function JourneyCard({ day, relief }: { day: ReplayDay; relief: string }) {
  const t = journeyText(day);
  return (
    <div style={{ ...col, width: "100%", height: "100%", justifyContent: "space-between", padding: 56, background: "#e9eef1", color: INK, fontSize: 36 }}>
      <div style={row}>
        <LogoMark size={72} />
        <div style={{ fontSize: 44, fontWeight: 800, marginLeft: 20 }}>Haze Lah</div>
      </div>
      <div style={{ ...col, marginTop: 24 }}>
        <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.05 }}>Today&apos;s air in Singapore</div>
        <div style={{ fontSize: 34, marginTop: 12, color: "#566773" }}>{fmtDate(day.date)}</div>
      </div>
      {t ? (
        <div style={{ ...col, gap: 20 }}>
          <PathPanel day={day} relief={relief} />
          <div style={{ ...col, background: "#fff", borderRadius: 32, padding: "28px 40px" }}>
            <div style={{ ...row, alignItems: "flex-start", justifyContent: "space-between" }}>
              <End text={t.left} at={t.leftAt} align="flex-start" />
              <End text={t.reached} at={t.reachedAt} align="flex-end" />
            </div>
            <div style={{ ...row, justifyContent: "center", position: "relative", height: 40, marginTop: 24 }}>
              <div style={{ position: "absolute", left: 0, right: 0, top: 18, borderTop: `5px dashed ${TRAIL_COLOR}` }} />
              <div style={{ fontSize: 28, fontWeight: 700, background: "#fff", padding: "0 20px" }}>{t.trip}</div>
            </div>
            <div style={{ ...row, marginTop: 24 }}>
              {day.near > 0 && <div style={{ width: 20, height: 20, borderRadius: 10, background: FIRE_COLOR, marginRight: 16 }} />}
              <div style={{ fontSize: 40, fontWeight: 800 }}>{t.fires}</div>
            </div>
          </div>
          <div style={{ fontSize: 26, color: "#566773" }}>Traced back 3 days along the wind. Fires near the path are a likely, not certain, source.</div>
        </div>
      ) : (
        <div style={{ ...col, justifyContent: "center", height: PANEL.h, background: "#fff", borderRadius: 36, padding: "0 56px" }}>
          <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.15 }}>Light winds. The air stayed around Singapore.</div>
        </div>
      )}
      <div style={{ fontSize: 40, fontWeight: 800, marginTop: 8 }}>hazelah.app</div>
    </div>
  );
}
