import type { CSSProperties } from "react";
import type { PuffMood } from "./Puff";

/** The parts of Puff the rig moves; the ground shadow is derived from `root` and never keyed. */
export const PARTS = ["root", "body", "eyes", "handL", "handR", "footL", "footR"] as const;
export type PartName = (typeof PARTS)[number];

/** One part's pose: a move (user units), a turn (degrees about the part's anchor) and a scale. Missing fields are 0, or 1 for scale. */
export type Pose = { x?: number; y?: number; r?: number; sx?: number; sy?: number };
export type Rest = Record<PartName, Pose>;
type Parts = Partial<Record<PartName, Pose>>;
/** A key on a beat's dope sheet: `at` (0..1) names the parts that hit a pose then. `ease` takes those parts on to their next key. */
export type Key = Parts & { at: number; ease?: string };
/** A routine: `ms` long, and it starts and ends at the mood's rest pose. */
export type Beat = { ms: number; keys: Key[] };

/** The face a tap shows for a moment: closed happy eyes, a brave small smile, or wide round eyes. */
export type PuffReaction = "giggle" | "brave" | "startled";

const f = (n: number) => +n.toFixed(2);
/** A pose as a CSS transform; px are user units in SVG. */
export const poseCss = (p: Pose = {}) => `translate(${f(p.x ?? 0)}px, ${f(p.y ?? 0)}px) rotate(${f(p.r ?? 0)}deg) scale(${f(p.sx ?? 1)}, ${f(p.sy ?? 1)})`;

/** The inline style of a rig part at a pose: it turns and scales about its own anchor, like an SVG transform attribute does. */
export function rigStyle(pose: Pose = {}): CSSProperties {
  return { transformBox: "view-box", transformOrigin: "0 0", transform: poseCss(pose) };
}

// Poses are relative to each part's anchor (see Puff). Hands: a wrist pivot, a positive turn swings the left mitt out and the right one in.
const stand = { root: {}, body: {}, eyes: {}, footL: {}, footR: {} };
/** Where each mood stands: the server picture, the reduced-motion picture and the end of every animation. */
export const REST: Record<PuffMood, Rest> = {
  happy: { ...stand, handL: { x: 1, r: 3 }, handR: { x: -1, r: -3 } },
  // The mitts rest together over the lower belly, under the mouth.
  uneasy: { ...stand, handL: { x: 48.8, y: 17.2, r: -14 }, handR: { x: -48.8, y: 17.2, r: 14 } },
  // The mitts rest at the cheeks.
  worried: { ...stand, handL: { x: 25.8, y: 5, r: -20 }, handR: { x: -25.8, y: 5, r: 20 } },
  sad: {
    root: { y: 4 },
    body: { sx: 1.05, sy: 0.93 },
    eyes: {},
    handL: { x: 2, y: 8, r: 6 },
    handR: { x: -2, y: 8, r: -6 },
    footL: { x: 6, y: -4 },
    footR: { x: -6, y: -4 },
  },
  // Sitting: the body is lowered onto the ground and the feet stick out in front, toes apart.
  sleepy: {
    root: { y: 8 },
    body: { sx: 1.03, sy: 0.96 },
    eyes: {},
    handL: { x: 3, y: 4, r: 10 },
    handR: { x: -3, y: 4, r: -10 },
    footL: { x: -6, y: -6, r: -20 },
    footR: { x: 6, y: -6, r: 20 },
  },
};

/** The face each mood shows while a tap reaction plays. */
export const REACTION_FACE: Record<PuffMood, PuffReaction> = { happy: "giggle", uneasy: "giggle", worried: "giggle", sad: "brave", sleepy: "startled" };

const OUT = "cubic-bezier(.33,0,.2,1)"; // slow in, slow out: the default
const SOFT = "cubic-bezier(.45,0,.55,1)"; // even, for sways and waggles
const PUSH = "cubic-bezier(.5,0,.8,.55)"; // pushing off: speeds up
const RISE = "cubic-bezier(.1,.55,.35,1)"; // rising: slows toward the top
const FALL = "cubic-bezier(.55,0,.9,.55)"; // falling: gravity speeds it up

/** A pose moved by `d`: offsets and turns add, scales multiply. */
const rel = (b: Pose = {}, d: Pose = {}): Pose => ({
  x: (b.x ?? 0) + (d.x ?? 0),
  y: (b.y ?? 0) + (d.y ?? 0),
  r: (b.r ?? 0) + (d.r ?? 0),
  sx: (b.sx ?? 1) * (d.sx ?? 1),
  sy: (b.sy ?? 1) * (d.sy ?? 1),
});

type K = Parts & { t: number; ease?: string };
/** Writes a beat with times in ms. */
const beat = (ms: number, keys: K[]): Beat => ({
  ms,
  keys: keys.map(({ t, ...k }) => ({ ...k, at: t / ms })).sort((a, b) => a.at - b.at),
});

