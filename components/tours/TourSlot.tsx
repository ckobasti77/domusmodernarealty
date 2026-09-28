import Image from "next/image";
import { getTranslations } from "next-intl/server";
import type { Id } from "@/convex/_generated/dataModel";
import type { PublicImage } from "@/convex/lib/dto";
import { Badge } from "@/components/site/Badge";

/**
 * Placeholders for the listing page's "360° tura" and "3D šetnja" tabs until
 * step 11 ships the real viewers. They render a poster and an "Uskoro" state so
 * the tabs already exist, are keyboard-reachable and are tested.
 *
 * PROP CONTRACT (step 11 keeps these shapes and swaps the body for a
 * `next/dynamic({ ssr: false })` import of `Tour360` / `Walk3D`, wrapped in
 * `data-lenis-prevent`):
 *
 *  - `Tour360SlotProps.listingId` feeds `api.tours.scenes({ listingId })`;
 *    `sceneCount` is `listing.sceneCount` from `listings.bySlug`, already 0 when
 *    the tour is unpublished; `provider` / `externalUrl` come from
 *    `listing.tour360` — "self" means our Photo Sphere Viewer scenes,
 *    "matterport" / "kuula" mean an iframe behind a click-to-activate overlay.
 *  - `Walk3DSlotProps.listingId` feeds `api.tours.walk3d({ listingId })`, which
 *    returns the splat assets, spawn point, floor polygon and credits.
 *  - `poster` is the listing cover; `title` is the localized listing title,
 *    used for the viewer's accessible name.
 */

export type Tour360SlotProps = {
  listingId: Id<"listings">;
  title: string;
  poster?: PublicImage;
  sceneCount: number;
  provider: "self" | "matterport" | "kuula";
  externalUrl?: string;
};

export type Walk3DSlotProps = {
  listingId: Id<"listings">;
  title: string;
  poster?: PublicImage;
};

async function SoonPanel({
  heading,
  detail,
  poster,
  alt,
  kind,
}: {
  heading: string;
  detail?: string;
  poster?: PublicImage;
  alt: string;
  kind: "tour360" | "walk3d";
}) {
  const t = await getTranslations("listing");
  return (
    <div
      data-tour-slot={kind}
      className="relative flex aspect-[4/3] w-full items-end overflow-hidden bg-ink-2 md:aspect-[21/9]"
    >
      {poster !== undefined ? (
        <Image src={poster.url} alt={alt} fill sizes="100vw" className="object-cover opacity-45" />
      ) : null}
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-ink via-ink/60 to-transparent" />
      <div className="relative flex max-w-2xl flex-col gap-4 p-6 md:p-12">
        <Badge tone="dark" className="self-start">
          {t("soon")}
        </Badge>
        <h3 className="font-serif text-h2 text-ivory">{heading}</h3>
        {detail !== undefined ? (
          <p className="font-mono text-label uppercase tracking-[0.08em] text-mist">{detail}</p>
        ) : null}
        <p className="text-body text-mist">{t("tourSlot.soonBody")}</p>
      </div>
    </div>
  );
}

export async function Tour360Slot({ title, poster, sceneCount }: Tour360SlotProps) {
  const t = await getTranslations("listing.tourSlot");
  return (
    <SoonPanel
      kind="tour360"
      heading={t("heading360")}
      detail={sceneCount > 0 ? t("scenes", { count: sceneCount }) : undefined}
      poster={poster}
      alt={title}
    />
  );
}

export async function Walk3DSlot({ title, poster }: Walk3DSlotProps) {
  const t = await getTranslations("listing.tourSlot");
  return <SoonPanel kind="walk3d" heading={t("heading3d")} poster={poster} alt={title} />;
}
