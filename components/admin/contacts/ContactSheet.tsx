"use client";

import { useMutation, useQuery } from "convex/react";
import { Loader2, UserX } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { ConfirmDialog } from "@/components/admin/common/ConfirmDialog";
import { DetailSheet, FactList, SheetSection } from "@/components/admin/common/DetailSheet";
import { DotBadge } from "@/components/admin/common/StatusBadge";
import { useMutationAction } from "@/components/admin/common/useMutationAction";
import { LeadStatusBadge } from "@/components/admin/leads/cells";
import { LOCALE_LABEL, telHref } from "@/components/admin/leads/shared";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatDate, formatDateTime } from "@/lib/admin/format";
import { LEAD_TYPE_LABEL } from "@/lib/admin/labels";
import { ContactTags, MarketingBadge } from "./ContactBits";
import { MergeDialog } from "./MergeDialog";
import type { ContactDetail } from "./shared";

/** E-mail and phone values read as links at rest, not only on hover. */
const VALUE_LINK =
  "text-primary underline decoration-primary/30 underline-offset-4 transition-colors duration-150 hover:decoration-primary";

/**
 * One contact (PRD B6): details, internal note, lead history, every consent
 * record, merge a duplicate, and the ZZPL erasure ("Anonimizuj").
 */
/** `id` is the raw `?id=`; the server answers `null` for an unknown id. */
export function ContactSheet({ id, onClose }: { id: string | undefined; onClose: () => void }) {
  const data = useQuery(api.contacts.get, id === undefined ? "skip" : { id });
  const contact = data?.contact;
  const anonymized = contact?.anonymizedAt !== undefined;
  const anonymize = useMutationAction(useMutation(api.contacts.anonymize), "Kontakt je anonimizovan.");

  return (
    <DetailSheet
      open={id !== undefined}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      testId="contact-sheet"
      width="lg"
      title={contact?.name ?? (data === null ? "Kontakt nije pronađen" : "Kontakt")}
      description={contact !== undefined ? `U evidenciji od ${formatDate(contact.createdAt)}` : undefined}
      meta={
        contact !== undefined ? (
          <>
            <ContactTags contact={contact} />
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              Marketing: <MarketingBadge marketing={contact.marketing} />
            </span>
          </>
        ) : undefined
      }
      footer={
        contact !== undefined && !anonymized ? (
          <>
            {/* Irreversible, so it stays out of the primary slot: a quiet button on the far left. */}
            <ConfirmDialog
              destructive
              title="Anonimizovati kontakt?"
              description="Ime, e-pošta, telefon, beleške, poruke i odgovori iz formi biće trajno obrisani. Upiti ostaju u statistici bez ličnih podataka. Ovo se ne može poništiti."
              confirmLabel="Anonimizuj"
              onConfirm={async () => {
                const result = await anonymize.run({ id: contact._id });
                return result !== undefined;
              }}
              trigger={
                <Button
                  variant="ghost"
                  data-testid="contact-anonymize"
                  disabled={anonymize.pending}
                  className="mr-auto text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20"
                >
                  {anonymize.pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <UserX aria-hidden="true" />}
                  Anonimizuj
                </Button>
              }
            />
            <MergeDialog into={contact} />
          </>
        ) : undefined
      }
    >
      {data === undefined ? (
        <div aria-busy="true" aria-label="Kontakt se učitava" className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : data === null ? (
        <p className="text-sm text-muted-foreground">Kontakt ne postoji. Možda je spojen sa drugim kontaktom.</p>
      ) : (
        <ContactBody key={data.contact._id} data={data} />
      )}
    </DetailSheet>
  );
}

function ContactBody({ data }: { data: ContactDetail }) {
  const { contact } = data;
  const anonymized = contact.anonymizedAt !== undefined;

  return (
    <div>
      {anonymized ? (
        <p role="status" className="mb-5 rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          Anonimizovano {formatDateTime(contact.anonymizedAt ?? contact.createdAt)}. Lični podaci su obrisani;
          upiti ostaju samo kao statistika.
        </p>
      ) : null}

      <SheetSection title="Podaci">
        <FactList
          items={[
            { label: "Ime", value: contact.name },
            {
              label: "E-pošta",
              value:
                contact.email !== undefined ? (
                  <a href={`mailto:${contact.email}`} className={VALUE_LINK}>
                    {contact.email}
                  </a>
                ) : (
                  "—"
                ),
            },
            {
              label: "Telefon",
              value:
                contact.phone !== undefined ? (
                  <a href={telHref(contact.phone)} className={`tabular-nums ${VALUE_LINK}`}>
                    {contact.phone}
                  </a>
                ) : (
                  "—"
                ),
            },
            { label: "Jezik", value: contact.locale !== undefined ? LOCALE_LABEL[contact.locale] : "—" },
            { label: "Oznake", value: contact.tags.length > 0 ? contact.tags.join(", ") : "—" },
            { label: "Poslednja aktivnost", value: formatDateTime(contact.lastActivityAt) },
          ]}
        />
      </SheetSection>

      {!anonymized ? <NoteSection contactId={contact._id} note={data.note} /> : null}

      <SheetSection title={`Upiti (${data.leads.length}${data.leadsCapped ? "+" : ""})`}>
        {data.leads.length === 0 ? (
          <p className="text-sm text-muted-foreground">Kontakt nema upita (npr. vlasnik unet uz nekretninu).</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {data.leads.map((lead) => (
              <li key={lead._id}>
                <Link
                  href={`/admin/upiti?id=${lead._id}`}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm transition-colors duration-150 outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="min-w-0">
                    <span className="block font-medium">
                      {LEAD_TYPE_LABEL[lead.type]}
                      {lead.listingRef !== undefined ? (
                        <span className="font-mono text-xs text-muted-foreground">{` · ${lead.listingRef}`}</span>
                      ) : null}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {formatDateTime(lead.createdAt)}
                      {lead.agentName !== undefined ? ` · ${lead.agentName}` : ""}
                    </span>
                  </span>
                  <LeadStatusBadge status={lead.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SheetSection>

      <SheetSection title="Saglasnosti">
        {data.consents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nema zabeleženih saglasnosti.</p>
        ) : (
          <ul className="space-y-2">
            {data.consents.map((consent, index) => (
              <li key={`${consent.at}-${index}`} className="rounded-md border px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium tabular-nums">{formatDateTime(consent.at)}</span>
                  <span className="font-mono text-xs text-muted-foreground">{consent.textVersion}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <span className="inline-flex items-center gap-1.5">
                    Obrada podataka:
                    <DotBadge tone={consent.privacy ? "success" : "muted"}>{consent.privacy ? "Da" : "Ne"}</DotBadge>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    Marketing:
                    <MarketingBadge marketing={consent.marketing} />
                  </span>
                  <span className="text-muted-foreground">Kanal: {consent.channel ?? "—"}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SheetSection>
    </div>
  );
}

function NoteSection({ contactId, note }: { contactId: Id<"contacts">; note: string | undefined }) {
  const id = useId();
  const server = note ?? "";
  const [value, setValue] = useState(server);
  const [synced, setSynced] = useState(server);
  if (server !== synced) {
    setSynced(server);
    setValue(server);
  }
  const save = useMutationAction(useMutation(api.contacts.setNote), "Beleška je sačuvana.");
  const dirty = value.trim() !== server.trim();

  return (
    <SheetSection title="Interna beleška">
      <form
        className="grid gap-2"
        onSubmit={async (event) => {
          event.preventDefault();
          await save.run({ id: contactId, note: value });
        }}
      >
        <Label htmlFor={id} className="sr-only">
          Interna beleška o kontaktu
        </Label>
        <Textarea
          id={id}
          data-testid="contact-note-input"
          value={value}
          maxLength={4000}
          rows={3}
          placeholder="Vidljivo samo timu. Ne upisujte podatke koji nisu potrebni za posao."
          onChange={(event) => setValue(event.target.value)}
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={!dirty || save.pending}>
            {save.pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Sačuvaj belešku
          </Button>
        </div>
      </form>
    </SheetSection>
  );
}
