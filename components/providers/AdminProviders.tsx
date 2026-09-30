"use client";

import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { ThemeProvider } from "next-themes";
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
 * The admin panel is a client-rendered app (ARCHITECTURE §3). Convex Auth keeps
 * the session token in localStorage; the real security boundary is
 * `requireRole()` inside every Convex admin function, so no proxy auth exists.
 */
export const adminConvexClient = new ConvexReactClient(convexUrl);

export function AdminProviders({ children }: { children: ReactNode }) {
  return (
    <ConvexAuthProvider client={adminConvexClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        storageKey="me-admin-theme"
        disableTransitionOnChange
      >
        <TooltipProvider delayDuration={200}>
          {children}
          <Toaster position="bottom-right" closeButton />
        </TooltipProvider>
      </ThemeProvider>
    </ConvexAuthProvider>
  );
}
