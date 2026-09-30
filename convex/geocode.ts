import { v } from "convex/values";
import { action } from "./_generated/server";
import { requireRoleAction } from "./lib/auth";
import { appError } from "./lib/errors";
import { rateLimiter } from "./lib/rateLimit";

const EDITORS = ["admin", "manager", "agent"] as const;

/**
 * Nominatim usage policy (operations.osmfoundation.org/policies/nominatim):
 * identify the application with a real User-Agent, send at most one request
 * per second for the whole app, and show the attribution. A browser cannot set
 * `User-Agent`, so the lookup runs here, behind staff auth.
 */
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "MihajloEstateAdmin/1.0 (listing address lookup)";

const resultV = v.object({
  label: v.string(),
  lat: v.number(),
  lng: v.number(),
  street: v.optional(v.string()),
  streetNo: v.optional(v.string()),
  postalCode: v.optional(v.string()),
});

type NominatimHit = {
  display_name?: unknown;
  lat?: unknown;
  lon?: unknown;
  address?: { road?: unknown; house_number?: unknown; postcode?: unknown };
};

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export const search = action({
  args: { q: v.string() },
  returns: v.array(resultV),
  handler: async (ctx, args) => {
    await requireRoleAction(ctx, EDITORS);
    const q = args.q.trim().slice(0, 160);
    if (q.length < 3) return [];

    let slot = await rateLimiter.limit(ctx, "geocodeGlobal");
    if (!slot.ok) {
      // One short wait covers two editors typing at once; beyond that, refuse.
      if (slot.retryAfter > 1_500) {
        appError("RATE_LIMITED", "Previše pretraga adrese. Pokušajte za trenutak.", {
          retryAfter: slot.retryAfter,
        });
      }
      await new Promise((resolve) => setTimeout(resolve, slot.retryAfter));
      slot = await rateLimiter.limit(ctx, "geocodeGlobal");
      if (!slot.ok) {
        appError("RATE_LIMITED", "Previše pretraga adrese. Pokušajte za trenutak.", {
          retryAfter: slot.retryAfter,
        });
      }
    }

    const url = new URL(NOMINATIM);
    url.searchParams.set("q", q);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("countrycodes", "rs");
    url.searchParams.set("limit", "6");
    url.searchParams.set("accept-language", "sr-Latn,sr,en");

    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
    if (!response.ok) {
      appError("CONFLICT", `Servis za adrese nije dostupan (${response.status}).`);
    }
    const body: unknown = await response.json();
    if (!Array.isArray(body)) return [];

    const out = [];
    for (const hit of body as NominatimHit[]) {
      const label = text(hit.display_name);
      const lat = Number(hit.lat);
      const lng = Number(hit.lon);
      if (label === undefined || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const street = text(hit.address?.road);
      const streetNo = text(hit.address?.house_number);
      const postalCode = text(hit.address?.postcode);
      out.push({
        label,
        lat,
        lng,
        ...(street !== undefined ? { street } : {}),
        ...(streetNo !== undefined ? { streetNo } : {}),
        ...(postalCode !== undefined ? { postalCode } : {}),
      });
    }
    return out;
  },
});
