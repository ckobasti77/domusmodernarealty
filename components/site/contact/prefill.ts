/** `leads.createGeneral` message bounds; the contact form checks them first. */
export const CONTACT_MESSAGE = { min: 10, max: 2000 } as const;

/**
 * The `?message=` a link can open the contact form with (the empty search
 * result's "tell us what you are looking for"): the first value, trimmed and
 * cut to what the form accepts. Anything else opens an empty form.
 */
export function prefillMessage(param: string | string[] | undefined): string {
  const value = Array.isArray(param) ? param[0] : param;
  return (value ?? "").trim().slice(0, CONTACT_MESSAGE.max).trimEnd();
}
