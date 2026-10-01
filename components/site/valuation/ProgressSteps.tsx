import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export const FUNNEL_STEPS = ["property", "contact", "result"] as const;
export type FunnelStep = (typeof FUNNEL_STEPS)[number];

const LABEL_KEY: Record<FunnelStep, string> = {
  property: "stepProperty",
  contact: "stepContact",
  result: "stepResult",
};

/**
 * The funnel's three stations as a ruled index: a mono number and a label over
 * a hairline that turns ink once a step is behind the visitor and bronze (and
 * twice as heavy) where they are. Not interactive — the Back button is the one
 * way back, so an answer is never skipped. `aria-current="step"` marks the
 * station; finished ones say so to screen readers.
 */
export function ProgressSteps({ current }: { current: FunnelStep }) {
  const t = useTranslations("valuation");
  const position = FUNNEL_STEPS.indexOf(current);

  return (
    <ol aria-label={t("progressLabel")} className="grid grid-cols-3 gap-3 sm:gap-5">
      {FUNNEL_STEPS.map((step, index) => {
        const state = index < position ? "done" : index === position ? "current" : "upcoming";
        return (
          <li key={step} aria-current={state === "current" ? "step" : undefined} className="flex min-w-0 flex-col gap-3">
            <span aria-hidden="true" className="relative block h-0.5">
              <span
                className={cn(
                  "absolute inset-x-0 bottom-0 transition-colors duration-300 ease-out",
                  state === "current" ? "h-0.5 bg-bronze-deep" : "h-px",
                  state === "done" && "bg-ink",
                  state === "upcoming" && "bg-hairline-light",
                )}
              />
            </span>
            {/* Stacked on phones, where a third of the panel cannot hold "01 NEKRETNINA" on one line. */}
            <span className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-2">
              <span data-numeric className={cn("font-mono text-label", state === "current" ? "text-bronze-text" : "text-stone-text")}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <span
                className={cn(
                  "min-w-0 font-sans text-label uppercase tracking-[0.12em]",
                  state === "upcoming" ? "text-stone-text" : "text-ink",
                )}
              >
                {t(LABEL_KEY[step])}
              </span>
              {state === "done" ? <span className="sr-only">({t("stepDone")})</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
