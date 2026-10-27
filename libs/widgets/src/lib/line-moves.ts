import type { Field, Form, Line, LineField, Values } from '@fieldia/core';

/**
 * A line of a table or a card of a repeating group moved to another place:
 * numbered again by the field's sequence where it keeps one, else the list
 * of lines in its new order. The lines a page's value holds are in the order
 * they are shown.
 */
export function moveLineTo(form: Form, name: string, field: Field, key: string, to: number): void {
  if (field.type === 'one2many' && field.sequenceField) return form.moveLine(name, key, to);
  const lines = [...((form.getState().values[name] as Line[] | null) ?? [])];
  const from = lines.findIndex((line) => line.key === key);
  if (from < 0 || to < 0 || to >= lines.length || to === from) return;
  lines.splice(to, 0, ...lines.splice(from, 1));
  form.setValue(name, lines);
}

/**
 * What a line's own copy (a table's ⧉, a card's Copy) is added with: the line's values but its order's
 * (`sequenceField`: the copy is numbered as a new line is), and each line field's that says `copy: false`, which the
 * copy starts as a new line does — its `default`, or what its `defaultFrom` and the record's `lineDefaults` work out,
 * else empty — as `form.addLine(field, lineCopy(table, line.values))` starts what it is not given. The grid's copy
 * does the same (@fieldia/grid).
 */
export function lineCopy(table: { fields: Record<string, LineField>; sequenceField?: string }, values: Values): Values {
  const copy = { ...values };
  if (table.sequenceField) delete copy[table.sequenceField];
  for (const [name, def] of Object.entries(table.fields)) if (def.copy === false) delete copy[name];
  return copy;
}
