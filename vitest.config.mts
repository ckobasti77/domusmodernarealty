import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // The same `@/` root as tsconfig's `paths`, so lib modules that import
  // through it can be tested without a bundler.
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    // convex-test runs the Convex function runtime inside an edge-runtime VM.
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
    include: ["convex/**/*.test.ts", "lib/**/*.test.ts"],
  },
});
