import { adminThumb } from "@/lib/admin/images";
import { cn } from "@/lib/utils";
import { monogram } from "./labels";

const SIZE = {
  sm: { box: "size-8 text-[11px]", request: 96 },
  md: { box: "size-10 text-xs", request: 120 },
} as const;

/**
 * An agent's real photo, or their initials on ink. Never a stock face
 * (CLAUDE.md): a profile without a photo stays a monogram.
 */
export function AgentAvatar({
  name,
  photoUrl,
  size = "md",
  className,
}: {
  name: string;
  photoUrl?: string;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const style = SIZE[size];
  if (photoUrl !== undefined) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- storage or Unsplash URLs of unknown size; a 40 px avatar gains nothing from the image optimizer
      <img
        src={adminThumb(photoUrl, style.request)}
        alt=""
        loading="lazy"
        decoding="async"
        className={cn("max-w-none shrink-0 rounded-full bg-muted object-cover", style.box, className)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-foreground font-medium tracking-wide text-background",
        style.box,
        className,
      )}
    >
      {monogram(name)}
    </span>
  );
}
