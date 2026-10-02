/**
 * Tour rules shared by the Convex functions, the admin and the public viewers
 * (docs/06-3D-TOURS.md). Pure: no Convex server imports, so `lib/csp.ts` and
 * client components can import it too.
 */

/** Hosts the public CSP lets the splat viewer fetch from (`connect-src`). */
export const SPLAT_HOSTS = ["d28zzqy0iyovbz.cloudfront.net", "storage.googleapis.com"] as const;

/** Third-party tour players the public CSP may frame (`frame-src`). */
export const EXTERNAL_TOUR_HOSTS = { matterport: "my.matterport.com", kuula: "kuula.co" } as const;

export type ExternalTourProvider = keyof typeof EXTERNAL_TOUR_HOSTS;

/** Panoramas shipped with the site (the demo tour) live under this path. */
export const SITE_PANO_PREFIX = "/media/tours/";

/** Upper bounds the admin and the server agree on. */
export const TOUR_LIMITS = {
  scenes: 40,
  linksPerScene: 12,
  floorPoints: 64,
  hotspots: 12,
  /** An external tour URL or ID, and a 3D model credit line. */
  text: 300,
  /** Splat eye height in model units (scans are not always metric). */
  eyeHeight: { min: 0.2, max: 20 },
} as const;

function parseHttps(raw: string): URL | null {
  try {
    const url = new URL(raw.trim());
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

const MATTERPORT_ID = /^[A-Za-z0-9]{6,32}$/;
const KUULA_PATH = /^\/share\/(collection\/)?[A-Za-z0-9_-]{3,64}\/?$/;
const KUULA_ID = /^(collection\/)?[A-Za-z0-9_-]{3,64}$/;

/**
 * The iframe URL for a Matterport or Kuula tour, built from the share URL or,
 * without one, from the tour ID. `null` when neither yields a tour on the
 * provider's own host, which is the only host the CSP lets us frame.
 */
export function externalTourEmbedUrl(
  provider: ExternalTourProvider,
  url: string | undefined,
  externalId: string | undefined,
): string | null {
  const id = externalId?.trim() ?? "";
  if (provider === "matterport") {
    let model = MATTERPORT_ID.test(id) ? id : null;
    if (url !== undefined && url.trim() !== "") {
      const parsed = parseHttps(url);
      if (parsed === null || parsed.hostname !== EXTERNAL_TOUR_HOSTS.matterport) return null;
      const fromUrl = parsed.searchParams.get("m");
      model = fromUrl !== null && MATTERPORT_ID.test(fromUrl) ? fromUrl : null;
    }
    return model === null
      ? null
      : `https://${EXTERNAL_TOUR_HOSTS.matterport}/show/?m=${model}&play=1&qs=1&brand=0`;
  }

  if (url !== undefined && url.trim() !== "") {
    const parsed = parseHttps(url);
    if (parsed === null || parsed.hostname !== EXTERNAL_TOUR_HOSTS.kuula) return null;
    if (!KUULA_PATH.test(parsed.pathname)) return null;
    return `https://${EXTERNAL_TOUR_HOSTS.kuula}${parsed.pathname.replace(/\/$/, "")}?fs=1&vr=0&thumbs=1&info=0&logo=-1`;
  }
  return KUULA_ID.test(id)
    ? `https://${EXTERNAL_TOUR_HOSTS.kuula}/share/${id}?fs=1&vr=0&thumbs=1&info=0&logo=-1`
    : null;
}

/** A splat asset URL the public viewer is allowed to fetch. */
export function isAllowedSplatUrl(raw: string): boolean {
  const parsed = parseHttps(raw);
  return parsed !== null && (SPLAT_HOSTS as readonly string[]).includes(parsed.hostname);
}

/** A URL panorama must be one shipped with the site; anything else is uploaded. */
export function isSitePanoPath(raw: string): boolean {
  return raw.startsWith(SITE_PANO_PREFIX) && !raw.includes("..") && /^[\w./-]+$/.test(raw);
}

/** Validates a floor polygon: 3–64 finite [x, z] points. */
export function isValidFloorPolygon(points: readonly (readonly number[])[]): boolean {
  return (
    points.length >= 3 &&
    points.length <= TOUR_LIMITS.floorPoints &&
    points.every((point) => point.length === 2 && point.every((value) => Number.isFinite(value)))
  );
}
