"use client";

import { useMutation } from "convex/react";
import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { isListingId } from "@/components/site/compare/listing-ids";
import { api } from "@/convex/_generated/api";
import { getSessionKey } from "@/lib/session";
import { useFavorite } from "@/lib/stores/favorites";
import { cn } from "@/lib/utils";

/**
 * Toggles a listing in the localStorage favorites store. The accessible name
 * flips with the state and `aria-pressed` carries the state itself, so the
 * filled heart is never the only signal.
 *
 * The fill transition is 180ms — a toggle a visitor may hit repeatedly should
 * feel instant, not choreographed.
 *
 * On a photograph (`tone="dark"`) the heart sits on its own ink plate, the
 * same chrome as the card's carousel controls: a bare outline, or a bronze
 * fill, falls below 3:1 on a bright interior. The saved heart keeps its ivory
 * outline there, so the shape stays legible whatever the plate shows through.
 *
 * Adding a listing also reports it once per session for the admin funnel
 * (`stats.trackFavorite`, PRD B12); removing reports nothing.
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
  const trackFavorite = useMutation(api.stats.trackFavorite);
  const onClick = () => {
    if (!toggle() || !isListingId(listingId)) return;
    // Fire and forget: the heart never waits for, or fails on, the counter.
    trackFavorite({ listingId, sessionKey: getSessionKey() }).catch(() => {});
  };
  // A toggle keeps one name; `aria-pressed` says whether it is on.
  const label = `${t("addToFavorites")}: ${title}`;
  const dark = tone === "dark";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isFavorite}
      aria-label={label}
      className={cn(
        "inline-flex size-11 items-center justify-center transition-transform duration-150 ease-out active:scale-[0.92]",
        dark ? "text-ivory" : "text-ink",
        className,
      )}
    >
      <span className={cn("inline-flex items-center justify-center", dark && "size-8 bg-ink/70")}>
        <Heart
          aria-hidden="true"
          strokeWidth={1.25}
          className={cn(
            "size-5 transition-colors duration-[180ms] ease-out",
            isFavorite ? (dark ? "fill-bronze" : "fill-bronze text-bronze") : "fill-transparent",
          )}
        />
      </span>
    </button>
  );
}
