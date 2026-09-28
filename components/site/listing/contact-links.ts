/**
 * Deep links for the agent's channels. Numbers are stored for humans
 * ("+381 11 000 0011"); each scheme wants digits only.
 */
function digits(phone: string): string {
  return phone.replace(/[^\d+]/g, "").replace(/^00/, "+");
}

export function telHref(phone: string): string {
  return `tel:${digits(phone)}`;
}

/** Viber wants the number with its `+`, URL-encoded. */
export function viberHref(phone: string): string {
  const number = digits(phone);
  return `viber://chat?number=${encodeURIComponent(number.startsWith("+") ? number : `+${number}`)}`;
}

/** wa.me wants the international number with no `+`, spaces or dashes. */
export function whatsappHref(phone: string, text?: string): string {
  const number = digits(phone).replace(/^\+/, "");
  return `https://wa.me/${number}${text !== undefined ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function mailHref(email: string, subject: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}`;
}
