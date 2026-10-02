import { BOOKING_DAYS, BOOKING_LEAD_MS, DAY_MS } from "@/convex/lib/belgradeTime";
import { belgradeDayKey } from "./belgrade-time";

/**
 * Which viewing slots the booking widget may still offer. `agents.slots`
 * returns the agent's whole grid for the window; the time rules live in
 * `viewings.request`, and the widget applies the same ones against its own
 * clock, so it never offers a slot the server would refuse for its time.
 */

export type ViewingSlot = { start: number; end: number; taken: boolean };

/**
 * Whether `viewings.request` accepts a slot starting at `start` when sent at
 * `now`: at least `BOOKING_LEAD_MS` ahead and at most `BOOKING_DAYS` out.
 */
export function isBookableStart(start: number, now: number): boolean {
  return start >= now + BOOKING_LEAD_MS && start <= now + BOOKING_DAYS * DAY_MS;
}

/**
 * The slots still on offer at `now`, grouped by Belgrade calendar day
 * (`YYYY-MM-DD`), in their original order. Taken slots stay in the list: the
 * widget shows them struck through rather than leaving a gap.
 */
export function offeredSlotsByDay<T extends ViewingSlot>(slots: readonly T[], now: number): Map<string, T[]> {
  const byDay = new Map<string, T[]>();
  for (const slot of slots) {
    if (!isBookableStart(slot.start, now)) continue;
    const key = belgradeDayKey(slot.start);
    const list = byDay.get(key);
    if (list === undefined) byDay.set(key, [slot]);
    else list.push(slot);
  }
  return byDay;
}
