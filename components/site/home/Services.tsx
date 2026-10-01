import { ArrowRight } from "lucide-react";
import type { ComponentProps } from "react";
import { getTranslations } from "next-intl/server";
import { Reveal } from "@/components/motion/Reveal";
import { Container } from "@/components/site/Container";
import { SectionHeading } from "@/components/site/SectionHeading";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { fixTypography } from "@/lib/format";
import { searchQuery } from "@/lib/search-params";
import { cn } from "@/lib/utils";
import { headingNode, type HomeCopy, type ServiceKey } from "./copy";

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

/** Where each service row leads. The titles and texts are managed copy (`home` → `services`). */
const HREF: Record<ServiceKey, Href> = {
  Buy: { pathname: "/properties", query: searchQuery({ transaction: "sale" }) },
  Sell: "/sell",
  Rent: { pathname: "/properties", query: searchQuery({ transaction: "rent" }) },
  Valuation: "/valuation",
  Tours: { pathname: "/properties", query: searchQuery({ transaction: "sale", hasTour: true }) },
  Relocation: "/contact",
};

const FOLDED = [
  "transition-[opacity,translate,clip-path] duration-300 ease-estate",
  "lg:pointer-fine:translate-y-2 lg:pointer-fine:opacity-0 lg:pointer-fine:[clip-path:inset(0_0_100%_0)]",
  // Open means a little past the box, so the focused link's ring is not clipped.
  "lg:pointer-fine:group-hover/svc:translate-y-0 lg:pointer-fine:group-hover/svc:opacity-100 lg:pointer-fine:group-hover/svc:[clip-path:inset(-8px)]",
  "lg:pointer-fine:group-focus-within/svc:translate-y-0 lg:pointer-fine:group-focus-within/svc:opacity-100 lg:pointer-fine:group-focus-within/svc:[clip-path:inset(-8px)]",
].join(" ");

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export async function Services({ locale, copy }: { locale: Locale; copy: HomeCopy["services"] }) {
  const t = await getTranslations({ locale, namespace: "home" });

  return (
    <section aria-labelledby="services-title" className="bg-ivory py-section text-ink lg:py-section-lg">
      <Container>
        <SectionHeading id="services-title" eyebrow={t("servicesEyebrow")} title={headingNode(copy.heading)} />

        <Reveal as="ol" stagger={0.06} distance={20} className="mt-14 border-t border-hairline-light lg:mt-20">
          {copy.items.map((service, index) => (
            <li key={service.key} className="group/svc relative border-b border-hairline-light">
              {/* Below 1024px the number gets a narrow track of its own, so the text
                  keeps a readable measure instead of losing a quarter of the row. */}
              <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 py-8 md:grid-cols-[4rem_minmax(0,1fr)] md:gap-x-6 lg:grid-cols-12 lg:items-center lg:py-7">
                <span
                  aria-hidden="true"
                  data-numeric=""
                  className="pt-2 font-mono text-label text-bronze-text lg:col-span-1 lg:pt-0"
                >
                  {pad(index + 1)}
                </span>

                <h3
                  lang={service.title.lang}
                  className={cn(
                    "col-start-2 font-display text-h2 font-normal lg:col-span-6 lg:text-[clamp(2.5rem,3.6vw,3.75rem)]",
                    "transition-[translate,color] duration-300 ease-estate",
                    "lg:pointer-fine:group-hover/svc:translate-x-3 lg:pointer-fine:group-hover/svc:text-bronze-text",
                  )}
                >
                  {service.title.text}
                </h3>

                <div className={cn("col-start-2 mt-4 lg:col-span-4 lg:col-start-8 lg:mt-0", FOLDED)}>
                  <p className="max-w-[56ch] text-pretty text-body text-stone-text">
                    {service.body.lang !== undefined ? (
                      <span lang={service.body.lang}>{fixTypography(service.body.text)}</span>
                    ) : (
                      fixTypography(service.body.text)
                    )}{" "}
                    <Link
                      href={HREF[service.key]}
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

                {/* On the row's one line with the rest (the text stops at column 11),
                    so number, title and arrow share its centre however many lines the
                    text runs to. */}
                <span
                  aria-hidden="true"
                  className="hidden lg:col-span-1 lg:col-start-12 lg:row-start-1 lg:flex lg:justify-end"
                >
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
