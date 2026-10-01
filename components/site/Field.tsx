"use client";

import { AlertCircle } from "lucide-react";
import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Underline-style form controls for the public site (DESIGN §4): a paper
 * surface, one hairline under the control that turns bronze on focus, a label
 * that floats up once the control has a value, and errors as text plus an icon.
 *
 * Accessibility rules baked in, not left to the caller:
 *  - the label is always a real `<label for>`, never a placeholder;
 *  - errors are wired through `aria-describedby` + `aria-invalid` and announced
 *    with `role="alert"`;
 *  - every control clears 44px, which satisfies WCAG 2.5.8 with room to spare;
 *  - `:required` is stated in the label text, not only with a red asterisk.
 *
 * The floating label uses `:placeholder-shown` rather than JS state, so it works
 * with react-hook-form, autofill and an uncontrolled form alike. That needs a
 * placeholder to exist, so a single space is used when none is given.
 */

const CONTROL = [
  "peer w-full min-h-11 border-0 border-b bg-transparent px-0 pb-2 pt-6",
  "font-sans text-body text-ink placeholder:text-transparent",
  // `border-stone-text`, not the 12% hairline: an input's underline is a UI
  // component boundary, and WCAG 1.4.11 wants 3:1 against the surface. The
  // hairline is ~1.2:1 and effectively invisible on ivory-2.
  "border-stone-text transition-colors duration-200 ease-out",
  "focus:border-bronze focus:outline-none",
  "aria-[invalid=true]:border-danger",
  "disabled:opacity-50",
].join(" ");

const LABEL = [
  "pointer-events-none absolute left-0 top-6 origin-left font-sans text-body text-stone-text",
  "transition-transform duration-200 ease-out",
  // Floated: up and smaller. `scale` keeps it on the compositor.
  "peer-focus:-translate-y-5 peer-focus:scale-[0.78] peer-focus:text-bronze-text",
  "peer-not-placeholder-shown:-translate-y-5 peer-not-placeholder-shown:scale-[0.78]",
].join(" ");

type Shared = {
  label: string;
  /** Rendered under the control; becomes the error text when `error` is set. */
  hint?: string;
  error?: string;
  className?: string;
};

function useFieldIds(error: string | undefined, hint: string | undefined) {
  const id = useId();
  const messageId = `${id}-message`;
  const describedBy = error !== undefined || hint !== undefined ? messageId : undefined;
  return { id, messageId, describedBy };
}

function Message({
  id,
  error,
  hint,
}: {
  id: string;
  error: string | undefined;
  hint: string | undefined;
}) {
  if (error !== undefined) {
    return (
      <p id={id} role="alert" className="mt-2 flex items-start gap-1.5 text-small text-danger">
        <AlertCircle aria-hidden="true" strokeWidth={1.5} className="mt-0.5 size-4 shrink-0" />
        <span>{error}</span>
      </p>
    );
  }
  if (hint !== undefined) {
    return (
      <p id={id} className="mt-2 text-small text-stone-text">
        {hint}
      </p>
    );
  }
  return null;
}

export type TextFieldProps = Shared & Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "id">;

export function TextField({ label, hint, error, className, placeholder = " ", ...rest }: TextFieldProps) {
  const { id, messageId, describedBy } = useFieldIds(error, hint);
  return (
    <div className={cn("w-full", className)}>
      <div className="relative">
        <input
          id={id}
          placeholder={placeholder}
          aria-invalid={error !== undefined}
          aria-describedby={describedBy}
          className={CONTROL}
          {...rest}
        />
        <label htmlFor={id} className={LABEL}>
          {label}
        </label>
      </div>
      <Message id={messageId} error={error} hint={hint} />
    </div>
  );
}

export type TextAreaFieldProps = Shared &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className" | "id">;

export function TextAreaField({
  label,
  hint,
  error,
  className,
  rows = 4,
  placeholder = " ",
  style,
  ...rest
}: TextAreaFieldProps) {
  const { id, messageId, describedBy } = useFieldIds(error, hint);
  return (
    <div className={cn("w-full", className)}>
      <div className="relative">
        {/* No browser resize grip on the underline: the field grows with what
            is typed (`field-sizing`), from `rows` lines plus its padding, up
            to 16 lines, then scrolls. Browsers without `field-sizing` keep
            the fixed `rows` height. */}
        <textarea
          id={id}
          rows={rows}
          placeholder={placeholder}
          aria-invalid={error !== undefined}
          aria-describedby={describedBy}
          className={cn(CONTROL, "max-h-[calc(16lh+2rem)] resize-none [field-sizing:content]")}
          style={{ minHeight: `calc(${rows}lh + 2rem + 1px)`, ...style }}
          {...rest}
        />
        <label htmlFor={id} className={LABEL}>
          {label}
        </label>
      </div>
      <Message id={messageId} error={error} hint={hint} />
    </div>
  );
}

