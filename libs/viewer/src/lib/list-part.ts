/**
 * The list part (parts.ts in @fieldia/widgets): a list screen — its table of
 * records a page at a time, rows under their parent or their groups
 * (list-groups.ts), the records chosen and their buttons, the pager and the
 * switcher to another view (list.ts) — with its search bar, its menu, a filter
 * of a person's own and the favourites kept (search-bar.ts, custom-filter.ts,
 * favourites.ts), and its stylesheet (list-styles.ts), which it puts in the
 * page as it is first drawn. Loaded the first time a page draws a list,
 * through `listPart`; the viewer waits for it before it draws that page. A
 * filter bar of fields is the filters part's, asked for beside it.
 */
export { listView } from './list';
export { installListStyles } from './list-styles';
