import { foldDiacritics } from "./slug";

export function words(input: string): string[] {
  // Unicode-aware: a Russian client's Cyrillic name must stay searchable.
  return foldDiacritics(input)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 0);
}

/** `+381 60 123 4567` → `381601234567` and `0601234567`, so either form matches. */
function phoneVariants(phone: string): string[] {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 0) return [];
  const out = [digits];
  if (digits.startsWith("381")) out.push(`0${digits.slice(3)}`);
  else if (digits.startsWith("0")) out.push(`381${digits.slice(1)}`);
  return out;
}

/**
 * The folded haystack behind the `search_text` index: name and email words
 * (č→c, đ→dj…) plus the phone digits in international and national form.
 * Every path that writes a contact's name, email or phone should store it.
 */
export function contactSearchText(contact: {
  name: string;
  email?: string;
  phone?: string;
}): string {
  const seen = new Set<string>([
    ...words(contact.name),
    ...(contact.email !== undefined ? words(contact.email) : []),
    ...(contact.phone !== undefined ? phoneVariants(contact.phone) : []),
  ]);
  return [...seen].join(" ");
}
