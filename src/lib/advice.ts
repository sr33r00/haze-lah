import type { Group, Level, Step } from "./bands";

export type More = { label: string; points: string[]; sources: [string, string][] };
export type Tip = { kind: "home" | "mask" | "child" | "meds" | "people" | "help" | "exercise"; text: string; more?: More };

export const NEA_FAQ: [string, string] = ["NEA", "https://www.nea.gov.sg/our-services/pollution-control/air-pollution/faqs"];
export const MOH: [string, string] = ["MOH", "https://www.moh.gov.sg/others/haze/"];
export const MOE: [string, string] = ["MOE", "https://www.moe.gov.sg/about-us/emergency-preparedness/haze-management"];
// ECDA preschool rules are published in the Haze Task Force release.
export const ECDA: [string, string] = ["ECDA", "https://www.nea.gov.sg/media/news/news/index/singapore-ready-to-step-up-haze-response"];

// Source: NEA air pollution FAQ (N95 fit and surgical masks, doctor first, HEPA and smoke CADR); MOH haze page (N95 not certified for children).
const MASK_MORE: More = {
  label: "Which mask?",
  points: [
    "An N95 with a good seal filters fine smoke (95% or more).",
    "Surgical masks do not.",
    "No mask standard such as N95 covers children. MOH allows the AIR+ Smart Mask for children without heart or lung conditions, only where necessary.",
    "Trouble breathing at rest or on exertion? Check with a doctor first.",
  ],
  sources: [NEA_FAQ, MOH],
};
const PURIFIER_MORE: More = {
  label: "Choosing a purifier",
  points: ["Use a HEPA filter.", "Smoke CADR at least 3 times the room volume in m\u00b3.", "Keep doors and windows closed."],
  sources: [NEA_FAQ],
};
// Source: MOE haze management measures (24-hr PSI); ECDA/MSF preschool haze guide.
const SCHOOL_MORE: More = {
  label: "",
  points: [],
  sources: [MOE, ECDA],
};
const SCHOOL_TEXT: Record<number, string> = {
  2: "Schools avoid strenuous outdoor activity; pupils who are unwell or have heart or lung conditions skip all outdoor physical activity.",
  3: "Schools keep pupils indoors with air purifiers; preschools stop outdoor play.",
  4: "Schools scale down lessons and may close if tomorrow is forecast Hazardous.",
};

/**
 * Practical steps for a level and group, following NEA, MOH, MOE and ECDA haze guidance:
 * stay indoors with windows closed, filter indoor air, N95 masks (not surgical masks) for long outdoor exposure,
 * and see a doctor if unwell. `level` is the overall severity, `step` the advice step from adviceStep, and
 * `psi24Level` the 24-hr PSI level that MOE and ECDA use for school measures.
 */
export function tips(level: Level, step: Step, group: Group, psi24Level: Level | null): Tip[] {
  if (step === 0) {
    // NEA FAQ: at PSI 100 or below vulnerable persons who feel unwell should still seek medical attention promptly.
    return group === "healthy"
      ? [{ kind: "exercise", text: level === 0 ? "A good day for outdoor exercise." : "Normal activities are fine." }]
      : [
          { kind: "exercise", text: "Normal activities are fine." },
          { kind: "help", text: "Feeling unwell? See a doctor promptly." },
        ];
  }
  const out: Tip[] = [{ kind: "home", text: "Keep windows and doors closed. An air purifier with a HEPA filter cleans indoor air.", more: PURIFIER_MORE }];
  // NEA FAQ and MOH: an N95 for people outdoors for hours when healthy at PSI above 300 or PM2.5 band IV, and when
  // vulnerable at PSI above 200 or band III; in steps, that is "minimise" or "avoid" outdoor activity.
  if (step >= 4) {
    const text =
      group === "sensitive"
        ? "Adults outdoors for hours may wear a well-fitted N95, which is certified for adults only. Keep children's time outdoors short."
        : "Outdoors for hours? A well-fitted N95 mask filters fine smoke. Short trips do not need one.";
    out.push({ kind: "mask", text, more: MASK_MORE });
  }
  if (group === "sensitive" && psi24Level != null && psi24Level >= 2) {
    out.push({ kind: "child", text: SCHOOL_TEXT[psi24Level], more: SCHOOL_MORE });
  }
  // MOH: people with heart or lung conditions should keep their medication on hand.
  if (group === "chronic") out.push({ kind: "meds", text: "Keep your inhaler or medicine on hand." });
  if (level >= 3) out.push({ kind: "people", text: "Check on elderly relatives and neighbours." });
  // NEA and MOH: anyone not feeling well, or with breathing difficulties, should seek medical attention.
  out.push({ kind: "help", text: "Unwell or short of breath? Seek medical attention." });
  return out;
}
