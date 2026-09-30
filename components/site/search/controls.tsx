"use client";

import { Check } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The small, square, hairline controls every filter is built from. Native
 * elements underneath (button with `aria-pressed`, real checkboxes and
 * radios), so keyboard, screen-reader and form semantics come for free; the
 * styling only follows the "architectural, sharp" rule of DESIGN §4.
 */

export function FilterSection({
  legend,
  children,
  className,
}: {
  legend: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend className="mb-4 font-sans text-label font-medium uppercase tracking-[0.12em] text-stone-text">
        {legend}
      </legend>
      {children}
    </fieldset>
  );
}

type ChipToggleProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  pressed: boolean;
};

/** A multi-select chip: a toggle button, pressed = ink block. */
export function ChipToggle({ pressed, className, children, ...rest }: ChipToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        "inline-flex h-11 min-w-11 items-center justify-center border px-3.5 font-sans text-small",
        "transition-[background-color,color,border-color] duration-200 ease-out",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bronze-text",
        pressed
          ? "border-ink bg-ink text-ivory"
          : "border-ink/30 bg-transparent text-ink pointer-fine:hover:border-ink",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/** A labelled checkbox row with a square hairline box. */
export function CheckRow({
  checked,
  onChange,
  disabled,
  label,
  meta,
  describedBy,
  className,
  testId,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: ReactNode;
  meta?: ReactNode;
  describedBy?: string;
  className?: string;
  testId?: string;
}) {
  return (
    <label
      className={cn(
        "group/check flex min-h-11 cursor-pointer items-center gap-3 py-1 text-small text-ink",
        disabled && "cursor-default text-stone-text",
        className,
      )}
    >
      <span className="relative inline-flex size-5 shrink-0">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-describedby={describedBy}
          data-testid={testId}
          onChange={(event) => onChange(event.target.checked)}
          className={cn(
            "peer size-5 appearance-none border border-ink/40 bg-paper",
            "transition-[background-color,border-color] duration-200 ease-out",
            "checked:border-ink checked:bg-ink disabled:border-ink/20 disabled:checked:bg-stone",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bronze-text",
          )}
        />
        <Check
          aria-hidden="true"
          strokeWidth={2}
          className="pointer-events-none absolute inset-0.5 size-4 text-ivory opacity-0 transition-opacity duration-150 peer-checked:opacity-100"
        />
      </span>
      <span className="min-w-0 flex-1">{label}</span>
      {meta !== undefined ? (
        <span data-numeric className="shrink-0 font-mono text-label text-stone-text">
          {meta}
        </span>
      ) : null}
    </label>
  );
}

/** A segmented single choice (transaction, recency): real radios in a fieldset. */
export function Segmented<T extends string>({
  name,
  value,
  options,
  onChange,
  tone = "light",
  className,
}: {
  name: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  tone?: "light" | "dark";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <label key={option.value} className="relative inline-flex">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={checked}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />
            <span
              className={cn(
                "inline-flex h-11 cursor-pointer items-center border px-4 font-sans text-small uppercase tracking-[0.12em]",
                "transition-[background-color,color,border-color] duration-200 ease-out",
                "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2",
                tone === "dark"
                  ? cn(
                      "peer-focus-visible:outline-bronze",
                      checked ? "border-ivory bg-ivory text-ink" : "border-ivory/40 text-ivory pointer-fine:hover:border-ivory",
                    )
                  : cn(
                      "peer-focus-visible:outline-bronze-text",
                      checked ? "border-ink bg-ink text-ivory" : "border-ink/30 text-ink pointer-fine:hover:border-ink",
                    ),
              )}
            >
              {option.label}
            </span>
          </label>
        );
      })}
    </div>
  );
}
