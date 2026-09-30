"use client";

import { useMutation, useQuery } from "convex/react";
import { Check, ChevronDown, CircleAlert, Copy, CopyPlus, ExternalLink, Link2, RefreshCw, TriangleAlert, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useWatch } from "react-hook-form";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/common/ConfirmDialog";
import { StatusBadge } from "@/components/admin/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "@/convex/_generated/api";
import { checklistBlockers, publishChecklist, type ChecklistItem } from "@/convex/lib/checklist";
import type { ListingStatus } from "@/convex/lib/validators";
import { adminErrorMessage, publishBlockers } from "@/lib/admin/errors";
import { formatDateTime } from "@/lib/admin/format";
import { STATUS_LABEL } from "@/lib/admin/labels";
import { checklistListing, type ChecklistFormFields, type ListingForm } from "@/lib/admin/listing-form";
import { cn } from "@/lib/utils";
import { useEditor, type EditorData } from "./editor-context";
import { PriceHistoryList } from "./PriceHistory";
import { isOnSite, publicPath, usePreviewLink } from "./preview";

type ActionKey = "publish" | "review" | "draft" | "reserve" | "sold" | "archive" | "unpublish";

const ACTIONS: Record<ListingStatus, readonly ActionKey[]> = {
  draft: ["publish", "review", "archive"],
  review: ["publish", "draft"],
  published: ["reserve", "sold", "unpublish"],
  reserved: ["publish", "sold", "unpublish"],
  sold: ["publish", "archive"],
  rented: ["publish", "archive"],
  withdrawn: ["publish", "draft", "archive"],
  archived: ["draft"],
};

const CHECKLIST_FIELDS = [
  "mandate",
  "price",
  "cityId",
  "location",
  "areaM2",
  "rooms",
  "title",
  "description",
  "slug",
  "propertyType",
  "agentId",
] as const;

/** The publish checklist over the unsaved form, so items turn green while typing. */
function useLiveChecklist(data: EditorData): ChecklistItem[] {
  const { now, canAssignAgent } = useEditor();
  const agents = useQuery(api.agentsAdmin.list, canAssignAgent ? {} : "skip");
  const watched = useWatch<ListingForm, typeof CHECKLIST_FIELDS>({ name: CHECKLIST_FIELDS });
  const [mandate, price, cityId, location, areaM2, rooms, title, description, slug, propertyType, agentId] = watched;
  const fields: ChecklistFormFields = { mandate, price, cityId, location, areaM2, rooms, title, description, slug, propertyType };
  const agentPublic =
    agentId === data.listing.agentId
      ? data.checklistContext.agentPublic
      : (agents?.find((agent) => agent._id === agentId)?.isPublic ?? data.checklistContext.agentPublic);
  return publishChecklist(checklistListing(data.listing, fields), now, { ...data.checklistContext, agentPublic });
}

export function PublishPanel({ data }: { data: EditorData }) {
  const listing = data.listing;
  const items = useLiveChecklist(data);
  const blocking = items.filter((item) => item.warning !== true);
  const done = blocking.filter((item) => item.ok).length;
  const blockers = checklistBlockers(items);
  const [expanded, setExpanded] = useState(false);
  const [serverBlockers, setServerBlockers] = useState<string[]>([]);

  const onBlocked = (reasons: string[]) => {
    setServerBlockers(reasons);
    setExpanded(true);
  };

  return (
    <aside aria-labelledby="publish-title" className="rounded-xl border bg-card text-sm shadow-xs">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-3">
        <h2 id="publish-title" className="text-sm font-semibold">
          Objava
        </h2>
        <StatusBadge status={listing.status} />
        <span className="text-xs text-muted-foreground tabular-nums">
          {done}/{blocking.length} uslova
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto xl:hidden"
          aria-expanded={expanded}
          aria-controls="publish-details"
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? "Sakrij detalje" : "Prikaži detalje"}
          <ChevronDown aria-hidden="true" className={cn("transition-transform duration-150", expanded && "rotate-180")} />
        </Button>
      </div>

      <div className="flex flex-col gap-3 px-4 py-3">
        {listing.publishedAt !== undefined ? (
          <p className="text-xs text-muted-foreground">
            Prvi put objavljeno {formatDateTime(listing.publishedAt)}
            {isOnSite(listing) ? " · vidljivo na sajtu" : " · trenutno nije na sajtu"}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Još nije objavljeno.</p>
        )}
        <StatusActions data={data} blockers={blockers} onBlocked={onBlocked} />
      </div>

      <div id="publish-details" className={cn("border-t", expanded ? "block" : "hidden xl:block")}>
        <Checklist items={items} serverBlockers={serverBlockers} />
        <PreviewSection data={data} />
        <section aria-labelledby="price-history-title" className="border-t px-4 py-3">
          <h3 id="price-history-title" className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Istorija cene
          </h3>
          <PriceHistoryList items={data.priceHistory} limit={5} compact />
        </section>
        <DuplicateSection data={data} />
      </div>
    </aside>
  );
}

