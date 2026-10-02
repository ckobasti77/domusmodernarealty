import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// 03:00 UTC — take listings whose brokerage contract expired off the market.
crons.cron(
  "expire brokerage mandates",
  "0 3 * * *",
  internal.listingsInternal.expireMandates,
  {},
);

// 03:05 UTC — roll yesterday's views/leads/viewings into dailyStats for the
// dashboard charts, so no query ever has to aggregate at read time.
crons.cron("roll up daily stats", "5 3 * * *", internal.stats.rollupDaily, {});

// 03:20 UTC — drop view/favorite dedupe rows older than 30 days so
// `listingViews` and `listingFavorites` do not grow without bound.
crons.cron(
  "prune listing view dedupe rows",
  "20 3 * * *",
  internal.stats.pruneSessionMarks,
  {},
);

export default crons;
