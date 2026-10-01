import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

/**
 * robots.txt (ARCHITECTURE §9). The admin, the API and the internal
 * styleguide are closed; `/admin` also sends `X-Robots-Tag: noindex` and the
 * styleguide a `noindex` meta, because robots.txt alone does not keep a URL
 * that is linked from elsewhere out of the index.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api", "/*/styleguide"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
