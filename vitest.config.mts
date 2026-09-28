import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // convex-test runs the Convex function runtime inside an edge-runtime VM.
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
    include: ["convex/**/*.test.ts", "lib/**/*.test.ts"],
  },
});
