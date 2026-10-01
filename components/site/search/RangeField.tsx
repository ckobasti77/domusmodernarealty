"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { useLocale } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { formatInputNumber, parseLocaleNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useDebounced } from "./useSearchUrl";

/**
 * A min/max range: two typed inputs for exact figures plus a two-thumb slider
 * over a list of "stops" for quick adjustment (PRD A3 price and area).
 *
 * The slider walks an index into `stops`, not the raw value, so a price scale
 * can be dense where most listings are (100–400 k €) and sparse above. The
 * first stop means "no minimum", the last "no maximum".
 *
 * Commits are deliberate: the typed inputs on blur/Enter, the slider debounced,
 * so dragging produces one URL change, not fifty. When the committed values
 * change (our own commit, a removed chip, Back), the local draft is re-seeded
 * during render — never by remounting, which would drop keyboard focus from
 * the thumb in the middle of an arrow-key adjustment. Only the bound whose
 * committed value changed is re-seeded: typing a minimum, tabbing to the
 * maximum and typing it commits the minimum on blur, and when that URL update
 * lands a moment later it must not wipe the maximum being typed.
 */
export type RangeFieldProps = {
  labels: { min: string; max: string; from: string; to: string };
  min?: number;
  max?: number;
  stops: readonly number[];
  /** Human text for a value (aria-valuetext and the inputs' placeholder). */
  format: (value: number) => string;
  onCommit: (min: number | undefined, max: number | undefined) => void;
  unit: string;
  testId?: string;
};

type Draft = { seed: string; low: number; high: number; minText: string; maxText: string };

/** The stop closest to a value, for a typed figure that falls between stops. */
function nearestStop(stops: readonly number[], value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  let best = 0;
  for (let i = 1; i < stops.length; i += 1) {
    if (Math.abs(stops[i] - value) < Math.abs(stops[best] - value)) best = i;
  }
  return best;
}

function seedDraft(
  seed: string,
  stops: readonly number[],
  min: number | undefined,
  max: number | undefined,
  locale: Locale,
): Draft {
  return {
    seed,
    low: nearestStop(stops, min, 0),
    high: nearestStop(stops, max, stops.length - 1),
    minText: min !== undefined ? formatInputNumber(min, locale) : "",
    maxText: max !== undefined ? formatInputNumber(max, locale) : "",
  };
}

/** `seedDraft` for a change of the committed values, keeping the draft of an unchanged bound. */
function reseedDraft(
  prev: Draft,
  seed: string,
  stops: readonly number[],
  min: number | undefined,
  max: number | undefined,
  locale: Locale,
): Draft {
  const fresh = seedDraft(seed, stops, min, max, locale);
  const [prevMin, prevMax, prevStops] = prev.seed.split("|");
  const [nextMin, nextMax, nextStops] = seed.split("|");
  if (prevStops !== nextStops) return fresh;
  const low = prevMin === nextMin ? prev.low : fresh.low;
  const high = prevMax === nextMax ? prev.high : fresh.high;
  return {
    seed,
    low,
    high: Math.max(high, low),
    minText: prevMin === nextMin ? prev.minText : fresh.minText,
    maxText: prevMax === nextMax ? prev.maxText : fresh.maxText,
  };
}

