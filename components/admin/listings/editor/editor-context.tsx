"use client";

import type { FunctionReturnType } from "convex/server";
import { createContext, useContext, type ReactNode } from "react";
import type { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { AutosaveEngine } from "./autosave-engine";

/** `listingsAdmin.get` once it has loaded a listing. */
export type EditorData = NonNullable<FunctionReturnType<typeof api.listingsAdmin.get>>;

type EditorContextValue = {
  engine: AutosaveEngine;
  listingId: Id<"listings">;
  /** Fixed at mount: queries and the checklist take time as an argument. */
  now: number;
  /** Admin and manager may reassign a listing; an agent keeps their own. */
  canAssignAgent: boolean;
};

const EditorContext = createContext<EditorContextValue | null>(null);

export function EditorProvider({ value, children }: { value: EditorContextValue; children: ReactNode }) {
  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

export function useEditor(): EditorContextValue {
  const value = useContext(EditorContext);
  if (value === null) throw new Error("useEditor() must be used inside <EditorProvider>.");
  return value;
}
