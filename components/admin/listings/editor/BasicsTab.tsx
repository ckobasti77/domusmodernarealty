"use client";

import { useQuery } from "convex/react";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import {
  PROPERTY_TYPE_LABEL,
  SUBTYPE_LABEL,
  TRANSACTION_LABEL,
  VISIBILITY_LABEL,
} from "@/lib/admin/labels";
import { useEditor, type EditorData } from "./editor-context";
import { Field, Group, SelectField, SwitchField, TabPanel, optionsOf } from "./fields";

const TRANSACTION_OPTIONS = optionsOf(TRANSACTION_LABEL);
const TYPE_OPTIONS = optionsOf(PROPERTY_TYPE_LABEL);
const SUBTYPE_OPTIONS = optionsOf(SUBTYPE_LABEL);
const VISIBILITY_OPTIONS = optionsOf(VISIBILITY_LABEL);

export function BasicsTab({ data }: { data: EditorData }) {
  const { canAssignAgent } = useEditor();
  const agents = useQuery(api.agentsAdmin.list, canAssignAgent ? {} : "skip");
  const agentOptions =
    agents === undefined
      ? [{ value: data.listing.agentId, label: data.agentName }]
      : agents.map((agent) => ({
          value: agent._id,
          label: agent.isPublic ? agent.name : `${agent.name} (nije vidljiv na sajtu)`,
        }));

  return (
    <TabPanel
      id="panel-osnovno"
      title="Osnovno"
      description="Vrsta ponude, tip nekretnine, zaduženi agent i vidljivost na sajtu."
    >
      <Group title="Ponuda">
        <SelectField name="transaction" id="f-transaction" label="Transakcija" options={TRANSACTION_OPTIONS} />
        <SelectField name="propertyType" id="f-propertyType" label="Tip nekretnine" options={TYPE_OPTIONS} />
        <SelectField
          name="subtype"
          id="f-subtype"
          label="Podtip"
          options={SUBTYPE_OPTIONS}
          noneLabel="—"
          hint="Opciono: garsonjera, penthaus, vila…"
        />
        <Field id="f-ref" label="Šifra" hint="Dodeljuje se automatski i ne menja se.">
          <Input id="f-ref" value={data.listing.ref} readOnly aria-describedby="f-ref-hint" className="font-mono" />
        </Field>
      </Group>

      <Group title="Agent i isticanje">
        {canAssignAgent ? (
          <SelectField
            name="agentId"
            id="f-agentId"
            label="Agent"
            options={agentOptions}
            hint="Agent se prikazuje na oglasu i prima upite i zahteve za razgledanje."
          />
        ) : (
          <Field id="f-agentId" label="Agent" hint="Nekretninu može preraspodeliti menadžer ili administrator.">
            <Input id="f-agentId" value={data.agentName} readOnly aria-describedby="f-agentId-hint" />
          </Field>
        )}
        <SwitchField
          name="isExclusive"
          id="f-isExclusive"
          label="Ekskluzivno"
          hint="Oglas nosi oznaku „Ekskluzivno” (samo naša agencija posreduje)."
        />
        <SwitchField
          name="isFeatured"
          id="f-isFeatured"
          label="Istaknuto na naslovnoj"
          hint="Prikazuje se u izboru na početnoj strani dok je objavljena."
        />
      </Group>

      <Group
        title="Vidljivost"
        description="Na sajtu je samo nekretnina sa vidljivošću „Javna” i statusom Objavljeno, Rezervisano, Prodato ili Izdato. „Skrivena iz pretrage” i „Privatna” je sklanjaju sa sajta; tim je i dalje vidi preko linka za pregled."
      >
        <SelectField
          name="visibility"
          id="f-visibility"
          label="Vidljivost"
          options={VISIBILITY_OPTIONS}
          hint={
            data.listing.visibility === "public"
              ? undefined
              : "„Javna” se čuva tek kada su ispunjeni svi uslovi za objavu (odeljak „Objava”); inače ostaje prethodna vrednost."
          }
        />
      </Group>
    </TabPanel>
  );
}