type Phase = "crouch" | "stretch" | "apex" | "flick" | "land" | "over" | "settle";
type Hop = {
  h: number; // apex height
  crouch?: number; // ms of anticipation, then rise, fall and settle
  rise?: number;
  fall?: number;
  settle?: number;
  squash?: number; // 1 = full squash and stretch on the body
  dip?: number; // the crouch's own squash (defaults to `squash`)
  lag?: number; // how far hands and feet trail the body
  hands?: boolean; // false when the beat keys the hands itself
  add?: Partial<Record<Phase, Parts>>; // nudges (see `rel`) on top of a phase's poses
};

/**
 * A jump from `t` ms: crouch, push off with a stretch, tuck at the top, fall, squash on landing, overshoot, settle. The hands drop
 * at take-off, flick up after the apex and flop down after landing; the feet tuck in the air and splay on landing.
 * Returns the keys and the ms the settle ends. `x` and `r` on hands and feet below are swings outward.
 */
function jump(R: Rest, t: number, o: Hop): { keys: K[]; end: number } {
  const { h, crouch = 120, rise = 240, fall = 200, settle = 220, squash = 1, dip = squash, lag = 1, hands = true, add = {} } = o;
  const q = (v: number, k = squash) => 1 + (v - 1) * k;
  const g = (v: number) => v * lag;
  const tc = t + crouch;
  const ta = tc + rise;
  const tl = ta + fall;
  const feet = (d: Pose): Parts => ({ footL: rel(R.footL, { ...d, x: -(d.x ?? 0), r: -(d.r ?? 0) }), footR: rel(R.footR, d) });
  const hand = (d: Pose): Parts => (hands ? { handL: rel(R.handL, { ...d, x: -(d.x ?? 0) }), handR: rel(R.handR, { ...d, r: -(d.r ?? 0) }) } : {});
  const phases: Array<[Phase, K]> = [
    ["crouch", { t: tc, ease: PUSH, root: rel(R.root, { y: 2.2 * dip }), body: rel(R.body, { sx: q(1.1, dip), sy: q(0.9, dip) }), ...feet({ x: g(1), sx: q(1.08, dip), sy: q(0.88, dip) }), ...hand({ y: g(3), r: g(10) }) }],
    ["stretch", { t: tc + rise * 0.3, ease: RISE, root: rel(R.root, { y: -h * 0.55 }), body: rel(R.body, { sx: q(0.9), sy: q(1.14) }), ...feet({ y: g(-1.5), sy: q(0.95) }), ...hand({ y: g(3.5), r: g(12) }) }],
    ["apex", { t: ta, ease: FALL, root: rel(R.root, { y: -h }), body: rel(R.body, { sx: q(0.97), sy: q(1.05) }), ...feet({ x: g(-0.5), y: g(-4), sx: q(1.05), sy: q(0.85) }), ...hand({ y: g(1), r: g(4) }) }],
    ["flick", { t: ta + fall * 0.4, ease: OUT, ...hand({ y: g(-4), r: g(-6) }) }],
    ["land", { t: tl, ease: OUT, root: R.root, body: rel(R.body, { sx: q(1.16), sy: q(0.86) }), ...feet({ x: g(3), sx: q(1.14), sy: q(0.7) }), ...hand({ y: g(-3), r: g(-3) }) }],
    ["over", { t: tl + settle * 0.4, ease: OUT, body: rel(R.body, { sx: q(0.97), sy: q(1.04) }), ...feet({ x: g(1), sy: q(0.95) }), ...hand({ y: g(4), r: g(6) }) }],
    ["settle", { t: tl + settle * 0.75, ease: OUT, body: rel(R.body, { sx: q(1.015), sy: q(0.985) }), ...hand({ y: g(-1) }) }],
  ];
  const keys = phases.map(([phase, k]) => {
    const a = add[phase];
    if (!a) return k;
    const out: K = { ...k };
    for (const p of PARTS) if (a[p]) out[p] = rel(k[p] ?? R[p], a[p]);
    return out;
  });
  return { keys, end: tl + settle };
}

/** A hand swinging `amps` degrees either side of `base`, one swing per `step` ms from `t0`. */
const waggle = (side: "handL" | "handR", base: Pose, t0: number, step: number, amps: number[]): K[] =>
  amps.map((a, i) => ({ t: t0 + step * i, ease: SOFT, [side]: rel(base, { r: a, x: i % 2 ? 1.2 : -1.2 }) }));

// Hands shared by the happy beats and the tap reactions: thrown up, and waving beside the head.
const UP_L: Pose = { x: 10, y: -30, r: 155 };
const UP_R: Pose = { x: -10, y: -30, r: -155 };
const WAVE_R: Pose = { x: -19, y: -30, r: -172 };

/** The move into a new mood's rest: a small hop with an anticipation dip, then a landing squash. */
function switchBeat(R: Rest): Beat {
  return beat(550, jump(R, 0, { h: 7, crouch: 110, rise: 160, fall: 120, settle: 160 }).keys);
}

