import { adminErrorMessage, publishBlockers } from "@/lib/admin/errors";
import {
  FORM_KEYS,
  buildSave,
  deepEqual,
  dirtyKeys,
  docToForm,
  echoOf,
  invalidKeys,
  withKeys,
  type FormKey,
  type ListingDoc,
  type ListingForm,
  type ListingPatch,
  type SavePlan,
  type Unset,
} from "@/lib/admin/listing-form";

/** Quiet time after the last change before an autosave starts. */
export const AUTOSAVE_DELAY_MS = 1200;

/**
 * Inputs saved on blur rather than mid-typing: a price autosaved at "17" on its
 * way to "175000" would enter the public price history, and every slug save
 * leaves a 301 redirect behind. While one of them has focus its keys wait for
 * the blur, or for `FOCUS_HOLD_MS` without a change; a flush (Ctrl+S, publish,
 * leaving) sends them at once.
 */
export const COMMIT_ON_BLUR: Readonly<Record<string, readonly FormKey[]>> = {
  "f-price": ["price", "rent"],
  "f-slug": ["slug"],
};

export const FOCUS_HOLD_MS = 2 * AUTOSAVE_DELAY_MS;

export type SaveState = "saved" | "saving" | "dirty" | "error";

export type SaveSnapshot = {
  state: SaveState;
  /** Last successful save (initially the listing's `updatedAt`). */
  savedAt: number;
  error: string | null;
};

export type FlushResult = {
  /** False when the server refused or the network failed. */
  ok: boolean;
  /** Keys still unsaved afterwards (validation errors, half-filled contract…). */
  pending: FormKey[];
};

export type EngineDeps = {
  getValues: () => ListingForm;
  /** Writes a value that came from the server (not a user edit). */
  setValue: (key: FormKey, value: ListingForm[FormKey]) => void;
  /** Shows the schema errors of keys that could not be saved. */
  revealErrors: (keys: FormKey[]) => void;
  update: (patch: ListingPatch) => Promise<{ slug: string }>;
  unset: (field: Unset) => Promise<unknown>;
  /** The server refused `visibility: "public"` (Art. 18 checklist). */
  onVisibilityRefused: (reasons: string[]) => void;
  activeElementId: () => string | null;
};

/**
 * Debounced, serialized autosave for the listing editor.
 *
 * `baseline` is the form as the server last confirmed it; a top-level key is
 * dirty while the form differs from it. A save snapshots the values, sends the
 * dirty valid keys, and on success moves ONLY those keys' baseline to the
 * snapshot, so anything typed while the request was in flight stays dirty and
 * goes out with the follow-up save. At most one save runs at a time.
 *
 * Plain class on purpose: the React side only wires it up (see `useAutosave`),
 * and components read its state through `useSyncExternalStore`, so a state
 * change re-renders the save indicator, not the whole editor.
 */
export class AutosaveEngine {
  private baseline: ListingForm;
  private lastServer: ListingForm;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running: Promise<FlushResult> | null = null;
  private followUp = false;
  private discarded = false;
  private lastChangeAt = 0;
  private snapshot: SaveSnapshot;
  private readonly listeners = new Set<() => void>();
  private deps: EngineDeps | null = null;

  constructor(initial: ListingForm, savedAt: number) {
    this.baseline = structuredClone(initial);
    this.lastServer = structuredClone(initial);
    this.snapshot = { state: "saved", savedAt, error: null };
  }

