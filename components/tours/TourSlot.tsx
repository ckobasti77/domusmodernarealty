import Image from "next/image";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Badge } from "@/components/site/Badge";
import type { PublicImage } from "@/convex/lib/dto";
import { Credits } from "./Credits";
import { ExternalTourFacade, ExternalTourStart } from "./ExternalTourFacade";
import { Tour360Launcher } from "./Tour360Launcher";
import type { TourScene, WalkData } from "./types";
import { Walk3DLauncher } from "./Walk3DLauncher";

/**
 * The listing page's "360° tura" and "3D šetnja" tabs. Each renders a poster
 * panel on the server and a small client launcher; the viewers themselves
 * (Photo Sphere Viewer, three.js + Spark) are `next/dynamic` imports that
 * download only after the visitor clicks, so the listing page's own bundle
 * does not grow (IMPLEMENTATION-PLAN step 11).
 */

function TourPanel({
  kind,
  heading,
  meta,
  poster,
  alt,
  badges,
  footer,
  children,
}: {
  kind: "tour360" | "walk3d";
  heading: string;
  /** The mono line above the heading ("4 prostorije"). */
  meta?: string;
  poster?: { url: string; unoptimized?: boolean };
  alt: string;
  badges?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      data-tour-slot={kind}
      className="relative flex min-h-[26rem] w-full items-end overflow-hidden bg-ink-2 md:aspect-[16/9] md:min-h-0 lg:aspect-[21/9]"
    >
      {poster !== undefined ? (
        <Image
          src={poster.url}
          alt={alt}
          fill
          sizes="(min-width: 1440px) 1344px, 100vw"
          unoptimized={poster.unoptimized}
          className="object-cover"
        />
      ) : null}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/35 via-40% to-transparent to-75%"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 hidden bg-gradient-to-r from-ink/60 to-transparent to-50% md:block"
      />
      <div className="relative flex max-w-2xl flex-col items-start gap-4 p-6 md:p-12">
        {badges !== undefined || meta !== undefined ? (
          <div className="flex flex-wrap items-center gap-3">
            {badges}
            {meta !== undefined ? (
              <p className="font-mono text-label uppercase tracking-[0.08em] text-ivory">{meta}</p>
            ) : null}
          </div>
        ) : null}
        <h3 className="font-display text-display-m text-ivory">{heading}</h3>
        {children}
        {footer}
      </div>
    </div>
  );
}

export type Tour360SlotProps = {
  title: string;
  /** Demo listings say so on their tours (the scenes are stock panoramas). */
  isDemo: boolean;
  poster?: PublicImage;
  provider: "self" | "matterport" | "kuula";
  /** Self-hosted scenes (provider "self"). */
  scenes: TourScene[];
  /** Checked Matterport/Kuula player URL (`listing.tour360.embedUrl`). */
  embedUrl?: string;
};

export async function Tour360Slot({ title, isDemo, poster, provider, scenes, embedUrl }: Tour360SlotProps) {
  const t = await getTranslations("listing.tourSlot");
  const tTours = await getTranslations("tours");

  if (provider !== "self") {
    if (embedUrl === undefined) return null;
    return (
      <ExternalTourFacade embedUrl={embedUrl} title={title}>
        <TourPanel
          kind="tour360"
          heading={t("heading360")}
          poster={poster}
          alt={title}
          badges={isDemo ? <Badge tone="dark">{tTours("demo")}</Badge> : undefined}
        >
          <ExternalTourStart provider={provider === "matterport" ? "Matterport" : "Kuula"} />
        </TourPanel>
      </ExternalTourFacade>
    );
  }

  const credit = scenes.find((scene) => scene.credit !== undefined)?.credit;
  // The first room itself is the poster: the centre band of its 2:1 panorama crops well.
  const firstPano = scenes[0]?.panoMobileUrl ?? scenes[0]?.panoUrl;
  return (
    <TourPanel
      kind="tour360"
      heading={t("heading360")}
      meta={t("scenes", { count: scenes.length })}
      poster={firstPano !== undefined ? { url: firstPano, unoptimized: !firstPano.startsWith("/") } : poster}
      alt={title}
      badges={isDemo ? <Badge tone="dark">{tTours("demo")}</Badge> : undefined}
      footer={
        credit !== undefined ? (
          <p className="text-[11px] text-mist">
            <Credits text={credit} label={(name) => tTours("panoCredit", { credit: name })} />
          </p>
        ) : null
      }
    >
      <Tour360Launcher scenes={scenes} title={title} />
    </TourPanel>
  );
}

export type Walk3DSlotProps = {
  title: string;
  isDemo: boolean;
  poster?: PublicImage;
  /** The walkthrough's own poster (admin), preferred over the listing cover. */
  posterUrl?: string;
  walk: WalkData;
  /** The listing's 360° scenes, offered when the walk cannot run here. */
  scenes: TourScene[];
};

export async function Walk3DSlot({ title, isDemo, poster, posterUrl, walk, scenes }: Walk3DSlotProps) {
  const t = await getTranslations("listing.tourSlot");
  const tTours = await getTranslations("tours");
  return (
    <TourPanel
      kind="walk3d"
      heading={t("heading3d")}
      poster={posterUrl !== undefined ? { url: posterUrl, unoptimized: !posterUrl.startsWith("/") } : poster}
      alt={title}
      badges={
        <>
          <Badge tone="dark">{tTours("beta")}</Badge>
          {isDemo ? <Badge tone="dark">{tTours("demo")}</Badge> : null}
        </>
      }
      footer={
        walk.credits !== undefined ? (
          <p className="text-[11px] text-mist">
            <Credits text={walk.credits} label={(credits) => tTours("attribution", { credits })} />
          </p>
        ) : null
      }
    >
      <Walk3DLauncher walk={walk} title={title} scenes={scenes} />
    </TourPanel>
  );
}
