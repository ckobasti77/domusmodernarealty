"use client";

import { CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { z } from "zod";
import { CheckboxField } from "@/components/site/Field";
import { Link } from "@/i18n/navigation";

/**
 * Pieces shared by every public lead form (PRD A5, CONTENT "Compliance"):
 * the localized contact schema, the required privacy consent with a separate,
 * UNTICKED marketing opt-in, the honeypot, and the success / error states.
 */

/** Same patterns the server enforces in `convex/lib/rateLimit.ts`. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+()\-\s\d]{6,24}$/;

type FormsT = (key: string, values?: Record<string, string | number>) => string;

export function contactFields(t: FormsT) {
  return {
    name: z
      .string()
      .trim()
      .min(1, t("requiredField"))
      .min(2, t("tooShort", { min: 2 }))
      .max(120, t("tooLong", { max: 120 })),
    email: z.string().trim().min(1, t("requiredField")).regex(EMAIL_RE, t("invalidEmail")),
    phone: z
      .string()
      .trim()
      .refine((value) => value.length === 0 || PHONE_RE.test(value), t("invalidPhone")),
    privacy: z.boolean().refine((value) => value, t("consentRequired")),
    marketing: z.boolean(),
    hp: z.string(),
  };
}

export type ConsentValues = { privacy: boolean; marketing: boolean; hp: string };

/** Registers the three compliance fields on any form that includes them. */
export function ConsentFields<T extends ConsentValues>({
  register,
  errors,
}: {
  register: UseFormRegister<T>;
  errors: FieldErrors<ConsentValues>;
}) {
  const t = useTranslations("forms");
  // The generic form type is structurally a superset of ConsentValues, so the
  // three field names are valid paths on it.
  const reg = register as unknown as UseFormRegister<ConsentValues>;
  return (
    <div className="flex flex-col gap-1">
      <p className="text-small text-stone-text">{t("purpose")}</p>
      <CheckboxField error={errors.privacy?.message} {...reg("privacy")}>
        {t.rich("consentPrivacy", {
          link: (chunks: ReactNode) => (
            <Link href="/privacy" prefetch={false} className="underline decoration-bronze underline-offset-4">
              {chunks}
            </Link>
          ),
        })}
      </CheckboxField>
      <CheckboxField label={t("marketingOptIn")} {...reg("marketing")} />
      {/* Honeypot: off-screen, out of the tab order and hidden from assistive
          tech. People never fill it; form-filling bots usually do. */}
      <div aria-hidden="true" className="absolute left-[-10000px] top-auto size-px overflow-hidden">
        <label>
          {t("honeypot")}
          <input type="text" tabIndex={-1} autoComplete="off" {...reg("hp")} />
        </label>
      </div>
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (message === null) return null;
  return (
    <p role="alert" className="border-l-2 border-danger bg-paper px-4 py-3 text-small text-danger">
      {message}
    </p>
  );
}

export function SuccessPanel({
  heading,
  body,
  detail,
  action,
}: {
  heading: string;
  body: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div role="status" data-testid="form-success" className="flex flex-col items-start gap-4 bg-ivory-2 p-6 md:p-8">
      <CheckCircle2 aria-hidden="true" strokeWidth={1.25} className="size-8 text-success-text" />
      <h3 className="font-serif text-h3">{heading}</h3>
      <p className="text-body text-ink">{body}</p>
      {detail !== undefined ? <p className="text-small text-stone-text">{detail}</p> : null}
      {action}
    </div>
  );
}
