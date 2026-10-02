"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod/mini";
import { ConsentFields, contactFields, FormError, SuccessPanel, useSuccessFocus } from "@/components/forms/shared";
import { Button } from "@/components/site/Button";
import { TextAreaField, TextField } from "@/components/site/Field";
import { api } from "@/convex/_generated/api";
import type { Locale } from "@/i18n/routing";
import { errorMessageKey } from "@/lib/errors";
import { getSessionKey } from "@/lib/session";
import { CONTACT_MESSAGE } from "./prefill";

/**
 * The general contact form (PRD A10) → `leads.createGeneral`, a lead of type
 * `general`. The client checks the same limits as the server (subject ≤ 160,
 * message 10–2000) so the visitor gets a localized message at once; the server
 * still decides (honeypot, consent, rate limit).
 *
 * `initialMessage` pre-fills the message (a link's `?message=`, see
 * `prefill.ts`); "send another" starts from an empty form.
 */
export function ContactForm({ initialMessage = "" }: { initialMessage?: string }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("forms");
  const tContact = useTranslations("contact.form");
  const tRoot = useTranslations();
  const createGeneral = useMutation(api.leads.createGeneral);
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const schema = z.object({
    ...contactFields(t),
    subject: z.string().check(z.trim(), z.maxLength(160, t("tooLong", { max: 160 }))),
    message: z
      .string()
      .check(
        z.trim(),
        z.minLength(1, t("requiredField")),
        z.minLength(CONTACT_MESSAGE.min, t("tooShort", { min: CONTACT_MESSAGE.min })),
        z.maxLength(CONTACT_MESSAGE.max, t("tooLong", { max: CONTACT_MESSAGE.max })),
      ),
  });
  type Values = z.infer<typeof schema>;

  const defaults: Values = {
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
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
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { ...defaults, message: initialMessage } });
  // The panel replaces a taller form: bring it, and the screen reader, to it.
  const successRef = useSuccessFocus(sent, () => setFocus("name"));

  async function onSubmit(values: Values) {
    setServerError(null);
    try {
      await createGeneral({
        sessionKey: getSessionKey(),
        locale,
        contact: {
          name: values.name,
          email: values.email,
          ...(values.phone.length > 0 ? { phone: values.phone } : {}),
        },
        ...(values.subject.length > 0 ? { subject: values.subject } : {}),
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
          heading={tContact("successHeading")}
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
              {tContact("sendAnother")}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="relative flex flex-col gap-5"
      data-testid="contact-form"
    >
      <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
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
      <TextField
        label={`${t("subject")} (${t("optional")})`}
        autoComplete="off"
        maxLength={160}
        hint={tContact("subjectHint")}
        error={errors.subject?.message}
        {...register("subject")}
      />
      <TextAreaField label={t("message")} rows={5} error={errors.message?.message} {...register("message")} />
      <ConsentFields register={register} errors={errors} />
      <FormError message={serverError} />
      <Button type="submit" disabled={isSubmitting} className="self-start">
        {isSubmitting ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
