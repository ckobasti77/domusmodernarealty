import { describe, expect, it } from "vitest";
import { fromDateInput, fromNumberInput, toDateInput, toNumberInput } from "./format";

describe("fromDateInput", () => {
  it("stores a day at Belgrade noon and reads it back", () => {
    const ms = fromDateInput("2026-10-15");
    expect(ms).toBe(Date.UTC(2026, 9, 15, 10));
    expect(toDateInput(ms)).toBe("2026-10-15");
    // The day the clocks go back keeps its date.
    expect(toDateInput(fromDateInput("2026-10-25"))).toBe("2026-10-25");
  });

  it("refuses the years a date input passes through while the year is typed", () => {
    // Chromium reports these as the four digits of the year are typed one by one.
    for (const partial of ["0002-10-15", "0020-10-15", "0202-10-15", "0999-12-31"]) {
      expect(fromDateInput(partial)).toBeUndefined();
    }
    expect(fromDateInput("1000-01-01")).toBe(Date.UTC(1000, 0, 1, 10));
  });

  it("refuses dates that do not exist instead of rolling them over", () => {
    expect(fromDateInput("2026-02-31")).toBeUndefined();
    expect(fromDateInput("2026-02-29")).toBeUndefined();
    expect(fromDateInput("2028-02-29")).toBe(Date.UTC(2028, 1, 29, 10));
    expect(fromDateInput("2026-13-01")).toBeUndefined();
    expect(fromDateInput("2026-00-10")).toBeUndefined();
    expect(fromDateInput("2026-10-00")).toBeUndefined();
  });

  it("refuses anything that is not yyyy-mm-dd", () => {
    for (const text of ["", "2026-1-5", "15.10.2026.", "2026-10-15T10:00", " 2026-10-15"]) {
      expect(fromDateInput(text)).toBeUndefined();
    }
  });
});

describe("number inputs", () => {
  it("reads a decimal comma, as Serbian users type halves and areas", () => {
    expect(fromNumberInput("1,5")).toBe(1.5);
    expect(fromNumberInput("0,5")).toBe(0.5);
    expect(fromNumberInput("2,5")).toBe(2.5);
    expect(fromNumberInput("85,5")).toBe(85.5);
  });

  it("reads a decimal point and grouped thousands", () => {
    expect(fromNumberInput("1.5")).toBe(1.5);
    expect(fromNumberInput("285.000")).toBe(285_000);
    expect(fromNumberInput("1.250.000")).toBe(1_250_000);
    expect(fromNumberInput(" 74 ")).toBe(74);
  });

  it("keeps an empty input apart from one that does not parse", () => {
    expect(fromNumberInput("")).toBeNull();
    expect(fromNumberInput("   ")).toBeNull();
    expect(fromNumberInput("dva")).toBeNaN();
    expect(fromNumberInput("1,5,5")).toBeNaN();
  });

  it("writes the form's number back with a decimal comma", () => {
    expect(toNumberInput(1.5)).toBe("1,5");
    expect(toNumberInput(285_000)).toBe("285000");
    expect(toNumberInput(null)).toBe("");
    expect(toNumberInput(Number.NaN)).toBe("");
    for (const text of ["1,5", "0,5", "85,5"]) expect(toNumberInput(fromNumberInput(text))).toBe(text);
  });
});
