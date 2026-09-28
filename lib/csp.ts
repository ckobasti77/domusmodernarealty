/**
 * The single source of truth for the Content-Security-Policy and the other
 * security headers (docs/02-ARCHITECTURE.md 10, IMPLEMENTATION-PLAN 5).
 *
 * The public site and `/admin` get different policies: only the public site
 * embeds third-party tour iframes and map tiles.
 */

const isDev = process.env.NODE_ENV !== "production";

/** Convex deployment (websocket + HTTP actions + file storage). */
const CONVEX = ["https://*.convex.cloud", "wss://*.convex.cloud", "https://*.convex.site"];

/** Verified demo asset hosts from docs/assets/demo-media.json. */
const DEMO_IMAGE_HOSTS = ["https://images.unsplash.com", "https://dl.polyhaven.org"];
const SPLAT_HOSTS = ["https://d28zzqy0iyovbz.cloudfront.net", "https://storage.googleapis.com"];

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
    "https://nominatim.openstreetmap.org",
  ],
  "frame-src": [
    "https://my.matterport.com",
    "https://kuula.co",
    "https://www.youtube-nocookie.com",
    "https://player.vimeo.com",
  ],
});

export const adminCsp = serialize({
  ...SHARED,
  "img-src": ["'self'", "data:", "blob:", ...DEMO_IMAGE_HOSTS, "https://*.convex.cloud", MAP_TILES],
  "connect-src": ["'self'", ...CONVEX, MAP_TILES, "https://nominatim.openstreetmap.org"],
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
 * `headers()` entries for next.config.ts. HSTS is deliberately left to the
 * hosting platform and documented as a production follow-up in docs/HANDOFF.md.
 */
export function securityHeaders() {
  return [
    {
      source: "/admin/:path*",
      headers: [
        ...baseSecurityHeaders,
        { key: "Content-Security-Policy", value: adminCsp },
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
      ],
    },
    {
      source: "/:path*",
      headers: [...baseSecurityHeaders, { key: "Content-Security-Policy", value: publicCsp }],
    },
  ];
}
