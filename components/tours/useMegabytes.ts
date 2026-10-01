"use client";

import { useFormatter } from "next-intl";

/** Formats a byte count as whole megabytes in the visitor's locale ("43 MB", "43 МБ"). */
export function useMegabytes(): (bytes: number) => string {
  const format = useFormatter();
  return (bytes) =>
    format.number(Math.max(1, Math.round(bytes / 1_000_000)), { style: "unit", unit: "megabyte" });
}
