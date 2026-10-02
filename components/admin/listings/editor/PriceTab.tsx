"use client";

import { useWatch } from "react-hook-form";
import { formatEurPerM2 } from "@/lib/admin/format";
import { L10N_LABEL } from "@/lib/admin/labels";
import type { ListingForm } from "@/lib/admin/listing-form";
import { useEditor, type EditorData } from "./editor-context";
import { Group, NumberField, SwitchField, TabPanel, TextAreaField, TriStateField } from "./fields";
import { LOCALE_LANG, LocaleTabs } from "./LocaleTabs";
import { PriceHistoryList } from "./PriceHistory";

export function PriceTab({ data }: { data: EditorData }) {
  const { engine } = useEditor();
  const [transaction, constructionType] = useWatch<ListingForm, ["transaction", "constructionType"]>({
    name: ["transaction", "constructionType"],
  });
  const rent = transaction === "rent";
  const newBuild = constructionType === "new" || constructionType === "under_construction";

  return (
    <TabPanel
      id="panel-cena"
      title="Cena"
      description="Cena i cena po m² stoje na oglasu (čl. 18 Zakona o posredovanju). Promene cene se beleže automatski."
    >
      <Group title={rent ? "Zakupnina" : "Cena"}>
        <NumberField
          name="price"
          id="f-price"
          label={rent ? "Mesečna zakupnina (€)" : "Cena (€)"}
          unit="€"
          hint={<PricePerM2 rent={rent} />}
          onBlur={() => engine.schedule(250)}
        />
        <SwitchField name="urgent" id="f-urgent" label={rent ? "Hitno izdavanje" : "Hitna prodaja"} />
        {rent ? null : (
          <>
            <SwitchField
              name="mortgageEligible"
              id="f-mortgageEligible"
              label="Pogodno za kredit"
              hint="Nekretnina se može kupiti uz stambeni kredit."
            />
            <SwitchField
              name="developerInstallments"
              id="f-developerInstallments"
              label="Plaćanje na rate (investitor)"
            />
          </>
        )}
        {!rent && newBuild ? (
          <>
            <SwitchField
              name="vatIncluded"
              id="f-vatIncluded"
              label="PDV uključen u cenu"
              hint="Isključite ako je cena iskazana bez PDV-a; kalkulator troškova na oglasu tada dodaje PDV."
            />
            <SwitchField
              name="vatRefundEligible"
              id="f-vatRefundEligible"
              label="Povraćaj PDV-a"
              hint="Kupac prvog stana može ostvariti povraćaj PDV-a."
            />
          </>
        ) : null}
      </Group>

      {rent ? (
        <Group title="Uslovi zakupa">
          <NumberField name="rent.deposit" id="f-rent-deposit" label="Depozit" unit="€" />
          <NumberField name="rent.minLeaseMonths" id="f-rent-minLeaseMonths" label="Minimalni zakup" unit="meseci" />
          <TriStateField
            name="rent.petsAllowed"
            id="f-rent-petsAllowed"
            label="Kućni ljubimci"
            yesLabel="Dozvoljeni"
            noLabel="Nisu dozvoljeni"
          />
          <TriStateField
            name="rent.utilitiesIncluded"
            id="f-rent-utilitiesIncluded"
            label="Režije uključene u zakupninu"
            yesLabel="Uključene"
            noLabel="Nisu uključene"
          />
        </Group>
      ) : null}

      <Group title="Mesečni troškovi" description="Na oglasu se prikazuju kao okvirni mesečni izdaci.">
        <NumberField name="costs.infostan" id="f-costs-infostan" label="Infostan" unit="€ / mes." />
        <NumberField name="costs.maintenance" id="f-costs-maintenance" label="Održavanje zgrade" unit="€ / mes." />
        {rent ? null : (
          <SwitchField
            name="costs.utilitiesIncluded"
            id="f-costs-utilitiesIncluded"
            label="Režije uključene"
            hint="Iznosi već sadrže struju, vodu i grejanje."
          />
        )}
      </Group>

      <CommissionGroup />

      <Group title="Istorija cene" layout="stack" description="Promene cene se beleže automatski, sa datumom.">
        <PriceHistoryList items={data.priceHistory} />
      </Group>
    </TabPanel>
  );
}

/** The €/m² figure that must sit next to every price, live while typing. */
function PricePerM2({ rent }: { rent: boolean }) {
  const [price, area] = useWatch<ListingForm, ["price", "areaM2"]>({ name: ["price", "areaM2"] });
  if (typeof price !== "number" || !(price > 0) || typeof area !== "number" || !(area > 0)) {
    return <>Cena po m² se računa kada unesete cenu i kvadraturu.</>;
  }
  return (
    <span className="tabular-nums">
      ≈ {formatEurPerM2(price / area)}
      {rent ? " mesečno" : ""} · Čuva se kad završite unos.
    </span>
  );
}

function CommissionGroup() {
  return (
    <Group
      title="Tekst o proviziji"
      layout="stack"
      description="Opciono. Ako ostane prazno, na oglasu se prikazuje opšti tekst o proviziji iz Podešavanja."
    >
      <LocaleTabs label="Jezik teksta o proviziji">
        {(locale) => (
          <TextAreaField
            name={`commissionText.${locale}`}
            id={`f-commissionText-${locale}`}
            label={`Provizija — ${L10N_LABEL[locale].toLowerCase()}`}
            lang={LOCALE_LANG[locale]}
            rows={3}
            counter={{ max: 500 }}
          />
        )}
      </LocaleTabs>
    </Group>
  );
}