const H = REST.happy;
const happyHop = (): Beat => {
  const first = jump(H, 0, { h: 16, crouch: 140, rise: 250, fall: 210, settle: 240, hands: false });
  const second = jump(H, 860, { h: 9, crouch: 110, rise: 210, fall: 170, settle: 210, lag: 0.8 });
  return beat(1900, [
    ...first.keys,
    ...second.keys,
    // Yay: the hands swing back, throw up past the apex, hang there, and flop down after the landing.
    { t: 140, ease: PUSH, handL: rel(H.handL, { y: 3, r: 14 }), handR: rel(H.handR, { y: 3, r: -14 }) },
    { t: 330, ease: RISE, handL: { x: 2, y: -14, r: 95 }, handR: { x: -2, y: -14, r: -95 } },
    { t: 470, ease: SOFT, handL: UP_L, handR: UP_R },
    { t: 580, ease: OUT, handL: rel(UP_L, { y: 2, r: -6 }), handR: rel(UP_R, { y: 2, r: 6 }) },
    { t: 690, ease: OUT, handL: rel(H.handL, { y: 4, r: 12 }), handR: rel(H.handR, { y: 4, r: -12 }) },
    { t: 800, ease: OUT, handL: rel(H.handL, { y: -1 }), handR: rel(H.handR, { y: -1 }) },
  ]);
};

const happyWave = (): Beat => {
  const tapUp = rel(H.footL, { y: -3.5, r: -6 });
  const tapDown = rel(H.footL, { sx: 1.05, sy: 0.9 });
  return beat(2300, [
    { t: 220, ease: OUT, root: { x: -1, r: -1.5 }, handR: rel(H.handR, { x: 1, y: 3, r: -14 }) },
    { t: 380, ease: RISE, handR: { x: 0, y: -18, r: -70 } },
    // Lean toward the wave side; the gaze follows the hand.
    { t: 560, ease: OUT, root: { x: 2.2, r: 4 }, body: { r: 2.5 }, eyes: { x: 2.4, y: -1.5 }, handR: WAVE_R, handL: rel(H.handL, { x: -1, r: 8 }) },
    ...waggle("handR", WAVE_R, 690, 130, [20, -20, 20, -20, 20, -20]),
    { t: 820, ease: SOFT, root: { x: 2.2, r: 3.4 } },
    { t: 1080, ease: SOFT, root: { x: 2.2, r: 4.6 } },
    { t: 1340, ease: SOFT, root: { x: 2.2, r: 3.6 } },
    { t: 1500, ease: OUT, handR: WAVE_R },
    { t: 1660, ease: OUT, handR: { x: -3, y: -16, r: -90 } },
    { t: 1700, ease: OUT, root: { x: 0.4, r: 0.8 }, body: { r: 0.6 }, eyes: {}, handL: H.handL },
    { t: 1860, ease: OUT, handR: rel(H.handR, { y: 4, r: -10 }) },
    { t: 2060, ease: OUT, handR: rel(H.handR, { y: -1 }) },
    // One foot taps along.
    { t: 700, ease: FALL, footL: tapUp },
    { t: 790, ease: RISE, footL: tapDown },
    { t: 880, ease: FALL, footL: tapUp },
    { t: 970, ease: OUT, footL: tapDown },
    { t: 1060, ease: OUT, footL: H.footL },
  ]);
};

const happyTwist = (): Beat => {
  // Quick tilt left, then right, in the air.
  const air = jump(H, 0, { h: 13, crouch: 130, rise: 230, fall: 190, settle: 230, add: { stretch: { root: { r: -9 } }, apex: { root: { r: 9 } } } });
  const wiggle = [4, -4, 3.5, -3, 2, -1.2];
  return beat(1700, [
    ...air.keys,
    ...wiggle.map((r, i): K => ({ t: 860 + i * 90, ease: SOFT, body: rel(H.body, { r, sx: i < 2 ? 1.05 : 1.02, sy: i < 2 ? 0.96 : 0.99 }) })),
    { t: 860, ease: SOFT, footL: rel(H.footL, { y: -2.5 }), handL: rel(H.handL, { r: 10 }), handR: rel(H.handR, { r: -10 }) },
    { t: 950, ease: SOFT, footL: H.footL, footR: rel(H.footR, { y: -2.5 }), handL: rel(H.handL, { r: -4 }), handR: rel(H.handR, { r: 4 }) },
    { t: 1040, ease: SOFT, footR: H.footR, footL: rel(H.footL, { y: -2.5 }), handL: rel(H.handL, { r: 6 }), handR: rel(H.handR, { r: -6 }) },
    { t: 1130, ease: SOFT, footL: H.footL, footR: rel(H.footR, { y: -2.5 }), handL: rel(H.handL, { r: -2 }), handR: rel(H.handR, { r: 2 }) },
    { t: 1220, ease: OUT, footR: H.footR, handL: H.handL, handR: H.handR },
  ]);
};

