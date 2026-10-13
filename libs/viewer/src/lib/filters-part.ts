/**
 * The filters part (parts.ts in @fieldia/widgets): a list's filter bar — a
 * keyword, each field's values to tick, the gear choosing the fields, × that
 * clears them — and its stylesheet. Loaded the first time a list draws one,
 * through `filtersPart`; the viewer waits for it before it draws that list.
 */
export { filterBar } from './filter-bar';
export { installFilterStyles } from './filter-styles';
