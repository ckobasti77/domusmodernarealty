import { fixTypography } from "@/lib/format";

/**
 * The managed values list (`pages.about` → `values`) as a numbered editorial
 * list on ink. Each item is written "Title — explanation"; the part before the
 * first dash becomes the serif line and the rest the muted sentence under it
 * (so the sentence may hold a dash of its own, as the Russian reply-time
 * promise does). An item without a dash is shown whole, as the serif line.
 */

const SPLIT = /\s+[—–]\s+/;

function parts(item: string): { title: string; body?: string } {
  const match = SPLIT.exec(item);
  if (match === null) return { title: item.trim() };
  const title = item.slice(0, match.index).trim();
  const rest = item.slice(match.index + match[0].length).trim();
  if (title.length === 0 || rest.length === 0) return { title: item.trim() };
  return { title, body: rest.charAt(0).toLocaleUpperCase() + rest.slice(1) };
}

export function ValuesList({ items, lang }: { items: readonly string[]; lang?: string }) {
  const values = items.map((item) => item.trim()).filter((item) => item.length > 0);
  if (values.length === 0) return null;

  return (
    // Each value spans three rows of the list (number, title, sentence) and
    // shares them with its neighbours (`subgrid`), so the sentences of a row
    // start on one line however many lines a title wraps to. The list's row
    // gap is the values' own 16px rhythm, which the subgrid inherits (a subgrid
    // gap unlike its parent's makes Chrome stretch the boxes). Rows of values
    // are spaced by each value's top margin instead of padding under it, so the
    // last row ends on the section's own padding; the list's negative margin
    // takes the first row's back.
    <ol lang={lang} className="-mt-8 grid gap-x-6 gap-y-4 md:grid-cols-2 lg:-mt-12 lg:grid-cols-3">
      {values.map((item, index) => {
        const { title, body } = parts(item);
        return (
          <li
            key={`${index}-${title}`}
            className="row-span-3 mt-8 grid grid-rows-subgrid border-t border-hairline-dark pt-6 lg:mt-12"
          >
            <span aria-hidden="true" data-numeric="" className="font-mono text-label text-bronze">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h3 className="max-w-[30ch] text-pretty font-display text-[clamp(1.5rem,2vw,1.875rem)] font-normal leading-tight text-ivory">
              {fixTypography(title)}
            </h3>
            {body !== undefined ? (
              <p className="max-w-[42ch] text-pretty text-body text-mist">{fixTypography(body)}</p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
