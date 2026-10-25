/**
 * `@fieldia/core/schema`: the page format's schemas and its whole check (`validatePage`) — zod's — on their own, for an
 * app that fetches them when it needs them (`await import('@fieldia/core/schema')`), as the designer does as it opens.
 * Its ESM file carries zod and every schema inside (tools/dual-build.mjs, OWN_FILE), so a bundler gives it a chunk of
 * its own, which nothing else on the page loads; @fieldia/core's own `validatePage` and schemas are the same, carried
 * at once by an app that imports them.
 */
export { validatePage } from './validate';
export { PageSchema } from './page';
export { FieldSchema } from './field';
export type { PageIssue, PageValidation } from './references';
