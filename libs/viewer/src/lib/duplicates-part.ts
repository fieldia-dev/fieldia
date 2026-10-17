/**
 * The duplicates part (parts.ts in @fieldia/widgets): possible duplicates — records like the one typed, asked of the
 * data source's `duplicates` as a page's `duplicates` says, each said under the field it matched on with Open it,
 * "It's someone new" and Merge — and the merge's screen, two records side by side (duplicates.ts, merge-screen.ts),
 * with their stylesheet (duplicates-styles.ts). Loaded through `duplicatesPart` the first time a page that names
 * fields in `duplicates` is shown with a source that has `duplicates`; the page is drawn meanwhile, and nothing is
 * said before an answer comes.
 */
export { watchDuplicates } from './duplicates';
export { openMergeScreen } from './merge-screen';
export { installDuplicateStyles } from './duplicates-styles';
