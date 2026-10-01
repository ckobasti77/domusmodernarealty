import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * A native `<select>` drawn like the shadcn `Input`. Used where a short,
 * fixed list sits inside a dialog or sheet: the platform picker is the most
 * reliable control on phones and needs no portal.
 */
export function NativeSelect({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <select
        data-slot="native-select"
        className={cn(
          "h-8 w-full min-w-0 appearance-none rounded-lg border border-input bg-transparent py-1 pr-8 pl-2.5 text-base transition-colors outline-none max-md:h-11 md:text-sm",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50",
          "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
          "dark:bg-input/30 [&>option]:bg-popover [&>option]:text-popover-foreground",
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
    </div>
  );
}
