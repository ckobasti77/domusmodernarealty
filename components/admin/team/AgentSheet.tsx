"use client";

import { useMutation } from "convex/react";
import { CalendarClock, ExternalLink, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/common/ConfirmDialog";
import { DetailSheet } from "@/components/admin/common/DetailSheet";
import { describedBy, FieldShell, FormSection } from "@/components/admin/common/form";
import { ImageField } from "@/components/admin/common/ImageField";
import { fromL10nValue, L10nInput, toL10nValue, type L10nValue } from "@/components/admin/common/L10nInput";
import { useLeaveGuard } from "@/components/admin/common/LeaveGuard";
import { useMutationAction } from "@/components/admin/common/useMutationAction";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { slugify } from "@/convex/lib/slug";
import type { ImageRef } from "@/convex/lib/validators";
import { L10N_LABEL } from "@/lib/admin/labels";
import { AreasPicker } from "./AreasPicker";
import { CORE_LANGUAGES, languageName, type TeamAgent } from "./labels";

type CoreLanguage = (typeof CORE_LANGUAGES)[number];

type Draft = {
  name: string;
  slug: string;
  role: L10nValue;
  bio: L10nValue;
  photo: ImageRef | undefined;
  languages: CoreLanguage[];
  /** Other languages as typed: ISO codes separated by commas or spaces. */
  otherLanguages: string;
  phone: string;
  viber: string;
  whatsapp: string;
  email: string;
  areas: Id<"locations">[];
  licenseId: string;
  isPublic: boolean;
};

type ErrorKey = "name" | "slug" | "role" | "bio" | "languages" | "phone" | "viber" | "whatsapp" | "email";
type Errors = Partial<Record<ErrorKey, string>>;

const MAX_LANGUAGES = 8;
const LANGUAGE_RE = /^[a-z]{2,3}$/;
const PHONE_RE = /^\+?[0-9 ()/.-]{6,24}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_HINT = "Sa pozivnim brojem, npr. +381 64 123 4567.";

function isCore(code: string): code is CoreLanguage {
  return (CORE_LANGUAGES as readonly string[]).includes(code);
}

function toDraft(agent: TeamAgent | undefined): Draft {
  return {
    name: agent?.name ?? "",
    slug: agent?.slug ?? "",
    role: toL10nValue(agent?.role),
    bio: toL10nValue(agent?.bio),
    photo: agent?.photo,
    languages: agent === undefined ? ["sr"] : agent.languages.filter(isCore),
    otherLanguages: (agent?.languages ?? []).filter((code) => !isCore(code)).join(", "),
    phone: agent?.phone ?? "",
    viber: agent?.viber ?? "",
    whatsapp: agent?.whatsapp ?? "",
    email: agent?.email ?? "",
    areas: agent?.areas ?? [],
    licenseId: agent?.licenseId ?? "",
    isPublic: agent?.isPublic ?? false,
  };
}

function otherCodes(text: string): string[] {
  return text
    .split(/[\s,;]+/)
    .map((code) => code.trim().toLowerCase())
    .filter((code) => code.length > 0);
}

function allLanguages(draft: Draft): string[] {
  const core = CORE_LANGUAGES.filter((code) => draft.languages.includes(code));
  const others = otherCodes(draft.otherLanguages).filter((code) => !isCore(code));
  return [...new Set([...core, ...others])];
}

function hasText(value: L10nValue): boolean {
  return Object.values(value).some((text) => text.trim().length > 0);
}

function validate(draft: Draft): Errors {
  const errors: Errors = {};
  if (draft.name.trim().length < 2) errors.name = "Unesite ime i prezime.";
  if (draft.role.sr.trim().length === 0) errors.role = "Zvanje na srpskom je obavezno.";
  if (draft.bio.sr.trim().length === 0 && hasText(draft.bio)) {
    errors.bio = "Prvo unesite biografiju na srpskom, pa prevode.";
  }
  const bad = otherCodes(draft.otherLanguages).filter((code) => !LANGUAGE_RE.test(code));
  if (bad.length > 0) {
    errors.languages = `„${bad[0]}” nije kod jezika. Koristite dvoslovne kodove, npr. it, fr, hu.`;
  } else if (allLanguages(draft).length > MAX_LANGUAGES) {
    errors.languages = `Najviše ${MAX_LANGUAGES} jezika.`;
  }
  for (const key of ["phone", "viber", "whatsapp"] as const) {
    const text = draft[key].trim();
    if (text.length > 0 && !PHONE_RE.test(text)) errors[key] = PHONE_HINT;
  }
  const email = draft.email.trim();
  if (email.length > 0 && !EMAIL_RE.test(email)) errors.email = "Unesite ispravnu e-adresu.";
  if (draft.slug.trim().length > 0 && slugify(draft.slug) === "x") errors.slug = "Adresa mora imati slova ili cifre.";
  return errors;
}

function optionalText(value: string): string | undefined {
  const text = value.trim();
  return text.length > 0 ? text : undefined;
}

/**
 * The agent profile editor (PRD B7): photo (or monogram), name and public
 * address, title and bio per locale, languages, contact channels, areas,
 * license ID and the public switch. Admins and managers edit; the order is set
 * with the arrows in the list. Keyed by the profile, so switching records
 * starts from that record's saved state.
 */
export function AgentSheet({
  open,
  agent,
  onClose,
  onCreated,
}: {
  open: boolean;
  /** Undefined with `open`: a new profile. */
  agent: TeamAgent | undefined;
  onClose: () => void;
  onCreated: (id: Id<"agents">) => void;
}) {
  const [dirty, setDirty] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const requestClose = () => {
    if (dirty) setConfirmDiscard(true);
    else onClose();
  };

  return (
    <>
      <DetailSheet
        open={open}
        onOpenChange={(next) => {
          if (!next) requestClose();
        }}
        title={agent !== undefined ? agent.name : "Novi profil agenta"}
        description={
          agent !== undefined
            ? agent.isPublic
              ? `Javni profil: /agenti/${agent.slug}`
              : "Profil je skriven sa sajta."
            : "Profil se prikazuje na sajtu tek kada uključite „Javni profil”."
        }
        actions={
          agent !== undefined && agent.isPublic ? (
            <Button variant="ghost" size="sm" asChild>
              <a href={`/sr/agenti/${agent.slug}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden="true" />
                Na sajtu
                <span className="sr-only"> (otvara se u novoj kartici)</span>
              </a>
            </Button>
          ) : undefined
        }
        width="xl"
        testId="agent-sheet"
      >
        {open ? (
          <AgentForm
            key={agent?._id ?? "new"}
            agent={agent}
            onDirtyChange={setDirty}
            onClose={onClose}
            onRequestClose={requestClose}
            onCreated={onCreated}
          />
        ) : null}
      </DetailSheet>
      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Odbaciti nesačuvane izmene?"
        description="Izmene na ovom profilu još nisu sačuvane."
        confirmLabel="Odbacite izmene"
        cancelLabel="Nastavite uređivanje"
        destructive
        onConfirm={() => {
          setDirty(false);
          onClose();
        }}
      />
    </>
  );
}

function AgentForm({
  agent,
  onDirtyChange,
  onClose,
  onRequestClose,
  onCreated,
}: {
  agent: TeamAgent | undefined;
  onDirtyChange: (dirty: boolean) => void;
  /** Closes at once (after a delete). */
  onClose: () => void;
  /** Closes unless there are unsaved changes (then asks first). */
  onRequestClose: () => void;
  onCreated: (id: Id<"agents">) => void;
}) {
  const formId = useId();
  const id = (name: string) => `${formId}-${name}`;
  const [baseline, setBaseline] = useState(() => toDraft(agent));
  const [draft, setDraft] = useState(baseline);
  const [errors, setErrors] = useState<Errors>({});
  const upsert = useMutationAction(useMutation(api.agentsAdmin.upsert));
  const remove = useMutationAction(useMutation(api.agentsAdmin.remove), "Profil je obrisan.");

  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  useLeaveGuard({ dirty, description: "Izmene na ovom profilu još nisu sačuvane. Ako sada napustite stranicu, biće izgubljene." });

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const slugPreview = draft.slug.trim().length > 0 ? slugify(draft.slug) : slugify(draft.name || "ime-prezime");
  const slugChanged = agent !== undefined && draft.slug.trim() !== agent.slug;
  const photoPreview =
    agent?.photo !== undefined &&
    draft.photo !== undefined &&
    JSON.stringify(agent.photo) === JSON.stringify(draft.photo)
      ? agent.photoUrl
      : undefined;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = validate(draft);
    setErrors(next);
    if (Object.keys(next).length > 0) {
      toast.error("Proverite označena polja.");
      return;
    }
    const sendSlug = agent === undefined ? draft.slug.trim().length > 0 : slugChanged;
    const phone = optionalText(draft.phone);
    const viber = optionalText(draft.viber);
    const whatsapp = optionalText(draft.whatsapp);
    const email = optionalText(draft.email);
    const licenseId = optionalText(draft.licenseId);
    const saved = await upsert.run({
      ...(agent !== undefined ? { id: agent._id } : {}),
      name: draft.name.trim(),
      ...(sendSlug ? { slug: draft.slug } : {}),
      role: fromL10nValue(draft.role),
      ...(hasText(draft.bio) ? { bio: fromL10nValue(draft.bio) } : {}),
      ...(draft.photo !== undefined ? { photo: draft.photo } : {}),
      languages: allLanguages(draft),
      ...(phone !== undefined ? { phone } : {}),
      ...(viber !== undefined ? { viber } : {}),
      ...(whatsapp !== undefined ? { whatsapp } : {}),
      ...(email !== undefined ? { email: email.toLowerCase() } : {}),
      areas: draft.areas,
      ...(licenseId !== undefined ? { licenseId } : {}),
      isPublic: draft.isPublic,
    });
    if (saved === undefined) return;
    const settled = { ...draft, slug: saved.slug };
    setDraft(settled);
    setBaseline(settled);
    toast.success(agent === undefined ? "Profil je napravljen." : "Profil je sačuvan.");
    if (agent === undefined) onCreated(saved.id);
  };

  const fieldProps = (key: ErrorKey, hint: boolean) => ({
    id: id(key),
    "aria-invalid": errors[key] !== undefined || undefined,
    "aria-describedby": describedBy(id(key), hint, errors[key] !== undefined),
  });

  return (
    <form id={formId} onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-4">
      <FormSection title="Osnovno" description="Ime, zvanje i fotografija na kartici agenta.">
        <ImageField
          label="Fotografija"
          value={draft.photo}
          previewUrl={photoPreview}
          onChange={(next) => set("photo", next)}
          aspect="portrait"
          hint="Pravi portret, uspravan kadar. Bez fotografije sajt prikazuje inicijale; ne koristite fotografije sa foto-banke."
          testId="agent-photo"
        />
        <div className="flex flex-col gap-4">
          <FieldShell id={id("name")} label="Ime i prezime" error={errors.name}>
            <Input
              {...fieldProps("name", false)}
              value={draft.name}
              maxLength={80}
              autoComplete="off"
              onChange={(event) => set("name", event.target.value)}
              data-testid="agent-name"
            />
          </FieldShell>
          <FieldShell
            id={id("slug")}
            label="Adresa profila"
            hint={
              slugChanged && agent?.isPublic
                ? `Stara adresa /agenti/${agent.slug} prestaje da radi.`
                : `/sr/agenti/${slugPreview}`
            }
            error={errors.slug}
          >
            <Input
              {...fieldProps("slug", true)}
              value={draft.slug}
              maxLength={80}
              autoComplete="off"
              spellCheck={false}
              placeholder={agent === undefined ? "Pravi se iz imena" : undefined}
              onChange={(event) => set("slug", event.target.value)}
              data-testid="agent-slug"
            />
          </FieldShell>
          <FieldShell id={id("license")} label="Broj licence posrednika" hint="Prikazuje se na profilu ako je unet.">
            <Input
              id={id("license")}
              aria-describedby={`${id("license")}-hint`}
              value={draft.licenseId}
              maxLength={40}
              autoComplete="off"
              onChange={(event) => set("licenseId", event.target.value)}
            />
          </FieldShell>
          <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
            <div>
              <label htmlFor={id("public")} className="text-sm font-medium">
                Javni profil
              </label>
              <p id={`${id("public")}-hint`} className="text-xs text-muted-foreground">
                {draft.isPublic ? "Prikazuje se na stranici Agenti." : "Skriven sa sajta."}
              </p>
            </div>
            <Switch
              id={id("public")}
              checked={draft.isPublic}
              onCheckedChange={(checked) => set("isPublic", checked)}
              aria-describedby={`${id("public")}-hint`}
              data-testid="agent-is-public"
            />
          </div>
        </div>
        <L10nInput
          label="Zvanje"
          value={draft.role}
          onChange={(next) => set("role", next)}
          required
          maxLength={80}
          hint="Npr. Viši agent, Direktorka prodaje."
          error={errors.role}
          testId="agent-role"
        />
      </FormSection>

      <FormSection title="Biografija" columns={1} description="Dve-tri rečenice: oblasti, vrsta nekretnina, s kim najčešće radi.">
        <L10nInput
          label="Biografija"
          value={draft.bio}
          onChange={(next) => set("bio", next)}
          multiline
          rows={5}
          maxLength={2000}
          error={errors.bio}
          testId="agent-bio"
        />
      </FormSection>

      <FormSection title="Jezici" columns={1}>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Jezici sajta</legend>
          <div className="flex flex-wrap gap-2">
            {CORE_LANGUAGES.map((code) => {
              const checkboxId = id(`lang-${code}`);
              const checked = draft.languages.includes(code);
              return (
                <label
                  key={code}
                  htmlFor={checkboxId}
                  className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border px-2.5 text-sm transition-colors duration-150 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5 max-md:h-11"
                >
                  <Checkbox
                    id={checkboxId}
                    checked={checked}
                    onCheckedChange={(next) =>
                      set(
                        "languages",
                        next === true
                          ? [...draft.languages, code]
                          : draft.languages.filter((item) => item !== code),
                      )
                    }
                  />
                  {L10N_LABEL[code]}
                </label>
              );
            })}
          </div>
        </fieldset>
        <FieldShell
          id={id("languages")}
          label="Drugi jezici"
          hint={
            otherCodes(draft.otherLanguages).length > 0 && errors.languages === undefined
              ? otherCodes(draft.otherLanguages).map(languageName).join(", ")
              : "Dvoslovni kodovi, odvojeni zarezom: it, fr, hu."
          }
          error={errors.languages}
        >
          <Input
            {...fieldProps("languages", true)}
            value={draft.otherLanguages}
            maxLength={60}
            autoComplete="off"
            spellCheck={false}
            className="sm:max-w-xs"
            onChange={(event) => set("otherLanguages", event.target.value)}
          />
        </FieldShell>
      </FormSection>

      <FormSection title="Kontakt" description="Kanali na profilu i kartici nekretnine. Prazno polje se ne prikazuje.">
        <FieldShell id={id("phone")} label="Telefon" hint={PHONE_HINT} error={errors.phone}>
          <Input
            {...fieldProps("phone", true)}
            type="tel"
            inputMode="tel"
            value={draft.phone}
            maxLength={24}
            onChange={(event) => set("phone", event.target.value)}
          />
        </FieldShell>
        <FieldShell id={id("email")} label="E-adresa" error={errors.email}>
          <Input
            {...fieldProps("email", false)}
            type="email"
            inputMode="email"
            value={draft.email}
            maxLength={254}
            spellCheck={false}
            onChange={(event) => set("email", event.target.value)}
          />
        </FieldShell>
        <FieldShell
          id={id("viber")}
          label="Viber"
          hint={errors.viber === undefined ? "Broj telefona za Viber." : undefined}
          error={errors.viber}
          labelAside={
            draft.phone.trim().length > 0 && draft.viber !== draft.phone ? (
              <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => set("viber", draft.phone)}>
                Isti kao telefon
              </Button>
            ) : undefined
          }
        >
          <Input
            {...fieldProps("viber", errors.viber === undefined)}
            type="tel"
            inputMode="tel"
            value={draft.viber}
            maxLength={24}
            onChange={(event) => set("viber", event.target.value)}
          />
        </FieldShell>
        <FieldShell
          id={id("whatsapp")}
          label="WhatsApp"
          hint={errors.whatsapp === undefined ? "Broj telefona za WhatsApp." : undefined}
          error={errors.whatsapp}
          labelAside={
            draft.phone.trim().length > 0 && draft.whatsapp !== draft.phone ? (
              <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => set("whatsapp", draft.phone)}>
                Isti kao telefon
              </Button>
            ) : undefined
          }
        >
          <Input
            {...fieldProps("whatsapp", errors.whatsapp === undefined)}
            type="tel"
            inputMode="tel"
            value={draft.whatsapp}
            maxLength={24}
            onChange={(event) => set("whatsapp", event.target.value)}
          />
        </FieldShell>
      </FormSection>

      <FormSection title="Oblasti" columns={1} description="Opštine i naselja koje agent pokriva; prikazuju se na profilu.">
        <FieldShell id={id("areas")} label="Oblasti rada" hint="Do 20 lokacija.">
          <AreasPicker
            id={id("areas")}
            value={draft.areas}
            onChange={(next) => set("areas", next)}
            describedBy={`${id("areas")}-hint`}
          />
        </FieldShell>
      </FormSection>

      {agent !== undefined ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarClock className="size-4 shrink-0" aria-hidden="true" />
          Radno vreme za razgledanja uređujete u{" "}
          <Link
            href={`/admin/razgledanja?view=availability&agent=${agent._id}`}
            className="font-medium text-foreground underline underline-offset-4"
          >
            Razgledanjima
          </Link>
          .
        </p>
      ) : null}

      <div className="sticky bottom-0 z-10 -mx-5 -mb-5 flex flex-wrap items-center gap-2 border-t bg-background/95 px-5 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        {agent !== undefined ? (
          <ConfirmDialog
            trigger={
              <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" data-testid="agent-delete">
                <Trash2 aria-hidden="true" />
                Obrišite profil
              </Button>
            }
            title={`Obrisati profil ${agent.name}?`}
            description="Brisanje je trajno. Profil sa nekretninama, upitima ili razgledanjima, ili povezan sa aktivnim nalogom, ne može se obrisati; takav profil samo sakrijte sa sajta."
            confirmLabel="Obrišite"
            destructive
            onConfirm={async () => {
              const done = await remove.run({ id: agent._id });
              if (done === undefined) return false;
              onDirtyChange(false);
              onClose();
              return true;
            }}
          />
        ) : null}
        <p className="mr-auto text-xs text-muted-foreground" aria-live="polite">
          {upsert.pending ? "Čuvanje…" : dirty ? "Imate nesačuvane izmene." : agent !== undefined ? "Sve izmene su sačuvane." : ""}
        </p>
        <Button type="button" variant="outline" onClick={onRequestClose} disabled={upsert.pending}>
          Zatvorite
        </Button>
        <Button type="submit" disabled={!dirty || upsert.pending} data-testid="save-button">
          {upsert.pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          {agent === undefined ? "Napravite profil" : "Sačuvajte"}
        </Button>
      </div>
    </form>
  );
}
