"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { PUBLIC_STATUSES } from "@/convex/lib/validators";
import { adminErrorMessage } from "@/lib/admin/errors";
import type { ListingDoc } from "@/lib/admin/listing-form";
import type { AutosaveEngine } from "./autosave-engine";
import { useEditor } from "./editor-context";

export function publicPath(slug: string): string {
  return `/sr/nekretnine/${slug}`;
}

export function previewPath(slug: string, token: string): string {
  return `${publicPath(slug)}?preview=${encodeURIComponent(token)}`;
}

/** Reachable by visitors right now (the same rule as `bucketOf` on the server). */
export function isOnSite(listing: Pick<ListingDoc, "status" | "visibility">): boolean {
  return listing.visibility === "public" && (PUBLIC_STATUSES as readonly string[]).includes(listing.status);
}

/** The staff preview link: the live one if it has not expired, else a way to make one. */
export function usePreviewLink(listing: ListingDoc) {
  const { now } = useEditor();
  const rotate = useMutation(api.listingsAdmin.rotatePreviewToken);
  const [busy, setBusy] = useState(false);
  const token = listing.previewToken;
  const expiresAt = listing.previewExpiresAt;
  const valid = token !== undefined && expiresAt !== undefined && expiresAt > now;

  /** Issues a new token (the previous link stops working); `null` on failure. */
  const create = async (): Promise<string | null> => {
    setBusy(true);
    try {
      const result = await rotate({ id: listing._id });
      return previewPath(listing.slug, result.token);
    } catch (error) {
      toast.error(adminErrorMessage(error, "Link za pregled nije napravljen."));
      return null;
    } finally {
      setBusy(false);
    }
  };

  return {
    path: valid ? previewPath(listing.slug, token) : null,
    expiresAt: valid ? expiresAt : undefined,
    create,
    busy,
  };
}

/**
 * Opens a page in a new tab after the pending autosave has landed, so the
 * preview shows what was just typed. The tab is opened synchronously (inside
 * the click) so popup blockers allow it, then pointed at the URL.
 */
export async function openAfterSave(engine: AutosaveEngine, resolvePath: () => Promise<string | null>): Promise<void> {
  const tab = window.open("", "_blank");
  await engine.flush();
  const path = await resolvePath();
  if (path === null) {
    tab?.close();
    return;
  }
  if (tab === null) {
    window.open(path, "_blank", "noopener");
    return;
  }
  tab.opener = null;
  tab.location.replace(path);
}