const U = REST.uneasy;
const uneasyShift = (): Beat =>
  beat(2700, [
    { t: 300, ease: OUT, root: { x: -0.6, r: 0.8 }, eyes: { x: -2.1 } },
    // Weight on the left: the right foot lifts. Then the other way.
    { t: 760, ease: SOFT, root: { x: -4, r: -3 }, body: { r: -2 }, eyes: { x: -2.7, y: 0.6 }, footR: rel(U.footR, { x: -1.5, y: -3.5, r: 10 }), footL: rel(U.footL, { x: -1, sy: 0.94 }), handL: rel(U.handL, { x: 1.4, y: 0.8 }), handR: rel(U.handR, { x: 1.4 }) },
    { t: 1060, ease: OUT, footR: rel(U.footR, { y: 0.5, sx: 1.06, sy: 0.9 }) },
    { t: 1560, ease: SOFT, root: { x: 4, r: 3.2 }, body: { r: 2 }, eyes: { x: 2.7, y: 0.6 }, footL: rel(U.footL, { x: 1.5, y: -3.5, r: -10 }), footR: rel(U.footR, { x: 1 }), handL: rel(U.handL, { x: -1.4 }), handR: rel(U.handR, { x: -1.4, y: 0.8 }) },
    { t: 1860, ease: OUT, footL: rel(U.footL, { y: 0.5, sx: 1.06, sy: 0.9 }) },
    { t: 2250, ease: OUT, root: { x: 0.6, r: 0.4 }, body: { r: 0.3 }, eyes: {}, footL: U.footL, footR: U.footR, handL: U.handL, handR: U.handR },
  ]);

const uneasyFidget = (): Beat => {
  const L = rel(U.handL, { x: 1.5, y: -1.5, r: -6 });
  const R = rel(U.handR, { x: -1.5, y: -1.5, r: 6 });
  return beat(2600, [
    { t: 280, ease: OUT, root: { y: 0.5 }, body: { sx: 1.02, sy: 0.98 }, handL: L, handR: R },
    // Rub, rub: the mitts slide past each other in front of the belly.
    ...Array.from({ length: 8 }, (_, i): K => ({ t: 440 + i * 120, ease: SOFT, handL: rel(L, { y: i % 2 ? -3 : 3 }), handR: rel(R, { y: i % 2 ? 3 : -3 }) })),
    { t: 1480, ease: OUT, root: {}, body: {}, handL: L, handR: R },
    { t: 1800, ease: OUT, handL: U.handL, handR: U.handR },
    // The eyes slide away, then back the other way.
    { t: 280, ease: OUT, eyes: { x: -3.3, y: 0.6 } },
    { t: 1000, ease: OUT, eyes: { x: 3.3, y: 0.6 } },
    { t: 1500, ease: OUT, eyes: { x: 0.9 } },
    { t: 1800, ease: OUT, eyes: {} },
  ]);
};

const uneasyHop = (): Beat => {
  const hop = jump(U, 1000, { h: 4, crouch: 90, rise: 140, fall: 120, settle: 200, squash: 0.6, lag: 0.6 });
  return beat(2000, [
    // Winds up, thinks better of it, then manages a small hop anyway.
    { t: 260, ease: OUT, root: { y: 2 }, body: { sx: 1.08, sy: 0.92 }, handL: rel(U.handL, { y: 2 }), handR: rel(U.handR, { y: 2 }) },
    { t: 520, ease: OUT, root: { y: -0.5 }, body: { sx: 0.99, sy: 1.02 } },
    { t: 760, ease: OUT, root: { y: 0.8 }, body: { sx: 1.03, sy: 0.97 }, eyes: { x: -2.7 } },
    ...hop.keys,
    { t: 1300, ease: OUT, eyes: { x: 2.7 } },
    { t: 1700, ease: OUT, eyes: {} },
  ]);
};

const W = REST.worried;
const worriedWipe = (): Beat =>
  beat(2300, [
    // The right mitt drops, rises, sweeps left across the forehead and back toward the sweat drop, flicks off, and returns to the cheek.
    { t: 260, ease: OUT, root: { y: 0.5 }, body: { r: -1.5 }, eyes: { x: 1.8, y: -1.2 }, handR: rel(W.handR, { x: -2, y: 3, r: 10 }) },
    { t: 520, ease: RISE, handR: { x: -25.7, y: -11.5, r: 40 } },
    { t: 760, ease: SOFT, body: { r: -2.5, sy: 0.985 }, handR: { x: -31, y: -26, r: 80 } },
    { t: 1080, ease: OUT, handR: { x: -57.5, y: -26, r: 80 } },
    { t: 1220, ease: OUT, body: { r: 1.5 }, handR: { x: -28.5, y: -24.5, r: 70 } },
    { t: 1330, ease: OUT, handR: { x: -24, y: -22, r: 20 } },
    { t: 1450, ease: OUT, body: { sx: 0.98, sy: 1.03 } },
    { t: 1700, ease: OUT, root: {}, eyes: {}, handR: W.handR },
    { t: 1800, ease: OUT, body: { sx: 1.02, sy: 0.98 } },
    // The other hand trembles at the cheek.
    { t: 400, ease: SOFT, handL: rel(W.handL, { y: 1.2 }) },
    { t: 700, ease: SOFT, handL: rel(W.handL, { y: -1 }) },
    { t: 1000, ease: SOFT, handL: rel(W.handL, { y: 1.2 }) },
    { t: 1300, ease: SOFT, handL: rel(W.handL, { y: -1 }) },
    { t: 1600, ease: OUT, handL: W.handL },
  ]);

