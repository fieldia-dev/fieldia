import type { Field, LineField } from './field';
import type { ListNode } from './layout';
import type { ListTools } from './list-checks';

/** What checks what a list shows of its records against their fields: its columns, order, search and cells. */
type Listed = (list: Pick<ListNode, 'columns' | 'sort' | 'searchFields' | 'cells'>, fields: Record<string, Field | LineField>, path: string, tools: ListTools) => void;

/**
 * The checks of a list's rows a person works in: what a row opens in place to show (`detail`) — a table of lines of the
 * page's and its lines' fields, or the records pointing at it by a link of theirs to the list's model.
 */
export function checkListWork(list: ListNode, path: string, tools: ListTools, listed: Listed): void {
  if (list.detail) checkDetail(list, `${path}.detail`, tools, listed);
  if (list.sequenceField !== undefined) checkRank(list, `${path}.sequenceField`, tools);
}

/** A list's rank: a whole number of its records, by which it is in order — else no row could be moved. */
function checkRank(list: ListNode, path: string, tools: ListTools): void {
  const def = tools.need(list.sequenceField as string, path);
  if (!def) return;
  if (def.type !== 'integer') return tools.report(path, `"${list.sequenceField}" is a ${def.type}; a list's records are ranked by a whole number`);
  if (def.readonly === true || def.compute) tools.report(path, `"${list.sequenceField}" is ${def.compute ? 'worked out from other fields' : 'read-only'}; a row moved writes its rank`);
  const first = list.sort?.[0];
  if (!first || first.field !== list.sequenceField || first.desc) tools.report(path, `the list opens in another order: put "${list.sequenceField}" first in its sort, ascending, so its rows can be moved`);
  if (list.parentField) tools.report(path, 'rows under their parent are not ranked by hand: a list ranks one level');
}

function checkDetail(list: ListNode, path: string, tools: ListTools, listed: Listed): void {
  const detail = list.detail as NonNullable<ListNode['detail']>;
  const model = tools.page.data.kind === 'record' ? tools.page.data.model : '';
  if (detail.lines !== undefined) {
    const def = tools.need(detail.lines, `${path}.lines`);
    if (!def) return;
    if (def.type !== 'one2many' || !def.fields) return tools.report(`${path}.lines`, `"${detail.lines}" is a ${def.type}; a row opens to a table of lines of the page's (a one2many with its fields)`);
    listed(detail, def.fields as Record<string, Field | LineField>, path, tools);
    return;
  }
  // The quick check reads no shapes: a part with nothing to go by is said here.
  if (typeof detail.model !== 'string' || typeof detail.field !== 'string' || !detail.fields || typeof detail.fields !== 'object') {
    return tools.report(path, 'a row opens to its lines (lines), or to the records pointing at it: their model, their link to it (field) and their fields');
  }
  const fields = detail.fields as Record<string, Field | LineField>;
  listed(detail, fields, path, tools);
  const link = Object.prototype.hasOwnProperty.call(fields, detail.field) ? fields[detail.field] : undefined;
  if (link && (link.type !== 'many2one' || link.relation !== model)) {
    tools.report(`${path}.field`, `"${detail.field}" ${link.type === 'many2one' ? `links to ${link.relation}` : `is a ${link.type}`}; the records a row opens to point at it by a many2one to ${model}`);
  }
  for (const [name, def] of Object.entries(fields)) {
    if (def.type === 'monetary' && def.currencyField !== undefined) tools.checkCurrency(def.currencyField, `${path}.fields.${name}.currencyField`, fields, undefined, fields);
  }
}