  connect(deps: EngineDeps): void {
    this.deps = deps;
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly getSnapshot = (): SaveSnapshot => this.snapshot;

  private emit(next: Partial<SaveSnapshot>): void {
    const merged = { ...this.snapshot, ...next };
    if (
      merged.state === this.snapshot.state &&
      merged.savedAt === this.snapshot.savedAt &&
      merged.error === this.snapshot.error
    ) {
      return;
    }
    this.snapshot = merged;
    for (const listener of this.listeners) listener();
  }

  private dirty(): FormKey[] {
    return this.deps === null ? [] : dirtyKeys(this.deps.getValues(), this.baseline);
  }

  /** Dirty or saving: leaving now could lose work. */
  isBusy(): boolean {
    return this.running !== null || this.dirty().length > 0;
  }

  /** The user chose to leave without saving: nothing more is sent. */
  discard(): void {
    this.discarded = true;
    this.cancel();
  }

  get isDiscarded(): boolean {
    return this.discarded;
  }

  /** Call on every form change. */
  changed(): void {
    this.lastChangeAt = Date.now();
    const dirty = this.dirty().length > 0;
    // A failed save keeps its message visible until the next attempt starts.
    if (this.running === null && this.snapshot.state !== "error") {
      this.emit({ state: dirty ? "dirty" : "saved" });
    }
    if (dirty) this.schedule(AUTOSAVE_DELAY_MS);
  }

  schedule(delayMs: number): void {
    if (this.discarded) return;
    this.cancel();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.save("auto");
    }, delayMs);
  }

  cancel(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /** Saves everything saveable now (ignores the blur-commit hold) and reports what is left. */
  flush(): Promise<FlushResult> {
    this.cancel();
    return this.save("flush");
  }

  private async save(mode: "auto" | "flush"): Promise<FlushResult> {
    if (this.discarded) return { ok: true, pending: [] };
    if (this.running !== null) {
      if (mode === "auto") {
        this.followUp = true;
        return this.running;
      }
      await this.running;
      return this.save(mode);
    }
    const run = this.perform(mode);
    this.running = run;
    try {
      return await run;
    } finally {
      this.running = null;
      if (this.followUp) {
        this.followUp = false;
        this.schedule(0);
      }
    }
  }

  private async perform(mode: "auto" | "flush"): Promise<FlushResult> {
    const deps = this.deps;
    if (deps === null) return { ok: true, pending: [] };

    // RHF mutates nested objects in place: work on a deep copy.
    const values = structuredClone(deps.getValues());
    const dirty = dirtyKeys(values, this.baseline);
    if (dirty.length === 0) {
      this.emit({ state: "saved", error: null });
      return { ok: true, pending: [] };
    }

    const invalid = new Set(invalidKeys(values));
    const idle = Date.now() - this.lastChangeAt;
    const focused =
      mode === "auto" && idle < FOCUS_HOLD_MS ? (COMMIT_ON_BLUR[deps.activeElementId() ?? ""] ?? []) : [];
    const holding = dirty.some((key) => focused.includes(key));
    // Come back for the held keys once the input has been idle long enough.
    if (holding) this.schedule(FOCUS_HOLD_MS - idle);
    const keys = dirty.filter((key) => !invalid.has(key) && !focused.includes(key));
    const plan = buildSave(values, keys);
    const sending = Object.keys(plan.patch).length > 0 || plan.unsets.length > 0;

    let settled = keys.filter((key) => !plan.held.includes(key));
    if (sending) {
      this.emit({ state: "saving" });
      try {
        settled = await this.send(deps, plan, values, settled);
      } catch (error) {
        this.emit({ state: "error", error: adminErrorMessage(error, "Izmene nisu sačuvane.") });
        return { ok: false, pending: this.dirty() };
      }
    }

    this.baseline = withKeys(this.baseline, values, settled);
    const blocked = dirty.filter((key) => invalid.has(key) || plan.held.includes(key));
    if (blocked.length > 0) deps.revealErrors(blocked);

    const pending = this.dirty();
    this.emit({
      state: pending.length > 0 ? "dirty" : "saved",
      error: null,
      ...(sending ? { savedAt: Date.now() } : {}),
    });
    return { ok: true, pending };
  }

  /** Sends one plan; returns the keys that are now saved. */
  private async send(deps: EngineDeps, plan: SavePlan, values: ListingForm, settled: FormKey[]): Promise<FormKey[]> {
    // Going public is refused unless the publish checklist passes; sent on its
    // own so that refusal cannot sink the rest of the patch.
    const { visibility, ...rest } = plan.patch;
    const goingPublic = visibility === "public" && this.baseline.visibility !== "public";
    const main: ListingPatch = goingPublic ? rest : plan.patch;

    let out = settled;
    if (Object.keys(main).length > 0) {
      const { slug } = await deps.update(main);
      if (main.slug !== undefined && slug !== values.slug) {
        // The server made the slug unique ("…-2"): show what is live.
        if (deps.getValues().slug === values.slug) deps.setValue("slug", slug);
        values.slug = slug;
      }
    }
    if (goingPublic) {
      try {
        await deps.update({ visibility: "public" });
      } catch (error) {
        const reasons = publishBlockers(error);
        if (reasons === null) throw error;
        out = out.filter((key) => key !== "visibility");
        deps.setValue("visibility", this.baseline.visibility);
        deps.onVisibilityRefused(reasons);
      }
    }
    for (const field of plan.unsets) await deps.unset(field);
    return out;
  }

  /**
   * Brings in server-side changes (a status change flips `visibility`, a
   * colleague edits a field, `regenerateSlug`…) without touching what the user
   * is editing: only keys the server changed, that the form does not have
   * unsaved edits for, and that are not simply the echo of our own save.
   */
  rebase(doc: ListingDoc): void {
    const deps = this.deps;
    if (deps === null) return;
    const server = docToForm(doc);
    const previous = this.lastServer;
    this.lastServer = server;
    const values = deps.getValues();

    const incoming: FormKey[] = [];
    for (const key of FORM_KEYS) {
      if (deepEqual(server[key], previous[key])) continue;
      if (deepEqual(values[key], server[key])) {
        this.baseline = withKeys(this.baseline, server, [key]);
        continue;
      }
      if (deepEqual(server[key], echoOf(doc, values, key))) continue;
      if (!deepEqual(values[key], this.baseline[key])) continue;
      this.baseline = withKeys(this.baseline, server, [key]);
      incoming.push(key);
    }
    for (const key of incoming) deps.setValue(key, structuredClone(server[key]));
  }
}
