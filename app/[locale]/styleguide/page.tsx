import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { api } from "@/convex/_generated/api";
import type { ListingCard, PublicImage } from "@/convex/lib/dto";
import type { Locale } from "@/i18n/routing";
import { Counter } from "@/components/motion/Counter";
import { CursorFollowerImage } from "@/components/motion/CursorFollowerImage";
import { ImageReveal } from "@/components/motion/ImageReveal";
import { MagneticButton } from "@/components/motion/MagneticButton";
import { Marquee } from "@/components/motion/Marquee";
import { ParallaxImage } from "@/components/motion/ParallaxImage";
import { Reveal } from "@/components/motion/Reveal";
import { Accordion } from "@/components/site/Accordion";
import { Badge } from "@/components/site/Badge";
import { Button } from "@/components/site/Button";
import { Container, Grid, Section } from "@/components/site/Container";
import { Divider } from "@/components/site/Divider";
import { Eyebrow } from "@/components/site/Eyebrow";
import {
  CheckboxField,
  RadioField,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/site/Field";
import { fixTypography, formatArea, formatCount, formatRooms } from "@/lib/format";
import { Price } from "@/components/site/Price";
import { PropertyCard } from "@/components/site/PropertyCard";
import { SectionHeading } from "@/components/site/SectionHeading";
import { Tabs } from "@/components/site/Tabs";
import { TextLink, textLinkClasses } from "@/components/site/TextLink";
import { Link } from "@/i18n/navigation";

/**
 * The internal design-system page. It exists so a human (or the design-critic
 * agent) can see every component and every state on one screen, in any of the
 * four locales, and so a regression in a token shows up here first.
 *
 * It is `noindex, nofollow`: it is not part of the public site and step 12's
 * robots.txt disallows `/*\/styleguide` as well.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/** Verified local media (docs/assets + public/media), never invented URLs. */
const MEDIA = {
  about: "/media/about/about-1280.webp",
  sell: "/media/sell/sell-1280.webp",
  tours: "/media/tours3d/tours3d-1280.webp",
  toursAlt: "/media/tours3d-alt/tours3d-alt-1280.webp",
  valuation: "/media/valuation/valuation-1280.webp",
} as const;

type ColourRow = { token: string; hex: string; on: string; ratio: string; use: string };

/** Ratios computed by the step-04 contrast pass; see docs/DECISIONS.md. */
const CONTRAST: readonly ColourRow[] = [
  { token: "ink on ivory", hex: "#0E0D0B", on: "#F4EFE6", ratio: "16.96", use: "body" },
  { token: "ink on paper", hex: "#0E0D0B", on: "#FBF9F5", ratio: "18.47", use: "inputs" },
  { token: "stone-text on ivory", hex: "#6C655B", on: "#F4EFE6", ratio: "5.02", use: "muted" },
  { token: "stone-text on ivory-2", hex: "#6C655B", on: "#EAE3D6", ratio: "4.51", use: "muted" },
  { token: "bronze-text on ivory", hex: "#7A623C", on: "#F4EFE6", ratio: "5.04", use: "links" },
  { token: "bronze-text on ivory-2", hex: "#7A623C", on: "#EAE3D6", ratio: "4.52", use: "links" },
  { token: "ivory on ink", hex: "#F4EFE6", on: "#0E0D0B", ratio: "16.96", use: "body" },
  { token: "mist on ink-3", hex: "#B9B0A2", on: "#24211C", ratio: "7.48", use: "muted" },
  { token: "bronze on ink-3", hex: "#B08D57", on: "#24211C", ratio: "5.19", use: "accent" },
  { token: "ink on bronze", hex: "#0E0D0B", on: "#B08D57", ratio: "6.28", use: "fill" },
  { token: "paper on bronze-deep", hex: "#FBF9F5", on: "#8C6D3F", ratio: "4.57", use: "primary" },
  { token: "danger on ivory-2", hex: "#A4473A", on: "#EAE3D6", ratio: "4.65", use: "errors" },
  { token: "warning-text on paper", hex: "#835F22", on: "#FBF9F5", ratio: "5.51", use: "warnings" },
  { token: "success-text on ivory", hex: "#476E51", on: "#F4EFE6", ratio: "5.07", use: "success" },
];

const SWATCHES = [
  { name: "ink", value: "#0E0D0B" },
  { name: "ink-2", value: "#171512" },
  { name: "ink-3", value: "#24211C" },
  { name: "ivory", value: "#F4EFE6" },
  { name: "ivory-2", value: "#EAE3D6" },
  { name: "paper", value: "#FBF9F5" },
  { name: "stone", value: "#8A8275" },
  { name: "stone-text", value: "#6C655B" },
  { name: "mist", value: "#B9B0A2" },
  { name: "bronze", value: "#B08D57" },
  { name: "bronze-deep", value: "#8C6D3F" },
  { name: "bronze-text", value: "#7A623C" },
  { name: "success", value: "#4F7A5A" },
  { name: "danger", value: "#A4473A" },
  { name: "warning", value: "#B7852F" },
] as const;

/**
 * Every specimen line carries Č Ć Š Ž Đ. The old one used a diacritic-free
 * string, which is precisely why the display face's broken lowercase carons
 * survived a full review pass. The token values are printed beside each step so
 * a regression in `app/globals.css` is visible here.
 */
const SCALE = [
  {
    token: "display-xl",
    cls: "text-display-xl",
    spec: "clamp(3.5rem, 9vw, 9.5rem) / 0.92-1.02 / -0.02em",
    text: "Vračar, Dedinje, Niš",
  },
  {
    token: "display-l",
    cls: "text-display-l",
    spec: "clamp(2.75rem, 6vw, 6rem) / 0.95 / -0.015em",
    text: "Čačak Ćuprija Šabac Žabalj Đakovica",
  },
  {
    token: "display-m",
    cls: "text-display-m",
    spec: "clamp(2.25rem, 4.2vw, 4rem) / 1.0 / -0.01em",
    text: "Kruševac, Kragujevac, Užice, Šid",
  },
  {
    token: "h2",
    cls: "text-h2",
    spec: "clamp(1.75rem, 2.6vw, 2.5rem) / 1.1",
    text: "Stan u Đušinoj, pogled na Košutnjak",
  },
  {
    token: "h3",
    cls: "text-h3",
    spec: "1.5rem / 1.25",
    text: "Đorđa Vajferta 14, Vračar - 78,5 m²",
  },
] as const;

/** One line per script so a missing glyph subset is visible immediately. */
const SPECIMENS = [
  { lang: "sr-Latn", text: "Čačak Ćuprija Šabac Žabalj Đakovica — Vračar, Dedinje" },
  { lang: "ru", text: "Привет Београд Москва — Врачар, Дедине" },
  { lang: "de", text: "Grüße Österreich Zürich — Häuser, Wohnfläche" },
] as const;

async function loadCards(): Promise<{
  cards: readonly ListingCard[];
  galleries: Readonly<Record<string, readonly PublicImage[]>>;
}> {
  try {
    const cards = await fetchQuery(api.listings.featured, { limit: 3 });
    if (cards.length === 0) return { cards: [], galleries: {} };
    const details = await fetchQuery(api.listings.detailsByIds, {
      ids: cards.map((card) => card._id),
    });
    const galleries: Record<string, readonly PublicImage[]> = {};
    for (const detail of details) galleries[detail._id] = detail.media.slice(0, 5);
    return { cards, galleries };
  } catch {
    // The styleguide must still render with the dev deployment offline.
    return { cards: [], galleries: {} };
  }
}

export default async function StyleguidePage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "styleguide" });
  const tForms = await getTranslations({ locale, namespace: "forms" });
  const tListing = await getTranslations({ locale, namespace: "listing" });
  const tCard = await getTranslations({ locale, namespace: "card" });
  const tFilters = await getTranslations({ locale, namespace: "filters" });
  const tCommon = await getTranslations({ locale, namespace: "common" });
  const tHome = await getTranslations({ locale, namespace: "home" });
  const tConsent = await getTranslations({ locale, namespace: "consent" });

  const { cards, galleries } = await loadCards();

  return (
    <>
      {/* The header is fixed and transparent, so the first band owns the ink. */}
      <Section tone="ink" className="pt-40 lg:pt-56">
        <Container>
          <SectionHeading
            eyebrow={t("noindexShort")}
            title={t("title")}
            lede={t("lede")}
            level={1}
            size="display-l"
            tone="dark"
          />
        </Container>
      </Section>

      {/* ------------------------------------------------------------ palette */}
      <Section tone="ivory" aria-labelledby="sg-palette" className="hairline-t">
        <Container>
          <SectionHeading id="sg-palette" eyebrow={t("tokens")} title={t("palette")} size="display-m" />
          <ul className="mt-12 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
            {SWATCHES.map((swatch) => (
              <li key={swatch.name}>
                <div
                  className="h-24 w-full border border-hairline-light"
                  style={{ backgroundColor: swatch.value }}
                />
                <p className="mt-2 font-sans text-small">{swatch.name}</p>
                <p data-numeric className="font-mono text-label uppercase text-stone-text">
                  {swatch.value}
                </p>
              </li>
            ))}
          </ul>

          <h3 className="mt-16 font-display text-h3">{t("contrast")}</h3>
          <p className="mt-2 max-w-[60ch] text-small text-stone-text">{t("contrastPass")}</p>
          {/* Focusable so a keyboard user can scroll it at 390px (WCAG 2.1.1). */}
          <div
            className="mt-6 overflow-x-auto"
            tabIndex={0}
            role="region"
            aria-label={t("contrast")}
          >
            <table className="w-full min-w-[30rem] border-collapse text-small">
              <caption className="sr-only">{t("contrast")}</caption>
              <thead>
                <tr className="hairline-b">
                  <th scope="col" className="py-2 text-left font-sans font-medium">
                    {t("tokens")}
                  </th>
                  <th scope="col" className="py-2 text-left font-sans font-medium">
                    WCAG
                  </th>
                  <th scope="col" className="py-2 text-left font-sans font-medium">
                    {t("palette")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {CONTRAST.map((row) => (
                  <tr key={row.token} className="hairline-b">
                    <th scope="row" className="py-2 pr-4 text-left font-normal">
                      {row.token}
                    </th>
                    <td data-numeric className="py-2 pr-4">
                      {row.ratio}:1 · AA
                    </td>
                    <td className="py-2 text-right">
                      <span
                        className="inline-block min-w-24 px-3 py-1 text-center"
                        style={{ backgroundColor: row.on, color: row.hex }}
                      >
                        {row.use}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </Section>

      {/* -------------------------------------------------------- typography */}
      <Section tone="ivory-2" aria-labelledby="sg-type" className="hairline-t">
        <Container>
          <SectionHeading id="sg-type" eyebrow={t("tokens")} title={t("typography")} size="display-m" />

          <dl className="mt-12 space-y-8">
            {SCALE.map((step) => (
              <div key={step.token} className="hairline-b pb-6">
                <dt className="flex flex-wrap items-baseline gap-x-4 font-mono text-label uppercase text-stone-text">
                  <span>{step.token}</span>
                  <span className="normal-case tracking-normal">{step.spec}</span>
                </dt>
                <dd className={`mt-3 font-display font-normal ${step.cls}`}>{step.text}</dd>
              </div>
            ))}
            <div className="hairline-b pb-6">
              <dt className="font-mono text-label uppercase text-stone-text">body-l / body / small</dt>
              <dd className="mt-3 max-w-[62ch] text-body-l">{tHome("heroLede")}</dd>
              <dd className="mt-2 max-w-[62ch] text-body">{tHome("heroLede")}</dd>
              <dd className="mt-2 max-w-[62ch] text-small text-stone-text">{tHome("heroLede")}</dd>
            </div>
            <div>
              <dt className="font-mono text-label uppercase text-stone-text">eyebrow / label</dt>
              <dd className="mt-3">
                <Eyebrow index={1}>{tHome("featuredEyebrow")}</Eyebrow>
              </dd>
            </div>
          </dl>

          <h3 className="mt-16 font-display text-h3">{t("specimen")}</h3>
          <div className="mt-6 grid gap-10 lg:grid-cols-2">
            <div>
              <p className="font-mono text-label uppercase text-stone-text">EB Garamond</p>
              {SPECIMENS.map((specimen) => (
                <p key={specimen.lang} lang={specimen.lang} className="mt-3 font-display text-h3 font-normal">
                  {specimen.text}
                </p>
              ))}
            </div>
            <div>
              <p className="font-mono text-label uppercase text-stone-text">Manrope · JetBrains Mono</p>
              {SPECIMENS.map((specimen) => (
                <p key={specimen.lang} lang={specimen.lang} className="mt-3 text-body-l">
                  {specimen.text}
                </p>
              ))}
              <p lang="ru" className="mt-3 font-mono text-small uppercase">
                REF-2026-014 · 44.8125, 20.4612
              </p>
            </div>
          </div>
        </Container>
      </Section>

      {/* ----------------------------------------------------------- controls */}
      <Section tone="ivory" aria-labelledby="sg-buttons" className="hairline-t">
        <Container>
          <SectionHeading id="sg-buttons" eyebrow={t("tokens")} title={t("buttons")} size="display-m" />

          <div className="mt-12 flex flex-wrap items-center gap-4">
            <Button variant="primary">{tHome("heroCta")}</Button>
            <Button variant="outline">{tFilters("apply")}</Button>
            <Button variant="ghost">{tFilters("reset")}</Button>
            <Button variant="primary" size="compact">
              {tCommon("more")}
            </Button>
            <Button variant="primary" disabled>
              {tForms("submitting")}
            </Button>
            <MagneticButton>
              <Button variant="primary">{t("magnetic")}</Button>
            </MagneticButton>
          </div>

          <div className="mt-8 bg-ink px-gutter py-10 md:px-gutter-md">
            <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
              <Button variant="inverse" className="w-full sm:w-auto">
                {tHome("heroCta")}
              </Button>
              <Button variant="outlineDark" className="w-full sm:w-auto">
                {tListing("bookViewing")}
              </Button>
            </div>
          </div>

          <p className="mt-4 max-w-[62ch] text-small text-stone-text">{t("compactNote")}</p>

          <h3 className="mt-16 font-display text-h3">{t("links")}</h3>
          <p className="mt-4 max-w-[62ch] text-body">
            <TextLink href="#sg-buttons">{tHome("featuredAll")}</TextLink>
            {" · "}
            <TextLink href="#sg-buttons">{tListing("askQuestion")}</TextLink>
          </p>

          <h3 className="mt-16 font-display text-h3">{t("badges")}</h3>
          <div className="mt-6 flex flex-wrap gap-3">
            <Badge>{tCard("new")}</Badge>
            <Badge tone="accent">{tCard("exclusive")}</Badge>
            <Badge tone="status">{tListing("statusReserved")}</Badge>
            <Badge tone="status">{tListing("statusSold")}</Badge>
            <span className="bg-ink p-2">
              <Badge tone="dark">{tCard("hasTour")}</Badge>
            </span>
          </div>

          <h3 className="mt-16 font-display text-h3">{tListing("pricePerM2")}</h3>
          <div className="mt-6 space-y-4">
            <Price price={385000} pricePerM2={4045} size="lg" />
            <Price price={264000} pricePerM2={3300} previousPrice={289000} />
            <Price price={1450} pricePerM2={18} transaction="rent" />
            <Price price={0} priceOnRequest />
          </div>

          {/* The locale-aware formatters every listing surface shares. */}
          <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-3 text-small text-stone-text">
            <div>
              <dt className="font-mono text-label uppercase">{tListing("area")}</dt>
              <dd data-numeric className="text-ink">{formatArea(78.5, locale)}</dd>
            </div>
            <div>
              <dt className="font-mono text-label uppercase">{tListing("rooms")}</dt>
              <dd data-numeric className="text-ink">{formatRooms(1.5, locale)}</dd>
            </div>
            <div>
              <dt className="font-mono text-label uppercase">{tCard("featured")}</dt>
              <dd data-numeric className="text-ink">{formatCount(1460, locale)}</dd>
            </div>
          </dl>

          <div className="mt-16">
            <Divider />
            <p className="mt-2 font-mono text-label uppercase text-stone-text">{t("divider")}</p>
          </div>
        </Container>
      </Section>

      {/* -------------------------------------------------------------- forms */}
      <Section tone="ivory-2" aria-labelledby="sg-forms" className="hairline-t">
        <Container>
          <SectionHeading id="sg-forms" eyebrow={t("tokens")} title={t("forms")} size="display-m" />

          <Grid className="mt-12">
            <div className="col-span-4 space-y-8 lg:col-span-6">
              <TextField label={tForms("name")} name="sg-name" autoComplete="name" required />
              <TextField
                label={tForms("email")}
                name="sg-email"
                type="email"
                defaultValue="pera.peric"
                error={t("formError")}
              />
              {/* "opciono" belongs in the label, not in the slot the error
                  message occupies — otherwise the two are told apart by colour
                  alone. */}
              <TextField
                label={`${tForms("phone")} (${tForms("optional")})`}
                name="sg-phone"
                type="tel"
              />
              <SelectField label={tFilters("propertyType")} name="sg-type" defaultValue="apartment">
                <option value="apartment">{tFilters("propertyType")} 1</option>
                <option value="house">{tFilters("propertyType")} 2</option>
                <option value="land">{tFilters("propertyType")} 3</option>
              </SelectField>
            </div>

            <div className="col-span-4 space-y-8 lg:col-span-6">
              <TextAreaField label={tForms("message")} name="sg-message" rows={5} />
              <RadioField
                label={tForms("mode")}
                name="sg-mode"
                defaultValue="inPerson"
                options={[
                  { value: "inPerson", label: tForms("modeInPerson") },
                  { value: "video", label: tForms("modeVideo") },
                ]}
              />
              <CheckboxField label={tFilters("withTour")} name="sg-tour" defaultChecked />
              {/* `privacyRequired` is rich text: it MUST go through `t.rich`,
                  or the raw `<link>` tag ships on a legal-consent control. */}
              <CheckboxField name="sg-privacy" error={tForms("requiredField")}>
                {tConsent.rich("privacyRequired", {
                  link: (chunks) => (
                    <Link href="/privacy" className={textLinkClasses("light")}>
                      {chunks}
                    </Link>
                  ),
                })}
              </CheckboxField>
              <Button variant="primary">{tForms("submit")}</Button>
            </div>
          </Grid>
        </Container>
      </Section>

      {/* -------------------------------------------------------------- cards */}
      <Section tone="ivory" aria-labelledby="sg-cards" className="hairline-t">
        <Container>
          <SectionHeading id="sg-cards" eyebrow={t("tokens")} title={t("cards")} size="display-m" />

          {cards.length === 0 ? (
            <p className="mt-10 border border-warning px-4 py-3 text-small text-warning-text">
              {t("cardsEmpty")}
            </p>
          ) : (
            <>
              <Grid className="mt-12">
                {cards.map((card) => (
                  <div key={card._id} className="col-span-4">
                    <PropertyCard listing={card} images={galleries[card._id]} ratio="4/5" />
                  </div>
                ))}
              </Grid>

              <Grid className="mt-16">
                {cards.slice(0, 2).map((card) => (
                  <div key={`wide-${card._id}`} className="col-span-4 lg:col-span-6">
                    <PropertyCard listing={card} images={galleries[card._id]} ratio="3/2" />
                  </div>
                ))}
              </Grid>
            </>
          )}
        </Container>
      </Section>

      {/* --------------------------------------------- accordion, tabs, count */}
      <Section tone="ivory-2" aria-labelledby="sg-accordion" className="hairline-t">
        <Container>
          <SectionHeading id="sg-accordion" eyebrow={t("tokens")} title={t("accordion")} size="display-m" />
          <div className="mt-10 max-w-[70ch]">
            <Accordion
              defaultOpen={0}
              items={[
                { id: "q1", question: t("sampleQuestion1"), answer: t("sampleAnswer1") },
                { id: "q2", question: t("sampleQuestion2"), answer: t("sampleAnswer2") },
              ]}
            />
          </div>

          <h3 className="mt-16 font-display text-h3">{t("tabs")}</h3>
          <div className="mt-6">
            <Tabs
              ariaLabel={t("tabs")}
              tabs={[
                {
                  value: "overview",
                  label: t("tabOverview"),
                  content: <p className="max-w-[62ch] text-body">{t("sampleAnswer1")}</p>,
                },
                {
                  value: "details",
                  label: t("tabDetails"),
                  content: <p className="max-w-[62ch] text-body">{t("sampleAnswer2")}</p>,
                },
                {
                  value: "legal",
                  label: t("tabLegal"),
                  content: <p className="max-w-[62ch] text-body">{tListing("legal")}</p>,
                },
              ]}
            />
          </div>

          <h3 className="mt-16 font-display text-h3">{t("counter")}</h3>
          <dl className="mt-6 grid grid-cols-2 gap-8 lg:grid-cols-4">
            {[
              { value: 12, label: tHome("numbersYears") },
              { value: 248, label: tHome("numbersSold") },
              { value: 410, label: tHome("numbersClients") },
              { value: 47, label: tHome("numbersDaysToSell") },
            ].map((item) => (
              <div key={item.label}>
                <dd className="font-display text-display-m font-normal">
                  <Counter value={item.value} />
                </dd>
                <dt className="mt-2 max-w-[16ch] font-mono text-label uppercase text-stone-text">
                  {item.label}
                </dt>
              </div>
            ))}
          </dl>
          {/* Sample figures for the component, marked the way the landing marks demo stats. */}
          <p className="mt-8 max-w-[52ch] text-pretty text-small text-stone-text">{fixTypography(tHome("numbersDemo"))}</p>
        </Container>
      </Section>

      {/* ------------------------------------------------------------- motion */}
      <Section tone="ink" aria-labelledby="sg-motion">
        <Container>
          <SectionHeading id="sg-motion" eyebrow={t("tokens")} title={t("motion")} size="display-m" tone="dark" />

          <Grid className="mt-12">
            <div className="col-span-4 lg:col-span-6">
              <p className="font-mono text-label uppercase text-mist">{t("reveal")}</p>
              <ImageReveal
                src={MEDIA.about}
                alt={t("reveal")}
                ratio="aspect-[4/5]"
                className="mt-4"
                sizes="(min-width: 1024px) 45vw, 90vw"
              />
            </div>
            <div className="col-span-4 lg:col-span-6">
              <p className="font-mono text-label uppercase text-mist">{t("parallax")}</p>
              <ParallaxImage
                src={MEDIA.valuation}
                alt={t("parallax")}
                ratio="aspect-[4/5]"
                className="mt-4"
                sizes="(min-width: 1024px) 45vw, 90vw"
              />
            </div>
          </Grid>

          <div className="mt-20">
            <p className="font-mono text-label uppercase text-mist">{t("cursorList")}</p>
            <CursorFollowerImage
              className="mt-4"
              items={[
                { id: "vracar", label: "Vračar", meta: "24", image: { src: MEDIA.about, alt: "" } },
                { id: "dedinje", label: "Dedinje", meta: "11", image: { src: MEDIA.sell, alt: "" } },
                { id: "senjak", label: "Senjak", meta: "08", image: { src: MEDIA.tours, alt: "" } },
                { id: "dorcol", label: "Dorćol", meta: "17", image: { src: MEDIA.toursAlt, alt: "" } },
              ]}
            />
          </div>

          <div className="mt-20">
            <p className="font-mono text-label uppercase text-mist">{t("marquee")}</p>
            <Marquee className="mt-4 border-y border-hairline-dark py-6">
              {["Beograd", "Novi Sad", "Zlatibor", "Kopaonik", "Subotica", "Niš"].map((city) => (
                <span key={city} className="px-8 font-display text-display-m font-normal text-ivory">
                  {city}
                  <span aria-hidden="true" className="ml-8 text-bronze">
                    ·
                  </span>
                </span>
              ))}
            </Marquee>
          </div>

          <Reveal as="div" className="mt-20 grid gap-6 lg:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <p key={n} className="hairline-t-dark pt-4 text-body text-mist">
                <span data-numeric className="font-mono text-label uppercase text-bronze">
                  0{n}
                </span>
                <span className="mt-2 block">{t("lede")}</span>
              </p>
            ))}
          </Reveal>

          <p className="mt-16 font-mono text-label uppercase text-mist">{t("progress")}</p>
        </Container>
      </Section>
    </>
  );
}
