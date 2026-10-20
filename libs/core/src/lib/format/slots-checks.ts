import type { FieldNode } from './layout';
import type { FieldTools } from './part-checks';

/** Whether a record holds a key of its own. */
const has = (record: object, key: string) => Object.prototype.hasOwnProperty.call(record, key);

/** Booking slots on a date and time: its end written in another, asked again as the fields it depends on change. */
export function checkSlots(node: FieldNode, path: string, tools: FieldTools): void {
  const options = node.options ?? {};
  const end = options['endField'];
  if (typeof end === 'string' && has(tools.page.fields, end)) {
    const type = tools.page.fields[end].type;
    if (end === node.field) tools.report(`${path}.options.endField`, 'a booking ends in another field than the one it starts in');
    else if (type !== 'datetime') tools.report(`${path}.options.endField`, `"${end}" is a ${type}; a booking's end is kept in a datetime field`);
  }
  const on = options['dependsOn'];
  if (Array.isArray(on)) on.forEach((name, i) => typeof name === 'string' && tools.need(name, `${path}.options.dependsOn[${i}]`));
}
