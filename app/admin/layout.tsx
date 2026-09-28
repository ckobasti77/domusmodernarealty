import type { Metadata, Viewport } from "next";
import { fontVariables } from "@/app/fonts";
import { AdminProviders } from "@/components/providers/AdminProviders";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: {
    default: "Administracija — Mihajlo Estate",
    template: "%s — Administracija",
  },
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  themeColor: "#fbf9f5",
  colorScheme: "light",
};

/**
 * ADMIN root layout (root layout #2). Serbian (Latin) only, `noindex`, and
 * deliberately free of Lenis and GSAP — admin micro-interactions are CSS
 * transitions under 300 ms. `class="admin"` switches globals.css over to the
 * shadcn semantic palette.
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <html lang="sr-Latn" className={fontVariables}>
      <body className="admin min-h-svh">
        <AdminProviders>{children}</AdminProviders>
      </body>
    </html>
  );
}
