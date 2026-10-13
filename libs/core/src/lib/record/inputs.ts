import type { Field } from '../format/field';
import type { FieldNode } from '../format/layout';
import { fill, type Messages } from './messages';
import { checkStructure } from './structures';
import type { Value } from './values';

/**
 * What a text field's widget asks of its answer, besides the field's own
 * rules: an email, a web address (example.com, www.example.com or https://…),
 * a phone number (a plus, digits, spaces, dots, dashes and brackets, 7 to 15
 * digits), a time of day (HH:MM, between the node's `min` and `max`), and no
 * more keywords than the node's `max` — and the structures' own, from
 * `structures`. Undefined when it keeps them, or when there is nothing to
 * check: an empty answer is `required`'s to judge.
 */
const FORMATS: Record<string, RegExp> = {
  email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/,
  url: /^(https?:\/\/)?([\p{L}\p{N}-]+\.)+\p{L}{2,}(:\d+)?([/?#]\S*)?$/iu,
  phone: /^\+?[\p{Nd}\s.()-]+$/u,
  time: /^([01]\d|2[0-3]):[0-5]\d$/,
};

export function checkInput(field: Field, node: FieldNode, value: Value | undefined, messages: Messages): string | undefined {
  const widget = node.widget ?? '';
  // A bar a person types into keeps to its own range — its options' min and max, else the field's, else 0 to 100 —
  // so the bar and its box never disagree. A maximum read from another field (maxField) is the bar's alone.
  if (widget === 'progressbar' && node.options?.['editable'] === true && typeof value === 'number' && (field.type === 'integer' || field.type === 'float' || field.type === 'monetary')) {
    const options = node.options;
    const label = node.label ?? field.label;
    const min = typeof options['min'] === 'number' ? options['min'] : (field.min ?? 0);
    const max = typeof options['maxField'] === 'string' ? undefined : typeof options['max'] === 'number' ? options['max'] : (field.max ?? 100);
    if (value < min) return fill(messages.min, { label, min });
    if (max !== undefined && value > max) return fill(messages.max, { label, max });
  }
  // Stars or a scale keep to the points they draw: the field's min and max, else a rating's 1 to 5 and a scale's 0 to 10.
  if ((widget === 'rating' || widget === 'scale') && typeof value === 'number' && field.type === 'integer') {
    const label = node.label ?? field.label;
    const min = field.min ?? (widget === 'rating' ? 1 : 0);
    const max = field.max ?? (widget === 'rating' ? 5 : 10);
    if (value < min) return fill(messages.min, { label, min });
    if (value > max) return fill(messages.max, { label, max });
  }
  if (field.type !== 'char') return checkStructure(field, node, value, messages);
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const text = value.trim();
  const options = node.options ?? {};
  const label = node.label ?? field.label;
  const format = FORMATS[widget];
  const digits = text.match(/\p{Nd}/gu)?.length ?? 0;
  if (format && (!format.test(text) || (widget === 'phone' && (digits < 7 || digits > 15)))) return messages[widget as 'email'];
  if (widget === 'time') {
    if (typeof options['min'] === 'string' && text < options['min']) return fill(messages.before, { label, min: options['min'] });
    if (typeof options['max'] === 'string' && text > options['max']) return fill(messages.after, { label, max: options['max'] });
    const off = offStep(text, options['step'], options['min']);
    if (off) return fill(messages.timeStep, { label, step: off.step, example: off.before, next: off.after });
  }
  if (widget === 'tags' && typeof options['max'] === 'number') {
    const count = text.split(typeof options['separator'] === 'string' && options['separator'] ? options['separator'] : ',').filter((t) => t.trim()).length;
    if (count > options['max']) return fill(messages.atMost, { label, max: options['max'] });
  }
  return undefined;
}

const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/**
 * A time between a node's steps (`step` minutes, counted from its earliest, else from 00:00), with the steps either
 * side of it — "07:10" in steps of 15 from 07:00 is between 07:00 and 07:15; undefined on a step, or with no steps.
 */
function offStep(time: string, step: unknown, min: unknown): { step: number; before: string; after: string } | undefined {
  if (typeof step !== 'number' || !Number.isInteger(step) || step <= 1 || !/^\d{2}:\d{2}$/.test(time)) return undefined;
  const from = typeof min === 'string' && /^\d{2}:\d{2}$/.test(min) ? minutesOf(min) : 0;
  const at = minutesOf(time);
  const past = (((at - from) % step) + step) % step;
  if (!past) return undefined;
  const before = at - past;
  // The day ends at 23:59: a step past it is the one before the last.
  const after = before + step < 24 * 60 ? before + step : before - step;
  return { step, before: clock(before), after: clock(Math.max(0, after)) };
}
