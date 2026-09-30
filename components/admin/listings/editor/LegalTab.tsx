"use client";

import { useMutation } from "convex/react";
import { Loader2, Lock, Scale } from "lucide-react";
import { useState } from "react";
import { useController, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import { adminErrorMessage } from "@/lib/admin/errors";
import { formatDate, fromDateInput } from "@/lib/admin/format";
import { LEGALIZATION_LABEL, MANDATE_TYPE_LABEL, REGISTRATION_LABEL } from "@/lib/admin/labels";
import { daysUntil, mandateIsEmpty, mandateOut, type ListingForm } from "@/lib/admin/listing-form";
import { cn } from "@/lib/utils";
import { useEditor, type EditorData } from "./editor-context";
import { DateField, Field, Group, SelectField, TabPanel, TextAreaField, TextField, TriStateField, optionsOf } from "./fields";

const REGISTRATION_OPTIONS = optionsOf(REGISTRATION_LABEL);
const LEGALIZATION_OPTIONS = optionsOf(LEGALIZATION_LABEL);
const MANDATE_OPTIONS = optionsOf(MANDATE_TYPE_LABEL);

function dana(count: number): string {
  const n = Math.abs(count);
  return n % 10 === 1 && n % 100 !== 11 ? "dan" : "dana";
}

export function LegalTab({ data }: { data: EditorData }) {
  return (
    <TabPanel
      id="panel-pravno"
      title="Pravno"
      description="Pravni status nekretnine, ugovor o posredovanju i vlasnik. Ugovor i vlasnik se nikada ne prikazuju na sajtu."
    >
      <MandateGroup />
      <Group title="Pravni status" description="Uknjiženost, legalizacija, dozvola, udeo i teret prikazuju se na oglasu.">
        <SelectField name="legal.registration" id="f-legal-registration" label="Uknjiženost" options={REGISTRATION_OPTIONS} />
        <SelectField name="legal.legalization" id="f-legal-legalization" label="Legalizacija" options={LEGALIZATION_OPTIONS} />
        <TriStateField
          name="legal.occupancyPermit"
          id="f-legal-occupancyPermit"
          label="Upotrebna dozvola"
          yesLabel="Ima"
          noLabel="Nema"
          hint="„Nije navedeno” izostavlja red sa oglasa."
        />
        <TextField
          name="legal.ownershipShare"
          id="f-legal-ownershipShare"
          label="Udeo u vlasništvu"
          placeholder="npr. 1/1"
          autoComplete="off"
        />
        <TextAreaField
          name="legal.encumbrance"
          id="f-legal-encumbrance"
          label="Teret / hipoteka"
          rows={3}
          counter={{ max: 1000 }}
          className="@lg:col-span-2 @3xl:col-span-3"
          hint="Prikazuje se na oglasu. Prazno polje na sajtu znači „Bez upisanog tereta”."
        />
      </Group>
      <DocsVerifiedGroup data={data} />
      <OwnerGroup data={data} />
    </TabPanel>
  );
}

function MandateGroup() {
  const { now } = useEditor();
  const mandate = useWatch<ListingForm, "mandate">({ name: "mandate" });
  const end = fromDateInput(mandate.end);
  const days = end !== undefined ? daysUntil(end, now) : null;
  const complete = mandateOut(mandate) !== undefined;
  const empty = mandateIsEmpty(mandate);

  const expiry =
    days === null ? null : (
      <span
        className={cn(
          "text-xs font-medium tabular-nums",
          days < 0 ? "text-destructive" : days <= 14 ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground",
        )}
      >
        {days < 0
          ? `Istekao pre ${-days} ${dana(days)}`
          : days === 0
            ? "Ističe danas"
            : `Ističe za ${days} ${dana(days)}`}
      </span>
    );

  return (
    <Group
      important
      title="Ugovor o posredovanju"
      description={
        <span className="flex items-start gap-2">
          <Scale aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <span>
            Obavezan za objavu. Zakon o posredovanju u prometu i zakupu nepokretnosti (čl. 18) dozvoljava oglašavanje
            samo uz zaključen ugovor o posredovanju: bez unetog i važećeg ugovora objava je blokirana. Ugovor se ne
            prikazuje na sajtu.
          </span>
        </span>
      }
    >
      <TextField name="mandate.number" id="f-mandate-number" label="Broj ugovora" autoComplete="off" />
      <SelectField name="mandate.type" id="f-mandate-type" label="Vrsta ugovora" options={MANDATE_OPTIONS} />
      <div className="hidden @3xl:block" aria-hidden="true" />
      <DateField name="mandate.start" id="f-mandate-start" label="Početak" deps={["mandate.end"]} />
      <DateField name="mandate.end" id="f-mandate-end" label="Kraj" deps={["mandate.start"]} labelAside={expiry} />
      {days !== null && days >= 0 && days <= 14 ? (
        <p className="text-xs text-amber-800 @lg:col-span-2 @3xl:col-span-3 dark:text-amber-300">
          Ugovor uskoro ističe. Po isteku oglas više ne ispunjava uslove za objavu; produžite ugovor na vreme.
        </p>
      ) : null}
      {!complete && !empty ? (
        <p className="text-xs text-muted-foreground @lg:col-span-2 @3xl:col-span-3">
          Ugovor se čuva kada unesete broj, početak i kraj.
        </p>
      ) : null}
    </Group>
  );
}

function DocsVerifiedGroup({ data }: { data: EditorData }) {
  const { field } = useController<ListingForm, "legal.docsVerifiedAt">({ name: "legal.docsVerifiedAt" });
  const value = field.value;
  const saved = data.listing.legal.docsVerifiedAt;
  const status =
    value === null
      ? "Označite kada proverite list nepokretnosti i dokaze o vlasništvu (čl. 16 Zakona o posredovanju). Oglas tada dobija oznaku o proverenoj dokumentaciji."
      : value !== saved
        ? `Biće zabeleženo na Vaše ime · ${formatDate(value)}`
        : data.docsVerifiedByName !== undefined
          ? `Proverio: ${data.docsVerifiedByName} · ${formatDate(value)}`
          : `Provereno ${formatDate(value)}`;
  return (
    <Group title="Provera dokumentacije" layout="stack">
      <div className="flex items-start gap-3">
        <Checkbox
          id="f-legal-docsVerified"
          checked={value !== null}
          onCheckedChange={(checked) => field.onChange(checked === true ? Date.now() : null)}
          onBlur={field.onBlur}
          aria-describedby="f-legal-docsVerified-hint"
          className="mt-0.5"
        />
        <div className="grid gap-1">
          <Label htmlFor="f-legal-docsVerified">Dokumentacija proverena</Label>
          <p id="f-legal-docsVerified-hint" className="text-xs text-muted-foreground">
            {status}
          </p>
        </div>
      </div>
    </Group>
  );
}

/** The seller's private contact. Saved with its own button through `setOwner`, never autosaved. */
function OwnerGroup({ data }: { data: EditorData }) {
  const setOwner = useMutation(api.listingsAdmin.setOwner);
  const [name, setName] = useState(data.owner?.name ?? "");
  const [phone, setPhone] = useState(data.owner?.phone ?? "");
  const [email, setEmail] = useState(data.owner?.email ?? "");
  const [pending, setPending] = useState(false);
  const changed =
    name !== (data.owner?.name ?? "") || phone !== (data.owner?.phone ?? "") || email !== (data.owner?.email ?? "");

  const save = async () => {
    setPending(true);
    try {
      await setOwner({
        id: data.listing._id,
        name,
        ...(phone.trim() !== "" ? { phone: phone.trim() } : {}),
        ...(email.trim() !== "" ? { email: email.trim() } : {}),
      });
      toast.success(name.trim() === "" ? "Vlasnik je uklonjen sa nekretnine." : "Podaci o vlasniku su sačuvani.");
    } catch (error) {
      toast.error(adminErrorMessage(error, "Podaci o vlasniku nisu sačuvani."));
    } finally {
      setPending(false);
    }
  };

  return (
    <Group
      title="Vlasnik"
      description={
        <span className="flex items-start gap-2">
          <Lock aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span>Privatni kontakt prodavca, samo za tim. Nikada se ne prikazuje na sajtu. Čuva se posebnim dugmetom.</span>
        </span>
      }
    >
      <Field id="f-owner-name" label="Ime i prezime">
        <Input id="f-owner-name" value={name} autoComplete="off" onChange={(event) => setName(event.target.value)} />
      </Field>
      <Field id="f-owner-phone" label="Telefon">
        <Input
          id="f-owner-phone"
          type="tel"
          inputMode="tel"
          value={phone}
          autoComplete="off"
          onChange={(event) => setPhone(event.target.value)}
        />
      </Field>
      <Field id="f-owner-email" label="E-pošta">
        <Input
          id="f-owner-email"
          type="email"
          value={email}
          autoComplete="off"
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3 @lg:col-span-2 @3xl:col-span-3">
        <Button type="button" onClick={() => void save()} disabled={!changed || pending}>
          {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
          Sačuvaj vlasnika
        </Button>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {changed ? "Izmene vlasnika još nisu sačuvane." : data.owner !== null ? "Sačuvano." : "Vlasnik nije unet."}{" "}
          Prazno ime uklanja vezu sa vlasnikom.
        </p>
      </div>
    </Group>
  );
}
