"use client";

import { useLenis } from "lenis/react";
import { useLocale, useTranslations } from "next-intl";
import type { HTMLAttributes } from "react";
import Lightbox, { type SlideImage } from "yet-another-react-lightbox";
import Captions from "yet-another-react-lightbox/plugins/captions";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/captions.css";
import "yet-another-react-lightbox/plugins/thumbnails.css";
import type { PublicImage } from "@/convex/lib/dto";
import type { Locale } from "@/i18n/routing";
import { pickL10n } from "@/lib/l10n";
import { srcSetFor } from "./media";

/**
 * The fullscreen gallery (PRD A5): zoom, a thumbnail strip, and captions that
 * carry the room tag plus the localized alt text. yet-another-react-lightbox
 * handles focus trapping, Escape, arrow keys and swipe; this component only
 * localizes it and keeps Lenis from scrolling the page underneath.
 *
 * Loaded with `next/dynamic` from `ListingGallery`, so neither the library nor
 * its CSS reaches the first paint.
 */

/** `data-*` keys are not in React's HTMLAttributes, so they are typed in explicitly. */
type PortalContainer = HTMLAttributes<HTMLDivElement> & Record<`data-${string}`, string>;
const PORTAL_CONTAINER: PortalContainer = { "data-lenis-prevent": "" };

export type ListingLightboxProps = {
  images: readonly PublicImage[];
  index: number;
  onClose: () => void;
  onIndexChange?: (index: number) => void;
};

export default function ListingLightbox({ images, index, onClose, onIndexChange }: ListingLightboxProps) {
  const locale = useLocale() as Locale;
  const t = useTranslations("listing");
  const lenis = useLenis();

  const slides: SlideImage[] = images.map((image) => {
    const alt = pickL10n(image.alt, locale).text;
    const srcSet = srcSetFor(image);
    return {
      src: image.url,
      alt,
      ...(image.w !== undefined ? { width: image.w } : {}),
      ...(image.h !== undefined ? { height: image.h } : {}),
      ...(srcSet !== undefined ? { srcSet } : {}),
      title: image.room !== undefined ? t(`room.${image.room}`) : undefined,
      description:
        image.author !== undefined ? `${alt} · ${t("galleryUi.credit", { author: image.author })}` : alt,
    };
  });

  return (
    <Lightbox
      open
      close={onClose}
      index={index}
      slides={slides}
      plugins={[Captions, Thumbnails, Zoom]}
      carousel={{ finite: false, preload: 2 }}
      animation={{ fade: 250, swipe: 300 }}
      controller={{ closeOnBackdropClick: true }}
      captions={{ descriptionTextAlign: "start", descriptionMaxLines: 2 }}
      thumbnails={{ width: 96, height: 64, border: 0, borderRadius: 0, padding: 0, gap: 8, imageFit: "cover" }}
      zoom={{ maxZoomPixelRatio: 2.5, scrollToZoom: true }}
      portal={{ container: PORTAL_CONTAINER }}
      labels={{
        Lightbox: t("lightbox.label"),
        Carousel: t("lightbox.carousel"),
        Slide: t("lightbox.slide"),
        Previous: t("lightbox.prev"),
        Next: t("lightbox.next"),
        Close: t("lightbox.close"),
        "Zoom in": t("lightbox.zoomIn"),
        "Zoom out": t("lightbox.zoomOut"),
        Caption: t("lightbox.caption"),
        "Show captions": t("lightbox.showCaptions"),
        "Hide captions": t("lightbox.hideCaptions"),
        Thumbnails: t("lightbox.thumbnails"),
        "Show thumbnails": t("lightbox.showThumbnails"),
        "Hide thumbnails": t("lightbox.hideThumbnails"),
        "Photo gallery": t("lightbox.label"),
        // The library fills {index}/{total} itself, so they are passed through verbatim.
        "{index} of {total}": t("lightbox.position", { index: "{index}", total: "{total}" }),
      }}
      on={{
        entering: () => lenis?.stop(),
        exited: () => lenis?.start(),
        view: ({ index: current }) => onIndexChange?.(current),
      }}
      styles={{
        container: { backgroundColor: "rgba(14, 13, 11, 0.97)" },
        thumbnailsContainer: { backgroundColor: "rgba(14, 13, 11, 0.97)" },
      }}
      className="listing-lightbox"
    />
  );
}
