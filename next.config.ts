import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { securityHeaders } from "./lib/csp";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // No framework banner in every response.
  poweredByHeader: false,
  experimental: {
    // Two root layouts (app/[locale] and app/admin) leave no single layout to
    // compose a global 404 from, which is exactly what this flag is for.
    globalNotFound: true,
  },
  images: {
    // Object form, NOT `new URL(...)`: a URL instance carries `search: ""`, and
    // `match-remote-pattern` treats a defined `search` as an exact match — which
    // rejects every demo photo, since they all arrive as
    // `...?w=1600&q=80&auto=format&fit=crop`. Omitting `search` allows any query.
    remotePatterns: [
      { protocol: "https", hostname: "*.convex.cloud", pathname: "/api/storage/**" },
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      { protocol: "https", hostname: "dl.polyhaven.org", pathname: "/**" },
    ],
    qualities: [60, 75, 85, 90],
    minimumCacheTTL: 14400,
  },
  async headers() {
    return securityHeaders();
  },
};

export default withNextIntl(nextConfig);
