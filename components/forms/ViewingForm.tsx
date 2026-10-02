"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "convex/react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod/mini";
import { Button } from "@/components/site/Button";
import { RadioField, TextAreaField, TextField } from "@/components/site/Field";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useHydrated } from "@/hooks/useHydrated";
import type { Locale } from "@/i18n/routing";
import { BOOKING_DAYS } from "@/convex/lib/belgradeTime";
import { BELGRADE_TZ, belgradeDayKey, nextBelgradeDays } from "@/lib/belgrade-time";
import { errorCode, errorMessageKey } from "@/lib/errors";
import { getSessionKey } from "@/lib/session";
import { cn } from "@/lib/utils";
import { isBookableStart, offeredSlotsByDay, type ViewingSlot } from "@/lib/viewing-slots";
import { ConsentFields, contactFields, FormError, SuccessPanel, useSuccessFocus } from "./shared";

/**
 * Viewing booking (PRD A5) → `viewings.request`, which creates the viewing
 * (status "requested") plus a lead.
 *
 * Slots come from `agents.slots`: the agent's weekly hours minus requested and
 * confirmed viewings. Hours are Belgrade wall-clock time and the server does
 * every time-zone calculation itself (DST included), so the widget only names
 * the first day and shows the times in Europe/Belgrade, saying so.
 *
 * The widget's clock keeps running: a page left open would otherwise go on
 * offering slots that have slipped inside the booking lead time, which the
 * server refuses. A picked slot that slips away, or that someone else books
 * meanwhile, is dropped with a message, and the exact time is checked once
 * more before the request goes out.
 */

/** "Now" to the minute: the instant the slot list is filtered against. */
function currentMinute(): number {
  return Math.floor(Date.now() / 60_000) * 60_000;
}

/** The last check before a request goes out: against the exact time, not the list's minute. */
function bookableNow(start: number): boolean {
  return isBookableStart(start, Date.now());
}

/**
 * Ticks every 30 s and catches up at once when the tab comes back to the
 * foreground (background timers are throttled). `refresh` takes a reading on
 * demand.
 */
