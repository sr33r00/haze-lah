import type { Group, Level } from "./bands";

export type Tip = { kind: "home" | "mask" | "child" | "meds" | "people" | "help" | "exercise"; text: string };

/**
 * Practical steps for a level and group, following NEA and MOH haze guidance:
 * stay indoors with windows closed, filter indoor air, N95 masks (not surgical masks)
 * for long outdoor exposure, and see a doctor if unwell.
 */
export function tips(level: Level, group: Group): Tip[] {
  if (level === 0) return [{ kind: "exercise", text: "A good day for outdoor exercise." }];
  if (level === 1) {
    return group === "healthy"
      ? [{ kind: "exercise", text: "Normal activities are fine. Air is acceptable for most people." }]
      : [
          { kind: "exercise", text: "Normal activities are fine." },
          { kind: "help", text: "Watch for coughing or breathlessness and slow down if you notice it." },
        ];
  }
  const out: Tip[] = [{ kind: "home", text: "Keep windows and doors closed. An air purifier with a HEPA filter cleans indoor air." }];
  if (level >= 3 || group !== "healthy") {
    out.push({ kind: "mask", text: "Outdoors for hours? A well-fitted N95 mask filters fine smoke. Surgical masks do not. Short trips do not need one." });
  }
  if (group === "sensitive") out.push({ kind: "child", text: "Move children's play and PE indoors. Pregnant women should rest more often." });
  if (group === "chronic") out.push({ kind: "meds", text: "Keep your inhaler or medicine with you and follow your doctor's action plan." });
  if (level >= 3) out.push({ kind: "people", text: "Check on elderly relatives and neighbours." });
  out.push({ kind: "help", text: "Breathless, chest pain or dizzy? Seek medical attention." });
  return out;
}
