"use client";

import { useMutation } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { adminErrorMessage } from "@/lib/admin/errors";
import { MAX_FILES, MIN_LONG_SIDE, countNoun, isLowRes, pluralForm, type MediaTarget } from "./shared";
import { UploadError, fileProblem, postFile, readImageSize } from "./upload";

type AttachItem = FunctionArgs<typeof api.media.attach>["items"][number];

/**
 * - `queued` → `uploading` → `uploaded` (file in storage) → `attaching` → `done`
 * - `failed`: upload or attach failed; retryable. A failed attach keeps its
 *   storage id, so a retry only re-attaches.
 * - `rejected`: refused before upload (type, size, limit); not retryable.
 */
export type UploadStatus =
  | "queued"
  | "uploading"
  | "uploaded"
  | "attaching"
  | "done"
  | "failed"
  | "rejected";

export type UploadRow = {
  readonly key: string;
  readonly name: string;
  readonly status: UploadStatus;
  /** 0–100. */
  readonly progress: number;
  readonly message?: string;
  readonly size?: { w: number; h: number };
};

type Entry = UploadRow & {
  readonly file: File;
  readonly storageId?: Id<"_storage">;
  /** A failure already counted in a summary toast. */
  readonly reported?: boolean;
};

type Deps = {
  generateUploadUrl: () => Promise<string>;
  attach: (items: AttachItem[]) => Promise<unknown>;
};

const CONCURRENCY = 3;
const ACTIVE: ReadonlySet<UploadStatus> = new Set(["queued", "uploading", "uploaded", "attaching"]);
const TERMINAL: ReadonlySet<UploadStatus> = new Set(["done", "failed", "rejected"]);

export function isActiveStatus(status: UploadStatus): boolean {
  return ACTIVE.has(status);
}

function uploadFailure(error: unknown): string {
  if (error instanceof UploadError) return error.message;
  return adminErrorMessage(error, "Otpremanje nije uspelo. Pokušajte ponovo.");
}

function doneMessage(count: number, target: MediaTarget): string {
  const noun = countNoun(count, target);
  const form = pluralForm(count);
  if (target === "gallery") {
    return form === "one" ? `Dodata je ${noun}.` : form === "few" ? `Dodate su ${noun}.` : `Dodato je ${noun}.`;
  }
  return form === "one" ? `Dodat je ${noun}.` : form === "few" ? `Dodata su ${noun}.` : `Dodato je ${noun}.`;
}

/**
 * The upload pipeline for one collection of one listing, kept outside React
 * so async work never races component state: uploads run up to three at a
 * time, and finished files are attached strictly in the order the user picked
 * them (a finished file waits for every earlier one that is still in flight).
 * Each file gets a fresh upload URL right before its POST (URLs expire).
 */
class UploadQueue {
  private entries: Entry[] = [];
  private snapshot: readonly UploadRow[] = [];
  private readonly listeners = new Set<() => void>();
  private deps: Deps | null = null;
  private running = 0;
  private attaching = false;
  private nextKey = 0;
  private tally = { done: 0, lowRes: 0 };

  constructor(private readonly target: MediaTarget) {}

  setDeps(deps: Deps) {
    this.deps = deps;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): readonly UploadRow[] => this.snapshot;

  /** Validates and queues a selection; `existing` is the collection's current size. */
  add = (files: readonly File[], existing: number) => {
    const pending = this.entries.filter((entry) => ACTIVE.has(entry.status)).length;
    let room = MAX_FILES - existing - pending;
    let rejected = 0;
    let firstProblem = "";

    for (const file of files) {
      const key = `u${this.nextKey++}`;
      let problem = fileProblem(file);
      if (problem === null && room <= 0) {
        problem = `Fajl „${file.name}” nije dodat: najviše ${MAX_FILES} fajlova po nekretnini.`;
      }
      if (problem !== null) {
        rejected += 1;
        if (firstProblem === "") firstProblem = problem;
        this.entries.push({ key, name: file.name, file, status: "rejected", progress: 0, message: problem });
        continue;
      }
      room -= 1;
      this.entries.push({ key, name: file.name, file, status: "queued", progress: 0 });
    }

    this.emit();
    if (rejected === 1) {
      toast.error(firstProblem);
    } else if (rejected > 1) {
      const form = pluralForm(rejected);
      const title =
        form === "one"
          ? `${rejected} fajl nije dodat.`
          : form === "few"
            ? `${rejected} fajla nisu dodata.`
            : `${rejected} fajlova nije dodato.`;
      toast.error(title, {
        description: "Razlozi su navedeni u listi otpremanja.",
      });
    }
    this.pump();
  };

