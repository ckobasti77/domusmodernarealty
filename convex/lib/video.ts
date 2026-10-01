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
