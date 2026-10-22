/**
 * The live part (parts.ts): a record's changes made elsewhere laid on it or waiting as a conflict, and who else has it
 * open (live.ts) — asked of the data source's `subscribe` and `presence`. One of the parts that join a form (joins.ts),
 * loaded through `recordLivePart` (live-later.ts) as a form is made whose source has either.
 */
export { join, liveRecord } from './live';
