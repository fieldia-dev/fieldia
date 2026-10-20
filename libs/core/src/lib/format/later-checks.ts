/**
 * The checks of a page the one-tag script carries in the part that draws what they check, rather than in its main
 * script — a list page's own settings in the list part (list-checks.ts), a record's head in the head part
 * (sheet-head-checks.ts), a page's limits and Continue later in the limits part (limits-checks.ts) — by part, put here as each part comes
 * (tools/script-bundle.mjs, `CHECKS_IN_PARTS`). Until then the main script's reference check owes them
 * (`PageValidation.later`), and the viewer runs it again once the part has come, before the page is drawn. The
 * packages' checks are whole at once and never read this.
 */
export const LATER_CHECKS: Record<string, Readonly<Record<string, unknown>> | undefined> = {};
