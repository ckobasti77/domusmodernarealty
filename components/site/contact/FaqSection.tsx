import { Accordion, type AccordionItem } from "@/components/site/Accordion";
import { Container, Grid, Section } from "@/components/site/Container";
import { SectionHeading } from "@/components/site/SectionHeading";
import { fixTypography } from "@/lib/format";
import type { FaqEntry } from "./managed";

/**
 * A page's questions (sell, contact): the heading on the left, the hairline
 * accordion on the right. Nothing renders without questions — an empty
 * "FAQ" heading is worse than none.
 */
export function FaqSection({
  id,
  eyebrow,
  heading,
  items,
  tone = "ivory",
}: {
  id: string;
  eyebrow: string;
  heading: string;
  items: readonly FaqEntry[];
  tone?: "ivory" | "ivory-2";
}) {
  if (items.length === 0) return null;

  const entries: AccordionItem[] = items.map((item) => ({
    id: item.id,
    question: <span lang={item.question.lang}>{fixTypography(item.question.text)}</span>,
    answer: (
      <p lang={item.answer.lang} className="text-pretty">
        {fixTypography(item.answer.text)}
      </p>
    ),
  }));

  return (
    <Section tone={tone} aria-labelledby={id}>
      <Container>
        <Grid className="gap-y-12">
          <div className="col-span-4 lg:col-span-4">
            <SectionHeading id={id} eyebrow={eyebrow} title={heading} size="h2" />
          </div>
          <div className="col-span-4 lg:col-span-7 lg:col-start-6">
            <Accordion items={entries} />
          </div>
        </Grid>
      </Container>
    </Section>
  );
}
