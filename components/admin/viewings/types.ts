import type { FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api";

export type ViewingRow = FunctionReturnType<typeof api.viewingsAdmin.range>[number];
export type ViewingDetail = NonNullable<FunctionReturnType<typeof api.viewingsAdmin.get>>;
export type AgentOption = FunctionReturnType<typeof api.agentsAdmin.list>[number];

/** A Belgrade day on screen: its key and wall midnight (see `time.ts`). */
export type CalendarDay = { key: string; wall: number };
