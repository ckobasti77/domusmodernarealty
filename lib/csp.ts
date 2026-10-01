/**
 * The single source of truth for the Content-Security-Policy and the other
 * security headers (docs/02-ARCHITECTURE.md 10, IMPLEMENTATION-PLAN 5).
 *
 * The public site and `/admin` get different policies: only the public site
 * embeds third-party tour iframes and map tiles.
 */

import { EXTERNAL_TOUR_HOSTS, SPLAT_HOSTS as SPLAT_HOSTNAMES } from "../convex/lib/tours";

const isDev = process.env.NODE_ENV !== "production";

/** Convex deployment (websocket + HTTP actions + file storage). */
const CONVEX = ["https://*.convex.cloud", "wss://*.convex.cloud", "https://*.convex.site"];

/** Verified demo asset hosts from docs/assets/demo-media.json. */
const DEMO_IMAGE_HOSTS = ["https://images.unsplash.com", "https://dl.polyhaven.org"];
/** Splat walkthrough hosts (the viewer fetches models with `fetch`). */
const SPLAT_HOSTS = SPLAT_HOSTNAMES.map((host) => `https://${host}`);

const MAP_TILES = "https://tiles.openfreemap.org";

type Directives = Record<string, ReadonlyArray<string>>;

function serialize(directives: Directives): string {
  return Object.entries(directives)
    .map(([name, values]) => (values.length ? `${name} ${values.join(" ")}` : name))
    .join("; ");
}

function scriptSrc(): string[] {
  // React Refresh needs eval in development only.
  const base = ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'"];
  return isDev ? [...base, "'unsafe-eval'"] : base;
}

const SHARED: Directives = {
  "default-src": ["'self'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'none'"],
  "object-src": ["'none'"],
  "script-src": scriptSrc(),
  "style-src": ["'self'", "'unsafe-inline'"],
  "font-src": ["'self'", "data:"],
  "manifest-src": ["'self'"],
  "worker-src": ["'self'", "blob:"],
  "media-src": ["'self'", "blob:"],
};

export const publicCsp = serialize({
  ...SHARED,
  "img-src": ["'self'", "data:", "blob:", ...DEMO_IMAGE_HOSTS, "https://*.convex.cloud", MAP_TILES],
  "connect-src": [
    "'self'",
    ...CONVEX,
    MAP_TILES,
    ...SPLAT_HOSTS,
  ],
  "frame-src": [
    ...Object.values(EXTERNAL_TOUR_HOSTS).map((host) => `https://${host}`),
    "https://www.youtube-nocookie.com",
    "https://player.vimeo.com",
  ],
});

export const adminCsp = serialize({
  ...SHARED,
  "img-src": ["'self'", "data:", "blob:", ...DEMO_IMAGE_HOSTS, "https://*.convex.cloud", MAP_TILES],
  // Address search goes through the `geocode.search` Convex action (it must
  // send an identifying User-Agent and share one rate limit), never from here.
  // Splat hosts: the tours tab measures a model's size before it is saved.
  "connect-src": ["'self'", ...CONVEX, MAP_TILES, ...SPLAT_HOSTS],
  "frame-src": ["'none'"],
});

/** Headers every response gets, regardless of section. */
export const baseSecurityHeaders = [
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self)",
  },
] as const;

/**
 * HSTS, production only. A browser that has seen it refuses plain HTTP for
 * the whole max-age, so it must never reach localhost, `next start` on a
 * laptop or a preview URL: it is sent only when Vercel marks the deployment
 * as production (`VERCEL_ENV=production`). Two years with `includeSubDomains`
 * and `preload` is what the hstspreload.org list requires; submit the custom
 * domain there only once every subdomain serves HTTPS.
 */
const hsts =
  process.env.VERCEL_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : [];

/** `headers()` entries for next.config.ts. */
export function securityHeaders() {
  return [
    {
      source: "/admin/:path*",
      headers: [
        ...baseSecurityHeaders,
        ...hsts,
        { key: "Content-Security-Policy", value: adminCsp },
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
      ],
    },
    {
      source: "/:path*",
      headers: [...baseSecurityHeaders, ...hsts, { key: "Content-Security-Policy", value: publicCsp }],
    },
  ];
}
