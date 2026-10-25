import { sgDate, shiftDate } from "../util";

/** Most days one daily-job call builds, so a backfill is made in several calls and each stays well inside a Worker's limits. */
export const MAX_RANGE_DAYS = 31;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** `value` as a date (YYYY-MM-DD), or `fallback` when it is empty; throws for anything else. */
function dateParam(name: string, value: string | null, fallback: string): string {
  const v = value || fallback;
  if (!DATE.test(v)) throw new Error(`${name} needs a date as YYYY-MM-DD`);
  return v;
}

/**
 * The SGT dates from `from` to `to`, oldest first, for a daily job. `to` defaults to yesterday and `from` to `to`.
 * Throws when a date is malformed, `from` is after `to`, `to` is not over yet, or the range is longer than `MAX_RANGE_DAYS`.
 */
export function dayRange(from: string | null, to: string | null): string[] {
  const last = dateParam("to", to, sgDate(-1));
  const first = dateParam("from", from, last);
  if (first > last) throw new Error(`from ${first} is after to ${last}`);
  if (last >= sgDate(0)) throw new Error(`to ${last}: that SGT day is not over yet`);
  const dates: string[] = [];
  for (let d = first; d <= last; d = shiftDate(d, 1)) {
    if (dates.length === MAX_RANGE_DAYS) throw new Error(`${first} to ${last} is more than ${MAX_RANGE_DAYS} days: build it in parts`);
    dates.push(d);
  }
  return dates;
}
