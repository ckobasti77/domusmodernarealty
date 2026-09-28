"use client";

import { AlertCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { buttonClasses } from "@/components/site/Button";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatCount, parseLocaleNumber } from "@/lib/format";
import { valuationQuery } from "@/lib/search-params";
import { cn } from "@/lib/utils";
import type { LocationOption } from "./types";

/**
 * The valuation mini-form (DESIGN §6.10): location + floor area, handed to the
 * localized valuation page (`/sr/procena`, `/de/bewertung`, …) as query
 * params so the wizard opens prefilled. Both fields are optional — an empty
 * form simply opens the wizard — but an area that is not a plausible number is
 * stopped here with a message, not passed along.
 *
 * The number is read in the visitor's own notation ("68,5" in sr/de/ru).
 */

const AREA = { min: 10, max: 5000 } as const;

/** Em spaces survive `<option>` whitespace collapsing, unlike ordinary spaces. */
const INDENT = " ";

const CELL = "flex min-w-0 flex-col justify-center gap-1.5 px-5 py-4";
const LABEL = "font-mono text-label uppercase text-mist";
const CONTROL = cn(
  "w-full min-w-0 bg-transparent py-1 font-sans text-body text-ivory",
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-bronze",
);

export function ValuationForm({ locations }: { locations: readonly LocationOption[] }) {
  const t = useTranslations("home");
  const tUnits = useTranslations("units");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const id = useId();
  const [location, setLocation] = useState("");
  const [area, setArea] = useState("");
  const [error, setError] = useState<string | null>(null);

  const errorId = `${id}-error`;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    let squareMetres: number | undefined;
    if (area.trim().length > 0) {
      const parsed = parseLocaleNumber(area, locale);
      if (parsed === null || parsed < AREA.min || parsed > AREA.max) {
        setError(
          t("valuationAreaInvalid", { min: formatCount(AREA.min, locale), max: formatCount(AREA.max, locale) }),
        );
        return;
      }
      squareMetres = Math.round(parsed);
    }
    setError(null);
    router.push({
      pathname: "/valuation",
      query: valuationQuery({ location: location.length > 0 ? location : undefined, area: squareMetres }),
    });
  };

  return (
    <form onSubmit={submit} noValidate className="mt-10 lg:mt-12">
      <div className="grid border border-ivory/25 sm:grid-cols-[minmax(0,1fr)_11rem]">
        <div className={CELL}>
          <label htmlFor={`${id}-location`} className={LABEL}>
            {t("valuationLocation")}
          </label>
          <div className="relative flex items-center">
            <select
              id={`${id}-location`}
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              className={cn(CONTROL, "appearance-none truncate pr-7 [&>option]:bg-ink [&>option]:text-ivory")}
            >
              <option value="">{t("valuationLocationAny")}</option>
              {locations.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {INDENT.repeat(item.depth)}
                  {item.name}
                </option>
              ))}
            </select>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-1 size-2 -translate-y-0.5 rotate-45 border-b border-r border-mist"
            />
          </div>
        </div>

        <div className={cn(CELL, "border-t border-ivory/25 sm:border-l sm:border-t-0")}>
          <label htmlFor={`${id}-area`} className={LABEL}>
            {t("valuationArea")}
          </label>
          <div className="flex items-baseline gap-2">
            <input
              id={`${id}-area`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder={t("valuationAreaPlaceholder")}
              value={area}
              onChange={(event) => {
                setArea(event.target.value);
                if (error !== null) setError(null);
              }}
              aria-invalid={error !== null}
              aria-describedby={error !== null ? errorId : undefined}
              className={cn(CONTROL, "placeholder:text-mist/70")}
            />
            <span aria-hidden="true" className="shrink-0 text-body text-mist">
              {tUnits("m2")}
            </span>
          </div>
        </div>
      </div>

      {error !== null ? (
        <p id={errorId} role="alert" className="mt-3 flex items-start gap-2 text-small text-ivory">
          <AlertCircle aria-hidden="true" strokeWidth={1.5} className="mt-0.5 size-4 shrink-0 text-danger" />
          <span>{error}</span>
        </p>
      ) : null}

      <button type="submit" className={cn(buttonClasses({ variant: "inverse" }), "mt-6 w-full sm:w-auto")}>
        <span>{t("valuationSubmit")}</span>
      </button>
    </form>
  );
}