function Checklist({ items, serverBlockers }: { items: ChecklistItem[]; serverBlockers: string[] }) {
  // Server reasons the live list does not show as failing (e.g. an agent hidden meanwhile).
  const extra = serverBlockers.filter((reason) => !items.some((item) => item.label === reason && !item.ok));
  return (
    <section aria-labelledby="checklist-title" className="px-4 py-3">
      <h3 id="checklist-title" className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Uslovi za objavu
      </h3>
      <ul data-testid="publish-checklist" className="flex flex-col gap-1.5">
        {items.map((item) => {
          const flagged = !item.ok && serverBlockers.includes(item.label);
          return (
            <li
              key={item.code}
              data-testid={`check-${item.code}`}
              data-ok={item.ok ? "true" : "false"}
              className={cn(
                "flex items-start gap-2 rounded-md px-1.5 py-1 leading-snug",
                flagged && "bg-destructive/10",
              )}
            >
              {item.ok ? (
                <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
              ) : item.warning === true ? (
                <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              ) : (
                <X aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
              )}
              <span className={cn(item.ok ? "text-foreground" : item.warning === true ? "text-amber-900 dark:text-amber-200" : "text-foreground")}>
                <span className="sr-only">{item.ok ? "Ispunjeno: " : item.warning === true ? "Upozorenje: " : "Nije ispunjeno: "}</span>
                {item.label}
                {item.warning === true && !item.ok ? (
                  <span className="block text-xs text-muted-foreground">Ne blokira objavu.</span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
      {extra.length > 0 ? (
        <div role="alert" className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs">
          <p className="font-medium text-destructive">Server je odbio objavu:</p>
          <ul className="mt-1 list-disc pl-4">
            {extra.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

type ActionSpec = {
  label: string;
  testId: string;
  title: string;
  description: string;
  confirmLabel: string;
  variant: "default" | "outline" | "destructive";
  run: () => Promise<void>;
};

function StatusActions({
  data,
  blockers,
  onBlocked,
}: {
  data: EditorData;
  blockers: string[];
  onBlocked: (reasons: string[]) => void;
}) {
  const { engine, listingId } = useEditor();
  const publish = useMutation(api.listingsAdmin.publish);
  const setStatus = useMutation(api.listingsAdmin.setStatus);
  const unpublish = useMutation(api.listingsAdmin.unpublish);
  const listing = data.listing;
  const status = listing.status;
  const rent = listing.transaction === "rent";
  const closedStatus = rent ? "rented" : "sold";
  const soldLabel = STATUS_LABEL[closedStatus];

  const changeStatus = async (next: ListingStatus, message: string) => {
    await setStatus({ id: listingId, status: next });
    toast.success(message);
  };

  const spec: Record<ActionKey, ActionSpec> = {
    publish: {
      label: status === "draft" || status === "review" ? "Objavi" : "Objavi ponovo",
      testId: "action-publish",
      title: status === "draft" || status === "review" ? "Objaviti nekretninu?" : "Ponovo objaviti nekretninu?",
      description:
        status === "reserved"
          ? "Oznaka „Rezervisano” se uklanja; oglas ostaje u pretrazi i na mapi kao slobodna ponuda."
          : `${listing.ref} postaje javna: pojavljuje se u pretrazi, na mapi i na svojoj adresi, i prima upite i zahteve za razgledanje.`,
      confirmLabel: "Objavi",
      variant: "default",
      run: async () => {
        await publish({ id: listingId });
        toast.success(`Objavljeno — ${listing.ref} je vidljiva na sajtu.`, {
          action: {
            label: "Otvori oglas",
            onClick: () => window.open(publicPath(listing.slug), "_blank", "noopener"),
          },
        });
      },
    },
    review: {
      label: "Pošalji na pregled",
      testId: "action-review",
      title: "Poslati na pregled?",
      description: "Status postaje „Na pregledu”: oglas je spreman za proveru, a na sajtu se i dalje ne prikazuje.",
      confirmLabel: "Pošalji",
      variant: "outline",
      run: () => changeStatus("review", "Nekretnina je poslata na pregled."),
    },
    draft: {
      label: "Vrati u nacrt",
      testId: "action-draft",
      title: "Vratiti u nacrt?",
      description: "Nekretnina se vraća u nacrt: nije na sajtu, a vidljivost postaje „Privatna”.",
      confirmLabel: "Vrati u nacrt",
      variant: "outline",
      run: () => changeStatus("draft", "Nekretnina je vraćena u nacrt."),
    },
    reserve: {
      label: "Rezervisano",
      testId: "action-reserve",
      title: "Označiti kao rezervisano?",
      description: "Oglas ostaje u pretrazi i na mapi sa oznakom „Rezervisano”; upiti i dalje stižu.",
      confirmLabel: "Označi kao rezervisano",
      variant: "outline",
      run: () => changeStatus("reserved", "Nekretnina je označena kao rezervisana."),
    },
    sold: {
      label: soldLabel,
      testId: "action-sold",
      title: rent ? "Označiti kao izdato?" : "Označiti kao prodato?",
      description: `Oglas ostaje dostupan na svojoj adresi sa oznakom „${soldLabel}”, ali nestaje iz pretrage i sa mape i više ne prima upite ni zahteve za razgledanje.`,
      confirmLabel: `Označi: ${soldLabel.toLowerCase()}`,
      variant: "outline",
      run: () => changeStatus(closedStatus, `Nekretnina je označena: ${soldLabel.toLowerCase()}.`),
    },
    archive: {
      label: "Arhiviraj",
      testId: "action-archive",
      title: "Arhivirati nekretninu?",
      description: "Nekretnina se uklanja sa sajta i iz aktivnih lista; ostaje u panelu radi evidencije.",
      confirmLabel: "Arhiviraj",
      variant: "outline",
      run: () => changeStatus("archived", "Nekretnina je arhivirana."),
    },
    unpublish: {
      label: "Povuci sa sajta",
      testId: "action-unpublish",
      title: "Povući oglas sa sajta?",
      description:
        "Oglas se uklanja sa sajta: njegova adresa vraća 404, a nekretnina nestaje iz pretrage i sa mape. Kasnije je možete ponovo objaviti.",
      confirmLabel: "Povuci sa sajta",
      variant: "destructive",
      run: async () => {
        await unpublish({ id: listingId });
        toast.success("Oglas je povučen sa sajta.");
      },
    },
  };

  const execute = async (key: ActionKey) => {
    // Status changes act on the saved listing: land the pending edits first.
    const flushed = await engine.flush();
    if (!flushed.ok) {
      toast.error("Izmene nisu sačuvane, pa status nije promenjen. Pokušajte ponovo.");
      return;
    }
    if (key === "publish" && flushed.pending.length > 0) {
      toast.error("Neka polja imaju grešku i nisu sačuvana.", {
        description: "Ispravite označena polja (tačka na karticama), pa objavite.",
      });
      return;
    }
    try {
      await spec[key].run();
      if (key === "publish") onBlocked([]);
    } catch (error) {
      const reasons = publishBlockers(error);
      if (reasons !== null) {
        onBlocked(reasons);
        toast.error("Objava je blokirana", {
          description: (
            <ul className="mt-1 list-disc pl-4">
              {reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ),
        });
        return;
      }
      toast.error(adminErrorMessage(error, "Status nije promenjen."));
    }
  };

  const publishBlocked = blockers.length > 0;

  return (
    <div className="flex flex-wrap gap-2">
      {ACTIONS[status].map((key) => {
        const action = spec[key];
        const button = (
          <Button
            type="button"
            variant={action.variant}
            size="sm"
            data-testid={action.testId}
            disabled={key === "publish" && publishBlocked}
            className={cn(key === "publish" && "min-w-24")}
          >
            {action.label}
          </Button>
        );
        if (key === "publish" && publishBlocked) {
          return (
            <Tooltip key={key}>
              <TooltipTrigger asChild>
                {/* A disabled button gets no pointer or focus events: the wrapper carries the tooltip. */}
                <span tabIndex={0} className="inline-flex rounded-lg" aria-describedby="publish-blocked-reason">
                  {button}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-64 flex-col items-start">
                <span className="font-medium">Objava je blokirana:</span>
                <ul className="list-disc pl-4">
                  {blockers.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </TooltipContent>
            </Tooltip>
          );
        }
        return (
          <ConfirmDialog
            key={key}
            trigger={button}
            title={action.title}
            description={action.description}
            confirmLabel={action.confirmLabel}
            destructive={action.variant === "destructive"}
            onConfirm={() => execute(key)}
          />
        );
      })}
      {publishBlocked && ACTIONS[status].includes("publish") ? (
        <p id="publish-blocked-reason" className="basis-full text-xs text-muted-foreground">
          <CircleAlert aria-hidden="true" className="mr-1 inline size-3.5 align-[-2px]" />
          Objava je moguća kada su ispunjeni svi uslovi ({blockers.length} {blockers.length === 1 ? "nedostaje" : "nedostaju"}).
        </p>
      ) : null}
    </div>
  );
}

function PreviewSection({ data }: { data: EditorData }) {
  const listing = data.listing;
  const preview = usePreviewLink(listing);
  const [confirmRotate, setConfirmRotate] = useState(false);

  const copy = async (path: string) => {
    try {
      await navigator.clipboard.writeText(new URL(path, window.location.origin).toString());
      toast.success("Link je kopiran.");
    } catch {
      toast.error("Kopiranje nije uspelo. Označite link i kopirajte ga ručno.");
    }
  };

  return (
    <section aria-labelledby="preview-title" className="border-t px-4 py-3">
      <h3 id="preview-title" className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Link za pregled
      </h3>
      {isOnSite(listing) ? (
        <Button asChild variant="outline" size="sm" className="mb-3">
          <a href={publicPath(listing.slug)} target="_blank" rel="noopener">
            <ExternalLink aria-hidden="true" />
            Pogledaj na sajtu
            <span className="sr-only"> (otvara se u novoj kartici)</span>
          </a>
        </Button>
      ) : null}
      {preview.path !== null && preview.expiresAt !== undefined ? (
        <div className="flex flex-col gap-2">
          <div className="flex gap-1.5">
            <Input
              readOnly
              value={preview.path}
              aria-label="Link za pregled"
              className="h-8 font-mono text-xs"
              onFocus={(event) => event.currentTarget.select()}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Kopiraj link za pregled"
              onClick={() => void copy(preview.path ?? "")}
            >
              <Copy aria-hidden="true" />
            </Button>
            <Button asChild variant="outline" size="icon">
              <a
                href={preview.path}
                target="_blank"
                rel="noopener"
                data-testid="action-preview"
                aria-label="Otvori pregled u novoj kartici"
              >
                <ExternalLink aria-hidden="true" />
              </a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Važi do {formatDateTime(preview.expiresAt)}. Svako ko ima link vidi oglas pre objave; ne prikazuje se
            pretraživačima.
          </p>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="self-start"
            disabled={preview.busy}
            onClick={() => setConfirmRotate(true)}
          >
            <RefreshCw aria-hidden="true" />
            Napravi novi link
          </Button>
          <ConfirmDialog
            open={confirmRotate}
            onOpenChange={setConfirmRotate}
            title="Napraviti novi link za pregled?"
            description="Postojeći link odmah prestaje da važi. Novi važi 14 dana."
            confirmLabel="Napravi novi link"
            onConfirm={async () => {
              await preview.create();
            }}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            data-testid="action-preview"
            disabled={preview.busy}
            onClick={() => void preview.create()}
          >
            <Link2 aria-hidden="true" />
            Napravi link za pregled
          </Button>
          <p className="text-xs text-muted-foreground">
            Tajni link za pregled oglasa pre objave (npr. za vlasnika). Važi 14 dana.
          </p>
        </div>
      )}
    </section>
  );
}

function DuplicateSection({ data }: { data: EditorData }) {
  const { engine, listingId } = useEditor();
  const duplicate = useMutation(api.listingsAdmin.duplicate);
  const router = useRouter();
  return (
    <section aria-label="Dupliranje" className="border-t px-4 py-3">
      <ConfirmDialog
        trigger={
          <Button type="button" variant="ghost" size="sm" data-testid="action-duplicate">
            <CopyPlus aria-hidden="true" />
            Dupliraj
          </Button>
        }
        title="Duplirati nekretninu?"
        description={
          <>
            Pravi se nacrt sa istim podacima i fotografijama, pod novom šifrom. Kopija nema ugovor o posredovanju ni
            link za pregled — unesite novi ugovor pre objave.
          </>
        }
        confirmLabel="Dupliraj"
        onConfirm={async () => {
          await engine.flush();
          try {
            const copy = await duplicate({ id: listingId });
            toast.success(`Napravljena je kopija ${copy.ref} od ${data.listing.ref}.`);
            router.push(`/admin/nekretnine/${copy.id}`);
          } catch (error) {
            toast.error(adminErrorMessage(error, "Kopija nije napravljena."));
            return false;
          }
        }}
      />
    </section>
  );
}
