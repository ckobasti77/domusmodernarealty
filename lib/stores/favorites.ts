"use client";

import { useCallback } from "react";
import { createIdListStore, useIdList } from "./id-list";

/**
 * Favorites live in `localStorage` only — a visitor never signs in on the public
 * site, so there is nothing to attach them to server-side (PRD A12). The header
 * counter, the card hearts and the favorites page all read this one store.
 */
export const favoritesStore = createIdListStore("me.favorites.v1", 200);

export function toggleFavorite(id: string): boolean {
  return favoritesStore.toggle(id).added;
}

export function clearFavorites() {
  favoritesStore.clear();
}

/** The whole list, newest first. */
export function useFavorites(): readonly string[] {
  return useIdList(favoritesStore);
}

/** Just the count — what the header badge needs. */
export function useFavoriteCount(): number {
  return useFavorites().length;
}

/** `[isFavorite, toggle]` for a single listing. */
export function useFavorite(id: string): [boolean, () => void] {
  const ids = useFavorites();
  const toggle = useCallback(() => {
    favoritesStore.toggle(id);
  }, [id]);
  return [ids.includes(id), toggle];
}