function useMinuteClock(): { now: number; refresh: () => void } {
  const [now, setNow] = useState(currentMinute);
  const refresh = useCallback(() => setNow(currentMinute()), []);
  useEffect(() => {
    const timer = window.setInterval(refresh, 30_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);
  return { now, refresh };
}

function useSlots(agentId: Id<"agents">, now: number) {
  const days = nextBelgradeDays(now, BOOKING_DAYS);
  const slots = useQuery(api.agents.slots, { agentId, fromDay: days[0].start, days: BOOKING_DAYS });
  return { days, byDay: offeredSlotsByDay(slots ?? [], now), loading: slots === undefined };
}

export function ViewingForm({ listingId, agentId }: { listingId: Id<"listings">; agentId: Id<"agents"> }) {
  const hydrated = useHydrated();
  const t = useTranslations("forms");
  // The slot list depends on "now", which the server and the browser disagree
  // on; rendering it only after hydration keeps the markup deterministic.
  if (!hydrated) {
    return <p className="text-small text-stone-text">{t("viewingTimezone")}</p>;
  }
  return <ViewingFormClient listingId={listingId} agentId={agentId} />;
}

function ViewingFormClient({ listingId, agentId }: { listingId: Id<"listings">; agentId: Id<"agents"> }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("forms");
  const tRoot = useTranslations();
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const request = useMutation(api.viewings.request);
  const clock = useMinuteClock();
  const { days, byDay, loading } = useSlots(agentId, clock.now);

  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<ViewingSlot | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [booked, setBooked] = useState<ViewingSlot | null>(null);
  const successRef = useSuccessFocus(booked !== null);

  const freeOn = (key: string) => (byDay.get(key) ?? []).some((item) => !item.taken);
  // A day picked before midnight leaves the strip once the clock passes it.
  const picked = pickedDay !== null && days.some((candidate) => candidate.key === pickedDay) ? pickedDay : null;
  const day = picked ?? days.find((candidate) => freeOn(candidate.key))?.key ?? days[0].key;
  const daySlots = byDay.get(day) ?? [];

  // The picked slot only while it is still offered and free: one that slips
  // inside the booking lead time, or that someone else books, drops out, and
  // the visitor is told rather than left with a request the server refuses.
  const selected =
    slot !== null && (byDay.get(belgradeDayKey(slot.start)) ?? []).some((item) => item.start === slot.start && !item.taken)
      ? slot
      : null;
  const slotGone = tRoot("errors.SLOT_TAKEN");
  const slotMessage = slot !== null && selected === null && !loading ? slotGone : slotError;

  const schema = z.object({
    ...contactFields(t),
    mode: z.enum(["in_person", "video"]),
    message: z.string().check(z.trim(), z.maxLength(1000, t("tooLong", { max: 1000 }))),
  });
  type Values = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", phone: "", mode: "in_person", message: "", privacy: false, marketing: false, hp: "" },
  });

  const time = (at: number) => format.dateTime(new Date(at), { hour: "2-digit", minute: "2-digit", timeZone: BELGRADE_TZ });
  const longDate = (at: number) =>
    format.dateTime(new Date(at), { weekday: "long", day: "numeric", month: "long", timeZone: BELGRADE_TZ });

  /** The picked slot is no longer available: clear it, re-read the clock, and say so by the submit button. */
  function dropSlot() {
    setSlot(null);
    clock.refresh();
    setServerError(slotGone);
  }

  async function onSubmit(values: Values) {
    setServerError(null);
    if (slot === null) {
      setSlotError(t("viewingSlotRequired"));
      return;
    }
    // The list can trail the clock by a tick, so the exact time decides.
    if ((selected === null && !loading) || !bookableNow(slot.start)) {
      dropSlot();
      return;
    }
    try {
      await request({
        sessionKey: getSessionKey(),
        locale,
        listingId,
        start: slot.start,
        end: slot.end,
        mode: values.mode,
        contact: {
          name: values.name,
          email: values.email,
          ...(values.phone.length > 0 ? { phone: values.phone } : {}),
        },
        ...(values.message.length > 0 ? { message: values.message } : {}),
        privacy: values.privacy,
        marketing: values.marketing,
        hp: values.hp,
      });
      setBooked(slot);
    } catch (error) {
      // Taken a moment ago, or inside the lead time by the server's clock.
      if (errorCode(error) === "SLOT_TAKEN") dropSlot();
      else setServerError(tRoot(errorMessageKey(error)));
    }
  }

  if (booked !== null) {
    return (
      <div ref={successRef} tabIndex={-1} className="scroll-mt-28 outline-none">
        <SuccessPanel
          heading={t("viewingSuccessHeading")}
          body={t("successViewing")}
          detail={t("viewingSelected", { date: longDate(booked.start), time: time(booked.start) })}
        />
      </div>
    );
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="relative flex flex-col gap-6" data-testid="viewing-form">
      <fieldset>
        <legend className="font-sans text-label font-medium uppercase tracking-[0.12em] text-stone-text">
          {t("viewingDate")}
        </legend>
        {/* No `data-lenis-prevent`: Lenis lets horizontal gestures through by
            itself, and its `overscroll-behavior: contain` would stop a vertical
            wheel over the strip from scrolling the page. */}
        <ul className="-mx-1 mt-3 flex gap-2 overflow-x-auto overscroll-x-contain px-1 pb-2">
          {days.map((candidate) => {
            const noon = candidate.start + 12 * 60 * 60_000;
            const free = freeOn(candidate.key);
            const active = candidate.key === day;
            return (
              <li key={candidate.key} className="shrink-0">
                <button
                  type="button"
                  data-day={candidate.key}
                  disabled={!free}
                  aria-pressed={active}
                  onClick={() => {
                    setPickedDay(candidate.key);
                    setSlot(null);
                  }}
                  className={cn(
                    "flex w-16 flex-col items-center gap-0.5 border py-2.5 font-sans transition-colors duration-200",
                    active ? "border-ink bg-ink text-ivory" : "border-ink/30 text-ink pointer-fine:hover:border-bronze",
                    "disabled:border-ink/10 disabled:text-stone disabled:line-through",
                  )}
                >
                  <span className="text-label uppercase tracking-[0.12em]">
                    {format.dateTime(new Date(noon), { weekday: "short", timeZone: BELGRADE_TZ })}
                  </span>
                  <span data-numeric className="text-body-l font-medium">
                    {format.dateTime(new Date(noon), { day: "numeric", timeZone: BELGRADE_TZ })}
                  </span>
                  <span className="text-label">
                    {format.dateTime(new Date(noon), { month: "short", timeZone: BELGRADE_TZ })}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <fieldset aria-describedby="viewing-tz">
        <legend className="font-sans text-label font-medium uppercase tracking-[0.12em] text-stone-text">
          {t("viewingTime")}
        </legend>
        <p id="viewing-tz" className="mt-1 text-small text-stone-text">
          {t("viewingTimezone")}
        </p>
        {loading ? (
          <p className="mt-3 text-small text-stone-text">{tCommon("loading")}</p>
        ) : daySlots.length === 0 ? (
          <p className="mt-3 text-small text-ink">{t("viewingNoSlots")}</p>
        ) : (
          <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {daySlots.map((item) => {
              const active = selected?.start === item.start;
              return (
                <li key={item.start}>
                  <button
                    type="button"
                    data-slot={item.start}
                    disabled={item.taken}
                    aria-pressed={active}
                    onClick={() => {
                      setSlot(item);
                      setSlotError(null);
                      // A new pick answers a "no longer available" from the last submit.
                      setServerError(null);
                    }}
                    className={cn(
                      "flex min-h-11 w-full items-center justify-center border font-sans text-small transition-colors duration-200",
                      active ? "border-bronze-deep bg-bronze-deep text-paper" : "border-ink/30 text-ink pointer-fine:hover:border-bronze",
                      "disabled:border-ink/10 disabled:text-stone disabled:line-through",
                    )}
                  >
                    <span data-numeric>{time(item.start)}</span>
                    {item.taken ? <span className="sr-only"> ({t("slotTaken")})</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {selected !== null ? (
          <p className="mt-3 text-small text-ink" aria-live="polite">
            {t("viewingSelected", { date: longDate(selected.start), time: time(selected.start) })}
          </p>
        ) : null}
        {slotMessage !== null ? (
          <p role="alert" className="mt-3 text-small text-danger">
            {slotMessage}
          </p>
        ) : null}
      </fieldset>

      <RadioField
        label={t("mode")}
        options={[
          { value: "in_person", label: t("modeInPerson") },
          { value: "video", label: t("modeVideo") },
        ]}
        defaultValue="in_person"
        {...register("mode")}
      />

      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <TextField label={t("name")} autoComplete="name" error={errors.name?.message} {...register("name")} />
        <TextField
          label={`${t("phone")} (${t("optional")})`}
          type="tel"
          autoComplete="tel"
          error={errors.phone?.message}
          {...register("phone")}
        />
      </div>
      <TextField label={t("email")} type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
      <TextAreaField
        label={`${t("viewingMessage")} (${t("optional")})`}
        rows={2}
        error={errors.message?.message}
        {...register("message")}
      />
      <ConsentFields register={register} errors={errors} />
      <FormError message={serverError} />
      <Button type="submit" disabled={isSubmitting} className="self-start">
        {isSubmitting ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
