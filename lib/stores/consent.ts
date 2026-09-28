"use client";

import { useSyncExternalStore } from "react";

/**
 * Cookie consent. Opt-in by category, which is what GDPR/ZZPL require: nothing
 * but `necessary` may be true until the visitor actually chooses. `null` means
 * "has not decided yet" and is what makes the banner appear — it is NOT the
 * same as "refused everything".
 */

const KEY = "me.consent.v1";

export type ConsentCategories = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
};

export type Consent = {
  v: 1;
  decidedAt: number;
  categories: ConsentCategories;
};

export const NECESSARY_ONLY: ConsentCategories = {
  necessary: true,
  analytics: false,
  marketing: false,
};

export const ALL_CATEGORIES: ConsentCategories = {
  necessary: true,
  analytics: true,
  marketing: true,
};

let cache: Consent | null = null;
let raw = "";
const listeners = new Set<() => void>();

function parse(value: string | null): Consent | null {
  if (value === null) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null) return null;
    const candidate = parsed as Partial<Consent>;
    if (candidate.v !== 1 || typeof candidate.decidedAt !== "number") return null;
    const categories = candidate.categories;
    if (typeof categories !== "object" || categories === null) return null;
    return {
      v: 1,
      decidedAt: candidate.decidedAt,
      categories: {
        necessary: true,
        analytics: categories.analytics === true,
        marketing: categories.marketing === true,
      },
    };
  } catch {
    return null;
  }
}

function refresh() {
  if (typeof window === "undefined") return;
  const value = window.localStorage.getItem(KEY);
  if (value === raw) return;
  raw = value ?? "";
  cache = parse(value);
}

function emit() {
  refresh();
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void) {
  if (listeners.size === 0) refresh();
  listeners.add(onChange);
  window.addEventListener("storage", emit);
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0) window.removeEventListener("storage", emit);
  };
}

function getSnapshot(): Consent | null {
  return cache;
}

/**
 * The server must render the page as if nothing was granted; the banner itself
 * waits for the first client render before it appears, so there is no hydration
 * mismatch and no flash of a banner for a visitor who already decided.
 */
function getServerSnapshot(): Consent | null {
  return null;
}

export function setConsent(categories: ConsentCategories) {
  const next: Consent = { v: 1, decidedAt: Date.now(), categories };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode: the choice holds for this page view only.
  }
  raw = JSON.stringify(next);
  cache = next;
  for (const listener of listeners) listener();
}

/** Re-opens the banner, e.g. from the "Cookies" link in the footer. */
export function resetConsent() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  raw = "";
  cache = null;
  for (const listener of listeners) listener();
}

export function useConsentRecord(): Consent | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * `useConsent()` — the hook the analytics and marketing scripts gate on.
 * `decided` is false until the visitor chooses, and every category except
 * `necessary` is false in that state.
 */
export function useConsent(): {
  decided: boolean;
  categories: ConsentCategories;
} {
  const record = useConsentRecord();
  return {
    decided: record !== null,
    categories: record?.categories ?? NECESSARY_ONLY,
  };
}
