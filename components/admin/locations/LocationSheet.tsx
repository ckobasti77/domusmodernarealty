"use client";

import { useQuery } from "convex/react";
import { Star } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/admin/common/ConfirmDialog";
import { DetailSheet } from "@/components/admin/common/DetailSheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { LocationKind } from "@/convex/lib/validators";
import { LOCATION_KIND_LABEL } from "@/lib/admin/labels";
import { formatCount } from "@/lib/format";
import { LocationForm } from "./LocationForm";
import { ancestorsOf, NEW_TITLE, PARENT_KINDS, type LocationId, type SheetState, type TreeIndex } from "./model";

const FORM_ID = "location-form";

function SheetSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Učitavanje lokacije">
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-56 w-full rounded-xl" />
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  );
}

/** A `?parent=` that names a location able to hold `kind`, else undefined. */
function validParent(index: TreeIndex, kind: LocationKind, raw: string | undefined): LocationId | undefined {
  if (raw === undefined) return undefined;
  const parent = index.byId.get(raw as LocationId);
  return parent !== undefined && PARENT_KINDS[kind].includes(parent.kind) ? parent._id : undefined;
}

/**
 * The location editor as a wide right-hand sheet. Edit (`?id=`) loads
 * `locationsAdmin.get`; new (`?new=<kind>&parent=<id>`) starts from the parent's
 * centroid. Closing with unsaved changes asks first.
 */
export function LocationSheet({
  sheet,
  index,
  canDelete,
  onClose,
  onCreated,
}: {
  sheet: SheetState;
  /** null while the tree loads. */
  index: TreeIndex | null;
  canDelete: boolean;
  onClose: () => void;
  onCreated: (id: LocationId, parentId: LocationId | undefined) => void;
}) {
  const [dirty, setDirty] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  // Keep the last open view while the sheet animates out.
  const [last, setLast] = useState(sheet);
  if (sheet.mode !== "closed" && sheet !== last) setLast(sheet);
  const view = sheet.mode === "closed" ? last : sheet;

  const row = view.mode === "edit" && index !== null ? index.byId.get(view.id as LocationId) : undefined;
  const detail = useQuery(api.locationsAdmin.get, row !== undefined ? { id: row._id } : "skip");

  const requestClose = () => {
    if (dirty) setConfirmDiscard(true);
    else onClose();
  };

  const close = () => {
    setDirty(false);
    onClose();
  };

  let title = "Lokacija";
  let description: string | undefined;
  let meta = null;
  let body = <SheetSkeleton />;

  if (view.mode === "new") {
    title = NEW_TITLE[view.kind];
    if (index !== null) {
      const parentId = validParent(index, view.kind, view.parentId);
      const parent = parentId !== undefined ? index.byId.get(parentId) : undefined;
      description =
        parent !== undefined
          ? [...ancestorsOf(index, parent), parent].map((item) => item.name.sr).join(" › ")
          : view.kind === "city"
            ? "Najviši nivo stabla"
            : undefined;
      body = (
        <LocationForm
          key={`new:${view.kind}:${parentId ?? ""}`}
          formId={FORM_ID}
          kind={view.kind}
          detail={null}
          initialParentId={parentId}
          index={index}
          canDelete={false}
          onDirtyChange={setDirty}
          onCreated={(id) => {
            setDirty(false);
            onCreated(id, parentId);
          }}
          onDeleted={close}
        />
      );
    }
  } else if (view.mode === "edit" && index !== null) {
    if (row === undefined || detail === null) {
      title = "Lokacija nije pronađena";
      body = (
        <p className="text-sm text-muted-foreground">
          Ova lokacija ne postoji ili je u međuvremenu obrisana. Zatvorite panel i izaberite lokaciju iz stabla.
        </p>
      );
    } else {
      title = row.name.sr;
      const path = ancestorsOf(index, row).map((item) => item.name.sr);
      description = [LOCATION_KIND_LABEL[row.kind], ...(path.length > 0 ? [path.join(" › ")] : [])].join(" · ");
      meta = (
        <>
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatCount(row.saleCount, "sr-Latn")} u prodaji · {formatCount(row.rentCount, "sr-Latn")} za izdavanje
          </span>
          {row.featured ? (
            <span className="inline-flex items-center gap-1 text-xs">
              <Star aria-hidden="true" className="size-3 fill-bronze text-bronze" />
              Istaknuta
            </span>
          ) : null}
          {row.isDemo ? (
            <Badge variant="outline" className="font-normal text-muted-foreground">
              Demo
            </Badge>
          ) : null}
        </>
      );
      if (detail !== undefined) {
        body = (
          <LocationForm
            key={`edit:${detail._id}`}
            formId={FORM_ID}
            kind={detail.kind}
            detail={detail}
            initialParentId={detail.parentId}
            index={index}
            canDelete={canDelete}
            onDirtyChange={setDirty}
            onDeleted={close}
          />
        );
      }
    }
  }

  return (
    <>
      <DetailSheet
        open={sheet.mode !== "closed"}
        onOpenChange={(open) => {
          if (!open) requestClose();
        }}
        title={title}
        {...(description !== undefined ? { description } : {})}
        {...(meta !== null ? { meta } : {})}
        width="xl"
        testId="location-sheet"
      >
        {body}
      </DetailSheet>
      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Odbaciti nesačuvane izmene?"
        description="Izmene ove lokacije još nisu sačuvane. Ako zatvorite panel, biće izgubljene."
        confirmLabel="Odbaci izmene"
        cancelLabel="Nastavi uređivanje"
        destructive
        onConfirm={() => {
          close();
          return true;
        }}
      />
    </>
  );
}
