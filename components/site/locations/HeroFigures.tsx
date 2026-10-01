import { cn } from "@/lib/utils";

export type HeroFigure = {
  /** Already formatted for the locale ("4.600 €/m²", "28"). */
  value: string;
  label: string;
  /** A short qualifier under the label, e.g. "mesečno". */
  note?: string;
};

/**
 * Key figures, separated by hairlines. `columns` sets short figures (counts)
 * side by side, serif over a tracked label; `rows` is a spec sheet for longer
 * ones ("4.600 €/m²"), label left and figure right, so a price never has to
 * fit a third of the column. Every figure is read from Convex; nothing here
 * is an estimate of the page's own.
 */
export function HeroFigures({
  items,
  label,
  layout = "columns",
  tone = "dark",
  className,
}: {
  items: readonly HeroFigure[];
  /** Accessible name of the list ("Ključni podaci"). */
  label: string;
  layout?: "columns" | "rows";
  /** `dark` on the ink band, `light` on ivory. */
  tone?: "dark" | "light";
  className?: string;
}) {
  if (items.length === 0) return null;
  const rule = tone === "dark" ? "border-hairline-dark" : "border-hairline-light";
  const muted = tone === "dark" ? "text-mist" : "text-stone-text";
  const strong = tone === "dark" ? "text-ivory" : "text-ink";

  if (layout === "rows") {
    return (
      <dl aria-label={label} className={cn("border-t", rule, className)}>
        {items.map((item, index) => (
          <div
            key={`${item.label}-${index}`}
            className={cn("flex items-baseline justify-between gap-6 border-b py-4 lg:py-5", rule)}
          >
            <dt className={cn("font-mono text-label uppercase", muted)}>
              {item.label}
              {item.note !== undefined ? (
                <span className="mt-1 block normal-case tracking-normal">{item.note}</span>
              ) : null}
            </dt>
            <dd data-numeric="" className={cn("shrink-0 whitespace-nowrap font-display text-h2 font-normal", strong)}>
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <dl
      aria-label={label}
      className={cn(
        "grid border-t",
        rule,
        items.length >= 3 ? "grid-cols-3" : items.length === 2 ? "grid-cols-2" : "grid-cols-1",
        className,
      )}
    >
      {items.map((item, index) => (
        <div
          key={`${item.label}-${index}`}
          className={cn(
            "flex min-w-0 flex-col-reverse justify-end gap-3 pt-5",
            index > 0 && cn("border-l pl-4 md:pl-6", rule),
            index < items.length - 1 && "pr-4 md:pr-6",
          )}
        >
          <dt className={cn("font-mono text-label uppercase", muted)}>{item.label}</dt>
          <dd data-numeric="" className={cn("font-display text-display-m font-normal leading-none", strong)}>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