export function RangeField({ labels, min, max, stops, format, onCommit, unit, testId }: RangeFieldProps) {
  const locale = useLocale() as Locale;
  const id = useId();
  const last = stops.length - 1;

  const seed = `${min ?? ""}|${max ?? ""}|${stops.join(",")}`;
  const [draft, setDraft] = useState<Draft>(() => seedDraft(seed, stops, min, max, locale));
  if (draft.seed !== seed) setDraft(reseedDraft(draft, seed, stops, min, max, locale));
  const { low, high, minText, maxText } = draft;

  const commitSlider = useDebounced((lowIndex: number, highIndex: number) => {
    onCommit(lowIndex > 0 ? stops[lowIndex] : undefined, highIndex < last ? stops[highIndex] : undefined);
  }, 350);

  const commitText = () => {
    const parsedMin = minText.trim().length > 0 ? parseLocaleNumber(minText, locale) : null;
    const parsedMax = maxText.trim().length > 0 ? parseLocaleNumber(maxText, locale) : null;
    const nextMin = parsedMin !== null && parsedMin > 0 ? Math.round(parsedMin) : undefined;
    const nextMax = parsedMax !== null && parsedMax > 0 ? Math.round(parsedMax) : undefined;
    if (nextMin === min && nextMax === max) return;
    onCommit(nextMin, nextMax);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitText();
    }
  };

  const moveLow = (index: number) => {
    const next = Math.min(index, high);
    setDraft((prev) => ({ ...prev, low: next, minText: next > 0 ? formatInputNumber(stops[next], locale) : "" }));
    commitSlider(next, high);
  };
  const moveHigh = (index: number) => {
    const next = Math.max(index, low);
    setDraft((prev) => ({ ...prev, high: next, maxText: next < last ? formatInputNumber(stops[next], locale) : "" }));
    commitSlider(low, next);
  };

  const pct = (index: number) => (index / last) * 100;
  const thumb = cn(
    "pointer-events-none absolute inset-x-0 top-1/2 h-11 w-full -translate-y-1/2 appearance-none bg-transparent",
    "focus-visible:outline-none",
    "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-paper [&::-webkit-slider-thumb]:bg-ink",
    "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:rounded-none [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-paper [&::-moz-range-thumb]:bg-ink",
    "focus-visible:[&::-webkit-slider-thumb]:outline-2 focus-visible:[&::-webkit-slider-thumb]:outline-offset-2 focus-visible:[&::-webkit-slider-thumb]:outline-bronze-text",
    "focus-visible:[&::-moz-range-thumb]:outline-2 focus-visible:[&::-moz-range-thumb]:outline-offset-2 focus-visible:[&::-moz-range-thumb]:outline-bronze-text",
  );
  // The underline belongs to the field (input + unit), so the unit sits inside it.
  const field = "flex items-baseline gap-2 border-b border-stone-text focus-within:border-ink";
  const input = cn(
    "h-11 w-full min-w-0 border-0 bg-transparent px-0 font-sans text-body text-ink",
    "placeholder:text-stone-text focus-visible:outline-none",
  );

  return (
    <div className="flex flex-col gap-4" data-testid={testId}>
      <div className="grid grid-cols-2 gap-6">
        <label className="flex flex-col gap-1" htmlFor={`${id}-min`}>
          <span className="font-sans text-label uppercase tracking-[0.12em] text-stone-text">{labels.from}</span>
          <span className={field}>
            <input
              id={`${id}-min`}
              inputMode="numeric"
              autoComplete="off"
              aria-label={labels.min}
              value={minText}
              placeholder="0"
              onChange={(event) => setDraft((prev) => ({ ...prev, minText: event.target.value }))}
              onBlur={commitText}
              onKeyDown={onKeyDown}
              data-testid={testId !== undefined ? `${testId}-min` : undefined}
              className={input}
            />
            <span aria-hidden="true" className="whitespace-nowrap text-small text-stone-text">
              {unit}
            </span>
          </span>
        </label>
        <label className="flex flex-col gap-1" htmlFor={`${id}-max`}>
          <span className="font-sans text-label uppercase tracking-[0.12em] text-stone-text">{labels.to}</span>
          <span className={field}>
            <input
              id={`${id}-max`}
              inputMode="numeric"
              autoComplete="off"
              aria-label={labels.max}
              value={maxText}
              placeholder={formatInputNumber(stops[last], locale)}
              onChange={(event) => setDraft((prev) => ({ ...prev, maxText: event.target.value }))}
              onBlur={commitText}
              onKeyDown={onKeyDown}
              data-testid={testId !== undefined ? `${testId}-max` : undefined}
              className={input}
            />
            <span aria-hidden="true" className="whitespace-nowrap text-small text-stone-text">
              {unit}
            </span>
          </span>
        </label>
      </div>

      <div className="relative h-11">
        <div aria-hidden="true" className="absolute inset-x-2.5 top-1/2 h-px -translate-y-1/2 bg-ink/25" />
        <div
          aria-hidden="true"
          className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-ink"
          style={{
            left: `calc(10px + (100% - 20px) * ${pct(low) / 100})`,
            right: `calc(10px + (100% - 20px) * ${(100 - pct(high)) / 100})`,
          }}
        />
        <input
          type="range"
          min={0}
          max={last}
          step={1}
          value={low}
          aria-label={labels.min}
          aria-valuetext={low > 0 ? format(stops[low]) : labels.from}
          onChange={(event) => moveLow(Number(event.target.value))}
          className={thumb}
        />
        <input
          type="range"
          min={0}
          max={last}
          step={1}
          value={high}
          aria-label={labels.max}
          aria-valuetext={high < last ? format(stops[high]) : `${format(stops[last])}+`}
          onChange={(event) => moveHigh(Number(event.target.value))}
          className={thumb}
        />
      </div>
    </div>
  );
}
