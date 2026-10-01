import { ConvexError } from "convex/values";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTOSAVE_DELAY_MS, AutosaveEngine, FOCUS_HOLD_MS } from "@/components/admin/listings/editor/autosave-engine";
import type { Id } from "@/convex/_generated/dataModel";
import { publishChecklist } from "@/convex/lib/checklist";
import { fromDateInput } from "@/lib/admin/format";
import {
  FORM_KEYS,
  buildSave,
  checklistListing,
  deepEqual,
  detectAssetFormat,
  dirtyKeys,
  docToForm,
  echoOf,
  formToPatch,
  invalidKeys,
  listingFormSchema,
  localeCompleteness,
  parseFloorPolygon,
  structureName,
  withKeys,
  type ListingDoc,
  type ListingForm,
  type ListingPatch,
} from "./listing-form";

const NOW = Date.UTC(2026, 8, 30, 10);

function sampleDoc(overrides: Partial<ListingDoc> = {}): ListingDoc {
  return {
    _id: "listing1" as Id<"listings">,
    _creationTime: NOW - 86_400_000,
    ref: "ME-1042",
    slug: "trosoban-stan-vracar-me-1042",
    status: "draft",
    visibility: "private",
    transaction: "sale",
    propertyType: "apartment",
    isExclusive: true,
    isFeatured: false,
    isDemo: false,
    agentId: "agent1" as Id<"agents">,
    mandate: {
      number: "UP-17/2026",
      type: "exclusive",
      start: fromDateInput("2026-09-01") ?? 0,
      end: fromDateInput("2027-03-01") ?? 0,
    },
    mandateEnd: fromDateInput("2027-03-01"),
    title: { sr: "Trosoban stan na Vračaru", en: "Three-room flat in Vračar" },
    description: { sr: "Svetao trosoban stan sa dve terase, pogled na park, zgrada iz 1938. godine sa liftom." },
    highlights: { sr: ["Dve terase", "Lift"], en: ["Two terraces"] },
    price: 285_000,
    pricePerM2: 3_562,
    vatRefundEligible: false,
    costs: { infostan: 60, utilitiesIncluded: false },
    cityId: "city1" as Id<"locations">,
    municipalityId: "mun1" as Id<"locations">,
    location: { street: "Njegoševa", streetNo: "12", lat: 44.8, lng: 20.47, addressVisibility: "street" },
    areaM2: 80,
    rooms: 3,
    bathrooms: 1,
    floor: 3,
    floorNum: 3,
    totalFloors: 5,
    constructionType: "old",
    yearBuilt: 1938,
    condition: "renovated",
    heating: ["CG"],
    features: {
      elevator: true,
      terrace: true,
      loggia: false,
      balcony: false,
      frenchBalcony: false,
      garden: false,
      basement: true,
      storage: false,
      ac: true,
      intercom: true,
      videoSurveillance: false,
      alarm: false,
    },
    orientation: ["S", "W"],
    view: ["park"],
    parking: ["street_zone"],
    furnishing: "semi",
    energyClass: "C",
    legal: { registration: "registered", legalization: "legal", occupancyPermit: true, docsVerifiedAt: NOW - 1000 },
    media: [],
    floorPlans: [],
    walk3d: {
      desktop: { source: { kind: "url", url: "https://d28zzqy0iyovbz.cloudfront.net/scene/v1/meta.json" }, format: "sog" },
      credits: "Snimak: agencija",
      aiGenerated: false,
      eyeHeight: 1.6,
      published: true,
    },
    hasTour: true,
    poi: [{ kind: "park", name: "Karađorđev park", distanceM: 300 }],
    scope: "draft:sale",
    searchText: "trosoban stan na vracaru",
    updatedAt: NOW - 1000,
    ...overrides,
  };
}

function rentDoc(): ListingDoc {
  return sampleDoc({
    transaction: "rent",
    price: 900,
    rent: { monthly: 900, deposit: 900, petsAllowed: false },
  });
}

function edit(values: ListingForm, change: (draft: ListingForm) => void): ListingForm {
  const draft = structuredClone(values);
  change(draft);
  return draft;
}

