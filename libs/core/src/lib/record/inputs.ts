import type { Field } from '../format/field';
import type { FieldNode } from '../format/layout';
import { foldDigits, stripMarks } from './input-rules';
import { fill, type Messages } from './messages';
import { checkStructure } from './structures';
import type { Value } from './values';

/**
 * What a text field's widget asks of its answer, besides the field's own
 * rules: an email, a web address (example.com, localhost:3000, 192.168.1.10,
 * https://…), a phone number (a plus, digits in any script, spaces, dots,
 * dashes and brackets, 7 to 15 digits), a time of day (HH:MM, between the
 * node's `min` and `max`), and no more keywords than the node's `max` — and
 * the structures' own, from `structures`. Invisible direction marks, which
 * text copied from Arabic carries, are no part of an address or a number.
 * Undefined when it keeps them, or when there is nothing to check: an empty
 * answer is `required`'s to judge.
 */
const FORMATS: Record<string, RegExp> = {
  email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/u,
  phone: /^\+?[\p{Nd}\s.()-]+$/u,
  time: /^([01]\d|2[0-3]):[0-5]\d$/,
};

/** A web address's parts: its scheme, its host (a name, an IPv4 or an [IPv6] address), its port and the rest. */
const WEB = /^(?:([a-z][a-z0-9+.-]*):\/\/)?(\[[0-9a-f:.]+\]|[^\s/?#:[\]@]+)(?::(\d{1,5}))?([/?#]\S*)?$/iu;
/** A scheme a link must never have: it runs code or reads the computer's files. */
const NEVER = /^(?:javascript|data|vbscript|file):/i;
/** A name's label: letters and digits in any script, with dashes inside it. */
const LABEL = /^[\p{L}\p{N}\p{M}](?:[\p{L}\p{N}\p{M}-]*[\p{L}\p{N}\p{M}])?$/u;

/**
 * Whether text is a web address, and if not, why: 'scheme' for one of
 * another kind — javascript:, data:, mailto:, ftp: — which never goes where a
 * web address does; 'bad' for text that is no address. With or without
 * http:// or https://; a name with dots and a top level of two or more
 * letters (example.com, مثال.مصر), a single name (localhost, intranet), an
 * IPv4 or IPv6 address, and a port.
 */
export function webAddress(text: string): 'ok' | 'scheme' | 'bad' {
  const t = stripMarks(text).trim();
  if (NEVER.test(t)) return 'scheme';
  // Another scheme ("mailto:", "ftp://"), not a name and its port ("localhost:3000").
  const scheme = /^([a-z][a-z0-9+.-]*):(?!\d)/i.exec(t);
  if (scheme && !/^https?$/i.test(scheme[1])) return 'scheme';
  const parts = WEB.exec(t);
  if (!parts) return 'bad';
  const [, , host, port] = parts;
  if (port !== undefined && Number(port) > 65535) return 'bad';
  if (host.startsWith('[')) return host.split(':').length >= 3 ? 'ok' : 'bad';
  const labels = host.split('.');
  if (labels.every((label) => /^\d+$/.test(label))) return labels.length === 4 && labels.every((n) => Number(n) <= 255) ? 'ok' : 'bad';
  if (!labels.every((label) => LABEL.test(label))) return 'bad';
  const top = labels[labels.length - 1];
  return labels.length === 1 || ([...top].length >= 2 && !/^\d+$/.test(top)) ? 'ok' : 'bad';
}

/**
 * The text a one-line box keeps once it is left, in place of what was typed:
 * a phone number and an answer a pattern checks with their digits as 0-9
 * and no direction marks; an email and a web address with no direction
 * marks; any other text with none at its ends — each trimmed, spaces alone
 * being nothing. A password is kept as it is.
 */
export function settledText(text: string, kind: { widget?: string; pattern?: boolean }): string {
  const { widget, pattern } = kind;
  if (widget === 'password') return text;
  if (widget === 'phone' || pattern) return foldDigits(stripMarks(text)).trim();
  if (widget === 'email' || widget === 'url') return stripMarks(text).trim();
  return stripMarks(text, 'ends').trim();
}

/** Whether a field's answer is checked against a pattern: the field's own, or an answer rule's on its node. */
export function hasPattern(field: Field, node: FieldNode): boolean {
  return (field.type === 'char' && field.pattern !== undefined) || !!node.validate?.some((rule) => rule.pattern !== undefined);
}

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
  // An address or a number copied from Arabic text brings direction marks along: no part of it, never a reason to refuse it.
  const text = widget === 'phone' ? foldDigits(stripMarks(value)).trim() : widget === 'email' || widget === 'url' ? stripMarks(value).trim() : value.trim();
  const options = node.options ?? {};
  const label = node.label ?? field.label;
  if (widget === 'url') {
    const address = webAddress(text);
    if (address !== 'ok') return address === 'scheme' ? messages.urlScheme : messages.url;
  }
  const format = FORMATS[widget];
  const digits = text.match(/\p{Nd}/gu)?.length ?? 0;
  // Any other invisible character left in an email (a zero-width space, a joiner) makes an address no mail reaches.
  if (widget === 'email' && /\p{Cf}/u.test(text)) return messages.email;
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
