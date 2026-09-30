"use client";

import { useSyncExternalStore } from "react";

/**
 * A list of listing ids persisted in `localStorage` and read through
 * `useSyncExternalStore`, so every reader (header counter, card buttons, the
 * compare tray, the favorites page) shares ONE value and re-renders together.
 *
 * - The snapshot is the same frozen array until a write happens (React would
 *   loop forever on a fresh array per read).
 * - The server snapshot is always empty, and the stored value is read only
 *   once something subscribes — i.e. after hydration — so the first client
 *   render matches the server HTML.
 * - `storage` events keep other tabs in sync; same-tab writes notify directly.
 */
export type IdListStore = {
  read(): readonly string[];
  toggle(id: string): { added: boolean; accepted: boolean };
  remove(id: string): void;
  clear(): void;
  subscribe(onChange: () => void): () => void;
  getSnapshot(): readonly string[];
  getServerSnapshot(): readonly string[];
  max: number;
};

const EMPTY: readonly string[] = Object.freeze([]);

export function createIdListStore(key: string, max: number): IdListStore {
  type Stored = { v: 1; ids: string[] };

  let cache: readonly string[] = EMPTY;
  let signature = "";
  const listeners = new Set<() => void>();

  function load(): readonly string[] {
    if (typeof window === "undefined") return EMPTY;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return EMPTY;
      const parsed: unknown = JSON.parse(raw);
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        (parsed as Stored).v !== 1 ||
        !Array.isArray((parsed as Stored).ids)
      ) {
        return EMPTY;
      }
      return (parsed as Stored).ids.filter((id): id is string => typeof id === "string").slice(0, max);
    } catch {
      return EMPTY;
    }
  }

  function adopt(ids: readonly string[]): boolean {
    const next = ids.join(",");
    if (next === signature) return false;
    signature = next;
    cache = Object.freeze([...ids]);
    return true;
  }

  function notify() {
    for (const listener of listeners) listener();
  }

  function onStorage(event: StorageEvent) {
    if (event.key !== null && event.key !== key) return;
    if (adopt(load())) notify();
  }

  function write(ids: readonly string[]) {
    const kept = ids.slice(0, max);
    try {
      const payload: Stored = { v: 1, ids: [...kept] };
      window.localStorage.setItem(key, JSON.stringify(payload));
    } catch {
      // Private mode or a full quota: the in-memory value still updates.
    }
    if (adopt(kept)) notify();
  }

  function subscribe(onChange: () => void) {
    if (listeners.size === 0) {
      adopt(load());
      window.addEventListener("storage", onStorage);
    }
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
      if (listeners.size === 0) window.removeEventListener("storage", onStorage);
    };
  }

  const getSnapshot = () => cache;
  const getServerSnapshot = () => EMPTY;

  return {
    max,
    read: () => (listeners.size > 0 ? cache : load()),
    toggle(id) {
      const current = listeners.size > 0 ? cache : load();
      if (current.includes(id)) {
        write(current.filter((value) => value !== id));
        return { added: false, accepted: true };
      }
      if (current.length >= max) return { added: false, accepted: false };
      write([id, ...current]);
      return { added: true, accepted: true };
    },
    remove(id) {
      const current = listeners.size > 0 ? cache : load();
      write(current.filter((value) => value !== id));
    },
    clear() {
      write([]);
    },
    subscribe,
    getSnapshot,
    getServerSnapshot,
  };
}

/** The ids of one store, newest first. */
export function useIdList(store: IdListStore): readonly string[] {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}