describe("docToForm → formToPatch", () => {
  it("produces a no-op patch when nothing changed", () => {
    const form = docToForm(sampleDoc());
    const baseline = docToForm(sampleDoc());
    expect(dirtyKeys(form, baseline)).toEqual([]);
    expect(formToPatch(form, dirtyKeys(form, baseline))).toEqual({});
  });

  it("round-trips every field of a stored listing", () => {
    const doc = sampleDoc();
    const form = docToForm(doc);
    const { patch, unsets, held } = buildSave(form, FORM_KEYS);
    expect(held).toEqual([]);
    // With every key dirty, each field the sample does not have is cleared
    // (no video, no 360° tour, …) and nothing it does have is.
    expect(unsets).toEqual(expect.arrayContaining(["videoUrl", "tour360"]));
    for (const field of unsets) expect(doc[field]).toBeUndefined();
    const merged: ListingDoc = { ...doc, ...patch };
    expect(deepEqual(docToForm(merged), form)).toBe(true);
    // Scene-editor fields ride along untouched.
    expect(patch.walk3d?.eyeHeight).toBe(1.6);
    expect(patch.legal?.docsVerifiedAt).toBe(NOW - 1000);
  });

  it("sends only the dirty top-level keys", () => {
    const baseline = docToForm(sampleDoc());
    const values = edit(baseline, (draft) => {
      draft.title.sr = "Trosoban stan kod Hrama";
      draft.isFeatured = true;
    });
    const keys = dirtyKeys(values, baseline);
    expect(keys.sort()).toEqual(["isFeatured", "title"]);
    expect(formToPatch(values, keys)).toEqual({
      isFeatured: true,
      title: { sr: "Trosoban stan kod Hrama", en: "Three-room flat in Vračar" },
    });
  });

  it("sends a nested object whole when one part changed", () => {
    const baseline = docToForm(sampleDoc());
    const values = edit(baseline, (draft) => {
      draft.location.streetNo = "14";
    });
    expect(formToPatch(values, dirtyKeys(values, baseline))).toEqual({
      location: { street: "Njegoševa", streetNo: "14", lat: 44.8, lng: 20.47, addressVisibility: "street" },
    });
  });

  it("drops blank translations and blank list lines", () => {
    const baseline = docToForm(sampleDoc());
    const values = edit(baseline, (draft) => {
      draft.title.en = "   ";
      draft.highlights.sr = ["Dve terase", "", "Lift"];
      draft.highlights.en = [""];
    });
    expect(formToPatch(values, ["title", "highlights"])).toEqual({
      title: { sr: "Trosoban stan na Vračaru" },
      highlights: { sr: ["Dve terase", "Lift"] },
    });
  });
});

describe("rentals", () => {
  it("keeps rent.monthly equal to the price when the price changes", () => {
    const baseline = docToForm(rentDoc());
    const values = edit(baseline, (draft) => {
      draft.price = 950;
    });
    expect(formToPatch(values, dirtyKeys(values, baseline))).toEqual({
      price: 950,
      rent: { monthly: 950, deposit: 900, petsAllowed: false },
    });
  });

  it("re-sends the price as rent.monthly when only the rent terms change", () => {
    const baseline = docToForm(rentDoc());
    const values = edit(baseline, (draft) => {
      draft.rent.minLeaseMonths = 12;
    });
    expect(formToPatch(values, dirtyKeys(values, baseline))).toEqual({
      rent: { monthly: 900, deposit: 900, minLeaseMonths: 12, petsAllowed: false },
    });
  });

  it("creates the rent terms when a sale listing switches to rent", () => {
    const baseline = docToForm(sampleDoc());
    const values = edit(baseline, (draft) => {
      draft.transaction = "rent";
      draft.price = 1200;
    });
    const patch = formToPatch(values, dirtyKeys(values, baseline));
    expect(patch.transaction).toBe("rent");
    expect(patch.rent).toEqual({ monthly: 1200 });
  });

  it("never writes rent terms for a sale", () => {
    const baseline = docToForm(sampleDoc());
    const values = edit(baseline, (draft) => {
      draft.rent.deposit = 500;
    });
    expect(buildSave(values, dirtyKeys(values, baseline))).toEqual({ patch: {}, unsets: [], held: [] });
  });

  it("holds the rent terms while the price cannot be read", () => {
    const baseline = docToForm(rentDoc());
    const values = edit(baseline, (draft) => {
      draft.price = null;
      draft.rent.deposit = 1000;
    });
    const plan = buildSave(values, ["rent"]);
    expect(plan.patch).toEqual({});
    expect(plan.held).toEqual(["rent"]);
  });
});

describe("brokerage contract", () => {
  const noContract = docToForm(sampleDoc({ mandate: undefined, mandateEnd: undefined }));

  it("is sent only once number, start and end are filled", () => {
    const partial = edit(noContract, (draft) => {
      draft.mandate.number = "UP-1/2026";
      draft.mandate.start = "2026-10-01";
    });
    const plan = buildSave(partial, ["mandate"]);
    expect(plan.patch).toEqual({});
    expect(plan.held).toEqual(["mandate"]);

    const complete = edit(partial, (draft) => {
      draft.mandate.end = "2027-04-01";
    });
    expect(formToPatch(complete, ["mandate"])).toEqual({
      mandate: {
        number: "UP-1/2026",
        type: "exclusive",
        start: fromDateInput("2026-10-01"),
        end: fromDateInput("2027-04-01"),
      },
    });
  });

  it("treats an emptied contract as settled (it cannot be unset)", () => {
    expect(buildSave(noContract, ["mandate"])).toEqual({ patch: {}, unsets: [], held: [] });
  });

  it("rejects an end date before the start", () => {
    const values = edit(noContract, (draft) => {
      draft.mandate = { number: "UP-2", type: "open", start: "2026-10-01", end: "2026-09-01" };
    });
    const result = listingFormSchema.safeParse(values);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toContain("mandate.end");
    expect(invalidKeys(values)).toEqual(["mandate"]);
  });
});

