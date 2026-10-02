import { describe, expect, it } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import { isVideoUrl, parseVideoUrl } from "@/convex/lib/video";
import { docToForm, invalidKeys, type ListingDoc } from "./listing-form";

/** A stored listing, enough for `docToForm`. */
const DOC = {
  _id: "listing1" as Id<"listings">,
  _creationTime: 0,
  ref: "ME-1042",
  slug: "stan-me-1042",
  status: "draft",
  visibility: "private",
  transaction: "sale",
  propertyType: "apartment",
  isExclusive: false,
  isFeatured: false,
  isDemo: false,
  agentId: "agent1" as Id<"agents">,
  title: { sr: "Trosoban stan na Vračaru" },
  description: { sr: "" },
  highlights: { sr: [] },
  price: 285_000,
  pricePerM2: 3_562,
  cityId: "city1" as Id<"locations">,
  location: { lat: 44.8, lng: 20.47, addressVisibility: "area" },
  areaM2: 80,
  rooms: 3,
  floor: 3,
  floorNum: 3,
  constructionType: "old",
  condition: "renovated",
  heating: [],
  features: {
    elevator: false,
    terrace: false,
    loggia: false,
    balcony: false,
    frenchBalcony: false,
    garden: false,
    basement: false,
    storage: false,
    ac: false,
    intercom: false,
    videoSurveillance: false,
    alarm: false,
  },
  parking: [],
  furnishing: "unfurnished",
  legal: { registration: "registered", legalization: "legal" },
  media: [],
  floorPlans: [],
  hasTour: false,
  scope: "draft:sale",
  searchText: "trosoban stan",
  updatedAt: 0,
} satisfies ListingDoc;

/** Whether the listing editor lets this video URL be autosaved. */
function formAccepts(url: string): boolean {
  return !invalidKeys({ ...docToForm(DOC), videoUrl: url }).includes("videoUrl");
}

/** URLs people paste, accepted or not by `listingsAdmin.update` / `media.setVideoUrl`. */
const URLS = [
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "https://youtube.com/watch?v=dQw4w9WgXcQ&t=90s",
  "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
  "https://www.youtube.com/embed/dQw4w9WgXcQ?start=30",
  "https://www.youtube.com/shorts/dQw4w9WgXcQ",
  "https://youtu.be/dQw4w9WgXcQ",
  "https://youtu.be/dQw4w9WgXcQ?t=1m30s",
  "https://youtu.be/dQw4w9WgXcQ?si=Ab12Cd34",
  "https://vimeo.com/123456789",
  "https://www.vimeo.com/123456789",
  "https://m.vimeo.com/123456789",
  "https://vimeo.com/123456789/abcdef1234",
  "https://vimeo.com/channels/staffpicks/123456789",
  "https://player.vimeo.com/video/123456789?h=abcdef1234",
  // Refused by the server: the editor must not offer them for autosave.
  "https://www.youtube.com/live/dQw4w9WgXcQ?si=abc",
  "https://youtube.com/watch?feature=shared&v=dQw4w9WgXcQ",
  "https://www.youtube.com/watch?app=desktop&v=dQw4w9WgXcQ",
  "https://vimeo.com/123456789#t=30s",
  "http://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "https://www.dailymotion.com/video/x8abc12",
  "https://example.com/video.mp4",
  // Accepted by the server's pattern, but no video to play.
  "https://vimeo.com/channels/staffpicks",
  "https://www.youtube.com/watch?v=abc",
];

describe("video URL: the editor and the server agree", () => {
  it("the form accepts a URL only if the server does", () => {
    for (const url of URLS) {
      if (formAccepts(url)) expect(isVideoUrl(url), url).toBe(true);
    }
  });

  it("refuses the URLs the form used to accept but the server refuses", () => {
    for (const url of [
      "https://www.youtube.com/live/dQw4w9WgXcQ?si=abc",
      "https://youtube.com/watch?feature=shared&v=dQw4w9WgXcQ",
      "https://www.youtube.com/watch?app=desktop&v=dQw4w9WgXcQ",
      "https://vimeo.com/123456789#t=30s",
    ]) {
      expect(isVideoUrl(url), url).toBe(false);
      expect(formAccepts(url), url).toBe(false);
    }
  });

  it("accepts exactly the server's URLs that name a playable video", () => {
    const accepted = URLS.filter(formAccepts);
    expect(accepted).toEqual(URLS.filter((url) => isVideoUrl(url) && parseVideoUrl(url) !== null));
    expect(accepted).toHaveLength(14);
    // Pasted with spaces around it: saved trimmed, as the server trims.
    expect(formAccepts("  https://youtu.be/dQw4w9WgXcQ  ")).toBe(true);
    expect(formAccepts("")).toBe(true);
  });
});

describe("parseVideoUrl", () => {
  it("reads YouTube IDs and start times on every host the server accepts", () => {
    expect(parseVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({ provider: "youtube", id: "dQw4w9WgXcQ" });
    expect(parseVideoUrl("https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=90s")).toEqual({
      provider: "youtube",
      id: "dQw4w9WgXcQ",
      start: 90,
    });
    expect(parseVideoUrl("https://youtu.be/dQw4w9WgXcQ?t=1m30s")).toEqual({ provider: "youtube", id: "dQw4w9WgXcQ", start: 90 });
    expect(parseVideoUrl("https://www.youtube.com/embed/dQw4w9WgXcQ?start=3600")).toEqual({
      provider: "youtube",
      id: "dQw4w9WgXcQ",
      start: 3600,
    });
    expect(parseVideoUrl("https://youtube.com/shorts/dQw4w9WgXcQ")).toEqual({ provider: "youtube", id: "dQw4w9WgXcQ" });
    expect(parseVideoUrl("https://youtu.be/dQw4w9WgXcQ?t=0")).toEqual({ provider: "youtube", id: "dQw4w9WgXcQ" });
  });

  it("reads Vimeo IDs, including m. and player. hosts and unlisted links", () => {
    expect(parseVideoUrl("https://m.vimeo.com/123456789")).toEqual({ provider: "vimeo", id: "123456789" });
    expect(parseVideoUrl("https://vimeo.com/123456789/abcdef1234")).toEqual({ provider: "vimeo", id: "123456789" });
    expect(parseVideoUrl("https://vimeo.com/channels/staffpicks/123456789")).toEqual({ provider: "vimeo", id: "123456789" });
    expect(parseVideoUrl("https://player.vimeo.com/video/123456789?h=abcdef1234")).toEqual({
      provider: "vimeo",
      id: "123456789",
    });
    expect(parseVideoUrl("https://vimeo.com/showcase/42/video/123456789")).toEqual({ provider: "vimeo", id: "123456789" });
  });

  it("returns null for what the server refuses or what names no video", () => {
    expect(parseVideoUrl("https://vimeo.com/123456789#t=30s")).toBeNull();
    expect(parseVideoUrl("https://www.youtube.com/live/dQw4w9WgXcQ")).toBeNull();
    expect(parseVideoUrl("https://vimeo.com/channels/staffpicks")).toBeNull();
    expect(parseVideoUrl("https://www.youtube.com/watch?v=abc")).toBeNull();
  });
});
