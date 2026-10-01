import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { LegalDocument, legalMetadata } from "@/components/site/legal/LegalDocument";
import { routing } from "@/i18n/routing";

type Props = PageProps<"/[locale]/cookies">;

/** The cookie policy with the consent categories, `/kolacici` (PRD A13), rendered by the shared `LegalDocument`. */

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return legalMetadata("cookies", locale);
}

export default async function CookiesPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return <LegalDocument pageKey="cookies" locale={locale} />;
}
