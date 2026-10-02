import { afterEach, describe, expect, it, vi } from "vitest";
import { seoText, siteOrigin } from "./seo";

// `lib/seo.ts` builds localized URLs through next-intl's navigation, which
// needs the Next runtime; neither function under test uses it.
vi.mock("@/i18n/navigation", () => ({ getPathname: () => "/" }));

describe("siteOrigin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function stub(env: Partial<Record<"NEXT_PUBLIC_SITE_URL" | "VERCEL_PROJECT_PRODUCTION_URL" | "VERCEL_ENV", string>>) {
    for (const name of ["NEXT_PUBLIC_SITE_URL", "VERCEL_PROJECT_PRODUCTION_URL", "VERCEL_ENV"] as const) {
      vi.stubEnv(name, env[name]);
    }
  }

  it("uses the configured origin without a trailing slash", () => {
    stub({ NEXT_PUBLIC_SITE_URL: "https://mihajlo-estate.rs/", VERCEL_PROJECT_PRODUCTION_URL: "me.vercel.app" });
    expect(siteOrigin()).toBe("https://mihajlo-estate.rs");
  });

  it("falls back to the Vercel production domain", () => {
    stub({ VERCEL_PROJECT_PRODUCTION_URL: "mihajlo-estate.rs", VERCEL_ENV: "production" });
    expect(siteOrigin()).toBe("https://mihajlo-estate.rs");
    stub({ NEXT_PUBLIC_SITE_URL: "", VERCEL_PROJECT_PRODUCTION_URL: "mihajlo-estate.rs", VERCEL_ENV: "preview" });
    expect(siteOrigin()).toBe("https://mihajlo-estate.rs");
  });

  it("refuses to build production URLs from localhost", () => {
    stub({ VERCEL_ENV: "production" });
    expect(() => siteOrigin()).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });

  it("defaults to localhost everywhere else", () => {
    stub({});
    expect(siteOrigin()).toBe("http://localhost:3000");
    stub({ VERCEL_ENV: "preview" });
    expect(siteOrigin()).toBe("http://localhost:3000");
  });
});

describe("seoText", () => {
  const own = { sr: "Naslov stranice", en: "Page title" };
  const sitewide = { sr: "Mihajlo Estate — nekretnine", de: "Mihajlo Estate – Immobilien" };

  it("prefers the page's own field, then the sitewide default, then the built-in copy", () => {
    expect(seoText("en", "Built-in", own, sitewide)).toBe("Page title");
    expect(seoText("de", "Eingebaut", undefined, sitewide)).toBe("Mihajlo Estate – Immobilien");
    expect(seoText("en", "Built-in", undefined, undefined)).toBe("Built-in");
  });

  it("reads a missing translation as its Serbian source, like pickL10n", () => {
    expect(seoText("ru", "Встроенный", own, sitewide)).toBe("Naslov stranice");
  });

  it("skips a source without any text", () => {
    expect(seoText("en", "Built-in", { sr: "  " }, sitewide)).toBe("Mihajlo Estate — nekretnine");
    expect(seoText("en", "Built-in", { sr: "" }, { sr: "" })).toBe("Built-in");
  });
});
