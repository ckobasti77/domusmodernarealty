"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Info, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "@/lib/admin/zod";
import { PageHeader } from "@/components/admin/common/PageHeader";
import { QueryErrorBoundary } from "@/components/admin/common/QueryErrorBoundary";
import { RequireRole } from "@/components/admin/common/RequireRole";
import { hasRole, LISTING_ROLES, MANAGER_ROLES, useMe, type Me } from "@/components/admin/shell/me";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { PropertyType, Transaction } from "@/convex/lib/validators";
import { adminErrorMessage } from "@/lib/admin/errors";
import { PROPERTY_TYPE_LABEL, TRANSACTION_LABEL } from "@/lib/admin/labels";
import { TITLE_MAX, TITLE_MIN_SR as TITLE_MIN } from "@/lib/admin/listing-form";
import { LISTINGS_PATH, PROPERTY_TYPES, TRANSACTIONS, isPropertyType, isTransaction } from "./table/filters";
import type { AgentOption } from "./table/types";

type City = FunctionReturnType<typeof api.locations.tree>[number];

const DEFAULT_CITY_SLUG = "beograd";

/**
 * Ids are checked against the options actually offered, so the values handed to
 * `listingsAdmin.create` are known ids, not arbitrary strings.
 */
function makeSchema(cityIds: ReadonlySet<string>, agentIds: ReadonlySet<string>) {
  return z.object({
    transaction: z.custom<Transaction>(isTransaction, "Izaberite transakciju."),
    propertyType: z.custom<PropertyType>(isPropertyType, "Izaberite tip nekretnine."),
    cityId: z.custom<Id<"locations">>(
      (value) => typeof value === "string" && cityIds.has(value),
      "Izaberite grad.",
    ),
    agentId: z.custom<Id<"agents">>(
      (value) => typeof value === "string" && agentIds.has(value),
      "Izaberite agenta.",
    ),
    title: z
      .string()
      .trim()
      .min(TITLE_MIN, `Naslov mora imati najmanje ${TITLE_MIN} znakova.`)
      .max(TITLE_MAX, `Naslov može imati najviše ${TITLE_MAX} znakova.`),
  });
}

type Values = z.infer<ReturnType<typeof makeSchema>>;

function FieldError({ id, message }: { id: string; message: string | undefined }) {
  if (message === undefined) return null;
  return (
    <p id={id} className="text-xs text-destructive">
      {message}
    </p>
  );
}

function describedBy(...ids: (string | false | undefined)[]): string | undefined {
  const list = ids.filter((id): id is string => typeof id === "string" && id.length > 0);
  return list.length > 0 ? list.join(" ") : undefined;
}

function pickDefaultAgent(me: Me, agents: readonly AgentOption[] | null): Id<"agents"> | undefined {
  if (agents === null) return me.agentId;
  return (agents.find((agent) => agent.isPublic) ?? agents[0])?._id;
}

