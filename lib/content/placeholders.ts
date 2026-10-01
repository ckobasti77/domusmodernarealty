/**
 * Managed page texts (legal pages, about, contact) refer to the agency's
 * registered data through placeholders — `{{companyName}}`, `{{address}}`,
 * `{{pib}}`, `{{mb}}`, `{{registryNo}}`, `{{email}}` — so the owner edits the
 * legal name or the registry number once, in Podešavanja, and every page
 * follows. Values are HTML-escaped because they land inside rich text; an
 * unknown placeholder or a missing setting is left out rather than shown raw.
 */

export type PlaceholderValues = {
  companyName: string;
  legalName: string;
  address: string;
  pib: string;
  mb: string;
  registryNo: string;
  email: string;
};

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

const PLACEHOLDER = /\{\{\s*([a-zA-Z]+)\s*\}\}/g;

/** Replaces the placeholders in `text`; `html` escapes the inserted values. */
export function fillPlaceholders(text: string, values: PlaceholderValues | null, html = true): string {
  return text.replace(PLACEHOLDER, (_match, name: string) => {
    if (values === null || !Object.hasOwn(values, name)) return "";
    const value = values[name as keyof PlaceholderValues].trim();
    return html ? escapeHtml(value) : value;
  });
}

/** The placeholder values from the public settings (`null` while settings are unreachable). */
export function placeholderValues(
  settings: {
    companyName: string;
    legalName: string;
    address: string;
    pib: string;
    mb: string;
    registryNo: string;
    email: string;
  } | null,
): PlaceholderValues | null {
  if (settings === null) return null;
  return {
    companyName: settings.companyName,
    legalName: settings.legalName,
    address: settings.address,
    pib: settings.pib,
    mb: settings.mb,
    registryNo: settings.registryNo,
    email: settings.email,
  };
}
