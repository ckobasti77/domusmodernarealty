import { describe, expect, it } from "vitest";
import { fixTypography, fixWidows, parseLocaleNumber } from "./format";

const NBSP = " ";

describe("fixTypography", () => {
  it("keeps numbers with their units", () => {
    expect(fixTypography("terasa od 9 m², park na 120 metara")).toBe(
      `terasa od${NBSP}9${NBSP}m², park na${NBSP}120${NBSP}metara`,
    );
  });

  it("binds one- and two-letter prepositions", () => {
    expect(fixTypography("stan u Neimaru sa terasom")).toBe(`stan u${NBSP}Neimaru sa${NBSP}terasom`);
    expect(fixTypography("квартира на Врачаре")).toBe(`квартира на${NBSP}Врачаре`);
  });

  it("keeps a time span with its unit", () => {
    expect(fixTypography("u roku od 24 sata")).toBe(`u${NBSP}roku od${NBSP}24${NBSP}sata`);
    expect(fixTypography("within 24 hours")).toBe(`within 24${NBSP}hours`);
    expect(fixTypography("в течение 24 часов")).toBe(`в${NBSP}течение 24${NBSP}часов`);
    expect(fixTypography("innerhalb von 24 Stunden")).toBe(`innerhalb von 24${NBSP}Stunden`);
  });

  it("leaves a digit followed by an ordinary word alone", () => {
    expect(fixTypography("zgrada iz 1938 godine")).toBe(`zgrada iz${NBSP}1938 godine`);
  });

  it("never ends a line on a numeric prefix and its hyphen", () => {
    const WJ = "⁠";
    expect(fixTypography("Grundriss und 360°-Tour")).toBe(`Grundriss und 360°-${WJ}Tour`);
    expect(fixTypography("Wer zahlt die 3D-Tour?")).toBe(`Wer zahlt die 3D-${WJ}Tour?`);
    expect(fixTypography("планировку и 360°-тур")).toBe(`планировку и${NBSP}360°-${WJ}тур`);
    expect(fixTypography("radno vreme 9-17")).toBe("radno vreme 9-17");
  });
});

describe("fixWidows", () => {
  it("joins a short last pair in a headline of three or more words", () => {
    expect(fixWidows("Poznajemo svaku ulicu.")).toBe(`Poznajemo svaku${NBSP}ulicu.`);
    expect(fixWidows("Koliko vredi Vaš stan?")).toBe(`Koliko vredi Vaš${NBSP}stan?`);
    expect(fixWidows("Dom koji se pamti.", 10)).toBe(`Dom koji se${NBSP}pamti.`);
  });

  it("leaves short headlines and long pairs alone", () => {
    expect(fixWidows("Izdvojene nekretnine")).toBe("Izdvojene nekretnine");
    expect(fixWidows("Ein Zuhause, das man nicht vergisst.", 10)).toBe("Ein Zuhause, das man nicht vergisst.");
  });

  it("keeps a conjunction together instead of forming a long unbreakable tail", () => {
    // "pre nego što" is one unit; the pair after it would be 20 characters, so it stays free.
    expect(fixWidows("Prošetajte pre nego što dođete.")).toBe(`Prošetajte pre${NBSP}nego${NBSP}što dođete.`);
  });

  it("still binds one-letter prepositions", () => {
    expect(fixWidows("Tržište i saveti")).toBe(`Tržište i${NBSP}saveti`);
  });
});

describe("parseLocaleNumber", () => {
  it("reads grouped and decimal input per locale", () => {
    expect(parseLocaleNumber("430.000", "sr-Latn")).toBe(430000);
    expect(parseLocaleNumber("5,4", "sr-Latn")).toBe(5.4);
    expect(parseLocaleNumber("430,000", "en")).toBe(430000);
    expect(parseLocaleNumber("5.4", "en")).toBe(5.4);
    expect(parseLocaleNumber("430 000", "ru")).toBe(430000);
    expect(parseLocaleNumber("5,4", "de")).toBe(5.4);
  });

  it("returns null for empty or junk input", () => {
    expect(parseLocaleNumber("", "sr-Latn")).toBeNull();
    expect(parseLocaleNumber("abc", "en")).toBeNull();
  });
});

describe("fixTypography prefixes", () => {
  it("keeps a one-letter prefix with its word", () => {
    const joiner = String.fromCharCode(0x2060);
    expect(fixTypography("pišite na e-poštu")).toContain(`e-${joiner}poštu`);
    expect(fixTypography("by e-mail")).toBe(`by e-${joiner}mail`);
    expect(fixTypography("well-known")).toBe("well-known");
  });
});
