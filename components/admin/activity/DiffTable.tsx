import { cn } from "@/lib/utils";
import { fieldLabel, type ActivityRow } from "./labels";

type DiffEntry = NonNullable<ActivityRow["diff"]>[number];

function Value({ value, tone }: { value: string | undefined; tone: "before" | "after" }) {
  if (value === undefined || value.trim() === "" || value === "—") {
    return (
      <span className="text-muted-foreground">
        <span aria-hidden="true">—</span>
        <span className="sr-only">prazno</span>
      </span>
    );
  }
  return (
    <span
      className={cn(
        "break-words whitespace-pre-wrap [overflow-wrap:anywhere]",
        tone === "before" && "text-muted-foreground line-through decoration-foreground/30",
      )}
    >
      {value}
    </span>
  );
}

/**
 * Field / before / after of one change. Long values wrap; an empty value is
 * shown as "—". The server keeps at most 200 characters of each value.
 */
export function DiffTable({ diff, id }: { diff: readonly DiffEntry[]; id: string }) {
  return (
    <div id={id} className="overflow-x-auto rounded-lg border bg-background">
      <table className="w-full table-fixed text-sm" data-testid="activity-diff">
        <caption className="sr-only">Izmenjena polja</caption>
        <colgroup>
          <col className="w-[28%]" />
          <col className="w-[36%]" />
          <col className="w-[36%]" />
        </colgroup>
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th scope="col" className="px-3 py-2 font-medium">
              Polje
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Pre
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Posle
            </th>
          </tr>
        </thead>
        <tbody>
          {diff.map((entry) => {
            const { label, known } = fieldLabel(entry.field);
            return (
              <tr key={entry.field} className="border-b align-top last:border-0">
                <th scope="row" className="px-3 py-2 text-left font-medium">
                  <span className={cn("break-words", !known && "font-mono text-xs")}>{label}</span>
                </th>
                <td className="px-3 py-2">
                  <Value value={entry.from} tone="before" />
                </td>
                <td className="px-3 py-2">
                  <Value value={entry.to} tone="after" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