function NewListingForm({
  me,
  cities,
  agents,
}: {
  me: Me;
  cities: readonly City[];
  /** Agents a manager may pick from; `null` for an agent (fixed to their own profile). */
  agents: readonly AgentOption[] | null;
}) {
  const router = useRouter();
  const create = useMutation(api.listingsAdmin.create);
  const [formError, setFormError] = useState<string | null>(null);

  const schema = useMemo(() => {
    const agentIds = new Set<string>(
      agents === null ? (me.agentId !== undefined ? [me.agentId] : []) : agents.map((a) => a._id),
    );
    return makeSchema(new Set(cities.map((city) => city._id)), agentIds);
  }, [agents, cities, me.agentId]);

  const defaultCity = cities.find((city) => city.slug === DEFAULT_CITY_SLUG) ?? cities[0];
  const defaultAgent = pickDefaultAgent(me, agents);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      transaction: "sale",
      propertyType: "apartment",
      ...(defaultCity !== undefined ? { cityId: defaultCity._id } : {}),
      ...(defaultAgent !== undefined ? { agentId: defaultAgent } : {}),
      title: "",
    },
  });
  const { errors, isSubmitting, isSubmitSuccessful } = form.formState;
  const title = useWatch({ control: form.control, name: "title" }) ?? "";
  const unlinkedAgent = agents === null && me.agentId === undefined;
  const noAgents = agents !== null && agents.length === 0;

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      const result = await create({
        transaction: values.transaction,
        propertyType: values.propertyType,
        cityId: values.cityId,
        agentId: values.agentId,
        titleSr: values.title,
      });
      toast.success(`Nacrt ${result.ref} je kreiran.`);
      router.push(`/admin/nekretnine/${result.id}`);
    } catch (error) {
      const message = adminErrorMessage(error);
      setFormError(message);
      toast.error(message);
    }
  });

  return (
    <form
      data-testid="new-listing-form"
      onSubmit={onSubmit}
      noValidate
      aria-describedby={formError !== null ? "new-listing-error" : undefined}
    >
      <Card className="max-w-2xl">
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <div className="grid content-start gap-2">
            <Label htmlFor="new-transaction">Transakcija</Label>
            <Controller
              control={form.control}
              name="transaction"
              render={({ field, fieldState }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={field.disabled}>
                  <SelectTrigger
                    id="new-transaction"
                    data-testid="new-transaction"
                    className="w-full"
                    ref={field.ref}
                    onBlur={field.onBlur}
                    aria-invalid={fieldState.invalid}
                    aria-describedby={describedBy(fieldState.invalid && "new-transaction-error")}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSACTIONS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {TRANSACTION_LABEL[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError id="new-transaction-error" message={errors.transaction?.message} />
          </div>

          <div className="grid content-start gap-2">
            <Label htmlFor="new-type">Tip nekretnine</Label>
            <Controller
              control={form.control}
              name="propertyType"
              render={({ field, fieldState }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={field.disabled}>
                  <SelectTrigger
                    id="new-type"
                    data-testid="new-type"
                    className="w-full"
                    ref={field.ref}
                    onBlur={field.onBlur}
                    aria-invalid={fieldState.invalid}
                    aria-describedby={describedBy(fieldState.invalid && "new-type-error")}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {PROPERTY_TYPE_LABEL[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError id="new-type-error" message={errors.propertyType?.message} />
          </div>

          <div className="grid content-start gap-2">
            <Label htmlFor="new-city">Grad</Label>
            <Controller
              control={form.control}
              name="cityId"
              render={({ field, fieldState }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange} disabled={field.disabled}>
                  <SelectTrigger
                    id="new-city"
                    data-testid="new-city"
                    className="w-full"
                    ref={field.ref}
                    onBlur={field.onBlur}
                    aria-invalid={fieldState.invalid}
                    aria-describedby={describedBy("new-city-hint", fieldState.invalid && "new-city-error")}
                  >
                    <SelectValue placeholder="Izaberite grad" />
                  </SelectTrigger>
                  <SelectContent>
                    {cities.map((city) => (
                      <SelectItem key={city._id} value={city._id}>
                        {city.name.sr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <p id="new-city-hint" className="text-xs text-muted-foreground">
              Opštinu, naselje i tačnu lokaciju birate u uređivaču.
            </p>
            <FieldError id="new-city-error" message={errors.cityId?.message} />
          </div>

          <div className="grid content-start gap-2">
            <Label htmlFor="new-agent">Agent</Label>
            {agents === null ? (
              <>
                <Input
                  id="new-agent"
                  value={me.agentName ?? "Profil agenta nije povezan"}
                  readOnly
                  aria-readonly="true"
                  aria-invalid={unlinkedAgent}
                  aria-describedby="new-agent-hint"
                  className="bg-muted/50"
                />
                <p
                  id="new-agent-hint"
                  className={unlinkedAgent ? "text-xs text-destructive" : "text-xs text-muted-foreground"}
                >
                  {unlinkedAgent
                    ? "Vaš nalog nije povezan sa profilom agenta. Obratite se administratoru."
                    : "Nekretnina se vodi na Vašem profilu."}
                </p>
              </>
            ) : (
              <>
                <Controller
                  control={form.control}
                  name="agentId"
                  render={({ field, fieldState }) => (
                    <Select
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                      disabled={field.disabled || noAgents}
                    >
                      <SelectTrigger
                        id="new-agent"
                        className="w-full"
                        ref={field.ref}
                        onBlur={field.onBlur}
                        aria-invalid={fieldState.invalid || noAgents}
                        aria-describedby={describedBy(
                          noAgents && "new-agent-hint",
                          fieldState.invalid && "new-agent-error",
                        )}
                      >
                        <SelectValue placeholder="Izaberite agenta" />
                      </SelectTrigger>
                      <SelectContent>
                        {agents.map((agent) => (
                          <SelectItem key={agent._id} value={agent._id}>
                            {agent.isPublic ? agent.name : `${agent.name} (skriven profil)`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {noAgents ? (
                  <p id="new-agent-hint" className="text-xs text-destructive">
                    Nema ni jednog agenta. Prvo dodajte agenta u Tim.
                  </p>
                ) : null}
                <FieldError id="new-agent-error" message={errors.agentId?.message} />
              </>
            )}
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="new-title">Naslov na srpskom</Label>
              <span
                className={
                  title.trim().length > TITLE_MAX
                    ? "text-xs text-destructive tabular-nums"
                    : "text-xs text-muted-foreground tabular-nums"
                }
                aria-hidden="true"
              >
                {title.trim().length}/{TITLE_MAX}
              </span>
            </div>
            <Input
              id="new-title"
              autoComplete="off"
              aria-invalid={errors.title !== undefined}
              aria-describedby={describedBy("new-title-hint", errors.title !== undefined && "new-title-error")}
              {...form.register("title")}
            />
            <p id="new-title-hint" className="text-xs text-muted-foreground">
              Npr. Trosoban stan na Vračaru sa terasom. Od {TITLE_MIN} do {TITLE_MAX} znakova; kasnije ga možete
              menjati i prevesti.
            </p>
            <FieldError id="new-title-error" message={errors.title?.message} />
          </div>

          {formError !== null ? (
            <p
              id="new-listing-error"
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive sm:col-span-2"
            >
              {formError}
            </p>
          ) : null}
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button variant="ghost" asChild>
            <Link href={LISTINGS_PATH}>Otkaži</Link>
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || isSubmitSuccessful || unlinkedAgent || noAgents}
          >
            {isSubmitting || isSubmitSuccessful ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : null}
            Kreiraj nacrt
          </Button>
        </CardFooter>
      </Card>

      <p className="mt-4 flex max-w-2xl gap-2 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          Nekretnina počinje kao privatni nacrt i nije vidljiva na sajtu. Objavljuje se tek kada prođe kontrolnu
          listu: ugovor o posredovanju, cena, lokacija, kvadratura, struktura, najmanje 5 fotografija, naslov i opis
          na srpskom.
        </span>
      </p>
    </form>
  );
}

function FormSkeleton() {
  return (
    <div className="max-w-2xl rounded-xl bg-card p-4 ring-1 ring-foreground/10" aria-busy="true">
      <span className="sr-only">Učitavanje…</span>
      <div className="grid gap-5 sm:grid-cols-2" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="grid gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
        <div className="grid gap-2 sm:col-span-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-full" />
        </div>
      </div>
    </div>
  );
}

function NewListingLoader() {
  const me = useMe();
  const canManage = hasRole(me, MANAGER_ROLES);
  const locations = useQuery(api.locations.tree, {});
  const agents = useQuery(api.agentsAdmin.list, canManage ? {} : "skip");

  const cities = useMemo(
    () =>
      locations
        ?.filter((location) => location.kind === "city")
        .sort((a, b) => a.order - b.order),
    [locations],
  );

  if (cities === undefined || (canManage && agents === undefined)) return <FormSkeleton />;
  return <NewListingForm me={me} cities={cities} agents={canManage ? (agents ?? []) : null} />;
}

/** `/admin/nekretnine/nova` — a compact form that creates a private draft. */
export function NewListingScreen() {
  return (
    <RequireRole roles={LISTING_ROLES}>
      <PageHeader
        title="Nova nekretnina"
        description="Unesite osnovne podatke. Sve ostalo dopunjujete u uređivaču, koji se otvara odmah posle kreiranja."
      />
      <QueryErrorBoundary backHref={LISTINGS_PATH} backLabel="Nazad na nekretnine">
        <NewListingLoader />
      </QueryErrorBoundary>
    </RequireRole>
  );
}
