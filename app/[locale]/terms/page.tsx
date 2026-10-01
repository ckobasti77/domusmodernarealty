import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { LegalDocument, legalMetadata } from "@/components/site/legal/LegalDocument";
import { routing } from "@/i18n/routing";

type Props = PageProps<"/[locale]/terms">;

/** The general terms of business incl. the commission, `/uslovi` (PRD A13), rendered by the shared `LegalDocument`. */

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return legalMetadata("terms", locale);
}

export default async function TermsPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return <LegalDocument pageKey="terms" locale={locale} />;
}
