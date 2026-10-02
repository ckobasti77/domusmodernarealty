"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "convex/react";
import { ArrowLeft } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { ConsentFields, FormError } from "@/components/forms/shared";
import { Button } from "@/components/site/Button";
import { TextAreaField, TextField } from "@/components/site/Field";
import { api } from "@/convex/_generated/api";
import type { Locale } from "@/i18n/routing";
import { errorMessageKey } from "@/lib/errors";
import { getSessionKey } from "@/lib/session";
import { FUNNEL_STEPS, ProgressSteps, type FunnelStep } from "./ProgressSteps";
import { PropertyFields } from "./PropertyFields";
import {
  contactSchema,
  hasLayout,
  propertySchema,
  toValuationArgs,
  type ContactValues,
  type PropertyInput,
  type PropertyValues,
} from "./schema";
import type { FunnelInitial, LocationGroup } from "./types";
import { ValuationResult, type ValuationOutcome } from "./ValuationResult";

/**
 * The valuation funnel (PRD A6): 1 the property, 2 the contact and consent,
 * 3 the indicative range computed by `leads.createValuation` on the server,
 * with the request for a free on-site valuation under it.
 *
 * Each step is its own `<form>` (Enter moves on; a step that failed once
 * re-validates while the visitor corrects it). Answers survive Back and
 * "value another property": the two form states live here, above the steps.
 * Moving between steps puts focus on the new step's heading, so a screen
 * reader announces where the visitor is and the page scrolls to it; the very
 * first render takes no focus. The step swap is a 300 ms fade (none under
 * reduced motion).
 */
