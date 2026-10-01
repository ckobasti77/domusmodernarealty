"use client";

import { useConvex, useMutation } from "convex/react";
import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { adminErrorMessage } from "@/lib/admin/errors";
import { toDateInput } from "@/lib/admin/format";

/** Hands a text file to the browser's download (Blob + `<a download>`). */
function download(text: string, filename: string): void {
  // The BOM tells Excel the file is UTF-8, so č, ć, š, ž, đ and Cyrillic survive.
  const blob = new Blob(["﻿", text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

/**
 * "Izvezi CSV": a one-off read of `contacts.exportCsv` (not a subscription),
 * then `kontakti-YYYY-MM-DD.csv`, `;`-separated for Excel with Serbian
 * regional settings. The export is logged in the activity log.
 */
export function ExportButton() {
  const convex = useConvex();
  const logExport = useMutation(api.contacts.logExport);
  const [pending, setPending] = useState(false);

  return (
    <Button
      variant="outline"
      data-testid="contacts-export"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          const result = await convex.query(api.contacts.exportCsv, {});
          download(result.csv, `kontakti-${toDateInput(Date.now())}.csv`);
          await logExport({ rows: result.rows });
          toast.success(
            result.truncated
              ? `Izvezeno je prvih ${result.rows} kontakata. Za veći izvoz se obratite administratoru.`
              : `Izvezeno kontakata: ${result.rows}.`,
          );
        } catch (error) {
          toast.error(adminErrorMessage(error));
        } finally {
          setPending(false);
        }
      }}
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
      Izvezi CSV
    </Button>
  );
}
