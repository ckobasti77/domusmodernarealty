/**
 * Journal reading time, shared by the post editor (`postsAdmin`) and the seed,
 * so a seeded post shows the same figure it gets once staff save it.
 */
const WORDS_PER_MINUTE = 200;

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

/** The readable text of stored HTML, whitespace collapsed. */
export function textOf(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity] ?? " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Reading time of the Serbian body at 200 words a minute, at least one. */
export function readingMinutes(html: string): number {
  const text = textOf(html);
  const words = text.length === 0 ? 0 : text.split(" ").length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
