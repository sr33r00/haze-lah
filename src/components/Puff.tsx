import { useId, type CSSProperties } from "react";
import { verdictFor, type Step, type Verdict } from "@/lib/bands";
import { fadeLayers, useLeaving } from "./puffFade";

/** How Puff feels; the face, colour and motion all follow from it. */
export type PuffMood = "happy" | "uneasy" | "worried" | "sad" | "sleepy";

const TONE_MOOD: Record<Verdict["tone"], PuffMood> = { go: "happy", easy: "uneasy", limit: "worried", stay: "sad" };
const MASK_STEP: Step = 5;

/** Puff's mood for an advice step (asleep when there is no reading). The worst step also puts on a mask. */
export function puffMood(step: Step | null): { mood: PuffMood; mask: boolean } {
  return { mood: step == null ? "sleepy" : TONE_MOOD[verdictFor(step).tone], mask: step === MASK_STEP };
}

// Per mood: the air colour, the outline, rim and top-light shades, the blush, the float rhythm, how hard it lands (sq) and how deep it breathes.
const LOOK: Record<PuffMood, { top: string; bottom: string; line: string; rim: string; glow: string; blush: number; secs: number; lift: number; sq: number; breath: number }> = {
  happy: { top: "#ffffff", bottom: "#eef3f8", line: "#7f93ad", rim: "#a9bcd3", glow: "#8cc4f0", blush: 0.75, secs: 2.6, lift: 4, sq: 1, breath: 0.015 },
  uneasy: { top: "#fbfaf6", bottom: "#ece8df", line: "#8d8777", rim: "#b8b2a3", glow: "#a6cbe8", blush: 0.35, secs: 3.4, lift: 3.5, sq: 0.8, breath: 0.015 },
  worried: { top: "#f7f1e6", bottom: "#e6dccb", line: "#8a7a5c", rim: "#b5a78a", glow: "#ffffff", blush: 0.25, secs: 3.2, lift: 3.5, sq: 0.8, breath: 0.015 },
  sad: { top: "#e6e9f0", bottom: "#c3c9d6", line: "#4f5a70", rim: "#8f9ab0", glow: "#ffffff", blush: 0, secs: 4.5, lift: 2.5, sq: 0.5, breath: 0.012 },
  sleepy: { top: "#ffffff", bottom: "#eef3f8", line: "#7f93ad", rim: "#a9bcd3", glow: "#8cc4f0", blush: 0.5, secs: 5, lift: 2.5, sq: 0.5, breath: 0.03 },
};

/** A colour change takes this long: the body's colours tween while the face cross-fades. */
const TWEEN = "500ms ease";
const tween = (prop: "stopColor" | "stroke" | "opacity", value: string | number): CSSProperties => ({
  [prop]: value,
  transition: `${prop === "stopColor" ? "stop-color" : prop} ${TWEEN}`,
});

const INK = "#2a2a35";
const MOUTH = "#7c2d3b";
const TEAR = "#8fd3ff";
const TEAR_LINE = "#4fa6dc";
const EYES = [46, 82] as const;
// The face sits a little below the coordinates it is drawn in, about 57% of the way down the body.
const FACE_Y = 2;
const EYE_Y = 63;
// One smooth silhouette: three top bumps (small left, big middle, medium right) on a plump rounded base, about 1.4 : 1.
const BODY =
  "M39.5 45.3A18 18 0 0 0 7.9 61.6C14.1 80.6 40 98 63 98C86 98 113.9 81.9 120.1 62.9A19 19 0 0 0 87.5 44.7A24 24 0 1 0 39.5 45.3Z";
const DROP = "M0-4.6C1.8-1.8 3-.2 3 1.6A3 3 0 0 1-3 1.6C-3-.2-1.8-1.8 0-4.6Z";
const STAR = "M0-6Q1-1 6 0Q1 1 0 6Q-1 1-6 0Q-1-1 0-6Z";

type Cadence = CSSProperties & { "--puff-lift"?: string; "--puff-fall"?: string; "--puff-sq"?: string; "--puff-breath"?: string };

/** A small light-blue drop (tear, rain or sweat) that forms, slides down `fall` units and fades; at rest it sits mid-fall. */
function Drop(props: { x: number; y: number; fall: number; secs: number; delay: number; size?: number }) {
  const style: Cadence = { animationDuration: `${props.secs}s`, animationDelay: `${props.delay}s`, "--puff-fall": `${props.fall}px` };
  return (
    <g transform={`translate(${props.x} ${props.y}) scale(${props.size ?? 1})`}>
      <g className="animate-puff-drip" style={style}>
        <path d={DROP} fill={TEAR} stroke={TEAR_LINE} strokeWidth=".8" />
        <circle cx="-1" cy=".9" r=".8" fill="#fff" opacity=".85" />
      </g>
    </g>
  );
}