  retry = (key: string) => {
    const entry = this.entries.find((item) => item.key === key);
    if (entry === undefined || entry.status !== "failed") return;
    // A retried file joins the end of the line, so it never blocks newer ones.
    const retried: Entry = {
      ...entry,
      status: entry.storageId !== undefined ? "uploaded" : "queued",
      progress: entry.storageId !== undefined ? 100 : 0,
      message: undefined,
      reported: false,
    };
    this.entries = [...this.entries.filter((item) => item.key !== key), retried];
    this.emit();
    if (retried.status === "uploaded") void this.flushAttach();
    this.pump();
  };

  dismiss = (key: string) => {
    const before = this.entries.length;
    this.entries = this.entries.filter((item) => item.key !== key || !TERMINAL.has(item.status));
    if (this.entries.length !== before) this.emit();
  };

  clearFinished = () => {
    const before = this.entries.length;
    this.entries = this.entries.filter((item) => !TERMINAL.has(item.status));
    if (this.entries.length !== before) this.emit();
  };

  private emit() {
    this.snapshot = this.entries.map(({ key, name, status, progress, message, size }) => ({
      key,
      name,
      status,
      progress,
      ...(message !== undefined ? { message } : {}),
      ...(size !== undefined ? { size } : {}),
    }));
    for (const listener of this.listeners) listener();
  }

  private patch(key: string, patch: Partial<Omit<Entry, "key" | "file" | "name">>) {
    let changed = false;
    this.entries = this.entries.map((entry) => {
      if (entry.key !== key) return entry;
      changed = true;
      return { ...entry, ...patch };
    });
    if (changed) this.emit();
  }

  private get(key: string): Entry | undefined {
    return this.entries.find((entry) => entry.key === key);
  }

  private pump() {
    while (this.running < CONCURRENCY) {
      const next = this.entries.find((entry) => entry.status === "queued");
      if (next === undefined) break;
      this.running += 1;
      this.patch(next.key, { status: "uploading", progress: 0 });
      void this.upload(next.key).finally(() => {
        this.running -= 1;
        this.pump();
      });
    }
    this.settleIfIdle();
  }

  private async upload(key: string) {
    const entry = this.get(key);
    if (entry === undefined) return;
    try {
      const deps = this.deps;
      if (deps === null) throw new UploadError("Otpremanje još nije spremno. Pokušajte ponovo.");
      if (entry.size === undefined) {
        const size = await readImageSize(entry.file);
        if (size !== null) this.patch(key, { size });
      }
      const uploadUrl = await deps.generateUploadUrl();
      let shown = 0;
      const storageId = await postFile(uploadUrl, entry.file, (percent) => {
        if (percent === shown) return;
        shown = percent;
        this.patch(key, { progress: percent });
      });
      this.patch(key, { status: "uploaded", progress: 100, storageId });
    } catch (error) {
      this.patch(key, { status: "failed", message: uploadFailure(error) });
    } finally {
      // A finished or failed file may release the ones waiting behind it.
      void this.flushAttach();
    }
  }

