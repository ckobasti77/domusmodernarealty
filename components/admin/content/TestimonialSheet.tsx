"use client";

import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Loader2 } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { DetailSheet } from "@/components/admin/common/DetailSheet";
import { describedBy, FieldShell } from "@/components/admin/common/form";
import { fromL10nValue, L10nInput, toL10nValue, type L10nValue } from "@/components/admin/common/L10nInput";
import { DotBadge } from "@/components/admin/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { adminErrorMessage } from "@/lib/admin/errors";

export type TestimonialRow = FunctionReturnType<typeof api.testimonialsAdmin.listAll>[number];

/**
 * Create or edit one testimonial. Saving a changed text of a verified
 * testimonial takes it off the site until a manager confirms it again (the
 * server decides; the sheet says so up front).
 */
export function TestimonialSheet({
  open,
  onOpenChange,
  testimonial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `null` = a new testimonial. */
  testimonial: TestimonialRow | null;
  onSaved: (id: Id<"testimonials">) => void;
}) {
  return (
    <DetailSheet
      open={open}
      onOpenChange={onOpenChange}
      title={testimonial === null ? "Nova preporuka" : testimonial.author}
      description={
        testimonial === null
          ? "Unesite reči klijenta tačno kako ih je dao. Preporuka se ne prikazuje na sajtu dok je menadžer ne potvrdi."
          : "Izmena preporuke"
      }
      meta={
        testimonial !== null ? (
          <>
            {testimonial.verified ? <DotBadge tone="success">Na sajtu</DotBadge> : <DotBadge tone="muted">Nije na sajtu</DotBadge>}
            {testimonial.isDemo ? <DotBadge tone="warning">Demo</DotBadge> : null}
          </>
        ) : undefined
      }
      width="lg"
      testId="testimonial-sheet"
    >
      {/* Remounted per record, so the fields start from it. */}
      {open ? (
        <TestimonialForm
          key={testimonial?._id ?? "new"}
          testimonial={testimonial}
          onCancel={() => onOpenChange(false)}
          onSaved={onSaved}
        />
      ) : null}
    </DetailSheet>
  );
}

function TestimonialForm({
  testimonial,
  onCancel,
  onSaved,
}: {
  testimonial: TestimonialRow | null;
  onCancel: () => void;
  onSaved: (id: Id<"testimonials">) => void;
}) {
  const upsert = useMutation(api.testimonialsAdmin.upsert);
  const authorId = useId();
  const [author, setAuthor] = useState(testimonial?.author ?? "");
  const [quote, setQuote] = useState<L10nValue>(toL10nValue(testimonial?.quote));
  const [context, setContext] = useState<L10nValue>(toL10nValue(testimonial?.context));
  const [errors, setErrors] = useState<{ author?: string; quote?: string; context?: string }>({});
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found: typeof errors = {};
    if (author.trim().length < 2) found.author = "Ime klijenta je obavezno.";
    if (quote.sr.trim().length < 20) found.quote = "Citat na srpskom je obavezan (najmanje 20 znakova).";
    const contextFilled = Object.values(context).some((text) => text.trim().length > 0);
    if (contextFilled && context.sr.trim().length === 0) found.context = "Srpski tekst je obavezan.";
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      const result = await upsert({
        ...(testimonial !== null ? { id: testimonial._id } : {}),
        author: author.trim(),
        quote: fromL10nValue(quote),
        ...(contextFilled ? { context: fromL10nValue(context) } : {}),
      });
      toast.success(
        result.unverified
          ? "Sačuvano. Preporuka je skinuta sa sajta dok je menadžer ponovo ne potvrdi."
          : "Preporuka je sačuvana.",
      );
      onSaved(result.id);
    } catch (error) {
      toast.error(adminErrorMessage(error, "Preporuka nije sačuvana."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      {testimonial?.verified === true ? (
        <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          Ova preporuka je na sajtu. Ako izmenite tekst, skida se sa sajta dok je menadžer ponovo ne potvrdi.
        </p>
      ) : null}

      <FieldShell id={authorId} label="Ime klijenta *" hint="Kako je klijent pristao da bude potpisan, npr. „Marija P.”." error={errors.author}>
        <Input
          id={authorId}
          value={author}
          maxLength={80}
          onChange={(event) => setAuthor(event.target.value)}
          aria-invalid={errors.author !== undefined || undefined}
          aria-describedby={describedBy(authorId, true, errors.author !== undefined)}
          data-testid="testimonial-author"
        />
      </FieldShell>

      <L10nInput
        label="Citat"
        value={quote}
        onChange={setQuote}
        multiline
        rows={5}
        required
        maxLength={1000}
        error={errors.quote}
        testId="testimonial-quote"
      />

      <L10nInput
        label="Kontekst"
        value={context}
        onChange={setContext}
        maxLength={120}
        hint="Neobavezno, npr. „Kupila stan na Vračaru, 2026.”"
        error={errors.context}
        testId="testimonial-context"
      />

      <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          Otkaži
        </Button>
        <Button type="submit" disabled={saving} data-testid="save-button">
          {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Sačuvaj
        </Button>
      </div>
    </form>
  );
}
