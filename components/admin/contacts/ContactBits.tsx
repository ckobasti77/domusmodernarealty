"use client";

import { DotBadge } from "@/components/admin/common/StatusBadge";
import { DemoTag } from "@/components/admin/leads/cells";
import { OWNER_TAG, type ContactRow } from "./shared";

function Tag({ children }: { children: string }) {
  return (
    <span className="inline-flex h-4 items-center rounded-sm border px-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </span>
  );
}

/** Demo, anonymized and owner markers next to a contact's name. */
export function ContactTags({ contact }: { contact: Pick<ContactRow, "isDemo" | "anonymizedAt" | "tags"> }) {
  return (
    <>
      {contact.isDemo ? <DemoTag /> : null}
      {contact.anonymizedAt !== undefined ? <Tag>Anonimizovan</Tag> : null}
      {contact.tags.includes(OWNER_TAG) ? <Tag>Vlasnik</Tag> : null}
    </>
  );
}

export function MarketingBadge({ marketing }: { marketing: boolean }) {
  return marketing ? <DotBadge tone="success">Da</DotBadge> : <DotBadge tone="muted">Ne</DotBadge>;
}
