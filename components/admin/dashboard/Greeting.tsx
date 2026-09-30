import type { Me } from "@/components/admin/shell/me";
import { formatDate, toDateInput } from "@/lib/admin/format";
import { ROLE_LABEL } from "@/lib/admin/labels";
import { firstName, greetingFor, weekdayOf } from "./format";

/**
 * The dashboard's h1 — with the login title, the only admin text set in the
 * display serif (DESIGN §7).
 */
export function Greeting({ me, now }: { me: Me; now: number }) {
  const name = firstName(me.name) ?? firstName(me.agentName);
  const greeting = greetingFor(now);
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <h1 className="font-display text-4xl leading-[1.05] font-normal tracking-[-0.01em] md:text-[2.75rem]">
        {name !== undefined ? `${greeting}, ${name}` : greeting}
      </h1>
      <p className="text-sm text-muted-foreground">
        <time dateTime={toDateInput(now)} data-numeric>
          {weekdayOf(now)}, {formatDate(now)}
        </time>
        <span aria-hidden="true" className="px-2 text-primary">
          ·
        </span>
        {ROLE_LABEL[me.role]}
      </p>
    </header>
  );
}
