import type { Group, Level } from "./bands";

export type More = { label: string; points: string[]; sources: [string, string][] };
export type Tip = { kind: "home" | "mask" | "child" | "meds" | "people" | "help" | "exercise"; text: string; more?: More };

const NEA_FAQ: [string, string] = ["NEA", "https://www.nea.gov.sg/our-services/pollution-control/air-pollution/faqs"];
const MOH: [string, string] = ["MOH", "https://www.moh.gov.sg/others/haze/"];

// Source: NEA air pollution FAQ (N95 fit and surgical masks, doctor first, HEPA and smoke CADR); MOH haze page (N95 not certified for children).
const MASK_MORE: More = {
  label: "Which mask?",
  points: [
    "An N95 with a good seal filters fine smoke (95% or more).",
    "Surgical masks do not.",
    "N95 masks are not made for children.",
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
  sources: [
    ["MOE", "https://www.moe.gov.sg/haze-management-measures"],
    ["ECDA", "https://www.msf.gov.sg/docs/default-source/student-care/haze-pm-psi-guide-a4-english-v16.pdf"],
  ],
};
const SCHOOL_TEXT: Record<number, string> = {
  2: "Schools and preschools cut long or hard outdoor activity.",
  3: "Schools keep pupils indoors with air purifiers; preschools stop outdoor play.",
  4: "Schools scale down lessons and may close if tomorrow is forecast Hazardous.",
};

/**
 * Practical steps for a level and group, following NEA, MOH, MOE and ECDA haze guidance:
 * stay indoors with windows closed, filter indoor air, N95 masks (not surgical masks, not for children)
 * for long outdoor exposure, and see a doctor if unwell. `level` is the current reading's level;
 * `psi24Level` is the 24-hr PSI level that MOE and ECDA use for school measures.
 */
export function tips(level: Level, group: Group, psi24Level: Level | null): Tip[] {
  if (level === 0) return [{ kind: "exercise", text: "A good day for outdoor exercise." }];
  if (level === 1) {
    return group === "healthy"
      ? [{ kind: "exercise", text: "Normal activities are fine. Air is acceptable for most people." }]
      : [
          { kind: "exercise", text: "Normal activities are fine." },
          { kind: "help", text: "Watch for coughing or breathlessness and slow down if you notice it." },
        ];
  }
  const out: Tip[] = [{ kind: "home", text: "Keep windows and doors closed. An air purifier with a HEPA filter cleans indoor air.", more: PURIFIER_MORE }];
  // Source: NEA FAQ: N95 for healthy people when PSI is above 300, for vulnerable people above 200, if outdoors for hours.
  const psi = psi24Level ?? level;
  if (group === "healthy" ? psi === 4 : psi >= 3) {
    const text =
      group === "sensitive"
        ? "Adults outdoors for hours may wear a well-fitted N95. Children cannot, so keep them indoors."
        : "Outdoors for hours? A well-fitted N95 mask filters fine smoke. Short trips do not need one.";
    out.push({ kind: "mask", text, more: MASK_MORE });
  }
  if (group === "sensitive" && psi24Level != null && psi24Level >= 2) {
    out.push({ kind: "child", text: SCHOOL_TEXT[psi24Level], more: SCHOOL_MORE });
  }
  if (group === "chronic") out.push({ kind: "meds", text: "Keep your inhaler or medicine with you and follow your doctor's action plan." });
  if (level >= 3) out.push({ kind: "people", text: "Check on elderly relatives and neighbours." });
  out.push({ kind: "help", text: "Breathless, chest pain or dizzy? Seek medical attention." });
  return out;
}
