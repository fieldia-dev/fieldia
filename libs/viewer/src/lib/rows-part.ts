/**
 * The rows part (parts.ts in @fieldia/widgets): a list's rows a person works in, each where the list asks — a row
 * opened in place to what it holds or what points at it (`detail`, list-detail.ts), rows re-ranked by hand
 * (`sequenceField`, list-rank.ts), a tree's children loaded as a parent opens (`loadChildren`, list-tree.ts) — and
 * their sheet (rows-styles.ts),
 * put in after the list's own. Loaded the first time a page draws a list that asks for any, through `rowsPart`, beside
 * the list part; the viewer waits for it before it draws that page. Where it could not come, the list's rows are read and
 * opened, as a list's always were.
 */
export { detailRows } from './list-detail';
export type { DetailContext, DetailRows } from './list-detail';
export { newRanks, rankRows } from './list-rank';
export type { RankContext, RankRows } from './list-rank';
export { lazyTree } from './list-tree';
export type { LazyTree, TreeContext } from './list-tree';
export { installRowsStyles } from './rows-styles';
