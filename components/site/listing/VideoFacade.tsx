"use client";

import { Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

/**
 * Privacy-friendly video embed. Nothing from YouTube or Vimeo loads until the
 * visitor clicks: no iframe, no poster fetched from their CDN (the CSP would
 * block it anyway), no cookies. YouTube goes through `youtube-nocookie.com`;
 * any other host becomes a plain external link.
 */

type Embed = { provider: "YouTube" | "Vimeo"; src: string } | { provider: string; src: null };

export function parseVideoUrl(url: string): Embed {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { provider: url, src: null };
  }
  const host = parsed.hostname.replace(/^www\./, "");
  let youtubeId: string | null = null;
  if (host === "youtu.be") youtubeId = parsed.pathname.slice(1);
  else if (host.endsWith("youtube.com")) {
    youtubeId = parsed.searchParams.get("v") ?? parsed.pathname.match(/^\/(?:embed|shorts)\/([\w-]{6,})/)?.[1] ?? null;
  }
  if (youtubeId !== null && /^[\w-]{6,}$/.test(youtubeId)) {
    return {
      provider: "YouTube",
      src: `https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0&modestbranding=1`,
    };
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = parsed.pathname.match(/(\d{5,})/)?.[1];
    if (id !== undefined) return { provider: "Vimeo", src: `https://player.vimeo.com/video/${id}?autoplay=1&dnt=1` };
  }
  return { provider: host, src: null };
}

export function VideoFacade({ url, title }: { url: string; title: string }) {
  const t = useTranslations("listing.video");
  const [playing, setPlaying] = useState(false);
  const embed = parseVideoUrl(url);

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
    <div className="relative aspect-video w-full overflow-hidden bg-ink-2" data-lenis-prevent="">
      {playing ? (
        <iframe
          src={embed.src}
          title={title}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 size-full border-0"
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
