"use client";

import { useSyncExternalStore } from "react";

/**
 * Which listing the pointer (or keyboard focus) is on, shared by the result
 * cards and the map pins so each highlights the other (PRD A3). A tiny
 * external store instead of context: `useIsHovered(id)` re-renders only the
 * two components whose answer changed, not all 24 cards and every pin.
 */
export type HoverSource = "list" | "map";

type HoverState = { id: string | null; source: HoverSource | null };

const IDLE: HoverState = { id: null, source: null };

let state: HoverState = IDLE;
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function setHoveredListing(id: string | null, source: HoverSource) {
  if (id === null) {
    // Only the side that set the highlight may clear it, so leaving a card
    // cannot wipe a highlight the map has just set (and vice versa).
    if (state.source !== source) return;
    state = IDLE;
  } else if (state.id === id && state.source === source) {
    return;
  } else {
    state = { id, source };
  }
  for (const listener of listeners) listener();
}

export function useHoveredListing(): HoverState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => IDLE,
  );
}

export function useIsHovered(id: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => state.id === id,
    () => false,
  );
}
