import type { FieldErrors } from "react-hook-form";
import { EDITOR_TABS, TAB_OF_KEY, isFormKey, type EditorTab, type ListingForm } from "@/lib/admin/listing-form";

/** Leaf errors under an RHF error node (skipping the DOM `ref` it carries). */
function leaves(node: unknown): number {
  if (typeof node !== "object" || node === null) return 0;
  const record = node as Record<string, unknown>;
  if (typeof record.message === "string" && typeof record.type === "string") return 1;
  let total = 0;
  for (const [key, value] of Object.entries(record)) {
    if (key === "ref") continue;
    total += leaves(value);
  }
  return total;
}

export function countErrors(errors: FieldErrors<ListingForm>): number {
  return leaves(errors);
}

/** Error counts per editor tab, for the dots on the tab triggers. */
export function errorsByTab(errors: FieldErrors<ListingForm>): Record<EditorTab, number> {
  const counts = Object.fromEntries(EDITOR_TABS.map((tab) => [tab, 0])) as Record<EditorTab, number>;
  for (const [key, value] of Object.entries(errors)) {
    if (!isFormKey(key)) continue;
    counts[TAB_OF_KEY[key]] += leaves(value);
  }
  return counts;
}
