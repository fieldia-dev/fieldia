/**
 * The live part (parts.ts): a record's changes made elsewhere laid on it or waiting as a conflict, and who else has it
 * open (live.ts) — asked of the data source's `subscribe` and `presence`. Loaded through `recordLivePart` (live-later.ts) the
 * first time a form of a record shows one with an id, where its source has either.
 */
export { liveRecord } from './live';
