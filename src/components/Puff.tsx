import { useId, useRef, type CSSProperties, type ReactNode } from "react";
import { verdictFor, type Step, type Verdict } from "@/lib/bands";
import { fadeLayers, useLeaving } from "./puffFade";
import { REST, rigStyle, type PartName, type Pose, type PuffReaction } from "./puffRig";
import { usePuffRig } from "./usePuffRig";

/** How Puff feels; the face, colour and motion all follow from it. */
export type PuffMood = "happy" | "uneasy" | "worried" | "sad" | "sleepy";

const TONE_MOOD: Record<Verdict["tone"], PuffMood> = { go: "happy", easy: "uneasy", limit: "worried", stay: "sad" };
const MASK_STEP: Step = 5;

/** Puff's mood for an advice step (asleep when there is no reading). The worst step also puts on a mask. */
export function puffMood(step: Step | null): { mood: PuffMood; mask: boolean } {
  return { mood: step == null ? "sleepy" : TONE_MOOD[verdictFor(step).tone], mask: step === MASK_STEP };
}

/** The size of Puff's drawing; the box it fills, in the same units the scene behind it is drawn in. */
export const PUFF_VIEW = { w: 128, h: 112 };

/** What Puff shows: its mood's face, or for a moment after a tap a reaction face. */
type PuffFace = PuffMood | PuffReaction;

// Per mood: the clay colours (top and bottom of the base, the core shadow, the deep outline, the bounce light, the top light), the blush, the breath's period and how deep it breathes.
const LOOK: Record<PuffMood, { top: string; bottom: string; shade: string; line: string; bounce: string; glow: string; blush: number; secs: number; breath: number }> = {
  happy: { top: "#ffffff", bottom: "#dde8f4", shade: "#7d9ac2", line: "#516f99", bounce: "#f2f8ff", glow: "#8cc4f0", blush: 0.75, secs: 4.4, breath: 0.015 },
  uneasy: { top: "#fcfbf7", bottom: "#e4dfd2", shade: "#9a927c", line: "#6d6652", bounce: "#faf7ee", glow: "#a6cbe8", blush: 0.35, secs: 5.8, breath: 0.015 },
  worried: { top: "#f8f2e7", bottom: "#decfb6", shade: "#9a8460", line: "#6c5a38", bounce: "#f6ecd8", glow: "#ffffff", blush: 0.25, secs: 5.4, breath: 0.015 },
  sad: { top: "#e8ebf2", bottom: "#b6bdce", shade: "#58637d", line: "#38425a", bounce: "#c9d0e0", glow: "#ffffff", blush: 0, secs: 7.7, breath: 0.012 },
  sleepy: { top: "#ffffff", bottom: "#e0e8f4", shade: "#8296bb", line: "#566d96", bounce: "#f2f7ff", glow: "#8cc4f0", blush: 0.5, secs: 8.5, breath: 0.03 },
};

