/**
 * The columns part (parts.ts in @fieldia/widgets): the columns a person shapes in a list with `optionalColumns` —
 * shown, hidden and ordered from the Columns menu at the header's end, sized by a header's grip, kept for them in the
 * viewer's preferences (list-columns.ts) — and their sheet (columns-styles.ts), with the header and the first column
 * kept in view, put in after the list's own. Loaded the first time a page draws such a list, through `columnsPart`,
 * beside the list part; the viewer waits for it before it draws that page. Where it could not come, the list shows the
 * page's columns, as a list without `optionalColumns` does.
 */
export { columnChoices, columnsKey } from './list-columns';
export type { ColumnChoices, ColumnsContext } from './list-columns';
export { installColumnStyles } from './columns-styles';