const worriedBounce = (): Beat => {
  const bounces = [0, 400, 800].map((t) => jump(W, t, { h: 5, crouch: 70, rise: 120, fall: 100, settle: 110, squash: 0.8, lag: 0.8 }));
  // Rapid alternating taps once the bouncing is over.
  const taps = [1260, 1330, 1400, 1470, 1540, 1610, 1680, 1750].map((t, i): K => {
    const foot = i % 4 < 2 ? "footL" : "footR";
    return { t, ease: i % 2 ? OUT : FALL, [foot]: i % 2 ? W[foot] : rel(W[foot], { y: -3 }) };
  });
  return beat(2000, [...bounces.flatMap((b) => b.keys), ...taps, { t: 1900, ease: OUT, footL: W.footL, footR: W.footR }]);
};

const worriedPoint = (): Beat => {
  const lean: Parts = { root: { x: -2.5, r: -3 }, body: { r: -2 }, eyes: { x: -3.9, y: -0.6 }, handR: rel(W.handR, { x: 2, y: 3, r: -6 }) };
  return beat(2700, [
    // Eyes first, then the body, then the left mitt reaches out toward the headline and jabs twice.
    { t: 280, ease: OUT, eyes: lean.eyes, handL: rel(W.handL, { x: 3, y: 1, r: -12 }) },
    { t: 560, ease: RISE, ...lean, handL: { x: 12, y: -5, r: 42 } },
    { t: 780, ease: OUT, handL: { x: 1.7, y: -7, r: 86 } },
    { t: 920, ease: OUT, handL: { x: -0.9, y: -6.8, r: 88 } },
    { t: 1030, ease: OUT, handL: { x: 1.7, y: -7, r: 86 } },
    { t: 1140, ease: OUT, handL: { x: -0.9, y: -6.8, r: 88 } },
    { t: 1250, ease: OUT, handL: { x: 1.7, y: -7, r: 86 } },
    { t: 1900, ease: OUT, ...lean, handL: { x: 1.2, y: -7, r: 86 } },
    { t: 2150, ease: OUT, handL: { x: 15, y: -0.4, r: 30 } },
    { t: 2300, ease: OUT, root: { x: 0.2 }, body: {}, eyes: {}, handL: W.handL, handR: W.handR },
  ]);
};

const S = REST.sad;
const sadSigh = (): Beat => {
  const plant = (d: Pose): Parts => ({ footL: rel(S.footL, { ...d, y: (d.y ?? 0) + 3.5 }), footR: rel(S.footR, { ...d, x: -(d.x ?? 0), y: (d.y ?? 0) + 3.5 }) });
  const full: Parts = { root: rel(S.root, { y: -3.5 }), body: rel(S.body, { sx: 0.985, sy: 1.08 }), eyes: { y: -2.1 }, ...plant({}) };
  return beat(3400, [
    // A slow inhale, a held breath, then the deflating drop with a slump.
    { t: 1100, ease: SOFT, ...full, handL: rel(S.handL, { y: -2.5, r: 5 }), handR: rel(S.handR, { y: -2.5, r: -5 }) },
    { t: 1600, ease: OUT, ...full, handL: rel(S.handL, { y: -2.5, r: 5 }), handR: rel(S.handR, { y: -2.5, r: -5 }) },
    { t: 2250, ease: OUT, root: rel(S.root, { y: 2.2 }), body: rel(S.body, { sx: 1.07, sy: 0.9 }), eyes: { y: 2.1 }, ...plant({ y: -5.7, sx: 1.04, sy: 0.93 }) },
    { t: 2400, ease: OUT, handL: rel(S.handL, { y: 3.5 }), handR: rel(S.handR, { y: 3.5 }) },
    { t: 2900, ease: OUT, root: rel(S.root, { y: 0.8 }), body: rel(S.body, { sx: 1.02, sy: 0.97 }), eyes: { y: 0.6 }, handL: rel(S.handL, { y: -1 }), handR: rel(S.handR, { y: -1 }), footL: S.footL, footR: S.footR },
  ]);
};

