"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod/mini";
import { Button } from "@/components/site/Button";
import { TextAreaField, TextField } from "@/components/site/Field";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Locale } from "@/i18n/routing";
import { errorMessageKey } from "@/lib/errors";
import { getSessionKey } from "@/lib/session";
import { ConsentFields, contactFields, FormError, SuccessPanel, useSuccessFocus } from "./shared";

/**
 * Listing inquiry (PRD A5) → `leads.createInquiry`. Validation runs on the
 * client for instant, localized feedback and again on the server, which is the
 * one that counts (honeypot, rate limit, consent, lengths).
 */
export function InquiryForm({ listingId, refCode }: { listingId: Id<"listings">; refCode: string }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("forms");
  const tRoot = useTranslations();
  const createInquiry = useMutation(api.leads.createInquiry);
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const schema = z.object({
    ...contactFields(t),
    message: z
      .string()
      .check(z.trim(), z.minLength(10, t("tooShort", { min: 10 })), z.maxLength(2000, t("tooLong", { max: 2000 }))),
  });
  type Values = z.infer<typeof schema>;

  const defaults: Values = {
    name: "",
    email: "",
    phone: "",
    message: t("inquiryMessageDefault", { ref: refCode }),
    privacy: false,
    marketing: false,
    hp: "",
  };

  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults });
  const successRef = useSuccessFocus(sent, () => setFocus("name"));

  async function onSubmit(values: Values) {
    setServerError(null);
    try {
      await createInquiry({
        sessionKey: getSessionKey(),
        locale,
        listingId,
        contact: {
          name: values.name,
          email: values.email,
          ...(values.phone.length > 0 ? { phone: values.phone } : {}),
        },
        message: values.message,
        privacy: values.privacy,
        marketing: values.marketing,
        hp: values.hp,
      });
      setSent(true);
    } catch (error) {
      setServerError(tRoot(errorMessageKey(error)));
    }
  }

  if (sent) {
    return (
      <div ref={successRef} tabIndex={-1} className="scroll-mt-28 outline-none">
        <SuccessPanel
          heading={t("successHeading")}
          body={t("success")}
          action={
            <Button
              variant="outline"
              size="compact"
              onClick={() => {
                reset(defaults);
                setSent(false);
              }}
            >
              {t("sendAnother")}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="relative flex flex-col gap-4" data-testid="inquiry-form">
      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <TextField label={t("name")} autoComplete="name" error={errors.name?.message} {...register("name")} />
        <TextField
          label={`${t("phone")} (${t("optional")})`}
          type="tel"
          autoComplete="tel"
          error={errors.phone?.message}
          {...register("phone")}
        />
      </div>
      <TextField label={t("email")} type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
      <TextAreaField label={t("message")} rows={4} error={errors.message?.message} {...register("message")} />
      <ConsentFields register={register} errors={errors} />
      <FormError message={serverError} />
      <Button type="submit" disabled={isSubmitting} className="self-start">
        {isSubmitting ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
