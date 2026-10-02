import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps admin paths with their query and hash", () => {
    expect(safeNext("/admin/upiti?id=abc#note")).toBe("/admin/upiti?id=abc#note");
    expect(safeNext("/admin")).toBe("/admin");
  });

  it("falls back to /admin for missing, foreign or login targets", () => {
    expect(safeNext(null)).toBe("/admin");
    expect(safeNext("https://evil.example/admin")).toBe("/admin");
    expect(safeNext("//evil.example")).toBe("/admin");
    expect(safeNext("/administrator")).toBe("/admin");
    expect(safeNext("/admin/login?next=/admin")).toBe("/admin");
  });

  it("rejects dot segments and backslashes that normalize off the admin section", () => {
    expect(safeNext("/admin/..//evil.example")).toBe("/admin");
    expect(safeNext("/admin/%2e%2e//evil.example/x")).toBe("/admin");
    expect(safeNext("/admin/../sr")).toBe("/admin");
    // Real backslashes: a browser reads "\" as "/" in a URL path.
    expect(safeNext("/admin\\..\\evil.example")).toBe("/admin");
    expect(safeNext("/admin/x\\..\\..\\evil.example")).toBe("/admin");
    expect(safeNext("/admin//evil.example")).toBe("/admin");
  });

  it("keeps an encoded backslash an inert path segment that cannot leave the site", () => {
    // `?next=/admin/%255C..` arrives as "%5C" once the query is decoded: the
    // URL parser leaves it encoded, so it never turns into a "/".
    for (const next of ["/admin/%5C..%5Cevil.example", "/admin/%5C%5Cevil.example", "/admin%5C..%5Cevil.example"]) {
      const target = safeNext(next);
      expect(target === "/admin" || target.startsWith("/admin/"), next).toBe(true);
      const resolved = new URL(target, "https://agencija.test/admin/login");
      expect(resolved.origin, next).toBe("https://agencija.test");
      expect(resolved.pathname.startsWith("/admin"), next).toBe(true);
    }
  });
});