const sadRub = (): Beat => {
  const eye: Pose = { x: -46, y: 0.6, r: -165 };
  const tilt: Parts = { body: rel(S.body, { r: 2.5 }), eyes: { x: 1.5, y: 2 } };
  return beat(3200, [
    // The right mitt swings up to the right eye, rubs twice, and drops back.
    { t: 400, ease: OUT, handR: rel(S.handR, { x: 2, y: 3, r: -6 }) },
    { t: 760, ease: RISE, handR: { x: -27, y: 5, r: -65 } },
    { t: 1050, ease: OUT, handR: { x: -38, y: 1.7, r: -120 } },
    { t: 1300, ease: SOFT, handR: eye, ...tilt },
    { t: 1480, ease: SOFT, handR: { x: -50, y: 0.4, r: -150 } },
    { t: 1650, ease: SOFT, handR: { x: -43, y: -0.3, r: -175 } },
    { t: 1820, ease: SOFT, handR: { x: -50, y: 0.4, r: -150 } },
    { t: 1990, ease: SOFT, handR: { x: -43, y: -0.3, r: -175 } },
    { t: 2200, ease: OUT, handR: eye, ...tilt },
    { t: 2500, ease: OUT, handR: { x: -40, y: 3, r: -95 } },
    { t: 2800, ease: OUT, body: S.body, eyes: {}, handR: rel(S.handR, { y: 3, r: -4 }) },
    { t: 1500, ease: SOFT, handL: rel(S.handL, { y: -0.8, r: 4 }) },
    { t: 2300, ease: OUT, handL: rel(S.handL, { y: -0.8, r: 4 }) },
    { t: 2900, ease: OUT, handL: S.handL },
  ]);
};

// With the mask on, the same slot becomes a press: the right mitt goes to the mask's side and pushes it twice.
const sadPress = (): Beat => {
  const press: Pose = { x: -34, y: 8, r: 78 };
  const lean: Parts = { body: rel(S.body, { r: 1.5 }), eyes: { y: 1.5 } };
  return beat(3000, [
    { t: 400, ease: OUT, handR: rel(S.handR, { x: 2, y: 3, r: -6 }) },
    { t: 800, ease: RISE, handR: { x: -21.5, y: 10, r: 25 } },
    { t: 1200, ease: SOFT, handR: press, ...lean },
    { t: 1450, ease: OUT, handR: { x: -31, y: 8.2, r: 80 } },
    { t: 1700, ease: OUT, handR: press },
    { t: 1950, ease: OUT, handR: { x: -31, y: 8.2, r: 80 } },
    { t: 2200, ease: OUT, handR: press, ...lean },
    { t: 2500, ease: OUT, handR: { x: -24, y: 10, r: 45 } },
    { t: 2750, ease: OUT, body: S.body, eyes: {}, handR: rel(S.handR, { y: 2 }) },
  ]);
};

const sadShuffle = (): Beat => {
  const down = (x: number, extra: Pose = {}) => rel(S.footR, { x, ...extra });
  return beat(2800, [
    // The right foot lifts, scuffs out sideways, then drags back along the ground while the gaze follows it down.
    { t: 450, ease: OUT, root: rel(S.root, { x: -0.8 }), body: rel(S.body, { r: -1 }), eyes: { x: 1.8, y: 2.2 }, footR: rel(S.footR, { x: 1, y: -2.5, r: -8 }) },
    { t: 720, ease: OUT, footR: down(9, { y: -0.8, r: 2 }) },
    { t: 820, ease: SOFT, root: rel(S.root, { x: -1.2 }), footR: down(10, { sx: 1.06 }), handR: rel(S.handR, { x: 1, y: -1 }) },
    { t: 1500, ease: SOFT, root: rel(S.root, { x: -0.4 }), footR: down(2, { sx: 1.08, r: -3 }), handR: rel(S.handR, { y: 1 }) },
    { t: 1900, ease: OUT, footR: S.footR, handR: S.handR },
    { t: 2100, ease: OUT, root: S.root, body: S.body, eyes: {} },
  ]);
};

const Z = REST.sleepy;
const sleepyNod = (): Beat => {
  const sink = (r: number, y: number, sy: number): Parts => ({ root: rel(Z.root, { y, r: r / 4 }), body: rel(Z.body, { r, sx: 1.03, sy }), handL: rel(Z.handL, { y: -0.6 }), handR: rel(Z.handR, { y: -0.6 }) });
  return beat(4200, [
    // Slowly tips forward and sinks, then a jolt upright, a wobble and a settle.
    { t: 1700, ease: SOFT, ...sink(4.5, 2.2, 0.94) },
    { t: 2200, ease: RISE, ...sink(5, 2.6, 0.93) },
    { t: 2480, ease: OUT, root: rel(Z.root, { y: -2.4, r: -0.8 }), body: rel(Z.body, { r: -2.2, sx: 0.98, sy: 1.05 }), handL: rel(Z.handL, { y: -4, r: 6 }), handR: rel(Z.handR, { y: -4, r: -6 }), footL: rel(Z.footL, { y: -0.8, r: -4 }), footR: rel(Z.footR, { y: -0.8, r: 4 }) },
    { t: 2800, ease: OUT, root: rel(Z.root, { y: 1.2 }), body: rel(Z.body, { r: 0.8, sx: 1.02, sy: 0.97 }), handL: rel(Z.handL, { y: 1.5 }), handR: rel(Z.handR, { y: 1.5 }), footL: Z.footL, footR: Z.footR },
    { t: 3400, ease: OUT, root: Z.root, body: Z.body, handL: Z.handL, handR: Z.handR },
  ]);
};

