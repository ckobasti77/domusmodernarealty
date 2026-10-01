import { z } from "zod";

/**
 * The admin's one entry to classic zod. Classic object schemas probe whether
 * `eval` is allowed (`new Function("")` in a try/catch) to pick a faster
 * parser; the probe is caught, but under the admin CSP — no `'unsafe-eval'`
 * — the browser still reports it as a violation on every page with a form.
 * `jitless` skips the probe and always uses the plain parser, which is what
 * the CSP forces anyway. Every admin module imports `z` from here so the
 * setting is applied before any schema is built.
 */
z.config({ jitless: true });

export { z };
