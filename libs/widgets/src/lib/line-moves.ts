import type { Field, Form, Line } from '@fieldia/core';

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