const sleepyBreath = (): Beat =>
  beat(3600, [
    { t: 1400, ease: SOFT, root: rel(Z.root, { x: 0.8, y: -1, r: 1.2 }), body: rel(Z.body, { sx: 1.05, sy: 1.07 }), handL: rel(Z.handL, { y: -0.6 }), handR: rel(Z.handR, { y: -0.6 }) },
    { t: 2000, ease: SOFT, root: rel(Z.root, { x: 0.8, y: -1, r: 1.2 }), body: rel(Z.body, { sx: 1.05, sy: 1.07 }), handL: rel(Z.handL, { y: -0.6 }), handR: rel(Z.handR, { y: -0.6 }) },
    { t: 2900, ease: SOFT, root: rel(Z.root, { x: -0.8, y: 0.4, r: -1.2 }), body: rel(Z.body, { sx: 0.99, sy: 0.97 }), handL: Z.handL, handR: Z.handR },
  ]);

/** Two or three routines per mood. Sad's eye rub becomes a mask press when the mask is on. */
const BEATS: Record<PuffMood, Record<string, Beat>> = {
  happy: { hop: happyHop(), wave: happyWave(), twist: happyTwist() },
  uneasy: { shift: uneasyShift(), fidget: uneasyFidget(), hop: uneasyHop() },
  worried: { wipe: worriedWipe(), bounce: worriedBounce(), point: worriedPoint() },
  sad: { sigh: sadSigh(), rub: sadRub(), shuffle: sadShuffle() },
  sleepy: { nod: sleepyNod(), breath: sleepyBreath() },
};
const MASKED: Partial<Record<PuffMood, Record<string, Beat>>> = { sad: { rub: sadPress() } };

/** The routines a mood plays between rests, as [id, beat] pairs. */
export const beatsFor = (mood: PuffMood, mask: boolean): Array<[string, Beat]> => Object.entries({ ...BEATS[mood], ...(mask ? MASKED[mood] : null) });

/** A tap: squish, a jump with the hands up and a quick two-waggle wave (a small, slow wave from sad; a startled hop from sleepy). */
function cheer(R: Rest, h: number, k: number): Beat {
  const air = jump(R, 0, { h, crouch: 120, rise: 230, fall: 190, settle: 200, dip: 1.5, squash: k, hands: false });
  return beat(1500, [
    ...air.keys,
    { t: 120, ease: PUSH, handL: rel(R.handL, { y: 3, r: 14 }), handR: rel(R.handR, { y: 3, r: -14 }) },
    { t: 270, ease: RISE, handL: { x: 2, y: -14, r: 95 }, handR: { x: -2, y: -14, r: -95 } },
    { t: 430, ease: SOFT, handL: UP_L, handR: UP_R },
    { t: 600, ease: OUT, handL: rel(R.handL, { y: 3, r: 10 }), handR: { x: -15, y: -29, r: -165 } },
    { t: 720, ease: SOFT, handL: R.handL, handR: WAVE_R },
    ...waggle("handR", WAVE_R, 830, 110, [20, -20, 20, -20]),
    { t: 1270, ease: OUT, handR: WAVE_R },
    { t: 1340, ease: OUT, handR: { x: -5, y: -14, r: -80 } },
    { t: 1440, ease: OUT, handR: rel(R.handR, { y: 3 }) },
  ]);
}

function braveWave(): Beat {
  const wave: Pose = { x: -18.5, y: -18.5, r: -166 };
  const lifted: Parts = { root: rel(S.root, { y: -2.5 }), body: rel(S.body, { sx: 0.97, sy: 1.06 }), eyes: { y: -1.8 }, footL: rel(S.footL, { y: 2.5 }), footR: rel(S.footR, { y: 2.5 }) };
  return beat(1700, [
    { t: 120, ease: OUT, root: rel(S.root, { y: 1.5 }), body: rel(S.body, { sx: 1.15, sy: 0.85 }), handL: rel(S.handL, { y: 2 }), handR: rel(S.handR, { y: 2 }) },
    { t: 480, ease: SOFT, ...lifted, handL: rel(S.handL, { y: -1 }), handR: { x: -22.6, y: -7.6, r: -80 } },
    { t: 720, ease: SOFT, handR: wave },
    ...waggle("handR", wave, 880, 170, [14, -14, 14, -14]),
    { t: 1440, ease: OUT, handR: wave, ...lifted },
    { t: 1560, ease: OUT, root: rel(S.root, { y: 0.8 }), body: rel(S.body, { sx: 1.06, sy: 0.91 }), eyes: {}, footL: S.footL, footR: S.footR, handL: S.handL, handR: { x: -23.4, y: -4.5, r: -70 } },
    { t: 1650, ease: OUT, handR: rel(S.handR, { y: 2 }) },
  ]);
}

