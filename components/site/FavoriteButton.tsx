"use client";

import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFavorite } from "@/lib/stores/favorites";
import { cn } from "@/lib/utils";

/**
 * Toggles a listing in the localStorage favorites store. The accessible name
 * flips with the state and `aria-pressed` carries the state itself, so the
 * filled heart is never the only signal.
 *
 * The fill transition is 180ms — a toggle a visitor may hit repeatedly should
 * feel instant, not choreographed.
 */
export function FavoriteButton({
  listingId,
  title,
  tone = "dark",
  className,
}: {
  listingId: string;
  /** Used in the accessible name so a list of hearts is distinguishable. */
  title: string;
  tone?: "light" | "dark";
  className?: string;
}) {
  const t = useTranslations("listing");
  const [isFavorite, toggle] = useFavorite(listingId);
  // A toggle keeps one name; `aria-pressed` says whether it is on.
  const label = `${t("addToFavorites")}: ${title}`;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isFavorite}
      aria-label={label}
      className={cn(
        "inline-flex size-11 items-center justify-center transition-transform duration-150 ease-out active:scale-[0.92]",
        tone === "dark" ? "text-ivory" : "text-ink",
        className,
      )}
    >
      <Heart
        aria-hidden="true"
        strokeWidth={1.25}
        className={cn(
          "size-5 transition-colors duration-[180ms] ease-out",
          isFavorite ? "fill-bronze text-bronze" : "fill-transparent",
        )}
      />
    </button>
  );
}
