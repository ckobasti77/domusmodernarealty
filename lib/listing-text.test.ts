import { describe, expect, it } from "vitest";
import { clipTitle } from "./listing-text";

describe("clipTitle", () => {
  it("keeps a title that fits", () => {
    expect(clipTitle("Penthaus na Crvenom krstu sa terasom od 44 m²")).toEqual({
      text: "Penthaus na Crvenom krstu sa terasom od 44 m²",
      clipped: false,
    });
  });

  it("prefers a late comma", () => {
    expect(clipTitle("Trosoban stan u novogradnji na Grbavici, sa pravom na povraćaj PDV-a").text).toBe(
      "Trosoban stan u novogradnji na Grbavici…",
    );
    expect(clipTitle("Penthaus na 24. spratu u Beogradu na vodi, pogled na Savu", 52).text).toBe(
      "Penthaus na 24. spratu u Beogradu na vodi…",
    );
  });

  it("never ends on a preposition or on 'and' plus one word", () => {
    expect(clipTitle("Vila na Senjaku sa baštom, bazenom i pogledom na Topčider").text).toBe(
      "Vila na Senjaku sa baštom, bazenom…",
    );
    expect(clipTitle("Penthaus na Lionu, 94 m² sa terasom od 38 m² nad Zvezdarskom šumom").text).toBe(
      "Penthaus na Lionu, 94 m² sa terasom od 38 m²…",
    );
    expect(clipTitle("New-build three-room apartment on Grbavica with the VAT refund available").text).toBe(
      "New-build three-room apartment on Grbavica…",
    );
  });
});
