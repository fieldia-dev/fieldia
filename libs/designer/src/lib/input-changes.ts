import type { Field, FieldNode } from '@fieldia/core';
import { kindOfField } from './kinds';

/**
 * What changed in a field's text, number and date settings from one version
 * of a page to the next, in words: "“Bio”: takes at most 200 characters". A
 * field's own settings are said only while it stays the same kind of data —
 * a field made another kind says so on its own. It hands back the keys of its
 * widget's settings it does not say (`unsaid`), for other words to say.
 */

interface Placed {
  field: Field;
  node: FieldNode;
}

/** The words for a setting's new value, or null where these words have none for it. */
type Words = (value: unknown, now: Placed, kind: string | null) => string | null;

const DATES = ['date', 'datetime'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** "today", "30 days after today", "7 days before today", "2026-03-02". */
function dayWords(limit: string): string {
  const counted = /^today([+-])(\d+)$/.exec(limit);
  if (!counted) return limit;
  return `${counted[2]} day${counted[2] === '1' ? '' : 's'} ${counted[1] === '+' ? 'after' : 'before'} today`;
}

/** A range in words: "from 0 to 300", "at least 0", "between today and …", "no later than …". */
function range(field: Field): string {
  const { min, max } = field as { min?: unknown; max?: unknown };
  if (DATES.includes(field.type)) {
    const [a, b] = [min, max].map((v) => (typeof v === 'string' ? dayWords(v) : undefined));
    return a && b ? `between ${a} and ${b}` : a ? `no earlier than ${a}` : b ? `no later than ${b}` : 'any day';
  }
  if (min !== undefined && max !== undefined) return `from ${min} to ${max}`;
  return min !== undefined ? `at least ${min}` : max !== undefined ? `at most ${max}` : 'any number';
}

/** "A or B", "A, B or C". */
const orList = (words: string[]) => (words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} or ${words[words.length - 1]}`);

/** The field's own settings, by key: those said together, under the first. */
const FIELD_WORDS: Record<string, Words> = {
  size: (v) => (v === undefined ? 'takes any number of characters' : `takes at most ${v} characters`),
  'min,max': (_v, now) => range(now.field),
  digits: (v) => (v === undefined ? 'the usual decimals' : `${(v as number[])[1]} decimal${(v as number[])[1] === 1 ? '' : 's'}`),
  days: (v) => (Array.isArray(v) ? `not on ${orList(DAY_NAMES.filter((_, i) => !v.includes(i + 1)))}` : 'any day of the week'),
  default: (v, now) => (now.field.type !== 'date' ? null : v === 'today' ? 'starts on today' : 'starts empty'),
};

/** The widget's settings, by key. */
const OPTION_WORDS: Record<string, Words> = {
  rows: (v) => `starts ${v ?? 3} rows high`,
  autoGrow: (v) => (v === false ? 'keeps its height as people type' : 'grows as people type'),
  prefix: (v) => (v ? `shows “${v}” before the number` : 'no unit before the number'),
  suffix: (v) => (v ? `shows “${v}” after the number` : 'no unit after the number'),
  startLabel: (v) => (v ? `“${v}” at the start` : 'no words at the start'),
  endLabel: (v) => (v ? `“${v}” at the end` : 'no words at the end'),
  nps: (v) => (v ? 'coloured as NPS' : 'no longer coloured as NPS'),
  icon: (v) => `shown as ${({ heart: 'hearts', thumb: 'thumbs up', number: 'numbers' } as Record<string, string>)[v as string] ?? 'stars'}`,
  min: (v, _now, kind) => (kind !== 'time' ? null : v ? `no earlier than ${v}` : 'any time from midnight'),
  max: (v, _now, kind) => (kind === 'time' ? (v ? `no later than ${v}` : 'any time until midnight') : kind === 'keywords' ? (v ? `takes at most ${v}` : 'takes any number') : null),
  color: (v, _now, kind) => (kind !== 'progress' ? null : `${({ success: 'always green', warning: 'always amber', danger: 'always red', info: 'always blue' } as Record<string, string>)[v as string] ?? 'coloured by how far it has come'}`),
  showPercent: (v, _now, kind) => (kind !== 'progress' ? null : v === false ? 'no percent on the bar' : 'the percent on the bar'),
  separator: (v, _now, kind) => (kind === 'keywords' ? `keywords apart by “${v ?? ','}”` : null),
  suggestions: (v, _now, kind) => (kind !== 'keywords' ? null : Array.isArray(v) ? `suggests ${v.length < 2 ? v.join('') : `${v.slice(0, -1).join(', ')} and ${v[v.length - 1]}`}` : 'suggests nothing'),
  step: (v, _now, kind) => (kind === 'time' || kind === 'date-time' ? (v ? `every ${v} minutes` : 'any minute') : kind === 'slider' ? `steps by ${v ?? 1}` : null),
};

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function inputChanges(name: string, was: Placed, now: Placed): { lines: string[]; unsaid: string[] } {
  const lines: string[] = [];
  const say = (words: string | null) => words !== null && lines.push(`“${name}”: ${words}`);
  const kind = kindOfField(now.field, now.node);
  const own = (p: Placed, key: string) => (p.field as Record<string, unknown>)[key];
  if (was.field.type === now.field.type) {
    for (const [keys, words] of Object.entries(FIELD_WORDS)) {
      const read = (p: Placed) => keys.split(',').map((key) => own(p, key));
      if (!same(read(was), read(now))) say(words(own(now, keys), now, kind));
    }
  }
  const [before, after] = [was.node.options ?? {}, now.node.options ?? {}];
  const changed = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((key) => !same(before[key], after[key]));
  const unsaid: string[] = [];
  for (const key of changed) {
    const words = OPTION_WORDS[key]?.(after[key], now, kind) ?? null;
    if (words === null) unsaid.push(key);
    say(words);
  }
  return { lines, unsaid };
}
