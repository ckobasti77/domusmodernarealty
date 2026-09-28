"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Tabs } from "@/components/site/Tabs";
import type { Id } from "@/convex/_generated/dataModel";
import { InquiryForm } from "./InquiryForm";
import { ViewingForm } from "./ViewingForm";

type Tab = "inquiry" | "viewing";

/**
 * The listing's contact section: inquiry and viewing booking behind two tabs.
 * Any link carrying `data-contact-tab` (the agent card's buttons, the mobile
 * bar's "Zakaži") switches the tab as it scrolls here, and a visitor arriving
 * on `#razgledanje` lands on the booking tab.
 */
export function ContactForms({
  listingId,
  agentId,
  refCode,
}: {
  listingId: Id<"listings">;
  agentId: Id<"agents">;
  refCode: string;
}) {
  const t = useTranslations("listing");
  const [tab, setTab] = useState<Tab>("inquiry");

  useEffect(() => {
    const fromHash = () => {
      if (window.location.hash === "#razgledanje") setTab("viewing");
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("[data-contact-tab]") : null;
      const value = target?.getAttribute("data-contact-tab");
      if (value === "inquiry" || value === "viewing") setTab(value);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("hashchange", fromHash);
      document.removeEventListener("click", onClick);
    };
  }, []);

  return (
    <section id="kontakt" aria-labelledby="contact-heading" className="scroll-mt-28">
      <span id="razgledanje" className="block scroll-mt-28" aria-hidden="true" />
      <h2 id="contact-heading" className="font-display text-h2">
        {t("contactHeading")}
      </h2>
      <Tabs
        className="mt-6"
        ariaLabel={t("formTabs.label")}
        value={tab}
        onValueChange={(value) => setTab(value === "viewing" ? "viewing" : "inquiry")}
        tabs={[
          {
            value: "inquiry",
            label: t("formTabs.inquiry"),
            content: <InquiryForm listingId={listingId} refCode={refCode} />,
          },
          {
            value: "viewing",
            label: t("formTabs.viewing"),
            content: <ViewingForm listingId={listingId} agentId={agentId} />,
          },
        ]}
      />
    </section>
  );
}
