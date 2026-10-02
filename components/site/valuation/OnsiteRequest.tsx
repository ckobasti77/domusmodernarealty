"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "convex/react";
import { CheckCircle2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { FormError, useSuccessFocus } from "@/components/forms/shared";
import { Button } from "@/components/site/Button";
import { TextAreaField } from "@/components/site/Field";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { OnsiteWindow } from "@/convex/lib/validators";
import { errorCode, errorMessageKey } from "@/lib/errors";
import { BELGRADE_TZ, nextBelgradeDays } from "@/lib/belgrade-time";
import { getSessionKey } from "@/lib/session";
import { cn } from "@/lib/utils";
import { ONSITE_WINDOWS, onsiteSchema, type OnsiteInput, type OnsiteValues } from "./schema";

/** How far ahead a visit can be proposed, counted from tomorrow. */
const DAYS_AHEAD = 14;
const HOUR_MS = 60 * 60_000;

const sundayFormatter = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: BELGRADE_TZ });

/** Tomorrow and the following days in Belgrade, Sundays left out (no visits on Sundays). */
function visitDays(now: number): { key: string; noon: number }[] {
  return nextBelgradeDays(now, DAYS_AHEAD + 1)
    .slice(1)
    .map((day) => ({ key: day.key, noon: day.start + 12 * HOUR_MS }))
    .filter((day) => sundayFormatter.format(day.noon) !== "Sun");
}

const WINDOW_KEYS: Record<OnsiteWindow, { label: string; hours: string }> = {
  morning: { label: "onsite.morning", hours: "onsite.morningHours" },
  midday: { label: "onsite.midday", hours: "onsite.middayHours" },
  afternoon: { label: "onsite.afternoon", hours: "onsite.afternoonHours" },
};

/** A radio styled as a sharp tile; the native input stays focusable and keyboard-operable. */
const TILE = cn(
  "flex h-full flex-col items-center justify-center gap-0.5 border border-stone-text/60 px-2 py-2.5 text-center",
  "transition-colors duration-200 ease-out pointer-fine:hover:border-bronze-deep",
  "peer-checked:border-ink peer-checked:bg-ink peer-checked:text-ivory",
  "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink",
);

const LEGEND = "font-sans text-label font-medium uppercase tracking-[0.12em] text-stone-text";

type Sent = { date: string; part: OnsiteWindow; already: boolean };

/**
 * The call to action on the result (PRD A6): ask for the free on-site
 * valuation and propose a day (the next two weeks, Belgrade calendar, no
 * Sundays) and a part of the day. `leads.requestOnsiteValuation` annotates the
 * valuation lead just created, so the agent sees the range and the request
 * together; it is accepted once, within a few hours of the valuation.
 *
 * Only rendered after a client-side submission, so "today" is read in the
 * browser without any server/client mismatch.
 */
