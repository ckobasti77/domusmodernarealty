import { describe, expect, it } from "vitest";
import { externalTourEmbedUrl, isAllowedSplatUrl, isSitePanoPath, isValidFloorPolygon } from "./tours";

describe("externalTourEmbedUrl", () => {
  it("builds the Matterport player from a share URL or a model ID", () => {
    expect(externalTourEmbedUrl("matterport", "https://my.matterport.com/show/?m=SxQL3iGyoDo", undefined)).toBe(
      "https://my.matterport.com/show/?m=SxQL3iGyoDo&play=1&qs=1&brand=0",
    );
    expect(externalTourEmbedUrl("matterport", undefined, "SxQL3iGyoDo")).toBe(
      "https://my.matterport.com/show/?m=SxQL3iGyoDo&play=1&qs=1&brand=0",
    );
  });

  it("refuses other hosts, http and malformed IDs", () => {
    expect(externalTourEmbedUrl("matterport", "https://evil.example/show/?m=SxQL3iGyoDo", undefined)).toBeNull();
    expect(externalTourEmbedUrl("matterport", "http://my.matterport.com/show/?m=SxQL3iGyoDo", undefined)).toBeNull();
    expect(externalTourEmbedUrl("matterport", undefined, "x\"><script>")).toBeNull();
    expect(externalTourEmbedUrl("matterport", undefined, undefined)).toBeNull();
  });

  it("keeps a Kuula share path and builds one from an ID", () => {
    expect(externalTourEmbedUrl("kuula", "https://kuula.co/share/collection/7lVLq?logo=1", undefined)).toBe(
      "https://kuula.co/share/collection/7lVLq?fs=1&vr=0&thumbs=1&info=0&logo=-1",
    );
    expect(externalTourEmbedUrl("kuula", undefined, "NGgVx")).toBe(
      "https://kuula.co/share/NGgVx?fs=1&vr=0&thumbs=1&info=0&logo=-1",
    );
    expect(externalTourEmbedUrl("kuula", "https://kuula.co/profile/someone", undefined)).toBeNull();
  });
});

describe("asset rules", () => {
  it("allows splats only over https from the CSP's hosts", () => {
    expect(isAllowedSplatUrl("https://d28zzqy0iyovbz.cloudfront.net/9917211a/v1/meta.json")).toBe(true);
    expect(isAllowedSplatUrl("http://d28zzqy0iyovbz.cloudfront.net/a.spz")).toBe(false);
    expect(isAllowedSplatUrl("https://example.com/a.spz")).toBe(false);
  });

  it("accepts only site panoramas under /media/tours/", () => {
    expect(isSitePanoPath("/media/tours/demo/modern_bathroom-4096.jpg")).toBe(true);
    expect(isSitePanoPath("/media/tours/../secret.jpg")).toBe(false);
    expect(isSitePanoPath("https://dl.polyhaven.org/x.jpg")).toBe(false);
  });

  it("checks floor polygons", () => {
    expect(isValidFloorPolygon([[0, 0], [1, 0], [1, 1]])).toBe(true);
    expect(isValidFloorPolygon([[0, 0], [1, 0]])).toBe(false);
    expect(isValidFloorPolygon([[0, 0], [1, Number.NaN], [1, 1]])).toBe(false);
  });
});
