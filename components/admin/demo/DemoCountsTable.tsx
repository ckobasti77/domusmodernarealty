import { formatCapped, formatCount } from "@/components/admin/dashboard/format";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { demoTableLabel } from "./labels";

/** `demo.counts` reads at most 1000 rows per table. */
const COUNT_LIMIT = 1000;

export function DemoCountsTable({
  rows,
  total,
}: {
  rows: readonly { table: string; count: number }[];
  total: number;
}) {
  return (
    <Table data-testid="demo-counts">
      <TableCaption className="sr-only">Broj demo zapisa po vrsti sadržaja</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Sadržaj</TableHead>
          <TableHead scope="col" className="text-right">
            Demo zapisa
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.table} data-table={row.table}>
            <TableCell>{demoTableLabel(row.table)}</TableCell>
            <TableCell
              className={cn("text-right", row.count === 0 && "text-muted-foreground")}
              data-numeric
            >
              {formatCapped(row.count, COUNT_LIMIT)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell className="font-medium">Ukupno</TableCell>
          <TableCell className="text-right font-semibold" data-numeric data-testid="demo-total">
            {formatCount(total)}
          </TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}
