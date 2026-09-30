import { env } from "./_generated/server";

// Without this file `ctx.auth.getUserIdentity()` is always null and the app is
// silently signed out. `CONVEX_SITE_URL` is provided by the platform.
const authConfig = {
  providers: [
    {
      domain: env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};

export default authConfig;
