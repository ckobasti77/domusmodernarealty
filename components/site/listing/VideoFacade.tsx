"use client";

import { Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { parseVideoUrl } from "@/convex/lib/video";

/**
 * Privacy-friendly video embed. Nothing from YouTube or Vimeo loads until the
 * visitor clicks: no iframe, no poster fetched from their CDN (the CSP would
 * block it anyway), no cookies. YouTube goes through `youtube-nocookie.com`;
 * any other host becomes a plain external link.
 */

type Embed = { provider: "YouTube" | "Vimeo"; src: string } | { provider: string; src: null };

/**
 * The player for a stored video URL. It reads the URL with the server's own
 * parser (`convex/lib/video.ts`), so every URL the editor and the server accept
 * (`m.`/`player.` hosts, a YouTube start time) gets its embed.
 */
function embedFor(url: string): Embed {
  const video = parseVideoUrl(url);
  if (video?.provider === "youtube") {
    const start = video.start !== undefined ? `&start=${video.start}` : "";
    return {
      provider: "YouTube",
      src: `https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0&modestbranding=1${start}`,
    };
  }
  if (video?.provider === "vimeo") {
    return { provider: "Vimeo", src: `https://player.vimeo.com/video/${video.id}?autoplay=1&dnt=1` };
  }
  try {
    return { provider: new URL(url).hostname.replace(/^www\./, ""), src: null };
  } catch {
    return { provider: url, src: null };
  }
}

export function VideoFacade({ url, title }: { url: string; title: string }) {
  const t = useTranslations("listing.video");
  const [playing, setPlaying] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const embed = embedFor(url);

  // The player replaces the focused play button: focus moves into the player
  // instead of dropping to <body>.
  useEffect(() => {
    if (playing) frame.current?.focus();
  }, [playing]);

  if (embed.src === null) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center gap-2 text-ivory underline decoration-bronze underline-offset-4"
      >
        {t("openExternal", { provider: embed.provider })}
      </a>
    );
  }

  return (
    // `overflow-clip`, not `hidden`: see ListingMapLoader for why a
    // `[data-lenis-prevent]` box must not be a scroll container.
    <div className="relative aspect-video w-full overflow-clip bg-ink-2" data-lenis-prevent="">
      {playing ? (
        <iframe
          ref={frame}
          src={embed.src}
          title={title}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 size-full border-0 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-bronze"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="group/play absolute inset-0 flex flex-col items-center justify-center gap-5 text-ivory focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-bronze"
        >
          <span className="flex size-20 items-center justify-center rounded-full border border-ivory/40 transition-colors duration-300 pointer-fine:group-hover/play:border-bronze pointer-fine:group-hover/play:text-bronze">
            <Play aria-hidden="true" strokeWidth={1.25} className="ml-1 size-7" />
          </span>
          <span className="font-sans text-small uppercase tracking-[0.12em]">{t("play")}</span>
          <span className="max-w-sm px-6 text-center text-small text-mist">
            {t("notice", { provider: embed.provider })}
          </span>
        </button>
      )}
    </div>
  );
}
