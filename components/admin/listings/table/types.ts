import type { FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api";

/** One row of `listingsAdmin.list`. */
export type AdminRow = FunctionReturnType<typeof api.listingsAdmin.list>["page"][number];

/** One entry of `agentsAdmin.list` (filter, bulk "assign" and the new-listing form). */
export type AgentOption = FunctionReturnType<typeof api.agentsAdmin.list>[number];

/** Rows requested per page, and the size "Učitaj još" adds. */
export const PAGE_SIZE = 25;
