import { describe, expect, test } from "vitest";
import { coveredByDriver, isUnsearchableQuery, normalizeText, pickDriver } from "./search";
import { foldDiacritics, slugify } from "./slug";

describe("foldDiacritics", () => {
  test("folds Serbian Cyrillic exactly like the same words in Serbian Latin", () => {
    expect(foldDiacritics("Ђурђевак Љубљана Њива Џеп Ћуприја Чачак Шабац Жабаљ Јагодина Херцег Цер")).toBe(
      foldDiacritics("Đurđevak Ljubljana Njiva Džep Ćuprija Čačak Šabac Žabalj Jagodina Herceg Cer"),
    );
  });

  test("meets the Latin names in the Russian spellings of Serbian places", () => {
    expect(normalizeText("Врачар")).toBe("vracar");
    expect(normalizeText("Дорћол")).toBe("dorcol");
    expect(normalizeText("Дорчол")).toBe("dorcol");
    expect(normalizeText("Земун")).toBe("zemun");
    expect(normalizeText("Нови Београд")).toBe("novi beograd");
    expect(normalizeText("Сеньяк")).toBe(normalizeText("Senjak"));
    expect(normalizeText("Зренянин")).toBe(normalizeText("Zrenjanin"));
    expect(normalizeText("Трёхкомнатная квартира, подъезд")).toBe("trehkomnatnaja kvartira podezd");
    expect(normalizeText("Йошкар-Ола щука мышь эра юг яма")).toBe("joskar ola scuka mys era jug jama");
  });

  test("folds decomposed input like composed input", () => {
    expect(normalizeText("Vrac\u030Car")).toBe("vracar");
    // "й" typed as и + breve stays one letter; "ё" as е + diaeresis is "e".
    expect(normalizeText("Мои\u0306 е\u0308лка")).toBe("moj elka");
  });

  test("keeps the Serbian Latin folding and slugs, and folds accented capitals too", () => {
    expect(normalizeText("Čačak Ćuprija Šabac Žabalj Đakovica")).toBe("cacak cuprija sabac zabalj djakovica");
    expect(slugify("Trosoban stan, Vračar!")).toBe("trosoban-stan-vracar");
    // The old letter table had only the lowercase ä, ñ, ç, so "Ärger" kept its "ä".
    expect(foldDiacritics("Straße Ärger Ñandú Çelik")).toBe("strasse arger nandu celik");
  });

  test("gives a Cyrillic name a readable slug", () => {
    expect(slugify("Милица Јовановић")).toBe("milica-jovanovic");
  });
});

describe("text queries", () => {
  test("a query with nothing searchable in it is a filter; a blank one is none", () => {
    for (const q of ["###", "😀", "東京", "—"]) expect(isUnsearchableQuery(q), q).toBe(true);
    for (const q of [undefined, "", "   ", "Врачар", "a"]) expect(isUnsearchableQuery(q), String(q)).toBe(false);
  });

  test("a Cyrillic query drives the text index; an unsearchable one is never an exact range", () => {
    expect(pickDriver({ transaction: "sale", q: "Дорћол" }, "relevance").driver).toBe("text");

    const junk = { transaction: "sale" as const, q: "😀" };
    const plan = pickDriver(junk, "newest");
    expect(plan.driver).toBe("publishedAt");
    expect(coveredByDriver(junk, plan)).toBe(false);

    const blank = { transaction: "sale" as const, q: "   " };
    expect(coveredByDriver(blank, pickDriver(blank, "newest"))).toBe(true);
  });
});