describe("optional fields", () => {
  it("clears an emptied optional number through the unset list", () => {
    const baseline = docToForm(sampleDoc());
    const values = edit(baseline, (draft) => {
      draft.yearBuilt = null;
      draft.bathrooms = null;
    });
    const plan = buildSave(values, dirtyKeys(values, baseline));
    expect(plan.patch).toEqual({});
    expect(plan.held).toEqual([]);
    expect([...plan.unsets].sort()).toEqual(["bathrooms", "yearBuilt"]);
  });

  it("holds a number that does not parse", () => {
    const values = edit(docToForm(sampleDoc()), (draft) => {
      draft.yearBuilt = Number.NaN;
      draft.areaM2 = null;
    });
    const plan = buildSave(values, ["yearBuilt", "areaM2"]);
    expect(plan.patch).toEqual({});
    expect(plan.held.sort()).toEqual(["areaM2", "yearBuilt"]);
    expect(invalidKeys(values).sort()).toEqual(["areaM2", "yearBuilt"]);
  });

  it("omits nested optionals by sending the parent without them", () => {
    const values = edit(docToForm(sampleDoc()), (draft) => {
      draft.costs.infostan = null;
      draft.legal.occupancyPermit = null;
      draft.legal.docsVerifiedAt = null;
    });
    expect(formToPatch(values, ["costs", "legal"])).toEqual({
      costs: { utilitiesIncluded: false },
      legal: { registration: "registered", legalization: "legal" },
    });
  });

  it("clears the video, 360° tour and walkthrough through their own mutations", () => {
    const doc = sampleDoc({ videoUrl: "https://youtu.be/abc", tour360: { provider: "kuula", url: "https://kuula.co/x", published: true } });
    const values = edit(docToForm(doc), (draft) => {
      draft.videoUrl = "";
      draft.tour360 = { provider: "none", externalId: "", url: "", published: false };
      draft.walk3d = {
        desktop: { url: "", format: "spz" },
        mobile: { url: "", format: "spz" },
        collision: { url: "", format: "spz" },
        posterUrl: "",
        credits: "",
        aiGenerated: false,
        published: false,
        spawn: { x: null, y: null, z: null, yaw: null },
        eyeHeight: null,
        floorPolygon: [],
        hotspots: [],
      };
    });
    expect(buildSave(values, ["videoUrl", "tour360", "walk3d"])).toEqual({
      patch: {},
      unsets: ["videoUrl", "tour360", "walk3d"],
      held: [],
    });
  });

  it("clears a select set back to none", () => {
    const values = edit(docToForm(sampleDoc({ subtype: "penthouse" })), (draft) => {
      draft.subtype = "";
      draft.energyClass = "";
    });
    expect(buildSave(values, ["subtype", "energyClass"])).toEqual({
      patch: {},
      unsets: ["subtype", "energyClass"],
      held: [],
    });
  });
});

describe("schema", () => {
  const valid = docToForm(sampleDoc());

  function issuesFor(values: ListingForm): string[] {
    const result = listingFormSchema.safeParse(values);
    return result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));
  }

  it("accepts a stored listing", () => {
    expect(issuesFor(valid)).toEqual([]);
  });

  it("enforces half-room steps and the room range", () => {
    expect(issuesFor(edit(valid, (d) => void (d.rooms = 2.5)))).toEqual([]);
    expect(issuesFor(edit(valid, (d) => void (d.rooms = 2.3)))).toEqual(["rooms"]);
    expect(issuesFor(edit(valid, (d) => void (d.rooms = 21)))).toEqual(["rooms"]);
    expect(issuesFor(edit(valid, (d) => void (d.rooms = null)))).toEqual(["rooms"]);
  });

  it("rejects negative numbers and out-of-range years", () => {
    expect(issuesFor(edit(valid, (d) => void (d.price = -1)))).toEqual(["price"]);
    expect(issuesFor(edit(valid, (d) => void (d.yearBuilt = 1700)))).toEqual(["yearBuilt"]);
    expect(issuesFor(edit(valid, (d) => void (d.renovatedYear = 1930)))).toEqual(["renovatedYear"]);
  });

  it("caps titles, meta texts and highlights", () => {
    expect(issuesFor(edit(valid, (d) => void (d.title.sr = "x".repeat(141))))).toEqual(["title.sr"]);
    expect(issuesFor(edit(valid, (d) => void (d.seo.metaTitle.sr = "x".repeat(71))))).toEqual(["seo.metaTitle.sr"]);
    expect(issuesFor(edit(valid, (d) => void (d.seo.metaDescription.sr = "x".repeat(171))))).toEqual([
      "seo.metaDescription.sr",
    ]);
    expect(issuesFor(edit(valid, (d) => void (d.highlights.sr = Array.from({ length: 9 }, () => "a"))))).toEqual([
      "highlights.sr",
    ]);
    expect(issuesFor(edit(valid, (d) => void (d.highlights.sr = ["x".repeat(91)])))).toEqual(["highlights.sr.0"]);
  });

  it("wants Serbian whenever a translation of an optional text exists", () => {
    expect(issuesFor(edit(valid, (d) => void (d.seo.metaTitle.en = "Flat in Vračar")))).toEqual(["seo.metaTitle.sr"]);
    expect(issuesFor(edit(valid, (d) => void (d.commissionText.de = "Provision 2 %")))).toEqual(["commissionText.sr"]);
  });

  it("validates slugs and URLs", () => {
    expect(issuesFor(edit(valid, (d) => void (d.slug = "Trosoban Stan")))).toEqual(["slug"]);
    expect(issuesFor(edit(valid, (d) => void (d.slug = "trosoban--stan")))).toEqual(["slug"]);
    expect(issuesFor(edit(valid, (d) => void (d.videoUrl = "http://youtube.com/watch?v=1")))).toEqual(["videoUrl"]);
    expect(issuesFor(edit(valid, (d) => void (d.videoUrl = "https://example.com/video")))).toEqual(["videoUrl"]);
    expect(issuesFor(edit(valid, (d) => void (d.videoUrl = "https://youtu.be/dQw4w9WgXcQ")))).toEqual([]);
    expect(issuesFor(edit(valid, (d) => void (d.videoUrl = "https://vimeo.com/123456")))).toEqual([]);
  });

  it("requires a desktop model before a walkthrough is published", () => {
    const values = edit(valid, (d) => {
      d.walk3d.desktop.url = "";
    });
    expect(issuesFor(values)).toEqual(["walk3d.desktop.url"]);
  });

  it("checks the floor against the building height", () => {
    expect(issuesFor(edit(valid, (d) => void (d.floor = 7)))).toEqual(["floor"]);
    expect(issuesFor(edit(valid, (d) => void (d.floor = "PK")))).toEqual([]);
  });
});

