"use client";

import { useTranslations } from "next-intl";

/** Shown inside the tour dialog while the viewer's chunk downloads. */
export function ViewerLoading() {
  const t = useTranslations("tours");
  return (
    <div className="flex size-full items-center justify-center bg-ink" role="status">
      <p className="font-sans text-small uppercase tracking-[0.12em] text-mist">{t("loading")}</p>
    </div>
  );
}
