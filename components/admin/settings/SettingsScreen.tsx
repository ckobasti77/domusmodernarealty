"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "convex/react";
import { Info, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { FormProvider, useController, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { FormSection, SaveBar } from "@/components/admin/common/form";
import { ImageField } from "@/components/admin/common/ImageField";
import { PageHeader } from "@/components/admin/common/PageHeader";
import { QueryErrorBoundary } from "@/components/admin/common/QueryErrorBoundary";
import { RequireRole } from "@/components/admin/common/RequireRole";
import { ADMIN_ROLES } from "@/components/admin/shell/me";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { formatDateTime } from "@/lib/admin/format";
import { adminErrorMessage } from "@/lib/admin/errors";
import { L10nField, TextField } from "./fields";
import { LeaveGuard } from "./LeaveGuard";
import { OfficeHoursField } from "./OfficeHoursField";
import { PdfField } from "./PdfField";
import { PhonesField } from "./PhonesField";
import {
  COMMISSION_MAX,
  isPlaceholder,
  pibChecksumOk,
  SEO_DESCRIPTION_MAX,
  SEO_DESCRIPTION_SOFT,
  SEO_TITLE_MAX,
  SEO_TITLE_SOFT,
  settingsSchema,
  SOCIALS,
  toForm,
  toPatch,
  type SettingsData,
  type SettingsForm,
} from "./schema";

const FORM_ID = "settings-form";

/** `/admin/podesavanja` — agency settings (PRD B11). Admin only. */
export function SettingsScreen() {
  return (
    <RequireRole roles={ADMIN_ROLES}>
      <PageHeader
        title="Podešavanja agencije"
        description="Pravni podaci, kontakt, tekstovi i podrazumevane vrednosti koje sajt prikazuje na svakoj stranici."
      />
      <QueryErrorBoundary backHref="/admin" backLabel="Kontrolna tabla">
        <SettingsLoader />
      </QueryErrorBoundary>
    </RequireRole>
  );
}

function SettingsLoader() {
  const data = useQuery(api.settingsAdmin.get, {});
  if (data === undefined) {
    return (
      <div aria-busy="true" className="flex max-w-4xl flex-col gap-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-48 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  if (data === null) {
    return (
      <p className="max-w-xl rounded-lg border bg-card p-6 text-sm text-muted-foreground">
        Podešavanja još nisu kreirana. Pokrenite početni seed (<code className="font-mono">npx convex run seed:run</code>)
        pa osvežite stranicu.
      </p>
    );
  }
  return <SettingsEditor data={data} />;
}

function SettingsEditor({ data }: { data: SettingsData }) {
  const update = useMutation(api.settingsAdmin.update);
  const serverValues = useMemo(() => toForm(data), [data]);
  const baseline = useRef(serverValues);

  const form = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: serverValues,
    mode: "onTouched",
  });
  const { isDirty, isSubmitting } = form.formState;

  // Another admin's save (or this one's, normalized by the server) arrives
  // here; adopt it unless there is unsaved work in the form.
  useEffect(() => {
    if (form.formState.isDirty) return;
    baseline.current = serverValues;
    form.reset(serverValues);
  }, [serverValues, form]);

  const save = async (values: SettingsForm) => {
    const patch = toPatch(values, baseline.current);
    if (Object.keys(patch).length === 0) {
      form.reset(values);
      return;
    }
    try {
      const result = await update({ patch });
      baseline.current = values;
      form.reset(values);
      if (result.changed === 0) toast.success("Nije bilo izmena za čuvanje.");
      else if (result.isDemo) toast.success("Podešavanja su sačuvana. Podaci agencije su i dalje probni.");
      else toast.success("Podešavanja su sačuvana.");
    } catch (error) {
      toast.error(adminErrorMessage(error, "Podešavanja nisu sačuvana."));
    }
  };

  return (
    <FormProvider {...form}>
      <form
        id={FORM_ID}
        data-testid="settings-form"
        noValidate
        onSubmit={(event) =>
          void form.handleSubmit(save, () =>
            toast.error("Neka polja nisu ispravno popunjena. Pogledajte označena polja."),
          )(event)
        }
        className="flex max-w-4xl flex-col gap-4"
      >
        {data.settings.isDemo ? <DemoNotice /> : null}
        <LegalSection />
        <ContactSection />
        <HoursSection />
        <SocialSection />
        <CommissionSection data={data} />
        <MoneySection />
        <SeoSection data={data} />
        <AnalyticsSection />
      </form>
      <SaveBar
        form={FORM_ID}
        dirty={isDirty}
        saving={isSubmitting}
        onReset={() => form.reset(baseline.current)}
        extra={`Poslednja izmena: ${formatDateTime(data.settings.updatedAt)}`}
      />
      <LeaveGuard dirty={isDirty} />
    </FormProvider>
  );
}

function DemoNotice() {
  return (
    <div
      role="status"
      data-testid="settings-demo-notice"
      className="flex gap-3 rounded-xl border border-[color-mix(in_oklab,var(--color-warning)_40%,transparent)] bg-[color-mix(in_oklab,var(--color-warning)_10%,transparent)] p-4 text-sm"
    >
      <TriangleAlert
        className="mt-0.5 size-4 shrink-0 text-[var(--color-warning-text)] dark:text-[var(--color-warning)]"
        aria-hidden="true"
      />
      <div className="space-y-1">
        <p className="font-medium">Podaci agencije su još probni.</p>
        <p className="text-muted-foreground">
          PIB, matični broj i broj iz Registra posrednika još imaju demo vrednosti (nule) i takvi se prikazuju na
          svakom oglasu. Kada unesete i sačuvate prave vrednosti, sajt prestaje da bude u demo režimu, a objava
          oglasa od tada zahteva važeći broj iz Registra posrednika.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- sections */

function LegalSection() {
  const [pib, mb, registryNo] = useWatch<SettingsForm, ["pib", "mb", "registryNo"]>({
    name: ["pib", "mb", "registryNo"],
  });
  const pibClean = pib.replace(/\s/g, "");
  const placeholderHint = "Probna vrednost — unesite pravi broj.";
  const pibHint = isPlaceholder(pibClean)
    ? placeholderHint
    : /^\d{9}$/.test(pibClean) && !pibChecksumOk(pibClean)
      ? "Kontrolna cifra ne odgovara — proverite da li je PIB tačno prepisan."
      : "9 cifara, bez razmaka.";

  return (
    <FormSection
      title="Pravni podaci agencije"
      description="Prikazuju se u podnožju svake stranice, na svakom oglasu i u pravnim tekstovima (Zakon o trgovini, čl. 6; Zakon o posredovanju u prometu i zakupu nepokretnosti, čl. 18)."
    >
      <TextField
        name="companyName"
        label="Naziv agencije (brend)"
        hint="Ime koje posetioci vide na sajtu."
        autoComplete="organization"
        testId="settings-company-name"
      />
      <TextField name="legalName" label="Poslovno ime" hint="Tačno kao u APR-u, npr. „… d.o.o. Beograd”." />
      <TextField name="address" label="Adresa sedišta" wide autoComplete="street-address" />
      <TextField name="pib" label="PIB" inputMode="numeric" maxLength={11} autoComplete="off" hint={pibHint} />
      <TextField
        name="mb"
        label="Matični broj"
        inputMode="numeric"
        maxLength={10}
        autoComplete="off"
        hint={isPlaceholder(mb) ? placeholderHint : "8 cifara."}
      />
      <TextField
        name="registryNo"
        label="Broj upisa u Registar posrednika"
        autoComplete="off"
        testId="settings-registry-no"
        hint={
          isPlaceholder(registryNo)
            ? `${placeholderHint} Zakon (čl. 18) traži da svaki oglas sadrži poslovno ime posrednika i ovaj broj.`
            : "Zakon o posredovanju (čl. 18) traži da svaki oglas sadrži poslovno ime posrednika i broj upisa u Registar posrednika; sajt ga prikazuje uz svaki oglas."
        }
      />
      <TextField
        name="insurance"
        label="Osiguranje od profesionalne odgovornosti"
        hint="Osiguravač i broj polise; prikazuje se u podnožju sajta. Opciono."
      />
    </FormSection>
  );
}

function ContactSection() {
  return (
    <FormSection title="Kontakt" description="Kanali za posetioce sajta i lokacija kancelarije na mapi.">
      <PhonesField />
      <TextField name="email" label="E-pošta" type="email" autoComplete="email" inputMode="email" />
      <div className="hidden @lg:block" aria-hidden="true" />
      <TextField name="viber" label="Viber" type="tel" inputMode="tel" placeholder="+381 60 123 4567" hint="Opciono." />
      <TextField
        name="whatsapp"
        label="WhatsApp"
        type="tel"
        inputMode="tel"
        placeholder="+381 60 123 4567"
        hint="Opciono."
      />
      <TextField
        name="officeLat"
        label="Geografska širina kancelarije"
        inputMode="decimal"
        placeholder="44,8125"
        hint="Pin kancelarije na mapi. Ostavite oba polja prazna ako ne želite pin."
      />
      <TextField name="officeLng" label="Geografska dužina kancelarije" inputMode="decimal" placeholder="20,4612" />
    </FormSection>
  );
}

function HoursSection() {
  return (
    <FormSection title="Radno vreme" description="Kada je kancelarija otvorena za stranke." columns={1}>
      <OfficeHoursField />
    </FormSection>
  );
}

function SocialSection() {
  return (
    <FormSection title="Društvene mreže" description="Pune adrese profila (https://…). Prazno polje sakriva ikonicu na sajtu.">
      {SOCIALS.map((social) => (
        <TextField
          key={social.key}
          name={`socials.${social.key}`}
          label={social.label}
          type="url"
          inputMode="url"
          autoComplete="url"
          placeholder={social.example}
        />
      ))}
    </FormSection>
  );
}

function CommissionSection({ data }: { data: SettingsData }) {
  const { field } = useController<SettingsForm, "termsPdf">({ name: "termsPdf" });
  return (
    <FormSection
      title="Provizija i opšti uslovi"
      description="Tekst o proviziji prikazuje se u podnožju sajta i na oglasima koji nemaju svoj; opšti uslovi poslovanja su dokument koji nalogodavac dobija pre potpisivanja ugovora."
      columns={1}
    >
      <L10nField
        name="commissionText"
        label="Tekst o proviziji"
        multiline
        rows={4}
        maxLength={COMMISSION_MAX}
        hint="Na primer: „Provizija agencije je 2 % od kupoprodajne cene, plaća je kupac.”"
      />
      <PdfField
        label="Opšti uslovi poslovanja (PDF)"
        hint="Samo PDF, najviše 15 MB. Stari dokument se briše kada sačuvate novi."
        value={field.value}
        savedId={data.settings.termsPdf ?? null}
        savedUrl={data.termsPdfUrl}
        savedBytes={data.termsPdfBytes}
        onChange={field.onChange}
      />
    </FormSection>
  );
}

function MoneySection() {
  return (
    <FormSection
      title="Kalkulator kredita i kurs"
      description="Početne vrednosti kalkulatora na oglasima (posetilac ih menja) i kurs za približan iznos u dinarima."
      columns={3}
    >
      <TextField name="mortgage.rate" label="Kamatna stopa (%)" inputMode="decimal" placeholder="5,4" />
      <TextField name="mortgage.years" label="Rok otplate (godina)" inputMode="numeric" placeholder="25" />
      <TextField name="mortgage.downPct" label="Učešće (%)" inputMode="decimal" placeholder="20" />
      <TextField
        name="eurRsd"
        label="Kurs EUR → RSD"
        inputMode="decimal"
        placeholder="117,2"
        testId="settings-eur-rsd"
        hint="Srednji kurs NBS; iznos u dinarima na oglasu je informativan."
      />
    </FormSection>
  );
}

function SeoSection({ data }: { data: SettingsData }) {
  const { field } = useController<SettingsForm, "seo.ogImage">({ name: "seo.ogImage" });
  return (
    <FormSection
      title="Podrazumevani SEO"
      description="Koristi se za stranice koje nemaju svoj naslov i opis za pretraživače, i kao slika pri deljenju linka."
      columns={1}
    >
      <L10nField
        name="seo.defaultTitle"
        label="Naslov"
        maxLength={SEO_TITLE_MAX}
        counter={{ soft: SEO_TITLE_SOFT, max: SEO_TITLE_MAX }}
      />
      <L10nField
        name="seo.defaultDescription"
        label="Opis"
        multiline
        rows={3}
        maxLength={SEO_DESCRIPTION_MAX}
        counter={{ soft: SEO_DESCRIPTION_SOFT, max: SEO_DESCRIPTION_MAX }}
      />
      <ImageField
        label="Slika za deljenje (OG)"
        value={field.value ?? undefined}
        previewUrl={data.ogImageUrl}
        onChange={(next) => field.onChange(next ?? null)}
        aspect="og"
        hint="1200 × 630 px, JPEG ili WebP. Prikazuje se kada se link ka sajtu podeli na mrežama i u porukama."
        className="max-w-xl"
      />
    </FormSection>
  );
}

function AnalyticsSection() {
  return (
    <FormSection
      title="Analitika i oglašavanje"
      description={
        <span className="flex gap-1.5">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            Skripte se učitavaju tek kada posetilac u traci o kolačićima pristane na analitičke (Plausible, Google
            Analytics) odnosno marketinške kolačiće (Meta Pixel). Prazno polje isključuje servis.
          </span>
        </span>
      }
      columns={3}
    >
      <TextField
        name="analytics.plausibleDomain"
        label="Plausible domen"
        placeholder="mihajlo-estate.rs"
        autoComplete="off"
        spellCheck={false}
      />
      <TextField name="analytics.ga4Id" label="Google Analytics 4 ID" placeholder="G-XXXXXXX" autoComplete="off" spellCheck={false} />
      <TextField
        name="analytics.metaPixelId"
        label="Meta Pixel ID"
        inputMode="numeric"
        placeholder="123456789012345"
        autoComplete="off"
      />
    </FormSection>
  );
}
