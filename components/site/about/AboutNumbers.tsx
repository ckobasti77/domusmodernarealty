import { Counter } from "@/components/motion/Counter";
import { parseStat } from "@/components/site/home/data";
import { fixTypography } from "@/lib/format";

export type AboutStat = { value: string; label: { text: string; lang?: string }; isDemo: boolean };

/**
 * The agency's figures on About (PRD A10): the same four the landing shows,
 * from the home page's `numbers` block (`settings.stats` only when the block
 * is missing), each counting up once. While any figure is still flagged
 * `isDemo` the section says so in plain words under them.
 */
export function AboutNumbers({ stats, demoNote }: { stats: readonly AboutStat[]; demoNote: string }) {
  const shown = stats.slice(0, 4);
  if (shown.length === 0) return null;
  const anyDemo = shown.some((stat) => stat.isDemo);

  return (
    <div>
      <dl className="grid grid-cols-2 gap-x-6 lg:grid-cols-4">
        {shown.map((stat, index) => {
          const parsed = parseStat(stat.value);
          return (
            // `<dt>` first, as the content model requires; the column is
            // reversed so the figure still reads above its label.
            <div
              key={`${stat.value}-${index}`}
              className="flex flex-col-reverse justify-end gap-4 border-t border-hairline-light pb-10 pt-6"
            >
              <dt lang={stat.label.lang} className="max-w-[18ch] font-mono text-label uppercase text-stone-text">
                {stat.label.text}
              </dt>
              <dd className="font-display text-display-l font-normal leading-none">
                {parsed !== null ? (
                  <Counter
                    value={parsed.value}
                    index={index}
                    prefix={parsed.prefix || undefined}
                    suffix={parsed.suffix || undefined}
                  />
                ) : (
                  stat.value
                )}
              </dd>
            </div>
          );
        })}
      </dl>
      {anyDemo ? (
        <p data-testid="about-numbers-demo-note" className="mt-8 max-w-[56ch] text-pretty text-small text-stone-text">
          {fixTypography(demoNote)}
        </p>
      ) : null}
    </div>
  );
}
