import type { ReactNode } from "react";
import { Container } from "@/components/site/Container";
import { cn } from "@/lib/utils";

/**
 * A photograph that straddles the seam between the ink band above and the
 * ivory section below, so the page opens on its picture instead of stacking
 * it in a box of its own (DESIGN §3, "overlap and scale").
 */
export function Straddle({
  children,
  below = "ivory",
  className,
}: {
  children: ReactNode;
  /** The surface of the section that follows. */
  below?: "ivory" | "ivory-2";
  className?: string;
}) {
  return (
    <div className={cn("relative", below === "ivory" ? "bg-ivory" : "bg-ivory-2", className)}>
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1/2 bg-ink" />
      <Container className="relative">{children}</Container>
    </div>
  );
}
