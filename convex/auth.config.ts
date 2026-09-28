import { env } from "./_generated/server";

// Without this file `ctx.auth.getUserIdentity()` is always null and the app is
// silently signed out. `CONVEX_SITE_URL` is provided by the platform.
export default {
  providers: [
    {
      domain: env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