describe("rebasing helpers", () => {
  it("recognises the server echo of a normalized save", () => {
    const doc = sampleDoc();
    const values = edit(docToForm(doc), (draft) => {
      draft.highlights.sr = ["Dve terase", ""];
    });
    const saved: ListingDoc = { ...doc, ...formToPatch(values, ["highlights"]) };
    expect(deepEqual(docToForm(saved).highlights, echoOf(saved, values, "highlights"))).toBe(true);
    expect(deepEqual(docToForm(saved).highlights, values.highlights)).toBe(false);
  });

  it("the echo of a cleared field is the cleared value, not a colleague's edit", () => {
    const doc = sampleDoc();
    const values = edit(docToForm(doc), (draft) => {
      draft.yearBuilt = null;
    });
    const changed: ListingDoc = { ...doc, yearBuilt: 1950 };
    expect(echoOf(changed, values, "yearBuilt")).toBeNull();
  });

  it("copies only the named keys", () => {
    const a = docToForm(sampleDoc());
    const b = edit(a, (draft) => {
      draft.price = 1;
      draft.areaM2 = 2;
    });
    const merged = withKeys(a, b, ["price"]);
    expect(merged.price).toBe(1);
    expect(merged.areaM2).toBe(80);
  });

  it("treats undefined keys as absent and NaN as equal to itself", () => {
    expect(deepEqual({ a: 1, b: undefined }, { a: 1 })).toBe(true);
    expect(deepEqual([Number.NaN], [Number.NaN])).toBe(true);
    expect(deepEqual({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
  });
});

describe("live checklist", () => {
  it("turns items green from unsaved values", () => {
    const doc = sampleDoc({ title: { sr: "Stan" }, price: 0 });
    const context = { agentPublic: true, registryOk: true, registryRequired: true };
    const before = publishChecklist(checklistListing(doc, docToForm(doc)), NOW, context);
    expect(before.find((item) => item.code === "titleSr")?.ok).toBe(false);
    expect(before.find((item) => item.code === "price")?.ok).toBe(false);

    const values = edit(docToForm(doc), (draft) => {
      draft.title.sr = "Trosoban stan na Vračaru";
      draft.price = 250_000;
    });
    const after = publishChecklist(checklistListing(doc, values), NOW, context);
    expect(after.find((item) => item.code === "titleSr")?.ok).toBe(true);
    expect(after.find((item) => item.code === "price")?.ok).toBe(true);
  });

  it("falls back to the stored contract while the form's is incomplete", () => {
    const doc = sampleDoc();
    const values = edit(docToForm(doc), (draft) => {
      draft.mandate.end = "";
    });
    expect(checklistListing(doc, values).mandate).toEqual(doc.mandate);
  });
});

describe("helpers", () => {
  it("names Serbian room structures", () => {
    expect(structureName(0.5)).toBe("garsonjera");
    expect(structureName(2.5)).toBe("dvoiposoban");
    expect(structureName(4)).toBe("četvorosoban");
    expect(structureName(7)).toBe("7 soba");
    expect(structureName(0)).toBeNull();
    expect(structureName(undefined)).toBeNull();
  });

  it("rates per-locale completeness", () => {
    expect(localeCompleteness("Trosoban stan", "x".repeat(80))).toBe("complete");
    expect(localeCompleteness("Stan", "")).toBe("partial");
    expect(localeCompleteness("", "  ")).toBe("empty");
  });

  it("detects splat formats from URLs and file names", () => {
    expect(detectAssetFormat("https://cdn.example/room.SOG?v=2")).toBe("sog");
    expect(detectAssetFormat("https://cdn.example/room.ksplat")).toBe("ksplat");
    // A bundled SOG is a zip; an unpacked one is read through its meta.json.
    expect(detectAssetFormat("https://cdn.example/room.zip")).toBe("sog");
    expect(detectAssetFormat("https://d28zzqy0iyovbz.cloudfront.net/9917211a/v1/meta.json")).toBe("sog");
    expect(detectAssetFormat("meta.json")).toBe("sog");
    expect(detectAssetFormat("room-collision.glb")).toBe("glb");
    expect(detectAssetFormat("https://cdn.example/other.json")).toBeNull();
    expect(detectAssetFormat("https://cdn.example/room")).toBeNull();
  });

  it("reads a floor polygon pasted as JSON", () => {
    expect(parseFloorPolygon("[[0, 0], [2.5, 0], [2.5, -3]]")).toEqual({
      ok: true,
      points: [
        [0, 0],
        [2.5, 0],
        [2.5, -3],
      ],
    });
    expect(parseFloorPolygon("  ")).toEqual({ ok: true, points: [] });
    expect(parseFloorPolygon("[[0, 0], [1, 1]")).toMatchObject({ ok: false, error: "Tekst nije ispravan JSON." });
    expect(parseFloorPolygon('{"x": 1}')).toMatchObject({ ok: false });
    expect(parseFloorPolygon("[[0, 0, 1], [1, 1, 1], [2, 2, 2]]")).toMatchObject({ ok: false });
    expect(parseFloorPolygon('[[0, 0], [1, "1"], [2, 2]]')).toMatchObject({ ok: false });
    expect(parseFloorPolygon("[[0, 0], [1, 1]]")).toMatchObject({ ok: false, error: "Tlocrt mora imati od 3 do 64 tačaka." });
    const many = JSON.stringify(Array.from({ length: 65 }, (_, i) => [i, i % 2]));
    expect(parseFloorPolygon(many)).toMatchObject({ ok: false });
  });
});

describe("3D walkthrough and 360° tour", () => {
  const SOG = "https://d28zzqy0iyovbz.cloudfront.net/9917211a/v1/meta.json";
  const valid = docToForm(sampleDoc());

  function issuesFor(values: ListingForm): string[] {
    const result = listingFormSchema.safeParse(values);
    return result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));
  }

  function walkDoc(walk: NonNullable<ListingDoc["walk3d"]>): ListingDoc {
    return sampleDoc({ walk3d: walk });
  }

  it("round-trips spawn, eye height, floor polygon and hotspots", () => {
    const walk: NonNullable<ListingDoc["walk3d"]> = {
      desktop: { source: { kind: "url", url: SOG }, format: "sog", bytes: 43_087_848 },
      spawn: { x: 3.8, y: 0, z: 1.8, yaw: 1.23 },
      eyeHeight: 2.75,
      floorPolygon: [
        [-4.7, 2.85],
        [4.9, 2.85],
        [4.9, -1.5],
      ],
      hotspots: [{ label: { sr: "Kuhinja", en: "Kitchen" }, x: 4.4, z: 2.2, yaw: -1.16 }],
      credits: "ethan3111 (CC BY 4.0)",
      aiGenerated: false,
      published: true,
    };
    const form = docToForm(walkDoc(walk));
    expect(form.walk3d.spawn).toEqual({ x: 3.8, y: 0, z: 1.8, yaw: 1.23 });
    expect(form.walk3d.eyeHeight).toBe(2.75);
    expect(form.walk3d.hotspots).toEqual([{ label: { sr: "Kuhinja", en: "Kitchen", ru: "", de: "" }, x: 4.4, z: 2.2, yaw: -1.16 }]);
    expect(issuesFor(form)).toEqual([]);
    expect(formToPatch(form, ["walk3d"]).walk3d).toEqual(walk);
  });

  it("maps a walkthrough without the optional parts to empty inputs and back", () => {
    const form = docToForm(walkDoc({ desktop: { source: { kind: "url", url: SOG }, format: "sog" }, published: false }));
    expect(form.walk3d.spawn).toEqual({ x: null, y: null, z: null, yaw: null });
    expect(form.walk3d.eyeHeight).toBeNull();
    expect(form.walk3d.floorPolygon).toEqual([]);
    expect(form.walk3d.hotspots).toEqual([]);
    expect(formToPatch(form, ["walk3d"]).walk3d).toEqual({
      desktop: { source: { kind: "url", url: SOG }, format: "sog" },
      aiGenerated: false,
      published: false,
    });
  });

  it("trims hotspot names and lets blank translations fall back to Serbian", () => {
    const values = edit(valid, (d) => {
      d.walk3d.hotspots = [{ label: { sr: "  Dnevna soba ", en: " ", ru: "", de: "Wohnzimmer" }, x: 1, z: -2, yaw: 0 }];
    });
    expect(formToPatch(values, ["walk3d"]).walk3d?.hotspots).toEqual([
      { label: { sr: "Dnevna soba", de: "Wohnzimmer" }, x: 1, z: -2, yaw: 0 },
    ]);
  });

  it("removes the walkthrough when only empty start point, polygon and hotspots are left", () => {
    const values = edit(valid, (d) => {
      d.walk3d = {
        desktop: { url: "", format: "spz" },
        mobile: { url: "", format: "spz" },
        collision: { url: "", format: "spz" },
        posterUrl: "",
        credits: "",
        aiGenerated: false,
        published: false,
        spawn: { x: null, y: null, z: null, yaw: null },
        eyeHeight: null,
        floorPolygon: [],
        hotspots: [],
      };
    });
    expect(buildSave(values, ["walk3d"])).toEqual({ patch: {}, unsets: ["walk3d"], held: [] });
    // Any one of them keeps it.
    const withHotspot = edit(values, (d) => {
      d.walk3d.hotspots = [{ label: { sr: "Hodnik", en: "", ru: "", de: "" }, x: 0, z: 0, yaw: 0 }];
    });
    expect(buildSave(withHotspot, ["walk3d"]).patch.walk3d?.hotspots).toHaveLength(1);
  });

  it("accepts only model URLs on the allowed splat hosts", () => {
    expect(issuesFor(edit(valid, (d) => void (d.walk3d.desktop.url = "https://example.com/room.spz")))).toEqual([
      "walk3d.desktop.url",
    ]);
    expect(issuesFor(edit(valid, (d) => void (d.walk3d.mobile.url = "http://d28zzqy0iyovbz.cloudfront.net/a.sog")))).toEqual([
      "walk3d.mobile.url",
      "walk3d.mobile.url",
    ]);
    expect(
      issuesFor(edit(valid, (d) => void (d.walk3d.collision.url = "https://storage.googleapis.com/bucket/room.glb"))),
    ).toEqual([]);
  });

  it("accepts an https poster or one shipped with the site", () => {
    expect(issuesFor(edit(valid, (d) => void (d.walk3d.posterUrl = "/media/tours/demo/living-room.jpg")))).toEqual([]);
    expect(issuesFor(edit(valid, (d) => void (d.walk3d.posterUrl = "https://images.unsplash.com/photo-1")))).toEqual([]);
    expect(issuesFor(edit(valid, (d) => void (d.walk3d.posterUrl = "http://example.com/poster.jpg")))).toEqual([
      "walk3d.posterUrl",
    ]);
    expect(issuesFor(edit(valid, (d) => void (d.walk3d.posterUrl = "/media/../secret.jpg")))).toEqual(["walk3d.posterUrl"]);
  });

  it("wants all four start-point values or none", () => {
    expect(issuesFor(edit(valid, (d) => void (d.walk3d.spawn = { x: 1, y: null, z: 2, yaw: null })))).toEqual([
      "walk3d.spawn.y",
      "walk3d.spawn.yaw",
    ]);
    expect(issuesFor(edit(valid, (d) => void (d.walk3d.spawn = { x: 1, y: 0, z: Number.NaN, yaw: 0 })))).toEqual([
      "walk3d.spawn.z",
    ]);
    expect(issuesFor(edit(valid, (d) => void (d.walk3d.spawn = { x: -1.5, y: 0, z: 2, yaw: -3 })))).toEqual([]);
  });

  it("keeps the eye height between 0.2 and 20 model units", () => {
    expect(issuesFor(edit(valid, (d) => void (d.walk3d.eyeHeight = 0.1)))).toEqual(["walk3d.eyeHeight"]);
    expect(issuesFor(edit(valid, (d) => void (d.walk3d.eyeHeight = 21)))).toEqual(["walk3d.eyeHeight"]);
    expect(issuesFor(edit(valid, (d) => void (d.walk3d.eyeHeight = null)))).toEqual([]);
  });

  it("checks the floor polygon size and the hotspot list", () => {
    expect(issuesFor(edit(valid, (d) => void (d.walk3d.floorPolygon = [[0, 0], [1, 1]])))).toEqual(["walk3d.floorPolygon"]);
    expect(issuesFor(edit(valid, (d) => void (d.walk3d.floorPolygon = [[0, 0], [1, 1], [1]])))).toEqual([
      "walk3d.floorPolygon",
    ]);
    const hotspot = { label: { sr: "Soba", en: "", ru: "", de: "" }, x: 0, z: 0, yaw: 0 };
    expect(issuesFor(edit(valid, (d) => void (d.walk3d.hotspots = Array.from({ length: 13 }, () => hotspot))))).toEqual([
      "walk3d.hotspots",
    ]);
    expect(
      issuesFor(edit(valid, (d) => void (d.walk3d.hotspots = [{ ...hotspot, label: { ...hotspot.label, sr: " " }, x: null }]))),
    ).toEqual(["walk3d.hotspots.0.label.sr", "walk3d.hotspots.0.x"]);
  });

  it("validates Matterport and Kuula tours the way the server does", () => {
    const tour = (patch: Partial<ListingForm["tour360"]>) =>
      edit(valid, (d) => void (d.tour360 = { provider: "matterport", externalId: "", url: "", published: false, ...patch }));
    expect(issuesFor(tour({}))).toEqual([]);
    expect(issuesFor(tour({ published: true }))).toEqual(["tour360.url"]);
    expect(issuesFor(tour({ url: "https://my.matterport.com/show/?m=SxQL3iGyoDo" }))).toEqual([]);
    expect(issuesFor(tour({ url: "https://example.com/show/?m=SxQL3iGyoDo" }))).toEqual(["tour360.url"]);
    expect(issuesFor(tour({ externalId: "SxQL3iGyoDo", published: true }))).toEqual([]);
    expect(issuesFor(tour({ externalId: "x" }))).toEqual(["tour360.externalId"]);
    expect(issuesFor(tour({ provider: "kuula", url: "https://kuula.co/share/collection/7lVLq" }))).toEqual([]);
    expect(issuesFor(tour({ provider: "kuula", url: "https://kuula.co/x" }))).toEqual(["tour360.url"]);
    expect(issuesFor(tour({ provider: "self", published: true }))).toEqual([]);
  });
});

/* ----------------------------------------------------------------------
 * The autosave engine that drives these mappings in the editor. It is
 * framework-free, so the whole save pipeline is exercised here with fake
 * timers and fake mutations.
 * -------------------------------------------------------------------- */

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void };

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function harness(doc: ListingDoc = sampleDoc()) {
  const initial = docToForm(doc);
  let values = structuredClone(initial);
  const engine = new AutosaveEngine(initial, doc.updatedAt);
  const calls: ListingPatch[] = [];
  const unsets: string[] = [];
  const refused: string[][] = [];
  const revealed: string[][] = [];
  let focused: string | null = null;
  let respond: (patch: ListingPatch) => Promise<{ slug: string }> = async (patch) => ({
    slug: patch.slug ?? values.slug,
  });

  engine.connect({
    getValues: () => values,
    setValue: (key, value) => {
      values = { ...values, [key]: value };
      engine.changed();
    },
    revealErrors: (keys) => revealed.push(keys),
    update: (patch) => {
      calls.push(patch);
      return respond(patch);
    },
    unset: async (field) => {
      unsets.push(field);
    },
    onVisibilityRefused: (reasons) => refused.push(reasons),
    activeElementId: () => focused,
  });

  return {
    engine,
    calls,
    unsets,
    refused,
    revealed,
    get values() {
      return values;
    },
    /** A user edit: change a copy, then notify like RHF's subscription does. */
    type(change: (draft: ListingForm) => void) {
      const draft = structuredClone(values);
      change(draft);
      values = draft;
      engine.changed();
    },
    focus(id: string | null) {
      focused = id;
    },
    respondWith(fn: (patch: ListingPatch) => Promise<{ slug: string }>) {
      respond = fn;
    },
  };
}