export type SelectFieldProps = Shared &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, "className" | "id"> & {
    children: ReactNode;
  };

/**
 * A native `<select>`, deliberately. A custom listbox would need to re-implement
 * type-ahead, mobile wheel pickers and IME behaviour; the native control already
 * has them, and the underline styling survives.
 */
export function SelectField({ label, hint, error, className, children, ...rest }: SelectFieldProps) {
  const { id, messageId, describedBy } = useFieldIds(error, hint);
  return (
    <div className={cn("w-full", className)}>
      <div className="relative">
        <select
          id={id}
          aria-invalid={error !== undefined}
          aria-describedby={describedBy}
          className={cn(CONTROL, "appearance-none pr-8")}
          {...rest}
        >
          {children}
        </select>
        {/* A select always has a value, so its label is permanently in the
            floated position — same size, same place, same case as every other
            label in the form. Two label systems in one form is a tell. */}
        <label
          htmlFor={id}
          className="pointer-events-none absolute left-0 top-1 origin-left scale-[0.78] font-sans text-body text-stone-text"
        >
          {label}
        </label>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-3 right-1 size-2 rotate-45 border-b border-r border-stone-text"
        />
      </div>
      <Message id={messageId} error={error} hint={hint} />
    </div>
  );
}

export type CheckboxFieldProps = Omit<Shared, "label"> &
  Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "id" | "type"> & {
    /**
     * Plain-text label. Omit it and pass `children` instead when the label has
     * to contain a link (the privacy consent), which a string cannot express.
     */
    label?: string;
    children?: ReactNode;
  };

/**
 * A square hairline checkbox. `appearance-none` plus a `checked:` background is
 * enough — the native control keeps its own focus, keyboard and form semantics.
 */
export function CheckboxField({ label, hint, error, className, children, ...rest }: CheckboxFieldProps) {
  const { id, messageId, describedBy } = useFieldIds(error, hint);
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id={id}
          aria-invalid={error !== undefined}
          aria-describedby={describedBy}
          className={cn(
            // `mt-2.5` centres the box on the label's first line (the label has `py-2.5`).
            "mt-2.5 size-5 shrink-0 appearance-none border border-stone-text bg-paper",
            "transition-colors duration-150 ease-out",
            "checked:border-bronze-text checked:bg-bronze-text",
            "aria-[invalid=true]:border-danger",
            // The tick, drawn with a background image so no child element is needed.
            "checked:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22><path d=%22M3.5 8.5l3 3 6-7%22 fill=%22none%22 stroke=%22%23FBF9F5%22 stroke-width=%221.75%22/></svg>')] checked:bg-center checked:bg-no-repeat",
          )}
          {...rest}
        />
        {/* `block`, NOT `flex`: rich-text children arrive as separate nodes
            ("Slazem se sa ", <a>, "."), and a flex container turns each one into
            a flex item, which drops the whitespace between them. `py` rather
            than a fixed height keeps the 44px target when the label wraps. */}
        <label htmlFor={id} className="block min-h-11 py-2.5 text-small text-ink">
          {children ?? label}
        </label>
      </div>
      <Message id={messageId} error={error} hint={hint} />
    </div>
  );
}

export type RadioOption = { value: string; label: string };

export function RadioField({
  label,
  hint,
  error,
  className,
  name,
  options,
  defaultValue,
  ...rest
}: Shared & {
  name: string;
  options: readonly RadioOption[];
  defaultValue?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "id" | "type" | "name" | "defaultValue">) {
  const { messageId, describedBy } = useFieldIds(error, hint);
  return (
    <fieldset className={cn("w-full", className)} aria-describedby={describedBy}>
      <legend className="origin-left scale-[0.78] font-sans text-body text-stone-text">
        {label}
      </legend>
      <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
        {options.map((option) => (
          <label key={option.value} className="flex min-h-11 items-center gap-3 text-small text-ink">
            <input
              type="radio"
              name={name}
              value={option.value}
              defaultChecked={option.value === defaultValue}
              className={cn(
                "size-5 shrink-0 appearance-none rounded-full border border-stone-text bg-paper",
                "transition-colors duration-150 ease-out",
                "checked:border-[6px] checked:border-bronze-text",
                // `aria-invalid` is not valid on role=radio, so the invalid
                // state is carried by the group instead of each input.
                error !== undefined && "border-danger",
              )}
              {...rest}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      <Message id={messageId} error={error} hint={hint} />
    </fieldset>
  );
}
