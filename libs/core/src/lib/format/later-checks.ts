import { lazyPart, type Part } from '../parts';
import type * as MapChecksModule from './mapchecks-part';

/**
 * The checks of a page the one-tag script carries in the part that draws what they check, rather than in its main
 * script — a list page's own settings and a related list's in the list part (list-checks.ts), a record's head in the
 * head part (sheet-head-checks.ts), a page's limits and Continue later in the limits part (limits-checks.ts), booking
 * slots' in the slots part, a signature's in the files part, a page's endings in the answers part, a table of lines' in
 * the lines part (table-checks.ts), a sheet's statusbar in the business part, options by condition and carried in the
 * options part, a survey's flow's in its own part (flow-checks.ts) — and a map's in a
 * part of their own (`mapChecksPart`): by part, put here as each part comes (tools/script-bundle.mjs, `CHECKS_IN_PARTS`).
 * Until then the main script's reference check owes them (`PageValidation.later`), and the viewer asks for the parts it
 * owes and runs it again once they have come, before the page is drawn. The packages' checks are whole at once and never
 * read this.
 */
export const LATER_CHECKS: Record<string, Readonly<Record<string, unknown>> | undefined> = {};

/** A map's checks (map-checks.ts): a part the one-tag script's viewer asks for where a page's check owes them. */
export const mapChecksPart: Part<typeof MapChecksModule> = lazyPart('mapchecks', () => import('./mapchecks-part'));
