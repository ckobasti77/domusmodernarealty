"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Favorites live in `localStorage` only — a visitor never signs in on the public
 * site, so there is nothing to attach them to server-side. The store is an
 * external store rather than React state so that the header counter, the card
 * buttons and the favorites page all read one value, and so the first client
 * render already has the right number (no flash of "0").
 */

const KEY = "me.favorites.v1";
const MAX = 200;

/** Bumped whenever the shape changes so a stale value is dropped, not crashed on. */
type Stored = { v: 1; ids: string[] };

let cache: readonly string[] = [];
let snapshot = "";
const listeners = new Set<() => void>();

function read(): readonly string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      (parsed as Stored).v !== 1 ||
      !Array.isArray((parsed as Stored).ids)
    ) {
      return [];
    }
    return (parsed as Stored).ids.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

function refresh() {
  const ids = read();
  const next = ids.join(",");
  if (next !== snapshot) {
    snapshot = next;
    cache = ids;
  }
}

function emit() {
  refresh();
  for (const listener of listeners) listener();
}

function write(ids: readonly string[]) {
  try {
    const payload: Stored = { v: 1, ids: ids.slice(0, MAX) };
    window.localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // Private mode or a full quota: the in-memory value still updates.
  }
  snapshot = ids.join(",");
  cache = ids;
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void) {
  if (listeners.size === 0) refresh();
  listeners.add(onChange);
  // `storage` only fires in *other* tabs, which is exactly the cross-tab sync
  // we want; same-tab changes go through `write`.
  window.addEventListener("storage", emit);
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0) window.removeEventListener("storage", emit);
  };
}

function getSnapshot(): readonly string[] {
  return cache;
}

function getServerSnapshot(): readonly string[] {
  return cache;
}

export function toggleFavorite(id: string): boolean {
  const current = read();
  const has = current.includes(id);
  write(has ? current.filter((x) => x !== id) : [id, ...current]);
  return !has;
}

export function clearFavorites() {
  write([]);
}

/** The whole list, newest first. */
export function useFavorites(): readonly string[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Just the count — what the header badge needs. */
export function useFavoriteCount(): number {
  return useFavorites().length;
}

/** `[isFavorite, toggle]` for a single listing. */
export function useFavorite(id: string): [boolean, () => void] {
  const ids = useFavorites();
  const toggle = useCallback(() => {
    toggleFavorite(id);
  }, [id]);
  return [ids.includes(id), toggle];
}
