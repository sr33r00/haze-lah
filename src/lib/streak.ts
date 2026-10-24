import historyIndex from "../../data/history/index.json";
import type { HistoryIndex } from "./historyTypes";
import { hazeSpell, type Streak } from "./situation";
import { fetchPsiDay } from "./sources/nea";
import { psiByDate } from "./timeline";
import type { DayPsi } from "./types";
import { sgDate } from "./util";

const MAX_DAYS = 120; // how far back the spell is followed
const MAX_GAP_FETCHES = 10; // dated NEA requests spent on days neither the index nor `psiDaily` has

/**
 * The current haze spell (server only), from the committed history index, which can be days behind the last deploy, and
 * the live `psiDaily`. A past day the walk needs that neither has is read from NEA, a few at most; a failed read ends it there.
 */
export async function currentStreak(psiDaily: DayPsi[]): Promise<Streak | null> {
  const psi = psiByDate(historyIndex as HistoryIndex, psiDaily);
  const today = sgDate(0);
  let walk = hazeSpell(psi, today, MAX_DAYS);
  for (let fetches = 0; walk.missing && walk.missing !== today && fetches < MAX_GAP_FETCHES; fetches++) {
    const max = (await fetchPsiDay(walk.missing).catch(() => null))?.max;
    if (max == null) break;
    psi.set(walk.missing, max);
    walk = hazeSpell(psi, today, MAX_DAYS);
  }
  return walk.spell;
}
