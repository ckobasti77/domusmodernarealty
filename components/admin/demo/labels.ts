/** The exact phrase `demo.purge` requires (server-checked). */
export const DEMO_CONFIRM = "OBRIŠI DEMO";

/** Serbian names for the tables `demo.counts` reports. */
const DEMO_TABLE_LABEL: Record<string, string> = {
  listings: "Nekretnine",
  locations: "Lokacije",
  agents: "Agenti",
  posts: "Magazin",
  pages: "Stranice",
  testimonials: "Utisci",
  leads: "Upiti",
  viewings: "Razgledanja",
  contacts: "Kontakti",
};

export function demoTableLabel(table: string): string {
  return DEMO_TABLE_LABEL[table] ?? table;
}

/** A purge whose "finished" row has not appeared after this long is reported as stalled. */
const STALL_MS = 10 * 60_000;

export type PurgeState =
  | { kind: "none" }
  | { kind: "running"; since: number }
  | { kind: "stalled"; since: number }
  | { kind: "finished"; at: number };

/**
 * Derived from the newest `demo` activity row, so the state survives a reload
 * and is the same for every admin: `demo.purge.started` without a later
 * `demo.purge.finished` means the scheduled batches are still running.
 */
export function purgeStateOf(latest: { action: string; at: number } | undefined, clock: number): PurgeState {
  if (latest === undefined) return { kind: "none" };
  if (latest.action === "demo.purge.started") {
    return clock - latest.at < STALL_MS
      ? { kind: "running", since: latest.at }
      : { kind: "stalled", since: latest.at };
  }
  if (latest.action === "demo.purge.finished") return { kind: "finished", at: latest.at };
  return { kind: "none" };
}
