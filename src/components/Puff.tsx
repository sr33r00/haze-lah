import { useId, useRef, type CSSProperties, type ReactNode, type SVGProps } from "react";
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

// Puff is drawn in a 200 x 180 frame (design units) and shrunk into the box: scale S, then the offset. The widest thing, the hands
// at the sides, just fits; the ground shadow sits at the bottom edge.
const S = 0.66;
const ORIGIN = { x: -2, y: -6.5 };
const place = (v: number) => Math.round(v * 100) / 100;

// Cumulus lobes lit from the upper left: the base colours of the radial gradient, from the bright core out to the lighter, cooler rim.
const LOBE = ["#ffffff", "#f7f9fd", "#dfe6f2", "#c6d1e5", "#dce5f2"];
const LOBE_AT = [0, 0.48, 0.76, 0.92, 1];

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
/** `a` moved `t` of the way to `b`, as a hex colour. */
function mix(a: string, b: string, t: number) {
  const [p, q] = [rgb(a), rgb(b)];
  return `#${p.map((v, i) => Math.round(v + (q[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}
/** The lobe stops and the sheen with a haze tint baked in (a share `a` of `tint`), so the whole body, hands and feet take it together. */
const cloud = (tint = "#000000", a = 0) => ({ lobe: LOBE.map((c) => mix(c, tint, a)), sheen: mix("#ffffff", tint, a) });

// Per mood: the lobe colours and sheen (a tint over the white and blue), the cool underside shadow, the faint silhouette edge, the
// brow colour, the blush strength, the breath's period and how deep it breathes.
type Look = { lobe: string[]; sheen: string; shade: string; edge: string; brow: string; blush: number; secs: number; breath: number };
const LOOK: Record<PuffMood, Look> = {
  happy: { ...cloud(), shade: "#667aa9", edge: "#adbad2", brow: "#a3b0cb", blush: 1, secs: 4.4, breath: 0.015 },
  uneasy: { ...cloud("#d29a5c", 0.07), shade: "#74799c", edge: "#b9bccf", brow: "#9ea6bc", blush: 0.35, secs: 5.8, breath: 0.015 },
  worried: { ...cloud("#d29a5c", 0.16), shade: "#7a7396", edge: "#c3b7a8", brow: "#8e9bb8", blush: 0.5, secs: 5.4, breath: 0.015 },
  sad: { ...cloud("#5b6378", 0.22), shade: "#4f5775", edge: "#9ca4b8", brow: "#7d8aa6", blush: 0, secs: 7.7, breath: 0.012 },
  sleepy: { ...cloud(), shade: "#6678b0", edge: "#adbad2", brow: "#a3b0cb", blush: 0.8, secs: 8.5, breath: 0.03 },
};

/** A colour change takes this long: the body's colours tween while the face cross-fades. */
const TWEEN = "500ms ease";
const tween = (prop: "stopColor" | "stroke" | "fill" | "opacity", value: string | number): CSSProperties => ({
  [prop]: value,
  transition: `${prop === "stopColor" ? "stop-color" : prop} ${TWEEN}`,
});
const url = (uid: string, id: string) => `url(#${uid}-${id})`;

const INK = "#202a44";
const LINE = "#4a2333";
const TEAR = "#8fd0ff";
const TEAR_LINE = "#4e9fd6";
const DROP = "M0-7C2.6-3 4.4-.6 4.4 2A4.4 4.4 0 0 1-4.4 2C-4.4-.6-2.6-3 0-7Z";
const STAR = "M0-6Q1-1 6 0Q1 1 0 6Q-1 1-6 0Q-1-1 0-6Z";
const MOUTH = "M90 117Q100 121 110 117Q109 131 100 131Q91 131 90 117Z";
const MASK = "M79 112Q100 105 121 112L119 129Q100 137 81 129Z";

// A shape is an ellipse (cx, cy, rx and ry; a circle leaves ry out). The body is five lobes: two cheeks, two top bumps, a big top and a plump base.
type Blob = readonly [cx: number, cy: number, rx: number, ry?: number];
const LOBES: readonly Blob[] = [
  [56, 106, 28],
  [146, 102, 28],
  [76, 72, 25],
  [108, 66, 40],
  [100, 120, 62, 38],
];
// A hand is a cluster of three puffs about its wrist (a left hand's; a right one mirrors the x). A foot is one puff oval about its middle.
const HAND: readonly Blob[] = [
  [-3, 10, 8.5],
  [4, 2, 6.5],
  [5, 14, 6],
];
const FOOT: readonly Blob[] = [[0, -3, 16, 7.5]];

// Where each part pivots, in design units. The root turns about the middle of the character, the body at the bottom of its belly, a
// hand at its wrist, a foot at its middle; every part but the shadow hangs off the root.
const PIVOT = { shadow: [100, 172], root: [100, 104], body: [100, 158], handL: [16, 112], handR: [184, 112], footL: [78, 166], footR: [122, 166] } as const;
type Pt = readonly [number, number];
const inBox = (p: Pt): Pt => [place(p[0] * S + ORIGIN.x), place(p[1] * S + ORIGIN.y)];
const offset = (p: Pt, parent: Pt): Pt => [place((p[0] - parent[0]) * S), place((p[1] - parent[1]) * S)];
const AT = {
  shadow: inBox(PIVOT.shadow),
  root: inBox(PIVOT.root),
  body: offset(PIVOT.body, PIVOT.root),
  handL: offset(PIVOT.handL, PIVOT.root),
  handR: offset(PIVOT.handR, PIVOT.root),
  footL: offset(PIVOT.footL, PIVOT.root),
  footR: offset(PIVOT.footR, PIVOT.root),
};

type Cadence = CSSProperties & { "--puff-fall"?: string; "--puff-breath"?: string };

/** Ellipses from a list of shapes, each grown by `grow` (the silhouette edge is the lobes a unit larger). */
function Blobs({ list, grow = 0, ...rest }: { list: readonly Blob[]; grow?: number } & SVGProps<SVGEllipseElement>) {
  return (
    <>
      {list.map(([cx, cy, rx, ry = rx]) => (
        <ellipse key={`${cx}${cy}`} cx={cx} cy={cy} rx={rx + grow} ry={ry + grow} {...rest} />
      ))}
    </>
  );
}

/** A tear, rain or sweat drop that forms, slides down `fall` units and fades; at rest it sits mid-fall. */
function Drop(props: { uid: string; x: number; y: number; fall: number; secs: number; delay: number; size?: number }) {
  const style: Cadence = { animationDuration: `${props.secs}s`, animationDelay: `${props.delay}s`, "--puff-fall": `${props.fall}px` };
  return (
    <g transform={`translate(${props.x} ${props.y}) scale(${props.size ?? 1})`}>
      <g className="animate-puff-drip" style={style}>
        <path d={DROP} fill={url(props.uid, "drop")} stroke={TEAR_LINE} strokeWidth=".7" />
        <circle cx="-1.5" cy="1.2" r="1" fill="#fff" opacity=".85" />
      </g>
    </g>
  );
}

/** A four-point sparkle in a soft, edgeless glow that twinkles; at rest it is full size. */
export function Sparkle(props: { x: number; y: number; size: number; delay: number }) {
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

// The open eye kinds, about the eye's middle: where the iris sits and how big it is, and the catchlights [x, y, rx, ry, opacity].
// All catchlights sit on the same side (one light source) in both eyes. Sad eyes (a drooping lid, a tear rim) are mirrored on the right.
type Light = readonly [x: number, y: number, rx: number, ry: number, o: number];
type EyeKind = "open" | "aside" | "look" | "startled" | "sad";
const EYES: Record<EyeKind, { iris: readonly [number, number]; ir: number; pr: number; lights: readonly Light[]; scale?: number }> = {
  open: { iris: [0.6, 2], ir: 8, pr: 4, lights: [[-3.2, -3, 3.2, 2.7, 1], [3.8, 5.2, 1.3, 1.3, 0.85]] },
  aside: { iris: [-1, 0.9], ir: 8, pr: 4, lights: [[-4.4, -4, 3.1, 2.6, 1], [2.6, 4.3, 1.25, 1.25, 0.85]] },
  look: { iris: [-2.4, -0.4], ir: 8, pr: 4, lights: [[-5.6, -5, 3, 2.5, 1], [1, 3.4, 1.2, 1.2, 0.85]] },
  startled: { iris: [0, 0.4], ir: 6, pr: 3, scale: 1.1, lights: [[-2.4, -2.6, 2.8, 2.4, 1], [3, 2.8, 1.1, 1.1, 0.85]] },
  sad: { iris: [0.3, 3.6], ir: 8, pr: 4, lights: [[-2.6, -0.6, 3, 2.4, 1], [3.8, 6.6, 1.3, 1.3, 0.85]] },
};
// The lash line along the top of the eye, and the lid that rides on it (everything above the lash line, so a blink slides it down over the eye).
const LASH = { open: "M-10.5 0A10.5 12.5 0 0 1 10.5 0", sad: "M-10.4 -1.6Q0 -8.6 10.4 -8.2" };
const LID = { open: `${LASH.open}H14V-40H-14V0Z`, sad: `${LASH.sad}H14V-40H-14V-1.6Z` };

/**
 * One Pixar-style eye: a sclera with a lid shadow, a blue iris and pupil with two catchlights, and a lash line. The iris and pupil
 * look around inside the sclera (the rig directs them, and they drift on their own), and a blink slides a lid in the body's colour
 * down over the eye with the lash line riding on it. A sad eye has a drooping lid, and a tear rim unless `tears` is off.
 */
function Eye({ kind, x, y, mirror, tears, glance, lid, beat, uid }: { kind: EyeKind; x: number; y: number; mirror?: boolean; tears?: boolean; glance?: CSSProperties | true; lid: string; beat: number; uid: string }) {
  const e = EYES[kind];
  const sad = kind === "sad";
  const flip = mirror ? "scale(-1 1)" : undefined;
  const blink = { animationDelay: `${beat * 0.04}s` };
  return (
    <g transform={`translate(${x} ${y})${e.scale ? ` scale(${e.scale})` : ""}`}>
      <ellipse rx="10.5" ry="12.5" fill={url(uid, "sclera")} stroke="#8796b8" strokeOpacity=".35" strokeWidth=".8" />
      <g clipPath={url(uid, "scl")}>
        <g data-rig="eyes" style={rigStyle()}>
          <g className="animate-puff-gaze">
            <g className={glance ? "animate-puff-glance" : undefined} style={glance === true ? undefined : glance}>
              <g transform={flip}>
                <circle cx={e.iris[0]} cy={e.iris[1]} r={e.ir} fill={url(uid, "iris")} />
                <circle cx={e.iris[0]} cy={e.iris[1]} r={e.pr} fill="#0a1120" />
                {sad && tears && <ellipse cy="11.6" rx="9.5" ry="3.2" fill={TEAR} opacity=".75" />}
                {e.lights.map(([lx, ly, rx, ry, o]) => (
                  <ellipse key={`${lx}${ly}`} cx={lx} cy={ly} rx={rx} ry={ry} fill="#fff" opacity={o} />
                ))}
                {sad && tears && <circle cx="1.5" cy="10.8" r=".9" fill="#fff" opacity=".9" />}
              </g>
            </g>
          </g>
        </g>
        <ellipse cy="-11" rx="13" ry="6.5" fill="#33426b" opacity=".22" />
        {sad && (
          <g transform={flip} fill="#edf1f8">
            <path d="M-13 -14L13 -14L13 -8.5Q0 -8 -13 -1Z" />
            <path d="M-13 -1Q0 -8 13 -8.5" fill="none" stroke="#33426b" strokeOpacity=".22" strokeWidth="3" />
          </g>
        )}
        <g className="animate-puff-blink" style={blink}>
          <path d={sad ? LID.sad : LID.open} transform={flip} style={tween("fill", lid)} />
        </g>
      </g>
      <g clipPath={url(uid, "scl2")}>
        <g className="animate-puff-blink" style={blink}>
          <path d={sad ? LASH.sad : LASH.open} transform={flip} fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
        </g>
      </g>
    </g>
  );
}

/** Closed eyes: sleepy ones curve down with lashes (the right one mirrored); giggling ones are a happy ^ ^ with lashes. */
function ClosedEyes({ up }: { up: boolean }) {
  const line = { fill: "none", stroke: INK, strokeLinecap: "round" } as const;
  return (
    <>
      {[84, 116].map((x, i) =>
        up ? (
          <g key={x} transform={`translate(${x} 104)`} {...line}>
            <path d="M-10 3Q0 -9 10 3" strokeWidth="2.2" />
            <path d={i ? "M9.4 2.4L12.2 4.8" : "M-9.4 2.4L-12.2 4.8"} strokeWidth="1.4" />
          </g>
        ) : (
          <g key={x} transform={`translate(${x} 106)${i ? " scale(-1 1)" : ""}`} {...line}>
            <path d="M-9 -5Q0 1 9 -5" stroke="#9aa7c4" strokeOpacity=".6" strokeWidth="1.2" />
            <path d="M-10 -1Q0 7.5 10 -1" strokeWidth="2" />
            <path d="M-9.6 -.4L-12.6 -2.8M-7.6 2.2L-10 5" strokeWidth="1.4" />
          </g>
        ),
      )}
    </>
  );
}

// Brows (left and right as one path): fluffy and arched when happy, level and faint when uneasy, the inner ends raised more as the mood gets heavier.
const BROWS = {
  happy: { d: "M76 86Q84 81 92 84M108 84Q116 81 124 86", w: 3, o: 1 },
  uneasy: { d: "M76 85.5Q84 83 92 84M108 84Q116 83 124 85.5", w: 2.6, o: 0.6 },
  worried: { d: "M74 88Q82 84 91 80M126 88Q118 84 109 80", w: 3.2, o: 1 },
  sad: { d: "M74 90Q82 84 90 78M126 90Q118 84 110 78", w: 3.2, o: 1 },
  brave: { d: "M75 88.5Q83 85 91 83M125 88.5Q117 85 109 83", w: 3, o: 1 },
  startled: { d: "M77 83Q84 78 91 80M109 80Q116 78 123 83", w: 3, o: 1 },
} as const;

/** The eyes (and what they show), brows and mouth of each face. */
const FACE: Record<PuffFace, { eyes: EyeKind | "shut" | "joy"; brows?: keyof typeof BROWS }> = {
  happy: { eyes: "open", brows: "happy" },
  giggle: { eyes: "joy", brows: "happy" },
  uneasy: { eyes: "aside", brows: "uneasy" },
  worried: { eyes: "look", brows: "worried" },
  sad: { eyes: "sad", brows: "sad" },
  brave: { eyes: "sad", brows: "brave" },
  startled: { eyes: "startled", brows: "startled" },
  sleepy: { eyes: "shut" },
};

/** The mouth for a face; the happy one is an open smile with a tongue, the sad one trembles, a startled one is a round o. */
function Mouth({ face, uid }: { face: PuffFace; uid: string }) {
  const line = { fill: "none", stroke: LINE, strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  if (face === "happy" || face === "giggle") {
    return (
      <g>
        <path d={MOUTH} fill={url(uid, "mouth")} />
        <ellipse cx="100" cy="129" rx="6" ry="3.6" fill="#ec7b91" clipPath={url(uid, "mclip")} />
        <path d="M89 116.5Q100 121 111 116.5" fill="none" stroke="#8d6a7c" strokeOpacity=".5" strokeWidth="1.1" strokeLinecap="round" />
      </g>
    );
  }
  if (face === "uneasy") return <path d="M93 125Q97 122.6 100.5 124.4T108 123.2" {...line} />;
  if (face === "worried") return <path d="M91 124q2.25-2.6 4.5 0t4.5 0t4.5 0t4.5 0" {...line} />;
  if (face === "sad") return <path d="M91 130Q100 120.5 109 130" {...line} className="animate-puff-tremble" />;
  if (face === "brave") return <path d="M94 124Q100 128.5 106 124" {...line} />;
  if (face === "startled") return <ellipse cx="100" cy="125" rx="4" ry="4.8" fill={url(uid, "mouth")} />;
  return <ellipse cx="100" cy="124" rx="2.6" ry="3" fill="#6a2434" />;
}

/** A pleated light-blue surgical mask over the mouth: a soft shadow, a nose wire, and ear loops that stay inside the body. */
function Mask({ uid }: { uid: string }) {
  return (
    <g strokeLinecap="round">
      <path d="M80 113Q68 110 58 115M80 128Q68 131 60 126M120 113Q132 110 142 115M120 128Q132 131 140 126" fill="none" stroke="#9cc3da" strokeWidth="1.3" />
      <path d={MASK} transform="translate(0 2)" fill="#24324a" opacity=".14" />
      <path d={MASK} fill={url(uid, "mask")} stroke="#86b3cf" strokeWidth=".8" strokeLinejoin="round" />
      <path d="M81 117Q100 112 119 117M81.5 121.5Q100 116.5 118.5 121.5M82 126Q100 121 118 126" fill="none" stroke="#8fbcd8" strokeWidth=".9" />
      <path d="M90 109.5Q100 107 110 109.5" fill="none" stroke="#c9dde9" strokeWidth="1.4" />
    </g>
  );
}

/**
 * The face: eyes, brows and mouth. Sleepy and giggling faces have closed eyes; the rest look out and drift (and blink). A brave face
 * is the sad eyes without tears and a small smile; a startled one has wide eyes with a small centred iris and an o.
 */
function Face({ face, uid, look }: { face: PuffFace; uid: string; look: Look }) {
  const { eyes, brows } = FACE[face];
  const b = brows && BROWS[brows];
  // Unease glances away now and then, slowly; worry looks around more.
  const glance = face === "worried" ? true : face === "uneasy" ? { animationDuration: "9s" } : undefined;
  return (
    <>
      {b && <path d={b.d} fill="none" strokeLinecap="round" strokeWidth={b.w} strokeOpacity={b.o} style={tween("stroke", look.brow)} />}
      {eyes === "shut" || eyes === "joy" ? (
        <ClosedEyes up={eyes === "joy"} />
      ) : (
        [84, 116].map((x, i) => (
          <Eye key={x} kind={eyes} x={x} y={104} mirror={eyes === "sad" && i === 1} tears={face !== "brave"} glance={glance} lid={look.lobe[1]} beat={i} uid={uid} />
        ))
      )}
      <Mouth face={face} uid={uid} />
    </>
  );
}

/** What a mood adds in front of the body: the sad cheeks' tear streaks and drops, the worried sweat drop. */
function Extras({ mood, uid }: { mood: PuffMood; uid: string }) {
  if (mood === "sad") {
    return (
      <>
        <g fill="none" stroke={TEAR} strokeWidth="3" strokeLinecap="round" opacity=".4">
          <path d="M75 118Q71 126 72 134" />
          <path d="M125 118Q129 126 128 134" />
        </g>
        <Drop uid={uid} x={73} y={122} fall={10} secs={2.6} delay={0} size={0.75} />
        <Drop uid={uid} x={127} y={122} fall={10} secs={2.6} delay={0.9} size={0.75} />
      </>
    );
  }
  return mood === "worried" ? <Drop uid={uid} x={143} y={82} fall={12} secs={3} delay={0} size={1.1} /> : null;
}

/** Little extras that do not move with the body: a happy sparkle or two, the sleepy z's. */
function Backdrop({ mood }: { mood: PuffMood }) {
  if (mood === "happy") {
    return (
      <>
        <Sparkle x={113} y={26} size={0.8} delay={0} />
        <Sparkle x={14} y={30} size={0.75} delay={0.9} />
      </>
    );
  }
  if (mood !== "sleepy") return null;
  return (
    <>
      {[
        { x: 100, y: 32, size: 9, delay: 0 },
        { x: 108, y: 21, size: 11, delay: 1.2 },
        { x: 116, y: 10, size: 13, delay: 2.4 },
      ].map((z) => (
        <text key={z.delay} x={z.x} y={z.y} fontSize={z.size} fontWeight="800" textAnchor="middle" fill="currentColor" opacity=".6" className="animate-puff-z" style={{ animationDelay: `${z.delay}s` }}>
          z
        </text>
      ))}
    </>
  );
}

/** A rig part: a static anchor (relative to its parent part), then the group the rig animates, starting at its rest pose. */
function Part({ name, at, rest = {}, children }: { name: PartName | "shadow"; at: Pt; rest?: Pose; children: ReactNode }) {
  return (
    <g transform={`translate(${at[0]} ${at[1]})`}>
      <g data-rig={name} style={rigStyle(rest)}>
        {children}
      </g>
    </g>
  );
}

/** A cloud puff cluster (a hand or a foot, drawn about its pivot): the edge first, then the lobe gradient. `right` mirrors the shapes, not the light. */
function Puffs({ uid, list, edge, right, children }: { uid: string; list: readonly Blob[]; edge: string; right?: boolean; children?: ReactNode }) {
  const shapes = right ? list.map(([cx, cy, rx, ry]) => [-cx, cy, rx, ry] as const) : list;
  return (
    <g transform={`scale(${S})`}>
      <Blobs list={shapes} grow={1} style={tween("fill", edge)} />
      <Blobs list={shapes} fill={url(uid, "lobe")} />
      {children}
    </g>
  );
}

/** A puff oval foot with a shaded underside. */
function Foot({ uid, look }: { uid: string; look: Look }) {
  return (
    <Puffs uid={uid} list={FOOT} edge={look.edge}>
      <ellipse cy="0.5" rx="13" ry="3.2" opacity=".35" style={tween("fill", look.shade)} />
    </Puffs>
  );
}

/**
 * Puff, the cloud mascot: a soft volumetric cumulus character with floating puff hands and feet (no arms or legs, and no fingers),
 * as an inline SVG that feels the air (see `puffMood`). The body is overlapping lobes lit from the upper left with a cool underside
 * and a bounce light, and no outline, only a faint edge; `bounce` is the panel colour, which tints the underside. It is a button
 * ("Say hi to Puff"): a tap squishes, jumps and waves to suit the mood, and three quick taps spin it.
 * The SVG itself is decorative, so hidden from assistive tech; the verdict text already says what Puff shows. Size it with `className`
 * (the width; the height follows `PUFF_VIEW`); it may jump above the box, so put it where the parent clips overflow.
 * Motion is acted, not looped (see `puffRig`, `usePuffRig`): each mood has its own routines (hops and waves, weight shifts, fidgets,
 * slumps and shuffles, nodding off) with anticipation, squash and stretch and follow-through, and a mood change hops into the new
 * pose. With reduced motion it keeps a still pose. When the mood changes the body colours tween and the old face fades out as the
 * new one fades in; nothing remounts, so nothing shifts.
 */
export default function Puff({ step, bounce, className = "" }: { step: Step | null; bounce?: string; className?: string }) {
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
  const lit = (id: string, ...ops: Array<[number, string, number]>) => (
    <linearGradient id={`${uid}-${id}`} x1="0" y1="0" x2="0" y2="1">
      {stops(id, ...ops)}
    </linearGradient>
  );

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
          <radialGradient id={`${uid}-lobe`} cx=".42" cy=".34" r=".68" fx=".38" fy=".26">
            {stops("l", ...look.lobe.map((c, i): [number, string, number] => [LOBE_AT[i], c, 1]))}
          </radialGradient>
          {lit("under", [0, look.shade, 0], [0.55, look.shade, 0.16], [1, look.shade, 0.46])}
          {bounce && lit("panel", [0, bounce, 0], [1, bounce, 0.16])}
          <radialGradient id={`${uid}-sheen`}>{stops("s", [0, look.sheen, 0.95], [1, look.sheen, 0])}</radialGradient>
          <radialGradient id={`${uid}-ground`}>
            <stop offset="0" stopColor="#0d1a14" stopOpacity=".38" />
            <stop offset="1" stopColor="#0d1a14" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${uid}-blush`}>
            <stop offset="0" stopColor="#ff8fa6" stopOpacity=".6" />
            <stop offset="1" stopColor="#ff8fa6" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${uid}-sclera`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#cfd7e8" />
            <stop offset=".32" stopColor="#fbfcff" />
            <stop offset="1" stopColor="#ffffff" />
          </linearGradient>
          <radialGradient id={`${uid}-iris`} cx=".5" cy=".66" r=".62">
            <stop offset="0" stopColor="#a8cdf5" />
            <stop offset=".42" stopColor="#5a88cc" />
            <stop offset=".8" stopColor="#2c4a80" />
            <stop offset="1" stopColor="#172746" />
          </radialGradient>
          <linearGradient id={`${uid}-mouth`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3d0f1d" />
            <stop offset="1" stopColor="#7a2236" />
          </linearGradient>
          <linearGradient id={`${uid}-drop`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f2fbff" />
            <stop offset="1" stopColor="#74bdf0" />
          </linearGradient>
          <linearGradient id={`${uid}-mask`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e8f6fd" />
            <stop offset="1" stopColor="#a6cde5" />
          </linearGradient>
          <clipPath id={`${uid}-clip`}>
            <Blobs list={LOBES} />
          </clipPath>
          <clipPath id={`${uid}-mclip`}>
            <path d={MOUTH} />
          </clipPath>
          <clipPath id={`${uid}-scl`}>
            <ellipse rx="10.5" ry="12.5" />
          </clipPath>
          <clipPath id={`${uid}-scl2`}>
            <ellipse rx="12.5" ry="14.5" />
          </clipPath>
        </defs>

        <Part name="shadow" at={AT.shadow}>
          <ellipse rx={66 * S} ry={7 * S} fill={url(uid, "ground")} />
        </Part>
        {fadeLayers(mood, goneMood, (m) => (
          <Backdrop mood={m} />
        ))}

        <Part name="root" at={AT.root} rest={rest.root}>
          <Part name="body" at={AT.body} rest={rest.body}>
            <g transform={`scale(${S}) translate(${-PIVOT.body[0]} ${-PIVOT.body[1]})`}>
              <g className="animate-puff-breathe origin-bottom" style={breathe}>
                {fadeLayers(mood, goneMood, (m) =>
                  m === "sad"
                    ? [40, 160].map((x, i) => <Drop key={x} uid={uid} x={x} y={134} fall={10} secs={2.4} delay={i * 1.1} size={0.85} />)
                    : null,
                )}
                <Blobs list={LOBES} grow={1} style={tween("fill", look.edge)} />
                <Blobs list={LOBES} fill={url(uid, "lobe")} />
                <rect x="0" y="92" width="200" height="70" fill={url(uid, "under")} clipPath={url(uid, "clip")} />
                {bounce && <rect x="0" y="126" width="200" height="42" fill={url(uid, "panel")} clipPath={url(uid, "clip")} />}
                <ellipse cx="100" cy="160" rx="50" ry="6" opacity=".55" clipPath={url(uid, "clip")} style={tween("fill", look.lobe[1])} />
                <ellipse cx="96" cy="42" rx="20" ry="10" transform="rotate(-18 96 42)" fill={url(uid, "sheen")} opacity=".9" />
                <ellipse cx="66" cy="60" rx="9" ry="5" transform="rotate(-30 66 60)" fill={url(uid, "sheen")} opacity=".7" />

                <g fill={url(uid, "blush")} style={tween("opacity", look.blush)}>
                  <ellipse cx="68" cy="122" rx="10" ry="6" />
                  <ellipse cx="132" cy="122" rx="10" ry="6" />
                </g>
                {fadeLayers(face, goneFace, (f) => (
                  <Face face={f} uid={uid} look={look} />
                ))}
                {fadeLayers(mask ? "mask" : null, goneMask && { v: goneMask.v ? "mask" : null }, (m) => (m ? <Mask uid={uid} /> : null))}
                {fadeLayers(mood, goneMood, (m) => (
                  <Extras mood={m} uid={uid} />
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
            <Puffs uid={uid} list={HAND} edge={look.edge} />
          </Part>
          <Part name="handR" at={AT.handR} rest={rest.handR}>
            <Puffs uid={uid} list={HAND} edge={look.edge} right />
          </Part>
        </Part>
      </svg>
    </button>
  );
}

