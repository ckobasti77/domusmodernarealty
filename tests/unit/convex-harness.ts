/// <reference types="vite/client" />
/**
 * One place that builds a convex-test instance with the app's schema AND the
 * mounted `rateLimiter` component registered — without it every public mutation
 * throws `Component "rateLimiter" is not registered`.
 *
 * It lives OUTSIDE `convex/` on purpose: Convex analyses every non-`*.test.ts`
 * file under `convex/` as a function module, and `import.meta.glob` is not
 * supported there ("Failed to analyze ...: import.meta unsupported").
 */
import { convexTest } from "convex-test";
// The subpath is not in the package "exports" map, so resolve the file directly.
import rateLimiterSchema from "../../node_modules/@convex-dev/rate-limiter/src/component/schema";
import schema from "../../convex/schema";

const modules = import.meta.glob("../../convex/**/*.ts");
const rateLimiterModules = import.meta.glob(
  "../../node_modules/@convex-dev/rate-limiter/src/component/**/*.ts",
);

export function testApp() {
  const t = convexTest(schema, modules);
  t.registerComponent("rateLimiter", rateLimiterSchema, rateLimiterModules);
  return t;
}
