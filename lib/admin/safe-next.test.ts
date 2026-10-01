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
    expect(safeNext("/admin\..\evil.example")).toBe("/admin");
    expect(safeNext("/admin//evil.example")).toBe("/admin");
  });
});