  /** Attaches the longest run of uploaded files at the head of the line, in one mutation. */
  private async flushAttach(): Promise<void> {
    if (this.attaching) return;
    const deps = this.deps;
    if (deps === null) return;

    const batch: Entry[] = [];
    for (const entry of this.entries) {
      if (TERMINAL.has(entry.status)) continue;
      if (entry.status === "uploaded" && entry.storageId !== undefined) {
        batch.push(entry);
        continue;
      }
      break;
    }
    if (batch.length === 0) {
      this.settleIfIdle();
      return;
    }

    this.attaching = true;
    for (const entry of batch) this.patch(entry.key, { status: "attaching" });
    const items: AttachItem[] = [];
    for (const entry of batch) {
      if (entry.storageId === undefined) continue;
      items.push({
        image: { kind: "storage", storageId: entry.storageId },
        alt: { sr: "" },
        ...(entry.size !== undefined ? { w: entry.size.w, h: entry.size.h } : {}),
        ...(this.target === "floorPlans" ? { room: "plan" as const } : {}),
      });
    }
    try {
      await deps.attach(items);
      for (const entry of batch) {
        this.tally.done += 1;
        if (entry.size !== undefined && isLowRes(entry.size.w, entry.size.h)) this.tally.lowRes += 1;
        this.patch(entry.key, { status: "done", progress: 100 });
      }
    } catch (error) {
      const message = adminErrorMessage(error, "Fajl je otpremljen, ali nije dodat. Pokušajte ponovo.");
      for (const entry of batch) this.patch(entry.key, { status: "failed", message });
    } finally {
      this.attaching = false;
    }
    await this.flushAttach();
  }

  /** Once nothing is in flight: one summary toast, and finished rows leave the list. */
  private settleIfIdle() {
    if (this.running > 0 || this.attaching) return;
    if (this.entries.some((entry) => ACTIVE.has(entry.status))) return;
    const { done, lowRes } = this.tally;
    const failed = this.entries.filter((entry) => entry.status === "failed" && entry.reported !== true).length;
    if (done === 0 && failed === 0) return;
    this.tally = { done: 0, lowRes: 0 };

    const lowResNote =
      lowRes > 0
        ? `Mala rezolucija: ${lowRes} (preporučeno je najmanje ${MIN_LONG_SIDE} px po dužoj strani).`
        : undefined;
    const failedNote = `Neuspešno otpremanje: ${countNoun(failed, this.target)}.`;
    if (done > 0 && failed === 0) {
      toast.success(doneMessage(done, this.target), lowResNote !== undefined ? { description: lowResNote } : undefined);
    } else if (done > 0) {
      toast.warning(`${doneMessage(done, this.target)} ${failedNote}`, {
        description: [lowResNote, "Neuspele fajlove pokušajte ponovo iz liste otpremanja."]
          .filter((line): line is string => line !== undefined)
          .join(" "),
      });
    } else {
      toast.error(failedNote, { description: "Pokušajte ponovo iz liste otpremanja." });
    }

    this.entries = this.entries
      .filter((entry) => entry.status !== "done")
      .map((entry) => (entry.status === "failed" ? { ...entry, reported: true } : entry));
    this.emit();
  }
}

/**
 * One upload queue per listing + collection. A new listing id gets a new queue;
 * the old one finishes attaching to its own listing in the background.
 */
export function useUploadQueue(listingId: Id<"listings">, target: MediaTarget) {
  const generateUploadUrl = useMutation(api.media.generateUploadUrl);
  const attach = useMutation(api.media.attach);

  const [holder, setHolder] = useState(() => ({ listingId, queue: new UploadQueue(target) }));
  if (holder.listingId !== listingId) {
    setHolder({ listingId, queue: new UploadQueue(target) });
  }
  const { queue } = holder;

  useEffect(() => {
    queue.setDeps({
      generateUploadUrl: () => generateUploadUrl({}),
      attach: (items) => attach({ listingId: holder.listingId, target, items }),
    });
  }, [queue, holder.listingId, target, generateUploadUrl, attach]);

  const rows = useSyncExternalStore(queue.subscribe, queue.getSnapshot, queue.getSnapshot);
  const busy = rows.some((row) => ACTIVE.has(row.status));

  // Leaving the page mid-upload loses the files still in flight.
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  return {
    rows,
    busy,
    add: queue.add,
    retry: queue.retry,
    dismiss: queue.dismiss,
    clearFinished: queue.clearFinished,
  };
}
