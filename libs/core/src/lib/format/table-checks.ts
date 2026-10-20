import type { Field } from './field';
import type { ButtonNode, FieldNode, StatButton } from './layout';
import type { FieldTools } from './part-checks';
import type { Scope } from './references';

/** What a table of lines' checks are handed: a field's tools, and the reference check's own for rules and buttons. */
export interface TableTools extends FieldTools {
  claim(id: string, path: string): void;
  checkModifiers(owner: object, path: string, keys?: readonly string[], scope?: Scope): void;
  checkPress(button: ButtonNode | StatButton, path: string): void;
}

/** Whether a record holds a key of its own. */
const has = (record: object, key: string) => Object.prototype.hasOwnProperty.call(record, key);

/**
 * A table of lines' own settings (a one2many's field node): its columns fields of its lines, its totals of number
 * columns, its order by fields of its lines, its cells' rules read on their line (a column's `hidden` on the record),
 * its rows' tones, bold, delete and buttons, the columns a person may hide among those it shows. Drawn by the lines
 * part, which carries them in the one-tag script, run once it came (later-checks.ts); the packages' checks run them at
 * once. (What is wrong for a field that is no table is the reference check's to say.)
 */
export function checkTable(node: FieldNode, def: Extract<Field, { type: 'one2many' }>, path: string, tools: TableTools): void {
  node.columns?.forEach((column, i) => {
    if (!has(def.fields, column)) {
      tools.report(`${path}.columns[${i}]`, `"${column}" is not a field of the lines of "${node.field}"`);
    } else if (def.fields[column].type === 'one2many') {
      tools.report(`${path}.columns[${i}]`, `"${column}" holds lines of its own: they are edited in the line's form (lineForm), not drawn in its row`);
    }
  });
  node.totals?.forEach((column, i) => {
    const sub = has(def.fields, column) ? def.fields[column] : undefined;
    if (!sub) tools.report(`${path}.totals[${i}]`, `"${column}" is not a field of the lines of "${node.field}"`);
    else if (!['integer', 'float', 'monetary'].includes(sub.type)) {
      tools.report(`${path}.totals[${i}]`, `"${column}" is a ${sub.type}; only integer, float and monetary columns add up`);
    }
  });
  node.order?.forEach((item, i) => !has(def.fields, item.field) && tools.report(`${path}.order[${i}].field`, `"${item.field}" is not a field of the lines of "${node.field}"`));
  if (node.cells || node.rowTones || node.rowBold !== undefined || node.rowButtons || node.lineDelete !== undefined) {
    const line: Scope = { fields: def.fields, lines: node.field };
    for (const [column, rules] of Object.entries(node.cells ?? {})) {
      if (!has(def.fields, column)) {
        tools.report(`${path}.cells.${column}`, `"${column}" is not a field of the lines of "${node.field}"`);
        continue;
      }
      tools.checkModifiers(rules, `${path}.cells.${column}`, ['invisible', 'readonly', 'required', 'bold'], line);
      tools.checkModifiers(rules, `${path}.cells.${column}`, ['hidden']);
      rules.tones?.forEach((tone, i) => tools.checkModifiers(tone, `${path}.cells.${column}.tones[${i}]`, ['when'], line));
      // Its widget's options that point at a field: one of the line's.
      for (const [key, value] of Object.entries(rules.options ?? {})) {
        if (key.endsWith('Field') && typeof value === 'string') tools.need(value, `${path}.cells.${column}.options.${key}`, def.fields);
      }
    }
    node.rowTones?.forEach((tone, i) => tools.checkModifiers(tone, `${path}.rowTones[${i}]`, ['when'], line));
    tools.checkModifiers(node, path, ['rowBold', 'lineDelete'], line);
    node.rowButtons?.forEach((button, i) => {
      tools.claim(button.id, `${path}.rowButtons[${i}]`);
      tools.checkModifiers(button, `${path}.rowButtons[${i}]`, ['invisible'], line);
      tools.checkPress(button, `${path}.rowButtons[${i}]`);
    });
  }
  if (node.optionalColumns) {
    // The columns the table shows: those named, or every line field but the structural ones.
    const shown = node.columns ?? Object.keys(def.fields).filter((c) => c !== ('lineKinds' in def ? def.lineKinds?.field : undefined) && c !== def.sequenceField);
    for (const column of Object.keys(node.optionalColumns)) {
      if (!shown.includes(column)) tools.report(`${path}.optionalColumns.${column}`, `"${column}" is not a column of "${node.field}"`);
    }
  }
}