export function ValuationFunnel({
  groups,
  initial,
}: {
  groups: readonly LocationGroup[];
  initial: FunnelInitial;
}) {
  const locale = useLocale() as Locale;
  const t = useTranslations("valuation");
  const tForms = useTranslations("forms");
  const tRoot = useTranslations();
  const createValuation = useMutation(api.leads.createValuation);

  const [step, setStep] = useState<FunnelStep>("property");
  /** Step 1 as validated (and narrowed) by its schema, kept for the submission. */
  const [answers, setAnswers] = useState<PropertyValues | null>(null);
  const [outcome, setOutcome] = useState<ValuationOutcome | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [currentYear] = useState(() => new Date().getFullYear());
  const headingRef = useRef<HTMLHeadingElement>(null);
  /** Step changes made by the visitor; the first render (0) takes no focus. */
  const [moves, setMoves] = useState(0);

  const propertyResolver = useMemo(
    () => zodResolver(propertySchema({ tForms, t, locale, currentYear })),
    [tForms, t, locale, currentYear],
  );
  const contactResolver = useMemo(() => zodResolver(contactSchema(tForms)), [tForms]);

  const property = useForm<PropertyInput, unknown, PropertyValues>({
    resolver: propertyResolver,
    defaultValues: {
      locationId: initial.locationId ?? "",
      propertyType: "apartment",
      area: initial.area ?? "",
      rooms: "",
      floor: "",
      totalFloors: "",
      elevator: "",
      condition: "",
      yearBuilt: "",
      addressNote: "",
    },
  });
  const contact = useForm<ContactValues>({
    resolver: contactResolver,
    defaultValues: { name: "", email: "", phone: "", message: "", privacy: false, marketing: false, hp: "" },
  });
  const propertyType = useWatch({ control: property.control, name: "propertyType" });

  useEffect(() => {
    if (moves > 0) headingRef.current?.focus();
  }, [moves]);

  const go = (next: FunnelStep) => {
    setServerError(null);
    setStep(next);
    setMoves((count) => count + 1);
  };

  async function submitValuation(described: PropertyValues, values: ContactValues) {
    setServerError(null);
    const args = toValuationArgs(described, values, { locale, sessionKey: getSessionKey() });
    try {
      const result = await createValuation(args);
      const location = groups.flatMap((group) => group.options).find((option) => option.id === args.locationId);
      setOutcome({
        leadId: result.leadId,
        valuation: result.valuation,
        propertyType: args.propertyType,
        rooms: args.rooms,
        areaM2: args.areaM2,
        place: location !== undefined ? { name: location.name, lang: location.lang } : null,
      });
      go("result");
    } catch (error) {
      setServerError(tRoot(errorMessageKey(error)));
    }
  }

  const position = FUNNEL_STEPS.indexOf(step) + 1;
  const heading =
    step === "property" ? t("propertyHeading") : step === "contact" ? t("contactHeading") : t("resultHeading");

  return (
    <div data-testid="valuation-funnel" className="flex flex-col gap-10">
      <ProgressSteps current={step} />

      <div key={step} className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 duration-300 ease-out">
        <div className="flex flex-col gap-3">
          {step === "result" ? <p className="eyebrow text-bronze-text">{t("resultEyebrow")}</p> : null}
          <h2 ref={headingRef} tabIndex={-1} className="font-display text-h2 font-normal text-ink">
            {/* The ruled index above shows the position; a screen reader hears it with the heading. */}
            {step === "result" ? null : (
              <span className="sr-only">{t("step", { current: position, total: FUNNEL_STEPS.length })}: </span>
            )}
            {heading}
          </h2>
          {step === "contact" ? <p className="max-w-[52ch] text-pretty text-body text-stone-text">{t("contactLede")}</p> : null}
        </div>

        {step === "property" ? (
          <form
            noValidate
            data-testid="valuation-step-1"
            onSubmit={property.handleSubmit((values) => {
              setAnswers(values);
              go("contact");
            })}
            className="mt-8 flex flex-col gap-10"
          >
            <PropertyFields
              groups={groups}
              layout={hasLayout(propertyType)}
              register={property.register}
              errors={property.formState.errors}
            />
            {/* Full width on a phone, where it closes a long column of fields. */}
            <div className="flex hairline-t pt-6 sm:justify-end">
              <Button type="submit" data-testid="valuation-next" className="w-full sm:w-auto">
                {t("next")}
              </Button>
            </div>
          </form>
        ) : null}

        {step === "contact" && answers !== null ? (
          <form
            noValidate
            data-testid="valuation-step-2"
            onSubmit={contact.handleSubmit((values) => submitValuation(answers, values))}
            className="relative mt-8 flex flex-col gap-6"
          >
            <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
              <TextField
                label={tForms("name")}
                autoComplete="name"
                error={contact.formState.errors.name?.message}
                {...contact.register("name")}
              />
              <TextField
                label={`${tForms("phone")} (${tForms("optional")})`}
                type="tel"
                autoComplete="tel"
                error={contact.formState.errors.phone?.message}
                {...contact.register("phone")}
              />
              <TextField
                label={tForms("email")}
                type="email"
                autoComplete="email"
                error={contact.formState.errors.email?.message}
                className="sm:col-span-2"
                {...contact.register("email")}
              />
              <TextAreaField
                label={`${tForms("message")} (${tForms("optional")})`}
                rows={3}
                error={contact.formState.errors.message?.message}
                className="sm:col-span-2"
                {...contact.register("message")}
              />
            </div>
            <ConsentFields register={contact.register} errors={contact.formState.errors} />
            <FormError message={serverError} />
            {/* A phone stacks Back over a full-width submit, in reading and focus
                order; from `sm` they share one row. `-ml-5` lines the ghost
                button's arrow up with the form's left edge. */}
            <div className="flex flex-col items-start gap-4 hairline-t pt-6 sm:flex-row sm:items-center sm:justify-between">
              <Button variant="ghost" size="compact" data-testid="valuation-back" onClick={() => go("property")} className="-ml-5">
                <ArrowLeft aria-hidden="true" strokeWidth={1.25} className="mr-2 inline size-4 align-[-0.15em]" />
                {t("previous")}
              </Button>
              <Button
                type="submit"
                disabled={contact.formState.isSubmitting}
                data-testid="valuation-submit"
                className="w-full sm:w-auto"
              >
                {contact.formState.isSubmitting ? t("submitting") : t("submit")}
              </Button>
            </div>
          </form>
        ) : null}

        {step === "result" && outcome !== null ? (
          <div data-testid="valuation-step-3" className="mt-8">
            <ValuationResult
              outcome={outcome}
              onRestart={() => {
                setOutcome(null);
                go("property");
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
