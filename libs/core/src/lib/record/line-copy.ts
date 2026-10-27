import type { LineField } from '../format/field';
import type { Values } from './values';

/**
 * What a line's own copy (a table's ⧉, a card's Copy) is added with: the line's values but its order's
 * (`sequenceField`: the copy is numbered as a new line is), and each line field's that says `copy: false`, which the
 * copy starts as a new line does — its `default`, or what its `defaultFrom` and the record's `lineDefaults` work out,
 * else empty — as `form.addLine(field, lineCopy(table, line.values))` starts what it is not given.
 */
export function lineCopy(table: { fields: Record<string, LineField>; sequenceField?: string }, values: Values): Values {
  const copy = { ...values };
  if (table.sequenceField) delete copy[table.sequenceField];
  for (const [name, def] of Object.entries(table.fields)) if (def.copy === false) delete copy[name];
  return copy;
}
