import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { securityHeaders } from "./lib/csp";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  experimental: {
    // Two root layouts (app/[locale] and app/admin) leave no single layout to
    // compose a global 404 from, which is exactly what this flag is for.
    globalNotFound: true,
  },
  images: {
    remotePatterns: [
      new URL("https://*.convex.cloud/api/storage/**"),
      new URL("https://images.unsplash.com/**"),
      new URL("https://dl.polyhaven.org/**"),
    ],
    qualities: [60, 75, 85, 90],
    minimumCacheTTL: 14400,
  },
  async headers() {
    return securityHeaders();
  },
};

export default withNextIntl(nextConfig);