export function OnsiteRequest({ leadId }: { leadId: Id<"leads"> }) {
  const t = useTranslations("valuation");
  const tForms = useTranslations("forms");
  const tRoot = useTranslations();
  const format = useFormatter();
  const request = useMutation(api.leads.requestOnsiteValuation);
  const [days] = useState(() => visitDays(Date.now()));
  const [sent, setSent] = useState<Sent | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  // The confirmation replaces the form the visitor was in: take focus with it.
  const successRef = useSuccessFocus(sent !== null);
  const resolver = useMemo(() => zodResolver(onsiteSchema({ tForms, t })), [tForms, t]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OnsiteInput, unknown, OnsiteValues>({ resolver, defaultValues: { day: "", window: "", note: "", hp: "" } });

  const longDate = (key: string) => {
    const day = days.find((candidate) => candidate.key === key);
    return day !== undefined
      ? format.dateTime(new Date(day.noon), { weekday: "long", day: "numeric", month: "long", timeZone: BELGRADE_TZ })
      : key;
  };

  async function onSubmit(values: OnsiteValues) {
    const part = values.window;
    setServerError(null);
    const note = values.note.trim();
    try {
      await request({
        sessionKey: getSessionKey(),
        leadId,
        preferredDate: values.day,
        preferredWindow: part,
        ...(note.length > 0 ? { note } : {}),
        hp: values.hp,
      });
      setSent({ date: values.day, part, already: false });
    } catch (error) {
      const code = errorCode(error);
      // Asked once already (another tab, a double submit): the request stands.
      if (code === "ALREADY_REQUESTED") setSent({ date: values.day, part, already: true });
      else if (code === "NOT_FOUND") setServerError(t("onsite.expired"));
      else setServerError(tRoot(errorMessageKey(error)));
    }
  }

  return (
    <section aria-labelledby="onsite-request-title" className="flex flex-col gap-6 bg-ivory p-6 md:p-8">
      <div className="flex flex-col gap-3">
        <p className="eyebrow text-bronze-text">{t("onsite.eyebrow")}</p>
        <h3 id="onsite-request-title" className="font-display text-h3 font-normal text-ink md:text-h2">
          {t("onsite.heading")}
        </h3>
        <p className="max-w-[56ch] text-pretty text-small text-stone-text md:text-body">{t("onsite.lede")}</p>
      </div>

      {sent !== null ? (
        <div
          ref={successRef}
          tabIndex={-1}
          role="status"
          data-testid="onsite-success"
          className="flex scroll-mt-28 flex-col items-start gap-3 hairline-t pt-6 outline-none"
        >
          <CheckCircle2 aria-hidden="true" strokeWidth={1.25} className="size-7 text-success-text" />
          <p className="font-display text-h3 text-ink">{t("onsite.successHeading")}</p>
          <p className="text-body text-ink">{sent.already ? t("onsite.already") : t("onsite.success")}</p>
          {sent.already ? null : (
            <p className="text-small text-stone-text">
              {t("onsite.selected", {
                date: longDate(sent.date),
                window: `${t(WINDOW_KEYS[sent.part].label)} (${t(WINDOW_KEYS[sent.part].hours)})`,
              })}
            </p>
          )}
        </div>
      ) : (
        <form noValidate data-testid="onsite-form" onSubmit={handleSubmit(onSubmit)} className="relative flex flex-col gap-7">
          <fieldset aria-describedby={errors.day !== undefined ? "onsite-day-error" : "onsite-tz"}>
            <legend className={LEGEND}>{t("onsite.day")}</legend>
            <p id="onsite-tz" className="mt-1 text-small text-stone-text">
              {tForms("viewingTimezone")}
            </p>
            <ul className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
              {days.map((day) => (
                <li key={day.key}>
                  <label className="block h-full cursor-pointer">
                    <input type="radio" value={day.key} className="peer sr-only" {...register("day")} />
                    <span className={cn(TILE, "min-h-16")}>
                      <span className="sr-only">{longDate(day.key)}</span>
                      <span aria-hidden="true" className="text-label uppercase tracking-[0.12em]">
                        {format.dateTime(new Date(day.noon), { weekday: "short", timeZone: BELGRADE_TZ })}
                      </span>
                      <span aria-hidden="true" data-numeric className="text-body-l font-medium leading-none">
                        {format.dateTime(new Date(day.noon), { day: "numeric", timeZone: BELGRADE_TZ })}
                      </span>
                      <span aria-hidden="true" className="text-label">
                        {format.dateTime(new Date(day.noon), { month: "short", timeZone: BELGRADE_TZ })}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            {errors.day?.message !== undefined ? (
              <p id="onsite-day-error" role="alert" className="mt-3 text-small text-danger">
                {errors.day.message}
              </p>
            ) : null}
          </fieldset>

          <fieldset aria-describedby={errors.window !== undefined ? "onsite-window-error" : undefined}>
            <legend className={LEGEND}>{t("onsite.window")}</legend>
            <ul className="mt-3 grid gap-2 sm:grid-cols-3">
              {ONSITE_WINDOWS.map((part) => (
                <li key={part}>
                  <label className="block h-full cursor-pointer">
                    <input type="radio" value={part} className="peer sr-only" {...register("window")} />
                    <span className={cn(TILE, "min-h-14 sm:min-h-16")}>
                      <span className="text-small font-medium">{t(WINDOW_KEYS[part].label)}</span>
                      <span data-numeric className="text-label tracking-[0.04em]">
                        {t(WINDOW_KEYS[part].hours)}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            {errors.window?.message !== undefined ? (
              <p id="onsite-window-error" role="alert" className="mt-3 text-small text-danger">
                {errors.window.message}
              </p>
            ) : null}
          </fieldset>

          <TextAreaField
            label={`${t("onsite.note")} (${tForms("optional")})`}
            rows={2}
            error={errors.note?.message}
            {...register("note")}
          />

          {/* Honeypot, as on every public form (components/forms/shared.tsx). */}
          <div aria-hidden="true" className="absolute left-[-10000px] top-auto size-px overflow-hidden">
            <label>
              {tForms("honeypot")}
              <input type="text" tabIndex={-1} autoComplete="off" {...register("hp")} />
            </label>
          </div>

          <FormError message={serverError} />
          <Button type="submit" disabled={isSubmitting} data-testid="onsite-submit" className="self-start">
            {isSubmitting ? tForms("submitting") : t("onsite.submit")}
          </Button>
        </form>
      )}
    </section>
  );
}
