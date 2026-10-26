import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { PuffMood } from "./Puff";
import { PARTS, REACTION, REACTION_FACE, REST, SWITCH, TWIRL, beatsFor, buildKeyframes, poseCss, type Beat, type Capture, type PuffReaction, type Rest } from "./puffRig";

/** How long a tap's reaction face stays. */
const REACT_MS = 1200;
/** This many taps within this many ms play the twirl. */
const TWIRL_TAPS = 3;
const TWIRL_WINDOW = 1500;

const rand = (min: number, max: number) => min + Math.random() * (max - min);

/**
 * Plays Puff's routines on the rig parts (`data-rig`) of one SVG with the Web Animations API. It waits a random 300 to 1500 ms,
 * plays a random routine of the mood (never the same twice), and repeats; a mood change or a tap takes over from wherever each
 * part is. Everything is paused off-screen and in a hidden tab, and does not play at all with reduced motion.
 */
class Player {
  private mood: PuffMood | null = null;
  private mask = false;
  private anims: Animation[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private run = 0;
  private last = "";
  private taps: number[] = [];
  private live = false;
  private reduced = false;
  private onscreen = true;
  private hidden = false;
  private svg: RefObject<SVGSVGElement | null>;

  constructor(svg: RefObject<SVGSVGElement | null>) {
    this.svg = svg;
  }

  private get on() {
    return this.live && !this.reduced && this.onscreen && !this.hidden;
  }

  // A part can appear twice while the face cross-fades (the eyes), so a part is a list of elements.
  private els(part: string): SVGGElement[] {
    return Array.from(this.svg.current?.querySelectorAll<SVGGElement>(`[data-rig="${part}"]`) ?? []);
  }

  /** Each part's live transform. A part that is not animating shows its old rest (React has already written the new one). */
  private capture(rest: Rest): Capture {
    const out: Capture = {};
    for (const part of [...PARTS, "shadow"] as const) {
      const els = this.els(part);
      const el = els.find((e) => e.getAnimations().length) ?? els[0];
      if (!el) continue;
      if (el.getAnimations().length) {
        const cs = getComputedStyle(el);
        out[part] = { transform: cs.transform, opacity: cs.opacity };
      } else if (part !== "shadow") out[part] = { transform: poseCss(rest[part]) };
    }
    return out;
  }

  private cancel() {
    this.run++;
    clearTimeout(this.timer);
    this.timer = undefined;
    for (const a of this.anims) a.cancel();
    this.anims = [];
  }

  /** Takes over: from the live pose (or the old rest) into `routine`, then back to resting between routines. */
  private play(routine: Beat, prev: Rest) {
    const mood = this.mood;
    if (!mood) return;
    const from = this.on ? this.capture(prev) : {};
    this.cancel();
    if (!this.on) return;
    const run = this.run;
    const frames = buildKeyframes(routine, REST[mood], from);
    for (const [part, kf] of Object.entries(frames)) for (const el of this.els(part)) this.anims.push(el.animate(kf, { duration: routine.ms, fill: "none" }));
    const lead = this.anims[0];
    if (!lead) return this.schedule();
    lead.onfinish = () => {
      if (run !== this.run) return;
      this.anims = [];
      this.schedule();
    };
  }

  private schedule() {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (!this.on) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.next();
    }, rand(300, 1500));
  }

  private next() {
    const mood = this.mood;
    if (!mood || !this.on) return;
    const all = beatsFor(mood, this.mask);
    const pool = all.filter(([id]) => id !== this.last);
    const [id, routine] = pool[Math.floor(Math.random() * pool.length)];
    this.last = id;
    this.play(routine, REST[mood]);
  }

  /** Brings the animations in line with motion, visibility and the tab: pauses or resumes, or drops them for reduced motion. */
  private sync() {
    if (this.reduced || !this.live) return this.cancel();
    if (!this.on) {
      for (const a of this.anims) a.pause();
      clearTimeout(this.timer);
      this.timer = undefined;
    } else if (this.anims.length) {
      for (const a of this.anims) if (a.playState === "paused") a.play();
    } else if (this.timer === undefined) this.schedule();
  }

  /** The mood and mask for the next routines; a new mood plays the switch hop from the old pose into the new rest. */
  look(mood: PuffMood, mask: boolean) {
    const prev = this.mood;
    this.mood = mood;
    this.mask = mask;
    if (prev && prev !== mood) this.play(SWITCH[mood], REST[prev]);
  }

  /** A tap: the mood's reaction, or the twirl on the third tap in quick succession. No motion when it is off. */
  poke() {
    const mood = this.mood;
    if (!mood || !this.on) return;
    const now = performance.now();
    this.taps = this.taps.filter((t) => now - t < TWIRL_WINDOW).concat(now);
    const spin = this.taps.length >= TWIRL_TAPS;
    if (spin) this.taps = [];
    this.last = "";
    this.play(spin ? TWIRL[mood] : REACTION[mood], REST[mood]);
  }

  /** Starts watching motion preference, visibility and the tab; returns the cleanup. */
  attach(): () => void {
    const svg = this.svg.current;
    if (!svg) return () => {};
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => {
      this.reduced = mq.matches;
      this.sync();
    };
    const onTab = () => {
      this.hidden = document.hidden;
      this.sync();
    };
    const io = new IntersectionObserver(([e]) => {
      this.onscreen = e.isIntersecting;
      this.sync();
    });
    this.live = true;
    this.reduced = mq.matches;
    this.hidden = document.hidden;
    mq.addEventListener("change", onMotion);
    document.addEventListener("visibilitychange", onTab);
    io.observe(svg);
    this.sync();
    return () => {
      mq.removeEventListener("change", onMotion);
      document.removeEventListener("visibilitychange", onTab);
      io.disconnect();
      this.live = false;
      this.cancel();
    };
  }
}

/**
 * Puff's acting: wires the rig player to the SVG and returns `poke` (call it on a tap) and the face the tap shows for a moment
 * (null the rest of the time; it shows even when motion is off). Randomness runs only in effects, so the server picture is the rest pose.
 */
export function usePuffRig(svg: RefObject<SVGSVGElement | null>, mood: PuffMood, mask: boolean) {
  const [player] = useState(() => new Player(svg));
  const [tap, setTap] = useState<{ mood: PuffMood; face: PuffReaction } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useLayoutEffect(() => player.look(mood, mask), [player, mood, mask]);
  useEffect(() => player.attach(), [player]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const poke = useCallback(() => {
    player.poke();
    setTap({ mood, face: REACTION_FACE[mood] });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setTap(null), REACT_MS);
  }, [player, mood]);

  return { poke, reaction: tap && tap.mood === mood ? tap.face : null };
}
