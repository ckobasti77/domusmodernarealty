import { describe, expect, it } from "vitest";
import { fixTypography, parseLocaleNumber } from "./format";

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

  it("leaves a digit followed by an ordinary word alone", () => {
    expect(fixTypography("zgrada iz 1938 godine")).toBe(`zgrada iz${NBSP}1938 godine`);
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
