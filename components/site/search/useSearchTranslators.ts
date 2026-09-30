"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import type { SearchTranslators } from "@/lib/search-text";

/** The four translators `lib/search-text.ts` needs, bundled for client components. */
export function useSearchTranslators(): SearchTranslators {
  const search = useTranslations("search");
  const filters = useTranslations("filters");
  const listing = useTranslations("listing");
  const units = useTranslations("units");
  return useMemo(() => ({ search, filters, listing, units }), [search, filters, listing, units]);
}
