"use client";

import { createIdListStore, useIdList } from "./id-list";

/**
 * The compare selection (PRD A12): 2–4 listings, kept on this device. The tray
 * on the search page and the `/uporedi` page read the same store; the page is
 * also shareable as `/uporedi?ids=a,b,c`.
 */
export const COMPARE_MAX = 4;
export const COMPARE_MIN = 2;

export const compareStore = createIdListStore("me.compare.v1", COMPARE_MAX);

export function useCompareIds(): readonly string[] {
  return useIdList(compareStore);
}

/**
 * Adds or removes a listing. Returns `false` when the selection is full, so
 * the caller can say why nothing happened.
 */
export function toggleCompare(id: string): boolean {
  return compareStore.toggle(id).accepted;
}

export function removeFromCompare(id: string) {
  compareStore.remove(id);
}

export function clearCompare() {
  compareStore.clear();
}
