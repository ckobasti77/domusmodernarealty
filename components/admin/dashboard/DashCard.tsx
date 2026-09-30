import { useId, type ComponentProps, type ReactNode } from "react";
import { Card, CardAction, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * A dashboard panel: a `<section>` named by its own h2, drawn as a shadcn Card.
 * (CardTitle is a div in the display face; the admin keeps headings in Manrope.)
 */
export function DashCard({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
  ...rest
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
} & Omit<ComponentProps<"section">, "title" | "children" | "className">) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={cn("min-w-0", className)} {...rest}>
      <Card className="h-full gap-3">
        <CardHeader>
          <h2 id={headingId} className="text-sm leading-snug font-semibold">
            {title}
          </h2>
          {description !== undefined ? <CardDescription className="text-xs">{description}</CardDescription> : null}
          {action !== undefined ? <CardAction>{action}</CardAction> : null}
        </CardHeader>
        <CardContent className={cn("flex-1", contentClassName)}>{children}</CardContent>
      </Card>
    </section>
  );
}
