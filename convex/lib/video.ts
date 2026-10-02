const VIDEO_URL =
  /^https:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/|(?:player\.)?vimeo\.com\/)[\w\-?=&/%.]{3,200}$/;

/**
 * The public page embeds only YouTube and Vimeo (`VideoFacade`), so both the
 * editor's autosave (`listingsAdmin.update`) and `media.setVideoUrl` accept
 * nothing else.
 */
export function isVideoUrl(url: string): boolean {
  return url.length <= 500 && VIDEO_URL.test(url);
}

/** The video a URL names, enough to build its player. */
export type VideoRef = {
  provider: "youtube" | "vimeo";
  /** The YouTube video ID, or the numeric Vimeo ID. */
  id: string;
  /** Where playback starts, in seconds (YouTube `t=` / `start=`). */
  start?: number;
};

const YOUTUBE_ID = /^[\w-]{6,}$/;
const VIMEO_ID = /^\d+$/;

/** A YouTube start time: `90`, `90s`, `1m30s`, `1h2m`. */
function startSeconds(raw: string | null): number | undefined {
  if (raw === null || raw === "") return undefined;
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(raw);
  if (match === null) return undefined;
  const total = Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
  return total > 0 ? total : undefined;
}

/**
 * Provider, ID and start time of a URL `isVideoUrl` accepts, on any of the
 * hosts it accepts (`www.`, `m.`, `player.`); `null` for anything else,
 * including an accepted URL that names no video (`vimeo.com/channels/x`).
 */
export function parseVideoUrl(url: string): VideoRef | null {
  if (!isVideoUrl(url)) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^(?:www|m)\./, "");
  const segments = parsed.pathname.split("/").filter((segment) => segment.length > 0);

  if (host === "youtu.be" || host === "youtube.com") {
    const id =
      host === "youtu.be"
        ? segments[0]
        : segments[0] === "watch"
          ? parsed.searchParams.get("v")
          : segments[1];
    if (id === undefined || id === null || !YOUTUBE_ID.test(id)) return null;
    const start = startSeconds(parsed.searchParams.get("t") ?? parsed.searchParams.get("start"));
    return { provider: "youtube", id, ...(start !== undefined ? { start } : {}) };
  }

  // player.vimeo.com/video/123, vimeo.com/showcase/9/video/123 and
  // vimeo.com/groups/name/videos/123 name it after "video(s)"; otherwise it is
  // the first numeric segment (vimeo.com/123, vimeo.com/channels/name/123, or
  // vimeo.com/123/<hash> for an unlisted video).
  const marker = segments.findIndex((segment) => segment === "video" || segment === "videos");
  const id = marker >= 0 ? segments[marker + 1] : segments.find((segment) => VIMEO_ID.test(segment));
  return id !== undefined && VIMEO_ID.test(id) ? { provider: "vimeo", id } : null;
}