function startle(): Beat {
  const hop = jump(Z, 0, {
    h: 10,
    crouch: 80,
    rise: 150,
    fall: 130,
    settle: 280,
    dip: 1.4,
    squash: 0.9,
    lag: 1.3,
    add: { apex: { handL: { y: -9, r: 20 }, handR: { y: -9, r: -20 } } },
  });
  return beat(1300, [...hop.keys, { t: 900, ease: OUT, root: rel(Z.root, { y: 0.8 }), body: rel(Z.body, { sy: 0.98, r: 1 }) }]);
}

/** The big one: three quick taps. A tall jump with a full spin of the whole character and the hands out. */
function twirl(R: Rest): Beat {
  const air = jump(R, 0, {
    h: 26,
    crouch: 160,
    rise: 340,
    fall: 290,
    settle: 300,
    dip: 1.2,
    hands: false,
    add: { stretch: { root: { r: 100 } }, apex: { root: { r: 230 } }, land: { root: { r: 360 } } },
  });
  const tl = 160 + 340 + 290;
  const out = (y: number): Parts => ({ handL: { x: 4, y, r: 90 }, handR: { x: -4, y, r: -90 } });
  return beat(1600, [
    ...air.keys,
    // 360 and 0 look the same: land on one, step to the other.
    { t: tl + 1, ease: OUT, root: R.root },
    { t: 160, ease: PUSH, handL: rel(R.handL, { y: 3, r: 14 }), handR: rel(R.handR, { y: 3, r: -14 }) },
    { t: 262, ease: OUT, ...out(-6) },
    { t: 500, ease: OUT, ...out(-8) },
    { t: tl, ease: OUT, ...out(-4) },
    { t: tl + 90, ease: OUT, handL: rel(R.handL, { y: 4, r: 14 }), handR: rel(R.handR, { y: 4, r: -14 }) },
    { t: tl + 260, ease: OUT, handL: rel(R.handL, { y: -1 }), handR: rel(R.handR, { y: -1 }) },
  ]);
}

const MOODS = Object.keys(REST) as PuffMood[];
const perMood = <T>(make: (rest: Rest, mood: PuffMood) => T) => Object.fromEntries(MOODS.map((m) => [m, make(REST[m], m)])) as Record<PuffMood, T>;
/** The ~550 ms move from wherever Puff is into a new mood's rest. */
export const SWITCH = perMood(switchBeat);
/** The tap reaction for each mood. */
export const REACTION: Record<PuffMood, Beat> = {
  happy: cheer(REST.happy, 14, 1),
  uneasy: cheer(REST.uneasy, 11, 0.85),
  worried: cheer(REST.worried, 8, 0.75),
  sad: braveWave(),
  sleepy: startle(),
};
/** The three-tap special for each mood. */
export const TWIRL = perMood(twirl);

/** What a beat gets for each part when it starts from somewhere other than rest: the computed transform (and the shadow's opacity). */
export type Capture = Partial<Record<PartName | "shadow", { transform: string; opacity?: string }>>;
type Frames = Partial<Record<PartName | "shadow", Keyframe[]>>;
type Stop = { at: number; css: string; ease: string; pose?: Pose };

// Higher means a smaller, fainter shadow, derived from where the root is.
function shadowAt(p: Pose, ground: number) {
  const h = Math.min(30, Math.max(0, ground - (p.y ?? 0)));
  return { transform: `translate(${f(p.x ?? 0)}px, 0px) scale(${f(1 - h * 0.012)}, ${f(1 - h * 0.012)})`, opacity: f(1 - h * 0.018) };
}

/**
 * One WAAPI keyframe list per part for a beat. Each part uses only the keys that name it, starts at `from` (or rest) and ends at
 * rest; a part in `from` with no keys still glides back to rest, so nothing snaps. The ground shadow follows the root's height.
 */
export function buildKeyframes(routine: Beat, rest: Rest, from: Capture = {}): Frames {
  const out: Frames = {};
  let rootStops: Stop[] | undefined;
  for (const part of PARTS) {
    const keys = routine.keys.filter((k) => k[part]);
    const start = from[part];
    if (!keys.length && !start) continue;
    const base = rest[part];
    const stops: Stop[] = [];
    if (start) stops.push({ at: 0, css: start.transform, ease: OUT });
    else if (keys[0].at > 0) stops.push({ at: 0, css: poseCss(base), ease: OUT, pose: base });
    for (const k of keys) stops.push({ at: Math.min(1, k.at), css: poseCss(k[part]), ease: k.ease ?? OUT, pose: k[part] });
    if (stops[stops.length - 1].at < 1) stops.push({ at: 1, css: poseCss(base), ease: "linear", pose: base });
    out[part] = stops.map((s) => ({ offset: s.at, transform: s.css, easing: s.ease }));
    if (part === "root") rootStops = stops;
  }
  if (rootStops) {
    const ground = rest.root.y ?? 0;
    out.shadow = rootStops.map((s) => ({ offset: s.at, easing: s.ease, ...(s.pose ? shadowAt(s.pose, ground) : (from.shadow ?? shadowAt(rest.root, ground))) }));
  }
  return out;
}
