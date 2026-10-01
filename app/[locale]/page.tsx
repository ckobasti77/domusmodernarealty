import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { FeaturedListings } from "@/components/site/home/FeaturedListings";
import { FinalCta } from "@/components/site/home/FinalCta";
import { Hero } from "@/components/site/home/Hero";
import { IntroStatement } from "@/components/site/home/IntroStatement";
import { JournalTeaser } from "@/components/site/home/JournalTeaser";
import { Neighborhoods } from "@/components/site/home/Neighborhoods";
import { Numbers } from "@/components/site/home/Numbers";
import { Process } from "@/components/site/home/Process";
import { Services } from "@/components/site/home/Services";
import { Testimonials } from "@/components/site/home/Testimonials";
import { ToursTeaser } from "@/components/site/home/ToursTeaser";
import { ValuationCta } from "@/components/site/home/ValuationCta";
import { buildHomeCopy } from "@/components/site/home/copy";
import { loadHomeData, locationOptions, neighborhoodItems, tourListing } from "@/components/site/home/data";
import { routing } from "@/i18n/routing";

/**
 * The landing (PRD A2, DESIGN §6): thirteen sections, the preloader and the
 * footer coming from the locale layout. Everything it shows is read from
 * Convex on the server in one parallel round (`loadHomeData`), so the HTML is
 * complete for search engines and for the LCP; the client islands inside each
 * section only animate what is already there.
 *
 * The copy is managed in the admin (`pages.home`, PRD B10) and resolved once
 * here (`buildHomeCopy`), with the `messages` strings as the fallback for anything
 * the page does not hold; the sections receive plain strings.
 *
 * No `<main>` here — the locale layout owns it, together with the skip-link
 * target.
 */
export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const data = await loadHomeData();
  const locations = locationOptions(data.locations, locale);
  const tHome = await getTranslations({ locale, namespace: "home" });
  const copy = buildHomeCopy(data.home, locale, data.settings?.stats ?? [], tHome);

  return (
    <>
      <Hero locale={locale} locations={locations} copy={copy.hero} />
      <IntroStatement locale={locale} copy={copy.intro} />
      <FeaturedListings locale={locale} listings={data.featured} />
      <Neighborhoods locale={locale} items={neighborhoodItems(data.locations, locale)} copy={copy.neighborhoods} />
      <Services locale={locale} copy={copy.services} />
      <ToursTeaser locale={locale} listing={tourListing(data.featured)} copy={copy.tours} />
      <Process locale={locale} copy={copy.process} />
      <Numbers locale={locale} copy={copy.numbers} />
      <ValuationCta locale={locale} locations={locations} copy={copy.valuation} />
      <JournalTeaser locale={locale} posts={data.posts} />
      <Testimonials locale={locale} items={data.testimonials} />
      <FinalCta locale={locale} settings={data.settings} copy={copy.final} />
    </>
  );
}
