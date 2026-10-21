import type { ListNode } from './layout';
import { cellChangeable, EDIT_KINDS } from './list-editable';
import { languagesOf } from '../record/languages';
import type { FieldTools } from './part-checks';

/**
 * A list's cells changed in place (`editable`): each column it names one of its own, of a kind a cell changes, people's
 * to change; with true, one such column at least. In the one-tag script they come with the editable part, which draws
 * what they check (later-checks.ts); the packages' `checkPage` and `validatePage` run them at once.
 */
export function checkEditable(list: ListNode, path: string, tools: FieldTools): void {
  const editable = list.editable;
  if (!editable) return;
  if (editable === true || !editable.fields) {
    if (!list.columns.some((name) => cellChangeable(tools.page.fields[name]))) tools.report(`${path}.editable`, 'its cells change the columns a box in a cell can, and none of these can: words, a number, money, yes or no, a date, a choice or a link people can change');
    return;
  }
  const named = editable.fields;
  named.forEach((name, i) => {
    const at = `${path}.editable.fields[${i}]`;
    if (named.indexOf(name) !== i) tools.report(at, `"${name}" is named twice`);
    const def = tools.need(name, at);
    if (!def) return;
    if (!list.columns.includes(name)) tools.report(at, `"${name}" is no column of this list: a cell changed in place is one of its columns`);
    else if (!EDIT_KINDS.has(def.type)) tools.report(at, `"${name}" is a ${def.type}; a cell changes words, a number, money, a yes or no, a date, a choice, or a link or links`);
    else if (def.readonly === true || def.compute) tools.report(at, `"${name}" is ${def.compute ? 'worked out from other fields' : 'read-only'}; a cell changes a field people can change`);
    else if (languagesOf(def)) tools.report(at, `"${name}" is kept in several languages (translate); a cell holds one box, so its languages are typed on the record's page, under their switch`);
  });
}
