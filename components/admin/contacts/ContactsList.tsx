"use client";

import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Id } from "@/convex/_generated/dataModel";
import { formatDateTime, formatRelative } from "@/lib/admin/format";
import { cn } from "@/lib/utils";
import { ContactTags, MarketingBadge } from "./ContactBits";
import type { ContactRow } from "./shared";

const HEAD = "h-9 text-xs font-medium text-muted-foreground";

function leadCount(row: ContactRow): string {
  return row.leadCountCapped ? `${row.leadCount}+` : String(row.leadCount);
}

function LastActivity({ at, now }: { at: number; now: number }) {
  return (
    <time dateTime={new Date(at).toISOString()} title={formatDateTime(at)} className="text-xs whitespace-nowrap text-muted-foreground">
      {formatRelative(at, now)}
    </time>
  );
}

/** Contacts as a table (desktop) or stacked rows (phone); a row opens the sheet. */
export function ContactsList({
  rows,
  loading,
  refreshing,
  now,
  phone,
  onOpen,
  empty,
}: {
  rows: readonly ContactRow[];
  loading: boolean;
  refreshing: boolean;
  now: number;
  phone: boolean;
  onOpen: (id: Id<"contacts">) => void;
  empty: ReactNode;
}) {
  if (phone) {
    if (loading) {
      return (
        <ul aria-busy="true" aria-label="Kontakti se učitavaju" className="divide-y">
          {Array.from({ length: 6 }, (_, index) => (
            <li key={index} className="space-y-2 px-3 py-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </li>
          ))}
        </ul>
      );
    }
    if (rows.length === 0) return <div className="px-4 py-10 text-center">{empty}</div>;
    return (
      <ul aria-label="Kontakti" aria-busy={refreshing} className={cn("divide-y transition-opacity duration-150", refreshing && "opacity-60")}>
        {rows.map((row) => (
          <li key={row._id} data-testid="contact-row" data-contact-id={row._id}>
            <button
              type="button"
              onClick={() => onOpen(row._id)}
              className="flex w-full flex-col gap-1 px-3 py-3 text-left transition-colors duration-150 outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset active:bg-muted"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-sm font-medium">{row.name}</span>
                <ContactTags contact={row} />
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {[row.email, row.phone].filter((item) => item !== undefined).join(" · ") || "Bez podataka za kontakt"}
              </span>
              <span className="flex w-full items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>Upita: {leadCount(row)}</span>
                <LastActivity at={row.lastActivityAt} now={now} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div
      role="region"
      aria-label="Tabela kontakata"
      tabIndex={0}
      className="relative overflow-auto outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:max-h-[max(20rem,calc(100svh-19rem))]"
    >
      <table
        data-testid="contacts-table"
        aria-busy={loading || refreshing}
        className={cn(
          "w-full min-w-[820px] table-fixed caption-bottom text-sm transition-opacity duration-150",
          refreshing && "opacity-60",
        )}
      >
        <caption className="sr-only">Kontakti, najnoviji prvi. Otvorite kontakt klikom na ime.</caption>
        <TableHeader className="sticky top-0 z-10 bg-card shadow-[inset_0_-1px_0_var(--border)] [&_tr]:border-b-0">
          <TableRow className="hover:bg-transparent">
            <TableHead scope="col" className={HEAD}>Ime</TableHead>
            <TableHead scope="col" className={cn(HEAD, "w-56")}>E-pošta</TableHead>
            <TableHead scope="col" className={cn(HEAD, "w-40")}>Telefon</TableHead>
            <TableHead scope="col" className={cn(HEAD, "w-20 text-right")}>Upiti</TableHead>
            <TableHead scope="col" className={cn(HEAD, "w-36")}>Poslednja aktivnost</TableHead>
            <TableHead scope="col" className={cn(HEAD, "w-24")}>Marketing</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading
            ? Array.from({ length: 8 }, (_, index) => (
                <TableRow key={`skeleton-${index}`} className="h-12 hover:bg-transparent" aria-hidden="true">
                  {Array.from({ length: 6 }, (_unused, cell) => (
                    <TableCell key={cell}>
                      <Skeleton className="h-4 w-full min-w-6" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : null}
          {!loading && rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={6} className="h-48 text-center whitespace-normal">
                {empty}
              </TableCell>
            </TableRow>
          ) : null}
          {!loading
            ? rows.map((row) => (
                <TableRow
                  key={row._id}
                  data-testid="contact-row"
                  data-contact-id={row._id}
                  className={cn("h-12 cursor-pointer", row.anonymizedAt !== undefined && "text-muted-foreground")}
                  onClick={(event) => {
                    if (event.target instanceof Element && event.target.closest("a,button") !== null) return;
                    onOpen(row._id);
                  }}
                >
                  <TableCell>
                    <div className="flex min-w-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onOpen(row._id)}
                        className="min-w-0 truncate rounded-sm text-left font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        {row.name}
                      </button>
                      <ContactTags contact={row} />
                    </div>
                  </TableCell>
                  <TableCell className="truncate text-xs">
                    {row.email !== undefined ? (
                      <a href={`mailto:${row.email}`} className="underline-offset-4 hover:underline">
                        {row.email}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="truncate text-xs tabular-nums">
                    {row.phone ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums">{leadCount(row)}</TableCell>
                  <TableCell>
                    <LastActivity at={row.lastActivityAt} now={now} />
                  </TableCell>
                  <TableCell>
                    <MarketingBadge marketing={row.marketing} />
                  </TableCell>
                </TableRow>
              ))
            : null}
        </TableBody>
      </table>
    </div>
  );
}
