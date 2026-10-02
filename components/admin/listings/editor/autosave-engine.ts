import { adminErrorMessage, isRefusal, publishBlockers, refusalMessage } from "@/lib/admin/errors";
import {
  FORM_KEYS,
  MANDATE_KEEP_MESSAGE,
  buildSave,
  contractCleared,
  deepEqual,
  dirtyKeys,
  docToForm,
  echoOf,
  invalidKeys,
  isClearableField,
  withKeys,
  type ClearableField,
  type FormKey,
  type ListingDoc,
  type ListingForm,
  type ListingPatch,
  type MediaUnset,
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

/**
 * Keys the server checks against each other, so they are only ever sent
 * together: the place chain (a new city and its cleared municipality), and the
 * price with the rent terms that mirror it.
 */
const SAVE_GROUPS: readonly (readonly FormKey[])[] = [
  ["cityId", "municipalityId", "neighborhoodId", "location"],
  ["transaction", "price", "rent"],
];

export type SaveState = "saved" | "saving" | "dirty" | "error";

/** A field the server refused, with its reason. */
export type Refusal = { key: FormKey; message: string };

export type SaveSnapshot = {
  state: SaveState;
  /** Last successful save (initially the listing's `updatedAt`). */
  savedAt: number;
  /** Why the state is "error": a failed request, or the first refused field. */
  error: string | null;
  /** Fields the server refused; each stays out of autosave until it is edited. */
  refused: readonly Refusal[];
};

export type FlushResult = {
  /** False when the server refused a field or the network failed. */
  ok: boolean;
  /** Keys still unsaved afterwards (validation errors, half-filled contract, refusals…). */
  pending: FormKey[];
};

/** Where a message about one field is shown: the key itself, or the contract's end date. */
export type ErrorPath = FormKey | "mandate.end";

export type EngineDeps = {
  getValues: () => ListingForm;
  /** Writes a value that came from the server (not a user edit). */
  setValue: (key: FormKey, value: ListingForm[FormKey]) => void;
  /** Shows the schema errors of keys that could not be saved. */
  revealErrors: (keys: FormKey[]) => void;
  /** Shows a save problem on a field; `null` takes it away again. */
  setFieldError: (path: ErrorPath, message: string | null) => void;
  /** One `listingsAdmin.update`: the patch and the fields it clears, checked as a whole. */
  update: (patch: ListingPatch, unset: readonly ClearableField[]) => Promise<{ slug: string }>;
  /** Clears the video, the 360° tour or the 3D walk through its own mutation. */
  unset: (field: MediaUnset) => Promise<unknown>;
  /** The server refused `visibility: "public"` (Art. 18 checklist). */
  onVisibilityRefused: (reasons: string[]) => void;
  activeElementId: () => string | null;
};

type Outcome = {
  /** Keys now stored on the server. */
  saved: FormKey[];
  /** Keys the server refused, with its reason. */
  refused: Map<FormKey, string>;
  /** A failure that is not about the data (connection, session): what was not sent stays dirty. */
  failure: string | null;
};

/** `keys` in the batches they may be sent in: each `SAVE_GROUPS` group whole, every other key alone. */
function batchesOf(keys: readonly FormKey[]): FormKey[][] {
  const rest = new Set(keys);
  const batches: FormKey[][] = [];
  for (const group of SAVE_GROUPS) {
    const members = group.filter((key) => rest.has(key));
    if (members.length === 0) continue;
    batches.push(members);
    for (const key of members) rest.delete(key);
  }
  for (const key of rest) batches.push([key]);
  return batches;
}

/**
 * Debounced, serialized autosave for the listing editor.
 *
 * `baseline` is the form as the server last confirmed it; a top-level key is
 * dirty while the form differs from it. A save snapshots the values, sends the
 * dirty valid keys, and on success moves ONLY those keys' baseline to the
 * snapshot, so anything typed while the request was in flight stays dirty and
 * goes out with the follow-up save. At most one save runs at a time.
 *
 * One field the server refuses must not hold back the others: when the
 * combined update is refused, its keys are resent in `batchesOf` batches, the
 * refused ones are marked on their fields (`refused`), and autosave leaves a
 * refused value alone until the user changes it. A flush retries it.
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
  /** Keys of the save in flight: a server update for them is the save landing, not news. */
  private readonly inFlight = new Set<FormKey>();
  /** Refused values, as sent, with the server's reason. */
  private readonly refusals = new Map<FormKey, { value: unknown; message: string }>();
  /** The last save failed for a reason other than the data. */
  private failure: string | null = null;
  /** The "contract cannot be removed" message is on the form. */
  private keepNotice = false;

  constructor(initial: ListingForm, savedAt: number) {
    this.baseline = structuredClone(initial);
    this.lastServer = structuredClone(initial);
    this.snapshot = { state: "saved", savedAt, error: null, refused: [] };
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
      merged.error === this.snapshot.error &&
      merged.refused === this.snapshot.refused
    ) {
      return;
    }
    this.snapshot = merged;
    for (const listener of this.listeners) listener();
  }

  /** The snapshot once nothing is running: an error while anything failed or was refused. */
  private settle(extra: Partial<SaveSnapshot> = {}): void {
    const refused = [...this.refusals].map(([key, { message }]) => ({ key, message }));
    const same =
      refused.length === this.snapshot.refused.length &&
      refused.every((item, index) => {
        const previous = this.snapshot.refused[index];
        return previous !== undefined && previous.key === item.key && previous.message === item.message;
      });
    const pending = this.dirty().length > 0;
    this.emit({
      state: this.failure !== null || refused.length > 0 ? "error" : pending ? "dirty" : "saved",
      error: this.failure ?? refused[0]?.message ?? null,
      refused: same ? this.snapshot.refused : refused,
      ...extra,
    });
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
    const deps = this.deps;
    if (deps !== null) this.forgetEdited(deps, deps.getValues());
    const dirty = this.dirty().length > 0;
    // A failed request keeps its message visible until the next attempt starts.
    if (this.running === null && this.failure === null) this.settle();
    if (dirty) this.schedule(AUTOSAVE_DELAY_MS);
  }

  /**
   * Drops what the user has since edited: a refusal whose value changed (it is
   * worth sending again) and the contract notice once the contract is back.
   * Runs before RHF validates the edit, so a new schema error is not wiped.
   */
  private forgetEdited(deps: EngineDeps, values: ListingForm): void {
    for (const [key, refusal] of this.refusals) {
      if (deepEqual(values[key], refusal.value)) continue;
      this.refusals.delete(key);
      deps.setFieldError(key, null);
    }
    if (this.keepNotice && !contractCleared(values.mandate, this.baseline.mandate)) {
      this.keepNotice = false;
      deps.setFieldError("mandate.end", null);
    }
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

  /** Saves everything saveable now (ignores the blur-commit hold, retries refusals) and reports what is left. */
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
    this.forgetEdited(deps, values);
    const dirty = dirtyKeys(values, this.baseline);
    if (dirty.length === 0) {
      this.failure = null;
      this.settle();
      return { ok: true, pending: [] };
    }

    const invalid = new Set(invalidKeys(values));
    // A stored contract cannot be emptied: say so, and keep the key unsaved.
    const keepContract = dirty.includes("mandate") && contractCleared(values.mandate, this.baseline.mandate);
    const idle = Date.now() - this.lastChangeAt;
    const focused =
      mode === "auto" && idle < FOCUS_HOLD_MS ? (COMMIT_ON_BLUR[deps.activeElementId() ?? ""] ?? []) : [];
    const holding = dirty.some((key) => focused.includes(key));
    // Come back for the held keys once the input has been idle long enough.
    if (holding) this.schedule(FOCUS_HOLD_MS - idle);
    const keys = dirty.filter(
      (key) =>
        !invalid.has(key) &&
        !focused.includes(key) &&
        !(key === "mandate" && keepContract) &&
        (mode === "flush" || !this.refusals.has(key)),
    );
    const plan = buildSave(values, keys);
    const sending = keys.filter((key) => !plan.held.includes(key));
    // Keys that write nothing (rent terms of a sale, an empty new contract) are settled as they are.
    const writes = Object.keys(plan.patch).length > 0 || plan.unsets.length > 0;

    let outcome: Outcome = { saved: writes ? [] : sending, refused: new Map(), failure: null };
    if (writes) {
      this.emit({ state: "saving" });
      for (const key of sending) this.inFlight.add(key);
      try {
        outcome = await this.send(deps, values, sending);
      } finally {
        this.inFlight.clear();
      }
    }
    this.baseline = withKeys(this.baseline, values, outcome.saved);
    for (const key of outcome.saved) {
      if (this.refusals.delete(key)) deps.setFieldError(key, null);
    }
    for (const [key, message] of outcome.refused) {
      this.refusals.set(key, { value: structuredClone(values[key]), message });
      deps.setFieldError(key, message);
    }
    this.failure = outcome.failure;

    const blocked = dirty.filter((key) => invalid.has(key) || plan.held.includes(key));
    if (blocked.length > 0) deps.revealErrors(blocked);
    if (keepContract) {
      this.keepNotice = true;
      deps.setFieldError("mandate.end", MANDATE_KEEP_MESSAGE);
    }

    this.settle(writes && outcome.saved.length > 0 ? { savedAt: Date.now() } : {});
    return { ok: outcome.failure === null && outcome.refused.size === 0, pending: this.dirty() };
  }

  /**
   * Sends `keys`: one combined update first; if the server refuses it, the
   * `batchesOf` batches one by one, so only the refused ones stay unsaved.
   * Going public and the media fields with mutations of their own go last,
   * each on its own.
   */
  private async send(deps: EngineDeps, values: ListingForm, keys: readonly FormKey[]): Promise<Outcome> {
    const outcome: Outcome = { saved: [], refused: new Map(), failure: null };
    const plan = buildSave(values, keys);
    const media = plan.unsets.filter((field): field is MediaUnset => !isClearableField(field));
    // Going public is refused unless the publish checklist passes; sent on its
    // own so that refusal cannot sink the rest of the patch.
    const goingPublic = plan.patch.visibility === "public" && this.baseline.visibility !== "public";
    const viaUpdate = keys.filter(
      (key) => !(key === "visibility" && goingPublic) && !media.some((field) => field === key),
    );

    const attempt = async (batch: readonly FormKey[]): Promise<"saved" | "refused" | "failed"> => {
      try {
        await this.write(deps, values, batch);
        outcome.saved.push(...batch);
        return "saved";
      } catch (error) {
        if (!isRefusal(error)) {
          outcome.failure = adminErrorMessage(error, "Izmene nisu sačuvane.");
          return "failed";
        }
        for (const key of batch) outcome.refused.set(key, refusalMessage(error));
        return "refused";
      }
    };

    if (viaUpdate.length > 0) {
      const batches = batchesOf(viaUpdate);
      const combined = await attempt(viaUpdate);
      if (combined === "failed") return outcome;
      if (combined === "refused" && batches.length > 1) {
        for (const key of viaUpdate) outcome.refused.delete(key);
        for (const batch of batches) {
          if ((await attempt(batch)) === "failed") return outcome;
        }
      }
    }

    for (const field of media) {
      try {
        await deps.unset(field);
        outcome.saved.push(field);
      } catch (error) {
        if (!isRefusal(error)) {
          outcome.failure = adminErrorMessage(error, "Izmene nisu sačuvane.");
          return outcome;
        }
        outcome.refused.set(field, refusalMessage(error));
      }
    }

    if (goingPublic) {
      try {
        await deps.update({ visibility: "public" }, []);
        outcome.saved.push("visibility");
      } catch (error) {
        const reasons = publishBlockers(error);
        if (reasons !== null) {
          deps.setValue("visibility", this.baseline.visibility);
          deps.onVisibilityRefused(reasons);
        } else if (isRefusal(error)) {
          outcome.refused.set("visibility", refusalMessage(error));
        } else {
          outcome.failure = adminErrorMessage(error, "Izmene nisu sačuvane.");
        }
      }
    }
    return outcome;
  }

  /** One `update` with the patch and clears of `keys`; nothing to write, nothing sent. */
  private async write(deps: EngineDeps, values: ListingForm, keys: readonly FormKey[]): Promise<void> {
    const { patch, unsets } = buildSave(values, keys);
    const clear = unsets.filter(isClearableField);
    if (Object.keys(patch).length === 0 && clear.length === 0) return;
    const { slug } = await deps.update(patch, clear);
    if (patch.slug !== undefined && slug !== values.slug) {
      // The server made the slug unique ("…-2"): show what is live.
      if (deps.getValues().slug === values.slug) deps.setValue("slug", slug);
      values.slug = slug;
    }
  }

  /**
   * Brings in server-side changes (a status change flips `visibility`, a
   * colleague edits a field, `regenerateSlug`…) without touching what the user
   * is editing: only keys the server changed, that the form does not have
   * unsaved edits for, that are not simply the echo of our own save, and that
   * are not part of a save still in flight (their baseline moves when it lands).
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
      if (this.inFlight.has(key)) continue;
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
