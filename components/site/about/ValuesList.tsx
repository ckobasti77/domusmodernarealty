import { fixTypography } from "@/lib/format";

/**
 * The managed values list (`pages.about` → `values`) as a numbered editorial
 * list on ink. Each item is written "Title — explanation"; the part before the
 * dash becomes the serif line and the rest the muted sentence under it. An
 * item without a dash is shown whole, as the serif line.
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
    // The rows are spaced by the grid's gap, not by padding under each item,
    // so the last row ends on the section's own padding.
    <ol lang={lang} className="grid gap-x-6 gap-y-12 md:grid-cols-2 lg:grid-cols-3 lg:gap-y-16">
      {values.map((item, index) => {
        const { title, body } = parts(item);
        return (
          <li key={`${index}-${title}`} className="flex flex-col gap-4 border-t border-hairline-dark pt-6">
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
