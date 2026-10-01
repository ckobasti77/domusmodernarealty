"use client";

import { Rotate3d } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/site/Button";
import { TourDialog } from "./TourDialog";
import type { TourScene } from "./types";
import { ViewerLoading } from "./ViewerLoading";

/** Photo Sphere Viewer and its plugins download only when the visitor opens the tour. */
const Tour360 = dynamic(() => import("./Tour360"), { ssr: false, loading: () => <ViewerLoading /> });

export function Tour360Launcher({ scenes, title }: { scenes: TourScene[]; title: string }) {
  const t = useTranslations("tours");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="inverse"
        onClick={() => setOpen(true)}
        data-launch="tour360"
        className="h-auto min-h-[52px] px-5 py-3 sm:px-8"
      >
        <span className="flex items-center justify-center gap-3">
          <Rotate3d aria-hidden="true" strokeWidth={1.5} className="hidden size-5 sm:block" />
          {t("launch360")}
        </span>
      </Button>
      {open ? (
        <TourDialog label={t("viewer360", { title })} onClose={() => setOpen(false)}>
          <Tour360 scenes={scenes} title={title} />
        </TourDialog>
      ) : null}
    </>
  );
}
