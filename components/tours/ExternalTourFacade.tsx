"use client";

import { Rotate3d } from "lucide-react";
import { useTranslations } from "next-intl";
import { createContext, useContext, useState, type ReactNode } from "react";
import { Button } from "@/components/site/Button";

/**
 * Click-to-load facade for a Matterport or Kuula tour (docs/06-3D-TOURS.md).
 * Nothing from the provider loads until the visitor starts the tour; then the
 * player replaces the server-rendered poster (`children`) in place. Both hosts
 * are allowed by the CSP's `frame-src` (lib/csp.ts), and only their own embed
 * URLs reach this component (`externalTourEmbedUrl` in convex/lib/tours.ts).
 */

const StartContext = createContext<(() => void) | null>(null);

export function ExternalTourFacade({
  embedUrl,
  title,
  children,
}: {
  embedUrl: string;
  title: string;
  children: ReactNode;
}) {
  const t = useTranslations("tours");
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      // `overflow-clip`, not `hidden`: a `[data-lenis-prevent]` box must not be a scroll container.
      <div className="relative aspect-[4/3] w-full overflow-clip bg-ink-2 md:aspect-[21/9]" data-lenis-prevent="" data-tour-external="">
        <iframe
          src={embedUrl}
          title={t("viewer360", { title })}
          allow="fullscreen; xr-spatial-tracking; gyroscope; accelerometer"
          allowFullScreen
          className="absolute inset-0 size-full border-0"
        />
      </div>
    );
  }
  return <StartContext value={() => setPlaying(true)}>{children}</StartContext>;
}

/** The poster's start button; must sit inside `ExternalTourFacade`. */
export function ExternalTourStart({ provider }: { provider: "Matterport" | "Kuula" }) {
  const t = useTranslations("tours");
  const start = useContext(StartContext);
  return (
    <div className="flex flex-col items-start gap-3">
      <Button
        variant="inverse"
        onClick={() => start?.()}
        data-launch="external"
        className="h-auto min-h-[52px] px-5 py-3 sm:px-8"
      >
        <span className="flex items-center justify-center gap-3">
          <Rotate3d aria-hidden="true" strokeWidth={1.5} className="hidden size-5 sm:block" />
          {t("launchExternal")}
        </span>
      </Button>
      <p className="text-small text-mist">{t("externalNote", { provider })}</p>
    </div>
  );
}
