"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  throw new Error(
    "NEXT_PUBLIC_CONVEX_URL is not set. Run `npx convex dev` to create the dev deployment.",
  );
}

/**
 * The admin panel is a client-rendered app. Its Convex client is created here
 * so step 03 can swap `ConvexProvider` for `ConvexAuthProvider` from
 * `@convex-dev/auth/react` (token in localStorage) without touching the layout.
 */
export const adminConvexClient = new ConvexReactClient(convexUrl);

export function AdminProviders({ children }: { children: ReactNode }) {
  // Step 03 replaces ConvexProvider with ConvexAuthProvider from
  // `@convex-dev/auth/react`, keeping the same client instance.
  return (
    <ConvexProvider client={adminConvexClient}>
      <TooltipProvider delayDuration={200}>
        {children}
        <Toaster position="bottom-right" />
      </TooltipProvider>
    </ConvexProvider>
  );
}
