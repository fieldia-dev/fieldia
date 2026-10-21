/**
 * The editable part (parts.ts in @fieldia/widgets): a list whose cells are changed in place (`ListNode.editable`) —
 * a cell opened in its field's own box, Tab from cell to cell, each row saved through the data source as it is left,
 * one refused saying why under it, a row added at the end, a block pasted from a spreadsheet across the rows, a card's
 * fields in a sheet on a phone (list-editable.ts) — and its sheet (editable-styles.ts), put in after the list's own.
 * Loaded the first time a page draws such a list, through `editablePart`, beside the list part; the viewer waits for
 * it before it draws that page. Where it could not come, the list's rows are read and opened, as a list's always were.
 */
export { editableRows, opens, rowReads } from './list-editable';
export type { EditableContext, EditableRows, NewForm } from './list-editable';
export { installEditableStyles } from './editable-styles';
