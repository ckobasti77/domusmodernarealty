"use client";

import { useMutation } from "convex/react";
import { Copy, ExternalLink, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/common/ConfirmDialog";
import { isOnSite, publicPath } from "@/components/admin/listings/editor/preview";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/convex/_generated/api";
import { adminErrorMessage } from "@/lib/admin/errors";
import type { AdminRow } from "./types";

export function RowActions({ row, canDelete }: { row: AdminRow; canDelete: boolean }) {
  const router = useRouter();
  const duplicate = useMutation(api.listingsAdmin.duplicate);
  const remove = useMutation(api.listingsAdmin.remove);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  const onDuplicate = async () => {
    setDuplicating(true);
    try {
      const copy = await duplicate({ id: row._id });
      toast.success(`Kopija ${copy.ref} je kreirana kao nacrt.`);
      router.push(`/admin/nekretnine/${copy.id}`);
    } catch (error) {
      toast.error(adminErrorMessage(error));
      setDuplicating(false);
    }
  };

  const onDelete = async () => {
    try {
      await remove({ id: row._id });
      toast.success(`Nekretnina ${row.ref} je obrisana.`);
      return true;
    } catch (error) {
      toast.error(adminErrorMessage(error));
      return false;
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Radnje za ${row.ref}`}
            disabled={duplicating}
          >
            <MoreHorizontal aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem asChild>
            <Link href={`/admin/nekretnine/${row._id}`}>
              <Pencil aria-hidden="true" />
              Uredi
            </Link>
          </DropdownMenuItem>
          {/* Status AND visibility: a hidden or private listing has no public page. */}
          {isOnSite(row) ? (
            <DropdownMenuItem asChild>
              <a href={publicPath(row.slug)} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden="true" />
                Pogledaj na sajtu
                <span className="sr-only"> (otvara se u novoj kartici)</span>
              </a>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => void onDuplicate()}>
            <Copy aria-hidden="true" />
            Dupliraj
          </DropdownMenuItem>
          {canDelete ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
                <Trash2 aria-hidden="true" />
                Obriši
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {canDelete ? (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={`Obrisati ${row.ref}?`}
          description="Nekretnina, njene fotografije, ture i statistika biće trajno obrisani. Upiti ostaju sačuvani, a zakazana razgledanja se otkazuju. Ova radnja se ne može poništiti."
          confirmLabel="Obriši"
          destructive
          onConfirm={onDelete}
        />
      ) : null}
    </>
  );
}