/** A four-point sparkle in a soft, edgeless glow that twinkles; at rest it is full size. */
function Sparkle(props: { x: number; y: number; size: number; delay: number }) {
  return (
    <g transform={`translate(${props.x} ${props.y}) scale(${props.size})`}>
      <g className="animate-puff-twinkle" style={{ animationDelay: `${props.delay}s` }}>
        <circle r="8" fill="#fff3b0" opacity=".08" />
        <circle r="5" fill="#fff3b0" opacity=".14" />
        <path d={STAR} fill="#fff3b0" />
      </g>
    </g>
  );
}

/** Eyes: tall dark ovals with two highlights; sad ones droop at the outer corner. Both blink, the second a beat later. */
function Eyes({ mood, uid }: { mood: PuffMood; uid: string }) {
  const sad = mood === "sad";
  // Unease glances away now and then, slowly; worry looks around more.
  const glance = mood === "uneasy" ? { animationDuration: "9s" } : undefined;
  // Besides the glance, the eyes always drift a pixel or so on a long, uneven loop.
  return (
    <g className="animate-puff-gaze">
    <g className={mood === "worried" || mood === "uneasy" ? "animate-puff-glance" : undefined} style={glance}>
      {EYES.map((cx, i) => {
        // Lid heights at the left and right edge: the outer corner droops.
        const [yl, yr] = i === 0 ? [-3, -8] : [-8, -3];
        const clip = sad ? `url(#${uid}-lid${i})` : undefined;
        return (
          <g key={cx} className="animate-puff-blink" style={{ animationDelay: `${i * 0.04}s` }}>
            {clip && (
              <clipPath id={`${uid}-lid${i}`}>
                <polygon points={`${cx - 9},${EYE_Y + yl} ${cx + 9},${EYE_Y + yr} ${cx + 9},${EYE_Y + 11} ${cx - 9},${EYE_Y + 11}`} />
              </clipPath>
            )}
            <g clipPath={clip}>
              <ellipse cx={cx} cy={EYE_Y} rx="6.2" ry="8.2" fill={INK} />
              <circle cx={cx - 2} cy={EYE_Y - (sad ? 1.4 : 3.4)} r={sad ? 3.2 : 2.5} fill="#fff" />
              <circle cx={cx + 2.3} cy={EYE_Y + 3.4} r={sad ? 1.6 : 1.2} fill="#fff" />
              {sad && <ellipse cx={cx} cy={EYE_Y + 5.8} rx="4.4" ry="1.2" fill={TEAR} opacity=".6" />}
            </g>
          </g>
        );
      })}
    </g>
    </g>
  );
}

// Brows over the left eye (the right one mirrors it): short soft arcs, the inner end raised more as the mood gets heavier.
const BROWS = {
  uneasy: { d: "M41.5 49.5Q46 47.6 50.5 47", w: 1.6, o: 0.5 },
  worried: { d: "M41 50Q46 46.5 50.5 44.8", w: 2.2, o: 0.7 },
  sad: { d: "M41 51.5Q46 46.5 51 42", w: 2.2, o: 0.7 },
} as const;

/** Eyebrows tilted up in the middle. */
function Brows({ mood }: { mood: keyof typeof BROWS }) {
  const b = BROWS[mood];
  return (
    <g fill="none" stroke={INK} strokeOpacity={b.o} strokeWidth={b.w} strokeLinecap="round">
      <path d={b.d} />
      <path d={b.d} transform="translate(128 0) scale(-1 1)" />
    </g>
  );
}

