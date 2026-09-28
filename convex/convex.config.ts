import { defineApp } from "convex/server";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";

// CONVEX_SITE_URL / CONVEX_CLOUD_URL are provided by the platform and must not
// be redeclared here — redeclaring them fails the deploy.
const app = defineApp();
app.use(rateLimiter);

export default app;
