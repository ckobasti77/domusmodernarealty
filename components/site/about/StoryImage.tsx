import { ImageReveal } from "@/components/motion/ImageReveal";
import { photoGrade } from "@/components/site/home/art-direction";

/**
 * The story's photograph: the roofs of Zemun above the Danube, a verified
 * demo photo ("Aerial view of the red-tiled rooftops of Zemun above the
 * Danube, Belgrade", docs/assets/demo-media.json). It shows the city the
 * agency works in, so its alt text describes the view and never presents it
 * as the office or a listing. Graded like the other editorial photographs,
 * and fetched already cropped to its frame (`ImageReveal` → `frameLoader`).
 */
const STORY_PHOTO = "https://images.unsplash.com/photo-1608816747977-4d303f476571";

const FRAMES = {
  /** Desktop: four of twelve columns under the eyebrow (432px at 1440), 3:4. */
  column: { ratio: "aspect-[3/4]", crop: 4 / 3, sizes: "(min-width: 1440px) 432px, 30vw" },
  /** Below 1024px, after the story: 4:5 on a phone; a tablet shows a 3:2 band of the same crop. */
  inline: { ratio: "aspect-[4/5] md:aspect-[3/2]", crop: 5 / 4, sizes: "(min-width: 768px) 92vw, 94vw" },
} as const;

export function StoryImage({ frame, alt, className }: { frame: keyof typeof FRAMES; alt: string; className: string }) {
  const { ratio, crop, sizes } = FRAMES[frame];
  return (
    <ImageReveal
      src={STORY_PHOTO}
      alt={alt}
      ratio={ratio}
      crop={crop}
      sizes={sizes}
      className={className}
      imageClassName={photoGrade(STORY_PHOTO)}
    />
  );
}
