import type { ResponsiveImage } from "@/lib/media";
import { cn } from "@/lib/utils";

/**
 * An art-directed still from `lib/media.ts`: the owner's optimized renders as
 * typed AVIF/WebP `<source>`s, or a verified remote photo with a single
 * `srcSet`. Not `next/image`: these files were already cut to exactly the
 * widths the layout asks for by `npm run media:optimize`, and re-encoding the
 * JPEG fallback would only lose quality.
 *
 * Lazy by default. `priority` is for the one image that is the LCP element.
 * The parent sizes it; the image always covers its box.
 */

export type PictureProps = {
  image: ResponsiveImage;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  imgClassName?: string;
};

export function Picture({ image, alt, sizes, priority = false, className, imgClassName }: PictureProps) {
  return (
    <picture className={className}>
      {image.sources.map((source) => (
        <source key={source.type} type={source.type} srcSet={source.srcSet} sizes={sizes} />
      ))}
      <img
        src={image.src}
        srcSet={image.srcSet}
        sizes={image.srcSet !== undefined ? sizes : undefined}
        alt={alt}
        width={image.width}
        height={image.height}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        fetchPriority={priority ? "high" : undefined}
        className={cn("size-full object-cover", imgClassName)}
      />
    </picture>
  );
}