/** A colour change takes this long: the body's colours tween while the face cross-fades. */
const TWEEN = "500ms ease";
const tween = (prop: "stopColor" | "stroke" | "fill" | "opacity", value: string | number): CSSProperties => ({
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

// The hands and feet are drawn about their pivots at (0,0): the wrist of a left mitt (a right one mirrors it), the heel of a foot.
// The mitt is a plain round paw with no thumb or finger: any bump that points up reads as a rude gesture when it waves.
const MITT = "M0-.4C3.3-.4 5.4 1.9 5.4 4.5C5.4 7.3 3 9.1 0 9.1C-3 9.1-5.4 7.3-5.4 4.5C-5.4 1.9-3.3-.4 0-.4Z";
const FOOT = "M-7 -3.2C-7.4 -6.6-4.8 -8-1 -8C3 -8 7.4 -6.4 7.4 -3C7.4 -.8 5.6 0 3 0L-3.4 0C-5.6 0-6.8-1-7-3.2Z";
// Where each rig part is anchored. The root pivots about the middle of the character, the body at the bottom of its belly; the others hang off the root.
const AT = {
  shadow: [64, 106.5],
  root: [64, 64],
  body: [0, 30],
  handL: [-58, -8],
  handR: [58, -8],
  footL: [-15, 41],
  footR: [15, 41],
} as const;
// The body is drawn in its own larger units and shrunk so that hands and feet fit round it inside the box.
const BODY_SCALE = 0.82;

type Cadence = CSSProperties & { "--puff-fall"?: string; "--puff-breath"?: string };

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

/** Eyes: tall dark ovals with two highlights; sad ones droop at the outer corner (and shine with tears unless `tears` is off). Both blink, the second a beat later. */
function Eyes({ mood, uid, tears = true }: { mood: PuffMood; uid: string; tears?: boolean }) {
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
              {sad && tears && <ellipse cx={cx} cy={EYE_Y + 5.8} rx="4.4" ry="1.2" fill={TEAR} opacity=".6" />}
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

/** The mouth for a face; the happy one is an open D with a tiny tongue, the sad one trembles, a startled one is a round o. */
function Mouth({ face, uid }: { face: PuffFace; uid: string }) {
  const line = { fill: "none", stroke: INK, strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  if (face === "happy" || face === "giggle") {
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
  if (face === "uneasy") return <path d="M59 81.6Q62 79.6 64.5 81.4T70 80.8" {...line} strokeWidth={2} />;
  if (face === "worried") return <path d="M58 82q2-3 4 0t4 0t4 0" {...line} strokeWidth={2} />;
  if (face === "sad") return <path d="M57 85Q64 78.5 71 85" {...line} className="animate-puff-tremble" />;
  if (face === "brave") return <path d="M58.5 82.5Q64 86.5 69.5 82.5" {...line} strokeWidth={2} />;
  if (face === "startled") return <ellipse cx="64" cy="82" rx="3.2" ry="3.9" fill={MOUTH} />;
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

/** Closed eyes: sleepy ones curve down, giggling ones are a happy ^ ^. */
function ClosedEyes({ up }: { up: boolean }) {
  return (
    <g fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round">
      {EYES.map((cx) => (
        <path key={cx} d={up ? `M${cx - 6} ${EYE_Y + 3}Q${cx} ${EYE_Y - 6} ${cx + 6} ${EYE_Y + 3}` : `M${cx - 6} ${EYE_Y + 1}Q${cx} ${EYE_Y + 7} ${cx + 6} ${EYE_Y + 1}`} />
      ))}
    </g>
  );
}

/**
 * The face: eyes, brows and mouth, in a wrapper the rig moves to direct the gaze. Sleepy and giggling faces have closed eyes; the
 * rest look out and drift. A brave face is the sad eyes without tears and a small smile; a startled one has wide eyes and an o.
 */
function Face({ face, uid }: { face: PuffFace; uid: string }) {
  const open: PuffMood = face === "brave" ? "sad" : face === "startled" || face === "giggle" ? "happy" : face;
  const brows = face === "brave" ? "uneasy" : face === "uneasy" || face === "worried" || face === "sad" ? face : null;
  return (
    <>
      <g data-rig="eyes" style={rigStyle()}>
        {face === "sleepy" || face === "giggle" ? <ClosedEyes up={face === "giggle"} /> : <Eyes mood={open} uid={uid} tears={face !== "brave"} />}
      </g>
      {brows && <Brows mood={brows} />}
      <Mouth face={face} uid={uid} />
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

/** A rig part: a static anchor (relative to its parent part), then the group the rig animates, starting at its rest pose. */
function Part({ name, at, rest = {}, children }: { name: PartName | "shadow"; at: readonly [number, number]; rest?: Pose; children: ReactNode }) {
  return (
    <g transform={`translate(${at[0]} ${at[1]})`}>
      <g data-rig={name} style={rigStyle(rest)}>
        {children}
      </g>
    </g>
  );
}

/** A round mitt with a hint of core shadow; `right` mirrors the left one. */
function Mitt({ uid, line, right }: { uid: string; line: string; right?: boolean }) {
  return (
    <g transform={right ? "scale(-1 1)" : undefined}>
      <path d={MITT} fill={`url(#${uid}-body)`} />
      <ellipse cx="1" cy="9.5" rx="7.5" ry="5" fill={`url(#${uid}-shade)`} clipPath={`url(#${uid}-mitt)`} />
      <path d={MITT} fill="none" strokeWidth="2" strokeLinejoin="round" style={tween("stroke", line)} />
      <circle cx="-2.2" cy="2.8" r="1.1" fill="#fff" opacity=".85" />
    </g>
  );
}

/** A bean foot with a darker sole. */
function Foot({ uid, look }: { uid: string; look: (typeof LOOK)[PuffMood] }) {
  return (
    <g>
      <path d={FOOT} fill={`url(#${uid}-body)`} />
      <rect x="-9" y="-2.8" width="18" height="3.4" fillOpacity=".45" clipPath={`url(#${uid}-foot)`} style={tween("fill", look.shade)} />
      <path d={FOOT} fill="none" strokeWidth="2" strokeLinejoin="round" style={tween("stroke", look.line)} />
      <ellipse cx="-2.4" cy="-5.4" rx="2.4" ry="1" fill="#fff" opacity=".7" />
    </g>
  );
}

/**
 * Puff, the cloud mascot: a soft clay character with floating mitts and feet (no arms or legs), as an inline SVG that feels the air
 * (see `puffMood`). It is a button ("Say hi to Puff"): a tap squishes, jumps and waves to suit the mood, and three quick taps spin it.
 * The SVG itself is decorative, so hidden from assistive tech; the verdict text already says what Puff shows. Size it with `className`
 * (the width; the height follows `PUFF_VIEW`); it may jump above the box, so put it where the parent clips overflow.
 * Motion is acted, not looped (see `puffRig`, `usePuffRig`): each mood has its own routines (hops and waves, weight shifts, fidgets,
 * slumps and shuffles, nodding off) with anticipation, squash and stretch and follow-through, and a mood change hops into the new
 * pose. With reduced motion it keeps a still pose. When the mood changes the body colours tween and the old face fades out as the
 * new one fades in; nothing remounts, so nothing shifts.
 */
export default function Puff({ step, className = "" }: { step: Step | null; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const svg = useRef<SVGSVGElement>(null);
  const { mood, mask } = puffMood(step);
  const { poke, reaction } = usePuffRig(svg, mood, mask);
  const face: PuffFace = reaction ?? mood;
  const look = LOOK[mood];
  const rest = REST[mood];
  const goneMood = useLeaving(mood);
  const goneFace = useLeaving(face);
  const goneMask = useLeaving(mask);
  const breathe: Cadence = { animationDuration: `${look.secs}s`, "--puff-breath": `${look.breath}` };
  const stops = (id: string, ...ops: Array<[number, string, number]>) =>
    ops.map(([offset, color, opacity]) => <stop key={`${id}${offset}`} offset={offset} style={tween("stopColor", color)} stopOpacity={opacity} />);

  return (
    <button
      type="button"
      aria-label="Say hi to Puff"
      onClick={poke}
      className={`block cursor-pointer rounded-[28px] bg-transparent p-0 [-webkit-tap-highlight-color:transparent] ${className}`}
    >
      <svg
        ref={svg}
        viewBox={`0 0 ${PUFF_VIEW.w} ${PUFF_VIEW.h}`}
        aria-hidden="true"
        className="pointer-events-none block w-full select-none overflow-visible"
        style={{ aspectRatio: `${PUFF_VIEW.w} / ${PUFF_VIEW.h}` }}
      >
        <defs>
          <linearGradient id={`${uid}-body`} x1="0" y1="0" x2="0" y2="1">
            {stops("b", [0, look.top, 1], [1, look.bottom, 1])}
          </linearGradient>
          <radialGradient id={`${uid}-shade`}>{stops("s", [0, look.shade, 0.5], [0.55, look.shade, 0.26], [1, look.shade, 0])}</radialGradient>
          <linearGradient id={`${uid}-bounce`} x1="0" y1="0" x2="0" y2="1">
            {stops("r", [0.78, look.bounce, 0], [1, look.bounce, 0.85])}
          </linearGradient>
          <linearGradient id={`${uid}-top`} x1="0" y1="0" x2="0" y2="1">
            {stops("t", [0, look.glow, 0.5], [0.22, look.glow, 0])}
          </linearGradient>
          <radialGradient id={`${uid}-spec`}>
            <stop offset="0" stopColor="#fff" stopOpacity=".8" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${uid}-ground`}>
            <stop offset="0" stopColor="#1a1a22" stopOpacity=".5" />
            <stop offset=".6" stopColor="#1a1a22" stopOpacity=".26" />
            <stop offset="1" stopColor="#1a1a22" stopOpacity="0" />
          </radialGradient>
          <clipPath id={`${uid}-clip`}>
            <path d={BODY} />
          </clipPath>
          <clipPath id={`${uid}-mitt`}>
            <path d={MITT} />
          </clipPath>
          <clipPath id={`${uid}-foot`}>
            <path d={FOOT} />
          </clipPath>
        </defs>

        <Part name="shadow" at={AT.shadow}>
          <ellipse rx="36" ry="4.4" fill={`url(#${uid}-ground)`} />
        </Part>
        {fadeLayers(mood, goneMood, (m) => (
          <Backdrop mood={m} />
        ))}

        <Part name="root" at={AT.root} rest={rest.root}>
          <Part name="body" at={AT.body} rest={rest.body}>
            <g transform={`scale(${BODY_SCALE}) translate(-64 -98)`}>
              <g className="animate-puff-breathe origin-bottom" style={breathe}>
                {fadeLayers(mood, goneMood, (m) => (m === "sad" ? [40, 88].map((x, i) => <Drop key={x} x={x} y={96} fall={8} secs={2.4} delay={i * 1.1} size={0.85} />) : null))}
                <path d={BODY} fill={`url(#${uid}-body)`} />
                <ellipse cx="63" cy="94" rx="70" ry="34" fill={`url(#${uid}-shade)`} clipPath={`url(#${uid}-clip)`} />
                <path d={BODY} fill="none" stroke={`url(#${uid}-bounce)`} strokeWidth="7" clipPath={`url(#${uid}-clip)`} />
                <path d={BODY} fill="none" stroke={`url(#${uid}-top)`} strokeWidth="5" clipPath={`url(#${uid}-clip)`} />
                <ellipse cx="48" cy="33" rx="19" ry="11" transform="rotate(-32 48 33)" fill={`url(#${uid}-spec)`} clipPath={`url(#${uid}-clip)`} />
                <path d={BODY} fill="none" strokeWidth="2.9" strokeLinejoin="round" style={tween("stroke", look.line)} />
                <ellipse cx="51" cy="30" rx="8.5" ry="4.5" transform="rotate(-32 51 30)" fill="#fff" opacity=".85" />
                <circle cx="42.5" cy="38.5" r="2" fill="#fff" opacity=".7" />

                <g transform={`translate(0 ${FACE_Y})`}>
                  <g fill="#ff9aa8" style={tween("opacity", look.blush)}>
                    <ellipse cx="38" cy="76" rx="6.5" ry="3.8" />
                    <ellipse cx="90" cy="76" rx="6.5" ry="3.8" />
                  </g>
                  {fadeLayers(face, goneFace, (f) => (
                    <Face face={f} uid={`${uid}-${f}`} />
                  ))}
                  {fadeLayers(mask ? "mask" : null, goneMask && { v: goneMask.v ? "mask" : null }, (m) => (m ? <Mask /> : null))}
                </g>
                {fadeLayers(mood, goneMood, (m) => (
                  <Extras mood={m} />
                ))}
              </g>
            </g>
          </Part>
          <Part name="footL" at={AT.footL} rest={rest.footL}>
            <Foot uid={uid} look={look} />
          </Part>
          <Part name="footR" at={AT.footR} rest={rest.footR}>
            <Foot uid={uid} look={look} />
          </Part>
          <Part name="handL" at={AT.handL} rest={rest.handL}>
            <Mitt uid={uid} line={look.line} />
          </Part>
          <Part name="handR" at={AT.handR} rest={rest.handR}>
            <Mitt uid={uid} line={look.line} right />
          </Part>
        </Part>
      </svg>
    </button>
  );
}