/** The mouth for a mood; the happy one is an open D with a tiny tongue, the sad one trembles. */
function Mouth({ mood, uid }: { mood: PuffMood; uid: string }) {
  const line = { fill: "none", stroke: INK, strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  if (mood === "happy") {
    const d = "M53.5 74.5Q64 77 74.5 74.5Q74 89 64 89Q54 89 53.5 74.5Z";
    return (
      <g>
        <clipPath id={`${uid}-mouth`}>
          <path d={d} />
        </clipPath>
        <path d={d} fill={MOUTH} />
        <ellipse cx="64" cy="87.5" rx="5.2" ry="3.6" fill="#ff8fa3" clipPath={`url(#${uid}-mouth)`} />
      </g>
    );
  }
  if (mood === "uneasy") return <path d="M59 81.6Q62 79.6 64.5 81.4T70 80.8" {...line} strokeWidth={2} />;
  if (mood === "worried") return <path d="M58 82q2-3 4 0t4 0t4 0" {...line} strokeWidth={2} />;
  if (mood === "sad") return <path d="M57 85Q64 78.5 71 85" {...line} className="animate-puff-tremble" />;
  return <ellipse cx="64" cy="81" rx="2.1" ry="2.5" fill={MOUTH} />;
}

/** A light-blue surgical mask over the mouth: pleats, a soft shadow, and ear loops that stay inside the body. */
function Mask() {
  const mask = "M50 73Q64 70 78 73L76.5 85Q64 90 51.5 85Z";
  return (
    <g strokeLinecap="round">
      <g fill="none" stroke="#8fb7cf" strokeWidth="1.3">
        <path d="M50 77Q41 73.5 31 78" />
        <path d="M51 84Q42 86.5 33 83.5" />
        <path d="M78 77Q87 73.5 97 78" />
        <path d="M77 84Q86 86.5 95 83.5" />
      </g>
      <path d={mask} transform="translate(0 1.3)" fill="#13232e" opacity=".16" />
      <path d={mask} fill="#bfe3f5" stroke="#7fb4d4" strokeWidth="1" strokeLinejoin="round" />
      <g fill="none" stroke="#8ec1de" strokeWidth="1">
        <path d="M52.5 77.5Q64 75.5 75.5 77.5" />
        <path d="M52 81Q64 79 76 81" />
        <path d="M52.5 84.2Q64 82.2 75.5 84.2" />
      </g>
    </g>
  );
}

/** The face for a mood: eyes, brows and mouth. Sleepy has closed eyes; the rest look out and drift. */
function Face({ mood, uid }: { mood: PuffMood; uid: string }) {
  if (mood === "sleepy") {
    return (
      <>
        <g fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round">
          {EYES.map((cx) => (
            <path key={cx} d={`M${cx - 6} ${EYE_Y + 1}Q${cx} ${EYE_Y + 7} ${cx + 6} ${EYE_Y + 1}`} />
          ))}
        </g>
        <Mouth mood={mood} uid={uid} />
      </>
    );
  }
  return (
    <>
      <Eyes mood={mood} uid={uid} />
      {(mood === "uneasy" || mood === "worried" || mood === "sad") && <Brows mood={mood} />}
      <Mouth mood={mood} uid={uid} />
    </>
  );
}

/** What a mood adds in front of the body: the sad cheeks' tear streaks and drops, the worried sweat drop. */
function Extras({ mood }: { mood: PuffMood }) {
  if (mood === "sad") {
    return (
      <>
        <g fill="none" stroke={TEAR} strokeWidth="2.4" strokeLinecap="round" opacity=".45">
          <path d="M40.5 73Q38 80 39 88" />
          <path d="M87.5 73Q90 80 89 88" />
        </g>
        <Drop x={39} y={82} fall={10} secs={2.6} delay={0} />
        <Drop x={89} y={82} fall={10} secs={2.6} delay={0.9} />
      </>
    );
  }
  return mood === "worried" ? <Drop x={106} y={50} fall={10} secs={3} delay={0} /> : null;
}

/** Little extras that do not move with the body: a happy sparkle or two, the sleepy z's. */
function Backdrop({ mood }: { mood: PuffMood }) {
  if (mood === "happy") {
    return (
      <>
        <Sparkle x={118} y={44} size={0.8} delay={0} />
        <Sparkle x={14} y={30} size={0.75} delay={0.9} />
      </>
    );
  }
  if (mood !== "sleepy") return null;
  return (
    <>
      {[
        { x: 98, y: 29, size: 9, delay: 0 },
        { x: 106, y: 19, size: 11, delay: 1.2 },
        { x: 114, y: 9, size: 13, delay: 2.4 },
      ].map((z) => (
        <text key={z.delay} x={z.x} y={z.y} fontSize={z.size} fontWeight="800" textAnchor="middle" fill="currentColor" opacity=".6" className="animate-puff-z" style={{ animationDelay: `${z.delay}s` }}>
          z
        </text>
      ))}
    </>
  );
}

/**
 * Puff, the cloud mascot: an inline SVG that feels the air (see `puffMood`). Decorative, so hidden from assistive tech;
 * the verdict text already says what Puff shows. Size it with `className` (the width; the height follows the viewBox).
 * Motion: a soft eased float, a squash as it lands, a slow breath, drifting eyes and blinks. When the mood changes the body
 * colours tween, the old face fades out as the new one fades in, and the body hops once; nothing remounts, so nothing shifts.
 */
export default function Puff({ step, className = "" }: { step: Step | null; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const { mood, mask } = puffMood(step);
  const look = LOOK[mood];
  const goneMood = useLeaving(mood);
  const goneMask = useLeaving(mask);
  const cadence: Cadence = { animationDuration: `${look.secs}s`, "--puff-lift": `${look.lift}px` };
  const land: Cadence = { animationDuration: `${look.secs}s`, "--puff-sq": `${look.sq}` };
  const breathe: Cadence = { animationDuration: `${(look.secs * 1.7).toFixed(2)}s`, "--puff-breath": `${look.breath}` };

  return (
    <svg viewBox="0 0 128 112" aria-hidden="true" className={`pointer-events-none aspect-[128/112] shrink-0 select-none ${className}`}>
      <defs>
        <linearGradient id={`${uid}-body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={tween("stopColor", look.top)} />
          <stop offset="1" style={tween("stopColor", look.bottom)} />
        </linearGradient>
        <linearGradient id={`${uid}-top`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={tween("stopColor", look.glow)} stopOpacity=".5" />
          <stop offset=".22" style={tween("stopColor", look.glow)} stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${uid}-rim`} cx=".5" cy="1" r=".75">
          <stop offset="0" style={tween("stopColor", look.rim)} stopOpacity=".7" />
          <stop offset=".6" style={tween("stopColor", look.rim)} stopOpacity=".25" />
          <stop offset="1" style={tween("stopColor", look.rim)} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}-ground`}>
          <stop offset="0" stopColor="#1a1a22" stopOpacity=".4" />
          <stop offset="1" stopColor="#1a1a22" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${uid}-clip`}>
          <path d={BODY} />
        </clipPath>
      </defs>

      <ellipse cx="64" cy="106" rx="38" ry="4.6" fill={`url(#${uid}-ground)`} className="animate-puff-shadow" style={cadence} />
      {fadeLayers(mood, goneMood, (m) => (
        <Backdrop mood={m} />
      ))}

      <g className="animate-puff-float" style={cadence}>
        <g className={goneMood ? "animate-puff-hop origin-bottom" : "origin-bottom"}>
          <g className="animate-puff-land origin-bottom" style={land}>
            <g className="animate-puff-breathe origin-bottom" style={breathe}>
              {fadeLayers(mood, goneMood, (m) => (m === "sad" ? [50, 76].map((x, i) => <Drop key={x} x={x} y={101} fall={8} secs={2.4} delay={i * 1.1} size={0.85} />) : null))}
              <path d={BODY} fill={`url(#${uid}-body)`} />
              <ellipse cx="63" cy="100" rx="62" ry="32" fill={`url(#${uid}-rim)`} clipPath={`url(#${uid}-clip)`} />
              <path d={BODY} fill="none" style={{ ...tween("stroke", look.line), strokeOpacity: 0.35 }} strokeWidth="1.5" strokeLinejoin="round" />
              <path d={BODY} fill="none" stroke={`url(#${uid}-top)`} strokeWidth="4" clipPath={`url(#${uid}-clip)`} />
              <ellipse cx="51" cy="30" rx="8.5" ry="4.5" transform="rotate(-32 51 30)" fill="#fff" opacity=".85" />
              <circle cx="42.5" cy="38.5" r="2" fill="#fff" opacity=".7" />

              <g transform={`translate(0 ${FACE_Y})`}>
                <g fill="#ff9aa8" style={tween("opacity", look.blush)}>
                  <ellipse cx="38" cy="76" rx="6.5" ry="3.8" />
                  <ellipse cx="90" cy="76" rx="6.5" ry="3.8" />
                </g>
                {fadeLayers(mood, goneMood, (m) => (
                  <Face mood={m} uid={`${uid}-${m}`} />
                ))}
                {fadeLayers(mask ? "mask" : null, goneMask && { v: goneMask.v ? "mask" : null }, (m) => (m ? <Mask /> : null))}
              </g>
              {fadeLayers(mood, goneMood, (m) => (
                <Extras mood={m} />
              ))}
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}
