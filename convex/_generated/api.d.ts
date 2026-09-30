/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activity from "../activity.js";
import type * as agents from "../agents.js";
import type * as agentsAdmin from "../agentsAdmin.js";
import type * as analytics from "../analytics.js";
import type * as auth from "../auth.js";
import type * as contacts from "../contacts.js";
import type * as crons from "../crons.js";
import type * as demo from "../demo.js";
import type * as demoInternal from "../demoInternal.js";
import type * as geocode from "../geocode.js";
import type * as http from "../http.js";
import type * as invites from "../invites.js";
import type * as leads from "../leads.js";
import type * as leadsAdmin from "../leadsAdmin.js";
import type * as lib_activity from "../lib/activity.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_belgradeTime from "../lib/belgradeTime.js";
import type * as lib_checklist from "../lib/checklist.js";
import type * as lib_counts from "../lib/counts.js";
import type * as lib_derive from "../lib/derive.js";
import type * as lib_dto from "../lib/dto.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_geo from "../lib/geo.js";
import type * as lib_listingCascade from "../lib/listingCascade.js";
import type * as lib_money from "../lib/money.js";
import type * as lib_rateLimit from "../lib/rateLimit.js";
import type * as lib_search from "../lib/search.js";
import type * as lib_slug from "../lib/slug.js";
import type * as lib_storage from "../lib/storage.js";
import type * as lib_tokens from "../lib/tokens.js";
import type * as lib_validators from "../lib/validators.js";
import type * as listings from "../listings.js";
import type * as listingsAdmin from "../listingsAdmin.js";
import type * as listingsInternal from "../listingsInternal.js";
import type * as locations from "../locations.js";
import type * as locationsAdmin from "../locationsAdmin.js";
import type * as media from "../media.js";
import type * as pages from "../pages.js";
import type * as pagesAdmin from "../pagesAdmin.js";
import type * as posts from "../posts.js";
import type * as postsAdmin from "../postsAdmin.js";
import type * as qa from "../qa.js";
import type * as seed from "../seed.js";
import type * as seed_agents from "../seed/agents.js";
import type * as seed_content_listings1 from "../seed/content/listings1.js";
import type * as seed_content_listings2 from "../seed/content/listings2.js";
import type * as seed_content_listings3 from "../seed/content/listings3.js";
import type * as seed_content_pages from "../seed/content/pages.js";
import type * as seed_content_posts from "../seed/content/posts.js";
import type * as seed_locations from "../seed/locations.js";
import type * as seed_media from "../seed/media.js";
import type * as seed_spec from "../seed/spec.js";
import type * as seed_specTypes from "../seed/specTypes.js";
import type * as seedStages from "../seedStages.js";
import type * as settings from "../settings.js";
import type * as settingsAdmin from "../settingsAdmin.js";
import type * as stats from "../stats.js";
import type * as testimonials from "../testimonials.js";
import type * as testimonialsAdmin from "../testimonialsAdmin.js";
import type * as tests_fixtures from "../tests/fixtures.js";
import type * as tours from "../tours.js";
import type * as toursAdmin from "../toursAdmin.js";
import type * as uploads from "../uploads.js";
import type * as users from "../users.js";
import type * as viewings from "../viewings.js";
import type * as viewingsAdmin from "../viewingsAdmin.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activity: typeof activity;
  agents: typeof agents;
  agentsAdmin: typeof agentsAdmin;
  analytics: typeof analytics;
  auth: typeof auth;
  contacts: typeof contacts;
  crons: typeof crons;
  demo: typeof demo;
  demoInternal: typeof demoInternal;
  geocode: typeof geocode;
  http: typeof http;
  invites: typeof invites;
  leads: typeof leads;
  leadsAdmin: typeof leadsAdmin;
  "lib/activity": typeof lib_activity;
  "lib/auth": typeof lib_auth;
  "lib/belgradeTime": typeof lib_belgradeTime;
  "lib/checklist": typeof lib_checklist;
  "lib/counts": typeof lib_counts;
  "lib/derive": typeof lib_derive;
  "lib/dto": typeof lib_dto;
  "lib/errors": typeof lib_errors;
  "lib/geo": typeof lib_geo;
  "lib/listingCascade": typeof lib_listingCascade;
  "lib/money": typeof lib_money;
  "lib/rateLimit": typeof lib_rateLimit;
  "lib/search": typeof lib_search;
  "lib/slug": typeof lib_slug;
  "lib/storage": typeof lib_storage;
  "lib/tokens": typeof lib_tokens;
  "lib/validators": typeof lib_validators;
  listings: typeof listings;
  listingsAdmin: typeof listingsAdmin;
  listingsInternal: typeof listingsInternal;
  locations: typeof locations;
  locationsAdmin: typeof locationsAdmin;
  media: typeof media;
  pages: typeof pages;
  pagesAdmin: typeof pagesAdmin;
  posts: typeof posts;
  postsAdmin: typeof postsAdmin;
  qa: typeof qa;
  seed: typeof seed;
  "seed/agents": typeof seed_agents;
  "seed/content/listings1": typeof seed_content_listings1;
  "seed/content/listings2": typeof seed_content_listings2;
  "seed/content/listings3": typeof seed_content_listings3;
  "seed/content/pages": typeof seed_content_pages;
  "seed/content/posts": typeof seed_content_posts;
  "seed/locations": typeof seed_locations;
  "seed/media": typeof seed_media;
  "seed/spec": typeof seed_spec;
  "seed/specTypes": typeof seed_specTypes;
  seedStages: typeof seedStages;
  settings: typeof settings;
  settingsAdmin: typeof settingsAdmin;
  stats: typeof stats;
  testimonials: typeof testimonials;
  testimonialsAdmin: typeof testimonialsAdmin;
  "tests/fixtures": typeof tests_fixtures;
  tours: typeof tours;
  toursAdmin: typeof toursAdmin;
  uploads: typeof uploads;
  users: typeof users;
  viewings: typeof viewings;
  viewingsAdmin: typeof viewingsAdmin;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