describe("autosave engine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces edits into one save of the dirty keys", async () => {
    const h = harness();
    h.type((d) => void (d.title.sr = "Trosoban stan kod Hrama"));
    h.type((d) => void (d.areaM2 = 82));
    expect(h.engine.getSnapshot().state).toBe("dirty");
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS - 100);
    expect(h.calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(200);
    expect(h.calls).toEqual([{ title: { sr: "Trosoban stan kod Hrama", en: "Three-room flat in Vračar" }, areaM2: 82 }]);
    expect(h.engine.getSnapshot().state).toBe("saved");
    expect(h.engine.isBusy()).toBe(false);
  });

  it("keeps edits made during a save dirty and sends them in one follow-up", async () => {
    const h = harness();
    const first = deferred<{ slug: string }>();
    h.respondWith(() => first.promise);
    h.type((d) => void (d.areaM2 = 90));
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(h.engine.getSnapshot().state).toBe("saving");

    h.type((d) => void (d.areaM2 = 91));
    h.type((d) => void (d.bathrooms = 2));
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(h.calls).toHaveLength(1);

    h.respondWith(async () => ({ slug: h.values.slug }));
    first.resolve({ slug: h.values.slug });
    await vi.advanceTimersByTimeAsync(10);
    expect(h.calls).toEqual([{ areaM2: 90 }, { areaM2: 91, bathrooms: 2 }]);
    expect(h.engine.getSnapshot().state).toBe("saved");
  });

  it("holds a focused price mid-typing; a flush sends it", async () => {
    const h = harness(rentDoc());
    h.focus("f-price");
    h.type((d) => void (d.price = 17));
    h.type((d) => void (d.isFeatured = true));
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(h.calls).toEqual([{ isFeatured: true }]);
    expect(h.engine.getSnapshot().state).toBe("dirty");

    h.type((d) => void (d.price = 1750));
    const result = await h.engine.flush();
    expect(result).toEqual({ ok: true, pending: [] });
    expect(h.calls[1]).toEqual({ price: 1750, rent: { monthly: 1750, deposit: 900, petsAllowed: false } });
  });

  it("saves a focused price once the input has been idle long enough", async () => {
    const h = harness();
    h.focus("f-price");
    h.type((d) => void (d.price = 299_000));
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(h.calls).toEqual([]);
    await vi.advanceTimersByTimeAsync(FOCUS_HOLD_MS - AUTOSAVE_DELAY_MS + 10);
    expect(h.calls).toEqual([{ price: 299_000 }]);
    expect(h.engine.getSnapshot().state).toBe("saved");
  });

  it("never sends invalid keys, reveals their errors and saves the rest", async () => {
    const h = harness();
    h.type((d) => {
      d.title.sr = "x".repeat(200);
      d.isExclusive = false;
    });
    const result = await h.engine.flush();
    expect(h.calls).toEqual([{ isExclusive: false }]);
    expect(h.revealed).toEqual([["title"]]);
    expect(result).toEqual({ ok: true, pending: ["title"] });
    expect(h.engine.getSnapshot().state).toBe("dirty");
  });

  it("sends 'public' visibility on its own and reverts it when the checklist refuses", async () => {
    const h = harness();
    h.respondWith(async (patch) => {
      if (patch.visibility === "public") {
        throw new ConvexError({ code: "PUBLISH_BLOCKED", message: "Objava je blokirana.", reasons: ["Cena je uneta"] });
      }
      return { slug: h.values.slug };
    });
    h.type((d) => {
      d.visibility = "public";
      d.urgent = true;
    });
    const result = await h.engine.flush();
    expect(h.calls).toEqual([{ urgent: true }, { visibility: "public" }]);
    expect(h.refused).toEqual([["Cena je uneta"]]);
    expect(h.values.visibility).toBe("private");
    expect(result).toEqual({ ok: true, pending: [] });
  });

  it("reports a failed save and succeeds on retry", async () => {
    const h = harness();
    h.respondWith(async () => {
      throw new ConvexError({ code: "INVALID_INPUT", message: "Kvadratura ne može biti negativna." });
    });
    h.type((d) => void (d.areaM2 = 70));
    expect(await h.engine.flush()).toEqual({ ok: false, pending: ["areaM2"] });
    expect(h.engine.getSnapshot()).toMatchObject({ state: "error", error: "Kvadratura ne može biti negativna." });

    h.respondWith(async () => ({ slug: h.values.slug }));
    expect(await h.engine.flush()).toEqual({ ok: true, pending: [] });
    expect(h.engine.getSnapshot()).toMatchObject({ state: "saved", error: null });
  });

  it("clears the video through its own mutation", async () => {
    const h = harness(sampleDoc({ videoUrl: "https://youtu.be/abc" }));
    h.type((d) => void (d.videoUrl = ""));
    await h.engine.flush();
    expect(h.calls).toEqual([]);
    expect(h.unsets).toEqual(["videoUrl"]);
  });

  it("shows the unique slug the server chose", async () => {
    const h = harness();
    h.respondWith(async (patch) => ({ slug: `${patch.slug ?? ""}-2` }));
    h.type((d) => void (d.slug = "novi-slug"));
    await h.engine.flush();
    expect(h.values.slug).toBe("novi-slug-2");
    expect(h.engine.isBusy()).toBe(false);
  });

  it("rebases server changes onto untouched fields only", async () => {
    const doc = sampleDoc();
    const h = harness(doc);
    h.type((d) => void (d.title.sr = "Moj naslov u izradi"));

    // A publish elsewhere flips visibility and a colleague renames the title.
    const moved: ListingDoc = { ...doc, visibility: "public", title: { sr: "Tuđi naslov" } };
    h.engine.rebase(moved);
    expect(h.values.visibility).toBe("public");
    expect(h.values.title.sr).toBe("Moj naslov u izradi");

    // The echo of our own (normalized) save does not overwrite the form.
    h.type((d) => void (d.highlights.sr = ["Dve terase", ""]));
    await h.engine.flush();
    h.engine.rebase({
      ...moved,
      title: { sr: "Moj naslov u izradi", en: "Three-room flat in Vračar" },
      highlights: { sr: ["Dve terase"], en: ["Two terraces"] },
    });
    expect(h.values.highlights.sr).toEqual(["Dve terase", ""]);
    expect(h.values.title.sr).toBe("Moj naslov u izradi");
    expect(h.engine.isBusy()).toBe(false);
  });

  it("shows a colleague's value for a field this form had emptied and saved", async () => {
    const doc = sampleDoc();
    const h = harness(doc);
    h.type((d) => void (d.yearBuilt = null));
    await h.engine.flush();
    expect(h.calls).toEqual([]);
    h.engine.rebase({ ...doc, yearBuilt: 1950 });
    expect(h.values.yearBuilt).toBe(1950);
    expect(h.engine.isBusy()).toBe(false);
  });
});
