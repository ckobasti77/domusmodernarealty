"use client";

import { XIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * The shared detail panel of the CRM and content lists (a lead, a viewing, a
 * contact, a team member): a right-hand sheet that keeps the list visible
 * behind it on desktop and fills the screen on a phone.
 *
 * Layout: a fixed header (title, optional meta line and actions), a scrolling
 * body, and an optional fixed footer for the primary actions. Open state is
 * controlled by the list, usually through `?id=` in the URL so a detail can be
 * linked and survives a reload.
 */
export function DetailSheet({
  open,
  onOpenChange,
  title,
  description,
  meta,
  actions,
  footer,
  children,
  width = "lg",
  testId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  /** One muted line under the title; also the dialog's accessible description. */
  description?: ReactNode;
  /** Badges or small facts shown under the description. */
  meta?: ReactNode;
  /** Icon buttons or a menu, top right, left of the close button. */
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  width?: "md" | "lg" | "xl";
  testId?: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        data-testid={testId}
        className={cn(
          "w-full gap-0 p-0 data-[side=right]:w-full",
          width === "md" && "data-[side=right]:sm:max-w-lg",
          width === "lg" && "data-[side=right]:sm:max-w-xl lg:data-[side=right]:max-w-2xl",
          width === "xl" && "data-[side=right]:sm:max-w-2xl lg:data-[side=right]:max-w-4xl",
        )}
      >
        <SheetHeader className="flex-row items-start gap-3 border-b px-5 py-4">
          <div className="min-w-0 flex-1">
            <SheetTitle className="text-lg leading-snug font-semibold">{title}</SheetTitle>
            {description !== undefined ? (
              <SheetDescription className="mt-0.5">{description}</SheetDescription>
            ) : (
              // Radix warns without a description; an empty one keeps the header honest.
              <SheetDescription className="sr-only">Detalji zapisa</SheetDescription>
            )}
            {meta !== undefined ? <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div> : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {actions}
            <SheetClose asChild>
              <Button variant="ghost" size="icon" aria-label="Zatvori">
                <XIcon aria-hidden="true" />
              </Button>
            </SheetClose>
          </div>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>
        {footer !== undefined ? (
          <SheetFooter className="mt-0 flex-row flex-wrap justify-end gap-2 border-t px-5 py-3">{footer}</SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

/** A titled block inside a detail sheet body. */
export function SheetSection({
  title,
  actions,
  children,
  className,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-b pb-5 not-first:pt-5 last:border-b-0 last:pb-0", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** Label/value rows (contact info, consent record). */
export function FactList({ items }: { items: readonly { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-4 gap-y-2 text-sm">
      {items.map((item) => (
        <div key={item.label} className="contents">
          <dt className="text-muted-foreground">{item.label}</dt>
          <dd className="min-w-0 break-words">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
