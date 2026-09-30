"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  Fragment,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SEGMENT_LABEL } from "./nav";

type Setter = (label: string | null) => void;

const LabelContext = createContext<{ label: string | null; setLabel: Setter } | null>(null);

export function BreadcrumbLabelProvider({ children }: { children: ReactNode }) {
  const [label, setLabel] = useState<string | null>(null);
  return <LabelContext.Provider value={{ label, setLabel }}>{children}</LabelContext.Provider>;
}

/**
 * A page with a dynamic segment (`/admin/nekretnine/[id]`) names its last
 * crumb, e.g. `useBreadcrumbLabel(listing ? listing.ref : null)`.
 */
export function useBreadcrumbLabel(label: string | null): void {
  const context = useContext(LabelContext);
  const setLabel = context?.setLabel;
  useEffect(() => {
    if (setLabel === undefined) return;
    setLabel(label);
    return () => setLabel(null);
  }, [label, setLabel]);
}

export function AdminBreadcrumbs() {
  const pathname = usePathname();
  const context = useContext(LabelContext);
  const segments = pathname.split("/").filter(Boolean).slice(1);

  const crumbs = [{ href: "/admin", label: "Kontrolna tabla" }];
  segments.forEach((segment, index) => {
    const href = `/admin/${segments.slice(0, index + 1).join("/")}`;
    const known = SEGMENT_LABEL[segment];
    crumbs.push({ href, label: known ?? context?.label ?? "…" });
  });

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <Fragment key={crumb.href}>
              {index > 0 ? <BreadcrumbSeparator className="hidden sm:block" /> : null}
              <BreadcrumbItem className={last ? undefined : "hidden sm:inline-flex"}>
                {last ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={crumb.href}>{crumb.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
