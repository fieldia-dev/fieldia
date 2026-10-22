/**
 * The week's first day in the one-tag script (tools/script-bundle.mjs, `WEEK_CARRIERS`): @fieldia/core's
 * `firstWeekday` — which region decides it, and CLDR's table of regions for an engine whose Intl has no week — is
 * carried by the parts that draw a week, not by fieldia.js, which draws none. Each of those parts puts its own here as
 * it comes, and fieldia.js's `firstWeekday` asks it.
 */
export const WEEK: { firstWeekday?: (language: string, page?: { readonly language?: string } | null, readers?: readonly string[]) => number } = {};
