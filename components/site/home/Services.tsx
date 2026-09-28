import { ArrowRight } from "lucide-react";
import type { ComponentProps } from "react";
import { getTranslations } from "next-intl/server";
import { Reveal } from "@/components/motion/Reveal";
import { Container } from "@/components/site/Container";
import { SectionHeading } from "@/components/site/SectionHeading";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { fixOrphans } from "@/lib/format";
import { searchQuery } from "@/lib/search-params";
import { cn } from "@/lib/utils";

/**
 * Services (DESIGN §6.6): the numbered editorial list — the numbers are real
 * here, the six services are the order the agency presents them in.
 *
 * On a desktop with a mouse each row keeps its two lines and its link folded
 * away and opens them on hover or keyboard focus. The folded text keeps its
 * space: hover is not a user input in the CLS sense, so a row that pushed the
 * rows below it would count as a layout shift on every pass of the pointer.
 * The reveal therefore runs on `clip-path`, `opacity` and `translate` only, as
 * a ≤300ms CSS transition (a UI micro-interaction, per the motion house rule).
 * Touch screens have no hover to open anything with, so there — and on every
 * screen below 1024px — the text is simply always shown.
 *
 * The whole row is one link (the CTA stretched over the `<li>`), so each
 * service is exactly one tab stop and the folded text is in the accessibility
 * tree at all times.
 */

type Href = ComponentProps<typeof Link>["href"];

const SERVICES: readonly { key: string; href: Href }[] = [
  { key: "Buy", href: { pathname: "/properties", query: searchQuery({ transaction: "sale" }) } },
  { key: "Sell", href: "/sell" },
  { key: "Rent", href: { pathname: "/properties", query: searchQuery({ transaction: "rent" }) } },
  { key: "Valuation", href: "/valuation" },
  { key: "Tours", href: { pathname: "/properties", query: searchQuery({ transaction: "sale", hasTour: true }) } },
  { key: "Relocation", href: "/contact" },
];

const FOLDED = [
  "transition-[opacity,translate,clip-path] duration-300 ease-estate",
  "lg:pointer-fine:translate-y-2 lg:pointer-fine:opacity-0 lg:pointer-fine:[clip-path:inset(0_0_100%_0)]",
  "lg:pointer-fine:group-hover/svc:translate-y-0 lg:pointer-fine:group-hover/svc:opacity-100 lg:pointer-fine:group-hover/svc:[clip-path:inset(0)]",
  "lg:pointer-fine:group-focus-within/svc:translate-y-0 lg:pointer-fine:group-focus-within/svc:opacity-100 lg:pointer-fine:group-focus-within/svc:[clip-path:inset(0)]",
].join(" ");

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export async function Services({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "home" });

  return (
    <section aria-labelledby="services-title" className="bg-ivory py-section text-ink lg:py-section-lg">
      <Container>
        <SectionHeading id="services-title" eyebrow={t("servicesEyebrow")} title={t("servicesHeading")} />

        <Reveal as="ol" stagger={0.06} distance={20} className="mt-14 border-t border-hairline-light lg:mt-20">
          {SERVICES.map((service, index) => (
            <li key={service.key} className="group/svc relative border-b border-hairline-light">
              <div className="grid grid-cols-4 gap-x-6 py-8 lg:grid-cols-12 lg:items-center lg:py-9">
                <span
                  aria-hidden="true"
                  data-numeric=""
                  className="col-span-1 pt-2 font-mono text-label text-bronze-text lg:self-start lg:pt-5"
                >
                  {pad(index + 1)}
                </span>

                <h3
                  className={cn(
                    "col-span-3 font-display text-h2 font-normal lg:col-span-5 lg:text-display-m",
                    "transition-[translate,color] duration-300 ease-estate",
                    "lg:pointer-fine:group-hover/svc:translate-x-3 lg:pointer-fine:group-hover/svc:text-bronze-text",
                  )}
                >
                  {t(`services${service.key}Title`)}
                </h3>

                <div className={cn("col-span-3 col-start-2 mt-4 lg:col-span-5 lg:col-start-7 lg:mt-0", FOLDED)}>
                  <p className="max-w-[48ch] text-body text-stone-text">
                    {fixOrphans(t(`services${service.key}Body`))}{" "}
                    <Link
                      href={service.href}
                      prefetch={false}
                      className={cn(
                        "whitespace-nowrap font-medium text-ink underline decoration-bronze-text/60 decoration-1 underline-offset-[5px]",
                        "transition-colors duration-200 pointer-fine:hover:text-bronze-text",
                        // Stretched over the whole row: one target, one tab stop.
                        "before:absolute before:inset-0",
                      )}
                    >
                      {t(`services${service.key}Cta`)}
                    </Link>
                  </p>
                </div>

                <span aria-hidden="true" className="hidden lg:col-span-1 lg:col-start-12 lg:flex lg:justify-end">
                  <ArrowRight
                    strokeWidth={1}
                    className={cn(
                      "size-8 text-stone transition-[translate,color] duration-300 ease-estate",
                      "pointer-fine:group-hover/svc:translate-x-1 pointer-fine:group-hover/svc:text-bronze-text",
                    )}
                  />
                </span>
              </div>
            </li>
          ))}
        </Reveal>
      </Container>
    </section>
  );
}
