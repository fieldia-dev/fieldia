import type { Field } from './field';
import type { FieldNode } from './layout';
import type { FieldTools } from './part-checks';

/**
 * A repeat field (kept as text, an iCalendar rule) and a week's opening hours (kept as JSON): drawn by the schedule
 * part, whose checks of them come with it in the one-tag script.
 */
export function checkSchedule(node: FieldNode, def: Field | undefined, path: string, tools: FieldTools): void {
  const kind = node.widget === 'repeat' ? 'char' : 'json';
  if (def && def.type !== kind) tools.report(`${path}.widget`, `${node.widget} is for a ${kind} field; "${node.field}" is a ${def.type}`);
  const weekStart = kind === 'json' ? node.options?.['weekStart'] : undefined;
  if (weekStart !== undefined && !(Number.isInteger(weekStart) && (weekStart as number) >= 1 && (weekStart as number) <= 7)) tools.report(`${path}.options.weekStart`, 'weekStart is a weekday, 1 (Monday) to 7 (Sunday)');
}
