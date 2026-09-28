"use client";

import { ConvexReactClient, ConvexProvider } from "convex/react";
import type { ReactNode } from "react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  throw new Error(
    "NEXT_PUBLIC_CONVEX_URL is not set. Run `npx convex dev` to create the dev deployment.",
  );
}

/**
 * Public site Convex client: no auth, one instance per browser session.
 * Server Components read data with `fetchQuery`/`preloadQuery` instead; this
 * provider only exists for the interactive islands (favorites, filters, forms).
 */
const convex = new ConvexReactClient(convexUrl);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
